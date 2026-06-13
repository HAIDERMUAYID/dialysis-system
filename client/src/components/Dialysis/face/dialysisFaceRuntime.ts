import {
  FACE_ENROLL_MIN_PAIRWISE,
  FACE_LIVENESS_MIN_PAIRWISE,
  FACE_LIVENESS_YAW_MIN,
  FACE_MAX_HEAD_TILT_DEG,
  FACE_MIN_DETECTION_SCORE,
  FACE_MIN_FACE_RATIO,
  FACE_MODEL_CDN,
  FACE_REJECT_REASON_AR,
  FACE_VERIFY_FRAME_DELAY_MS,
} from './dialysisFaceConfig';
import {
  computePoseFromLandmarks,
  evaluateFaceQuality,
  type FacePoseMetrics,
  type FaceQualitySnapshot,
} from './dialysisFaceQuality';

type FaceApiModule = typeof import('@vladmandic/face-api');

let faceApiModule: FaceApiModule | null = null;
let modelsPromise: Promise<void> | null = null;

async function getFaceApi(): Promise<FaceApiModule> {
  if (!faceApiModule) {
    faceApiModule = await import('@vladmandic/face-api');
  }
  return faceApiModule;
}

export async function loadDialysisFaceModels(onProgress?: (msg: string) => void): Promise<void> {
  if (modelsPromise) return modelsPromise;

  modelsPromise = (async () => {
    onProgress?.('تحميل نماذج التعرف على الوجه…');
    const faceapi = await getFaceApi();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_CDN),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_CDN),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_CDN),
    ]);
    onProgress?.('جاهز');
  })();

  return modelsPromise;
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function normalizeDescriptor(desc: number[]): number[] {
  let normSq = 0;
  for (const v of desc) normSq += v * v;
  const denom = Math.sqrt(normSq);
  if (!denom) return desc;
  return desc.map((v) => v / denom);
}

export type FaceCaptureRejectReason =
  | 'NO_FACE'
  | 'LOW_SCORE'
  | 'FACE_TOO_SMALL'
  | 'HEAD_TILT'
  | 'MULTIPLE_FACES'
  | 'LIVENESS_FAIL';

export interface FaceCaptureResult {
  descriptor: number[];
  score: number;
  faceRatio: number;
  pose: FacePoseMetrics;
  quality: FaceQualitySnapshot;
}

export interface FaceCaptureReject {
  reason: FaceCaptureRejectReason;
  score?: number;
  faceRatio?: number;
  pose?: FacePoseMetrics;
}

type FaceDetectionWithLandmarks = {
  detection: { box: { width: number; height: number }; score: number };
  landmarks: {
    getLeftEye(): { x: number; y: number }[];
    getRightEye(): { x: number; y: number }[];
    getNose(): { x: number; y: number }[];
  };
  descriptor?: Float32Array;
};

async function detectAlignedDescriptor(
  video: HTMLVideoElement
): Promise<{ result: FaceCaptureResult } | { reject: FaceCaptureReject }> {
  const faceapi = await getFaceApi();
  await loadDialysisFaceModels();

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const detectOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

  const detections = (await faceapi
    .detectAllFaces(video, detectOpts)
    .withFaceLandmarks()
    .withFaceDescriptors()) as FaceDetectionWithLandmarks[];

  if (!detections.length) {
    return { reject: { reason: 'NO_FACE' } };
  }
  if (detections.length > 1) {
    return { reject: { reason: 'MULTIPLE_FACES' } };
  }

  const detection = detections[0];
  const box = detection.detection.box;
  const score = detection.detection.score;
  const pose = computePoseFromLandmarks(detection.landmarks, box, vw, vh, score);

  const quality = evaluateFaceQuality(pose, {
    minScore: FACE_MIN_DETECTION_SCORE,
    minFaceRatio: FACE_MIN_FACE_RATIO,
    maxTiltDeg: FACE_MAX_HEAD_TILT_DEG,
    singleFace: true,
  });

  if (score < FACE_MIN_DETECTION_SCORE) {
    return { reject: { reason: 'LOW_SCORE', score, faceRatio: pose.faceRatio, pose } };
  }
  if (pose.faceRatio < FACE_MIN_FACE_RATIO) {
    return { reject: { reason: 'FACE_TOO_SMALL', score, faceRatio: pose.faceRatio, pose } };
  }
  if (Math.abs(pose.tiltDeg) > FACE_MAX_HEAD_TILT_DEG) {
    return { reject: { reason: 'HEAD_TILT', score, faceRatio: pose.faceRatio, pose } };
  }

  if (!detection.descriptor) {
    return { reject: { reason: 'NO_FACE' } };
  }

  return {
    result: {
      descriptor: normalizeDescriptor(descriptorToArray(detection.descriptor)),
      score,
      faceRatio: pose.faceRatio,
      pose,
      quality,
    },
  };
}

