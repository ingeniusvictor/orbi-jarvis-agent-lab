import type { R9MotionCue } from './intent-contract.js';
export type R9ExpressivePose = {
  weight: number;
  head: {pitch: number;yaw: number;roll: number};
  body: Record<string, number>;
  expression: {name: string;weight: number}|null;
  kind: string|null;
};
export class R9ExpressiveBlend {
  constructor();
  reset(): void;
  step(dt: number, cue?: R9MotionCue|null): R9ExpressivePose;
}
