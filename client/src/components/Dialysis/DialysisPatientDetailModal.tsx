import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  message,
  Divider,
  Row,
  Col,
  Checkbox,
  Card,
  Collapse,
  InputNumber,
  Upload,
  Avatar,
  Tag,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, UploadOutlined, ScanOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  IQ_PROVINCE_OPTIONS,
  WEEKDAY_OPTIONS_AR,
  VASCULAR_ACCESS_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  COUNTRY_OPTIONS,
} from './dialysisConstants';
import { useDialysisMobile } from './app/useDialysisMobile';
import { useDialysisOverlayLock } from './app/useDialysisOverlayLock';
import { DIALYSIS_FACE_ENABLED } from './face/dialysisFaceConfig';

const DialysisFaceEnrollModal = lazy(() => import('./face/DialysisFaceEnrollModal'));

const { Text } = Typography;
const { TextArea } = Input;

interface PatientApi {
  id: number;
  fullName: string;
  kind: string;
  gender?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  biometricId?: string | null;
  photoUrl?: string | null;
  faceEnrolledAt?: string | null;
  hasFaceEnrolled?: boolean;
  countryCode?: string | null;
  internalRecordNumber?: string | null;
  birthDate?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  addressLine?: string | null;
  companionName?: string | null;
  companionPhone?: string | null;
  bloodGroup?: string | null;
  notes?: string | null;
  viralMarkersJson?: unknown;
  dialysisStartDate?: string | null;
  kidneyFailureCause?: string | null;
  vascularAccessType?: string | null;
  vascularAccessSite?: string | null;
  vascularAccessNote?: string | null;
  targetDryWeightKg?: string | null;
  sessionsPerWeek?: number | null;
  sessionDurationMinutes?: number | null;
  dialyzerModelDefault?: string | null;
  bloodFlowTargetMlMin?: number | null;
  anticoagulantStandard?: string | null;
  labsFollowUpJson?: unknown;
}

interface ScheduleRow {
  dayOfWeek: number;
  shiftSlotId: number;
  locationId: number;
  shiftSlot?: { id: number; name: string };
  location?: { id: number; hallName: string; bedCode: string };
}

interface LocRow {
  id: number;
  hallName: string;
  bedCode: string;
}

interface SlotRow {
  id: number;
  weekday: number;
  name: string;
  startMinutes: number;
  endMinutes: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: number | null;
  hospitalId: number | null;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: () => void;
}

