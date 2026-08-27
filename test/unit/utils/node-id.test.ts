import { expect } from 'chai';
import { describe, it } from 'mocha';
import { createNodeId, normalizeNodeId, parseNodeId } from '../../../src/utils/node-id.js';

describe('NodeId utilities', () => {
  it('creates a canonical identifier and trims its parts', () => {
    expect(createNodeId(' ApexClass ', ' MyClass ')).to.equal('ApexClass:MyClass');
  });

  it('rejects empty types and names', () => {
    expect(() => createNodeId('', 'MyClass')).to.throw(TypeError);
    expect(() => createNodeId('ApexClass', '  ')).to.throw(TypeError);
  });

  it('parses names containing colons', () => {
    expect(parseNodeId('LightningComponentBundle:c:SiteHeader')).to.deep.equal({
      type: 'LightningComponentBundle',
      name: 'c:SiteHeader',
    });
  });

  it('rejects malformed identifiers', () => {
    expect(parseNodeId('ApexClass')).to.equal(undefined);
    expect(parseNodeId(':MyClass')).to.equal(undefined);
    expect(parseNodeId('ApexClass:')).to.equal(undefined);
    expect(parseNodeId('  :  ')).to.equal(undefined);
  });

  it('normalizes valid identifiers and preserves embedded colons', () => {
    expect(normalizeNodeId(' ApexClass : MyClass ')).to.equal('ApexClass:MyClass');
    expect(normalizeNodeId(' LightningComponentBundle : c:SiteHeader ')).to.equal(
      'LightningComponentBundle:c:SiteHeader'
    );
    expect(normalizeNodeId('invalid')).to.equal(undefined);
  });
});
