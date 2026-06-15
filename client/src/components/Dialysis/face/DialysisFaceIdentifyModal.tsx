import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Alert, Space, Typography, Tag, message, Spin } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { captureVerifiedFaceDescriptors } from './dialysisFaceRuntime';
import { captureVideoCenterPortraitBlob } from '../face/dialysisFaceRuntime';
import { ensureDialysisPatientPortrait } from '../app/dialysisPatientPhoto';
import {
  FACE_AUTO_SCAN_COOLDOWN_MS,
  FACE_AUTO_SCAN_STABLE_FAST_MS,
  FACE_AUTO_SCAN_STABLE_MS,
  FACE_IDENTIFY_FRAME_DELAY_MS,
  FACE_IDENTIFY_FRAMES,
  FACE_IDENTIFY_STATUS_IDLE,
  FACE_IS_STAFF_MODE,
  FACE_REJECT_REASON_AR,
  FACE_STRONG_MATCH_THRESHOLD,
} from './dialysisFaceConfig';
import DialysisFaceMatchPicker from './DialysisFaceMatchPicker';
import DialysisFaceStaffGuide from './DialysisFaceStaffGuide';
import DialysisFaceCameraControls from './DialysisFaceCameraControls';
import DialysisFaceQualityMeter from './DialysisFaceQualityMeter';
import { useDialysisFaceCamera } from './useDialysisFaceCamera';
import { useFaceQualityPreview } from './useFaceQualityPreview';
import { useDialysisFaceModalProps } from './useDialysisFaceModalProps';
import { useDialysisFaceSession } from './useDialysisFaceSession';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { dialysisHaptic } from '../app/useDialysisHaptic';
import { useDialysisFaceVoiceHint } from './useDialysisFaceVoiceHint';
import DialysisFaceVoiceToggle from './DialysisFaceVoiceToggle';
import './dialysis-face-enroll.css';

const { Text } = Typography;

export interface FaceMatchRow {
  patient_id: number;
  full_name: string;
  confidence: number;
  photo_url?: string | null;
}

interface AutoMatchResult {
  ok: boolean;
  reason?: string;
  message?: string;
  patient_id?: number;
  full_name?: string;
  photo_url?: string | null;
  confidence?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  hospitalId: number;
  onSelect: (patientId: number, patientName: string) => void;
  nestedInDrawer?: boolean;
}

type ScanPhase = 'idle' | 'arming' | 'scanning' | 'success';

function stableDelayMs(level?: string): number {
  return level === 'excellent' ? FACE_AUTO_SCAN_STABLE_FAST_MS : FACE_AUTO_SCAN_STABLE_MS;
}

