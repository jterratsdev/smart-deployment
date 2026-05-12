import { expect } from 'chai';
import { describe, it } from 'mocha';
import { assembleWaveMetadata, calculateWaveStats } from '../../../src/waves/wave-metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('wave metadata policy', () => {
  it('assembles metadata from wave components', () => {
    const metadata = assembleWaveMetadata(['ApexClass:Service', 'Flow:Signup'], false);

    expect(metadata.componentCount).to.equal(2);
    expect(metadata.types).to.have.members(['ApexClass', 'Flow']);
    expect(metadata.hasCircularDeps).to.equal(false);
    expect(metadata.estimatedTime).to.equal(1);
  });

  it('calculates wave stats without depending on WaveBuilder', () => {
    const waves: Wave[] = [
      {
        number: 1,
        components: ['ApexClass:A', 'ApexClass:B'],
        metadata: assembleWaveMetadata(['ApexClass:A', 'ApexClass:B'], false),
      },
      {
        number: 2,
        components: ['Flow:C'],
        metadata: assembleWaveMetadata(['Flow:C'], false),
      },
    ];

    expect(calculateWaveStats(waves)).to.deep.include({
      totalWaves: 2,
      avgComponentsPerWave: 2,
      largestWaveSize: 2,
      smallestWaveSize: 1,
    });
  });
});
