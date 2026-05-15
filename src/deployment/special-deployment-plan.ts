import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { XMLParser } from 'fast-xml-parser';
import { glob } from 'glob';
import { MetadataScannerService } from '../services/metadata-scanner-service.js';
import type { MetadataComponent } from '../types/metadata.js';
import {
  SfCliSpecialDeploymentTargetLookup,
  type SpecialDeploymentTargetLookup,
} from './special-deployment-target-lookup.js';

const execFileAsync = promisify(execFile);

export type SpecialDeploymentPhaseKind =
  | 'core-metadata'
  | 'agentforce-publish'
  | 'agentforce-activate'
  | 'ai-evaluations'
  | 'community-publish'
  | 'omnistudio-vlocity';

export type SpecialDeploymentCommand = {
  tool: 'sf' | 'vlocity';
  args: string[];
  reason: string;
};

export type SpecialDeploymentPhase = {
  kind: SpecialDeploymentPhaseKind;
  label: string;
  components: string[];
  excludedTypes?: string[];
  changedPaths?: string[];
  commands: SpecialDeploymentCommand[];
  skipped: boolean;
  skipReason?: string;
  errors?: string[];
  warnings?: string[];
};

export type SpecialDeploymentPlan = {
  success: boolean;
  projectRoot: string;
  apiVersion: string;
  targetOrg?: string;
  since?: string;
  dryRun: boolean;
  autoActivate: boolean;
  phases: SpecialDeploymentPhase[];
  warnings: string[];
  errors: string[];
};

export type SpecialDeploymentPlanOptions = {
  sourcePath?: string;
  since?: string;
  targetOrg?: string;
  dryRun?: boolean;
  autoActivate?: boolean;
  scanner?: Pick<MetadataScannerService, 'scan'>;
  changedPathProvider?: (projectRoot: string, since?: string) => Promise<string[]>;
  targetLookup?: SpecialDeploymentTargetLookup;
};

type ProviderContext = {
  projectRoot: string;
  apiVersion: string;
  components: MetadataComponent[];
  changedPaths: string[];
  since?: string;
  targetOrg?: string;
  dryRun: boolean;
  autoActivate: boolean;
  targetLookup: SpecialDeploymentTargetLookup;
};

type SpecialDeploymentProvider = {
  plan(context: ProviderContext): Promise<SpecialDeploymentPhase>;
};

const CORE_EXCLUDED_TYPES = ['Bot', 'BotVersion', 'AiAuthoringBundle'];

export class SpecialDeploymentPlanService {
  public async buildPlan(options: SpecialDeploymentPlanOptions = {}): Promise<SpecialDeploymentPlan> {
    const scanner = options.scanner ?? new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath: options.sourcePath });
    const projectRoot = scanResult.projectRoot;
    const changedPathProvider = options.changedPathProvider ?? getChangedPaths;
    const changedPaths = await changedPathProvider(projectRoot, options.since);
    const context: ProviderContext = {
      projectRoot,
      apiVersion: scanResult.apiVersion,
      components: scanResult.components,
      changedPaths,
      since: options.since,
      targetOrg: options.targetOrg,
      dryRun: options.dryRun ?? true,
      autoActivate: options.autoActivate ?? false,
      targetLookup: options.targetLookup ?? new SfCliSpecialDeploymentTargetLookup(),
    };

    const providers: SpecialDeploymentProvider[] = [
      new CoreMetadataProvider(),
      new AgentforcePublishProvider(),
      new AgentforceActivationProvider(),
      new AiEvaluationProvider(),
      new CommunityPublishProvider(),
      new OmniStudioVlocityProvider(),
    ];

    const phases = await Promise.all(providers.map(async (provider) => provider.plan(context)));
    const phaseErrors = phases.flatMap((phase) => phase.errors ?? []);
    const warnings = [...scanResult.warnings, ...phases.flatMap((phase) => phase.warnings ?? [])];

    return {
      success: scanResult.errors.length === 0 && phaseErrors.length === 0,
      projectRoot,
      apiVersion: scanResult.apiVersion,
      targetOrg: options.targetOrg,
      since: options.since,
      dryRun: context.dryRun,
      autoActivate: context.autoActivate,
      phases,
      warnings,
      errors: [...scanResult.errors, ...phaseErrors],
    };
  }
}

class CoreMetadataProvider implements SpecialDeploymentProvider {
  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const components = context.components
      .filter((component) => !CORE_EXCLUDED_TYPES.includes(component.type))
      .map(toComponentKey)
      .sort();