const DialysisPatientDetailModal: React.FC<Props> = ({
  open,
  onClose,
  patientId,
  hospitalId,
  canEdit,
  canDelete,
  onSaved,
}) => {
  const isMobile = useDialysisMobile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  useDialysisOverlayLock(isMobile && (open || faceEnrollOpen));
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocRow[]>([]);
  const [shiftByDay, setShiftByDay] = useState<Record<number, SlotRow[]>>({});
  const [dialysisDays, setDialysisDays] = useState<number[]>([]);
  const [dayLoc, setDayLoc] = useState<Record<number, number | undefined>>({});
  const [dayShift, setDayShift] = useState<Record<number, number | undefined>>({});

  const loadSchedContext = useCallback(async () => {
    if (!hospitalId) return;
    const { data: locs } = await axios.get<LocRow[]>('/api/dialysis/locations', {
      params: { hospital_id: hospitalId },
    });
    setLocations(locs);
  }, [hospitalId]);

  const loadSlotsForDays = useCallback(
    async (days: number[]) => {
      if (!hospitalId) return;
      const next: Record<number, SlotRow[]> = {};
      for (const d of days) {
        try {
          const { data } = await axios.get<SlotRow[]>('/api/dialysis/shift-slots', {
            params: { hospital_id: hospitalId, weekday: d },
          });
          next[d] = data;
        } catch {
          next[d] = [];
        }
      }
      setShiftByDay(next);
    },
    [hospitalId]
  );

  const loadPatient = useCallback(async () => {
    if (!patientId || !hospitalId || !open) return;
    setLoading(true);
    try {
      await loadSchedContext();
      const [{ data: p }, { data: sched }] = await Promise.all([
        axios.get<PatientApi>(`/api/dialysis/patients/${patientId}`, {
          params: { hospital_id: hospitalId },
        }),
        axios.get<ScheduleRow[]>(`/api/dialysis/patients/${patientId}/schedules`, {
          params: { hospital_id: hospitalId },
        }),
      ]);
      const labsRaw = Array.isArray(p.labsFollowUpJson) ? p.labsFollowUpJson : [];
      const labsMapped = labsRaw.map((row: Record<string, unknown>) => ({
        ...row,
        measured_at: row.measured_at ? dayjs(String(row.measured_at)) : undefined,
      }));
      form.setFieldsValue({
        full_name: p.fullName,
        gender: p.gender ?? undefined,
        biometric_id: p.biometricId ?? undefined,
        country_code: p.countryCode ?? 'IQ',
        internal_record_number: p.internalRecordNumber,
        national_id: p.nationalId,
        birth_date: p.birthDate ? dayjs(p.birthDate) : undefined,
        province_code: p.provinceCode,
        city: p.city,
        address_line: p.addressLine,
        phone: p.phone,
        companion_phone: p.companionPhone,
        companion_name: p.companionName,
        kind: p.kind,
        blood_group: p.bloodGroup ?? undefined,
        notes: p.notes ?? undefined,
        viral_markers_json:
          p.viralMarkersJson !== undefined && p.viralMarkersJson !== null
            ? JSON.stringify(p.viralMarkersJson, null, 2)
            : undefined,
        dialysis_start_date: p.dialysisStartDate ? dayjs(p.dialysisStartDate) : undefined,
        kidney_failure_cause: p.kidneyFailureCause ?? undefined,
        vascular_access_type: p.vascularAccessType ?? undefined,
        vascular_access_site: p.vascularAccessSite ?? undefined,
        vascular_access_note: p.vascularAccessNote ?? undefined,
        target_dry_weight_kg: p.targetDryWeightKg != null ? Number(p.targetDryWeightKg) : undefined,
        sessions_per_week: p.sessionsPerWeek ?? undefined,
        session_duration_minutes: p.sessionDurationMinutes ?? undefined,
        dialyzer_model_default: p.dialyzerModelDefault ?? undefined,
        blood_flow_target_ml_min: p.bloodFlowTargetMlMin ?? undefined,
        anticoagulant_standard: p.anticoagulantStandard ?? undefined,
        labs_follow_up: labsMapped.length ? labsMapped : [],
      });
      const days: number[] = [];
      const dl: Record<number, number> = {};
      const ds: Record<number, number> = {};
      for (const s of sched) {
        days.push(s.dayOfWeek);
        dl[s.dayOfWeek] = s.locationId;
        ds[s.dayOfWeek] = s.shiftSlotId;
      }
      const uDays = Array.from(new Set(days));
      setDialysisDays(uDays);
      setDayLoc(dl);
      setDayShift(ds);
      setAvatarUrl(p.photoUrl || null);
      setHasFaceEnrolled(Boolean(p.hasFaceEnrolled || p.faceEnrolledAt));
      setPatientName(p.fullName || '');
      if (uDays.length) await loadSlotsForDays(uDays);
    } catch {
      message.error('تعذر تحميل الملف');
    } finally {
      setLoading(false);
    }
  }, [patientId, hospitalId, open, form, loadSchedContext, loadSlotsForDays]);

  useEffect(() => {
    if (open && patientId) loadPatient();
  }, [open, patientId, loadPatient]);

  const onDaysChange = (vals: number[]) => {
    setDialysisDays(vals);
    setDayLoc((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => {
        if (!vals.includes(Number(k))) delete n[Number(k)];
      });
      return n;
    });
    setDayShift((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => {
        if (!vals.includes(Number(k))) delete n[Number(k)];
      });
      return n;
    });
    if (vals.length) loadSlotsForDays(vals);
  };

  const saveAll = async () => {
    if (!patientId || !hospitalId) return;
    try {
      const v = await form.validateFields();
      if (v.kind === 'PERSISTENT') {
        if (!dialysisDays.length) {
          message.error('المريض الدائم يحتاج يوم غسل واحد على الأقل مع القاعة والشفت');
          return;
        }
        for (const d of dialysisDays) {
          if (!dayLoc[d] || !dayShift[d]) {
            message.error(`أكمل السرير والشفت لـ ${WEEKDAY_OPTIONS_AR.find((x) => x.value === d)?.label}`);
            return;
          }
        }
      }
      setLoading(true);
      let viralMarkersPayload: unknown = undefined;
      if (v.viral_markers_json !== undefined && v.viral_markers_json !== null) {
        const s = String(v.viral_markers_json).trim();
        if (!s) {
          viralMarkersPayload = null;
        } else {
          try {
            viralMarkersPayload = JSON.parse(s);
          } catch {
            message.error('صيغة JSON للعلامات الفيروسية غير صحيحة');
            setLoading(false);
            return;
          }
        }
      }
      const labsPayload = (v.labs_follow_up || [])
        .filter((row: { measured_at?: unknown }) => row?.measured_at)
        .map(
          (row: {
            measured_at: { format: (s: string) => string };
            hemoglobin?: number;
            creatinine?: number;
            phosphorus?: number;
            note?: string;
          }) => ({
            measured_at: row.measured_at.format('YYYY-MM-DD'),
            hemoglobin: row.hemoglobin ?? null,
            creatinine: row.creatinine ?? null,
            phosphorus: row.phosphorus ?? null,
            note: row.note ?? null,
          })
        );
      const scheduleRows =
        v.kind === 'PERSISTENT'
          ? dialysisDays.map((d) => ({
              day_of_week: d,
              location_id: dayLoc[d],
              shift_slot_id: dayShift[d],
            }))
          : [];

      // جدول الغسل يُحفظ أولاً — الخادم يتحقق من وجوده عند تحديث مريض دائم
      if (v.kind === 'PERSISTENT') {
        await axios.put(`/api/dialysis/patients/${patientId}/schedules`, {
          hospital_id: hospitalId,
          rows: scheduleRows,
        });
      }

      await axios.patch(`/api/dialysis/patients/${patientId}`, {
        hospital_id: hospitalId,
        full_name: v.full_name,
        gender: v.gender || null,
        biometric_id: v.biometric_id || null,
        country_code: v.country_code || null,
        internal_record_number: v.internal_record_number || null,
        national_id: v.national_id || null,
        birth_date: v.birth_date ? v.birth_date.format('YYYY-MM-DD') : null,
        province_code: v.province_code || null,
        city: v.city || null,
        address_line: v.address_line || null,
        phone: v.phone || null,
        companion_name: v.companion_name || null,
        companion_phone: v.companion_phone || null,
        kind: v.kind,
        blood_group: v.blood_group || null,
        notes: v.notes || null,
        viral_markers_json: viralMarkersPayload,
        dialysis_start_date: v.dialysis_start_date ? v.dialysis_start_date.format('YYYY-MM-DD') : null,
        kidney_failure_cause: v.kidney_failure_cause || null,
        vascular_access_type: v.vascular_access_type || null,
        vascular_access_site: v.vascular_access_site || null,
        vascular_access_note: v.vascular_access_note || null,
        target_dry_weight_kg: v.target_dry_weight_kg ?? null,
        sessions_per_week: v.sessions_per_week ?? null,
        session_duration_minutes: v.session_duration_minutes ?? null,
        dialyzer_model_default: v.dialyzer_model_default || null,
        blood_flow_target_ml_min: v.blood_flow_target_ml_min ?? null,
        anticoagulant_standard: v.anticoagulant_standard || null,
        labs_follow_up_json: labsPayload.length ? labsPayload : null,
      });

      if (v.kind !== 'PERSISTENT') {
        await axios.put(`/api/dialysis/patients/${patientId}/schedules`, {
          hospital_id: hospitalId,
          rows: [],
        });
      }
      message.success('تم حفظ الملف والجدول');
      onSaved();
      onClose();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'فشل الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const removePatient = () => {
    if (!patientId || !hospitalId) return;
    Modal.confirm({
      title: 'حذف المريض نهائياً؟',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/dialysis/patients/${patientId}`, {
            params: { hospital_id: hospitalId },
          });
          message.success('تم الحذف');
          onSaved();
          onClose();
        } catch {
          message.error('تعذر الحذف');
        }
      },
    });
  };

  const locOptions = locations.map((l) => ({
    value: l.id,
    label: `${l.hallName} — سرير ${l.bedCode}`,
  }));

  return (
    <Modal
      title={`ملف مريض غسيل ${patientId ? `#${patientId}` : ''}`}
      open={open}
      onCancel={onClose}
      width={isMobile ? '100%' : 920}
      centered={!isMobile}
      zIndex={isMobile ? 1310 : 1000}
      className={isMobile ? 'd-patient-detail-modal--mobile' : undefined}
      styles={{
        body: {
          maxHeight: isMobile ? 'calc(100dvh - 140px - env(safe-area-inset-bottom))' : 'calc(100vh - 160px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      }}
      footer={
        canEdit ? (
          <Space wrap>
            <Button onClick={onClose}>إغلاق</Button>
            <Button type="primary" loading={loading} onClick={saveAll}>
              حفظ التعديلات
            </Button>
            {canDelete && (
              <Button danger onClick={removePatient}>
                حذف المريض
              </Button>
            )}
          </Space>
        ) : (
          <Button onClick={onClose}>إغلاق</Button>
        )
      }
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={!canEdit}>
        <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Avatar size={88} src={avatarUrl || undefined} style={{ background: '#f0f0f0' }}>
              {!avatarUrl && '?'}
            </Avatar>
          </Col>
          {canEdit && patientId && (
            <Col flex="auto">
              <Space direction="vertical" size="small" wrap>
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={async (file) => {
                    try {
                      const fd = new FormData();
                      fd.append('photo', file as File);
                      await axios.post(`/api/dialysis/patients/${patientId}/photo`, fd, {
                        params: { hospital_id: hospitalId },
                        headers: { 'Content-Type': 'multipart/form-data' },
                      });
                      setAvatarUrl(URL.createObjectURL(file as Blob));
                      message.success('تم تحديث الصورة');
                    } catch {
                      message.error('فشل رفع الصورة');
                    }
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>رفع / تغيير الصورة</Button>
                </Upload>
                {DIALYSIS_FACE_ENABLED && hospitalId != null && (
                  <Space wrap>
                    {hasFaceEnrolled ? (
                      <Tag color="success">الوجه مسجّل</Tag>
                    ) : (
                      <Tag>الوجه غير مسجّل</Tag>
                    )}
                    <Button icon={<ScanOutlined />} onClick={() => setFaceEnrollOpen(true)}>
                      {hasFaceEnrolled ? 'إعادة تسجيل الوجه' : 'تسجيل بصمة الوجه'}
                    </Button>
                  </Space>
                )}
              </Space>
            </Col>
          )}
        </Row>
        <Collapse
          defaultActiveKey={['admin', 'clinical', 'labs']}
          items={[
            {
              key: 'admin',
              label: 'البيانات الإدارية والتواصل',
              children: (
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Form.Item name="full_name" label="الاسم" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="gender" label="الجنس">
                      <Select allowClear options={GENDER_OPTIONS} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="biometric_id"
                      label="معرف البصمة (جهاز قديم)"
                      extra="اختياري — يمكن استبداله بـ «تسجيل بصمة الوجه» أعلاه"
                    >
                      <Input placeholder="معرف البصمة" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="country_code" label="الدولة">
                      <Select options={COUNTRY_OPTIONS} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="internal_record_number" label="معرف الملف">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="national_id" label="رقم الهوية">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="birth_date" label="تاريخ الميلاد">
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="blood_group" label="فصيلة الدم">
                      <Select allowClear options={BLOOD_GROUP_OPTIONS} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="province_code" label="المحافظة">
                      <Select allowClear options={IQ_PROVINCE_OPTIONS} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="city" label="المدينة">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="address_line" label="العنوان">
                      <TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="phone" label="هاتف المريض">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="companion_phone" label="هاتف المرافق">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item name="companion_name" label="اسم المرافق">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="kind" label="النوع">
                      <Select
                        options={[
                          { value: 'EMERGENCY', label: 'طوارئ' },
                          { value: 'PERSISTENT', label: 'دائم' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="notes" label="ملاحظات عامة">
                      <TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'clinical',
              label: 'الطب السريري — الوصول الوعائي والوصفة',
              children: (
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Form.Item name="dialysis_start_date" label="تاريخ بدء برنامج الغسيل">
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="kidney_failure_cause" label="خلفية / سبب الفشل الكلوي">
                      <TextArea rows={2} placeholder="قصير — للتواصل مع الطبيب المعالج" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="vascular_access_type" label="نوع الوصول الوعائي">
                      <Select allowClear options={VASCULAR_ACCESS_OPTIONS} placeholder="اختر" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="vascular_access_site" label="موقع الوصول (يد، رقبة...)">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="vascular_access_note" label="تفاصيل الوصول / مشاكل السابقات">
                      <TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="target_dry_weight_kg" label="الوزن الجاف المستهدف (كغ)">
                      <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="sessions_per_week" label="جلسات أسبوعياً">
                      <InputNumber min={0} max={21} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="session_duration_minutes" label="مدة الجلسة (دقيقة)">
                      <InputNumber min={0} max={600} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="dialyzer_model_default" label="غشاء / جهاز ترشيح اعتيادي">
                      <Input placeholder="موديل الغشاء أو الجهاز" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="blood_flow_target_ml_min" label="تدفق دم مستهدف (مل/د)">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="anticoagulant_standard" label="مضاد تخثر اعتيادي (هيبارين، لموز...)">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="viral_markers_json"
                      label="علامات فيروسية (JSON مرن — يُقرأ من التحاليل)"
                      tooltip='مثال: {"HBsAg":"negative","antiHCV":"positive"}'
                    >
                      <TextArea rows={2} placeholder="{}" />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'labs',
              label: 'متابعة مخبرية (جدول)',
              children: (
                <Form.List name="labs_follow_up">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Space key={key} align="baseline" wrap style={{ marginBottom: 8 }}>
                          <Form.Item {...rest} name={[name, 'measured_at']} label="تاريخ">
                            <DatePicker format="YYYY-MM-DD" />
                          </Form.Item>
                          <Form.Item {...rest} name={[name, 'hemoglobin']} label="هيموغلوبين g/dL">
                            <InputNumber min={0} step={0.1} />
                          </Form.Item>
                          <Form.Item {...rest} name={[name, 'creatinine']} label="كرياتينين mg/dL">
                            <InputNumber min={0} step={0.01} />
                          </Form.Item>
                          <Form.Item {...rest} name={[name, 'phosphorus']} label="فوسفور mg/dL">
                            <InputNumber min={0} step={0.01} />
                          </Form.Item>
                          <Form.Item {...rest} name={[name, 'note']} label="ملاحظة">
                            <Input style={{ width: 160 }} />
                          </Form.Item>
                          <MinusCircleOutlined onClick={() => remove(name)} />
                        </Space>
                      ))}
                      <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                        إضافة صف فحوصات
                      </Button>
                    </>
                  )}
                </Form.List>
              ),
            },
          ]}
        />
      </Form>

      {canEdit && (
        <>
          <Divider>جدول أيام الغسل</Divider>
          <Checkbox.Group
            options={WEEKDAY_OPTIONS_AR.map((o) => ({ label: o.label, value: o.value }))}
            value={dialysisDays}
            onChange={(v) => onDaysChange(v as number[])}
          />
          {[...dialysisDays].sort((a, b) => a - b).map((d) => (
            <Card key={d} size="small" style={{ marginTop: 8 }} title={WEEKDAY_OPTIONS_AR.find((x) => x.value === d)?.label}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  placeholder="السرير"
                  style={{ width: '100%' }}
                  options={locOptions}
                  value={dayLoc[d]}
                  onChange={(x) => setDayLoc((s) => ({ ...s, [d]: x }))}
                  disabled={!canEdit}
                />
                <Select
                  placeholder="الشفت"
                  style={{ width: '100%' }}
                  options={(shiftByDay[d] ?? []).map((s) => ({
                    value: s.id,
                    label: `${s.name} (${String(Math.floor(s.startMinutes / 60)).padStart(2, '0')}:${String(s.startMinutes % 60).padStart(2, '0')})`,
                  }))}
                  value={dayShift[d]}
                  onChange={(x) => setDayShift((s) => ({ ...s, [d]: x }))}
                  disabled={!canEdit}
                />
              </Space>
            </Card>
          ))}
        </>
      )}

      {DIALYSIS_FACE_ENABLED && patientId && hospitalId != null && (
        <Suspense fallback={null}>
          <DialysisFaceEnrollModal
            open={faceEnrollOpen}
            onClose={() => setFaceEnrollOpen(false)}
            patientId={patientId}
            hospitalId={hospitalId}
            patientName={patientName || `#${patientId}`}
            hasFaceEnrolled={hasFaceEnrolled}
            onEnrolled={() => {
              setHasFaceEnrolled(true);
              void loadPatient();
            }}
          />
        </Suspense>
      )}
    </Modal>
  );
};

export default DialysisPatientDetailModal;
