import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Typography, Tag, Empty, Spin } from 'antd';
import { HddOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useDialysisMobile } from './app/useDialysisMobile';
import './dialysis-structure-panel.css';

const { Text } = Typography;

interface MachineRow {
  id: number;
  assetTag?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  totalHours: string | number;
  location?: { hallName: string; bedCode: string } | null;
}

interface LocOpt {
  id: number;
  hallName: string;
  bedCode: string;
}

interface Props {
  hospitalId: number | null;
  canManage: boolean;
}

const DialysisMachinesPanel: React.FC<Props> = ({ hospitalId, canManage }) => {
  const isMobile = useDialysisMobile();
  const [rows, setRows] = useState<MachineRow[]>([]);
  const [locs, setLocs] = useState<LocOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [{ data: m }, { data: l }] = await Promise.all([
        axios.get<MachineRow[]>('/api/dialysis/machines', { params: { hospital_id: hospitalId } }),
        axios.get<LocOpt[]>('/api/dialysis/locations', { params: { hospital_id: hospitalId } }),
      ]);
      setRows(m);
      setLocs(l);
    } catch {
      message.error('تعذر تحميل الأجهزة. تأكد من الاتصال ثم أعد فتح الصفحة.');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!hospitalId) return;
    try {
      const v = await form.validateFields();
      await axios.post('/api/dialysis/machines', {
        hospital_id: hospitalId,
        location_id: v.location_id ?? null,
        asset_tag: v.asset_tag || null,
        model: v.model || null,
        serial_number: v.serial_number || null,
        maintenance_threshold_hours: v.maintenance_threshold_hours ?? null,
      });
      message.success('تم تسجيل الجهاز بنجاح');
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error('لم يتم حفظ الجهاز. تحقق من البيانات وحاول مرة أخرى.');
    }
  };

  const tableColumns = [
    { title: 'الرقم الأصولي', dataIndex: 'assetTag', render: (t: string | null) => t || '—' },
    { title: 'الموديل', dataIndex: 'model', render: (t: string | null) => t || '—' },
    { title: 'الرقم التسلسلي', dataIndex: 'serialNumber', render: (t: string | null) => t || '—' },
    {
      title: 'الموقع (قاعة — سرير)',
      key: 'loc',
      render: (_: unknown, r: MachineRow) =>
        r.location ? (
          <Tag>
            {r.location.hallName} — {r.location.bedCode}
          </Tag>
        ) : (
          'غير مربوط'
        ),
    },
    {
      title: 'ساعات التشغيل',
      dataIndex: 'totalHours',
      width: 120,
      align: 'right' as const,
      render: (h: string | number) => String(h),
    },
  ];

  if (!hospitalId) {
    return (
      <div className="d-structure-panel">
        <Text type="secondary">اختر المستشفى من أعلى الشاشة لعرض الأجهزة.</Text>
      </div>
    );
  }

  return (
    <div className="d-structure-panel">
      <div className="d-structure-toolbar">
        <h3 className="d-structure-toolbar__title">
          <HddOutlined aria-hidden />
          أجهزة الغسل
        </h3>
        {canManage ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size={isMobile ? 'large' : 'middle'}
            onClick={() => setOpen(true)}
          >
            تسجيل جهاز
          </Button>
        ) : null}
      </div>

      <Text type="secondary" className="d-structure-help">
        يمكن ربط كل جهاز بسرير محدد في قاعة الغسل (اختياري). عند تسجيل الجلسة يظهر الجهاز المرتبط بالسرير
        لتسهيل المتابعة.
      </Text>

      {isMobile ? (
        <div className="d-structure-cards">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">جاري التحميل…</Text>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <Empty description="لا توجد أجهزة مسجّلة. يمكن تسجيل أول جهاز من الزر أعلاه إن وُجدت صلاحية التعديل." />
          ) : (
            rows.map((r) => (
              <article key={r.id} className="d-structure-hall-card">
                <div className="d-structure-hall-card__name">
                  {r.assetTag || r.model || `جهاز #${r.id}`}
                </div>
                {r.model && r.assetTag ? (
                  <div className="d-structure-hall-card__count">الموديل: {r.model}</div>
                ) : null}
                {r.serialNumber ? (
                  <div className="d-structure-hall-card__meta">التسلسلي: {r.serialNumber}</div>
                ) : null}
                <div className="d-structure-hall-card__label">الموقع</div>
                <div className="d-structure-bed-chips">
                  {r.location ? (
                    <span className="d-structure-bed-chip">
                      {r.location.hallName} — سرير {r.location.bedCode}
                    </span>
                  ) : (
                    <span className="d-patient-card-schedule-empty">غير مربوط بسرير</span>
                  )}
                </div>
                <div className="d-structure-hall-card__meta" style={{ marginTop: 8 }}>
                  ساعات التشغيل: <strong>{String(r.totalHours)}</strong>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="d-structure-table-wrap d-table-scroll d-table-scroll--compact">
          <Table
            loading={loading}
            rowKey="id"
            dataSource={rows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={tableColumns}
            locale={{
              emptyText: <Empty description="لا توجد أجهزة مسجّلة. استخدم «تسجيل جهاز» لبدء السجل." />,
            }}
          />
        </div>
      )}

      <Modal
        title="تسجيل جهاز غسل جديد"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="حفظ"
        width={isMobile ? 'calc(100vw - 24px)' : 480}
        centered={isMobile}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          املأ ما تعرفه عن الجهاز؛ ربط السرير اختياري ويمكن تعديله لاحقاً.
        </Text>
        <Form form={form} layout="vertical">
          <Form.Item name="location_id" label="ربط بالسرير (اختياري)">
            <Select
              allowClear
              size="large"
              placeholder="اختر القاعة والسرير"
              options={locs.map((l) => ({
                value: l.id,
                label: `${l.hallName} — سرير ${l.bedCode}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="asset_tag" label="الرقم الأصولي / وسم الجهاز">
            <Input size="large" placeholder="مثال: HD-001" />
          </Form.Item>
          <Form.Item name="model" label="الموديل">
            <Input size="large" />
          </Form.Item>
          <Form.Item name="serial_number" label="الرقم التسلسلي">
            <Input size="large" />
          </Form.Item>
          <Form.Item name="maintenance_threshold_hours" label="تنبيه صيانة بعد (ساعات تشغيل)">
            <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="اختياري" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DialysisMachinesPanel;