    return {
      kind: 'core-metadata',
      label: 'Phase 1: Core metadata deploy',
      components,
      excludedTypes: [...CORE_EXCLUDED_TYPES],
      commands: [
        {
          tool: 'sf',
          args: withTargetOrg(['project', 'deploy', 'start', '--manifest', '<generated-core-manifest>'], context),
          reason: 'Deploy regular Salesforce metadata after excluding lifecycle-owned provider artifacts.',
        },
      ],
      skipped: components.length === 0,
      skipReason: components.length === 0 ? 'No core metadata components detected.' : undefined,
    };
  }
}

class AgentforcePublishProvider implements SpecialDeploymentProvider {
  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const bundles = findChangedNames(context, /(?:^|\/)aiAuthoringBundles\/([^/]+)\//u);

    return {
      kind: 'agentforce-publish',
      label: 'Phase 2: Agentforce authoring bundle publish',
      components: bundles.map((name) => `AiAuthoringBundle:${name}`),
      changedPaths: changedPathsFor(context.changedPaths, 'aiAuthoringBundles/'),
      commands: bundles.map((name) => ({
        tool: 'sf',
        args: withTargetOrg(['agent', 'publish', 'authoring-bundle', '-n', name, '--skip-retrieve', '--json'], context),
        reason: 'Publish changed Agentforce authoring bundle without retrieving generated version artifacts.',
      })),
      skipped: bundles.length === 0,
      skipReason: bundles.length === 0 ? 'No changed aiAuthoringBundles detected.' : undefined,
    };
  }
}

class AgentforceActivationProvider implements SpecialDeploymentProvider {
  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const bundles = context.autoActivate ? findChangedNames(context, /(?:^|\/)aiAuthoringBundles\/([^/]+)\//u) : [];

    return {
      kind: 'agentforce-activate',
      label: 'Phase 3: Agentforce activation',
      components: bundles.map((name) => `AiAuthoringBundle:${name}`),
      changedPaths: changedPathsFor(context.changedPaths, 'aiAuthoringBundles/'),
      commands: bundles.map((name) => ({
        tool: 'sf',
        args: withTargetOrg(['agent', 'activate', '-n', name, '--version', `<published-version:${name}>`], context),
        reason: 'Activate the newly published Agentforce version only when explicitly requested.',
      })),
      skipped: bundles.length === 0,
      skipReason: context.autoActivate
        ? 'No changed aiAuthoringBundles detected.'
        : 'Activation is disabled by default.',
    };
  }
}

class AiEvaluationProvider implements SpecialDeploymentProvider {
  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const files = await glob('**/aiEvaluationDefinitions/**/*.xml', {
      cwd: context.projectRoot,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    const changedFiles = files.filter((file) => isChanged(context, file)).sort();
    const sourceSubjects = new Set(
      context.components
        .filter((component) => component.type === 'AiAuthoringBundle' || component.type === 'Bot')
        .map((component) => component.name)
    );
    const precheckErrors = await findMissingEvaluationSubjects(
      context.projectRoot,
      changedFiles,
      sourceSubjects,
      context.targetOrg,
      context.targetLookup
    );

    return {
      kind: 'ai-evaluations',
      label: 'Phase 4: AI evaluation metadata deploy',
      components: changedFiles.map((file) => `AiEvaluationDefinition:${path.basename(file, '.xml')}`),
      changedPaths: changedFiles,
      commands:
        changedFiles.length > 0
          ? [
              {
                tool: 'sf',
                args: withTargetOrg(
                  ['project', 'deploy', 'start', '--manifest', '<generated-ai-evaluation-manifest>'],
                  context
                ),
                reason: 'Deploy AI evaluations after Agentforce bundle publish/precheck ordering.',
              },
            ]
          : [],
      skipped: changedFiles.length === 0,
      skipReason: changedFiles.length === 0 ? 'No changed AiEvaluationDefinition files detected.' : undefined,
      errors: precheckErrors,
      warnings:
        changedFiles.length > 0 && !context.targetOrg
          ? ['AiEvaluationDefinition target-org subject lookup requires --target-org.']
          : undefined,
    };
  }
}

class CommunityPublishProvider implements SpecialDeploymentProvider {
  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const sites = findChangedNames(context, /(?:^|\/)digitalExperiences\/site\/([^/]+)\//u);

    return {
      kind: 'community-publish',
      label: 'Phase 5: Experience Cloud community publish',
      components: sites.map((name) => `DigitalExperience:${name}`),
      changedPaths: changedPathsFor(context.changedPaths, 'digitalExperiences/site/'),
      commands: sites.map((name) => ({
        tool: 'sf',
        args: withTargetOrg(['community', 'publish', '-n', name], context),
        reason: 'Publish changed LWR site to register route/view bindings after metadata deployment.',
      })),
      skipped: sites.length === 0,
      skipReason: sites.length === 0 ? 'No changed digitalExperiences/site directories detected.' : undefined,
    };
  }
}

class OmniStudioVlocityProvider implements SpecialDeploymentProvider {
  private readonly omniPathPattern =
    /(?:^|\/)(vlocity|omnistudio|omniScripts|dataRaptors|integrationProcedures|flexCards)(?:\/|$)/iu;

