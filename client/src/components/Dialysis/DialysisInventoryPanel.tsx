import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Typography,
  message,
  Tag,
  Empty,
  Spin,
} from 'antd';
import { PlusOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useDialysisMobile } from './app/useDialysisMobile';
import DialysisPackagingEditor from './DialysisPackagingEditor';
import DialysisUnitQuantityInput from './DialysisUnitQuantityInput';
import {
  ladderFromApiForEditor,
  unitsFromApi,
  type ItemUnitApi,
} from './dialysisUnitUtils';
import './dialysis-inventory-panel.css';
import './dialysis-structure-panel.css';

const { Text } = Typography;

interface WarehouseRow {
  id: number;
  name: string;
  type: string;
}

interface ItemRow {
  id: number;
  name: string;
  sku?: string | null;
  measureKind: string;
  baseUnitLabel: string;
  inventoryBaseUnitCode?: string | null;
  units?: ItemUnitApi[];
}

interface BatchRow {
  id: number;
  warehouseId: number;
  itemId: number;
  lotNumber?: string | null;
  expiryDate?: string | null;
  quantityRemainingBase: string | number;
  item?: { name: string; baseUnitLabel: string };
}

interface StockSummaryRow {
  id: number;
  name: string;
  totalRemainingBase: string;
  baseUnitLabel: string;
  batchCount: number;
}

interface Props {
  hospitalId: number;
  canManage: boolean;
}

