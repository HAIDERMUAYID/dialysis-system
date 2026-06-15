interface LandmarkSet {
  getLeftEye(): { x: number; y: number }[];
  getRightEye(): { x: number; y: number }[];
  getNose(): { x: number; y: number }[];
}

export interface FacePoseMetrics {
  tiltDeg: number;
  yawRatio: number;
  faceRatio: number;
  detectionScore: number;
}

export interface FaceQualitySnapshot {
  ok: boolean;
  score: number;
  level: 'poor' | 'fair' | 'good' | 'excellent';
  checks: {
    faceDetected: boolean;
    singleFace: boolean;
    sizeOk: boolean;
    clarityOk: boolean;
    tiltOk: boolean;
    centeredOk: boolean;
  };
  pose?: FacePoseMetrics;
  message: string;
}

function center(points: { x: number; y: number }[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = points.length || 1;
  return { x: x / n, y: y / n };
}

export function computePoseFromLandmarks(
  landmarks: LandmarkSet,
  box: { width: number; height: number },
  frameW: number,
  frameH: number,
  detectionScore: number
): FacePoseMetrics {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const lc = center(leftEye);
  const rc = center(rightEye);
  const eyeMid = { x: (lc.x + rc.x) / 2, y: (lc.y + rc.y) / 2 };
  const noseTip = nose[Math.floor(nose.length / 2)] ?? nose[0];
  const eyeSpan = Math.hypot(rc.x - lc.x, rc.y - lc.y) || 1;
  const yawRatio = (noseTip.x - eyeMid.x) / eyeSpan;
  const tiltDeg = (Math.atan2(rc.y - lc.y, rc.x - lc.x) * 180) / Math.PI;
  const faceRatio = (box.width * box.height) / (frameW * frameH);

  return {
    tiltDeg,
    yawRatio,
    faceRatio,
    detectionScore,
  };
}

export function evaluateFaceQuality(
  pose: FacePoseMetrics,
  opts: {
    minScore: number;
    minFaceRatio: number;
    maxTiltDeg: number;
    singleFace: boolean;
    maxYawRatio?: number;
    staffMode?: boolean;
  }
): FaceQualitySnapshot {
  const checks = {
    faceDetected: true,
    singleFace: opts.singleFace,
    sizeOk: pose.faceRatio >= opts.minFaceRatio,
    clarityOk: pose.detectionScore >= opts.minScore,
    tiltOk: Math.abs(pose.tiltDeg) <= opts.maxTiltDeg,
    centeredOk: Math.abs(pose.yawRatio) <= (opts.maxYawRatio ?? 0.3),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passed / 6) * 100);

  let level: FaceQualitySnapshot['level'] = 'poor';
  if (score >= 90) level = 'excellent';
  else if (score >= 75) level = 'good';
  else if (score >= 50) level = 'fair';

  let message = 'جاهز للالتقاط';
  if (!checks.singleFace) message = opts.staffMode ? 'يجب وجود وجه المريض فقط' : 'يجب وجود وجه واحد فقط';
  else if (!checks.sizeOk)
    message = opts.staffMode
      ? 'الوجه بعيد — قرّب قليلاً أو كبّر داخل الإطار'
      : 'قرّب وجهك داخل الإطار';
  else if (!checks.clarityOk)
    message = opts.staffMode
      ? 'الوجه غير واضح — حسّن الإضاءة على المريض'
      : 'حسّن الإضاءة — الوجه غير واضح';
  else if (!checks.tiltOk) message = opts.staffMode ? 'ثبّت رأس المريض' : 'أعد مستوى رأسك';
  else if (!checks.centeredOk)
    message = opts.staffMode ? 'وجّه الكاميرا نحو وجه المريض' : 'وجّه وجهك نحو الكامره مباشرة';

  return {
    ok:
      checks.faceDetected &&
      checks.singleFace &&
      checks.sizeOk &&
      checks.clarityOk &&
      checks.tiltOk,
    score,
    level,
    checks,
    pose,
    message,
  };
}

export function qualityLevelColor(level: FaceQualitySnapshot['level']): string {
  if (level === 'excellent') return '#10b981';
  if (level === 'good') return '#3b82f6';
  if (level === 'fair') return '#f59e0b';
  return '#ef4444';
}
