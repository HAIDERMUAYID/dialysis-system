import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import {
  Button,
  DatePicker,
  Empty,
  Form,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { usePermission } from '../../../../../hooks/usePermission';
import { formatDialysisCalendarDate } from '../../../dialysisConstants';
import { DIALYSIS_FACE_ENABLED } from '../../../face/dialysisFaceConfig';
import { useDialysisContext, useEffectiveDialysisHospitalId } from '../../dialysisContext';
import { useDialysisMobile } from '../../useDialysisMobile';
import { useDialysisOverlayLock } from '../../useDialysisOverlayLock';
import DialysisPageHeader from '../../DialysisPageHeader';
import DialysisFaceMissingPrompt from '../../../face/DialysisFaceMissingPrompt';
import '../../dialysis-brand.css';
import BulkForm from './BulkForm';
import StatisticalBulkImportPanel from './StatisticalBulkImportPanel';
import { BULK_JSON_PLACEHOLDER, SHIFT_LABEL_AR, SHIFT_OPTIONS } from './reportsPageConstants';
import type { PatientLookupRow, ReconResult, StatEntryRow } from './reportsPageTypes';
import type { StatisticalBulkApiEntry } from './statisticalBulkImportTypes';
import { patientHasFaceEnrolled } from './reportsPageUtils';

const DialysisFaceEnrollModal = lazy(() => import('../../../face/DialysisFaceEnrollModal'));

const { Text, Title } = Typography;

export interface ReportsStatisticsPanelProps {
  onOverlayLockChange?: (locked: boolean) => void;
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
}

const ReportsStatisticsPanel: React.FC<ReportsStatisticsPanelProps> = ({
  onOverlayLockChange,
  onRegisterRefresh,
}) => {
  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const isMobile = useDialysisMobile();

  const canRecon = usePermission('dialysis:reconciliation');
  const canBulk = usePermission('dialysis:stats:bulk');
  const canStatsEntry = usePermission('dialysis:stats:entry');
  const canStatWrite = canStatsEntry || canBulk;
  const canEditPatient = usePermission('dialysis:patient:edit');

  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [result, setResult] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [listDate, setListDate] = useState<Dayjs>(() => dayjs().startOf('day'));
  const [statRows, setStatRows] = useState<StatEntryRow[]>([]);
  const [statLoading, setStatLoading] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [patientOptions, setPatientOptions] = useState<PatientLookupRow[]>([]);
  const [entryForm] = Form.useForm();

  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [faceEnrollQuickStart, setFaceEnrollQuickStart] = useState(false);
  const [faceEnrollTarget, setFaceEnrollTarget] = useState<{
    id: number;
    name: string;
    hasFaceEnrolled: boolean;
  } | null>(null);

  const faceHospitalId = effectiveHospitalId;

  useDialysisOverlayLock(isMobile && faceEnrollOpen);

  useEffect(() => {
    onOverlayLockChange?.(faceEnrollOpen);
  }, [faceEnrollOpen, onOverlayLockChange]);

  const loadStatEntries = useCallback(async () => {
    if (hospitalId == null || !canStatWrite) return;
    setStatLoading(true);
    try {
      const { data } = await axios.get<StatEntryRow[]>('/api/dialysis/statistical/entries', {
        params: {
          hospital_id: hospitalId,
          date: listDate.format('YYYY-MM-DD'),
        },
      });
      setStatRows(Array.isArray(data) ? data : []);
    } catch {
      message.error('فشل تحميل السجل الإحصائي');
    } finally {
      setStatLoading(false);
    }
  }, [hospitalId, listDate, canStatWrite]);

  const loadPatientOptions = useCallback(async (bulk = false) => {
    if (hospitalId == null || !canStatWrite) return;
    try {
      const { data } = await axios.get<PatientLookupRow[]>(
        '/api/dialysis/statistical/patient-lookup',
        {
          params: {
            hospital_id: hospitalId,
            ...(bulk ? { limit: 5000 } : {}),
          },
        }
      );
      setPatientOptions(Array.isArray(data) ? data : []);
    } catch {
      /* يُحمّل عند أول إضافة */
    }
  }, [hospitalId, canStatWrite]);

  useEffect(() => {
    loadStatEntries();
  }, [loadStatEntries]);

  useEffect(() => {
    if (canBulk) {
      void loadPatientOptions(true);
      return;
    }
    void loadPatientOptions();
  }, [canBulk, loadPatientOptions]);

  useEffect(() => {
    onRegisterRefresh?.(loadStatEntries);
  }, [loadStatEntries, onRegisterRefresh]);

  useEffect(() => {
    entryForm.setFieldsValue({ session_date: listDate });
  }, [listDate, entryForm]);

  const watchedEntryPatientId = Form.useWatch('dialysis_patient_id', entryForm);
  const selectedEntryPatient = useMemo(
    () => patientOptions.find((p) => p.id === watchedEntryPatientId),
    [patientOptions, watchedEntryPatientId]
  );
  const showEntryFaceMissing = Boolean(
    DIALYSIS_FACE_ENABLED &&
      canEditPatient &&
      canStatWrite &&
      selectedEntryPatient &&
      !patientHasFaceEnrolled(selectedEntryPatient)
  );

  const statisticsDefaultTab = useMemo(() => {
    if (canStatWrite) return 'stats';
    if (canRecon) return 'recon';
    if (canBulk) return 'bulk';
    return 'stats';
  }, [canStatWrite, canRecon, canBulk]);

  const openFaceEnrollForPatient = useCallback(
    (patient: PatientLookupRow, quickStart = false) => {
      setFaceEnrollTarget({
        id: patient.id,
        name: patient.fullName,
        hasFaceEnrolled: patientHasFaceEnrolled(patient),
      });
      setFaceEnrollQuickStart(quickStart);
      setFaceEnrollOpen(true);
    },
    []
  );

  const closeFaceEnroll = useCallback(() => {
    setFaceEnrollOpen(false);
    setFaceEnrollQuickStart(false);
    setFaceEnrollTarget(null);
  }, []);

  const handleFaceEnrolled = useCallback(() => {
    if (!faceEnrollTarget) return;
    const patientId = faceEnrollTarget.id;
    setPatientOptions((list) =>
      list.map((p) => (p.id === patientId ? { ...p, hasFaceEnrolled: true } : p))
    );
    setFaceEnrollTarget((prev) => (prev ? { ...prev, hasFaceEnrolled: true } : null));
  }, [faceEnrollTarget]);

  const submitStatEntry = async () => {
    if (hospitalId == null) return;
    const writeHid = typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId;
    if (writeHid == null) {
      message.error('اختر مستشفى محدداً لتسجيل الإحصاء.');
      return;
    }
    try {
      const v = await entryForm.validateFields();
      await axios.post('/api/dialysis/statistical/entry', {
        hospital_id: writeHid,
        dialysis_patient_id: v.dialysis_patient_id,
        session_date: (v.session_date as Dayjs).format('YYYY-MM-DD'),
        shift: v.shift || 'MORNING',
      });
      message.success('تم تسجيل الاسم في السجل الإحصائي');
      const createdPatient = patientOptions.find((p) => p.id === v.dialysis_patient_id);
      const shouldPromptFaceEnroll = Boolean(
        DIALYSIS_FACE_ENABLED &&
          canEditPatient &&
          faceHospitalId != null &&
          createdPatient &&
          !patientHasFaceEnrolled(createdPatient)
      );
      entryForm.resetFields();
      entryForm.setFieldsValue({
        session_date: listDate,
        shift: 'MORNING',
      });
      loadStatEntries();
      loadPatientOptions();
      if (shouldPromptFaceEnroll && createdPatient) {
        openFaceEnrollForPatient(createdPatient, true);
      }
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown; response?: { data?: { error?: string } } };
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'فشل الحفظ');
    }
  };

  const deleteStatEntry = (row: StatEntryRow) => {
    Modal.confirm({
      title: 'حذف هذا السطر من السجل الإحصائي؟',
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          const hid =
            typeof hospitalId === 'number'
              ? hospitalId
              : (row as { hospitalId?: number }).hospitalId ?? effectiveHospitalId;
          await axios.delete(`/api/dialysis/statistical/entries/${row.id}`, {
            params: hid ? { hospital_id: hid } : {},
          });
          message.success('تم الحذف');
          loadStatEntries();
        } catch {
          message.error('فشل الحذف');
        }
      },
    });
  };

  const run = async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ReconResult>('/api/dialysis/reconciliation', {
        params: {
          hospital_id: hospitalId,
          from: range[0].format('YYYY-MM-DD'),
          to: range[1].format('YYYY-MM-DD'),
        },
      });
      setResult(data);
      message.success('تم تشغيل المطابقة');
    } catch {
      message.error('فشل المطابقة');
    } finally {
      setLoading(false);
    }
  };

  const submitBulkEntries = async (entries: StatisticalBulkApiEntry[]) => {
    if (hospitalId == null) return;
    const writeHid = typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId;
    if (writeHid == null) {
      message.error('اختر مستشفى محدداً للإدخال الإحصائي الجماعي.');
      return;
    }
    setBulkSubmitting(true);
    try {
      await axios.post('/api/dialysis/statistical/bulk', {
        hospital_id: writeHid,
        entries,
      });
      message.success(`تم حفظ ${entries.length} سطر في السجل الإحصائي`);
      loadStatEntries();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'فشل الحفظ الجماعي');
      throw e;
    } finally {
      setBulkSubmitting(false);
    }
  };

  const submitBulk = async (raw: string) => {
    if (hospitalId == null) return;
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) {
        message.error('يجب أن يكون الجذر مصفوفة أو يحتوي entries');
        return;
      }
      await submitBulkEntries(entries as StatisticalBulkApiEntry[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'تحقق من صيغة JSON');
    }
  };

  return (
    <>
      <DialysisPageHeader
        title="الإحصاء والمطابقة"
        subtitle="الإحصاء: إدخال يدوي اسمًا اسمًا في السجل الإحصائي (مصدر ب) — منفصل عن جلسات قسم الحوكمة. المطابقة: في نهاية اليوم لمقارنة الميدان مع الإحصاء ومعرفة الفروقات."
      />
      {!canStatWrite && !canRecon && !canBulk ? (
        <div className="d-card">
          <Empty description="ليس لديك صلاحية الإحصاء أو المطابقة. راجع مسؤول النظام." />
        </div>
      ) : (
        <Tabs
          className="d-tabs-responsive"
          defaultActiveKey={statisticsDefaultTab}
          items={[
            {
              key: 'stats',
              label: 'الإحصاء اليومي',
              disabled: !canStatWrite,
              children: !canStatWrite ? (
                <div className="d-card">
                  <Empty description="ليس لديك صلاحية إدخال الإحصاء اليومي أو الجماعي. اطلب من المشرف تفعيلها من «إدارة الوصول»." />
                </div>
              ) : (
                <div className="d-card">
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    يختار موظف الإحصاء المريض والتاريخ والوردية ويضيف سطرًا إلى السجل الرسمي. هذه القائمة لا
                    تعرض جلسات نظام الحوكمة — المطابقة مع الجلسات تتم من تبويب «المطابقة» عند الحاجة.
                  </Text>

                  <Form
                    form={entryForm}
                    layout="vertical"
                    onFinish={submitStatEntry}
                    initialValues={{
                      session_date: listDate,
                      shift: 'MORNING',
                    }}
                    className={isMobile ? 'd-stat-entry-form--mobile' : undefined}
                  >
                    <div className={isMobile ? 'd-stat-entry-form__grid' : undefined}>
                      <Form.Item
                        name="dialysis_patient_id"
                        label="المريض"
                        rules={[{ required: true, message: 'اختر المريض' }]}
                        style={isMobile ? { width: '100%' } : { minWidth: 240, flex: 1 }}
                      >
                        <Select
                          showSearch
                          size={isMobile ? 'large' : undefined}
                          placeholder="ابحث واختر الاسم"
                          optionFilterProp="label"
                          listHeight={isMobile ? 280 : 256}
                          options={patientOptions.map((p) => ({
                            value: p.id,
                            label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})${
                              patientHasFaceEnrolled(p) ? '' : ' — بلا بصمة'
                            }`,
                          }))}
                          onDropdownVisibleChange={(open) => open && loadPatientOptions()}
                        />
                      </Form.Item>
                      {showEntryFaceMissing && selectedEntryPatient ? (
                        <DialysisFaceMissingPrompt
                          patient={selectedEntryPatient}
                          isMobile={isMobile}
                          onEnroll={() => openFaceEnrollForPatient(selectedEntryPatient, false)}
                          footerHint={
                            isMobile ? 'بعد الإضافة للسجل سيُفتح تسجيل الوجه تلقائياً' : undefined
                          }
                        />
                      ) : null}
                      <Form.Item
                        name="session_date"
                        label="تاريخ الغسل (في السجل الإحصائي)"
                        rules={[{ required: true }]}
                        style={isMobile ? { width: '100%' } : undefined}
                      >
                        <DatePicker
                          size={isMobile ? 'large' : undefined}
                          style={isMobile ? { width: '100%' } : undefined}
                          format="YYYY-MM-DD"
                        />
                      </Form.Item>
                      <Form.Item
                        name="shift"
                        label="الوردية"
                        rules={[{ required: true }]}
                        style={isMobile ? { width: '100%' } : undefined}
                      >
                        <Select
                          size={isMobile ? 'large' : undefined}
                          options={SHIFT_OPTIONS}
                          style={isMobile ? { width: '100%' } : { minWidth: 120 }}
                        />
                      </Form.Item>
                      <Form.Item
                        label={isMobile ? undefined : ' '}
                        style={isMobile ? { width: '100%' } : undefined}
                      >
                        <Button
                          type="primary"
                          htmlType="submit"
                          size={isMobile ? 'large' : undefined}
                          block={isMobile}
                          icon={<PlusOutlined />}
                        >
                          إضافة للسجل
                        </Button>
                      </Form.Item>
                    </div>
                  </Form>

                  <div className="d-toolbar">
                    <Text strong>عرض السجل لتاريخ:</Text>
                    <DatePicker
                      value={listDate}
                      onChange={(d) => d && setListDate(d.startOf('day'))}
                      format="YYYY-MM-DD"
                    />
                    <span className="grow" />
                    <Button icon={<ReloadOutlined />} onClick={loadStatEntries} loading={statLoading}>
                      تحديث القائمة
                    </Button>
                  </div>

                  <div className="d-table-scroll">
                    <Table<StatEntryRow>
                      rowKey="id"
                      loading={statLoading}
                      dataSource={statRows}
                      locale={{
                        emptyText: (
                          <Empty description="لا توجد إدخالات إحصائية لهذا التاريخ — أضف اسمًا من النموذج أعلاه" />
                        ),
                      }}
                      pagination={{ pageSize: 20, showTotal: (t) => `${t} سطرًا` }}
                      columns={[
                        {
                          title: 'اسم المريض',
                          key: 'name',
                          ellipsis: true,
                          render: (_, r) => r.dialysisPatient?.fullName ?? '—',
                        },
                        {
                          title: 'التاريخ',
                          dataIndex: 'sessionDate',
                          width: 130,
                          render: (d: string) => formatDialysisCalendarDate(d),
                        },
                        {
                          title: 'الوردية',
                          dataIndex: 'shift',
                          width: 100,
                          render: (s: string) => SHIFT_LABEL_AR[s] ?? s,
                        },
                        {
                          title: '',
                          key: 'del',
                          width: 90,
                          render: (_, r) => (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => deleteStatEntry(r)}
                            >
                              حذف
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'recon',
              label: 'المطابقة (نهاية اليوم)',
              disabled: !canRecon,
              children: (
                <div className="d-card">
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    مقارنة جلسات الميدان (الحوكمة) مع السجل الإحصائي الذي أُدخل يدويًا — لتفسير الفروقات بعد
                    انتهاء الدوام.
                  </Text>
                  <div className="d-toolbar">
                    <Text>الفترة:</Text>
                    <DatePicker.RangePicker
                      value={range}
                      onChange={(v) => v && setRange(v as [Dayjs, Dayjs])}
                      style={{ width: '100%', maxWidth: 360 }}
                    />
                    <Button type="primary" icon={<ReloadOutlined />} onClick={run} loading={loading}>
                      تشغيل المقارنة
                    </Button>
                  </div>

                  {result && (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <div>
                        <Title level={5}>مجلدات ناقصة في الإحصاء</Title>
                        <div className="d-table-scroll d-table-scroll--compact">
                          <Table
                            size="small"
                            rowKey={(r: Record<string, unknown>) =>
                              `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                            }
                            dataSource={result.missed_folders || []}
                            columns={[
                              { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                              {
                                title: 'التاريخ',
                                dataIndex: 'sessionDate',
                                key: 'd',
                                render: (d: string) => formatDialysisCalendarDate(d),
                              },
                              { title: 'الوردية', dataIndex: 'shift', key: 's' },
                            ]}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                          />
                        </div>
                      </div>

                      <div>
                        <Title level={5}>جلسات شبح (في الإحصاء فقط)</Title>
                        <div className="d-table-scroll d-table-scroll--compact">
                          <Table
                            size="small"
                            rowKey={(r: Record<string, unknown>) =>
                              `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                            }
                            dataSource={result.ghost_sessions || []}
                            columns={[
                              { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                              {
                                title: 'التاريخ',
                                dataIndex: 'sessionDate',
                                key: 'd',
                                render: (d: string) => formatDialysisCalendarDate(d),
                              },
                              { title: 'الوردية', dataIndex: 'shift', key: 's' },
                            ]}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                          />
                        </div>
                      </div>

                      <div>
                        <Title level={5}>فروق المواد</Title>
                        <div className="d-table-scroll">
                          <Table
                            size="small"
                            rowKey={(r: Record<string, unknown>) =>
                              `${r.dialysisPatientId}-${r.item_id}`
                            }
                            dataSource={result.supply_discrepancies || []}
                            columns={[
                              { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                              { title: 'المادة', dataIndex: 'item_id', key: 'i' },
                              { title: 'حقل', dataIndex: 'quantity_field', key: 'qf' },
                              { title: 'إحصاء', dataIndex: 'quantity_stats', key: 'qs' },
                              { title: 'فرق', dataIndex: 'delta', key: 'd' },
                            ]}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                          />
                        </div>
                      </div>
                    </Space>
                  )}
                </div>
              ),
            },
            {
              key: 'bulk',
              label: 'إدخال جماعي',
              disabled: !canBulk,
              children: (
                <div className="d-card">
                  <StatisticalBulkImportPanel
                    patients={patientOptions}
                    loadingPatients={statLoading}
                    onReloadPatients={() => loadPatientOptions(true)}
                    onSubmit={submitBulkEntries}
                    submitting={bulkSubmitting}
                  />

                  <Text type="secondary" style={{ display: 'block', margin: '24px 0 8px' }}>
                    JSON متقدم (للمطورين — يدعم consumptions):
                  </Text>
                  <BulkForm placeholder={BULK_JSON_PLACEHOLDER} onSubmit={submitBulk} />
                </div>
              ),
            },
          ]}
        />
      )}

      {DIALYSIS_FACE_ENABLED && faceHospitalId != null && faceEnrollTarget ? (
        <Suspense fallback={null}>
          <DialysisFaceEnrollModal
            open={faceEnrollOpen}
            onClose={closeFaceEnroll}
            patientId={faceEnrollTarget.id}
            hospitalId={faceHospitalId}
            patientName={faceEnrollTarget.name}
            hasFaceEnrolled={faceEnrollTarget.hasFaceEnrolled}
            quickStart={faceEnrollQuickStart}
            sessionHint={
              faceEnrollQuickStart
                ? isMobile
                  ? 'تمت الإضافة للسجل ✓ — أكمل تسجيل الوجه (خطوة واحدة).'
                  : 'تمت الإضافة للسجل — أكمل تسجيل الوجه للمريض (خطوة واحدة سريعة).'
                : undefined
            }
            onEnrolled={handleFaceEnrolled}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default ReportsStatisticsPanel;
