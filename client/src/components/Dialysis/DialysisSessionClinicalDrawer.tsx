import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Table,
  Select,
  Divider,
  message,
  Spin,
  Row,
  Col,
  DatePicker,
} from 'antd';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useDialysisMobile } from './app/useDialysisMobile';

const { Text } = Typography;
const { TextArea } = Input;

interface SessionDetail {
  id: number;
  sessionDate: string;
  shift: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  preSystolic?: number | null;
  preDiastolic?: number | null;
  postSystolic?: number | null;
  postDiastolic?: number | null;
  weightPreKg?: string | null;
  weightPostKg?: string | null;
  ufGoalMl?: number | null;
  heartRatePre?: number | null;
  heartRatePost?: number | null;
  temperaturePreC?: string | null;
  temperaturePostC?: string | null;
  bloodFlowMlMin?: number | null;
  ktV?: string | null;
  complicationsNote?: string | null;
  nursingNote?: string | null;
  notes?: string | null;
  dialysisPatient?: { fullName: string; id: number };
  location?: { hallName: string; bedCode: string } | null;
  machine?: { assetTag?: string | null; id: number } | null;
  shiftSlot?: { name: string } | null;
  consumptions?: Array<{
    id: number;
    quantityBase: string | number;
    displayUnitCode?: string | null;
    item?: { name: string };
    warehouse?: { name: string };
    batch?: { lotNumber?: string | null };
  }>;
}

interface ItemOpt {
  id: number;
  name: string;
  baseUnitLabel: string;
  drugCatalogId?: number | null;
}

interface WarehouseOpt {
  id: number;
  name: string;
  type: string;
}

interface BatchOpt {
  id: number;
  quantityRemainingBase: string | number;
  lotNumber?: string | null;
  expiryDate?: string | null;
}

