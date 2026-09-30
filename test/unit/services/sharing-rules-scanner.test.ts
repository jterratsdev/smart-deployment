import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  addLocalSharingPrincipalDependencies,
  parseSharingRulesComponent,
} from '../../../src/services/scanners/security-metadata-scanner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('parseSharingRulesComponent', () => {
  let directory: string | undefined;
  afterEach(async () => directory && rm(directory, { recursive: true, force: true }));

  it('adds hard object and custom field dependencies while preserving principals as facts', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'sharing-rules-'));
    const filePath = path.join(directory, 'Case.sharingRules-meta.xml');
    await writeFile(
      filePath,
      '<SharingRules><sharingCriteriaRules><criteriaItems><field>Priority__c</field></criteriaItems><sharedTo><role>Support</role></sharedTo></sharingCriteriaRules><sharingOwnerRules><sharedTo><roleAndSubordinates>Support</roleAndSubordinates></sharedTo></sharingOwnerRules></SharingRules>'
    );

    const component = await parseSharingRulesComponent(filePath);
    expect([...component.dependencies]).to.deep.equal(['CustomObject:Case', 'CustomField:Case.Priority__c']);
    expect(component.facts).to.deep.include({ kind: 'sharing-rules', objectName: 'Case' });
    if (component.facts?.kind === 'sharing-rules') {
      expect(component.facts.principals).to.deep.include({ type: 'Role', name: 'Support' });
    }
    expect([...component.dependencies]).not.to.include('RoleAndSubordinates:Support');
  });

  it('promotes only locally discovered deployable principals to hard dependencies', () => {
    const sharingRules: MetadataComponent = {
      name: 'Case',
      type: 'SharingRules',
      filePath: 'Case.sharingRules-meta.xml',
      dependencies: new Set(['CustomObject:Case']),
      dependents: new Set(),
      priorityBoost: 0,
      facts: {
        kind: 'sharing-rules',
        objectName: 'Case',
        criteriaFields: [],
        principals: [
          { type: 'Queue', name: 'CaseQueue' },
          { type: 'Role', name: 'OrgOnlyRole' },
          { type: 'RoleAndSubordinates', name: 'Support' },
        ],
      },
    };
    const queue: MetadataComponent = {
      name: 'CaseQueue',
      type: 'Queue',
      filePath: 'CaseQueue.queue-meta.xml',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };
    const [enriched] = addLocalSharingPrincipalDependencies([sharingRules, queue]);
    expect([...enriched.dependencies]).to.deep.equal(['CustomObject:Case', 'Queue:CaseQueue']);
  });

  it('maps territory facts only to a real local Territory2 component', () => {
    const sharingRules: MetadataComponent = {
      name: 'Case',
      type: 'SharingRules',
      filePath: 'Case.sharingRules-meta.xml',
      dependencies: new Set(['CustomObject:Case']),
      dependents: new Set(),
      priorityBoost: 0,
      facts: {
        kind: 'sharing-rules',
        objectName: 'Case',
        criteriaFields: [],
        principals: [
          { type: 'Territory2', name: 'West' },
          { type: 'Territory2AndSubordinates', name: 'East' },
        ],
      },
    };
    const east: MetadataComponent = {
      name: 'East',
      type: 'Territory2',
      filePath: 'East.territory2-meta.xml',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };
    const [enriched] = addLocalSharingPrincipalDependencies([sharingRules, east]);
    expect([...enriched.dependencies]).to.deep.equal(['CustomObject:Case', 'Territory2:East']);
    expect([...enriched.dependencies]).not.to.include('Territory2:West');
  });
});
