import type { FieldType } from '../types/salesforce/object/field.js';

export type FieldSnapshot = {
  objectName: string;
  fieldName: string;
  type: FieldType;
  formula?: string;
  valueSetName?: string;
};

export type FieldConsumer = {
  type: 'ApexClass' | 'ApexTrigger' | 'Flow' | 'ValidationRule' | 'Territory2Rule' | 'Other';
  name: string;
  reference: string;
};

export type FieldMigrationAssessment = {
  field: string;
  transition: 'none' | 'type' | 'formula' | 'value-set' | 'multiple' | 'unverified';
  status: 'no-migration' | 'manual-review-required' | 'blocked';
  consumers: FieldConsumer[];
  blockers: string[];
  phases: string[];
};

function classifyTransition(source: FieldSnapshot, target?: FieldSnapshot): FieldMigrationAssessment['transition'] {
  if (!target) return 'unverified';
  const changes = [
    source.type !== target.type ? 'type' : undefined,
    (source.formula ?? '') !== (target.formula ?? '') ? 'formula' : undefined,
    source.valueSetName !== target.valueSetName ? 'value-set' : undefined,
  ].filter((change): change is 'type' | 'formula' | 'value-set' => change !== undefined);
  return changes.length > 1 ? 'multiple' : changes[0] ?? 'none';
}

/** Assess an explicitly supplied target observation; never infer that an absent field is safe to delete. */
export function assessFieldMigration(options: {
  source: FieldSnapshot;
  target?: FieldSnapshot;
  consumers: readonly FieldConsumer[];
  isConsumerInventoryComplete: boolean;
}): FieldMigrationAssessment {
  const { source, target } = options;
  const field = `${source.objectName}.${source.fieldName}`;
  if (target && (target.objectName !== source.objectName || target.fieldName !== source.fieldName)) {
    throw new Error('Source and target field identities must match');
  }

  const transition = classifyTransition(source, target);
  const consumers = [...options.consumers].sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.name.localeCompare(right.name) ||
      left.reference.localeCompare(right.reference)
  );
  const blockers = [
    ...(!target ? ['Target field metadata has not been observed in the org.'] : []),
    ...(!options.isConsumerInventoryComplete
      ? ['Consumer inventory is incomplete, including org-only references.']
      : []),
    ...(transition !== 'none' && consumers.length > 0
      ? ['Referenced consumers require an individually reviewed migration or removal.']
      : []),
  ];

  return {
    field,
    transition,
    status: blockers.length > 0 ? 'blocked' : transition === 'none' ? 'no-migration' : 'manual-review-required',
    consumers,
    blockers,
    phases:
      transition === 'none'
        ? []
        : [
            'Review the exact field and consumer diff, approve data backup and migration policy.',
            'Deploy and validate individually reviewed consumer changes; verify org references are gone.',
            'If deletion is approved, run and verify a separate pre-destructive deployment.',
            'Deploy the new field and prerequisites, then validate and restore compatible consumers.',
          ],
  };
}