interface Props {
  open: boolean;
  sessionId: number | null;
  hospitalId: number | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const DialysisSessionClinicalDrawer: React.FC<Props> = ({
  open,
  sessionId,
  hospitalId,
  canEdit,
  onClose,
  onSaved,
}) => {
  const isMobile = useDialysisMobile();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [consWarehouse, setConsWarehouse] = useState<number | undefined>();
  const [consItem, setConsItem] = useState<number | undefined>();
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [consQty, setConsQty] = useState<number | undefined>();
  const [consBatch, setConsBatch] = useState<number | undefined>();

  const loadRefs = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const [wh, it] = await Promise.all([
        axios.get<WarehouseOpt[]>('/api/dialysis/warehouses', { params: { hospital_id: hospitalId } }),
        axios.get<ItemOpt[]>('/api/dialysis/items', { params: { hospital_id: hospitalId } }),
      ]);
      setWarehouses(wh.data);
      setItems(it.data);
      setConsWarehouse((prev) => {
        if (prev && wh.data.some((w) => w.id === prev)) return prev;
        const general = wh.data.find((w) => w.type === 'GENERAL_MEDICAL');
        return general?.id ?? wh.data[0]?.id;
      });
    } catch {
      /* ignore */
    }
  }, [hospitalId]);

  const loadSession = useCallback(async () => {
    if (!sessionId || !hospitalId || !open) return;
    setLoading(true);
    try {
      await loadRefs();
      const { data } = await axios.get<SessionDetail>(`/api/dialysis/sessions/${sessionId}`, {
        params: { hospital_id: hospitalId },
      });
      setDetail(data);
      form.setFieldsValue({
        pre_systolic: data.preSystolic ?? undefined,
        pre_diastolic: data.preDiastolic ?? undefined,
        post_systolic: data.postSystolic ?? undefined,
        post_diastolic: data.postDiastolic ?? undefined,
        weight_pre_kg: data.weightPreKg != null ? Number(data.weightPreKg) : undefined,
        weight_post_kg: data.weightPostKg != null ? Number(data.weightPostKg) : undefined,
        uf_goal_ml: data.ufGoalMl ?? undefined,
        heart_rate_pre: data.heartRatePre ?? undefined,
        heart_rate_post: data.heartRatePost ?? undefined,
        temperature_pre_c: data.temperaturePreC != null ? Number(data.temperaturePreC) : undefined,
        temperature_post_c: data.temperaturePostC != null ? Number(data.temperaturePostC) : undefined,
        blood_flow_ml_min: data.bloodFlowMlMin ?? undefined,
        kt_v: data.ktV != null ? Number(data.ktV) : undefined,
        complications_note: data.complicationsNote ?? undefined,
        nursing_note: data.nursingNote ?? undefined,
        notes: data.notes ?? undefined,
        ended_at: data.endedAt ? dayjs(data.endedAt) : undefined,
      });
    } catch {
      message.error('تعذر تحميل الجلسة');
    } finally {
      setLoading(false);
    }
  }, [sessionId, hospitalId, open, form, loadRefs]);

  useEffect(() => {
    if (open && sessionId) loadSession();
  }, [open, sessionId, loadSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!consWarehouse || !consItem || !hospitalId) {
        setBatches([]);
        return;
      }
      try {
        const { data } = await axios.get<BatchOpt[]>('/api/dialysis/inventory/batches', {
          params: {
            hospital_id: hospitalId,
            warehouse_id: consWarehouse,
            item_id: consItem,
          },
        });
        if (!cancelled) setBatches(data);
      } catch {
        if (!cancelled) setBatches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consWarehouse, consItem, hospitalId]);

  const selectedWarehouse = warehouses.find((w) => w.id === consWarehouse);
  const consumptionItems = items.filter((i) => {
    if (selectedWarehouse?.type === 'PHARMACY') return i.drugCatalogId != null;
    if (selectedWarehouse?.type === 'GENERAL_MEDICAL') return !i.drugCatalogId;
    return true;
  });

  useEffect(() => {
    if (consItem && !consumptionItems.some((i) => i.id === consItem)) {
      setConsItem(undefined);
      setConsBatch(undefined);
    }
  }, [consItem, consumptionItems]);

  const saveClinical = async () => {
    if (!sessionId || !hospitalId || !canEdit) return;
    try {
      const v = await form.validateFields();
      setLoading(true);
      await axios.patch(
        `/api/dialysis/sessions/${sessionId}`,
        {
          hospital_id: hospitalId,
          pre_systolic: v.pre_systolic ?? null,
          pre_diastolic: v.pre_diastolic ?? null,
          post_systolic: v.post_systolic ?? null,
          post_diastolic: v.post_diastolic ?? null,
          weight_pre_kg: v.weight_pre_kg ?? null,
          weight_post_kg: v.weight_post_kg ?? null,
          uf_goal_ml: v.uf_goal_ml ?? null,
          heart_rate_pre: v.heart_rate_pre ?? null,
          heart_rate_post: v.heart_rate_post ?? null,
          temperature_pre_c: v.temperature_pre_c ?? null,
          temperature_post_c: v.temperature_post_c ?? null,
          blood_flow_ml_min: v.blood_flow_ml_min ?? null,
          kt_v: v.kt_v ?? null,
          complications_note: v.complications_note ?? null,
          nursing_note: v.nursing_note ?? null,
          notes: v.notes ?? null,
          ended_at: v.ended_at ? (v.ended_at as Dayjs).toISOString() : undefined,
        },
        { params: { hospital_id: hospitalId } }
      );
      message.success('تم حفظ السجل السريري');
      onSaved();
      await loadSession();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error('فشل الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const appendConsumption = async () => {
    if (!sessionId || !hospitalId || !canEdit) return;
    if (!consWarehouse || !consItem || consQty === undefined || consQty <= 0) {
      message.warning('اختر مستودعاً وصنفاً وكمية صحيحة');
      return;
    }
    setLoading(true);
    try {
      await axios.patch(
        `/api/dialysis/sessions/${sessionId}`,
        {
          hospital_id: hospitalId,
          consumptions_append: [
            {
              warehouse_id: consWarehouse,
              item_id: consItem,
              batch_id: consBatch ?? null,
              quantity_base: String(consQty),
            },
          ],
        },
        { params: { hospital_id: hospitalId } }
      );
      message.success('تم تسجيل استهلاك المادة');
      setConsQty(undefined);
      setConsBatch(undefined);
      onSaved();
      await loadSession();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'فشل إضافة الاستهلاك');
    } finally {
      setLoading(false);
    }
  };

  const title =
    detail && sessionId
      ? `سجل جلسة — ${detail.dialysisPatient?.fullName ?? ''} (${dayjs(detail.sessionDate).format('YYYY-MM-DD')})`
      : 'سجل الجلسة';

  return (
    <Drawer
      title={title}
      width={isMobile ? '100%' : 720}
      open={open}
      onClose={onClose}
      destroyOnClose
      styles={{ body: { paddingBottom: 24 } }}
    >
      <Spin spinning={loading}>
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">الحالة: </Text>
              <Text strong>{detail.status}</Text>
              {detail.shiftSlot && (
                <>
                  {' '}
                  <Text type="secondary">| الشفت:</Text> {detail.shiftSlot.name}
                </>
              )}
              {detail.location && (
                <>
                  {' '}
                  <Text type="secondary">| المكان:</Text> {detail.location.hallName} — سرير{' '}
                  {detail.location.bedCode}
                </>
              )}
              {detail.machine && (
                <>
                  {' '}
                  <Text type="secondary">| الجهاز:</Text> {detail.machine.assetTag || `#${detail.machine.id}`}
                </>
              )}
            </div>

            <Form form={form} layout="vertical" disabled={!canEdit}>
              <Divider orientation="left">ضغط ووزن والترشيح</Divider>
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="pre_systolic" label="ضغط انقباضي قبل">
                    <InputNumber min={0} max={300} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="pre_diastolic" label="ضغط انبساطي قبل">
                    <InputNumber min={0} max={200} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="post_systolic" label="ضغط انقباضي بعد">
                    <InputNumber min={0} max={300} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="post_diastolic" label="ضغط انبساطي بعد">
                    <InputNumber min={0} max={200} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="weight_pre_kg" label="الوزن قبل (كغ)">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="weight_post_kg" label="الوزن بعد (كغ)">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="uf_goal_ml" label="هدف الترشيح UF (مل)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">إيقاع، حرارة، جودة الغسل</Divider>
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="heart_rate_pre" label="نبض قبل">
                    <InputNumber min={0} max={250} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="heart_rate_post" label="نبض بعد">
                    <InputNumber min={0} max={250} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="temperature_pre_c" label="حرارة قبل °م">
                    <InputNumber min={30} max={42} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="temperature_post_c" label="حرارة بعد °م">
                    <InputNumber min={30} max={42} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="blood_flow_ml_min" label="تدفق الدم (مل/د)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="kt_v" label="Kt/V (إن وُجد)">
                    <InputNumber min={0} max={3} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="ended_at" label="وقت انتهاء الجلسة">
                    <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="complications_note" label="مضاعفات أثناء الجلسة">
                <TextArea rows={2} placeholder="نزف، هبوط ضغط، تشنجات..." />
              </Form.Item>
              <Form.Item name="nursing_note" label="ملاحظات تمريضية">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item name="notes" label="ملاحظات عامة">
                <TextArea rows={2} />
              </Form.Item>

              {canEdit && (
                <Button type="primary" onClick={saveClinical}>
                  حفظ السجل السريري
                </Button>
              )}
            </Form>

            <Divider orientation="left">استهلاك المواد من المخزون</Divider>
            <div className="d-table-scroll d-table-scroll--compact">
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.consumptions ?? []}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'المادة',
                  key: 'n',
                  render: (_: unknown, r) => r.item?.name ?? '—',
                },
                {
                  title: 'المستودع',
                  key: 'w',
                  render: (_: unknown, r) => r.warehouse?.name ?? '—',
                },
                {
                  title: 'كمية',
                  key: 'q',
                  render: (_: unknown, r) =>
                    `${r.quantityBase}${r.displayUnitCode ? ` ${r.displayUnitCode}` : ''}`,
                },
                {
                  title: 'دفعة',
                  key: 'b',
                  render: (_: unknown, r) => r.batch?.lotNumber ?? '—',
                },
              ]}
            />
            </div>

            {canEdit && (
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                <Text strong>إضافة سطر استهلاك</Text>
                <div style={{ marginTop: 8 }}>
                <div className="d-cons-add-stack">
                    <Select
                      style={{ minWidth: 140, flex: 1 }}
                      placeholder="المستودع"
                      value={consWarehouse}
                      onChange={(v) => {
                        setConsWarehouse(v);
                        setConsItem(undefined);
                        setConsBatch(undefined);
                      }}
                      options={warehouses.map((w) => ({
                        value: w.id,
                        label:
                          w.type === 'PHARMACY'
                            ? `${w.name} (صيدلية)`
                            : `${w.name} (مستلزمات)`,
                      }))}
                    />
                    <Select
                      style={{ minWidth: 160, flex: 1.2 }}
                      placeholder="الصنف"
                      showSearch
                      optionFilterProp="label"
                      value={consItem}
                      onChange={(v) => {
                        setConsItem(v);
                        setConsBatch(undefined);
                      }}
                      options={consumptionItems.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.baseUnitLabel})`,
                      }))}
                    />
                    <Select
                      style={{ minWidth: 160, flex: 1 }}
                      placeholder="دفعة (اختياري)"
                      allowClear
                      value={consBatch}
                      onChange={(v) => setConsBatch(v)}
                      options={batches.map((b) => ({
                        value: b.id,
                        label: `${b.lotNumber || `#${b.id}`} — متبقي ${b.quantityRemainingBase}`,
                      }))}
                    />
                    <InputNumber
                      min={0}
                      style={{ minWidth: 120, flex: 0.6 }}
                      placeholder="كمية بأساس الوحدة"
                      value={consQty}
                      onChange={(v) => setConsQty(v ?? undefined)}
                    />
                    <Button type="default" onClick={appendConsumption}>
                      إضافة للجلسة
                    </Button>
                </div>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    عند اختيار دفعة يُخصم المخزون تلقائياً ويُسجَّل في دفتر الحركة.
                  </Text>
                </div>
              </div>
            )}
          </Space>
        )}
      </Spin>
    </Drawer>
  );
};

export default DialysisSessionClinicalDrawer;
