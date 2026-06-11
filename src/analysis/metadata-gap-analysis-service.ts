import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { DEPLOYMENT_ORDER } from '../constants/deployment-order.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import { findDirectories, findFiles, fileExists } from '../services/scanners/scanner-runtime.js';
import { parseXml } from '../utils/xml.js';

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

type PackageXml = {
  Package?: {
    types?: PackageXmlType | PackageXmlType[];
  };
};

type PackageXmlType = {
  name?: string;
  members?: string | string[];
};

const SCANNER_SUPPORTED_TYPES = new Set<string>([
  'AiAuthoringBundle',
  'ApexClass',
  'ApexTrigger',
  'AuraDefinitionBundle',
  'Bot',
  'BotVersion',
  'BrandingSet',
  'CustomMetadata',
  'CustomMetadataRecord',
  'CustomObject',
  'CustomSite',
  'DigitalExperienceBundle',
  'EmailTemplate',
  'EmbeddedServiceConfig',
  'FlexiPage',
  'Flow',
  'GenAiPlannerBundle',
  'GenAiPromptTemplate',
  'Layout',
  'LightningComponentBundle',
  'Network',
  'PermissionSet',
  'Profile',
  'Queue',
  'StandardValueSet',
  'VisualforcePage',
]);

const ORDERED_TYPES = new Set<string>(Object.keys(DEPLOYMENT_ORDER));

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
  queues: 'Queue',
  sites: 'CustomSite',
  standardValueSets: 'StandardValueSet',
  triggers: 'ApexTrigger',
};

const FILE_SUFFIX_TYPES: Array<[suffix: string, metadataType: string]> = [
  ['.cls-meta.xml', 'ApexClass'],
  ['.trigger-meta.xml', 'ApexTrigger'],
  ['.flow-meta.xml', 'Flow'],
  ['.flexipage-meta.xml', 'FlexiPage'],
  ['.layout-meta.xml', 'Layout'],
  ['.permissionset-meta.xml', 'PermissionSet'],
  ['.profile-meta.xml', 'Profile'],
  ['.bot-meta.xml', 'Bot'],
  ['.botVersion-meta.xml', 'BotVersion'],
  ['.site-meta.xml', 'CustomSite'],
  ['.network-meta.xml', 'Network'],
  ['.queue-meta.xml', 'Queue'],
  ['.standardValueSet-meta.xml', 'StandardValueSet'],
  ['.embeddedServiceConfig-meta.xml', 'EmbeddedServiceConfig'],
  ['.app-meta.xml', 'CustomApplication'],
  ['.matchingRule-meta.xml', 'MatchingRule'],
];

export class MetadataGapAnalysisService {
  public async analyze(options: MetadataGapAnalysisOptions = {}): Promise<MetadataGapAnalysisResult> {
    const sourcePath = options.sourcePath ?? process.cwd();
    const project = await SfdxProjectDetector.detect(sourcePath);
    if (!project.detected) {
      throw new Error(`SFDX project not found in ${sourcePath}`);
    }

    const evidenceByType = new Map<string, TypeEvidence>();
    await this.collectManifestTypes(project.projectRoot, evidenceByType);
    await Promise.all(
      project.packageDirectories.map((packageDir) =>
        this.collectSourceTypes(packageDir, project.projectRoot, evidenceByType)
      )
    );

    const detectedTypes = [...evidenceByType.values()]
      .map((entry) => this.toDetectedType(project.projectRoot, entry))
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

  private async collectManifestTypes(projectRoot: string, evidenceByType: Map<string, TypeEvidence>): Promise<void> {
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
            entry.name,
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
    evidenceByType: Map<string, TypeEvidence>
  ): Promise<void> {
    if (!(await fileExists(packageDir))) {
      return;
    }

    const metadataFiles = await findFiles(packageDir, '**/*-meta.xml');
    for (const filePath of metadataFiles) {
      const inferredType = inferTypeFromFilePath(filePath);
      if (inferredType) {
        this.addEvidence(evidenceByType, inferredType, filePath, 'source-path');
      }
    }

    const directories = await findDirectories(packageDir, '**/*');
    for (const directoryPath of directories) {
      const relativeParts = path.relative(projectRoot, directoryPath).split(path.sep);
      const type = relativeParts.map((part) => SOURCE_DIRECTORY_TYPES[part]).find((value) => value !== undefined);
      if (type) {
        this.addEvidence(evidenceByType, type, directoryPath, 'source-path');
      }
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

  private toDetectedType(projectRoot: string, entry: TypeEvidence): MetadataGapDetectedType {
    return {
      metadataType: entry.metadataType,
      supportStatus: getSupportStatus(entry.metadataType),
      evidence: [...entry.evidence].map((evidence) => relativizeEvidence(projectRoot, evidence)).sort(),
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

  const genericSuffix = /\.([A-Za-z][A-Za-z0-9]*)-meta\.xml$/u.exec(fileName);
  return genericSuffix ? toMetadataTypeName(genericSuffix[1]) : undefined;
}

function toMetadataTypeName(rawType: string): string {
  return rawType
    .split(/[-_]/u)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function getSupportStatus(metadataType: string): MetadataGapSupportStatus {
  if (SCANNER_SUPPORTED_TYPES.has(metadataType)) {
    return 'supported';
  }

  return ORDERED_TYPES.has(metadataType) ? 'ordered-only' : 'unsupported';
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