export function rejectMessage(reject: FaceCaptureReject): string {
  return FACE_REJECT_REASON_AR[reject.reason] || 'فشل التقاط الوجه';
}

let previewCanvas: HTMLCanvasElement | null = null;
const PREVIEW_MAX_WIDTH = 320;

/** إطار مصغّر للمعاينة فقط — أسرع بكثير من كشف الوجه على دقة الكامره الكاملة */
function previewDetectionInput(
  video: HTMLVideoElement
): { input: HTMLVideoElement | HTMLCanvasElement; vw: number; vh: number } {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  if (vw <= PREVIEW_MAX_WIDTH) {
    return { input: video, vw, vh };
  }

  const scale = PREVIEW_MAX_WIDTH / vw;
  const w = PREVIEW_MAX_WIDTH;
  const h = Math.max(1, Math.round(vh * scale));

  if (!previewCanvas) previewCanvas = document.createElement('canvas');
  previewCanvas.width = w;
  previewCanvas.height = h;
  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return { input: video, vw, vh };
  ctx.drawImage(video, 0, 0, w, h);
  return { input: previewCanvas, vw: w, vh: h };
}

export async function previewFaceQuality(
  video: HTMLVideoElement
): Promise<FaceQualitySnapshot | null> {
  const faceapi = await getFaceApi();
  await loadDialysisFaceModels();

  const { input, vw, vh } = previewDetectionInput(video);

  const detections = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
    .withFaceLandmarks();

  if (!detections.length) {
    return {
      ok: false,
      score: 0,
      level: 'poor',
      checks: {
        faceDetected: false,
        singleFace: true,
        sizeOk: false,
        clarityOk: false,
        tiltOk: false,
        centeredOk: false,
      },
      message: 'لم يُكتشف وجه',
    };
  }

  const detection = detections[0];
  const pose = computePoseFromLandmarks(
    detection.landmarks,
    detection.detection.box,
    vw,
    vh,
    detection.detection.score
  );

  return evaluateFaceQuality(pose, {
    minScore: FACE_MIN_DETECTION_SCORE,
    minFaceRatio: FACE_MIN_FACE_RATIO,
    maxTiltDeg: FACE_MAX_HEAD_TILT_DEG,
    singleFace: detections.length === 1,
  });
}

export async function captureFaceDescriptorWithQuality(
  video: HTMLVideoElement
): Promise<FaceCaptureResult | FaceCaptureReject> {
  const out = await detectAlignedDescriptor(video);
  if ('reject' in out) return out.reject;
  return out.result;
}

export async function captureFaceDescriptor(
  video: HTMLVideoElement
): Promise<number[] | null> {
  const result = await captureFaceDescriptorWithQuality(video);
  if ('reason' in result) return null;
  return result.descriptor;
}

