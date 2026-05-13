import type { CustomField, RecordType, ValidationRule } from '../types/salesforce/object.js';
import type { CustomObjectDependency } from './custom-object-parser.js';
import {
  extractApexReferences,
  extractCustomFieldReferences,
  resolveFormulaReferences,
} from './custom-object-reference-helpers.js';

export function buildDependencies(
  fields: CustomField[],
  validationRules: ValidationRule[],
  recordTypes: RecordType[]
): CustomObjectDependency[] {
  return [
    ...extractFieldDependencies(fields),
    ...extractValidationRuleDependencies(validationRules, fields),
    ...extractRecordTypeDependencies(recordTypes),
  ];
}

function extractFieldDependencies(fields: CustomField[]): CustomObjectDependency[] {
  const dependencies: CustomObjectDependency[] = [];

  for (const field of fields) {
    dependencies.push(...extractRelationshipFieldDependencies(field));
    dependencies.push(...extractFormulaFieldDependencies(field, fields));
    dependencies.push(...extractSummaryFieldDependencies(field));
  }

  return dependencies;
}

function extractRelationshipFieldDependencies(field: CustomField): CustomObjectDependency[] {
  if (!field.referenceTo || (field.type !== 'Lookup' && field.type !== 'MasterDetail')) {
    return [];
  }

  return field.referenceTo.map((referencedObject) => ({
    type: field.type === 'MasterDetail' ? 'master_detail_field' : 'lookup_field',
    name: field.fullName,
    referencedObject,
    fieldName: field.fullName,
  }));
}

function extractFormulaFieldDependencies(field: CustomField, fields: CustomField[]): CustomObjectDependency[] {
  if (!field.formula) {
    return [];
  }

  return [
    ...resolveFormulaReferences(field.formula, fields).map((referencedObject) => ({
      type: 'formula_field' as const,
      name: field.fullName,
      referencedObject,
      fieldName: field.fullName,
    })),
    ...extractApexReferences(field.formula).map((apexClass) => ({
      type: 'apex_class' as const,
      name: apexClass,
      fieldName: field.fullName,
    })),
    ...extractCustomFieldReferences(field.formula, fields, field.fullName).map((customFieldRef) => ({
      type: 'custom_field' as const,
      name: customFieldRef,
      fieldName: customFieldRef,
    })),
  ];
}

function extractSummaryFieldDependencies(field: CustomField): CustomObjectDependency[] {
  if (field.type !== 'Summary') {
    return [];
  }

  const dependencies: CustomObjectDependency[] = [];
  if (field.summaryForeignKey) {
    dependencies.push({
      type: 'custom_field',
      name: field.summaryForeignKey,
      fieldName: field.summaryForeignKey,
    });
  }

  if (field.summarizedField) {
    dependencies.push({
      type: 'custom_field',
      name: field.summarizedField,
      fieldName: field.summarizedField,
    });
  }

  return dependencies;
}

function extractValidationRuleDependencies(
  validationRules: ValidationRule[],
  fields: CustomField[]
): CustomObjectDependency[] {
  return validationRules.flatMap((rule) => extractValidationRuleDependency(rule, fields));
}

function extractValidationRuleDependency(rule: ValidationRule, fields: CustomField[]): CustomObjectDependency[] {
  if (!rule.errorConditionFormula) {
    return [];
  }

  return [
    ...resolveFormulaReferences(rule.errorConditionFormula, fields).map((referencedObject) => ({
      type: 'validation_rule' as const,
      name: rule.fullName,
      referencedObject,
    })),
    ...extractApexReferences(rule.errorConditionFormula).map((apexClass) => ({
      type: 'apex_class' as const,
      name: apexClass,
    })),
    ...extractCustomFieldReferences(rule.errorConditionFormula, fields).map((customFieldRef) => ({
      type: 'custom_field' as const,
      name: customFieldRef,
      fieldName: customFieldRef,
    })),
  ];
}

function extractRecordTypeDependencies(recordTypes: RecordType[]): CustomObjectDependency[] {
  return recordTypes.map((recordType) => ({
    type: 'record_type',
    name: recordType.fullName,
  }));
}
