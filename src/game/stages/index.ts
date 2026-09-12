import type { GameState, Input, StageKind } from '../types';
import { enterDogfight, stepDogfight } from './dogfight';
import { enterSurface, stepSurface } from './surface';
import { enterTrench, stepTrench } from './trench';

export interface Stage {
  enter(state: GameState): void;
  step(state: GameState, input: Input, dt: number): void;
}

export const STAGES: Record<StageKind, Stage> = {
  dogfight: { enter: enterDogfight, step: stepDogfight },
  surface: { enter: enterSurface, step: stepSurface },
  trench: { enter: enterTrench, step: stepTrench },
};

/** The order stages are played within a wave. */
export const STAGE_ORDER: readonly StageKind[] = ['dogfight', 'surface', 'trench'];
