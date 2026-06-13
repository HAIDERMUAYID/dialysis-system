import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert, Space, Typography, List, Tag, message, Spin } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ScanOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { captureVerifiedFaceDescriptors } from './dialysisFaceRuntime';
import {
  FACE_AUTO_SCAN_COOLDOWN_MS,
  FACE_AUTO_SCAN_STABLE_FAST_MS,
  FACE_AUTO_SCAN_STABLE_MS,
  FACE_IDENTIFY_FRAME_DELAY_MS,
  FACE_IDENTIFY_FRAMES,
  FACE_REJECT_REASON_AR,
  FACE_STRONG_MATCH_THRESHOLD,
} from './dialysisFaceConfig';
import DialysisFaceQualityMeter from './DialysisFaceQualityMeter';
import { useDialysisFaceCamera } from './useDialysisFaceCamera';
import { useFaceQualityPreview } from './useFaceQualityPreview';
import { useDialysisFaceModalProps } from './useDialysisFaceModalProps';
import { useDialysisFaceSession } from './useDialysisFaceSession';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { dialysisHaptic } from '../app/useDialysisHaptic';
import './dialysis-face-enroll.css';

const { Text } = Typography;

export interface FaceMatchRow {
  patient_id: number;
  full_name: string;
  confidence: number;
}

interface AutoMatchResult {
  ok: boolean;
  reason?: string;
  message?: string;
  patient_id?: number;
  full_name?: string;
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
  useDialysisFaceSession(open);

  const { videoRef, facing, flipCamera, phase: cameraPhase, loadHint, error: cameraError, setError } =
    useDialysisFaceCamera(open);
  const quality = useFaceQualityPreview(videoRef, open && cameraPhase === 'ready');

  const [scanning, setScanning] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [error, setLocalError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('وجّه وجهك داخل الإطار');
  const [matches, setMatches] = useState<FaceMatchRow[]>([]);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [stableProgress, setStableProgress] = useState(0);
  const [showMore, setShowMore] = useState(false);

  const scanLockRef = useRef(false);
  const lastScanRef = useRef(0);
  const stableOkSinceRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const displayError = error || cameraError;
  const cameraReady = cameraPhase === 'ready';
  const qualityOk = Boolean(quality?.ok && quality.level !== 'poor');

  const applyMatch = useCallback(
    (patientId: number, patientName: string, confidence?: number) => {
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
    [onClose, onSelect]
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
          setStatusText(ok ? `تحليل ${idx + 1}/${total}` : `ثبّت وجهك — ${idx + 1}/${total}`);
        },
        FACE_IDENTIFY_FRAME_DELAY_MS
      );

      if (cancelledRef.current) return;

      if (descriptors.length < FACE_IDENTIFY_FRAMES) {
        setLocalError(errors[errors.length - 1] || 'لم تكتمل اللقطات');
        setScanPhase('idle');
        setStatusText('وجّه وجهك داخل الإطار');
        return;
      }

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
        applyMatch(
          data.auto_match.patient_id,
          data.auto_match.full_name || `#${data.auto_match.patient_id}`,
          data.auto_match.confidence
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
          applyMatch(row.patient_id, row.full_name, row.confidence);
          return;
        }
      }

      setLocalError(reasonMsg || 'اختر المريض من القائمة أو حاول مجدداً');
      setScanPhase('idle');
      setStatusText('لم يُؤكَّد تلقائياً — اختر من القائمة');
    } catch (e: unknown) {
      if (!cancelledRef.current) {
        setLocalError(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'فشل مطابقة الوجه'
        );
        setScanPhase('idle');
        setStatusText('وجّه وجهك داخل الإطار');
      }
    } finally {
      scanLockRef.current = false;
      lastScanRef.current = Date.now();
      if (!cancelledRef.current) setScanning(false);
    }
  }, [applyMatch, cameraPhase, hospitalId, setError, videoRef]);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      setScanning(false);
      setVerifyStep(0);
      setLocalError(null);
      setStatusText('وجّه وجهك داخل الإطار');
      setMatches([]);
      setEnrolledCount(null);
      setScanPhase('idle');
      setStableProgress(0);
      setShowMore(false);
      stableOkSinceRef.current = null;
      scanLockRef.current = false;
      return;
    }
    cancelledRef.current = false;

    void axios
      .get<{ enrolled_count?: number }>('/api/dialysis/patients/face-stats', {
        params: { hospital_id: hospitalId },
      })
      .then(({ data }) => setEnrolledCount(data.enrolled_count ?? 0))
      .catch(() => setEnrolledCount(null));
  }, [open, hospitalId]);

  useEffect(() => {
    if (!open || !cameraReady || scanning || scanPhase === 'success') {
      stableOkSinceRef.current = null;
      setStableProgress(0);
      return undefined;
    }

    if (!qualityOk) {
      stableOkSinceRef.current = null;
      setStableProgress(0);
      setScanPhase('idle');
      setStatusText(quality?.message || 'وجّه وجهك داخل الإطار');
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
  }, [open, cameraReady, scanning, scanPhase, qualityOk, quality, runIdentify]);

  const pickMatch = (row: FaceMatchRow) => {
    applyMatch(row.patient_id, row.full_name, row.confidence);
  };

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
        <div className="d-face-identify-auto__status">
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
          <div className="d-face-oval-guide" aria-hidden />
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
                  ? 'ثبّت وجهك'
                  : 'قرّب وجهك للإطار'}
            </div>
          ) : null}
        </div>

        <DialysisFaceQualityMeter quality={quality} minimal={isMobile} compact={!isMobile} />

        {displayError ? (
          <Alert type="warning" message={displayError} style={{ marginTop: 10 }} showIcon />
        ) : null}

        {matches.length > 0 ? (
          <div className="d-face-identify-matches d-face-identify-auto__matches">
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              مرشّحون محتملون:
            </Text>
            <List
              size="small"
              dataSource={matches}
              renderItem={(row) => (
                <List.Item
                  actions={[
                    <Button type="link" key="pick" onClick={() => pickMatch(row)}>
                      اختيار
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<UserOutlined />}
                    title={row.full_name}
                    description={
                      <Tag color={row.confidence >= FACE_STRONG_MATCH_THRESHOLD ? 'green' : 'blue'}>
                        {Math.round(row.confidence * 100)}%
                      </Tag>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ) : null}

        <div className="d-face-identify-auto__actions">
          {isMobile && !showMore ? (
            <Button block type="text" onClick={() => setShowMore(true)}>
              خيارات إضافية
            </Button>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Button
                block
                icon={<SwapOutlined />}
                disabled={scanning || cameraPhase === 'loading'}
                onClick={flipCamera}
              >
                {facing === 'user' ? 'كامره خلفية' : 'كامره أمامية'}
              </Button>
              <Button block type="link" disabled={scanning} onClick={() => void runIdentify()}>
                مسح يدوي الآن
              </Button>
            </Space>
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
