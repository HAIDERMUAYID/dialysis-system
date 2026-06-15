import type { FacePoseMetrics } from './dialysisFaceQuality';
import { FACE_IS_STAFF_MODE, FACE_LIVENESS_YAW_MIN } from './dialysisFaceConfig';

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

export function livenessCenterHint(): string {
  return FACE_IS_STAFF_MODE
    ? 'وجّه الكاميرا نحو وجه المريض'
    : 'انظر للكامره مباشرة داخل الإطار';
}

export function livenessTurnHint(mirrored: boolean): string {
  if (FACE_IS_STAFF_MODE) {
    return 'اطلب من المريض أن يُدير رأسه قليلاً لليسار';
  }
  return mirrored
    ? 'أدر رأسك قليلاً لليمين — كما في المرآة'
    : 'أدر رأسك قليلاً لليسار';
}