export async function captureVerifiedFaceDescriptors(
  video: HTMLVideoElement,
  count: number,
  onProgress?: (frameIndex: number, total: number, ok: boolean) => void,
  frameDelayMs = FACE_VERIFY_FRAME_DELAY_MS
): Promise<{ descriptors: number[][]; errors: string[]; avgQuality: number }> {
  const descriptors: number[][] = [];
  const errors: string[] = [];
  let qualitySum = 0;

  for (let i = 0; i < count; i += 1) {
    if (i > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, frameDelayMs));
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await captureFaceDescriptorWithQuality(video);
    if ('reason' in result) {
      errors.push(rejectMessage(result));
      onProgress?.(i, count, false);
    } else {
      descriptors.push(result.descriptor);
      qualitySum += result.quality.score;
      onProgress?.(i, count, true);
    }
  }

  return {
    descriptors,
    errors,
    avgQuality: descriptors.length ? qualitySum / descriptors.length : 0,
  };
}

export async function captureEnrollmentSamples(
  video: HTMLVideoElement,
  targetCount: number,
  maxAttempts: number,
  onProgress?: (good: number, target: number, attempt: number) => void
): Promise<{ samples: number[][]; errors: string[]; avgQuality: number }> {
  const samples: number[][] = [];
  const errors: string[] = [];
  let qualitySum = 0;

  for (let attempt = 0; attempt < maxAttempts && samples.length < targetCount; attempt += 1) {
    if (attempt > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, attempt === 1 ? 200 : 400));
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await captureFaceDescriptorWithQuality(video);
    onProgress?.(samples.length, targetCount, attempt + 1);

    if ('reason' in result) {
      errors.push(rejectMessage(result));
    } else {
      samples.push(result.descriptor);
      qualitySum += result.quality.score;
    }
  }

  return {
    samples,
    errors,
    avgQuality: samples.length ? qualitySum / samples.length : 0,
  };
}

/** لقطة أمامية لخطوة الحيوية */
export async function captureLivenessCenterFrame(
  video: HTMLVideoElement
): Promise<
  | { ok: true; descriptor: number[]; pose: FacePoseMetrics }
  | { ok: false; error: string }
> {
  const out = await detectAlignedDescriptor(video);
  if ('reject' in out) {
    return { ok: false, error: rejectMessage(out.reject) };
  }

  const { pose, descriptor } = out.result;
  if (Math.abs(pose.yawRatio) > 0.3) {
    return { ok: false, error: 'وجّه وجهك للأمام قدر الإمكان داخل الإطار' };
  }

  return { ok: true, descriptor, pose };
}

/** لقطة بعد إمالة الرأس — يُفعَّل يدوياً بعد أن يحرّك المستخدم رأسه */
export async function captureLivenessTurnFrame(
  video: HTMLVideoElement,
  centerDescriptor: number[],
  centerPose: FacePoseMetrics,
  expectTurn: 'left' | 'right',
  mirrored = false
): Promise<
  | { ok: true; center: number[]; turned: number[] }
  | { ok: false; error: string }
> {
  const out = await detectAlignedDescriptor(video);
  if ('reject' in out) {
    return { ok: false, error: rejectMessage(out.reject) };
  }

  let delta = out.result.pose.yawRatio - centerPose.yawRatio;
  if (mirrored) delta = -delta;

  const turnedEnough =
    expectTurn === 'left'
      ? delta <= -FACE_LIVENESS_YAW_MIN
      : delta >= FACE_LIVENESS_YAW_MIN;

  if (!turnedEnough) {
    const turnDir =
      mirrored
        ? expectTurn === 'left'
          ? 'لليمين (كما تراه في الشاشة)'
          : 'لليسار (كما تراه في الشاشة)'
        : expectTurn === 'left'
          ? 'لليسار'
          : 'لليمين';
    return {
      ok: false,
      error: `أدر رأسك قليلاً ${turnDir}`,
    };
  }

  const sim = minPairwiseSimilarity([centerDescriptor, out.result.descriptor]);
  if (sim < FACE_LIVENESS_MIN_PAIRWISE) {
    return { ok: false, error: FACE_REJECT_REASON_AR.LIVENESS_FAIL };
  }

  return {
    ok: true,
    center: centerDescriptor,
    turned: out.result.descriptor,
  };
}

