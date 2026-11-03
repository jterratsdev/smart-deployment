import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import { findDirectories, findFiles, fileExists } from '../services/scanners/scanner-runtime.js';
import { parseDuplicateRule } from '../parsers/duplicate-rule-parser.js';
import { parseMatchingRules } from '../parsers/matching-rules-parser.js';
import {
  validateDuplicateRuleFileName,
  validateMatchingRulesFileName,
} from '../services/scanners/data-quality-rule-scanner.js';
import { parseXml } from '../utils/xml.js';
import { MetadataCapabilityRegistry, metadataCapabilityRegistry } from './metadata-capability-registry.js';

export type MetadataGapClassification =
  | 'registry-only'
  | 'dependency-rule'
  | 'ordering-special'
  | 'provider-owned'
  | 'human-review-required';

export type MetadataGapSupportStatus = 'supported' | 'ordered-only' | 'unsupported';

export type MetadataGapDetectedType = {
  metadataType: string;
  supportStatus: MetadataGapSupportStatus;
  evidence: string[];
  detectedFrom: Array<'package-manifest' | 'source-path'>;
};

export type MetadataGapFinding = MetadataGapDetectedType & {
  classification: MetadataGapClassification;
  reason: string;
  suggestedImplementation: string[];
  requiresHumanReview: boolean;
};

export type MetadataGapAIContext = {
  mode: 'workflow-prompt';
  directProviderApiAllowed: false;
  recommendedCommand: string;
  prompt: string;
};

export type MetadataGapAnalysisResult = {
  success: boolean;
  analysisMode: 'deterministic' | 'deterministic-with-ai-context';
  projectRoot: string;
  apiVersion: string;
  detectedTypes: MetadataGapDetectedType[];
  gaps: MetadataGapFinding[];
  aiContext?: MetadataGapAIContext;
  summary: {
    detectedTypeCount: number;
    supportedTypeCount: number;
    gapCount: number;
    humanReviewCount: number;
  };
};

export type MetadataGapAnalysisOptions = {
  sourcePath?: string;
  aiExplain?: boolean;
};

type TypeEvidence = {
  metadataType: string;
  evidence: Set<string>;
  detectedFrom: Set<'package-manifest' | 'source-path'>;
};

type ParseVerificationState = {
  detectedFileCount: number;
  failures: Array<{ filePath: string; message: string }>;
};

type PackageXml = {
  Package?: {
    types?: PackageXmlType | PackageXmlType[];
  };
};

type PackageXmlType = {
  name?: string;
  members?: string | string[];
};

const SOURCE_DIRECTORY_TYPES: Record<string, string> = {
  aiAuthoringBundles: 'AiAuthoringBundle',
  aura: 'AuraDefinitionBundle',
  bots: 'Bot',
  brandingSets: 'BrandingSet',
  classes: 'ApexClass',
  customMetadata: 'CustomMetadataRecord',
  digitalExperiences: 'DigitalExperienceBundle',
  email: 'EmailTemplate',
  embeddedServiceConfigs: 'EmbeddedServiceConfig',
  flexipages: 'FlexiPage',
  flows: 'Flow',
  genAiPlannerBundles: 'GenAiPlannerBundle',
  genAiPromptTemplates: 'GenAiPromptTemplate',
  layouts: 'Layout',
  lwc: 'LightningComponentBundle',
  networks: 'Network',
  objects: 'CustomObject',
  applications: 'CustomApplication',
  pages: 'VisualforcePage',
  permissionsets: 'PermissionSet',
  profiles: 'Profile',
  sharingRules: 'SharingRules',
  queues: 'Queue',
  sites: 'CustomSite',
  standardValueSets: 'StandardValueSet',
  triggers: 'ApexTrigger',
};

