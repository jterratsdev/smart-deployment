/**
 * Metadata Scanner Service
 * Orchestrates project scanning, parsing, and dependency analysis
 *
 * Integrates:
 * - SfdxProjectDetector
 * - ForceIgnoreParser
 * - Metadata parsers (all types)
 * - DependencyGraphBuilder
 */

import { getLogger } from '../utils/logger.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import { parseApexClass } from '../parsers/apex-class-parser.js';
import { parseApexTrigger } from '../parsers/apex-trigger-parser.js';
import { parseLWC } from '../parsers/lwc-parser.js';
import { parseAura } from '../parsers/aura-parser.js';
import { parseFlow } from '../parsers/flow-parser.js';
import { parseCustomObject } from '../parsers/custom-object-parser.js';
import { parseCustomMetadataRecord } from '../parsers/custom-metadata-parser.js';
import { parseEmailTemplate } from '../parsers/email-template-parser.js';
import { parseFlexiPage } from '../parsers/flexipage-parser.js';
import { parseLayout } from '../parsers/layout-parser.js';
import { parseProfile } from '../parsers/profile-parser.js';
import { parsePermissionSet } from '../parsers/permission-set-parser.js';
import { parseBot } from '../parsers/bot-parser.js';
import { parseGenAiPrompt } from '../parsers/genai-prompt-parser.js';
import { parseVisualforce } from '../parsers/visualforce-parser.js';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob as globAsync } from 'glob';
import type { MetadataComponent } from '../types/metadata.js';
import type { DependencyAnalysisResult } from '../types/dependency.js';

const logger = getLogger('MetadataScannerService');

export interface ScanOptions {
  sourcePath?: string;
  includeIgnored?: boolean;
  maxDepth?: number;
}

export interface ScanResult {
  components: MetadataComponent[];
  dependencyResult: DependencyAnalysisResult;
  projectRoot: string;
  executionTime: number;
  errors: string[];
  warnings: string[];
}

/**
 * Metadata file pattern matcher
 * TODO: Use when implementing pattern-based metadata detection
 */
// interface MetadataPattern {
//   type: MetadataType;
//   patterns: string[];
//   isContainer?: boolean; // For LWC, Aura, CustomObject bundles
//   parser?: (filePath: string, content: string, metadataXml?: string) => Promise<MetadataComponent> | MetadataComponent;
// }

/**
 * Metadata Scanner Service
 * Scans project, parses metadata, and builds dependency graph
 */
export class MetadataScannerService {
  private forceIgnoreParser?: ForceIgnoreParser;

  /**
   * Scan project and analyze dependencies
   */
  public async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Detect project
    const sourcePath = options.sourcePath || process.cwd();
    const projectInfo = await SfdxProjectDetector.detect(sourcePath);

    if (!projectInfo.detected) {
      throw new Error(`SFDX project not found in ${sourcePath}`);
    }

    logger.info('Project detected', {
      root: projectInfo.projectRoot,
      packageDirs: projectInfo.packageDirectories.length,
    });

    // Parse .forceignore
    const forceIgnorePath = path.join(projectInfo.projectRoot, '.forceignore');
    if (await this.fileExists(forceIgnorePath)) {
      this.forceIgnoreParser = new ForceIgnoreParser();
      const loadResult = await this.forceIgnoreParser.load(projectInfo.projectRoot);
      logger.info('Loaded .forceignore', {
        rules: loadResult.totalRules,
      });
    }

    // Scan and parse metadata
    // If includeIgnored is true, temporarily disable forceignore checking
    const originalShouldIgnore = this.shouldIgnore.bind(this);
    if (options.includeIgnored) {
      this.shouldIgnore = () => false; // Don't ignore anything
    }

    const components = await this.scanMetadata(
      projectInfo.projectRoot,
      projectInfo.packageDirectories,
      errors,
      warnings
    );