const DialysisFaceIdentifyModal: React.FC<Props> = ({
  open,
  onClose,
  hospitalId,
  onSelect,
  nestedInDrawer = false,
}) => {
  const isMobile = useDialysisMobile();
  const faceModalProps = useDialysisFaceModalProps(nestedInDrawer);

  const [scanning, setScanning] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [error, setLocalError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState(FACE_IDENTIFY_STATUS_IDLE);
  const [matches, setMatches] = useState<FaceMatchRow[]>([]);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [needsReenrollCount, setNeedsReenrollCount] = useState<number | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [stableProgress, setStableProgress] = useState(0);
  const [showMore, setShowMore] = useState(false);

  const showingResults = matches.length > 0;
  const cameraOpen = open && !showingResults;

  const { videoRef, facing, flipCamera, phase: cameraPhase, loadHint, error: cameraError, setError } =
    useDialysisFaceCamera(cameraOpen);
  const quality = useFaceQualityPreview(videoRef, cameraOpen && cameraPhase === 'ready');
  useDialysisFaceSession(cameraOpen);

  const scanLockRef = useRef(false);
  const lastScanRef = useRef(0);
  const stableOkSinceRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const displayError = error || cameraError;
  const cameraReady = cameraPhase === 'ready';
  const qualityOk = Boolean(quality?.ok && quality.level !== 'poor');

  const voiceHint = useMemo(() => {
    if (scanning) return statusText;
    if (cameraPhase === 'loading') return loadHint || 'تحميل النماذج';
    if (!cameraReady) return undefined;
    if (scanPhase === 'arming') return 'تعرف تلقائي';
    if (quality?.ok === false && quality.message) return quality.message;
    if (qualityOk) {
      return FACE_IS_STAFF_MODE ? 'ثبّت الكاميرا على المريض' : 'ثبّت وجهك';
    }
    return FACE_IS_STAFF_MODE ? 'وجّه الكاميرا نحو وجه المريض' : 'قرّب وجهك للإطار';
  }, [
    scanning,
    statusText,
    cameraPhase,
    loadHint,
    cameraReady,
    scanPhase,
    quality?.ok,
    quality?.message,
    qualityOk,
  ]);

  useDialysisFaceVoiceHint(
    voiceHint,
    open && cameraOpen && !showingResults && scanPhase !== 'success' && !displayError
  );

  const completeMatch = useCallback(
    async (
      patientId: number,
      patientName: string,
      confidence?: number,
      photoUrl?: string | null,
      portraitBlob?: Blob | null
    ) => {
      await ensureDialysisPatientPortrait(
        patientId,
        hospitalId,
        portraitBlob ?? null,
        Boolean(photoUrl)
      );
      setScanPhase('success');
      setStatusText(`تم التعرف: ${patientName}`);
      dialysisHaptic('success');
      message.success(
        confidence != null
          ? `تم التعرف على ${patientName} (${Math.round(confidence * 100)}%)`
          : `تم التعرف على ${patientName}`
      );
      onSelect(patientId, patientName);
      onClose();
    },
    [hospitalId, onClose, onSelect]
  );

  const runIdentify = useCallback(async () => {
    const video = videoRef.current;
    if (!video || cameraPhase !== 'ready' || scanLockRef.current) return;

    scanLockRef.current = true;
    cancelledRef.current = false;
    setScanning(true);
    setScanPhase('scanning');
    setStableProgress(0);
    setLocalError(null);
    setError(null);
    setStatusText('جاري التعرف…');
    setMatches([]);
    setVerifyStep(0);
    stableOkSinceRef.current = null;

    try {
      const { descriptors, errors } = await captureVerifiedFaceDescriptors(
        video,
        FACE_IDENTIFY_FRAMES,
        (idx, total, ok) => {
          setVerifyStep(idx + 1);
          setStatusText(
            ok
              ? `تحليل ${idx + 1}/${total}`
              : FACE_IS_STAFF_MODE
                ? `ثبّت الكاميرا — ${idx + 1}/${total}`
                : `ثبّت وجهك — ${idx + 1}/${total}`
          );
        },
        FACE_IDENTIFY_FRAME_DELAY_MS
      );

      if (cancelledRef.current) return;

      if (descriptors.length < FACE_IDENTIFY_FRAMES) {
        setLocalError(errors[errors.length - 1] || 'لم تكتمل اللقطات');
        setScanPhase('idle');
        setStatusText(FACE_IDENTIFY_STATUS_IDLE);
        return;
      }

      const portraitBlob = await captureVideoCenterPortraitBlob(video, facing === 'user');

      const { data } = await axios.post<{
        matches: FaceMatchRow[];
        enrolled_count: number;
        auto_match: AutoMatchResult;
      }>('/api/dialysis/patients/identify-face', {
        hospital_id: hospitalId,
        embeddings: descriptors,
        top_k: 5,
      });

      if (cancelledRef.current) return;

      setEnrolledCount(data.enrolled_count ?? 0);

      if (!data.enrolled_count) {
        setLocalError('لا يوجد مرضى مسجّلون بالوجه بعد');
        setScanPhase('idle');
        return;
      }

      if (data.auto_match?.ok && data.auto_match.patient_id != null) {
        await completeMatch(
          data.auto_match.patient_id,
          data.auto_match.full_name || `#${data.auto_match.patient_id}`,
          data.auto_match.confidence,
          data.auto_match.photo_url,
          portraitBlob
        );
        return;
      }

      setMatches(data.matches ?? []);

      const reasonMsg =
        data.auto_match?.message ||
        (data.auto_match?.reason ? FACE_REJECT_REASON_AR[data.auto_match.reason] : null);

      if (data.matches?.length === 1) {
        const row = data.matches[0];
        if (row.confidence >= FACE_STRONG_MATCH_THRESHOLD) {
          await completeMatch(
            row.patient_id,
            row.full_name,
            row.confidence,
            row.photo_url,
            portraitBlob
          );
          return;
        }
      }

      setLocalError(reasonMsg || 'اختر المريض من القائمة أدناه');
      setScanPhase('idle');
      setStatusText(
        data.auto_match?.reason === 'AMBIGUOUS'
          ? 'تشابه بين مرضى — اختر الصحيح'
          : 'لم يُؤكَّد تلقائياً — اختر من القائمة'
      );
    } catch (e: unknown) {
      if (!cancelledRef.current) {
        const ax = e as { response?: { status?: number; data?: { error?: string } } };
        const msg =
          ax.response?.status === 429
            ? 'محاولات كثيرة — انتظر دقيقة ثم أعد المسح'
            : ax.response?.data?.error || 'فشل مطابقة الوجه';
        setLocalError(msg);
        setScanPhase('idle');
        setStatusText(FACE_IDENTIFY_STATUS_IDLE);
      }
    } finally {
      scanLockRef.current = false;
      lastScanRef.current = Date.now();
      if (!cancelledRef.current) setScanning(false);
    }
  }, [completeMatch, cameraPhase, facing, hospitalId, setError, videoRef]);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      setScanning(false);
      setVerifyStep(0);
      setLocalError(null);
      setStatusText(FACE_IDENTIFY_STATUS_IDLE);
      setMatches([]);
      setEnrolledCount(null);
      setNeedsReenrollCount(null);
      setScanPhase('idle');
      setStableProgress(0);
      setShowMore(false);
      stableOkSinceRef.current = null;
      scanLockRef.current = false;
      return;
    }
    cancelledRef.current = false;

    void axios
      .get<{
        enrolled_count?: number;
        needs_reenroll_count?: number;
      }>('/api/dialysis/patients/face-stats', {
        params: { hospital_id: hospitalId },
      })
      .then(({ data }) => {
        setEnrolledCount(data.enrolled_count ?? 0);
        setNeedsReenrollCount(data.needs_reenroll_count ?? 0);
      })
      .catch(() => {
        setEnrolledCount(null);
        setNeedsReenrollCount(null);
      });
  }, [open, hospitalId]);

  useEffect(() => {
    if (!open || !cameraReady || scanning || scanPhase === 'success' || showingResults) {
      stableOkSinceRef.current = null;
      setStableProgress(0);
      return undefined;
    }

    if (!qualityOk) {
      stableOkSinceRef.current = null;
      setStableProgress(0);
      setScanPhase('idle');
      setStatusText(quality?.message || FACE_IDENTIFY_STATUS_IDLE);
      return undefined;
    }

    const now = Date.now();
    if (now - lastScanRef.current < FACE_AUTO_SCAN_COOLDOWN_MS) return undefined;

    if (stableOkSinceRef.current == null) {
      stableOkSinceRef.current = now;
      setScanPhase('arming');
      setStatusText('ممتاز — جاري التعرف…');
    }

    const delay = stableDelayMs(quality?.level);
    const tick = () => {
      const since = stableOkSinceRef.current;
      if (!since) return;
      const elapsed = Date.now() - since;
      const pct = Math.min(100, (elapsed / delay) * 100);
      setStableProgress(pct);
      if (elapsed >= delay) {
        stableOkSinceRef.current = null;
        setStableProgress(0);
        void runIdentify();
      }
    };

    tick();
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [open, cameraReady, scanning, scanPhase, showingResults, qualityOk, quality, runIdentify]);

  const pickMatch = (row: FaceMatchRow) => {
    void (async () => {
      await completeMatch(row.patient_id, row.full_name, row.confidence, row.photo_url, null);
    })();
  };

  const handleRetake = useCallback(() => {
    cancelledRef.current = true;
    setMatches([]);
    setLocalError(null);
    setError(null);
    setScanning(false);
    setScanPhase('idle');
    setStatusText(FACE_IDENTIFY_STATUS_IDLE);
    setStableProgress(0);
    setVerifyStep(0);
    stableOkSinceRef.current = null;
    scanLockRef.current = false;
    lastScanRef.current = 0;
    cancelledRef.current = false;
  }, [setError]);

  const videoStyle = {
    '--d-scan-progress': `${stableProgress}`,
  } as React.CSSProperties;

  return (
    <Modal
      title={
        <Space>
          <ScanOutlined />
          <span>{isMobile ? 'مسح الوجه' : 'التعرف بالوجه'}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      className="d-face-enroll-modal d-face-identify-modal d-face-identify-modal--auto"
      {...faceModalProps}
    >
      <div className="d-face-identify-auto">
        {!showingResults ? <DialysisFaceStaffGuide compact /> : null}
        {needsReenrollCount != null && needsReenrollCount > 0 && !showingResults ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 10 }}
            message={`${needsReenrollCount} بصمة قديمة — يُفضّل إعادة التسجيل بالنظام الجديد`}
          />
        ) : null}
        {!showingResults ? (
          <div className="d-face-identify-auto__status">
            <DialysisFaceVoiceToggle className="d-face-voice-toggle" />
            {scanning ? (
              <Tag icon={<LoadingOutlined spin />} color="processing">
                {statusText}
              </Tag>
            ) : scanPhase === 'success' ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                {statusText}
              </Tag>
            ) : (
              <Tag color={qualityOk ? 'success' : 'default'}>{statusText}</Tag>
            )}
            {enrolledCount != null ? (
              <Text type="secondary" className="d-face-identify-auto__count">
                {enrolledCount > 0 ? `${enrolledCount} مسجّل` : 'لا تسجيلات بعد'}
              </Text>
            ) : null}
          </div>
        ) : null}

        {!showingResults ? (
          <>
            <div
              className={`d-face-enroll-video-wrap d-face-enroll-video-wrap--guided d-face-identify-auto__video${
                scanning ? ' d-face-identify-auto__video--scanning' : ''
              }${qualityOk ? ' d-face-identify-auto__video--ready' : ''}${
                scanPhase === 'arming' ? ' d-face-identify-auto__video--arming' : ''
              }`}
              style={videoStyle}
            >
              <video
                ref={videoRef}
                className={`d-face-enroll-video${facing === 'user' ? ' d-face-enroll-video--mirror' : ''}`}
                playsInline
                muted
                autoPlay
              />
              <div
                className={`d-face-oval-guide${FACE_IS_STAFF_MODE ? ' d-face-oval-guide--staff' : ''}`}
                aria-hidden
              />
              {scanPhase === 'arming' && !scanning ? (
                <div className="d-face-scan-progress-ring" aria-hidden />
              ) : null}
              {cameraPhase === 'loading' ? (
                <div className="d-face-enroll-video-overlay">
                  <Spin tip={loadHint || 'تحميل النماذج…'} />
                </div>
              ) : null}
              {scanning ? (
                <div className="d-face-enroll-video-overlay d-face-enroll-video-overlay--scan">
                  <Text className="d-face-identify-auto__scan-label">
                    {verifyStep}/{FACE_IDENTIFY_FRAMES}
                  </Text>
                </div>
              ) : null}
              {!scanning && cameraReady ? (
                <div className="d-face-identify-auto__hint">
                  {scanPhase === 'arming'
                    ? 'تعرف تلقائي…'
                    : qualityOk
                      ? FACE_IS_STAFF_MODE
                        ? 'ثبّت الكاميرا على المريض'
                        : 'ثبّت وجهك'
                      : FACE_IS_STAFF_MODE
                        ? 'وجّه الكاميرا نحو وجه المريض'
                        : 'قرّب وجهك للإطار'}
                </div>
              ) : null}
            </div>

            <DialysisFaceQualityMeter quality={quality} minimal={isMobile} compact={!isMobile} />
          </>
        ) : (
          <div className="d-face-identify-auto__results-panel">
            <Tag icon={<ScanOutlined />} color="processing" className="d-face-identify-auto__results-tag">
              {statusText}
            </Tag>
          </div>
        )}

        {displayError ? (
          <Alert type="warning" message={displayError} style={{ marginTop: 10 }} showIcon />
        ) : null}

        {showingResults ? (
          <DialysisFaceMatchPicker matches={matches} onPick={(row) => void pickMatch(row)} />
        ) : null}

        <div className="d-face-identify-auto__actions">
          {showingResults ? (
            <Button block type="primary" icon={<ReloadOutlined />} onClick={handleRetake}>
              إعادة الالتقاط
            </Button>
          ) : (
            <>
              <DialysisFaceCameraControls
                facing={facing}
                onFlip={flipCamera}
                disabled={scanning || cameraPhase === 'loading'}
              />
              {isMobile && !showMore && !FACE_IS_STAFF_MODE ? (
                <Button block type="text" onClick={() => setShowMore(true)}>
                  خيارات إضافية
                </Button>
              ) : (
                <Button block type="link" disabled={scanning} onClick={() => void runIdentify()}>
                  مسح يدوي الآن
                </Button>
              )}
            </>
          )}
          <Button block onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DialysisFaceIdentifyModal;
