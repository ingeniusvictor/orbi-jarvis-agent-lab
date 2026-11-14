/** Type declarations for the Node-testable JS contract. */
export type R9Emotion = 'neutral'|'focused'|'happy'|'concern'|'curious'|'calm'|'surprised';
export type R9Gesture = 'none'|'explain'|'affirm'|'deny'|'greet'|'comfort'|'celebrate'|'think';
export type R9Gaze = 'user'|'cursor'|'away';
export type R9Posture = 'neutral'|'attentive'|'relaxed';
export type R9MotionCue = Readonly<{
  version: 1;
  emotion: R9Emotion;
  intensity: number;
  gesture: R9Gesture;
  gaze: R9Gaze;
  posture: R9Posture;
  duration_ms: number;
}>;
export const R9_MOTION_JSON_SCHEMA: Readonly<Record<string, unknown>>;
export const R9_NEUTRAL_CUE: R9MotionCue;
export function parseR9MotionIntent(raw: unknown): R9MotionCue | null;
export class R9IntentController {
  constructor();
  reset(): void;
  queue(raw: unknown, ids?: {sessionId?: string|number;turnId?: string|number;now?: number}): boolean;
  onFirstAudio(ids?: {sessionId?: string|number;turnId?: string|number;now?: number}): boolean;
  snapshot(args?: {sessionId?: string|number;turnId?: string|number;now?: number;audible?: boolean;manualClip?: boolean;guidedDemo?: boolean;dancing?: boolean;interrupted?: boolean}): R9MotionCue | null;
  get idle(): boolean;
}