const DialysisInventoryPanel: React.FC<Props> = ({ hospitalId, canManage }) => {
  const isMobile = useDialysisMobile();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [stockByItem, setStockByItem] = useState<Map<number, StockSummaryRow>>(new Map());
  const [warehouseFilter, setWarehouseFilter] = useState<number | undefined>();
  const [itemsLoading, setItemsLoading] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const [packagingItem, setPackagingItem] = useState<ItemRow | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [itemForm] = Form.useForm();
  const [packagingForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const batchItemId = Form.useWatch('item_id', batchForm) as number | undefined;
  const batchItem = items.find((i) => i.id === batchItemId);
  const batchReceiptUnits = unitsFromApi(batchItem?.units, batchItem?.inventoryBaseUnitCode);

  useEffect(() => {
    if (!batchItemId || !batchReceiptUnits.length) return;
    const base = batchReceiptUnits.find((u) => u.is_base) ?? batchReceiptUnits[0];
    if (base && !batchForm.getFieldValue('receipt_unit_code')) {
      batchForm.setFieldsValue({ receipt_unit_code: base.unit_code });
    }
  }, [batchItemId, batchReceiptUnits, batchForm]);

  const loadStockSummary = useCallback(async () => {
    try {
      const { data } = await axios.get<{ items: StockSummaryRow[] }>('/api/dialysis/inventory/summary', {
        params: { hospital_id: hospitalId },
      });
      const map = new Map<number, StockSummaryRow>();
      (data.items ?? []).forEach((row) => map.set(row.id, row));
      setStockByItem(map);
    } catch {
      setStockByItem(new Map());
    }
  }, [hospitalId]);

  const loadWarehousesItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const [wh, it] = await Promise.all([
        axios.get<WarehouseRow[]>('/api/dialysis/warehouses', { params: { hospital_id: hospitalId } }),
        axios.get<ItemRow[]>('/api/dialysis/items', { params: { hospital_id: hospitalId } }),
      ]);
      setWarehouses(wh.data);
      setItems(it.data);
      setWarehouseFilter(wh.data[0]?.id);
    } catch {
      message.error('تعذر تحميل المستودعات أو الأصناف. أعد فتح الصفحة.');
    } finally {
      setItemsLoading(false);
    }
  }, [hospitalId]);

  const loadBatches = useCallback(async () => {
    if (!warehouseFilter) {
      setBatches([]);
      return;
    }
    setBatchesLoading(true);
    try {
      const { data } = await axios.get<BatchRow[]>('/api/dialysis/inventory/batches', {
        params: { hospital_id: hospitalId, warehouse_id: warehouseFilter },
      });
      setBatches(data);
    } catch {
      message.error('تعذر تحميل دفعات المخزون.');
    } finally {
      setBatchesLoading(false);
    }
  }, [hospitalId, warehouseFilter]);

  useEffect(() => {
    loadWarehousesItems();
    loadStockSummary();
  }, [loadWarehousesItems, loadStockSummary]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const submitItem = async () => {
    try {
      const v = await itemForm.validateFields();
      const ladder = v.packaging_ladder as { label?: string }[] | undefined;
      await axios.post('/api/dialysis/items', {
        hospital_id: hospitalId,
        name: v.name,
        sku: v.sku || null,
        measure_kind: v.measure_kind,
        base_unit_label: v.base_unit_label,
        ...(Array.isArray(ladder) && ladder.length > 0
          ? {
              packaging_ladder: ladder,
              packaging_direction: v.packaging_direction || 'largest_first',
              inventory_base_unit_code: v.inventory_base_unit_code,
            }
          : {}),
      });
      message.success('تمت إضافة الصنف بنجاح');
      itemForm.resetFields();
      setItemModalOpen(false);
      loadWarehousesItems();
      loadStockSummary();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error('لم يتم حفظ الصنف. تحقق من الحقول وحاول مرة أخرى.');
    }
  };

  const submitBatch = async () => {
    try {
      const v = await batchForm.validateFields();
      await axios.post('/api/dialysis/inventory/batches', {
        hospital_id: hospitalId,
        warehouse_id: v.warehouse_id,
        item_id: v.item_id,
        quantity: String(v.receipt_quantity),
        unit_code: v.receipt_unit_code,
        lot_number: v.lot_number || null,
        expiry_date: v.expiry_date ? v.expiry_date.format('YYYY-MM-DD') : null,
      });
      message.success('تم تسجيل استلام الدفعة');
      batchForm.resetFields();
      setBatchModalOpen(false);
      loadBatches();
      loadStockSummary();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error('لم يتم تسجيل الدفعة. تحقق من الكمية والمستودع.');
    }
  };

  const expiryTag = (exp: string | null | undefined) => {
    if (!exp) return <Tag>بدون تاريخ صلاحية</Tag>;
    const d = dayjs(exp);
    const days = d.diff(dayjs(), 'day');
    if (days < 0) return <Tag color="red">منتهية</Tag>;
    if (days <= 30) return <Tag color="orange">تنتهي قريباً</Tag>;
    return <Tag color="green">{d.format('YYYY-MM-DD')}</Tag>;
  };

  const measureLabel = (k: string) => (k === 'WEIGHT_VOLUME' ? 'وزن أو حجم' : 'عدد (قطعة)');

  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.type === 'PHARMACY' ? 'صيدلية' : 'عام'})`,
  }));

  const itemCols = [
    { title: 'الاسم', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'رمز داخلي', dataIndex: 'sku', key: 'sku', render: (x: string | null) => x ?? '—' },
    {
      title: 'نوع القياس',
      dataIndex: 'measureKind',
      key: 'mk',
      render: (k: string) => measureLabel(k),
    },
    { title: 'وحدة المخزون', dataIndex: 'baseUnitLabel', key: 'u' },
    {
      title: 'الرصيد الكلي',
      key: 'stock',
      render: (_: unknown, r: ItemRow) => {
        const s = stockByItem.get(r.id);
        const qty = s?.totalRemainingBase ?? '0';
        const batches = s?.batchCount ?? 0;
        return (
          <span>
            <strong>{qty}</strong> {r.baseUnitLabel}
            {batches > 0 ? (
              <Text type="secondary" style={{ fontSize: 12, marginInlineStart: 6 }}>
                ({batches} دفعة)
              </Text>
            ) : null}
          </span>
        );
      },
    },
    {
      title: 'التعبئة',
      key: 'pack',
      width: 100,
      render: (_: unknown, r: ItemRow) =>
        r.units && r.units.length > 1 ? (
          <Tag color="blue">{r.units.length} مستويات</Tag>
        ) : (
          <Tag>وحدة واحدة</Tag>
        ),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'packEdit',
            width: 90,
            render: (_: unknown, r: ItemRow) => (
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setPackagingItem(r);
                  packagingForm.setFieldsValue({
                    packaging_ladder:
                      r.units && r.units.length
                        ? ladderFromApiForEditor(r.units, r.inventoryBaseUnitCode)
                        : [],
                    inventory_base_unit_code: r.inventoryBaseUnitCode ?? undefined,
                  });
                  setPackagingModalOpen(true);
                }}
              >
                تعبئة
              </Button>
            ),
          },
        ]
      : []),
  ];

  const batchCols = [
    {
      title: 'الصنف',
      key: 'item',
      render: (_: unknown, r: BatchRow) => r.item?.name ?? `#${r.itemId}`,
    },
    {
      title: 'المتبقي',
      key: 'qty',
      render: (_: unknown, r: BatchRow) =>
        `${r.quantityRemainingBase} ${r.item?.baseUnitLabel ?? ''}`.trim(),
    },
    { title: 'رقم الدفعة', dataIndex: 'lotNumber', key: 'lot', render: (x: string | null) => x ?? '—' },
    {
      title: 'الصلاحية',
      dataIndex: 'expiryDate',
      key: 'ex',
      render: (d: string | null) => expiryTag(d),
    },
  ];

  const batchToolbar = (
    <div className="d-inv-toolbar">
      <Select
        style={{ minWidth: isMobile ? undefined : 220, width: isMobile ? '100%' : undefined }}
        placeholder="اختر المستودع"
        value={warehouseFilter}
        onChange={(v) => setWarehouseFilter(v)}
        options={warehouseOptions}
        size={isMobile ? 'large' : 'middle'}
      />
      <Button icon={<ReloadOutlined />} onClick={() => loadBatches()} size={isMobile ? 'large' : 'middle'}>
        تحديث
      </Button>
      {canManage ? (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            batchForm.setFieldsValue({
              warehouse_id: warehouseFilter,
              receipt_quantity: 1,
              receipt_unit_code: undefined,
            });
            setBatchModalOpen(true);
          }}
          size={isMobile ? 'large' : 'middle'}
        >
          استلام دفعة
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="d-inv-panel">
      <section className="d-inv-section">
        <div className="d-inv-section-head">
          <h3>
            <InboxOutlined style={{ marginInlineEnd: 8 }} aria-hidden />
            أصناف المستلزمات
          </h3>
          <Space wrap className="d-inv-toolbar">
            <Button icon={<ReloadOutlined />} onClick={() => { loadWarehousesItems(); loadStockSummary(); }} size={isMobile ? 'large' : 'middle'}>
              تحديث
            </Button>
            {canManage ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
              itemForm.resetFields();
              itemForm.setFieldsValue({ measure_kind: 'COUNT', packaging_ladder: [] });
              setItemModalOpen(true);
            }}
                size={isMobile ? 'large' : 'middle'}
              >
                صنف جديد
              </Button>
            ) : null}
          </Space>
        </div>
        <Text type="secondary" className="d-inv-help">
          كل صنف يُستخدم عند تسجيل استهلاك الجلسة أو الإدخال الإحصائي. حدّد اسماً واضحاً ووحدة المخزون (مثل:
          أمبولة، كيس، غرام).
        </Text>

        {isMobile ? (
          <div className="d-inv-cards">
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin />
              </div>
            ) : items.length === 0 ? (
              <Empty description="لا توجد أصناف. أضف أول صنف من «صنف جديد» إن وُجدت صلاحية التعديل." />
            ) : (
              items.map((it) => (
                <article key={it.id} className="d-inv-card">
                  <div className="d-inv-card__title">{it.name}</div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">رمز داخلي</span>
                    <span className="d-inv-card__value">{it.sku ?? '—'}</span>
                  </div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">القياس</span>
                    <span className="d-inv-card__value">{measureLabel(it.measureKind)}</span>
                  </div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">الرصيد الكلي</span>
                    <span className="d-inv-card__value">
                      {stockByItem.get(it.id)?.totalRemainingBase ?? '0'} {it.baseUnitLabel}
                    </span>
                  </div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">وحدة المخزون</span>
                    <span className="d-inv-card__value">{it.baseUnitLabel}</span>
                  </div>
                  {canManage && it.units && it.units.length > 1 ? (
                    <Button
                      size="small"
                      type="link"
                      style={{ padding: 0, marginTop: 4 }}
                      onClick={() => {
                        setPackagingItem(it);
                        packagingForm.setFieldsValue({
                          packaging_ladder: ladderFromApiForEditor(it.units!, it.inventoryBaseUnitCode),
                          inventory_base_unit_code: it.inventoryBaseUnitCode ?? undefined,
                        });
                        setPackagingModalOpen(true);
                      }}
                    >
                      تعديل التعبئة
                    </Button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="d-inv-table-wrap d-table-scroll d-table-scroll--compact">
            <Table
              rowKey="id"
              size="small"
              loading={itemsLoading}
              columns={itemCols}
              dataSource={items}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{
                emptyText: <Empty description="لا توجد أصناف بعد." />,
              }}
            />
          </div>
        )}
      </section>

      <section className="d-inv-section">
        <div className="d-inv-section-head">
          <h3>دفعات المخزون</h3>
          {!isMobile ? batchToolbar : null}
        </div>
        {isMobile ? batchToolbar : null}
        <Text type="secondary" className="d-inv-help">
          اختر المستودع ثم راجع الدفعات المتبقية وتواريخ الصلاحية. استلام دفعة جديدة يزيد الرصيد المتاح للجلسات.
        </Text>

        {isMobile ? (
          <div className="d-inv-cards">
            {batchesLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin />
              </div>
            ) : !warehouseFilter ? (
              <Empty description="اختر مستودعاً لعرض الدفعات." />
            ) : batches.length === 0 ? (
              <Empty description="لا توجد دفعات في هذا المستودع. سجّل استلاماً من «استلام دفعة»." />
            ) : (
              batches.map((b) => (
                <article key={b.id} className="d-inv-card">
                  <div className="d-inv-card__title">{b.item?.name ?? `صنف #${b.itemId}`}</div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">المتبقي</span>
                    <span className="d-inv-card__value">
                      {b.quantityRemainingBase} {b.item?.baseUnitLabel ?? ''}
                    </span>
                  </div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">رقم الدفعة</span>
                    <span className="d-inv-card__value">{b.lotNumber ?? '—'}</span>
                  </div>
                  <div className="d-inv-card__row">
                    <span className="d-inv-card__label">الصلاحية</span>
                    <span className="d-inv-card__value">{expiryTag(b.expiryDate)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="d-inv-table-wrap d-table-scroll d-table-scroll--compact">
            <Table
              rowKey="id"
              size="small"
              loading={batchesLoading}
              columns={batchCols}
              dataSource={batches}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{
                emptyText: <Empty description={warehouseFilter ? 'لا توجد دفعات.' : 'اختر مستودعاً.'} />,
              }}
            />
          </div>
        )}
      </section>

      <Modal
        title="إضافة صنف جديد"
        open={itemModalOpen}
        onCancel={() => setItemModalOpen(false)}
        onOk={submitItem}
        okText="حفظ"
        width={isMobile ? 'calc(100vw - 24px)' : 560}
        centered={isMobile}
        destroyOnClose
      >
        <Form form={itemForm} layout="vertical" initialValues={{ measure_kind: 'COUNT' }}>
          <Form.Item name="name" label="اسم الصنف" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input size="large" placeholder="مثال: باراسيتامول، هيبرين" />
          </Form.Item>
          <Form.Item name="sku" label="رمز داخلي (اختياري)">
            <Input size="large" placeholder="للتعريف في التقارير" />
          </Form.Item>
          <Form.Item name="measure_kind" label="نوع القياس">
            <Select
              size="large"
              options={[
                { value: 'COUNT', label: 'عدد (قطعة / أمبولة / كيس)' },
                { value: 'WEIGHT_VOLUME', label: 'وزن أو حجم (غرام / مل)' },
              ]}
            />
          </Form.Item>
          <DialysisPackagingEditor form={itemForm} />
        </Form>
      </Modal>

      <Modal
        title={packagingItem ? `تعبئة: ${packagingItem.name}` : 'تعبئة الصنف'}
        open={packagingModalOpen}
        onCancel={() => setPackagingModalOpen(false)}
        onOk={async () => {
          if (!packagingItem) return;
          try {
            const v = await packagingForm.validateFields();
            await axios.put(`/api/dialysis/items/${packagingItem.id}/units`, {
              hospital_id: hospitalId,
              packaging_ladder: v.packaging_ladder,
              packaging_direction: v.packaging_direction || 'largest_first',
              inventory_base_unit_code: v.inventory_base_unit_code,
            });
            message.success('تم حفظ سلم التعبئة');
            setPackagingModalOpen(false);
            loadWarehousesItems();
            loadStockSummary();
          } catch (e: unknown) {
            if ((e as { errorFields?: unknown }).errorFields) return;
            const msg =
              (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
              'فشل الحفظ';
            message.error(msg);
          }
        }}
        okText="حفظ التعبئة"
        width={isMobile ? 'calc(100vw - 24px)' : 560}
        centered={isMobile}
        destroyOnClose
      >
        <Form form={packagingForm} layout="vertical">
          <DialysisPackagingEditor form={packagingForm} />
        </Form>
      </Modal>

      <Modal
        title="استلام دفعة مخزون"
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        onOk={submitBatch}
        okText="تسجيل"
        width={isMobile ? 'calc(100vw - 24px)' : 480}
        centered={isMobile}
        destroyOnClose
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item name="warehouse_id" label="المستودع" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select size="large" options={warehouseOptions} />
          </Form.Item>
          <Form.Item name="item_id" label="الصنف" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              showSearch
              size="large"
              optionFilterProp="label"
              options={items.map((i) => ({
                value: i.id,
                label: `${i.name} (${i.baseUnitLabel})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="receipt_quantity"
            label="الكمية المستلمة"
            rules={[{ required: true, message: 'مطلوب' }]}
          >
            <DialysisUnitQuantityInput
              units={unitsFromApi(batchItem?.units, batchItem?.inventoryBaseUnitCode)}
              quantity={batchForm.getFieldValue('receipt_quantity')}
              unitCode={batchForm.getFieldValue('receipt_unit_code')}
              onQuantityChange={(q) =>
                batchForm.setFieldsValue({ receipt_quantity: q ?? undefined })
              }
              onUnitChange={(code) => batchForm.setFieldsValue({ receipt_unit_code: code })}
            />
          </Form.Item>
          <Form.Item name="receipt_unit_code" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="lot_number" label="رقم الدفعة (اختياري)">
            <Input size="large" />
          </Form.Item>
          <Form.Item name="expiry_date" label="تاريخ انتهاء الصلاحية">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DialysisInventoryPanel;
