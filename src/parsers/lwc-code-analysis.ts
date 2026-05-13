export type LwcCodeAnalysis = {
  cleanCode: string;
  isTypeScript: boolean;
  apexImports: string[];
  lwcImports: string[];
  wireAdapters: string[];
  apiProperties: string[];
  navigationRefs: string[];
};

type LwcImportExtraction = {
  apexImports: string[];
  lwcImports: string[];
};

type LwcDecoratorExtraction = {
  wireAdapters: string[];
  apiProperties: string[];
  navigationRefs: string[];
};

export function analyzeComponentCode(jsCode: string): LwcCodeAnalysis {
  const context = createCodeAnalysisContext(jsCode);
  const imports = extractImports(context.cleanCode);
  const decorators = extractDecoratorsAndProperties(context.cleanCode);

  return {
    ...context,
    ...imports,
    ...decorators,
  };
}

function createCodeAnalysisContext(jsCode: string): Pick<LwcCodeAnalysis, 'cleanCode' | 'isTypeScript'> {
  const cleanCode = removeComments(jsCode);
  return {
    cleanCode,
    isTypeScript: isTypeScriptComponent(cleanCode),
  };
}

function extractImports(code: string): LwcImportExtraction {
  return {
    apexImports: extractApexImports(code),
    lwcImports: extractLWCImports(code),
  };
}

function extractDecoratorsAndProperties(code: string): LwcDecoratorExtraction {
  return {
    wireAdapters: extractWireAdapters(code),
    apiProperties: extractApiProperties(code),
    navigationRefs: extractNavigationRefs(code),
  };
}

function removeComments(code: string): string {
  let result = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringDelimiter: "'" | '"' | '`' | null = null;
  let escapeNext = false;

  for (let index = 0; index < code.length; index++) {
    const current = code[index];
    const next = code[index + 1];

    if (inSingleLineComment) {
      if (current === '\n') {
        inSingleLineComment = false;
        result += current;
      }

      continue;
    }

    if (inMultiLineComment) {
      if (current === '*' && next === '/') {
        inMultiLineComment = false;
        index += 1;
      } else if (current === '\n') {
        result += '\n';
      }

      continue;
    }

    if (stringDelimiter) {
      result += current;

      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === stringDelimiter) {
        stringDelimiter = null;
      }

      continue;
    }

    if (current === '"' || current === "'" || current === '`') {
      stringDelimiter = current;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      inSingleLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inMultiLineComment = true;
      index += 1;
      continue;
    }

    result += current;
  }

  return result;
}

function extractApexImports(code: string): string[] {
  const apexImportPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]@salesforce\/apex\/([a-zA-Z][a-zA-Z0-9_.]+)['"]/g;
  const matches = code.matchAll(apexImportPattern);
  const imports: string[] = [];

  for (const match of matches) {
    const apexRef = match[1];
    if (!imports.includes(apexRef)) {
      imports.push(apexRef);
    }
  }

  return imports;
}

function extractLWCImports(code: string): string[] {
  const lwcImportPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]c\/([a-zA-Z][a-zA-Z0-9_]+)['"]/g;
  const matches = code.matchAll(lwcImportPattern);
  const imports: string[] = [];

  for (const match of matches) {
    const componentName = match[1];
    if (!imports.includes(componentName)) {
      imports.push(componentName);
    }
  }

  return imports;
}

function extractWireAdapters(code: string): string[] {
  const wirePattern = /@wire\s*\(\s*([a-zA-Z][a-zA-Z0-9_]*)/g;
  const matches = code.matchAll(wirePattern);
  const adapters: string[] = [];

  for (const match of matches) {
    const adapterName = match[1];
    if (!adapters.includes(adapterName)) {
      adapters.push(adapterName);
    }
  }

  return adapters;
}

function extractApiProperties(code: string): string[] {
  const apiPattern = /@api\s+(?:(?:get|set)\s+)?([a-zA-Z][a-zA-Z0-9_]*)/g;
  const matches = code.matchAll(apiPattern);
  const properties: string[] = [];

  for (const match of matches) {
    const propertyName = match[1];
    if (!properties.includes(propertyName)) {
      properties.push(propertyName);
    }
  }

  return properties;
}

function extractNavigationRefs(code: string): string[] {
  const refs: string[] = [];

  if (code.includes('NavigationMixin')) {
    refs.push('NavigationMixin');
  }

  if (code.includes('NavigationMixin.Navigate')) {
    refs.push('NavigationMixin.Navigate');
  }

  const navImportPattern = /import\s+\{[^}]*NavigationMixin[^}]*\}\s+from\s+['"]lightning\/navigation['"]/;
  if (navImportPattern.test(code)) {
    refs.push('lightning/navigation');
  }

  return refs;
}

function isTypeScriptComponent(jsCode: string): boolean {
  const tsPatterns = [
    /:\s*(?:string|number|boolean|any|void|unknown|never)\s*[=;,)]/,
    /interface\s+[A-Z][a-zA-Z0-9_]*\s*\{/,
    /type\s+[A-Z][a-zA-Z0-9_]*\s*=/,
    /<[A-Z][a-zA-Z0-9_<>,\s]*>/,
    /as\s+(?:string|number|boolean|const)/,
  ];

  return tsPatterns.some((pattern) => pattern.test(jsCode));
}
