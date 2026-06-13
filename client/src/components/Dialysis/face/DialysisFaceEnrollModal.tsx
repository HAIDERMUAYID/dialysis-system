import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert, Progress, Space, Typography, message, Tag } from 'antd';
import { CameraOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { FacePoseMetrics } from './dialysisFaceQuality';
import {
  captureEnrollmentSamples,
  captureLivenessCenterFrame,
  captureLivenessTurnFrame,
  minPairwiseSimilarity,
} from './dialysisFaceRuntime';
import {
  FACE_ENROLL_AUTO_STABLE_MS,
  FACE_ENROLL_MIN_PAIRWISE,
  FACE_ENROLL_MIN_SAMPLES,
  FACE_ENROLL_SAMPLES,
  FACE_ENROLL_TURN_STABLE_MS,
  FACE_PIPELINE_VERSION,
} from './dialysisFaceConfig';
import {
  isLivenessTurnReady,
  livenessCenterHint,
  livenessTurnHint,
} from './dialysisFaceLivenessHints';
import DialysisFaceCameraControls from './DialysisFaceCameraControls';
import DialysisFaceQualityMeter from './DialysisFaceQualityMeter';
import { useDialysisFaceCamera } from './useDialysisFaceCamera';
import { useFaceQualityPreview } from './useFaceQualityPreview';
import { useDialysisFaceModalProps } from './useDialysisFaceModalProps';
import { useDialysisFaceSession } from './useDialysisFaceSession';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { dialysisHaptic } from '../app/useDialysisHaptic';
import './dialysis-face-enroll.css';

const { Text } = Typography;

type FlowPhase = 'intro' | 'center' | 'turn' | 'collect' | 'save' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: number;
  hospitalId: number;
  patientName: string;
  hasFaceEnrolled?: boolean;
  onEnrolled?: () => void;
}

function phaseProgress(phase: FlowPhase, collectPct: number): number {
  if (phase === 'intro') return 5;
  if (phase === 'center') return 18;
  if (phase === 'turn') return 38;
  if (phase === 'collect') return 45 + Math.round(collectPct * 0.4);
  if (phase === 'save') return 92;
  return 100;
}

function phaseLabel(phase: FlowPhase, mirrored: boolean): string {
  switch (phase) {
    case 'intro':
      return 'جاهز — اضغط ابدأ';
    case 'center':
      return livenessCenterHint();
    case 'turn':
      return livenessTurnHint(mirrored);
    case 'collect':
      return 'ثبّت وجهك — جاري التقاط البصمة';
    case 'save':
      return 'جاري الحفظ…';
    case 'done':
      return 'تم التسجيل بنجاح ✓';
    default:
      return '';
  }
}

