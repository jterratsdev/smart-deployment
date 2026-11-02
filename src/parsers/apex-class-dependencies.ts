import type {
  ApexDependency,
  ApexDependencyBuckets,
  ApexLexicalContext,
  ApexReferenceDependencyExtraction,
  ApexSymbolExtraction,
} from './apex-class-parser-model.js';
import { buildDependency, isStandardClass } from './apex-class-names.js';

/**
 * Extract static method calls
 *
 * @ac US-013-AC-3: Extract static method calls
 */
function extractStaticMethodCalls(code: string): ApexDependency[] {
  const staticCallPattern = /([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*\.\s*[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
  const withoutStrings = code.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, (literal) => ' '.repeat(literal.length));
  const declaredVariables = new Set(
    [...withoutStrings.matchAll(/\b[A-Za-z][\w.]*(?:<[^;{}()]+>)?\s+([a-z]\w*)\s*(?=[=;,:)])/g)].map(
      (match) => match[1]
    )
  );
  const matches = withoutStrings.matchAll(staticCallPattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    if (seen.has(className) || isStandardClass(className) || declaredVariables.has(className.split('.')[0])) {
      continue;
    }

    seen.add(className);
    dependencies.push(buildDependency('static_method', className));
  }

  return dependencies;
}

/**
 * Extract object instantiations (new ClassName())
 *
 * @ac US-013-AC-4: Extract object instantiations
 */
function extractInstantiations(code: string): ApexDependency[] {
  const newPattern = /new\s+([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*(?:<[^>]+>)?\s*\(/g;
  const matches = code.matchAll(newPattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    if (seen.has(className) || isStandardClass(className) || className.endsWith('__c')) {
      continue;
    }

    seen.add(className);
    dependencies.push(buildDependency('instantiation', className));
  }

  return dependencies;
}

/**
 * Extract variable declarations
 *
 * @ac US-013-AC-5: Extract variable declarations
 */
function extractVariableDeclarations(code: string): ApexDependency[] {
  const varPattern = /(?:^|[;\s{])\s*([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s+[a-z][a-zA-Z0-9_]*\s*[=;]/gm;
  const matches = code.matchAll(varPattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    seen.add(className);
    dependencies.push(buildDependency('variable_declaration', className));
  }

  return dependencies;
}

/**
 * Extract Type.forName() dynamic instantiation
 *
 * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
 */
function extractDynamicInstantiations(code: string): ApexDependency[] {
  const typeForNamePattern = /Type\.forName\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"][\s)]/g;
  const matches = code.matchAll(typeForNamePattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    seen.add(className);
    dependencies.push(buildDependency('dynamic_instantiation', className));
  }

  return dependencies;
}

function extractSignatureDependencies(symbols: ApexSymbolExtraction): ApexDependency[] {
  const dependencies: ApexDependency[] = [];

  if (symbols.extendsClass && !isStandardClass(symbols.extendsClass)) {
    dependencies.push(buildDependency('extends', symbols.extendsClass));
  }

  for (const iface of symbols.implementsList) {
    if (!isStandardClass(iface)) {
      dependencies.push(buildDependency('implements', iface));
    }
  }

  return dependencies;
}

function extractReferenceDependencies(context: ApexLexicalContext): ApexReferenceDependencyExtraction {
  return {
    staticMethodCalls: extractStaticMethodCalls(context.cleanCode),
    instantiations: extractInstantiations(context.cleanCode),
    variableDeclarations: extractVariableDeclarations(context.cleanCode),
    dynamicInstantiations: extractDynamicInstantiations(context.cleanCode),
  };
}

export function flattenReferenceDependencies(
  referenceDependencies: ApexReferenceDependencyExtraction
): ApexDependency[] {
  return [
    ...referenceDependencies.staticMethodCalls,
    ...referenceDependencies.instantiations,
    ...referenceDependencies.variableDeclarations,
    ...referenceDependencies.dynamicInstantiations,
  ];
}

export function collectDependencyBuckets(
  context: ApexLexicalContext,
  symbols: ApexSymbolExtraction
): ApexDependencyBuckets {
  return {
    signatureDependencies: extractSignatureDependencies(symbols),
    referenceDependencies: extractReferenceDependencies(context),
  };
}

export function collectDependencies(
  dependencyBuckets: ApexDependencyBuckets,
  symbols: ApexSymbolExtraction
): ApexDependency[] {
  return [
    ...dependencyBuckets.signatureDependencies,
    ...flattenReferenceDependencies(dependencyBuckets.referenceDependencies),
  ].filter((dependency) => dependency.namespace !== undefined || !symbols.innerClasses.includes(dependency.className));
}