const FILE_SUFFIX_TYPES: Array<[suffix: string, metadataType: string]> = [
  ['.cls-meta.xml', 'ApexClass'],
  ['.page-meta.xml', 'ApexPage'],
  ['.trigger-meta.xml', 'ApexTrigger'],
  ['.flow-meta.xml', 'Flow'],
  ['.flexipage-meta.xml', 'FlexiPage'],
  ['.layout-meta.xml', 'Layout'],
  ['.permissionset-meta.xml', 'PermissionSet'],
  ['.profile-meta.xml', 'Profile'],
  ['.sharingRules-meta.xml', 'SharingRules'],
  ['.bot-meta.xml', 'Bot'],
  ['.botVersion-meta.xml', 'BotVersion'],
  ['.site-meta.xml', 'CustomSite'],
  ['.network-meta.xml', 'Network'],
  ['.queue-meta.xml', 'Queue'],
  ['.standardValueSet-meta.xml', 'StandardValueSet'],
  ['.embeddedServiceConfig-meta.xml', 'EmbeddedServiceConfig'],
  ['.app-meta.xml', 'CustomApplication'],
  ['.matchingRule-meta.xml', 'MatchingRules'],
  ['.duplicateRule-meta.xml', 'DuplicateRule'],
  ['.field-meta.xml', 'CustomField'],
  ['.globalValueSet-meta.xml', 'GlobalValueSet'],
];

/**
 * Types whose `supported` gap status requires every detected source file to parse
 * successfully, not just a suffix match plus registry evidence (AC-001, AC-003; design §5).
 * Verifier functions reuse the real scanner parsers so "supported" only ever reflects a
 * successful parse, never a manifest member or a registry row alone.
 */
const PARSE_VERIFIED_TYPES: ReadonlyMap<string, (filePath: string, content: string) => void> = new Map([
  [
    'MatchingRules',
    (filePath: string, content: string): void => {
      const objectName = validateMatchingRulesFileName(filePath);
      parseMatchingRules(objectName, content);
    },
  ],
  [
    'DuplicateRule',
    (filePath: string, content: string): void => {
      const { objectName } = validateDuplicateRuleFileName(filePath);
      parseDuplicateRule(objectName, content);
    },
  ],
]);

export class MetadataGapAnalysisService {
  public constructor(private readonly capabilityRegistry: MetadataCapabilityRegistry = metadataCapabilityRegistry) {}

  public async analyze(options: MetadataGapAnalysisOptions = {}): Promise<MetadataGapAnalysisResult> {
    const sourcePath = options.sourcePath ?? process.cwd();
    const project = await SfdxProjectDetector.detect(sourcePath);
    if (!project.detected) {
      throw new Error(`SFDX project not found in ${sourcePath}`);
    }

    const evidenceByType = new Map<string, TypeEvidence>();
    const parseVerificationByType = new Map<string, ParseVerificationState>();
    await this.collectManifestTypes(project.projectRoot, project.apiVersion, evidenceByType);
    await Promise.all(
      project.packageDirectories.map((packageDir) =>
        this.collectSourceTypes(
          packageDir,
          project.projectRoot,
          project.apiVersion,
          evidenceByType,
          parseVerificationByType
        )
      )
    );

    const detectedTypes = [...evidenceByType.values()]
      .map((entry) =>
        this.toDetectedType(
          project.projectRoot,
          project.apiVersion,
          entry,
          parseVerificationByType.get(entry.metadataType)
        )
      )
      .sort((left, right) => left.metadataType.localeCompare(right.metadataType));
    const gaps = detectedTypes.filter((type) => type.supportStatus !== 'supported').map((type) => this.toGap(type));

    const result: MetadataGapAnalysisResult = {
      success: true,
      analysisMode: options.aiExplain === true ? 'deterministic-with-ai-context' : 'deterministic',
      projectRoot: project.projectRoot,
      apiVersion: project.apiVersion,
      detectedTypes,
      gaps,
      summary: {
        detectedTypeCount: detectedTypes.length,
        supportedTypeCount: detectedTypes.filter((type) => type.supportStatus === 'supported').length,
        gapCount: gaps.length,
        humanReviewCount: gaps.filter((gap) => gap.requiresHumanReview).length,
      },
    };

    if (options.aiExplain === true) {
      result.aiContext = this.buildAIContext(result);
    }

    return result;
  }