    // Restore original shouldIgnore
    if (options.includeIgnored) {
      this.shouldIgnore = originalShouldIgnore;
    }

    // Build dependency graph
    const graphBuilder = new DependencyGraphBuilder();
    for (const component of components) {
      graphBuilder.addComponent(component);
    }
    const dependencyResult = graphBuilder.build();

    const executionTime = Date.now() - startTime;

    logger.info('Scan complete', {
      components: components.length,
      dependencies: dependencyResult.stats.totalDependencies,
      executionTime,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      components,
      dependencyResult,
      projectRoot: projectInfo.projectRoot,
      executionTime,
      errors,
      warnings,
    };
  }

  /**
   * Scan metadata files from package directories
   */
  private async scanMetadata(
    projectRoot: string,
    packageDirs: string[],
    errors: string[],
    warnings: string[]
  ): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    for (const packageDir of packageDirs) {
      // packageDirs from SfdxProjectDetector are already absolute paths
      // Check if it's already absolute, otherwise join with projectRoot
      const packagePath = path.isAbsolute(packageDir) ? packageDir : path.join(projectRoot, packageDir);

      if (!(await this.fileExists(packagePath))) {
        logger.warn('Package directory not found', { packagePath });
        warnings.push(`Package directory not found: ${packagePath}`);
        continue;
      }

      // Scan all metadata types
      const scanned = await this.scanPackageDirectory(packagePath, errors, warnings);
      components.push(...scanned);
    }

