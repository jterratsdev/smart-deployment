import { expect } from 'chai';
import { describe, it } from 'mocha';
import { planObjectFlexipageOperations } from '../../../src/deployment/object-flexipage-operation-plan.js';

const source = `<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
<label>Tour</label><actionOverrides><actionName>View</actionName><content>Tour_Page</content><formFactor>Large</formFactor><type>Flexipage</type></actionOverrides>
</CustomObject>`;
const pageSource =
  '<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata"><sobjectType>Tour__c</sobjectType><type>RecordPage</type></FlexiPage>';

describe('planObjectFlexipageOperations', () => {
  it('represents the foundation, page and activation barriers without authorizing execution', () => {
    const plan = planObjectFlexipageOperations({
      objectName: 'Tour__c',
      source,
      pages: ['Tour_Page'],
      pageSources: new Map([['Tour_Page', pageSource]]),
      observation: { object: 'absent', pages: new Map([['Tour_Page', 'absent']]) },
    });
    expect(plan.ready).to.equal(false);
    expect(plan.operations.map((operation) => [operation.id, operation.nodeId, operation.after])).to.deep.equal([
      ['foundation:CustomObject:Tour__c', 'CustomObject:Tour__c', []],
      ['page:FlexiPage:Tour_Page', 'FlexiPage:Tour_Page', ['foundation:CustomObject:Tour__c']],
      ['activation:CustomObject:Tour__c', 'CustomObject:Tour__c', ['page:FlexiPage:Tour_Page']],
    ]);
    expect(plan.operations[0].sourceHash).to.equal(plan.foundationHash);
    expect(plan.operations[2].sourceHash).to.equal(plan.sourceHash);
    expect(plan.operations[1].sourceHash).not.to.equal(plan.sourceHash);
    const changedPage = planObjectFlexipageOperations({
      objectName: 'Tour__c',
      source,
      pages: ['Tour_Page'],
      pageSources: new Map([['Tour_Page', pageSource.replace('<type>', '<masterLabel>Updated</masterLabel><type>')]]),
      observation: { object: 'absent', pages: new Map([['Tour_Page', 'absent']]) },
    });
    expect(changedPage.fingerprint).not.to.equal(plan.fingerprint);
  });

  it('blocks existing objects and missing target observations', () => {
    const existing = planObjectFlexipageOperations({
      objectName: 'Tour__c',
      source,
      pages: ['Tour_Page'],
      pageSources: new Map([['Tour_Page', pageSource]]),
      observation: { object: 'present', pages: new Map([['Tour_Page', 'present']]) },
    });
    expect(existing.reason).to.include('Existing object');
    const unknown = planObjectFlexipageOperations({
      objectName: 'Tour__c',
      source,
      pages: ['Tour_Page'],
      pageSources: new Map([['Tour_Page', pageSource]]),
      observation: { object: 'unknown', pages: new Map() },
    });
    expect(unknown.ready).to.equal(false);
    expect(unknown.reason).to.include('unknown');
    expect(() =>
      planObjectFlexipageOperations({
        objectName: 'Tour__c',
        source,
        pages: ['Tour_Page'],
        pageSources: new Map(),
        observation: { object: 'absent', pages: new Map() },
      })
    ).to.throw('Missing FlexiPage source');
    expect(() =>
      planObjectFlexipageOperations({
        objectName: 'Tour__c',
        source,
        pages: ['Tour_Page'],
        pageSources: new Map([['Tour_Page', '<FlexiPage/>']]),
        observation: { object: 'absent', pages: new Map() },
      })
    ).to.throw('root or namespace');
    expect(() =>
      planObjectFlexipageOperations({
        objectName: 'Tour__c',
        source,
        pages: ['Tour_Page'],
        pageSources: new Map([['Tour_Page', pageSource.replace('Tour__c', 'Other__c')]]),
        observation: { object: 'absent', pages: new Map() },
      })
    ).to.throw('not a record page for Tour__c');
  });

  it('requires all pages before the single activation operation', () => {
    const secondSource = source
      .replace('Tour_Page', 'Other_Page')
      .replace('<formFactor>Large</formFactor>', '<formFactor>Small</formFactor>');
    const both = source.replace(
      '</CustomObject>',
      `${secondSource.match(/<actionOverrides>.*<\/actionOverrides>/)?.[0]}</CustomObject>`
    );
    const plan = planObjectFlexipageOperations({
      objectName: 'Tour__c',
      source: both,
      pages: ['Other_Page', 'Tour_Page'],
      pageSources: new Map([
        ['Tour_Page', pageSource],
        ['Other_Page', pageSource],
      ]),
      observation: {
        object: 'absent',
        pages: new Map([
          ['Tour_Page', 'absent'],
          ['Other_Page', 'absent'],
        ]),
      },
    });
    expect(plan.operations.map((operation) => operation.id)).to.deep.equal([
      'foundation:CustomObject:Tour__c',
      'page:FlexiPage:Other_Page',
      'page:FlexiPage:Tour_Page',
      'activation:CustomObject:Tour__c',
    ]);
    expect(plan.operations.at(-1)?.after).to.deep.equal(['page:FlexiPage:Other_Page', 'page:FlexiPage:Tour_Page']);
  });
});
