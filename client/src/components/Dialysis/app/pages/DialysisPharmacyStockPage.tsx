import React, { useCallback, useEffect, useState } from 'react';
import {
  Tabs,
  Card,
  Table,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Spin,
  message,
  Alert,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  StockOutlined,
  SwapOutlined,
  DatabaseOutlined,
  MedicineBoxOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  ALL_MY_HOSPITALS,
  useDialysisContext,
  useEffectiveDialysisHospitalId,
} from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import { usePermission } from '../../../../hooks/usePermission';
import { Link } from 'react-router-dom';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisPackagingEditor from '../../DialysisPackagingEditor';
import DialysisUnitQuantityInput from '../../DialysisUnitQuantityInput';
import {
  ladderFromApiForEditor,
  unitsFromApi,
  type ItemUnitApi,
} from '../../dialysisUnitUtils';
import './dialysis-pharmacy-stock.css';

const { Text, Title } = Typography;

interface OverviewItem {
  id: number;
  sku?: string | null;
  name: string;
  measureKind: string;
  baseUnitLabel: string;
  drugCatalogId?: number | null;
  drugCatalog?: {
    drugName?: string | null;
    drugNameAr?: string | null;
    form?: string | null;
    strength?: string | null;
  } | null;
  totalRemainingBase: string;
  batchCount: number;
  inventoryBaseUnitCode?: string | null;
  units?: ItemUnitApi[];
  packaging_units?: { unit_code: string; label: string; is_base?: boolean }[];
}

interface OverviewResp {
  pharmacy_warehouse: { id: number; name: string; type: string } | null;
  kpis: {
    sku_count: number;
    batch_records: number;
    batches_with_remaining_stock: number;
    total_quantity_base: string;
    stock_value_estimate: string;
    expiring_batches_within_30_days: number;
    orphaned_batch_records?: number;
  } | null;
  items: OverviewItem[];
}

interface BatchRow {
  id: number;
  quantityRemainingBase: string;
  unitCostPerBase?: string | null;
  line_value_estimate?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  receivedAt?: string | null;
  supplierName?: string | null;
  invoiceReference?: string | null;
  item?: {
    name: string;
    sku?: string | null;
    baseUnitLabel: string;
    drugCatalog?: { drugNameAr?: string | null; drugName?: string | null };
  };
}

interface LedgerRow {
  id: number;
  txnType: string;
  txn_label_ar: string;
  quantity_delta_base: string;
  note?: string | null;
  createdAt: string;
  item?: { name: string; baseUnitLabel: string };
  batch?: { lotNumber?: string | null };
}

const DialysisPharmacyStockPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const effectiveHid = useEffectiveDialysisHospitalId();
  const canInventory = usePermission('dialysis:pharmacy:inventory');
  const isNarrow = useDialysisMobile();

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<OverviewResp | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [includeZero, setIncludeZero] = useState(false);

  const [itemModal, setItemModal] = useState<'create' | 'edit' | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemForm] = Form.useForm();

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptForm] = Form.useForm();
  const receiptItemId = Form.useWatch('item_id', receiptForm) as number | undefined;
  const receiptRow = (overview?.items ?? []).find((i) => i.id === receiptItemId);
  const receiptPackUnits = unitsFromApi(receiptRow?.units, receiptRow?.inventoryBaseUnitCode);

  const loadOverview = useCallback(async () => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) return;
    setLoading(true);
    try {
      const { data } = await axios.get<OverviewResp>('/api/dialysis/pharmacy/inventory/overview', {
        params: { hospital_id: hospitalId },
      });
      setOverview(data);
    } catch {
      message.error('تعذر تحميل ملخص المخزن');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  const loadBatches = useCallback(async () => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) return;
    try {
      const { data } = await axios.get<BatchRow[]>('/api/dialysis/pharmacy/inventory/batches', {
        params: {
          hospital_id: hospitalId,
          include_zero: includeZero ? '1' : '0',
          limit: 800,
        },
      });
      setBatches(data);
    } catch {
      message.error('تعذر تحميل الدفعات');
    }
  }, [hospitalId, includeZero]);

  const loadLedger = useCallback(async () => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) return;
    try {
      const { data } = await axios.get<LedgerRow[]>('/api/dialysis/pharmacy/inventory/ledger', {
        params: { hospital_id: hospitalId, limit: 250 },
      });
      setLedger(data);
    } catch {
      message.error('تعذر تحميل حركة المخزن');
    }
  }, [hospitalId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const openCreateItem = () => {
    setEditingItemId(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ measure_kind: 'COUNT', packaging_ladder: [] });
    setItemModal('create');
  };

  const openEditItem = async (row: OverviewItem) => {
    setEditingItemId(row.id);
    let ladder = row.units?.length
      ? ladderFromApiForEditor(row.units, row.inventoryBaseUnitCode)
      : [];
    let invCode = row.inventoryBaseUnitCode ?? null;
    if (effectiveHid != null && !row.units?.length) {
      try {
        const { data } = await axios.get<{
          ladder: typeof ladder;
          units?: ItemUnitApi[];
          inventory_base_unit_code?: string | null;
        }>(`/api/dialysis/items/${row.id}/units`, { params: { hospital_id: effectiveHid } });
        if (data.units?.length) {
          ladder = ladderFromApiForEditor(data.units, data.inventory_base_unit_code);
        }
        if (data.inventory_base_unit_code) invCode = data.inventory_base_unit_code;
      } catch {
        /* ignore */
      }
    }
    itemForm.setFieldsValue({
      name: row.name,
      sku: row.sku,
      base_unit_label: row.baseUnitLabel,
      measure_kind: row.measureKind,
      packaging_ladder: ladder,
      inventory_base_unit_code: invCode ?? undefined,
    });
    setItemModal('edit');
  };

  const purgeDeletedItems = async () => {
    if (!canInventory || effectiveHid == null) return;
    try {
      const { data } = await axios.post('/api/dialysis/pharmacy/inventory/purge-deleted-items', {
        hospital_id: effectiveHid,
      });
      message.success(
        data?.message ||
          `تم التنظيف: ${data?.batches ?? 0} دفعة، ${data?.ledger ?? 0} حركة`
      );
      loadOverview();
      loadBatches();
      loadLedger();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'تعذر التنظيف';
      message.error(msg);
    }
  };

  const deactivateItem = (row: OverviewItem) => {
    if (!canInventory || effectiveHid == null) return;
    const qty = parseFloat(String(row.totalRemainingBase ?? '0'));
    const hasStock = Number.isFinite(qty) && qty > 0;
    Modal.confirm({
      title: 'حذف الصنف من المخزن؟',
      okText: 'نعم، حذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      content: (
        <div>
          <p>
            سيتم حذف «<strong>{row.name}</strong>» مع <strong>كل الدفعات</strong> و<strong>حركة المخزن</strong>{' '}
            المرتبطة به. إن وُجدت سجلات صرف سابقة يُعطّل الصنف فقط ويبقى مرجع الصرف.
          </p>
          {hasStock ? (
            <Alert
              type="warning"
              showIcon
              className="d-ph-stock-modal-alert--inner"
              message={`يوجد رصيد متبقٍ: ${row.totalRemainingBase} ${row.baseUnitLabel}. سيُزال من المخزون مع الحذف.`}
            />
          ) : null}
        </div>
      ),
      onOk: async () => {
        try {
          const { data } = await axios.delete(`/api/dialysis/items/${row.id}`, {
            params: { hospital_id: effectiveHid },
          });
          message.success(data?.message || 'تم حذف الصنف ومخزونه');
          loadOverview();
          loadBatches();
          loadLedger();
        } catch (e: unknown) {
          const msg =
            (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'تعذر حذف الصنف';
          message.error(msg);
          throw e;
        }
      },
    });
  };

  const submitItem = async () => {
    if (effectiveHid == null) return;
    try {
      const v = await itemForm.validateFields();
      if (itemModal === 'create') {
        await axios.post('/api/dialysis/items', {
          hospital_id: effectiveHid,
          name: v.name,
          sku: v.sku || null,
          measure_kind: v.measure_kind,
          base_unit_label: v.base_unit_label,
          ...(Array.isArray(v.packaging_ladder) && v.packaging_ladder.length
            ? {
                packaging_ladder: v.packaging_ladder,
                packaging_direction: v.packaging_direction || 'largest_first',
                inventory_base_unit_code: v.inventory_base_unit_code,
              }
            : {}),
        });
        message.success('تم إنشاء الصنف');
      } else if (editingItemId != null) {
        await axios.patch(`/api/dialysis/items/${editingItemId}`, {
          hospital_id: effectiveHid,
          name: v.name,
          sku: v.sku || null,
          measure_kind: v.measure_kind,
          base_unit_label: v.base_unit_label,
        });
        if (Array.isArray(v.packaging_ladder)) {
          await axios.put(`/api/dialysis/items/${editingItemId}/units`, {
            hospital_id: effectiveHid,
            packaging_ladder: v.packaging_ladder,
            packaging_direction: v.packaging_direction || 'largest_first',
            inventory_base_unit_code: v.inventory_base_unit_code,
          });
        }
        message.success('تم تحديث الصنف');
      }
      setItemModal(null);
      loadOverview();
      loadBatches();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل الحفظ';
      message.error(msg);
    }
  };

  const submitReceipt = async () => {
    if (!overview?.pharmacy_warehouse || effectiveHid == null) {
      message.error('لا يوجد مستودع صيدلية أو مستشفى');
      return;
    }
    try {
      const v = await receiptForm.validateFields();
      await axios.post('/api/dialysis/pharmacy/inventory/receipt', {
        hospital_id: effectiveHid,
        warehouse_id: overview.pharmacy_warehouse.id,
        item_id: v.item_id,
        quantity: String(v.receipt_quantity),
        unit_code: v.receipt_unit_code,
        lot_number: v.lot_number || null,
        expiry_date: v.expiry_date ? v.expiry_date.format('YYYY-MM-DD') : null,
        unit_cost_per_base: v.unit_cost_per_base != null ? String(v.unit_cost_per_base) : null,
        supplier_name: v.supplier_name || null,
        invoice_reference: v.invoice_reference || null,
        receipt_notes: v.receipt_notes || null,
        note: v.note || null,
      });
      message.success('تم تسجيل الوارد في مخزن صيدلية الغسل');
      setReceiptOpen(false);
      receiptForm.resetFields();
      loadOverview();
      loadBatches();
      loadLedger();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل الاستلام';
      message.error(msg);
    }
  };

  const expiryTag = (exp: string | null | undefined) => {
    if (!exp) {
      return <span className="d-ph-stock-pill d-ph-stock-pill--muted">بدون تاريخ انتهاء</span>;
    }
    const d = dayjs(exp);
    const days = d.diff(dayjs(), 'day');
    if (days < 0) {
      return <span className="d-ph-stock-pill d-ph-stock-pill--danger">منتهية</span>;
    }
    if (days <= 30) {
      return <span className="d-ph-stock-pill d-ph-stock-pill--warn">تنتهي خلال 30 يوماً</span>;
    }
    return <span className="d-ph-stock-pill d-ph-stock-pill--ok">{d.format('YYYY-MM-DD')}</span>;
  };

  const itemCols: ColumnsType<OverviewItem> = [
    {
      title: 'الصنف',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          {r.sku ? (
            <div>
              <Text type="secondary" className="d-ph-stock-muted">
                SKU: {r.sku}
              </Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'مرجع قديم (اختياري)',
      width: 160,
      render: (_, r) =>
        r.drugCatalog
          ? r.drugCatalog.drugNameAr || r.drugCatalog.drugName || '—'
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'الوحدة',
      width: 90,
      dataIndex: 'baseUnitLabel',
    },
    {
      title: 'الكمية المتبقية (مجمّع)',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <Text strong>
          {r.totalRemainingBase} {r.baseUnitLabel}
        </Text>
      ),
    },
    {
      title: 'دفعات',
      width: 70,
      align: 'center',
      dataIndex: 'batchCount',
    },
    {
      title: 'إجراءات',
      width: 130,
      fixed: 'left',
      render: (_, r) =>
        canInventory ? (
          <Space size={0} wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditItem(r)}>
              تعديل
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => deactivateItem(r)}
            >
              حذف
            </Button>
          </Space>
        ) : null,
    },
  ];

  const batchCols: ColumnsType<BatchRow> = [
    {
      title: 'الصنف / الدواء',
      render: (_, r) => (
        <div>
          <div>{r.item?.name}</div>
          <Text type="secondary" className="d-ph-stock-muted">
            {r.item?.drugCatalog?.drugNameAr || r.item?.drugCatalog?.drugName || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'المتبقي',
      width: 110,
      align: 'right',
      render: (_, r) => `${r.quantityRemainingBase} ${r.item?.baseUnitLabel ?? ''}`.trim(),
    },
    {
      title: 'سعر الوحدة',
      width: 100,
      align: 'right',
      render: (_, r) => (r.unitCostPerBase != null ? Number(r.unitCostPerBase).toLocaleString('ar-IQ') : '—'),
    },
    {
      title: 'قيمة المتبقي (تقدير)',
      width: 130,
      align: 'right',
      render: (_, r) =>
        r.line_value_estimate != null
          ? Number(r.line_value_estimate).toLocaleString('ar-IQ')
          : '—',
    },
    {
      title: 'اللوت',
      width: 100,
      dataIndex: 'lotNumber',
      render: (x) => x ?? '—',
    },
    {
      title: 'الصلاحية',
      width: 130,
      dataIndex: 'expiryDate',
      render: (d) => expiryTag(d),
    },
    {
      title: 'مورد / فاتورة',
      width: 160,
      render: (_, r) => (
        <span className="d-ph-stock-muted">
          {[r.supplierName, r.invoiceReference].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
  ];

  const ledgerCols: ColumnsType<LedgerRow> = [
    {
      title: 'الوقت',
      width: 170,
      render: (_, r) => dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'النوع',
      width: 110,
      render: (_, r) => (
        <span className="d-ph-stock-pill d-ph-stock-pill--txn">{r.txn_label_ar}</span>
      ),
    },
    {
      title: 'الصنف',
      render: (_, r) => r.item?.name ?? '—',
    },
    {
      title: 'التغير',
      width: 100,
      align: 'right',
      dataIndex: 'quantity_delta_base',
    },
    {
      title: 'لوت',
      width: 90,
      render: (_, r) => r.batch?.lotNumber ?? '—',
    },
    {
      title: 'ملاحظة',
      ellipsis: true,
      dataIndex: 'note',
    },
  ];

  if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) {
    return (
      <div className={`d-ph-stock-page d-ph-stock-page--pick-hospital${isNarrow ? ' d-ph-stock-page--narrow' : ''}`}>
        <header className={`d-ph-stock-hero${isNarrow ? ' d-ph-stock-hero--compact' : ''}`}>
          <div className="d-ph-stock-hero-inner">
            <Title level={isNarrow ? 4 : 3} className="d-ph-stock-hero-title">
              <DatabaseOutlined aria-hidden />
              مخزن صيدلية الغسل
            </Title>
            {!isNarrow ? (
              <p className="d-ph-stock-hero-sub">
                الأصناف، الوارد، الدفعات، والحركة — لكل مستشفى مستودع منفصل. اختر المستشفى للمتابعة.
              </p>
            ) : (
              <p className="d-ph-stock-hero-sub d-ph-stock-hero-sub--one-line">
                اختر مستشفى لعرض المخزن والحركة.
              </p>
            )}
          </div>
        </header>
        <DialysisPickHospitalScope
          title="اختر مستشفى المخزن"
          description="وضع «جميع المستشفيات (مدموج)» لا يعرض مخزناً واحداً. اختر مستشفى لتحميل الأصناف والدفعات وسجل الحركة."
        />
      </div>
    );
  }

  const wh = overview?.pharmacy_warehouse;
  const kp = overview?.kpis;

  return (
    <div className={`d-ph-stock-page${isNarrow ? ' d-ph-stock-page--narrow' : ''}`}>
      <header className={`d-ph-stock-hero${isNarrow ? ' d-ph-stock-hero--compact' : ''}`}>
        <div className="d-ph-stock-hero-inner">
          <Title level={isNarrow ? 4 : 3} className="d-ph-stock-hero-title">
            <DatabaseOutlined aria-hidden />
            مخزن صيدلية الغسل
          </Title>
          {!isNarrow ? (
            <p className="d-ph-stock-hero-sub">
              الأصناف، الوارد، الدفعات، والحركة — من هنا يُدار مخزن صيدلية وحدة الغسل فقط.
            </p>
          ) : (
            <p className="d-ph-stock-hero-sub d-ph-stock-hero-sub--one-line">
              إدارة أصناف الغسل والكميات قبل الصرف للمرضى.
            </p>
          )}
          {wh ? (
            <div className="d-ph-stock-hero-wh">
              <span className="d-ph-stock-hero-wh-label">المستودع النشط</span>
              <span className="d-ph-stock-hero-wh-name">{wh.name}</span>
              <span className="d-ph-stock-hero-wh-id">#{wh.id}</span>
            </div>
          ) : null}
        </div>
      </header>

      {!wh && !loading && (
        <Alert
          className="d-ph-stock-banner d-ph-stock-banner--spaced"
          type="warning"
          showIcon
          message="لا يوجد مستودع صيدلية مهيأ لهذا المستشفى. أنشئ مستشفى من إدارة النظام أو أضف المستودعات الافتراضية."
        />
      )}

      {canInventory && (overview?.kpis?.orphaned_batch_records ?? 0) > 0 ? (
        <Alert
          className="d-ph-stock-banner d-ph-stock-banner--spaced"
          type="info"
          showIcon
          message={`توجد ${overview!.kpis!.orphaned_batch_records} دفعة لأصناف محذوفة سابقاً — الإحصائيات لا تشملها.`}
          action={
            <Button size="small" danger onClick={() => purgeDeletedItems()}>
              تنظيف الدفعات المتبقية
            </Button>
          }
        />
      ) : null}

      <div className={`d-ph-stock-actions${isNarrow ? ' d-ph-stock-actions--stack' : ''}`}>
        <Link to="/dialysis/pharmacy" className="d-ph-stock-link-pharmacy">
          <Button type="primary" block={isNarrow} size={isNarrow ? 'large' : 'middle'} icon={<MedicineBoxOutlined />}>
            صرف العلاج للجلسات
          </Button>
        </Link>
        <div className="d-ph-stock-actions-row">
          <Button shape="round" icon={<ReloadOutlined />} onClick={() => { loadOverview(); loadBatches(); loadLedger(); }}>
            تحديث
          </Button>
          {canInventory && wh && !isNarrow && (
            <>
              <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={openCreateItem}>
                صنف جديد
              </Button>
              <Button icon={<InboxOutlined />} type="primary" shape="round" ghost onClick={() => setReceiptOpen(true)}>
                إدخال وارد
              </Button>
            </>
          )}
          {canInventory && wh && isNarrow ? (
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: [
                  { key: 'item', icon: <PlusOutlined />, label: 'تعريف صنف جديد' },
                  { key: 'receipt', icon: <InboxOutlined />, label: 'إدخال وارد' },
                ],
                onClick: ({ key }) => {
                  if (key === 'item') openCreateItem();
                  if (key === 'receipt') setReceiptOpen(true);
                },
              }}
            >
              <Button icon={<MoreOutlined />} shape="round">
                المزيد
              </Button>
            </Dropdown>
          ) : null}
        </div>
      </div>

      <Tabs
        className="d-ph-stock-tabs"
        defaultActiveKey="summary"
        items={[
          {
            key: 'summary',
            label: (
              <span>
                <StockOutlined /> ملخص وكميات
              </span>
            ),
            children: (
              <Spin spinning={loading}>
                {kp &&
                  (isNarrow ? (
                    <div className="d-ph-stock-kpi-scroll" role="list">
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic title="الأصناف" value={kp.sku_count} />
                      </Card>
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic title="سجلات الدفعات" value={kp.batch_records} />
                      </Card>
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic title="بها رصيد" value={kp.batches_with_remaining_stock} />
                      </Card>
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic
                          title="تنتهي خلال 30 يوماً"
                          value={kp.expiring_batches_within_30_days}
                          className="d-ph-stock-stat-expiring"
                        />
                      </Card>
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic title="إجمالي الكمية" value={kp.total_quantity_base} />
                      </Card>
                      <Card className="d-ph-stock-kpi-card d-ph-stock-kpi-card--slide" size="small" role="listitem">
                        <Statistic
                          title="قيمة المخزون (تقدير)"
                          value={Number(kp.stock_value_estimate || 0).toLocaleString('ar-IQ')}
                          suffix="د.ع."
                        />
                      </Card>
                    </div>
                  ) : (
                    <Row gutter={[16, 16]} className="d-ph-stock-kpi-row">
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic title="عدد الأصناف المعرفة" value={kp.sku_count} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic title="سجلات الدفعات" value={kp.batch_records} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic title="دفعات بها رصيد" value={kp.batches_with_remaining_stock} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic
                            title="دفعات تنتهي خلال 30 يوماً"
                            value={kp.expiring_batches_within_30_days}
                            className="d-ph-stock-stat-expiring"
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic title="إجمالي الكمية (وحدة أساسية)" value={kp.total_quantity_base} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card className="d-ph-stock-kpi-card" size="small">
                          <Statistic
                            title="قيمة المخزون (تقدير من سعر الوارد)"
                            value={Number(kp.stock_value_estimate || 0).toLocaleString('ar-IQ')}
                            suffix="د.ع."
                          />
                        </Card>
                      </Col>
                    </Row>
                  ))}
                <Card className="d-ph-stock-panel" title="الكمية المتبقية حسب الصنف (مجمّعة من كل الدفعات)">
                  <Table
                    rowKey="id"
                    size="small"
                    columns={itemCols}
                    dataSource={overview?.items ?? []}
                    pagination={{ pageSize: 12 }}
                    locale={{ emptyText: 'لا أصناف معرفة بعد' }}
                  />
                </Card>
              </Spin>
            ),
          },
          {
            key: 'batches',
            label: (
              <span>
                <InboxOutlined /> الدفعات والتفاصيل
              </span>
            ),
            children: (
              <Card
                className="d-ph-stock-panel"
                title="دفعات مخزن الصيدلية"
                extra={
                  <Space>
                    <Text type="secondary">إظهار الرصيد صفر:</Text>
                    <Select
                      className="d-ph-stock-zero-select"
                      value={includeZero ? 'yes' : 'no'}
                      onChange={(v) => setIncludeZero(v === 'yes')}
                      options={[
                        { value: 'no', label: 'لا' },
                        { value: 'yes', label: 'نعم' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => loadBatches()}>
                      تحديث
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1100 }}
                  columns={batchCols}
                  dataSource={batches}
                  pagination={{ pageSize: 15 }}
                />
              </Card>
            ),
          },
          {
            key: 'ledger',
            label: (
              <span>
                <SwapOutlined /> حركة المخزن
              </span>
            ),
            children: (
              <Card className="d-ph-stock-panel" title="قيود الوارد والصرف والتسويات">
                <Table
                  rowKey="id"
                  size="small"
                  columns={ledgerCols}
                  dataSource={ledger}
                  pagination={{ pageSize: 15 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        className="d-ph-stock-modal"
        title={itemModal === 'create' ? 'تعريف صنف في مخزن الغسل' : 'تعديل تعريف الصنف'}
        open={itemModal != null}
        onCancel={() => setItemModal(null)}
        onOk={submitItem}
        okText="حفظ"
        width={520}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="name" label="اسم الصنف في المخزن" rules={[{ required: true }]}>
            <Input placeholder="كما يظهر للصيدلي" />
          </Form.Item>
          <Form.Item name="sku" label="رمز SKU داخلي">
            <Input />
          </Form.Item>
          <Form.Item name="measure_kind" label="نوع القياس" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'COUNT', label: 'عدد (قرص، أمبولة، قطعة)' },
                { value: 'WEIGHT_VOLUME', label: 'وزن / حجم' },
              ]}
            />
          </Form.Item>
          <DialysisPackagingEditor form={itemForm} />
        </Form>
      </Modal>

      <Modal
        className="d-ph-stock-modal"
        title="إدخال وارد — مخزن صيدلية الغسل"
        open={receiptOpen}
        onCancel={() => setReceiptOpen(false)}
        onOk={submitReceipt}
        okText="تسجيل الوارد"
        width={560}
      >
        <Alert
          type="info"
          showIcon
          className="d-ph-stock-modal-alert"
          message="يُسجّل في مستودع الصيدلية الخاص بوحدة الغسل فقط، مع تحديث الرصيد والقيمة التقديرية للمخزون."
        />
        <Form form={receiptForm} layout="vertical">
          <Form.Item name="item_id" label="الصنف" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="اختر صنفاً معرفاً مسبقاً"
              options={(overview?.items ?? []).map((it) => ({
                value: it.id,
                label: `${it.name} (${it.baseUnitLabel})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="receipt_quantity"
            label="الكمية المستلمة"
            rules={[{ required: true }]}
            extra="مثال: 20 كرتون — يُحوَّل تلقائياً إلى الوحدة الأصغر (حبة)"
          >
            <DialysisUnitQuantityInput
              units={receiptPackUnits}
              quantity={receiptForm.getFieldValue('receipt_quantity')}
              unitCode={receiptForm.getFieldValue('receipt_unit_code')}
              onQuantityChange={(q) =>
                receiptForm.setFieldsValue({ receipt_quantity: q ?? undefined })
              }
              onUnitChange={(code) => receiptForm.setFieldsValue({ receipt_unit_code: code })}
            />
          </Form.Item>
          <Form.Item name="receipt_unit_code" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="unit_cost_per_base" label="سعر شراء الوحدة الأساسية (د.ع.) — اختياري">
            <InputNumber min={0} step={0.01} className="d-ph-stock-form-full" />
          </Form.Item>
          <Form.Item name="lot_number" label="رقم الدفعة / اللوت">
            <Input />
          </Form.Item>
          <Form.Item name="expiry_date" label="تاريخ انتهاء الصلاحية">
            <DatePicker className="d-ph-stock-form-full" format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="supplier_name" label="المورد">
            <Input />
          </Form.Item>
          <Form.Item name="invoice_reference" label="مرجع الفاتورة / الطلب">
            <Input />
          </Form.Item>
          <Form.Item name="receipt_notes" label="ملاحظات الوارد">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="note" label="ملاحظة في قيد الدفتر (اختياري)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DialysisPharmacyStockPage;
