import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseXml } from '../../utils/xml.js';
import type { MetadataComponent, MetadataDependencyReference, MetadataType } from '../../types/metadata.js';
import { getLogger } from '../../utils/logger.js';
import { buildScannerError, findDirectories, findFiles } from './scanner-runtime.js';

type SimpleFileScanner = {
  type: MetadataType;
  pattern: string;
  suffix: string;
  parseDependencies?: (filePath: string) => Promise<ParsedDependencies>;
};

type ParsedDependencies = {
  dependencies: Set<string>;
  dependencyDetails?: MetadataDependencyReference[];
};

type BundleScanner = {
  type: MetadataType;
  pattern: string;
  parseDependencies?: (directoryPath: string) => Promise<Set<string>>;
};

const SIMPLE_FILE_SCANNERS: SimpleFileScanner[] = [
  {
    type: 'StandardValueSet',
    pattern: '**/standardValueSets/**/*.standardValueSet-meta.xml',
    suffix: '.standardValueSet-meta.xml',
  },
  {
    type: 'EmbeddedServiceConfig',
    pattern: '**/{EmbeddedServiceConfig,embeddedServiceConfigs}/**/*.embeddedServiceConfig-meta.xml',
    suffix: '.embeddedServiceConfig-meta.xml',
    parseDependencies: parseEmbeddedServiceConfigDependencies,
  },
  {
    type: 'Queue',
    pattern: '**/queues/**/*.queue-meta.xml',
    suffix: '.queue-meta.xml',
  },
  {
    type: 'BrandingSet',
    pattern: '**/brandingSets/**/*.brandingSet-meta.xml',
    suffix: '.brandingSet-meta.xml',
  },
  {
    type: 'Network',
    pattern: '**/networks/**/*.network-meta.xml',
    suffix: '.network-meta.xml',
    parseDependencies: parseNetworkDependencies,
  },
  {
    type: 'CustomSite',
    pattern: '**/sites/**/*.site-meta.xml',
    suffix: '.site-meta.xml',
  },
  {
    type: 'DataSourceObject',
    pattern: '**/dataSourceObjects/**/*.dataSourceObject-meta.xml',
    suffix: '.dataSourceObject-meta.xml',
  },
  {
    type: 'DataPackageKitDefinition',
    pattern: '**/dataPackageKitDefinitions/**/*.dataPackageKitDefinition-meta.xml',
    suffix: '.dataPackageKitDefinition-meta.xml',
  },
  {
    type: 'DataPackageKitObject',
    pattern: '**/DataPackageKitObjects/**/*.DataPackageKitObject-meta.xml',
    suffix: '.DataPackageKitObject-meta.xml',
    parseDependencies: parseDataPackageKitObjectDependencies,
  },
];

const BUNDLE_SCANNERS: BundleScanner[] = [
  {
    type: 'DigitalExperienceBundle',
    pattern: '**/digitalExperiences/*',
    parseDependencies: parseDigitalExperienceBundleDependencies,
  },
];

const logger = getLogger('AdditionalMetadataScanner');

type ParsedXml = Record<string, unknown>;

export async function scanAdditionalMetadata(
  packagePath: string,
  errors: string[],
  shouldIgnore: (filePath: string) => boolean
): Promise<MetadataComponent[]> {
  const fileComponents = await Promise.all(
    SIMPLE_FILE_SCANNERS.map((scanner) => scanSimpleFileMetadata(packagePath, scanner, errors, shouldIgnore))
  );
  const bundleComponents = await Promise.all(
    BUNDLE_SCANNERS.map((scanner) => scanBundleMetadata(packagePath, scanner, errors, shouldIgnore))
  );

  return [...fileComponents.flat(), ...bundleComponents.flat()];
}

async function scanSimpleFileMetadata(
  packagePath: string,
  scanner: SimpleFileScanner,
  errors: string[],
  shouldIgnore: (filePath: string) => boolean
): Promise<MetadataComponent[]> {
  const files = await findFiles(packagePath, scanner.pattern);
  const components = await Promise.all(
    files
      .filter((filePath) => !shouldIgnore(filePath))
      .map(async (filePath) => {
        try {
          const parsedDependencies = scanner.parseDependencies
            ? await scanner.parseDependencies(filePath)
            : { dependencies: new Set<string>() };
          return createComponent({
            name: path.basename(filePath, scanner.suffix),
            type: scanner.type,
            filePath,
            ...parsedDependencies,
          });
        } catch (error) {
          const errorMessage = buildScannerError(scanner.type, filePath, error);
          logger.warn(errorMessage);
          errors.push(errorMessage);
          return undefined;
        }
      })
  );

  return components.filter(isDefined);
}

