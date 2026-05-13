import type { LayoutMetadata, LayoutSection } from '../types/salesforce/layout.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

export type LayoutSectionAnalysis = {
  layoutSections: LayoutSection[];
  relatedLists: NonNullable<LayoutMetadata['relatedLists']>;
  relatedObjects: string[];
};

export function analyzeLayoutSections(metadata: LayoutMetadata): LayoutSectionAnalysis {
  return {
    layoutSections: normalizeArray(metadata.layoutSections),
    relatedLists: normalizeArray(metadata.relatedLists),
    relatedObjects: uniqueDefinedStrings(normalizeArray(metadata.relatedObjects)),
  };
}
