import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
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
  Upload,
} from 'antd';
import { UserAddOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import {
  IQ_PROVINCE_OPTIONS,
  WEEKDAY_OPTIONS_AR,
  GENDER_OPTIONS,
  COUNTRY_OPTIONS,
} from './dialysisConstants';

const { Title, Text } = Typography;
const { TextArea } = Input;

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
  hospitalId: number | null;
  canCreate: boolean;
  /** card = غلاف Card كامل، plain = للعرض داخل Drawer */
  variant?: 'card' | 'plain';
  /** معرّف النموذج لزر الحفظ في تذييل الدرج */
  formId?: string;
  /** إخفاء زر الحفظ داخل النموذج (يُستخدم مع تذييل الدرج) */
  hideInlineSubmit?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onPatientCreated?: (id: number) => void;
}

function ageFromBirth(d: Dayjs | null): string {
  if (!d || !d.isValid()) return '—';
  const years = dayjs().diff(d, 'year');
  return `${years} سنة`;
}

const DialysisPatientIntakePanel: React.FC<Props> = ({
  hospitalId,
  canCreate,
  variant = 'card',
  formId = 'd-patient-intake-form',
  hideInlineSubmit = false,
  onLoadingChange,
  onPatientCreated,
}) => {
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocRow[]>([]);
  const [shiftByDay, setShiftByDay] = useState<Record<number, SlotRow[]>>({});
  const [birth, setBirth] = useState<Dayjs | null>(null);
  const [dialysisDays, setDialysisDays] = useState<number[]>([]);
  const [dayLoc, setDayLoc] = useState<Record<number, number | undefined>>({});
  const [dayShift, setDayShift] = useState<Record<number, number | undefined>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const locOptions = useMemo(
    () =>
      locations.map((l) => ({
        value: l.id,
        label: `${l.hallName} — سرير ${l.bedCode}`,
      })),
    [locations]
  );

  const loadLocs = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const { data } = await axios.get<LocRow[]>('/api/dialysis/locations', {
        params: { hospital_id: hospitalId },
      });
      setLocations(data);
    } catch {
      message.error('تعذر تحميل الأسرة');
    }
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

  useEffect(() => {
    loadLocs();
  }, [loadLocs]);

  useEffect(() => {
    if (dialysisDays.length) loadSlotsForDays(dialysisDays);
  }, [dialysisDays, loadSlotsForDays]);

  useEffect(() => {
    if (kind === 'EMERGENCY') {
      setDialysisDays([]);
      setDayLoc({});
      setDayShift({});
    }
  }, [kind]);

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
  };

  const submit = async () => {
    if (!hospitalId) {
      message.warning('اختر المستشفى');
      return;
    }
    try {
      const v = await form.validateFields();
      const k = v.kind === 'PERSISTENT' ? 'PERSISTENT' : 'EMERGENCY';

      const rows =
        k === 'PERSISTENT'
          ? dialysisDays.map((d) => ({
              day_of_week: d,
              location_id: dayLoc[d],
              shift_slot_id: dayShift[d],
            }))
          : [];

      if (k === 'PERSISTENT') {
        if (rows.length < 1) {
          message.error('اختر يوم غسل واحداً على الأقل مع القاعة والشفت');
          return;
        }
        for (const d of dialysisDays) {
          if (!dayLoc[d] || !dayShift[d]) {
            message.error(
              `أكمل القاعة/السرير والشفت لـ ${WEEKDAY_OPTIONS_AR.find((x) => x.value === d)?.label}`
            );
            return;
          }
        }
      }

      setLoading(true);
      onLoadingChange?.(true);
      const { data: patient } = await axios.post('/api/dialysis/patients', {
        hospital_id: hospitalId,
        full_name: v.full_name,
        gender: v.gender,
        kind: k,
        phone: v.phone || null,
        national_id: v.national_id || null,
        internal_record_number: v.internal_record_number || null,
        birth_date: v.birth_date ? v.birth_date.format('YYYY-MM-DD') : null,
        country_code: v.country_code || 'IQ',
        province_code: v.province_code || null,
        city: v.city || null,
        address_line: v.address_line || null,
        biometric_id: v.biometric_id || null,
        companion_name: v.companion_name || null,
        companion_phone: v.companion_phone || null,
        schedules: k === 'PERSISTENT' ? rows : [],
      });

      if (photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        await axios.post(`/api/dialysis/patients/${patient.id}/photo`, fd, {
          params: { hospital_id: hospitalId },
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      message.success('تم حفظ المريض' + (k === 'PERSISTENT' ? ' وجدول أيام الغسل' : ''));
      form.resetFields();
      form.setFieldsValue({ kind: 'EMERGENCY', country_code: 'IQ' });
      setDialysisDays([]);
      setDayLoc({});
      setDayShift({});
      setBirth(null);
      setPhotoFile(null);
      setFileList([]);
      onPatientCreated?.(patient.id);
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'فشل الحفظ');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  if (!hospitalId) {
    return (
      <Card>
        <Text type="secondary">اختر مستشفى ثم أدخل بيانات المريض.</Text>
      </Card>
    );
  }

  if (!canCreate) {
    return (
      <Card>
        <Text type="danger">لا تملك صلاحية إنشاء مريض غسيل.</Text>
      </Card>
    );
  }

  const body = (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        <strong>طوارئ:</strong> الاسم والهاتف والجنس والعنوان.
        <br />
        <strong>دائم:</strong> الاسم، تاريخ الميلاد، الجنس، المحافظة، المدينة، معرف البصمة (فريد)، الهاتف، هاتف
        المرافق، ويوم غسل واحد على الأقل مع صالة/سرير وشفت لكل يوم.
      </Text>

      <Form
        id={formId}
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ kind: 'EMERGENCY', country_code: 'IQ' }}
      >
        <Title level={5}>نوع المريض</Title>
        <Form.Item name="kind" label="النوع" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'EMERGENCY', label: 'طوارئ' },
              { value: 'PERSISTENT', label: 'دائم' },
            ]}
          />
        </Form.Item>

        <Divider />

        <Title level={5}>البيانات الأساسية</Title>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item name="full_name" label="الاسم الكامل" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="gender"
              label="الجنس"
              rules={[{ required: true, message: 'اختر الجنس' }]}
            >
              <Select options={GENDER_OPTIONS} placeholder="الجنس" />
            </Form.Item>
          </Col>

          {kind === 'PERSISTENT' && (
            <>
              <Col xs={24} md={12}>
                <Form.Item
                  name="birth_date"
                  label="تاريخ الميلاد"
                  rules={[{ required: true, message: 'تاريخ الميلاد مطلوب للمريض الدائم' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    onChange={(d) => setBirth(d)}
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={24}>
                <Text type="secondary">العمر المقدّر: {ageFromBirth(birth)}</Text>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="biometric_id"
                  label="معرف البصمة"
                  rules={[{ required: true, message: 'معرف البصمة إلزامي ولا يتكرر' }]}
                  extra="فريد لكل مريض ضمن نفس المستشفى"
                >
                  <Input placeholder="رقم أو كود البصمة" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="internal_record_number" label="معرف الملف / الرقم الداخلي">
                  <Input placeholder="اختياري" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="national_id" label="رقم الهوية / الوثيقة">
                  <Input />
                </Form.Item>
              </Col>
            </>
          )}
        </Row>

        {kind === 'EMERGENCY' && (
          <>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="هاتف المريض"
                  rules={[{ required: true, message: 'الهاتف مطلوب' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="address_line"
                  label="العنوان"
                  rules={[{ required: true, message: 'العنوان مطلوب للطوارئ' }]}
                >
                  <TextArea rows={2} placeholder="محلة، شارع، أقرب نقطة دالة" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {kind === 'PERSISTENT' && (
          <>
            <Divider />
            <Title level={5}>السكن والاتصال</Title>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item name="country_code" label="الدولة" rules={[{ required: true }]}>
                  <Select options={COUNTRY_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="province_code"
                  label="المحافظة"
                  rules={[{ required: true, message: 'اختر المحافظة' }]}
                >
                  <Select allowClear options={IQ_PROVINCE_OPTIONS} placeholder="المحافظة" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="city"
                  label="المدينة / القضاء"
                  rules={[{ required: true, message: 'المدينة مطلوبة' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="address_line" label="عنوان السكن التفصيلي">
                  <TextArea rows={2} placeholder="اختياري" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone"
                  label="هاتف المريض"
                  rules={[{ required: true, message: 'هاتف المريض مطلوب' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="companion_phone"
                  label="هاتف المرافق"
                  rules={[{ required: true, message: 'هاتف المرافق مطلوب' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="companion_name" label="اسم المرافق">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        <Divider />
        <Form.Item label="صورة شخصية (اختياري)">
          <Upload
            accept="image/*"
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              setPhotoFile(file);
              setFileList([
                {
                  uid: '-1',
                  name: file.name,
                  status: 'done',
                },
              ]);
              return false;
            }}
            onRemove={() => {
              setPhotoFile(null);
              setFileList([]);
            }}
          >
            <Button icon={<UploadOutlined />}>اختر صورة</Button>
          </Upload>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            تُرفع بعد إنشاء الملف تلقائياً.
          </Text>
        </Form.Item>

        {kind === 'PERSISTENT' && (
          <>
            <Divider />
            <Title level={5}>أيام الغسل في الأسبوع</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              يوم واحد على الأقل. لكل يوم: قاعة/سرير وشفت يتوافق مع ذلك اليوم.
            </Text>
            <Checkbox.Group
              options={WEEKDAY_OPTIONS_AR.map((o) => ({ label: o.label, value: o.value }))}
              value={dialysisDays}
              onChange={(v) => onDaysChange(v as number[])}
            />

            {[...dialysisDays].sort((a, b) => a - b).map((d) => (
              <Card
                key={d}
                size="small"
                style={{ marginTop: 12 }}
                title={WEEKDAY_OPTIONS_AR.find((x) => x.value === d)?.label}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Select
                    placeholder="القاعة — السرير"
                    style={{ width: '100%' }}
                    options={locOptions}
                    value={dayLoc[d]}
                    onChange={(x) => setDayLoc((s) => ({ ...s, [d]: x }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Select
                    placeholder="شفت الغسل"
                    style={{ width: '100%' }}
                    options={(shiftByDay[d] ?? []).map((s) => ({
                      value: s.id,
                      label: `${s.name} (${String(Math.floor(s.startMinutes / 60)).padStart(2, '0')}:${String(s.startMinutes % 60).padStart(2, '0')} – ${String(Math.floor(s.endMinutes / 60)).padStart(2, '0')}:${String(s.endMinutes % 60).padStart(2, '0')})`,
                    }))}
                    value={dayShift[d]}
                    onChange={(x) => setDayShift((s) => ({ ...s, [d]: x }))}
                  />
                </Space>
              </Card>
            ))}
          </>
        )}

        {!hideInlineSubmit ? (
          <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 24 }}>
            حفظ المريض
          </Button>
        ) : null}
      </Form>
    </>
  );

  if (variant === 'plain') {
    return body;
  }

  return (
    <Card
      title={
        <span>
          <UserAddOutlined /> إدخال مريض غسيل كلوي — البيانات وجدول الأسبوع
        </span>
      }
    >
      {body}
    </Card>
  );
};

export default DialysisPatientIntakePanel;
