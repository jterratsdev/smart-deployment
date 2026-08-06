import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildEdgeTypesByFrom,
  compareWavePriority,
  extractMetadataType,
} from '../../../src/waves/wave-priority-policy.js';
import type { DependencyEdge } from '../../../src/types/dependency.js';

describe('wave priority policy', () => {
  it('orders by Salesforce metadata type before node name', () => {
    const edgeTypesByFrom = buildEdgeTypesByFrom([]);

    expect(compareWavePriority(edgeTypesByFrom, 'CustomObject:Account', 'ApexClass:Service')).to.be.lessThan(0);
    expect(extractMetadataType('ApexClass:Service')).to.equal('ApexClass');
  });

  it('uses dependency risk as tie-breaker inside the same metadata type', () => {
    const edges: DependencyEdge[] = [
      {
        from: 'ApexClass:HardFirst',
        to: 'ApexClass:Dependency',
        type: 'hard',
        source: 'parser',
      },
      {
        from: 'ApexClass:SoftLater',
        to: 'ApexClass:Dependency',
        type: 'soft',
        source: 'parser',
      },
    ];
    const edgeTypesByFrom = buildEdgeTypesByFrom(edges);

    expect(compareWavePriority(edgeTypesByFrom, 'ApexClass:HardFirst', 'ApexClass:SoftLater')).to.be.lessThan(0);
  });

  it('uses the canonical deployment order for Data Cloud metadata', () => {
    const edgeTypesByFrom = buildEdgeTypesByFrom([]);

    expect(
      compareWavePriority(edgeTypesByFrom, 'DataSourceObject:Knowledge_Home', 'DataPackageKitDefinition:Store_Kit')
    ).to.be.lessThan(0);
    expect(
      compareWavePriority(edgeTypesByFrom, 'DataPackageKitDefinition:Store_Kit', 'DataPackageKitObject:Store_Kit_123')
    ).to.be.lessThan(0);
  });
});
