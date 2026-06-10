export type DeploymentDiagnosticCategory =
  | 'missing-field'
  | 'missing-object'
  | 'duplicate-metadata'
  | 'permission'
  | 'invalid-reference'
  | 'source-tracking-conflict'
  | 'unknown';

export type DeploymentDiagnostic = {
  component: string;
  problem: string;
  probableCause: string;
  remediation: string;
  rawDetails: string;
  category: DeploymentDiagnosticCategory;
};

type DeploymentFailureRecord = {
  component?: string;
  problem: string;
  rawDetails: string;
};

type SfFailureLike = {
  componentType?: unknown;
  fileName?: unknown;
  fullName?: unknown;
  problem?: unknown;
  problemType?: unknown;
  lineNumber?: unknown;
  columnNumber?: unknown;
};

const UNKNOWN_COMPONENT = 'Unknown component';
const UNKNOWN_NEXT_STEP =
  'Review the raw Salesforce deploy output, confirm the metadata exists in the target org, and retry with a focused validation for the affected component.';

export function normalizeDeploymentDiagnostics(output: string): DeploymentDiagnostic[] {
  const records = extractFailureRecords(output);
  const sourceRecords =
    records.length > 0
      ? records
      : [
          {
            component: UNKNOWN_COMPONENT,
            problem: output.trim() || 'Salesforce deployment failed without a detailed error message.',
            rawDetails: output,
          },
        ];

  return sourceRecords.map((record) => classifyFailure(record));
}

export function formatDeploymentDiagnostics(diagnostics: readonly DeploymentDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  return diagnostics
    .map((item, index) =>
      [
        `Diagnostic ${index + 1}: ${item.component}`,
        `Problem: ${item.problem}`,
        `Probable cause: ${item.probableCause}`,
        `Remediation: ${item.remediation}`,
      ].join('\n')
    )
    .join('\n\n');
}

function extractFailureRecords(output: string): DeploymentFailureRecord[] {
  const parsed = parseJsonObject(output);
  if (parsed === undefined) {
    return extractTextFailureRecords(output);
  }

  const failures = [
    ...asArray(readPath(parsed, ['result', 'details', 'componentFailures'])),
    ...asArray(readPath(parsed, ['result', 'details', 'runTestResult', 'failures'])),
    ...asArray(readPath(parsed, ['result', 'componentFailures'])),
  ];

  return failures
    .map((failure) => buildFailureRecord(failure))
    .filter((record): record is DeploymentFailureRecord => record !== undefined);
}

function parseJsonObject(output: string): Record<string, unknown> | undefined {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readPath(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined || value === null ? [] : [value];
}

function buildFailureRecord(value: unknown): DeploymentFailureRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const failure = value as SfFailureLike;
  const problem = stringValue(failure.problem);
  if (problem === undefined) {
    return undefined;
  }

  const componentParts = [
    stringValue(failure.componentType),
    stringValue(failure.fullName),
    stringValue(failure.fileName),
  ].filter((part): part is string => part !== undefined && part.length > 0);

  const location = [numberValue(failure.lineNumber), numberValue(failure.columnNumber)]
    .filter((part): part is number => part !== undefined)
    .join(':');

  return {
    component: componentParts.length > 0 ? componentParts.join(':') : UNKNOWN_COMPONENT,
    problem,
    rawDetails: JSON.stringify({ ...value, location: location || undefined }),
  };
}

function extractTextFailureRecords(output: string): DeploymentFailureRecord[] {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      component: inferComponentFromText(line),
      problem: line,
      rawDetails: line,
    }));
}

function classifyFailure(record: DeploymentFailureRecord): DeploymentDiagnostic {
  const normalized = record.problem.toLowerCase();

  if (matchesMissingField(normalized)) {
    return diagnostic(record, 'missing-field', {
      probableCause: 'A referenced field is not present in the target org or is deployed in a later wave.',
      remediation:
        'Deploy the missing CustomField before this component, add it to the same or earlier wave, or remove the stale field reference.',
    });
  }

  if (matchesMissingObject(normalized)) {
    return diagnostic(record, 'missing-object', {
      probableCause:
        'A referenced object is not present in the target org or the object metadata is missing from the package.',
      remediation:
        'Deploy the CustomObject before dependent metadata, include the object in the manifest, or correct the object API name.',
    });
  }

  if (matchesDuplicateMetadata(normalized)) {
    return diagnostic(record, 'duplicate-metadata', {
      probableCause:
        'The package contains duplicate metadata members or a component conflicts with metadata already owned elsewhere.',
      remediation:
        'Remove duplicate package entries, consolidate the metadata source, then rerun validation with one authoritative component path.',
    });
  }

  if (matchesPermission(normalized)) {
    return diagnostic(record, 'permission', {
      probableCause:
        'The deployment user lacks metadata, object, field, Apex, or setup permissions required for this change.',
      remediation:
        'Grant the deployment user the required permission set or org permission, then validate again with the same target org.',
    });
  }

  if (matchesSourceTrackingConflict(normalized)) {
    return diagnostic(record, 'source-tracking-conflict', {
      probableCause: 'Local source tracking is out of sync with the target org or conflicts with remote changes.',
      remediation:
        'Pull or reset source tracking for the org, reconcile conflicts, then rerun the deployment validation.',
    });
  }

  if (matchesInvalidReference(normalized)) {
    return diagnostic(record, 'invalid-reference', {
      probableCause:
        'The metadata references a component, value, label, class, flow, layout, or relationship that cannot be resolved.',
      remediation:
        'Deploy the referenced component first, correct the API name, or remove the stale reference from this metadata.',
    });
  }

  return diagnostic(record, 'unknown', {
    probableCause: 'Salesforce returned an error that does not match a known smart-deployment diagnostic pattern.',
    remediation: UNKNOWN_NEXT_STEP,
  });
}

function diagnostic(
  record: DeploymentFailureRecord,
  category: DeploymentDiagnosticCategory,
  details: Pick<DeploymentDiagnostic, 'probableCause' | 'remediation'>
): DeploymentDiagnostic {
  return {
    component: record.component ?? UNKNOWN_COMPONENT,
    problem: record.problem,
    rawDetails: record.rawDetails,
    category,
    ...details,
  };
}

function matchesMissingField(problem: string): boolean {
  return (
    /no such column|invalid field|field .* does not exist|unknown field|could not resolve standard field/i.test(
      problem
    ) || /in field: field - no customfield named/i.test(problem)
  );
}

function matchesMissingObject(problem: string): boolean {
  return (
    /entity is not org-accessible|invalid type|sobject type .* is not supported|no customobject named/i.test(problem) ||
    /reference to undefined object|object .* does not exist/i.test(problem)
  );
}

function matchesDuplicateMetadata(problem: string): boolean {
  return /duplicate value|duplicate name|duplicate full name|already exists|more than one/i.test(problem);
}

function matchesPermission(problem: string): boolean {
  return /insufficient access|insufficient privileges|not authorized|required permission|permission denied|invalid cross reference id/i.test(
    problem
  );
}

function matchesInvalidReference(problem: string): boolean {
  return /invalid reference|invalid relationship|invalid definition|not found|does not exist|unknown user permission|invalid value/i.test(
    problem
  );
}

function matchesSourceTrackingConflict(problem: string): boolean {
  return /source tracking|conflict|sync.*source|source.*out of sync|tracking.*reset/i.test(problem);
}

function inferComponentFromText(line: string): string {
  const match = line.match(/(?:component|file|entity|object|field)\s+['"]?([A-Za-z0-9_.:-]+)['"]?/i);
  return match?.[1] ?? UNKNOWN_COMPONENT;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
