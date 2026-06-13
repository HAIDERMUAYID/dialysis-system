import type { FacePoseMetrics } from './dialysisFaceQuality';
import { FACE_LIVENESS_YAW_MIN } from './dialysisFaceConfig';

export function faceTurnDelta(
  current: FacePoseMetrics,
  center: FacePoseMetrics,
  mirrored: boolean
): number {
  let delta = current.yawRatio - center.yawRatio;
  if (mirrored) delta = -delta;
  return delta;
}

export function isLivenessTurnReady(
  current: FacePoseMetrics,
  center: FacePoseMetrics,
  mirrored: boolean,
  expectTurn: 'left' | 'right' = 'left'
): boolean {
  const delta = faceTurnDelta(current, center, mirrored);
  return expectTurn === 'left'
    ? delta <= -FACE_LIVENESS_YAW_MIN
    : delta >= FACE_LIVENESS_YAW_MIN;
}

export function livenessTurnHint(mirrored: boolean): string {
  return mirrored
    ? 'أدر رأسك قليلاً لليمين — كما في المرآة'
    : 'أدر رأسك قليلاً لليسار';
}

export function livenessCenterHint(): string {
  return 'انظر للكامره مباشرة داخل الإطار';
}
