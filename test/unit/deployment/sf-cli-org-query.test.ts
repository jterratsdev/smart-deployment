import { expect } from 'chai';
import { describe, it } from 'mocha';
import { SfCliOrgQuery } from '../../../src/deployment/sf-cli-org-query.js';

describe('SfCliOrgQuery', () => {
  it('uses the Tooling API and returns sanitized EntityDefinition models', async () => {
    let args: string[] = [];
    const adapter = new SfCliOrgQuery(async (_file, received) => {
      args = received;
      return {
        stdout: JSON.stringify({
          status: 0,
          result: { records: [{ InternalSharingModel: 'Private', ExternalSharingModel: 'Read' }] },
        }),
      };
    });
    expect(await adapter.getEntitySharingModels('org', 'Case')).to.deep.equal({
      kind: 'observed',
      observation: { internalSharingModel: 'Private', externalSharingModel: 'Read' },
    });
    expect(args).to.include('--use-tooling-api');
  });

  it('classifies authentication failures without treating them as mismatches', async () => {
    const adapter = new SfCliOrgQuery(async () => {
      throw new Error('Invalid auth token');
    });
    expect(await adapter.getEntitySharingModels('org', 'Case')).to.deep.equal({
      kind: 'unavailable',
      error: { category: 'authentication', message: 'EntityDefinition authentication unavailable' },
    });
  });

  it('classifies structured non-zero CLI output when execFile rejects', async () => {
    const adapter = new SfCliOrgQuery(async () => {
      const error = new Error('Command failed') as Error & { stdout?: string };
      error.stdout = JSON.stringify({ status: 1, name: 'NamedOrgNotFoundError', message: 'No authorization found' });
      throw error;
    });
    expect(await adapter.getEntitySharingModels('org', 'Case')).to.deep.equal({
      kind: 'unavailable',
      error: { category: 'authentication', message: 'EntityDefinition authentication unavailable' },
    });
  });

  it('rejects invalid QualifiedApiName values before invoking sf', async () => {
    let invoked = false;
    const adapter = new SfCliOrgQuery(async () => {
      invoked = true;
      return { stdout: '{}' };
    });
    expect(await adapter.getEntitySharingModels('org', "Case' OR Name != '")).to.deep.equal({
      kind: 'unavailable',
      error: { category: 'query', message: 'EntityDefinition QualifiedApiName is invalid' },
    });
    expect(invoked).to.equal(false);
  });

  it('distinguishes a missing entity from an ambiguous response', async () => {
    const missing = new SfCliOrgQuery(async () => ({ stdout: JSON.stringify({ status: 0, result: { records: [] } }) }));
    expect(await missing.getEntitySharingModels('org', 'Missing__c')).to.deep.equal({
      kind: 'unavailable',
      error: { category: 'entity-not-found', message: 'EntityDefinition record was not found' },
    });

    const ambiguous = new SfCliOrgQuery(async () => ({
      stdout: JSON.stringify({ status: 0, result: { records: [{}, {}] } }),
    }));
    expect(await ambiguous.getEntitySharingModels('org', 'Case')).to.deep.equal({
      kind: 'unavailable',
      error: { category: 'invalid-response', message: 'EntityDefinition response was ambiguous' },
    });
  });
});
