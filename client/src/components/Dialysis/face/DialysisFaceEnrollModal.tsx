import React, { useEffect, useState } from 'react';
import { Modal, Button, Checkbox, Alert, Progress, Space, Typography, message, Tag, Steps } from 'antd';
import { CameraOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { FacePoseMetrics } from './dialysisFaceQuality';
import {
  captureEnrollmentSamples,
  captureLivenessCenterFrame,
  captureLivenessTurnFrame,
  minPairwiseSimilarity,
} from './dialysisFaceRuntime';
import {
  FACE_ENROLL_MIN_PAIRWISE,
  FACE_ENROLL_MIN_SAMPLES,
  FACE_ENROLL_SAMPLES,
  FACE_PIPELINE_VERSION,
} from './dialysisFaceConfig';
import DialysisFaceCameraControls from './DialysisFaceCameraControls';
import DialysisFaceInstructions from './DialysisFaceInstructions';
import DialysisFaceQualityMeter from './DialysisFaceQualityMeter';
import { useDialysisFaceCamera } from './useDialysisFaceCamera';
import { useFaceQualityPreview } from './useFaceQualityPreview';
import { useDialysisFaceModalProps } from './useDialysisFaceModalProps';
import { useDialysisFaceSession } from './useDialysisFaceSession';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { dialysisHaptic } from '../app/useDialysisHaptic';
import './dialysis-face-enroll.css';

const { Text, Paragraph } = Typography;

type EnrollStep = 0 | 1 | 2;
type LivenessPhase = 'center' | 'turn' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: number;
  hospitalId: number;
  patientName: string;
  hasFaceEnrolled?: boolean;
  onEnrolled?: () => void;
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
  const faceModalProps = useDialysisFaceModalProps();
  useDialysisFaceSession(open);
  const { videoRef, facing, flipCamera, phase: cameraPhase, loadHint, error: cameraError } =
    useDialysisFaceCamera(open);
  const quality = useFaceQualityPreview(videoRef, open && cameraPhase === 'ready');

  const [step, setStep] = useState<EnrollStep>(0);
  const [livenessPhase, setLivenessPhase] = useState<LivenessPhase>('center');
  const [livenessBusy, setLivenessBusy] = useState(false);
  const [centerPose, setCenterPose] = useState<FacePoseMetrics | null>(null);
  const [livenessSamples, setLivenessSamples] = useState<number[][]>([]);
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [pairwiseSim, setPairwiseSim] = useState<number | null>(null);
  const [avgQuality, setAvgQuality] = useState(0);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const [error, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayError = error || cameraError;
  const cameraReady = cameraPhase === 'ready';
  const mirrored = facing === 'user';

  useEffect(() => {
    if (!open) {
      setStep(0);
      setLivenessPhase('center');
      setLivenessBusy(false);
      setCenterPose(null);
      setLivenessSamples([]);
      setCapturing(false);
      setDone(false);
      setSamples([]);
      setPairwiseSim(null);
      setAvgQuality(0);
      setCaptureHint(null);
      setConsent(false);
      setLocalError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (quality?.ok && livenessPhase === 'center' && !livenessBusy) {
      setLocalError(null);
    }
  }, [quality, livenessPhase, livenessBusy]);

  const captureCenter = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !quality?.ok) return;
    setLivenessBusy(true);
    setLocalError(null);

    const result = await captureLivenessCenterFrame(video);
    setLivenessBusy(false);

    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    setCenterPose(result.pose);
    setLivenessSamples([result.descriptor]);
    setLivenessPhase('turn');
    setCaptureHint(
      mirrored
        ? '✓ تم — الآن أدر رأسك قليلاً لليمين (كما في المرآة) ثم اضغط الزر الثاني'
        : '✓ تم — الآن أدر رأسك قليلاً لليسار ثم اضغط الزر الثاني'
    );
  };

  const captureTurn = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !centerPose || !livenessSamples[0]) return;
    setLivenessBusy(true);
    setLocalError(null);

    const result = await captureLivenessTurnFrame(
      video,
      livenessSamples[0],
      centerPose,
      'left',
      mirrored
    );
    setLivenessBusy(false);

    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    setLivenessSamples([result.center, result.turned]);
    setLivenessPhase('done');
    setCaptureHint('تم التحقق من الحيوية ✓');
    setStep(1);
  };

  const captureSamples = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    setCapturing(true);
    setLocalError(null);
    setDone(false);

    const maxAttempts = FACE_ENROLL_SAMPLES + 4;
    const { samples: collected, errors, avgQuality: aq } = await captureEnrollmentSamples(
      video,
      FACE_ENROLL_SAMPLES,
      maxAttempts,
      (good, target) => setCaptureHint(`لقطة وجه ${good}/${target}…`)
    );

    const allSamples = [...livenessSamples, ...collected];
    setSamples(allSamples);
    setAvgQuality(aq);

    if (collected.length < FACE_ENROLL_MIN_SAMPLES) {
      setLocalError(
        errors[errors.length - 1] ||
          `يُطلَب ${FACE_ENROLL_MIN_SAMPLES} لقطات واضحة على الأقل`
      );
      setCapturing(false);
      return;
    }

    const pairwise = minPairwiseSimilarity(allSamples);
    setPairwiseSim(pairwise);

    if (pairwise < FACE_ENROLL_MIN_PAIRWISE) {
      setLocalError('اللقطات غير متسقة — أعد التقاط الوجه بنفس الإضاءة والزاوية');
      setCapturing(false);
      return;
    }

    setCaptureHint(`تم التقاط ${allSamples.length} لقطات متسقة ✓`);
    setDone(true);
    setStep(2);
    setCapturing(false);
  };

  const submit = async () => {
    if (!consent) {
      message.warning('يجب الموافقة على تسجيل الوجه');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`/api/dialysis/patients/${patientId}/face-enroll`, {
        hospital_id: hospitalId,
        embeddings: samples,
        consent: true,
        meta: {
          pipeline_version: FACE_PIPELINE_VERSION,
          camera_facing: facing,
          enroll_quality: Math.round(avgQuality),
          liveness_passed: livenessPhase === 'done',
          sample_count: samples.length,
          pairwise_similarity: pairwiseSim,
        },
      });
      message.success('تم تسجيل الوجه بنجاح');
      dialysisHaptic('success');
      onEnrolled?.();
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'فشل حفظ بصمة الوجه';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
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

  const progressPct =
    step === 0
      ? livenessPhase === 'done'
        ? 35
        : livenessPhase === 'turn'
          ? 25
          : 15
      : step === 1
        ? done
          ? 85
          : 55
        : 100;

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined />
          <span>تسجيل الوجه (اختياري)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      className={`d-face-enroll-modal${isMobile ? ' d-face-enroll-modal--mobile' : ''}`}
      {...faceModalProps}
    >
      <Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {patientName} — <SafetyCertificateOutlined /> بصمة من الوجه والملامح فقط
      </Paragraph>

      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 12 }}
        className="d-face-enroll-steps"
        items={[{ title: isMobile ? 'حيوية' : 'تحقق حيوية' }, { title: 'التقاط' }, { title: 'حفظ' }]}
      />

      {!isMobile ? <DialysisFaceInstructions /> : null}

      <DialysisFaceCameraControls
        facing={facing}
        onFlip={flipCamera}
        disabled={livenessBusy || capturing || cameraPhase === 'loading'}
      />

      {hasFaceEnrolled ? (
        <Alert type="success" showIcon message="الوجه مسجّل مسبقاً" style={{ margin: '8px 0' }} />
      ) : null}

      {displayError ? (
        <Alert type="error" message={displayError} style={{ marginBottom: 8 }} showIcon />
      ) : null}

      {captureHint && !displayError ? (
        <Alert type="info" message={captureHint} style={{ marginBottom: 8 }} showIcon />
      ) : null}

      <div className="d-face-enroll-video-wrap d-face-enroll-video-wrap--guided">
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
            <Text>{loadHint || 'جاري التحميل…'}</Text>
          </div>
        ) : null}
      </div>

      <DialysisFaceQualityMeter quality={quality} minimal={isMobile && step === 0} compact={step > 0 || !isMobile} />

      <Progress percent={progressPct} size="small" style={{ margin: '10px 0' }} />

      {done && pairwiseSim != null ? (
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="green">{samples.length} لقطات</Tag>
          <Tag color="blue">تناسق {Math.round(pairwiseSim * 100)}%</Tag>
        </Space>
      ) : null}

      {step === 2 ? (
        <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)}>
          أوافق على تسجيل بصمة وجهي لاستخدامها في التعرف داخل وحدة الغسل فقط
        </Checkbox>
      ) : null}

      <div className="d-face-enroll-actions">
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {step === 0 && livenessPhase === 'center' ? (
          <Button
            block
            type="primary"
            size="large"
            loading={livenessBusy}
            disabled={!cameraReady || !quality?.ok}
            onClick={() => void captureCenter()}
          >
            1 — التقط (انظر للأمام)
          </Button>
        ) : null}

        {step === 0 && livenessPhase === 'turn' ? (
          <Button
            block
            type="primary"
            size="large"
            loading={livenessBusy}
            disabled={!cameraReady}
            onClick={() => void captureTurn()}
          >
            2 — التقط (بعد إمالة الرأس)
          </Button>
        ) : null}

        {step === 0 && livenessPhase === 'done' ? (
          <Button block type="primary" size="large" onClick={() => setStep(1)}>
            التالي — التقاط اللقطات
          </Button>
        ) : null}

        {step === 1 ? (
          <Button
            block
            type="primary"
            size="large"
            loading={capturing}
            disabled={!cameraReady}
            onClick={() => void captureSamples()}
          >
            {done ? 'إعادة التقاط' : `التقاط ${FACE_ENROLL_SAMPLES} لقطات للوجه`}
          </Button>
        ) : null}

        {step === 2 ? (
          <Button
            block
            size="large"
            type="primary"
            disabled={!done || !consent}
            loading={submitting}
            onClick={() => void submit()}
          >
            حفظ تسجيل الوجه
          </Button>
        ) : null}

        {hasFaceEnrolled ? (
          <Button block danger loading={submitting} onClick={() => void removeEnrollment()}>
            إزالة تسجيل الوجه
          </Button>
        ) : null}
        <Button block onClick={onClose}>
          إلغاء
        </Button>
      </Space>
      </div>
    </Modal>
  );
};

export default DialysisFaceEnrollModal;