    return components;
  }

  /**
   * Scan a package directory for all metadata types
   */
  private async scanPackageDirectory(
    packagePath: string,
    errors: string[],
    warnings: string[]
  ): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    // Scan Apex Classes
    const apexFiles = await this.findFiles(packagePath, '**/classes/**/*.cls');
    for (const filePath of apexFiles) {
      if (this.shouldIgnore(filePath)) continue;
      if (filePath.endsWith('.cls-meta.xml')) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseApexClass(filePath, content);

        // Process dependencies - convert Visualforce Page references to proper format
        const deps = new Set<string>();
        for (const dep of parsed.dependencies) {
          if (dep.type === 'visualforce_page') {
            // Visualforce Page reference: Page.PageName -> VisualforcePage:PageName
            // Skip if the page name matches the current class name (avoid self-loops)
            if (dep.className !== parsed.className) {
              deps.add(`VisualforcePage:${dep.className}`);
            }
          } else if (dep.type === 'custom_label') {
            // Custom Label reference: Label.LabelName -> CustomLabels:LabelName
            // Note: Custom Labels are stored in a single file, but we track individual label dependencies
            deps.add(`CustomLabels:${dep.className}`);
          } else {
            // Apex Class reference: ClassName -> ApexClass:ClassName
            // Skip if it's a self-reference (same class name)
            if (dep.className !== parsed.className) {
              deps.add(`ApexClass:${dep.className}`);
            }
          }
        }

        components.push({
          name: parsed.className,
          type: 'ApexClass',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Apex class ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Apex Triggers
    const triggerFiles = await this.findFiles(packagePath, '**/triggers/**/*.trigger');
    for (const filePath of triggerFiles) {
      if (this.shouldIgnore(filePath)) continue;
      if (filePath.endsWith('.trigger-meta.xml')) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseApexTrigger(filePath, content);

        components.push({
          name: parsed.triggerName,
          type: 'ApexTrigger',
          filePath,
          dependencies: new Set<string>(parsed.dependencies.map((d) => d.className)),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Apex trigger ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan LWC Components (container-based)
    const lwcDirs = await this.findDirectories(packagePath, '**/lwc/*');
    for (const lwcDir of lwcDirs) {
      if (this.shouldIgnore(lwcDir)) continue;

      const componentName = path.basename(lwcDir);
      const jsFile = path.join(lwcDir, `${componentName}.js`);
      const tsFile = path.join(lwcDir, `${componentName}.ts`);
      const metaFile = path.join(lwcDir, `${componentName}.js-meta.xml`);

      const codeFile = (await this.fileExists(jsFile)) ? jsFile : (await this.fileExists(tsFile)) ? tsFile : null;
      if (!codeFile) continue;

      try {
        const jsContent = await fs.readFile(codeFile, 'utf-8');
        const metaContent = (await this.fileExists(metaFile)) ? await fs.readFile(metaFile, 'utf-8') : undefined;
        const parsed = parseLWC(componentName, jsContent, metaContent);

        components.push({
          name: componentName,
          type: 'LightningComponentBundle',
          filePath: codeFile,
          dependencies: new Set<string>([...parsed.apexImports, ...parsed.lwcImports.map((imp) => `c:${imp}`)]),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse LWC ${componentName}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Aura Components (container-based)
    const auraDirs = await this.findDirectories(packagePath, '**/aura/*');
    for (const auraDir of auraDirs) {
      if (this.shouldIgnore(auraDir)) continue;

      const componentName = path.basename(auraDir);
      const cmpFile = path.join(auraDir, `${componentName}.cmp`);
      if (!(await this.fileExists(cmpFile))) continue;

      try {
        const cmpContent = await fs.readFile(cmpFile, 'utf-8');
        const parsed = parseAura(componentName, cmpContent);

        const deps = new Set<string>();
        if (parsed.apexController) deps.add(parsed.apexController);
        if (parsed.extendsComponent) deps.add(parsed.extendsComponent);
        parsed.implementsInterfaces.forEach((i) => deps.add(i));
        parsed.childComponents.forEach((c) => deps.add(`c:${c}`));

        components.push({
          name: componentName,
          type: 'AuraDefinitionBundle',
          filePath: cmpFile,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Aura component ${componentName}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Flows
    const flowFiles = await this.findFiles(packagePath, '**/flows/**/*.flow-meta.xml');
    for (const filePath of flowFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseFlow(filePath, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'apex_action') {
            deps.add(`ApexClass:${d.name}`);
          } else if (d.type === 'subflow') {
            deps.add(`Flow:${d.name}`);
          } else if (d.type === 'genai_prompt') {
            deps.add(`GenAiPromptTemplate:${d.name}`);
          } else if (d.type === 'visualforce_page') {
            deps.add(`VisualforcePage:${d.name}`);
          }
        });

        components.push({
          name: parsed.flowName,
          type: 'Flow',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Flow ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Objects
    // All files ending in .object-meta.xml should be CustomObject (including __mdt types)
    const objectDirs = await this.findDirectories(packagePath, '**/objects/*');
    for (const objectDir of objectDirs) {
      if (this.shouldIgnore(objectDir)) continue;

      const objectName = path.basename(objectDir);
      const objectFile = path.join(objectDir, `${objectName}.object-meta.xml`);
      if (!(await this.fileExists(objectFile))) continue;

      // Verify it's actually an .object-meta.xml file (not .md-meta.xml)
      if (!objectFile.endsWith('.object-meta.xml')) {
        continue; // Skip if not .object-meta.xml
      }

      try {
        const content = await fs.readFile(objectFile, 'utf-8');
        const parsed = await parseCustomObject(objectName, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'lookup_field' || d.type === 'master_detail_field') {
            deps.add(d.referencedObject || '');
          }
        });

        // Add FlexiPage dependencies from action overrides
        if (parsed.actionOverrides) {
          for (const override of parsed.actionOverrides) {
            if (override.type === 'Flexipage' && override.content) {
              deps.add(`FlexiPage:${override.content}`);
            }
          }
        }

        // All .object-meta.xml files are CustomObject (including __mdt types)
        components.push({
          name: objectName,
          type: 'CustomObject',
          filePath: objectFile,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Custom Object ${objectName}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Metadata Types and Records
    // First, scan for Custom Metadata Type definitions (in objects/*__mdt/)
    const cmtObjectDirs = await this.findDirectories(packagePath, '**/objects/*__mdt');
    const cmtTypeNames = new Set<string>();

    for (const cmtDir of cmtObjectDirs) {
      if (this.shouldIgnore(cmtDir)) continue;

      const typeName = path.basename(cmtDir);
      const typeFile = path.join(cmtDir, `${typeName}.object-meta.xml`);
      if (!(await this.fileExists(typeFile))) continue;

      try {
        await parseCustomObject(typeFile, typeName);

        components.push({
          name: typeName,
          type: 'CustomObject',
          filePath: typeFile,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });

        cmtTypeNames.add(typeName);
      } catch (error) {
        const errorMsg = `Failed to parse Custom Metadata Type ${typeName}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Also scan for Custom Metadata Types in customMetadata/ directories (legacy structure)
    // Only process .md-meta.xml files here (records), not .object-meta.xml (those are handled above)
    // Skip this section entirely - types should be in objects/ with .object-meta.xml
    // Files in customMetadata/ with .md-meta.xml are records, not types
    // Types are already processed above from objects/*__mdt/ directories

    // Scan Custom Metadata Records (files in customMetadata/ directory)
    // Format: TypeName.RecordName.md-meta.xml
    const cmtRecordFiles = await this.findFiles(packagePath, '**/customMetadata/*.md-meta.xml');
    const cmtRecordsByType = new Map<string, Array<{ recordName: string; filePath: string }>>();

    for (const recordFile of cmtRecordFiles) {
      if (this.shouldIgnore(recordFile)) continue;

      const fileName = path.basename(recordFile, '.md-meta.xml');
      // Format: TypeName.RecordName
      const dotIndex = fileName.indexOf('.');
      if (dotIndex === -1) continue; // Skip if not in expected format

      let typeName = fileName.substring(0, dotIndex);
      const recordName = fileName.substring(dotIndex + 1);

      // Check if type name needs __mdt suffix (records may use type name without __mdt)
      let actualTypeName = typeName;
      if (!cmtTypeNames.has(typeName)) {
        // Try with __mdt suffix
        const typeNameWithMdt = `${typeName}__mdt`;
        if (cmtTypeNames.has(typeNameWithMdt)) {
          actualTypeName = typeNameWithMdt;
        } else {
          // If still not found, assume the type exists (it may be in objects/ but not scanned yet)
          // Add it to the set so records can be processed
          logger.debug(`Inferring Custom Metadata Type ${typeName} from record ${fileName}`);
          cmtTypeNames.add(typeName);
        }
      }

      // Use the actual type name (with or without __mdt) for grouping records
      if (!cmtRecordsByType.has(actualTypeName)) {
        cmtRecordsByType.set(actualTypeName, []);
      }

      cmtRecordsByType.get(actualTypeName)!.push({ recordName, filePath: recordFile });

      if (!cmtRecordsByType.has(typeName)) {
        cmtRecordsByType.set(typeName, []);
      }

      cmtRecordsByType.get(typeName)!.push({ recordName, filePath: recordFile });
    }

    // Create CustomMetadataRecord components for each record
    for (const [typeName, records] of cmtRecordsByType.entries()) {
      for (const { recordName, filePath } of records) {
        // For records, use the type name as it appears in the file (without __mdt if that's how it's stored)
        // But ensure dependency points to the correct type name
        const recordFileName = path.basename(filePath, '.md-meta.xml');
        const dotIndex = recordFileName.indexOf('.');
        const typeNameFromFile = dotIndex !== -1 ? recordFileName.substring(0, dotIndex) : typeName;
        const fullRecordName = `${typeNameFromFile}.${recordName}`;

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          await parseCustomMetadataRecord(fullRecordName, content);

          components.push({
            name: fullRecordName,
            type: 'CustomMetadataRecord',
            filePath,
            dependencies: new Set<string>([`CustomObject:${typeName}`]),
            dependents: new Set<string>(),
            priorityBoost: 0,
          });
        } catch (error) {
          const errorMsg = `Failed to parse Custom Metadata Record ${fullRecordName}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          logger.warn(errorMsg);
          warnings.push(errorMsg);
        }
      }
    }

    // Scan Profiles
    const profileFiles = await this.findFiles(packagePath, '**/profiles/**/*.profile-meta.xml');
    for (const filePath of profileFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const profileName = path.basename(filePath, '.profile-meta.xml');
        const parsed = await parseProfile(filePath, profileName);

        const deps = new Set<string>();
        parsed.objectPermissions.forEach((op: string) => deps.add(op));
        parsed.apexClassAccesses.forEach((ac: string) => deps.add(ac));
        parsed.layoutAssignments.forEach((pl: string) => deps.add(pl));

        components.push({
          name: profileName,
          type: 'Profile',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Profile ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Permission Sets
    const permSetFiles = await this.findFiles(packagePath, '**/permissionsets/**/*.permissionset-meta.xml');
    for (const filePath of permSetFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const permSetName = path.basename(filePath, '.permissionset-meta.xml');
        const parsed = await parsePermissionSet(filePath, permSetName);

        const deps = new Set<string>();
        parsed.objectPermissions.forEach((op: string) => deps.add(op));
        parsed.apexClassAccesses.forEach((ac: string) => deps.add(ac));
        parsed.customPermissions.forEach((cp: string) => deps.add(cp));
        // Add application dependencies (CustomApplication/LightningApp)
        parsed.applicationVisibilities.forEach((app: string) => deps.add(`LightningApp:${app}`));
        // Add flow dependencies
        parsed.flowAccesses.forEach((flow: string) => deps.add(`Flow:${flow}`));

        components.push({
          name: permSetName,
          type: 'PermissionSet',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Permission Set ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Applications (Lightning Apps)
    const appFiles = await this.findFiles(packagePath, '**/applications/**/*.app-meta.xml');
    logger.debug('Scanning Custom Applications', { packagePath, foundFiles: appFiles.length });
    for (const filePath of appFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const appName = path.basename(filePath, '.app-meta.xml');
        logger.debug('Found Custom Application', { appName, filePath });

        // Parse app metadata to extract dependencies (utilityBar, tabs, etc.)
        const deps = new Set<string>();
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const xmlParser = new XMLParser();
          const parsed = xmlParser.parse(content);

          // Extract utilityBar reference (FlexiPage)
          if (parsed.CustomApplication?.utilityBar) {
            const utilityBar = parsed.CustomApplication.utilityBar;
            if (typeof utilityBar === 'string' && utilityBar.trim()) {
              deps.add(`FlexiPage:${utilityBar}`);
            }
          }

          // Extract FlexiPage dependencies from actionOverrides
          const actionOverrides = parsed.CustomApplication?.actionOverrides;
          if (actionOverrides) {
            const overrides = Array.isArray(actionOverrides) ? actionOverrides : [actionOverrides];
            for (const override of overrides) {
              if (override.type === 'Flexipage' && override.content) {
                const flexiPageName = typeof override.content === 'string' ? override.content : override.content;
                if (flexiPageName && flexiPageName.trim()) {
                  deps.add(`FlexiPage:${flexiPageName}`);
                }
              }
            }
          }

          // Extract FlexiPage dependencies from profileActionOverrides
          const profileActionOverrides = parsed.CustomApplication?.profileActionOverrides;
          if (profileActionOverrides) {
            const overrides = Array.isArray(profileActionOverrides) ? profileActionOverrides : [profileActionOverrides];
            for (const override of overrides) {
              if (override.type === 'Flexipage' && override.content) {
                const flexiPageName = typeof override.content === 'string' ? override.content : override.content;
                if (flexiPageName && flexiPageName.trim()) {
                  deps.add(`FlexiPage:${flexiPageName}`);
                }
              }
            }
          }

          // Extract tab references if needed
          // Tabs are typically standard, but custom tabs could be dependencies
        } catch (parseError) {
          logger.debug('Could not parse Custom Application dependencies', {
            appName,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          });
        }

        components.push({
          name: appName,
          type: 'LightningApp',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Custom Application ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan FlexiPages
    const flexipageFiles = await this.findFiles(packagePath, '**/flexipages/**/*.flexipage-meta.xml');
    for (const filePath of flexipageFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const flexipageName = path.basename(filePath, '.flexipage-meta.xml');
        const parsed = await parseFlexiPage(filePath, flexipageName);

        const deps = new Set<string>();
        parsed.lwcComponents.forEach((c) => deps.add(`c:${c}`));
        parsed.auraComponents.forEach((c) => deps.add(`c:${c}`));
        parsed.objects.forEach((o) => deps.add(o));

        components.push({
          name: flexipageName,
          type: 'FlexiPage',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse FlexiPage ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Layouts
    const layoutFiles = await this.findFiles(packagePath, '**/layouts/**/*.layout-meta.xml');
    for (const filePath of layoutFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const layoutName = path.basename(filePath, '.layout-meta.xml');
        const parsed = await parseLayout(filePath, layoutName);

        const deps = new Set<string>();
        deps.add(parsed.object);
        parsed.customButtons.forEach((b) => deps.add(b));
        parsed.visualforcePages.forEach((v) => deps.add(v));

        components.push({
          name: layoutName,
          type: 'Layout',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Layout ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Email Template Folders first (required for EmailTemplate deployment)
    // Email Template Folders: email/FolderName/FolderName.emailFolder-meta.xml
    // Special folder: unfiled$public doesn't have .emailFolder-meta.xml file
    const emailFolderFiles = await this.findFiles(packagePath, '**/email/**/*.emailFolder-meta.xml');
    const emailFolders = new Set<string>();

    // Process folders with metadata files
    for (const filePath of emailFolderFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        // Extract folder name from file path
        // Path format: .../email/FolderName.emailFolder-meta.xml (at email root)
        // or .../email/FolderName/FolderName.emailFolder-meta.xml (inside folder)
        const emailDir = path.dirname(filePath);
        const folderFileName = path.basename(filePath, '.emailFolder-meta.xml');
        const parentDir = path.basename(emailDir);

        // Determine folder name: if parent is "email", use filename; otherwise use parent dir
        const folderNameToUse = parentDir === 'email' ? folderFileName : parentDir;
        emailFolders.add(folderNameToUse);

        components.push({
          name: folderNameToUse,
          type: 'EmailTemplateFolder',
          filePath,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: -10, // Deploy folders before templates
        });
      } catch (error) {
        const errorMsg = `Failed to parse Email Template Folder ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Also scan for folder directories to detect unfiled$public and other folders without metadata files
    const emailBasePath = path.join(packagePath, 'email');
    if (await this.fileExists(emailBasePath)) {
      try {
        const emailDirs = await fs.readdir(emailBasePath, { withFileTypes: true });
        for (const dir of emailDirs) {
          if (dir.isDirectory()) {
            const folderName = dir.name;
            // Skip if already processed or if it's a standard folder name
            if (emailFolders.has(folderName)) continue;

            // Check if folder has email templates (if so, it needs to be included)
            const folderPath = path.join(emailBasePath, folderName);
            const templateFiles = await this.findFiles(folderPath, '*.email-meta.xml');
            if (templateFiles.length > 0) {
              // Folder exists and has templates, but no .emailFolder-meta.xml
              // Create a virtual component for it (unfiled$public is a special case)
              emailFolders.add(folderName);

              // For unfiled$public and folders without metadata files, create a virtual file path
              const virtualFilePath = path.join(emailBasePath, `${folderName}.emailFolder-meta.xml`);

              components.push({
                name: folderName,
                type: 'EmailTemplateFolder',
                filePath: virtualFilePath, // Virtual path for folders without metadata files
                dependencies: new Set<string>(),
                dependents: new Set<string>(),
                priorityBoost: -10, // Deploy folders before templates
              });
            }
          }
        }
      } catch (error) {
        logger.debug('Could not scan email directories', { error });
      }
    }

    // Scan Email Templates
    // Email Templates are stored in folders: email/FolderName/TemplateName.email-meta.xml
    // The component name must include the folder: FolderName/TemplateName
    const emailTemplateFiles = await this.findFiles(packagePath, '**/email/**/*.email-meta.xml');
    for (const filePath of emailTemplateFiles) {
      if (this.shouldIgnore(filePath)) continue;
      // Skip folder metadata files (already processed)
      if (filePath.endsWith('.emailFolder-meta.xml')) continue;

      try {
        // Extract folder name and template name
        // Path format: .../email/FolderName/TemplateName.email-meta.xml
        const emailDir = path.dirname(filePath);
        const folderName = path.basename(emailDir);
        const templateName = path.basename(filePath, '.email-meta.xml');

        // EmailTemplate name format: FolderName/TemplateName
        const fullTemplateName = `${folderName}/${templateName}`;

        // Track folder for dependency
        emailFolders.add(folderName);

        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = await parseEmailTemplate(templateName, content, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'visualforce_page') {
            deps.add(d.name);
          }
        });
        // Add folder as dependency
        deps.add(`EmailTemplateFolder:${folderName}`);

        components.push({
          name: fullTemplateName, // Use FolderName/TemplateName format
          type: 'EmailTemplate',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Email Template ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Bots
    const botFiles = await this.findFiles(packagePath, '**/bots/**/*.bot-meta.xml');
    for (const filePath of botFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const botName = path.basename(filePath, '.bot-meta.xml');
        const parsed = await parseBot(filePath, botName);

        const deps = new Set<string>();
        parsed.flows.forEach((f) => deps.add(f));
        parsed.apexActions.forEach((a) => deps.add(a));
        parsed.genAiPrompts.forEach((g) => deps.add(g));

        components.push({
          name: botName,
          type: 'Bot',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Bot ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan GenAI Prompts
    const genaiFiles = await this.findFiles(packagePath, '**/genaiPromptTemplates/**/*.genAiPromptTemplate-meta.xml');
    for (const filePath of genaiFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const promptName = path.basename(filePath, '.genAiPromptTemplate-meta.xml');
        const parsed = await parseGenAiPrompt(filePath, promptName);

        const deps = new Set<string>();
        // Add SObject dependencies
        parsed.sobjects.forEach((o: string) => deps.add(`CustomObject:${o}`));
        parsed.dependencies.sobjects.forEach((o: string) => deps.add(`CustomObject:${o}`));
        // Add Visualforce Page dependencies
        parsed.visualforcePages.forEach((page: string) => deps.add(`VisualforcePage:${page}`));
        parsed.dependencies.visualforcePages.forEach((page: string) => deps.add(`VisualforcePage:${page}`));

        components.push({
          name: promptName,
          type: 'GenAiPromptTemplate',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse GenAI Prompt ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Labels
    const labelFiles = await this.findFiles(packagePath, '**/labels/**/*.labels-meta.xml');
    for (const filePath of labelFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const labelFileName = path.basename(filePath, '.labels-meta.xml');
        // Custom Labels are typically in a single file (CustomLabels.labels-meta.xml)
        // Individual labels are not separate components, but the file itself is
        components.push({
          name: labelFileName,
          type: 'CustomLabels',
          filePath,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Custom Labels ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Visualforce Pages/Components
    const vfPageFiles = await this.findFiles(packagePath, '**/pages/**/*.page');
    const vfComponentFiles = await this.findFiles(packagePath, '**/components/**/*.component');
    for (const filePath of [...vfPageFiles, ...vfComponentFiles]) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        const parsed = parseVisualforce(fileName, content);

        const deps = new Set<string>();

        // Add Apex controller dependencies
        parsed.dependencies.forEach((d) => {
          if (d.type === 'apex_controller' || d.type === 'apex_extension') {
            deps.add(`ApexClass:${d.name}`);
          } else if (d.type === 'vf_page_template') {
            // Visualforce Page template dependency: template="TemplatePage" -> VisualforcePage:TemplatePage
            deps.add(`VisualforcePage:${d.name}`);
          } else if (d.type === 'vf_page_reference') {
            // Visualforce Page reference dependency: $Page.PageName -> VisualforcePage:PageName
            deps.add(`VisualforcePage:${d.name}`);
          } else if (d.type === 'static_resource') {
            // Static Resource dependency: $Resource.ResourceName -> StaticResource:ResourceName
            deps.add(`StaticResource:${d.name}`);
          }
        });

        // Add Visualforce Component dependencies (Apex Components)
        // These are components with explicit namespace (not c:)
        parsed.components.forEach((comp) => {
          // Format: namespace:ComponentName -> VisualforceComponent:ComponentName
          const componentName = comp.includes(':') ? comp.split(':')[1] : comp;
          deps.add(`VisualforceComponent:${componentName}`);
        });

        // Add LWC Component dependencies
        parsed.lwcComponents.forEach((lwc) => {
          deps.add(`LightningComponentBundle:${lwc}`);
        });

        // Add Aura Component dependencies
        parsed.auraComponents.forEach((aura) => {
          deps.add(`AuraDefinitionBundle:${aura}`);
        });

        // Handle custom components (<c:>) - check if they exist as LWC, Aura, or VF Component
        // For now, we'll add them as potential LWC (most common) and the dependency graph
        // will resolve them based on what actually exists in the project
        parsed.dependencies.forEach((d) => {
          if (d.type === 'lwc_component') {
            // Check if this is a custom component (<c:>) that might be LWC
            const lwcName = d.name;
            // Try LWC first (most common)
            deps.add(`LightningComponentBundle:${lwcName}`);
            // Also try as Aura (fallback)
            deps.add(`AuraDefinitionBundle:${lwcName}`);
            // And as VF Component (fallback)
            deps.add(`VisualforceComponent:${lwcName}`);
          } else if (d.type === 'aura_component') {
            deps.add(`AuraDefinitionBundle:${d.name}`);
          }
        });

        components.push({
          name: parsed.name,
          type: parsed.type === 'page' ? 'VisualforcePage' : 'VisualforceComponent',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Visualforce ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    return components;
  }

  /**
   * Find files matching a glob pattern
   */
  private async findFiles(rootPath: string, pattern: string): Promise<string[]> {
    const fullPattern = path.join(rootPath, pattern);
    const files = await globAsync(fullPattern, {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    return files;
  }

  /**
   * Find directories matching a glob pattern
   */
  private async findDirectories(rootPath: string, pattern: string): Promise<string[]> {
    const fullPattern = path.join(rootPath, pattern);
    const allMatches = await globAsync(fullPattern, {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    // Filter to only directories
    const dirs: string[] = [];
    for (const match of allMatches) {
      try {
        const stat = await fs.stat(match);
        if (stat.isDirectory()) {
          dirs.push(match);
        }
      } catch {
        // Skip if stat fails (file doesn't exist, etc.)
      }
    }
    return dirs;
  }

  /**
   * Check if file should be ignored by .forceignore
   */
  private shouldIgnore(filePath: string): boolean {
    if (!this.forceIgnoreParser) {
      return false;
    }
    return this.forceIgnoreParser.isIgnored(filePath);
  }

  /**
   * Check if file/directory exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
