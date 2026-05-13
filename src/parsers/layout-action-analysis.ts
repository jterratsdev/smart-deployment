import type { LayoutMetadata } from '../types/salesforce/layout.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

export type LayoutActionAnalysis = {
  customButtons: string[];
  quickActions: string[];
};

export function analyzeLayoutActions(metadata: LayoutMetadata): LayoutActionAnalysis {
  return {
    customButtons: extractCustomButtons(metadata),
    quickActions: extractQuickActions(metadata),
  };
}

function extractCustomButtons(metadata: LayoutMetadata): string[] {
  const layoutCustomButtons = normalizeArray(metadata.customButtons);
  const relatedListCustomButtons: string[] = [];
  const platformActionCustomButtons: string[] = [];

  const relatedLists = normalizeArray(metadata.relatedLists);
  for (const relatedList of relatedLists) {
    relatedListCustomButtons.push(...normalizeArray(relatedList.customButtons));
  }

  const actionItems = normalizeArray(metadata.platformActionList?.platformActionListItems);
  for (const item of actionItems) {
    if (item.actionType === 'CustomButton') {
      platformActionCustomButtons.push(item.actionName);
    }
  }

  return uniqueDefinedStrings([...layoutCustomButtons, ...relatedListCustomButtons, ...platformActionCustomButtons]);
}

function extractQuickActions(metadata: LayoutMetadata): string[] {
  const quickActions: string[] = [];

  const quickActionItems = normalizeArray(metadata.quickActionList?.quickActionListItems);
  quickActions.push(...quickActionItems.map((item) => item.quickActionName));

  const actionItems = normalizeArray(metadata.platformActionList?.platformActionListItems);
  for (const item of actionItems) {
    if (item.actionType === 'QuickAction') {
      quickActions.push(item.actionName);
    }
  }

  return uniqueDefinedStrings(quickActions);
}