  private async collectManifestTypes(
    projectRoot: string,
    apiVersion: string,
    evidenceByType: Map<string, TypeEvidence>
  ): Promise<void> {
    const manifestFiles = await findFiles(
      projectRoot,
      '**/{package,destructiveChanges,destructiveChangesPre,destructiveChangesPost}.xml'
    );
    await Promise.all(
      manifestFiles.map(async (manifestPath) => {
        const parsed = parseXml<PackageXml>(await readFile(manifestPath, 'utf-8'));
        const entries = toArray(parsed.Package?.types);
        for (const entry of entries) {
          if (typeof entry.name !== 'string' || entry.name.length === 0) {
            continue;
          }

          const members = toArray(entry.members);
          const memberCount = members.length;
          this.addEvidence(
            evidenceByType,
            this.canonicalType(entry.name, apiVersion),
            `${manifestPath}${memberCount > 0 ? ` (${memberCount} members)` : ''}`,
            'package-manifest'
          );
        }
      })
    );
  }

  private async collectSourceTypes(
    packageDir: string,
    projectRoot: string,
    apiVersion: string,
    evidenceByType: Map<string, TypeEvidence>,
    parseVerificationByType: Map<string, ParseVerificationState>
  ): Promise<void> {
    if (!(await fileExists(packageDir))) {
      return;
    }

    const metadataFiles = await findFiles(packageDir, '**/*-meta.xml');
    // Collect each file's outcome in isolation and reduce into the shared maps only after every
    // `await` has settled (F2). A get-or-create-then-set on `parseVerificationByType` across an
    // `await readFile` would let concurrent callbacks each create their own state object and
    // overwrite one another's detectedFileCount/failures (last writer wins), silently dropping a
    // parse failure and making `supported` depend on scheduling order.
    const fileResults = await Promise.all(metadataFiles.map((filePath) => this.verifySourceFile(filePath, apiVersion)));
    for (const result of fileResults) {
      if (!result) {
        continue;
      }
      this.addEvidence(evidenceByType, result.canonicalType, result.filePath, 'source-path');
      if (!result.parseVerified) {
        continue;
      }
      const state = parseVerificationByType.get(result.canonicalType) ?? { detectedFileCount: 0, failures: [] };
      state.detectedFileCount += 1;
      if (result.failure) {
        state.failures.push(result.failure);
      }
      parseVerificationByType.set(result.canonicalType, state);
    }

    const directories = await findDirectories(packageDir, '**/*');
    for (const directoryPath of directories) {
      const relativeParts = path.relative(projectRoot, directoryPath).split(path.sep);
      const type = relativeParts.map((part) => SOURCE_DIRECTORY_TYPES[part]).find((value) => value !== undefined);
      if (type) {
        this.addEvidence(evidenceByType, this.canonicalType(type, apiVersion), directoryPath, 'source-path');
      }
    }
  }

  private canonicalType(metadataType: string, apiVersion: string): string {
    const entry = this.capabilityRegistry.resolve(metadataType, apiVersion);
    return entry?.vendorType ?? metadataType;
  }

