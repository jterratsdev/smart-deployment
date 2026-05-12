import type { ApexDependency, ApexDependencyType } from './apex-class-parser-model.js';

/**
 * Standard Apex classes that should be ignored
 */
const STANDARD_APEX_CLASSES = new Set([
  'System',
  'String',
  'Integer',
  'Boolean',
  'Date',
  'Datetime',
  'Time',
  'Decimal',
  'Double',
  'Long',
  'Id',
  'Blob',
  'Object',
  'List',
  'Set',
  'Map',
  'SObject',
  'Database',
  'Schema',
  'Test',
  'Limits',
  'ApexPages',
  'PageReference',
  'Trigger',
  'UserInfo',
  'Math',
  'Messaging',
  'Http',
  'HttpRequest',
  'HttpResponse',
  'JsonParser',
  'JsonGenerator',
  'JSON',
  'Pattern',
  'Matcher',
  'Exception',
  'DmlException',
  'QueryException',
  'NullPointerException',
  'TypeException',
  'CalloutException',
  'LimitException',
]);

/**
 * Check if a class is a standard Apex class
 *
 * @ac US-013-AC-7: Ignore standard classes (System.*, etc.)
 */
export function isStandardClass(className: string): boolean {
  const cleanName = className.includes('.') ? className.split('.').pop()! : className;

  if (STANDARD_APEX_CLASSES.has(cleanName)) {
    return true;
  }

  if (
    cleanName.startsWith('System.') ||
    cleanName.startsWith('Database.') ||
    cleanName.startsWith('Schema.') ||
    cleanName.startsWith('Test.') ||
    cleanName.startsWith('ApexPages.')
  ) {
    return true;
  }

  return false;
}

/**
 * Extract namespace from a fully qualified class name
 *
 * @ac US-013-AC-8: Handle managed packages
 */
export function extractNamespace(className: string): {
  namespace?: string;
  cleanName: string;
  isManagedPackage: boolean;
} {
  const namespacePattern = /^([a-zA-Z][a-zA-Z0-9_]*(?:__|\.))(.+)$/;
  const match = className.match(namespacePattern);

  if (match) {
    const namespace = match[1].replace(/__|\.$/g, '');
    const cleanName = match[2];
    const isManagedPackage = match[1].includes('__');

    return { namespace, cleanName, isManagedPackage };
  }

  return { cleanName: className, isManagedPackage: false };
}

export function buildDependency(type: ApexDependencyType, className: string): ApexDependency {
  const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

  return {
    type,
    className: cleanName,
    namespace,
    isStandard: false,
    isManagedPackage,
  };
}