  public async plan(context: ProviderContext): Promise<SpecialDeploymentPhase> {
    const changedPaths = context.changedPaths.filter((filePath) => this.omniPathPattern.test(filePath)).sort();

    return {
      kind: 'omnistudio-vlocity',
      label: 'Optional phase: OmniStudio managed-package DataPacks',
      components: [...new Set(changedPaths.map((filePath) => firstPathSegment(filePath)))].sort(),
      changedPaths,
      commands:
        changedPaths.length > 0
          ? [
              {
                tool: 'vlocity',
                args: ['packDeploy', '--job', '<generated-vlocity-job.yaml>'],
                reason: 'Deploy managed-package OmniStudio DataPacks outside Salesforce core metadata deploy.',
              },
            ]
          : [],
      skipped: changedPaths.length === 0,
      skipReason:
        changedPaths.length === 0 ? 'No changed OmniStudio managed-package/DataPack paths detected.' : undefined,
    };
  }
}

async function getChangedPaths(projectRoot: string, since?: string): Promise<string[]> {
  if (!since) {
    const files = await glob('**/*', {
      cwd: projectRoot,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/lib/**'],
    });
    return files.sort();
  }

  const { stdout } = await execFileAsync('git', ['diff', '--name-only', since, 'HEAD', '--'], { cwd: projectRoot });
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function findChangedNames(context: ProviderContext, pattern: RegExp): string[] {
  const names = new Set<string>();
  for (const changedPath of context.changedPaths) {
    const match = pattern.exec(normalizePath(changedPath));
    if (match?.[1]) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

function changedPathsFor(changedPaths: string[], segment: string): string[] {
  return changedPaths.filter((changedPath) => normalizePath(changedPath).includes(segment)).sort();
}

function isChanged(context: ProviderContext, filePath: string): boolean {
  if (!context.since) {
    return true;
  }
  return context.changedPaths.includes(filePath);
}

function toComponentKey(component: MetadataComponent): string {
  return `${component.type}:${component.name}`;
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function firstPathSegment(filePath: string): string {
  return normalizePath(filePath).split('/')[0] ?? filePath;
}

function withTargetOrg(args: string[], context: ProviderContext): string[] {
  if (!context.targetOrg) {
    return args;
  }

  return [...args, '--target-org', context.targetOrg];
}

async function findMissingEvaluationSubjects(
  projectRoot: string,
  files: string[],
  sourceSubjects: ReadonlySet<string>,
  targetOrg: string | undefined,
  targetLookup: SpecialDeploymentTargetLookup
): Promise<string[]> {
  const parser = new XMLParser({ ignoreAttributes: false });
  const errors: string[] = [];

  for (const file of files) {
    const absolutePath = path.join(projectRoot, file);
    const content = await readFile(absolutePath, 'utf8');
    const parsed = parser.parse(content) as Record<string, unknown>;
    const subjectName = findXmlValue(parsed, 'subjectName');
    if (!subjectName || sourceSubjects.has(subjectName)) {
      continue;
    }

    const existsInTarget = targetOrg ? await targetLookup.hasEvaluationSubject(targetOrg, subjectName) : false;
    if (!existsInTarget) {
      errors.push(`${file}: subjectName "${subjectName}" was not found in source Agentforce bundles or Bots.`);
    }
  }

  return errors;
}

function findXmlValue(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directValue = record[key];
  if (typeof directValue === 'string') {
    return directValue;
  }

  for (const nested of Object.values(record)) {
    const found = findXmlValue(nested, key);
    if (found) {
      return found;
    }
  }

  return undefined;
}