export type FaceCameraFacing = 'user' | 'environment';

export async function startFaceCamera(
  facingMode: FaceCameraFacing = 'environment'
): Promise<{
  stream: MediaStream;
  stop: () => void;
  facingMode: FaceCameraFacing;
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('المتصفح لا يدعم الكامره. استخدم HTTPS أو localhost.');
  }

  const mobile =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 991px)').matches;

  const tryOpen = async (facing: FaceCameraFacing) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: mobile ? 1280 : 640 },
        height: { ideal: mobile ? 720 : 480 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    return stream;
  };

  let stream: MediaStream;
  let usedFacing = facingMode;

  try {
    stream = await tryOpen(facingMode);
  } catch {
    const fallback: FaceCameraFacing = facingMode === 'environment' ? 'user' : 'environment';
    stream = await tryOpen(fallback);
    usedFacing = fallback;
  }

  return {
    stream,
    facingMode: usedFacing,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  };
}

export function resetFaceModelsCache(): void {
  modelsPromise = null;
}

export function minPairwiseSimilarity(descriptors: number[][]): number {
  if (descriptors.length < 2) return 1;
  let minSim = 1;
  for (let i = 0; i < descriptors.length; i += 1) {
    for (let j = i + 1; j < descriptors.length; j += 1) {
      let dot = 0;
      const a = descriptors[i];
      const b = descriptors[j];
      for (let k = 0; k < a.length; k += 1) dot += a[k] * b[k];
      minSim = Math.min(minSim, dot);
    }
  }
  return minSim;
}

/** لقطة سريعة من منتصف الكاميرا — موثوقة بعد نجاح التعرف بالوجه */
export function captureVideoCenterPortraitBlob(
  video: HTMLVideoElement,
  mirrored = false
): Promise<Blob | null> {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (vw < 16 || vh < 16) return Promise.resolve(null);

  const side = Math.min(vw, vh) * 0.72;
  const x = Math.max(0, Math.round((vw - side) / 2));
  const y = Math.max(0, Math.round((vh - side) / 2));
  const w = Math.round(side);
  const h = Math.round(side);
  const outSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.save();
  if (mirrored) {
    ctx.translate(outSize, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, x, y, w, h, 0, 0, outSize, outSize);
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

/** لقطة صورة وجه من الكاميرا — تُستخدم كصورة المريض */
export async function captureFacePortraitBlob(
  video: HTMLVideoElement,
  mirrored = false
): Promise<Blob | null> {
  const faceapi = await getFaceApi();
  await loadDialysisFaceModels();

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const detections = await faceapi
    .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks();

  if (!detections.length) {
    const side = Math.min(vw, vh) * 0.62;
    const x = Math.max(0, Math.round((vw - side) / 2));
    const y = Math.max(0, Math.round((vh - side) / 2));
    const w = Math.round(side);
    const h = Math.round(side);
    const outSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.save();
    if (mirrored) {
      ctx.translate(outSize, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, x, y, w, h, 0, 0, outSize, outSize);
    ctx.restore();
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }

  const box = detections[0].detection.box as { x: number; y: number; width: number; height: number };
  const padX = box.width * 0.28;
  const padY = box.height * 0.35;
  const x = Math.max(0, Math.round(box.x - padX));
  const y = Math.max(0, Math.round(box.y - padY));
  const w = Math.min(vw - x, Math.round(box.width + padX * 2));
  const h = Math.min(vh - y, Math.round(box.height + padY * 2));
  if (w < 8 || h < 8) return null;

  const outSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  if (mirrored) {
    ctx.translate(outSize, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, x, y, w, h, 0, 0, outSize, outSize);
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}

export { FACE_ENROLL_MIN_PAIRWISE };
