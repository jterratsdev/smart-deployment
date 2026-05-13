/**
 * Layout Parser
 * Parses Salesforce Page Layout metadata files (.layout-meta.xml)
 *
 * @ac AC-1: Extract related object (from filename)
 * @ac AC-2: Extract custom button references
 * @ac AC-3: Extract Visualforce page references
 * @ac AC-4: Extract field references
 * @ac AC-5: Extract related list references
 * @ac AC-6: Link to dependent metadata
 *
 * @issue #21
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { LayoutMetadata } from '../types/salesforce/layout.js';
import { analyzeLayoutActions } from './layout-action-analysis.js';
import { analyzeLayoutReferences } from './layout-reference-analysis.js';
import { assembleLayoutResult } from './layout-result-assembly.js';
import { analyzeLayoutSections } from './layout-section-analysis.js';

/**
 * Result of parsing a Layout file
 */
export type LayoutParseResult = {
  /** Name of the layout (from filename, e.g., 'Account-Account Layout') */
  name: string;
  /** Related object name (e.g., 'Account') */
  object: string;
  /** Custom buttons referenced in the layout */
  customButtons: string[];
  /** Visualforce pages referenced in the layout */
  visualforcePages: string[];
  /** Fields displayed in the layout */
  fields: string[];
  /** Related lists included in the layout */
  relatedLists: string[];
  /** Quick actions included in the layout */
  quickActions: string[];
  /** Canvas apps referenced in the layout */
  canvasApps: string[];
  /** Custom links referenced in the layout */
  customLinks: string[];
  /** Related objects referenced directly in the layout metadata */
  relatedObjects: string[];
  /** All dependencies extracted from this layout */
  dependencies: {
    object: string;
    customButtons: string[];
    visualforcePages: string[];
    fields: string[];
    relatedLists: string[];
    quickActions: string[];
    canvasApps: string[];
    customLinks: string[];
    relatedObjects: string[];
  };
  /** Soft dependencies that may not block deploy ordering */
  optionalDependencies: {
    customButtons: string[];
    visualforcePages: string[];
    quickActions: string[];
    canvasApps: string[];
    customLinks: string[];
  };
};

/**
 * Extract object name from layout filename
 * Examples:
 * 'Account-Account Layout' -> 'Account'
 * 'CustomObject__c-Custom Layout' -> 'CustomObject__c'
 */
function extractObjectFromLayoutName(layoutName: string): string {
  const parts = layoutName.split('-');
  return parts[0] || layoutName;
}

function parseLayoutMetadata(filePath: string, xmlContent: string): LayoutMetadata {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch (error) {
    throw new Error(
      `Failed to parse Layout XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const root = parsed as { Layout?: LayoutMetadata };
  if (!root.Layout) {
    throw new Error(`Invalid Layout XML structure at ${filePath}: missing Layout root element`);
  }

  return root.Layout;
}

/**
 * Parse a Layout metadata XML file
 *
 * @param filePath - Path to the .layout-meta.xml file
 * @param layoutName - Name of the layout (typically from filename without extension)
 * @returns Parsed layout metadata with dependencies
 *
 * @example
 * const result = await parseLayout(
 *   'force-app/main/default/layouts/Account-Account Layout.layout-meta.xml',
 *   'Account-Account Layout'
 * );
 * console.log(result.object); // 'Account'
 * console.log(result.customButtons); // ['New_Custom_Button', 'Edit_Button']
 * console.log(result.dependencies.visualforcePages); // ['AccountDashboard']
 */
export async function parseLayout(filePath: string, layoutName: string): Promise<LayoutParseResult> {
  const xmlContent = await readFile(filePath, 'utf-8');
  const metadata = parseLayoutMetadata(filePath, xmlContent);
  const objectName = extractObjectFromLayoutName(layoutName);
  const sectionAnalysis = analyzeLayoutSections(metadata);
  const actionAnalysis = analyzeLayoutActions(metadata);
  const referenceAnalysis = analyzeLayoutReferences(metadata, sectionAnalysis);

  return assembleLayoutResult(layoutName, objectName, sectionAnalysis, actionAnalysis, referenceAnalysis);
}
