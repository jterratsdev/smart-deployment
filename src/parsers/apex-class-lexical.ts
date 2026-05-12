import { ParsingError } from '../errors/parsing-error.js';
import type { ApexLexicalContext, ApexLexicalPreparation, ApexTestMetadata } from './apex-class-parser-model.js';

const TEST_ANNOTATION_PATTERN = /(?:^|\W)@isTest\b/i;
const TEST_METHOD_PATTERN = /\btestMethod\b/i;

/**
 * Remove comments from Apex code
 *
 * @ac US-013-AC-9: Remove comments before parsing
 */
function removeComments(code: string): string {
  let result = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringDelimiter: "'" | '"' | null = null;
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

    if (current === '"' || current === "'") {
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

function extractClassNameFromFilePath(filePath: string): string {
  const classNameMatch = filePath.match(/([a-zA-Z][a-zA-Z0-9_]*)\.cls$/);
  if (!classNameMatch) {
    throw new ParsingError(`Invalid Apex class file name: ${filePath}`, {
      filePath,
      suggestion: 'Apex class files must end with .cls',
    });
  }

  return classNameMatch[1];
}

function prepareLexicalSource(content: string): ApexLexicalPreparation {
  return {
    originalCode: content,
    cleanCode: removeComments(content),
  };
}

export function createLexicalContext(filePath: string, content: string): ApexLexicalContext {
  const className = extractClassNameFromFilePath(filePath);
  const lexicalPreparation = prepareLexicalSource(content);

  return {
    filePath,
    className,
    ...lexicalPreparation,
  };
}

export function detectTestMetadata(context: ApexLexicalContext): ApexTestMetadata {
  const usesIsTestAnnotation = TEST_ANNOTATION_PATTERN.test(context.originalCode);
  const usesTestMethodKeyword = TEST_METHOD_PATTERN.test(context.cleanCode);

  return {
    isTestClass: usesIsTestAnnotation || usesTestMethodKeyword,
    usesIsTestAnnotation,
    usesTestMethodKeyword,
  };
}
