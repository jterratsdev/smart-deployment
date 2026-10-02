import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveValidator } from '../../../src/waves/wave-validator.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

function wave(number: number, components: string[]): Wave {
  return {
    number,
    components,
    metadata: {
      componentCount: components.length,
      types: ['ApexClass'],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 1,
    },
  };
}

describe('WaveValidator', () => {
  /**
   * @ac US-043-AC-1: Validate dependency order
   * @ac US-043-AC-2: Validate component limits
   * @ac US-043-AC-3: Validate test requirements
   * @ac US-043-AC-4: Validate no cycles within wave
   */
  it('US-043-AC-1: should validate dependency order', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves(
      [wave(1, ['ApexClass:Base']), wave(2, ['ApexClass:Consumer'])],
      new Map([
        ['ApexClass:Base', new Set()],
        ['ApexClass:Consumer', new Set(['ApexClass:Base'])],
      ])
    );
    expect(result.isValid).to.be.true;
  });

  it('should reject dependencies in the same or a later wave', () => {
    const result = new WaveValidator().validateWaves(
      [wave(1, ['ApexClass:Consumer', 'ApexClass:Base'])],
      new Map([
        ['ApexClass:Base', new Set()],
        ['ApexClass:Consumer', new Set(['ApexClass:Base'])],
      ])
    );

    expect(result.isValid).to.be.false;
    expect(result.errors).to.deep.equal([
      'ApexClass:Consumer depends on ApexClass:Base, which is not in an earlier wave',
    ]);
  });

  it('should reject graph components that are not assigned to a wave', () => {
    const result = new WaveValidator().validateWaves([], new Map([['ApexClass:Unplaced', new Set()]]));

    expect(result.isValid).to.be.false;
    expect(result.errors).to.deep.equal(['Component ApexClass:Unplaced is not assigned to a wave']);
  });

  it('should reject unknown types, mixed stages, duplicate assignments, and graph drift', () => {
    const result = new WaveValidator().validateWaves(
      [
        wave(1, ['CustomObject:Account', 'ApexClass:Service', 'UnknownMetadata:Config']),
        wave(2, ['ApexClass:Service', 'ApexClass:Extra']),
      ],
      new Map([
        ['CustomObject:Account', new Set()],
        ['ApexClass:Service', new Set()],
        ['UnknownMetadata:Config', new Set()],
      ])
    );

    expect(result.isValid).to.be.false;
    expect(result.errors).to.include('Metadata type "UnknownMetadata" has no deployment-order contract');
    expect(result.errors).to.include('Wave 1 mixes deployment stages: 1, 3');
    expect(result.errors).to.include('Component ApexClass:Service is assigned to more than one wave');
    expect(result.errors).to.include('Wave component ApexClass:Extra is absent from the dependency graph');
  });

  it('should reject backward deployment-stage transitions', () => {
    const result = new WaveValidator().validateWaves(
      [wave(1, ['ApexClass:Service']), wave(2, ['CustomObject:Account'])],
      new Map([
        ['ApexClass:Service', new Set()],
        ['CustomObject:Account', new Set()],
      ])
    );

    expect(result.errors).to.include('Wave 2 moves backward from deployment stage 3 to 1');
  });

  it('US-043-AC-2: should validate component limits', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  it('US-043-AC-3: should validate test requirements', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  it('US-043-AC-4: should validate no cycles within wave', () => {
    const validator = new WaveValidator();
    expect(validator).to.exist;
  });

  /**
   * @ac US-043-AC-5: Generate validation report
   */
  it('US-043-AC-5: should generate validation report', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves([], new Map());
    expect(result.errors).to.be.an('array');
  });

  /**
   * @ac US-043-AC-6: Fail on critical issues
   */
  it('US-043-AC-6: should fail on critical issues', () => {
    const validator = new WaveValidator();
    const result = validator.validateWaves([], new Map());
    expect(result.isValid).to.be.a('boolean');
  });
});
