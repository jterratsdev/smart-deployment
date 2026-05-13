import type { LayoutParseResult } from './layout-parser.js';
import type { LayoutActionAnalysis } from './layout-action-analysis.js';
import type { LayoutReferenceAnalysis } from './layout-reference-analysis.js';
import type { LayoutSectionAnalysis } from './layout-section-analysis.js';
import { uniqueDefinedStrings } from './parser-utils.js';

export function assembleLayoutResult(
  layoutName: string,
  objectName: string,
  sectionAnalysis: LayoutSectionAnalysis,
  actionAnalysis: LayoutActionAnalysis,
  referenceAnalysis: LayoutReferenceAnalysis
): LayoutParseResult {
  const relatedListNames = uniqueDefinedStrings(sectionAnalysis.relatedLists.map((list) => list.relatedList));

  return {
    name: layoutName,
    object: objectName,
    customButtons: actionAnalysis.customButtons,
    visualforcePages: referenceAnalysis.visualforcePages,
    fields: referenceAnalysis.fields,
    relatedLists: [...new Set(relatedListNames)],
    quickActions: actionAnalysis.quickActions,
    canvasApps: referenceAnalysis.canvasApps,
    customLinks: referenceAnalysis.customLinks,
    relatedObjects: sectionAnalysis.relatedObjects,
    dependencies: {
      object: objectName,
      customButtons: actionAnalysis.customButtons,
      visualforcePages: referenceAnalysis.visualforcePages,
      fields: referenceAnalysis.fields,
      relatedLists: relatedListNames,
      quickActions: actionAnalysis.quickActions,
      canvasApps: referenceAnalysis.canvasApps,
      customLinks: referenceAnalysis.customLinks,
      relatedObjects: sectionAnalysis.relatedObjects,
    },
    optionalDependencies: {
      customButtons: actionAnalysis.customButtons,
      visualforcePages: referenceAnalysis.visualforcePages,
      quickActions: actionAnalysis.quickActions,
      canvasApps: referenceAnalysis.canvasApps,
      customLinks: referenceAnalysis.customLinks,
    },
  };
}