  /**
   * Infers the canonical type for one source file and, for a `PARSE_VERIFIED_TYPES` type,
   * parses it. Returns a self-contained result with no shared mutable state, so callers can
   * run this across every file concurrently and reduce the results afterward (F2).
   */
  private async verifySourceFile(
    filePath: string,
    apiVersion: string
  ): Promise<
    | {
        filePath: string;
        canonicalType: string;
        parseVerified: boolean;
        failure?: { filePath: string; message: string };
      }
    | undefined
  > {
    const inferredType = inferTypeFromFilePath(filePath);
    if (!inferredType) {
      return undefined;
    }
    const canonicalType = this.canonicalType(inferredType, apiVersion);
    const verifier = PARSE_VERIFIED_TYPES.get(canonicalType);
    if (!verifier) {
      return { filePath, canonicalType, parseVerified: false };
    }

    try {
      verifier(filePath, await readFile(filePath, 'utf-8'));
      return { filePath, canonicalType, parseVerified: true };
    } catch (error) {
      return {
        filePath,
        canonicalType,
        parseVerified: true,
        failure: { filePath, message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private addEvidence(
    evidenceByType: Map<string, TypeEvidence>,
    metadataType: string,
    evidence: string,
    detectedFrom: 'package-manifest' | 'source-path'
  ): void {
    const entry =
      evidenceByType.get(metadataType) ??
      ({
        metadataType,
        evidence: new Set<string>(),
        detectedFrom: new Set<'package-manifest' | 'source-path'>(),
      } satisfies TypeEvidence);
    entry.evidence.add(evidence);
    entry.detectedFrom.add(detectedFrom);
    evidenceByType.set(metadataType, entry);
  }

  private toDetectedType(
    projectRoot: string,
    apiVersion: string,
    entry: TypeEvidence,
    parseVerification: ParseVerificationState | undefined
  ): MetadataGapDetectedType {
    const evidence = [...entry.evidence].map((item) => relativizeEvidence(projectRoot, item)).sort();
    const supportStatus = getSupportStatus(this.capabilityRegistry, entry.metadataType, apiVersion, parseVerification);
    if (PARSE_VERIFIED_TYPES.has(entry.metadataType)) {
      if (!parseVerification) {
        evidence.push(`${entry.metadataType}: manifest-only evidence, no source file detected to parse`);
      } else {
        for (const failure of parseVerification.failures) {
          evidence.push(`${relativizeEvidence(projectRoot, failure.filePath)}: ${failure.message}`);
        }
      }
    }

    return {
      metadataType: entry.metadataType,
      supportStatus,
      evidence: evidence.sort(),
      detectedFrom: [...entry.detectedFrom].sort(),
    };
  }

  private toGap(type: MetadataGapDetectedType): MetadataGapFinding {
    const classification = classifyGap(type.metadataType, type.supportStatus);
    return {
      ...type,
      classification,
      reason: describeClassification(type.metadataType, type.supportStatus, classification),
      suggestedImplementation: suggestImplementation(type.metadataType, type.supportStatus, classification),
      requiresHumanReview: classification === 'provider-owned' || classification === 'human-review-required',
    };
  }

  private buildAIContext(result: MetadataGapAnalysisResult): MetadataGapAIContext {
    const gapLines =
      result.gaps.length === 0
        ? ['No metadata support gaps detected.']
        : result.gaps.map(
            (gap) =>
              `- ${gap.metadataType}: ${gap.classification}, ${gap.supportStatus}, evidence=${gap.evidence.join(', ')}`
          );

    return {
      mode: 'workflow-prompt',
      directProviderApiAllowed: false,
      recommendedCommand: 'sf setup-agents workflow run --story PLUGIN-AI-METADATA-GAP-DETECTION',
      prompt: [
        'Analyze this deterministic smart-deployment metadata gap report.',
        'Do not call provider APIs from the plugin runtime.',
        'For safe gaps, propose scoped code, fixture, and test changes.',
        'For provider-owned or human-review gaps, keep them blocked and explain the review evidence needed.',
        '',
        `Project root: ${result.projectRoot}`,
        `API version: ${result.apiVersion}`,
        `Detected metadata types: ${result.summary.detectedTypeCount}`,
        `Gap count: ${result.summary.gapCount}`,
        '',
        ...gapLines,
      ].join('\n'),
    };
  }
}

function inferTypeFromFilePath(filePath: string): string | undefined {
  const fileName = path.basename(filePath);
  const explicit = FILE_SUFFIX_TYPES.find(([suffix]) => fileName.endsWith(suffix));
  if (explicit) {
    return explicit[1];
  }

  return undefined;
}

function getSupportStatus(
  registry: MetadataCapabilityRegistry,
  metadataType: string,
  apiVersion: string,
  parseVerification: ParseVerificationState | undefined
): MetadataGapSupportStatus {
  const entry = registry.resolve(metadataType, apiVersion);
  const discoveryProven = entry?.capabilities.discovery.status === 'proven';

  if (PARSE_VERIFIED_TYPES.has(metadataType)) {
    const hasDetectedSource = (parseVerification?.detectedFileCount ?? 0) > 0;
    const allParsed = (parseVerification?.failures.length ?? 0) === 0;
    if (discoveryProven && hasDetectedSource && allParsed) {
      return 'supported';
    }
    return entry?.capabilities.ordering.status === 'proven' ? 'ordered-only' : 'unsupported';
  }

  if (discoveryProven) {
    return 'supported';
  }

  return entry?.capabilities.ordering.status === 'proven' ? 'ordered-only' : 'unsupported';
}

function classifyGap(metadataType: string, supportStatus: MetadataGapSupportStatus): MetadataGapClassification {
  if (isProviderOwned(metadataType)) {
    return 'provider-owned';
  }

  if (isHumanReviewRequired(metadataType)) {
    return 'human-review-required';
  }

  if (isOrderingSpecial(metadataType)) {
    return 'ordering-special';
  }

  if (supportStatus === 'ordered-only' || needsDependencyRules(metadataType)) {
    return 'dependency-rule';
  }

  return 'registry-only';
}

function isProviderOwned(metadataType: string): boolean {
  return /(Ai|Einstein|GenAi|Ml|Bot|DigitalExperience|Experience|Network|Site|Lwr)/u.test(metadataType);
}

function isHumanReviewRequired(metadataType: string): boolean {
  return /(Profile|Permission|Sharing|Territory|License|AuthProvider|ConnectedApp|Certificate|Credential)/u.test(
    metadataType
  );
}

function isOrderingSpecial(metadataType: string): boolean {
  return /(Settings|Credential|RemoteSite|ExternalData|DataSource|CspTrusted|CorsWhitelist)/u.test(metadataType);
}

function needsDependencyRules(metadataType: string): boolean {
  return /(Rule|Layout|Field|Object|Flow|Action|Application|RecordType|Duplicate|Matching|Assignment|Escalation)/u.test(
    metadataType
  );
}

function describeClassification(
  metadataType: string,
  supportStatus: MetadataGapSupportStatus,
  classification: MetadataGapClassification
): string {
  if (supportStatus === 'ordered-only') {
    return `${metadataType} has deployment ordering but no scanner/parser coverage, so dependency behavior is not proven.`;
  }

  const descriptions: Record<MetadataGapClassification, string> = {
    'registry-only': `${metadataType} appears to be a simple metadata type that may only need registry and fixture coverage.`,
    'dependency-rule': `${metadataType} likely references other metadata and needs parser or dependency rules before it is safe.`,
    'ordering-special': `${metadataType} likely has deployment ordering constraints that must be validated before support is enabled.`,
    'provider-owned': `${metadataType} may require provider publish, activation, or lifecycle handling outside standard metadata deploy.`,
    'human-review-required': `${metadataType} affects security, access, credentials, or org-level behavior and requires explicit review.`,
  };
  return descriptions[classification];
}

function suggestImplementation(
  metadataType: string,
  supportStatus: MetadataGapSupportStatus,
  classification: MetadataGapClassification
): string[] {
  const suggestions = [
    `Add ${metadataType} fixtures covering package.xml and source-path detection.`,
    'Add metadata gap analysis unit coverage before marking the type supported.',
  ];

  if (supportStatus === 'unsupported') {
    suggestions.push('Add deployment ordering only after fixture validation proves safe ordering.');
  }

  if (classification === 'dependency-rule') {
    suggestions.push('Add parser or dependency extraction rules for referenced metadata.');
  } else if (classification === 'ordering-special') {
    suggestions.push('Add explicit ordering tests and deploy-validate evidence.');
  } else if (classification === 'provider-owned') {
    suggestions.push('Define publish/activate lifecycle handling or keep the type blocked.');
  } else if (classification === 'human-review-required') {
    suggestions.push('Require human review before enabling deploy automation for this type.');
  } else {
    suggestions.push('Register the type as scanner-supported only after deterministic fixture tests pass.');
  }

  return suggestions;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function relativizeEvidence(projectRoot: string, evidence: string): string {
  const suffix = evidence.match(/ \(\d+ members\)$/u)?.[0] ?? '';
  const pathPart = suffix ? evidence.slice(0, -suffix.length) : evidence;
  const relative = path.isAbsolute(pathPart) ? path.relative(projectRoot, pathPart) : pathPart;
  return suffix ? `${relative}${suffix}` : relative;
}
