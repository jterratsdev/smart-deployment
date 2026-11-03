import type { NodeId } from './dependency.js';
import type { MetadataType } from './metadata.js';

export type WaveActionPhase = 'before' | 'after';

export type WaveAction =
  | {
      kind: 'apex-anonymous';
      script: string;
      sha256?: string;
      description?: string;
    }
  | {
      kind: 'manual';
      instruction: string;
    };

export type WaveActionSelector = {
  components?: NodeId[];
  types?: MetadataType[];
};

/** Repo-configured rule. The planner resolves its selector to deployment waves. */
export type WaveActionRule = {
  id: string;
  phase: WaveActionPhase;
  when: WaveActionSelector;
  action: WaveAction;
};

/** Action attached to a concrete wave after matching its components. */
export type ResolvedWaveAction = {
  id: string;
  phase: WaveActionPhase;
  action: WaveAction;
  matchedComponents: NodeId[];
};
