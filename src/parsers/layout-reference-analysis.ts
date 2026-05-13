import type { FeedLayout, LayoutItem, LayoutMetadata, LayoutSection } from '../types/salesforce/layout.js';
import type { LayoutSectionAnalysis } from './layout-section-analysis.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

export type LayoutReferenceAnalysis = {
  fields: string[];
  visualforcePages: string[];
  canvasApps: string[];
  customLinks: string[];
};

export function analyzeLayoutReferences(
  metadata: LayoutMetadata,
  sectionAnalysis: LayoutSectionAnalysis
): LayoutReferenceAnalysis {
  const sectionItems = collectSectionItems(sectionAnalysis.layoutSections);
  const relatedContentItems = normalizeArray(metadata.relatedContent?.relatedContentItems).map(
    (item) => item.layoutItem
  );

  return {
    fields: extractFields(metadata, sectionItems, relatedContentItems),
    visualforcePages: extractVisualforcePages(metadata, sectionItems, relatedContentItems),
    canvasApps: extractCanvasApps(metadata, sectionItems, relatedContentItems),
    customLinks: extractCustomLinks(metadata, sectionItems, relatedContentItems),
  };
}

function collectSectionItems(sections: LayoutSection[]): LayoutItem[] {
  const items: LayoutItem[] = [];

  for (const section of sections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      items.push(...normalizeArray(column.layoutItems));
    }
  }

  return items;
}

function extractFields(
  metadata: LayoutMetadata,
  sectionItems: LayoutItem[],
  relatedContentItems: LayoutItem[]
): string[] {
  const fields = sectionItems.map((item) => item.field);

  const relatedLists = normalizeArray(metadata.relatedLists);
  for (const relatedList of relatedLists) {
    fields.push(...normalizeArray(relatedList.fields));
  }

  fields.push(...normalizeArray(metadata.miniLayout?.fields));

  const summaryItems = normalizeArray(metadata.summaryLayout?.summaryLayoutItems);
  for (const item of summaryItems) {
    fields.push(item.field);
  }

  fields.push(...normalizeArray(metadata.multilineLayoutFields));
  fields.push(...relatedContentItems.map((item) => item.field));

  return uniqueDefinedStrings(fields);
}

function extractVisualforcePages(
  metadata: LayoutMetadata,
  sectionItems: LayoutItem[],
  relatedContentItems: LayoutItem[]
): string[] {
  return uniqueDefinedStrings([
    ...sectionItems.map((item) => item.page),
    ...extractFeedLayoutPages(metadata.feedLayout, 'Visualforce'),
    ...relatedContentItems.map((item) => item.page),
  ]);
}

function extractCanvasApps(
  metadata: LayoutMetadata,
  sectionItems: LayoutItem[],
  relatedContentItems: LayoutItem[]
): string[] {
  return uniqueDefinedStrings([
    ...sectionItems.map((item) => item.canvas),
    ...extractFeedLayoutPages(metadata.feedLayout, 'Canvas'),
    ...relatedContentItems.map((item) => item.canvas),
  ]);
}

function extractCustomLinks(
  metadata: LayoutMetadata,
  sectionItems: LayoutItem[],
  relatedContentItems: LayoutItem[]
): string[] {
  const links = [...sectionItems.map((item) => item.customLink)];

  const summaryItems = normalizeArray(metadata.summaryLayout?.summaryLayoutItems);
  for (const item of summaryItems) {
    links.push(item.customLink);
  }

  const actionItems = normalizeArray(metadata.platformActionList?.platformActionListItems);
  for (const item of actionItems) {
    if (item.actionType === 'ActionLink') {
      links.push(item.actionName);
    }
  }

  links.push(...relatedContentItems.map((item) => item.customLink));

  return uniqueDefinedStrings(links);
}

function extractFeedLayoutPages(feedLayout: FeedLayout | undefined, componentType: 'Visualforce' | 'Canvas'): string[] {
  const components = [...normalizeArray(feedLayout?.leftComponents), ...normalizeArray(feedLayout?.rightComponents)];

  return uniqueDefinedStrings(
    components.filter((component) => component.componentType === componentType).map((component) => component.page)
  );
}