const DialysisFaceEnrollModal: React.FC<Props> = ({
  open,
  onClose,
  patientId,
  hospitalId,
  patientName,
  hasFaceEnrolled = false,
  onEnrolled,
}) => {
  const isMobile = useDialysisMobile();
  const [flowActive, setFlowActive] = useState(false);
  const faceModalProps = useDialysisFaceModalProps();
  const cameraOn = open && flowActive;
  useDialysisFaceSession(cameraOn);
  const { videoRef, facing, flipCamera, phase: cameraPhase, loadHint, error: cameraError } =
    useDialysisFaceCamera(cameraOn);
  const quality = useFaceQualityPreview(videoRef, cameraOn && cameraPhase === 'ready');

  const [phase, setPhase] = useState<FlowPhase>('intro');
  const [busy, setBusy] = useState(false);
  const [centerPose, setCenterPose] = useState<FacePoseMetrics | null>(null);
  const [livenessSamples, setLivenessSamples] = useState<number[][]>([]);
  const [collectPct, setCollectPct] = useState(0);
  const [error, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stableSinceRef = useRef<number | null>(null);
  const autoLockRef = useRef(false);

  const displayError = error || cameraError;
  const cameraReady = cameraPhase === 'ready';
  const mirrored = facing === 'user';
  const progress = phaseProgress(phase, collectPct);
  const statusLabel = phaseLabel(phase, mirrored);

  const resetFlow = useCallback(() => {
    setPhase('intro');
    setBusy(false);
    setCenterPose(null);
    setLivenessSamples([]);
    setCollectPct(0);
    setLocalError(null);
    setSubmitting(false);
    stableSinceRef.current = null;
    autoLockRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      setFlowActive(false);
      resetFlow();
    }
  }, [open, resetFlow]);

  const saveEnrollment = useCallback(
    async (embeddings: number[][], avgQuality: number, pairwise: number | null) => {
      setPhase('save');
      setSubmitting(true);
      try {
        await axios.post(`/api/dialysis/patients/${patientId}/face-enroll`, {
          hospital_id: hospitalId,
          embeddings,
          consent: true,
          meta: {
            pipeline_version: FACE_PIPELINE_VERSION,
            camera_facing: facing,
            enroll_quality: Math.round(avgQuality),
            liveness_passed: true,
            sample_count: embeddings.length,
            pairwise_similarity: pairwise,
          },
        });
        setPhase('done');
        dialysisHaptic('success');
        message.success('تم تسجيل الوجه بنجاح');
        onEnrolled?.();
        window.setTimeout(() => onClose(), 600);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'فشل حفظ بصمة الوجه';
        setLocalError(msg);
        setFlowActive(false);
        setPhase('intro');
      } finally {
        setSubmitting(false);
        setBusy(false);
        autoLockRef.current = false;
      }
    },
    [patientId, hospitalId, facing, onEnrolled, onClose]
  );

  const runCollectAndSave = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || autoLockRef.current) return;
    autoLockRef.current = true;
    setBusy(true);
    setPhase('collect');
    setLocalError(null);
    setCollectPct(0);

    const maxAttempts = FACE_ENROLL_SAMPLES + 3;
    const { samples: collected, errors, avgQuality } = await captureEnrollmentSamples(
      video,
      FACE_ENROLL_SAMPLES,
      maxAttempts,
      (good, target) => setCollectPct(Math.round((good / target) * 100))
    );

    const allSamples = [...livenessSamples, ...collected];

    if (collected.length < FACE_ENROLL_MIN_SAMPLES) {
      setLocalError(errors[errors.length - 1] || 'لم تكتمل اللقطات — حاول مجدداً');
      setPhase('center');
      setCenterPose(null);
      setLivenessSamples([]);
      setBusy(false);
      autoLockRef.current = false;
      return;
    }

    const pairwise = minPairwiseSimilarity(allSamples);
    if (pairwise < FACE_ENROLL_MIN_PAIRWISE) {
      setLocalError('اللقطات غير متسقة — أعد المحاولة بنفس الإضاءة');
      setPhase('center');
      setCenterPose(null);
      setLivenessSamples([]);
      setBusy(false);
      autoLockRef.current = false;
      return;
    }

    await saveEnrollment(allSamples, avgQuality, pairwise);
  }, [cameraReady, livenessSamples, saveEnrollment, videoRef]);

  const captureCenter = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || autoLockRef.current) return;
    autoLockRef.current = true;
    setBusy(true);
    setLocalError(null);

    const result = await captureLivenessCenterFrame(video);
    autoLockRef.current = false;
    setBusy(false);
    stableSinceRef.current = null;

    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    dialysisHaptic('tap');
    setCenterPose(result.pose);
    setLivenessSamples([result.descriptor]);
    setPhase('turn');
  }, [cameraReady, videoRef]);

  const captureTurn = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !centerPose || !livenessSamples[0] || autoLockRef.current) return;
    autoLockRef.current = true;
    setBusy(true);
    setLocalError(null);

    const result = await captureLivenessTurnFrame(
      video,
      livenessSamples[0],
      centerPose,
      'left',
      mirrored
    );
    autoLockRef.current = false;
    setBusy(false);
    stableSinceRef.current = null;

    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    dialysisHaptic('tap');
    setLivenessSamples([result.center, result.turned]);
    void runCollectAndSave();
  }, [cameraReady, centerPose, livenessSamples, mirrored, runCollectAndSave, videoRef]);

  useEffect(() => {
    if (!cameraOn || !cameraReady || busy || submitting || displayError) {
      stableSinceRef.current = null;
      return undefined;
    }

    const now = Date.now();

    if (phase === 'center') {
      if (!quality?.ok || !quality.checks.centeredOk) {
        stableSinceRef.current = null;
        return undefined;
      }
      if (stableSinceRef.current == null) stableSinceRef.current = now;
      if (now - stableSinceRef.current >= FACE_ENROLL_AUTO_STABLE_MS) {
        stableSinceRef.current = null;
        void captureCenter();
      }
      return undefined;
    }

    if (phase === 'turn' && centerPose && quality?.pose) {
      if (!isLivenessTurnReady(quality.pose, centerPose, mirrored)) {
        stableSinceRef.current = null;
        return undefined;
      }
      if (stableSinceRef.current == null) stableSinceRef.current = now;
      if (now - stableSinceRef.current >= FACE_ENROLL_TURN_STABLE_MS) {
        stableSinceRef.current = null;
        void captureTurn();
      }
      return undefined;
    }

    stableSinceRef.current = null;
    return undefined;
  }, [
    cameraOn,
    cameraReady,
    busy,
    submitting,
    phase,
    centerPose,
    quality,
    mirrored,
    displayError,
    captureCenter,
    captureTurn,
  ]);

  const startFlow = () => {
    resetFlow();
    setFlowActive(true);
    setPhase('center');
    setLocalError(null);
  };

  const removeEnrollment = async () => {
    try {
      setSubmitting(true);
      await axios.delete(`/api/dialysis/patients/${patientId}/face-enroll`, {
        params: { hospital_id: hospitalId },
      });
      message.success('تم إزالة تسجيل الوجه');
      onEnrolled?.();
      onClose();
    } catch {
      message.error('فشل الإزالة');
    } finally {
      setSubmitting(false);
    }
  };

  const renderIntro = () => (
    <div className="d-face-enroll-intro">
      <div className="d-face-enroll-intro__icon">
        <CameraOutlined />
      </div>
      <Text strong style={{ fontSize: isMobile ? 16 : 18, display: 'block', marginBottom: 6 }}>
        {hasFaceEnrolled ? 'تحديث بصمة الوجه' : 'تسجيل بصمة الوجه'}
      </Text>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, lineHeight: 1.6 }}>
        {patientName} — اتبع التعليمات على الشاشة فقط.
        <br />
        انظر للأمام ← أدر رأسك قليلاً ← يُحفظ تلقائياً.
      </Text>
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 16 }}>
        بالمتابعة أوافق على استخدام بصمة الوجه للتعرف داخل وحدة الغسل فقط.
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Button block type="primary" size="large" icon={<CameraOutlined />} onClick={startFlow}>
          {hasFaceEnrolled ? 'ابدأ التحديث' : 'ابدأ التسجيل'}
        </Button>
        {hasFaceEnrolled ? (
          <Button block danger loading={submitting} onClick={() => void removeEnrollment()}>
            إزالة البصمة
          </Button>
        ) : null}
        <Button block type="text" onClick={onClose}>
          إلغاء
        </Button>
      </Space>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined />
          <span>{isMobile ? 'بصمة الوجه' : 'تسجيل الوجه (اختياري)'}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      maskClosable={!flowActive}
      className={`d-face-enroll-modal d-face-enroll-modal--smooth${
        isMobile ? ' d-face-enroll-modal--mobile' : ''
      }`}
      {...faceModalProps}
    >
      {!flowActive ? (
        renderIntro()
      ) : (
        <div className="d-face-enroll-flow">
          <div className="d-face-enroll-flow__status">
            {phase === 'done' ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                {statusLabel}
              </Tag>
            ) : busy || submitting ? (
              <Tag icon={<LoadingOutlined spin />} color="processing">
                {statusLabel}
              </Tag>
            ) : (
              <Tag color={quality?.ok ? 'success' : 'default'}>{statusLabel}</Tag>
            )}
          </div>

          <Progress
            percent={progress}
            size="small"
            showInfo={false}
            strokeColor={{ from: '#6366f1', to: '#0d9488' }}
            className="d-face-enroll-flow__progress"
          />

          <div
            className={`d-face-enroll-video-wrap d-face-enroll-video-wrap--guided d-face-enroll-flow__video${
              phase === 'turn' ? ' d-face-enroll-video-wrap--turn' : ''
            }${quality?.ok && phase !== 'save' ? ' d-face-enroll-video-wrap--ready' : ''}`}
          >
            <video
              ref={videoRef}
              className={`d-face-enroll-video${mirrored ? ' d-face-enroll-video--mirror' : ''}`}
              playsInline
              muted
              autoPlay
            />
            <div className="d-face-oval-guide" aria-hidden />
            {cameraPhase === 'loading' ? (
              <div className="d-face-enroll-video-overlay">
                <Text>{loadHint || 'تحميل…'}</Text>
              </div>
            ) : null}
            {(busy || submitting) && phase !== 'done' ? (
              <div className="d-face-enroll-video-overlay d-face-enroll-video-overlay--scan">
                <LoadingOutlined spin style={{ fontSize: 28, color: '#fff' }} />
              </div>
            ) : null}
            {!busy && !submitting && cameraReady && phase !== 'save' && phase !== 'done' ? (
              <div className="d-face-identify-auto__hint">{statusLabel}</div>
            ) : null}
          </div>

          {!isMobile ? (
            <DialysisFaceQualityMeter quality={quality} minimal />
          ) : null}

          {displayError ? (
            <Alert
              type="warning"
              message={displayError}
              style={{ marginTop: 10 }}
              showIcon
              closable
              onClose={() => setLocalError(null)}
            />
          ) : null}

          <div className="d-face-enroll-actions">
            {displayError ? (
              <Button block type="primary" size="large" onClick={startFlow}>
                إعادة المحاولة
              </Button>
            ) : null}
            {!submitting && phase !== 'done' ? (
              <DialysisFaceCameraControls
                facing={facing}
                onFlip={flipCamera}
                disabled={busy || cameraPhase === 'loading'}
              />
            ) : null}
            <Button block type="text" disabled={submitting} onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DialysisFaceEnrollModal;
