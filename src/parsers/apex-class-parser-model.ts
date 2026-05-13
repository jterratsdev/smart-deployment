import type { ApexClassMetadata } from '../types/salesforce/apex.js';

/**
 * Apex class dependency types
 */
import type { DynamicQueryReference } from './dynamic-query-reference.js';

export type ApexDependencyType =
  | 'extends'
  | 'implements'
  | 'static_method'
  | 'instantiation'
  | 'variable_declaration'
  | 'inner_class'
  | 'dynamic_instantiation';

/**
 * Represents a dependency found in an Apex class
 */
export type ApexDependency = {
  type: ApexDependencyType;
  className: string;
  lineNumber?: number;
  isStandard: boolean;
  isManagedPackage: boolean;
  namespace?: string;
};

/**
 * Result of parsing an Apex class
 * Optionally includes metadata from .cls-meta.xml
 */
export type ApexParseResult = {
  className: string;
  namespace?: string;
  extends?: string;
  implements: string[];
  dependencies: ApexDependency[];
  dynamicQueryReferences: DynamicQueryReference[];
  innerClasses: string[];
  metadata?: ApexClassMetadata;
};

export type ApexLexicalContext = {
  filePath: string;
  className: string;
  originalCode: string;
  cleanCode: string;
};

export type ApexLexicalPreparation = Pick<ApexLexicalContext, 'originalCode' | 'cleanCode'>;

export type ApexSymbolExtraction = {
  namespace?: string;
  extendsClass?: string;
  implementsList: string[];
  innerClasses: string[];
};

export type ApexTestMetadata = {
  isTestClass: boolean;
  usesIsTestAnnotation: boolean;
  usesTestMethodKeyword: boolean;
};

export type ApexReferenceDependencyExtraction = {
  staticMethodCalls: ApexDependency[];
  instantiations: ApexDependency[];
  variableDeclarations: ApexDependency[];
  dynamicInstantiations: ApexDependency[];
};

export type ApexDependencyBuckets = {
  signatureDependencies: ApexDependency[];
  referenceDependencies: ApexReferenceDependencyExtraction;
};
