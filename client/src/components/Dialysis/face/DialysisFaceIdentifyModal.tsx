import React, { useEffect, useState } from 'react';
import { Modal, Button, Alert, Space, Typography, List, Tag, message, Progress } from 'antd';
import { CameraOutlined, ScanOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import { captureVerifiedFaceDescriptors } from './dialysisFaceRuntime';
import {
  FACE_AUTO_MATCH_THRESHOLD,
  FACE_MIN_MARGIN,
  FACE_REJECT_REASON_AR,
  FACE_STRONG_MATCH_THRESHOLD,
  FACE_STRONG_MIN_MARGIN,
  FACE_VERIFY_FRAMES,
} from './dialysisFaceConfig';
import DialysisFaceCameraControls from './DialysisFaceCameraControls';
import DialysisFaceConfirmPanel from './DialysisFaceConfirmPanel';
import DialysisFaceInstructions from './DialysisFaceInstructions';
import DialysisFaceQualityMeter from './DialysisFaceQualityMeter';
import { useDialysisFaceCamera } from './useDialysisFaceCamera';
import { useFaceQualityPreview } from './useFaceQualityPreview';
import { useDialysisFaceModalProps } from './useDialysisFaceModalProps';
import './dialysis-face-enroll.css';

const { Text, Paragraph } = Typography;

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

interface PendingPatient {
  patientId: number;
  patientName: string;
  confidence?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  hospitalId: number;
  onSelect: (patientId: number, patientName: string) => void;
  nestedInDrawer?: boolean;
}

const DialysisFaceIdentifyModal: React.FC<Props> = ({
  open,
  onClose,
  hospitalId,
  onSelect,
  nestedInDrawer = false,
}) => {
  const faceModalProps = useDialysisFaceModalProps(nestedInDrawer);
  const { videoRef, facing, flipCamera, phase: cameraPhase, loadHint, error: cameraError, setError } =
    useDialysisFaceCamera(open);
  const quality = useFaceQualityPreview(videoRef, open && cameraPhase === 'ready');

  const [scanning, setScanning] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [error, setLocalError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [matches, setMatches] = useState<FaceMatchRow[]>([]);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPatient | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  const ready = cameraPhase === 'ready' && !scanning && !pending;
  const displayError = error || cameraError;

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setVerifyStep(0);
      setLocalError(null);
      setHint(null);
      setMatches([]);
      setEnrolledCount(null);
      setPending(null);
      setPendingPhoto(null);
    }
  }, [open]);

  const loadPatientPhoto = async (patientId: number) => {
    setLoadingPhoto(true);
    try {
      const { data } = await axios.get<{ photoUrl?: string | null }>(
        `/api/dialysis/patients/${patientId}`,
        { params: { hospital_id: hospitalId } }
      );
      setPendingPhoto(data.photoUrl ?? null);
    } catch {
      setPendingPhoto(null);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const showConfirm = async (patientId: number, patientName: string, confidence?: number) => {
    setPending({ patientId, patientName, confidence });
    await loadPatientPhoto(patientId);
  };

  const runIdentify = async () => {
    const video = videoRef.current;
    if (!video || cameraPhase !== 'ready') return;
    setScanning(true);
    setLocalError(null);
    setError(null);
    setHint(null);
    setMatches([]);
    setPending(null);
    setVerifyStep(0);

    try {
      const { descriptors, errors } = await captureVerifiedFaceDescriptors(
        video,
        FACE_VERIFY_FRAMES,
        (idx, total, ok) => {
          setVerifyStep(idx + 1);
          setHint(ok ? `إطار ${idx + 1}/${total} ✓` : `إطار ${idx + 1}/${total} — ثبّت الوجه`);
        }
      );

      if (descriptors.length < FACE_VERIFY_FRAMES) {
        setLocalError(errors[errors.length - 1] || 'لم تكتمل اللقطات الثلاث');
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

      setEnrolledCount(data.enrolled_count ?? 0);

      if (!data.enrolled_count) {
        setLocalError('لا يوجد مرضى مسجّلون بالوجه بعد');
        return;
      }

      setMatches(data.matches ?? []);

      if (data.auto_match?.ok && data.auto_match.patient_id != null) {
        await showConfirm(
          data.auto_match.patient_id,
          data.auto_match.full_name || `#${data.auto_match.patient_id}`,
          data.auto_match.confidence
        );
        return;
      }

      const reasonMsg =
        data.auto_match?.message ||
        (data.auto_match?.reason ? FACE_REJECT_REASON_AR[data.auto_match.reason] : null) ||
        'اختر المريض يدوياً من القائمة';
      setLocalError(reasonMsg);
    } catch (e: unknown) {
      setLocalError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'فشل مطابقة الوجه'
      );
    } finally {
      setScanning(false);
    }
  };

  const confirmPatient = () => {
    if (!pending) return;
    message.success(`تم التأكيد: ${pending.patientName}`);
    onSelect(pending.patientId, pending.patientName);
    onClose();
  };

  const pickMatch = async (row: FaceMatchRow) => {
    await showConfirm(row.patient_id, row.full_name, row.confidence);
  };

  const scanProgress = scanning
    ? Math.round((verifyStep / FACE_VERIFY_FRAMES) * 100)
    : cameraPhase === 'ready'
      ? 100
      : 40;

  return (
    <Modal
      title={
        <Space>
          <ScanOutlined />
          <span>التعرف الآمن على المريض</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      className="d-face-enroll-modal d-face-identify-modal"
      {...faceModalProps}
    >
      {pending ? (
        <DialysisFaceConfirmPanel
          patientId={pending.patientId}
          patientName={pending.patientName}
          photoUrl={pendingPhoto}
          confidence={pending.confidence}
          loading={loadingPhoto}
          onConfirm={confirmPatient}
          onCancel={() => setPending(null)}
        />
      ) : (
        <>
          <DialysisFaceInstructions />

          <DialysisFaceCameraControls
            facing={facing}
            onFlip={flipCamera}
            disabled={scanning || cameraPhase === 'loading'}
          />

          <Paragraph type="secondary" style={{ margin: '8px 0' }}>
            <SafetyCertificateOutlined /> وجه مُقتصّ ومُحاذى — {FACE_VERIFY_FRAMES} إطارات
          </Paragraph>

          {displayError ? (
            <Alert type="warning" message={displayError} style={{ marginBottom: 8 }} showIcon />
          ) : null}
          {hint && !displayError ? (
            <Alert type="info" message={hint} style={{ marginBottom: 8 }} showIcon />
          ) : null}
          {enrolledCount != null && enrolledCount > 0 ? (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              {enrolledCount} مريض/مرضى مسجّلون بالوجه
            </Text>
          ) : null}

          <div className="d-face-enroll-video-wrap d-face-enroll-video-wrap--guided">
            <video
              ref={videoRef}
              className={`d-face-enroll-video${facing === 'user' ? ' d-face-enroll-video--mirror' : ''}`}
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
            {scanning ? (
              <div className="d-face-enroll-video-overlay d-face-enroll-video-overlay--scan">
                <Text>تحقق {verifyStep}/{FACE_VERIFY_FRAMES}</Text>
              </div>
            ) : null}
          </div>

          <DialysisFaceQualityMeter quality={quality} compact />

          <Progress percent={scanProgress} size="small" style={{ margin: '10px 0' }} />

          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Button
              block
              type="primary"
              htmlType="button"
              size="large"
              icon={<CameraOutlined />}
              loading={scanning}
              disabled={!ready && !scanning}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void runIdentify();
              }}
            >
              {scanning ? `تحقق ${verifyStep}/${FACE_VERIFY_FRAMES}…` : 'تحقق الآن'}
            </Button>

            {matches.length > 0 ? (
              <div className="d-face-identify-matches">
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  مرشّحون — اختر للتأكيد:
                </Text>
                <List
                  size="small"
                  dataSource={matches}
                  renderItem={(row) => (
                    <List.Item
                      actions={[
                        <Button type="link" key="pick" onClick={() => void pickMatch(row)}>
                          تأكيد
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<UserOutlined />}
                        title={row.full_name}
                        description={
                          <Tag
                            color={
                              row.confidence >= FACE_STRONG_MATCH_THRESHOLD ? 'green' : 'blue'
                            }
                          >
                            ثقة {Math.round(row.confidence * 100)}%
                          </Tag>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ) : null}

            <Text type="secondary" style={{ fontSize: 11 }}>
              قبول تلقائي: ≥{Math.round(FACE_STRONG_MATCH_THRESHOLD * 100)}% + هامش ≥
              {Math.round(FACE_STRONG_MIN_MARGIN * 100)}% أو ≥{Math.round(FACE_AUTO_MATCH_THRESHOLD * 100)}%
              + {Math.round(FACE_MIN_MARGIN * 100)}%
            </Text>

            <Button block onClick={onClose}>
              إلغاء — اختيار يدوي
            </Button>
          </Space>
        </>
      )}
    </Modal>
  );
};

export default DialysisFaceIdentifyModal;