async function scanBundleMetadata(
  packagePath: string,
  scanner: BundleScanner,
  errors: string[],
  shouldIgnore: (directoryPath: string) => boolean
): Promise<MetadataComponent[]> {
  const directories = await findDirectories(packagePath, scanner.pattern);
  const components = await Promise.all(
    directories
      .filter((directoryPath) => !shouldIgnore(directoryPath))
      .map(async (directoryPath) => {
        try {
          return createComponent({
            name: path.basename(directoryPath),
            type: scanner.type,
            filePath: directoryPath,
            dependencies: scanner.parseDependencies
              ? await scanner.parseDependencies(directoryPath)
              : new Set<string>(),
          });
        } catch (error) {
          const errorMessage = buildScannerError(scanner.type, directoryPath, error);
          logger.warn(errorMessage);
          errors.push(errorMessage);
          return undefined;
        }
      })
  );

  return components.filter(isDefined);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function createComponent(options: {
  name: string;
  type: MetadataType;
  filePath: string;
  dependencies: Set<string>;
  dependencyDetails?: MetadataDependencyReference[];
}): MetadataComponent {
  return {
    name: options.name,
    type: options.type,
    filePath: options.filePath,
    dependencies: options.dependencies,
    dependencyDetails: options.dependencyDetails,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseEmbeddedServiceConfigDependencies(filePath: string): Promise<ParsedDependencies> {
  const parsed = parseMetadataXml(await fs.readFile(filePath, 'utf-8'));
  const dependencies = new Set<string>();
  addXmlTextDependencies(dependencies, parsed, 'brandingSet', 'BrandingSet');
  addXmlTextDependencies(dependencies, parsed, 'site', 'CustomSite');
  addXmlTextDependencies(dependencies, parsed, 'aiAuthoringBundle', 'AiAuthoringBundle');
  addXmlTextDependencies(dependencies, parsed, 'agent', 'AiAuthoringBundle');
  return { dependencies };
}

async function parseNetworkDependencies(filePath: string): Promise<ParsedDependencies> {
  const parsed = parseMetadataXml(await fs.readFile(filePath, 'utf-8'));
  const dependencies = new Set<string>();
  addXmlTextDependencies(dependencies, parsed, 'site', 'CustomSite');
  return { dependencies };
}

async function parseDataPackageKitObjectDependencies(filePath: string): Promise<ParsedDependencies> {
  const parsed = parseMetadataXml(await fs.readFile(filePath, 'utf-8'));
  const parentNames = collectXmlValues(parsed, 'parentDataPackageKitDefinitionName');
  const dependencyDetails = [...new Set(parentNames)].map((parentName) => ({
    nodeId: `DataPackageKitDefinition:${parentName}`,
    kind: 'hard' as const,
    source: 'parser' as const,
    reason: 'DataPackageKitObject parentDataPackageKitDefinitionName identifies its parent Data Kit.',
  }));

  return {
    dependencies: new Set(dependencyDetails.map((dependency) => dependency.nodeId)),
    dependencyDetails,
  };
}

async function parseDigitalExperienceBundleDependencies(directoryPath: string): Promise<Set<string>> {
  const dependencies = new Set<string>();
  const files = await findFiles(directoryPath, '**/*.{json,xml}');

  const contents = await Promise.all(files.map((filePath) => fs.readFile(filePath, 'utf-8')));
  for (const content of contents) {
    collectTextReferences(dependencies, content, 'site', 'CustomSite');
    collectTextReferences(dependencies, content, 'network', 'Network');
  }

  return dependencies;
}

function parseMetadataXml(content: string): ParsedXml {
  return parseXml<ParsedXml>(content);
}

function addXmlTextDependencies(
  dependencies: Set<string>,
  parsed: ParsedXml,
  key: string,
  metadataType: MetadataType
): void {
  for (const value of collectXmlValues(parsed, key)) {
    dependencies.add(`${metadataType}:${value}`);
  }
}

function collectXmlValues(value: unknown, key: string): string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectXmlValues(item, key));
  }

  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    const nestedValues = collectXmlValues(entryValue, key);
    if (entryKey !== key) {
      return nestedValues;
    }

    return [...extractTextValues(entryValue), ...nestedValues];
  });
}

function extractTextValues(value: unknown): string[] {
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractTextValues);
  }

  const textValue = (value as { '#text'?: unknown })['#text'];
  return typeof textValue === 'string' && textValue.length > 0 ? [textValue] : [];
}

function collectTextReferences(
  dependencies: Set<string>,
  content: string,
  propertyName: string,
  metadataType: MetadataType
): void {
  const quotedProperty = new RegExp(`"${propertyName}"\\s*:\\s*"([^"]+)"`, 'gu');
  const xmlElement = new RegExp(`<${propertyName}>([^<]+)</${propertyName}>`, 'gu');

  for (const match of content.matchAll(quotedProperty)) {
    dependencies.add(`${metadataType}:${match[1]}`);
  }

  for (const match of content.matchAll(xmlElement)) {
    dependencies.add(`${metadataType}:${match[1]}`);
  }
}
