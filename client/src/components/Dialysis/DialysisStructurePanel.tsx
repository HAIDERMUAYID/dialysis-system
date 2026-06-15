import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  Input,
  message,
  Typography,
  Empty,
  Spin,
  Space,
} from 'antd';
import { PlusOutlined, ApartmentOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { confirmDialysisDelete } from './app/dialysisConfirmDelete';
import { useDialysisMobile } from './app/useDialysisMobile';
import './dialysis-structure-panel.css';

const { Text } = Typography;

interface LocationRow {
  id: number;
  hallName: string;
  bedCode: string;
  displayOrder: number;
}

interface Props {
  hospitalId: number | null;
  canManage: boolean;
}

const DialysisStructurePanel: React.FC<Props> = ({ hospitalId, canManage }) => {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hallModalOpen, setHallModalOpen] = useState(false);
  const [editHallName, setEditHallName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const isMobile = useDialysisMobile();

  const load = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data } = await axios.get<LocationRow[]>('/api/dialysis/locations', {
        params: { hospital_id: hospitalId },
      });
      setLocations(data);
    } catch {
      message.error('تعذر تحميل قائمة القاعات. تأكد من الاتصال ثم أعد فتح هذه الصفحة.');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, LocationRow[]>();
    for (const loc of locations) {
      const arr = m.get(loc.hallName) ?? [];
      arr.push(loc);
      m.set(loc.hallName, arr);
    }
    return Array.from(m.entries()).map(([hallName, beds]) => ({
      hallName,
      beds: beds.sort((a, b) => a.displayOrder - b.displayOrder || a.bedCode.localeCompare(b.bedCode)),
      count: beds.length,
    }));
  }, [locations]);

  const openEdit = (hallName: string, bedCount: number) => {
    setEditHallName(hallName);
    editForm.setFieldsValue({ hall_name: hallName, bed_count: bedCount });
  };

  const submitEdit = async (values: { hall_name: string; bed_count: number }) => {
    if (!hospitalId || !editHallName) return;
    setSaving(true);
    try {
      await axios.put('/api/dialysis/locations/hall', {
        hospital_id: hospitalId,
        hall_name: editHallName,
        new_hall_name: values.hall_name.trim(),
        bed_count: values.bed_count,
      });
      message.success('تم تحديث القاعة');
      setEditHallName(null);
      editForm.resetFields();
      load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'لم يتم تحديث القاعة';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteHall = (hallName: string, bedCount: number) => {
    confirmDialysisDelete({
      title: 'حذف القاعة؟',
      content: (
        <span>
          سيتم تعطيل قاعة «{hallName}» وجميع أسرتها ({bedCount}{' '}
          {bedCount === 1 ? 'سرير' : 'أسرة'}). لا يمكن التراجع بسهولة إن وُجدت جلسات أو جداول مرتبطة.
        </span>
      ),
      onOk: async () => {
        if (!hospitalId) return;
        await axios.delete('/api/dialysis/locations/hall', {
          data: { hospital_id: hospitalId, hall_name: hallName },
        });
        message.success('تم حذف القاعة');
        load();
      },
    });
  };

  const submitHall = async (values: { hall_name: string; bed_count: number }) => {
    if (!hospitalId) return;
    const n = Math.min(80, Math.max(1, values.bed_count));
    const locationsPayload = Array.from({ length: n }, (_, i) => ({
      hall_name: values.hall_name.trim(),
      bed_code: String(i + 1),
      display_order: i + 1,
    }));
    try {
      await axios.post('/api/dialysis/locations/bulk', {
        hospital_id: hospitalId,
        locations: locationsPayload,
      });
      message.success(`تمت إضافة القاعة مع ${n} سريراً بأرقام متتابعة.`);
      setHallModalOpen(false);
      form.resetFields();
      load();
    } catch {
      message.error('لم يتم حفظ القاعة. حاول مرة أخرى أو راجع الصلاحيات.');
    }
  };

  if (!hospitalId) {
    return (
      <div className="d-structure-panel">
        <Text type="secondary">اختر المستشفى من أعلى الشاشة لعرض قاعاته وأسرته.</Text>
      </div>
    );
  }

  const tableColumns = [
    { title: 'اسم القاعة', dataIndex: 'hallName', key: 'h', ellipsis: true },
    {
      title: 'عدد الأسرة',
      dataIndex: 'count',
      key: 'c',
      width: 110,
      align: 'right' as const,
    },
    {
      title: 'أرقام الأسرة',
      key: 'beds',
      ellipsis: false,
      render: (_: unknown, r: (typeof grouped)[0]) => (
        <span style={{ fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word' }}>
          {r.beds.map((b) => b.bedCode).join('، ')}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            title: 'إجراءات',
            key: 'actions',
            width: 160,
            render: (_: unknown, r: (typeof grouped)[0]) => (
              <Space size="small" wrap>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(r.hallName, r.count)}
                >
                  تعديل
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => confirmDeleteHall(r.hallName, r.count)}
                >
                  حذف
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ];

  const hallActions = (hallName: string, count: number) =>
    canManage ? (
      <div className="d-structure-hall-card__actions">
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(hallName, count)}
        >
          تعديل
        </Button>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => confirmDeleteHall(hallName, count)}
        >
          حذف
        </Button>
      </div>
    ) : null;

  return (
    <div className="d-structure-panel">
      <div className="d-structure-toolbar">
        <h3 className="d-structure-toolbar__title">
          <ApartmentOutlined aria-hidden />
          قاعات الغسل والأسرة
        </h3>
        {canManage ? (
          <Button type="primary" icon={<PlusOutlined />} size={isMobile ? 'large' : 'middle'} onClick={() => setHallModalOpen(true)}>
            إضافة قاعة وأسرة
          </Button>
        ) : null}
      </div>

      <Text type="secondary" className="d-structure-help">
        كل قاعة تظهر مع عدد أسرتها وأرقامها. عند إضافة قاعة جديدة تُدخل اسم القاعة وعدد الأسرة؛ يُرتّب
        النظام أرقام الأسرة تلقائياً (١، ٢، ٣…) لتسهيل الجدولة لاحقاً.
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
          ) : grouped.length === 0 ? (
            <Empty description="لا توجد قاعات مسجّلة بعد. يمكن إضافة أول قاعة من الزر أعلاه إن وُجدت صلاحية التعديل." />
          ) : (
            grouped.map((g) => (
              <article key={g.hallName} className="d-structure-hall-card">
                <div className="d-structure-hall-card__name">{g.hallName}</div>
                <div className="d-structure-hall-card__count">
                  {g.count} {g.count === 1 ? 'سرير' : 'أسرة'}
                </div>
                <div className="d-structure-hall-card__label">أرقام الأسرة</div>
                <div className="d-structure-bed-chips">
                  {g.beds.map((b) => (
                    <span key={b.id} className="d-structure-bed-chip">
                      {b.bedCode}
                    </span>
                  ))}
                </div>
                {hallActions(g.hallName, g.count)}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="d-structure-table-wrap d-table-scroll d-table-scroll--compact">
          <Table
            loading={loading}
            rowKey={(r) => r.hallName}
            pagination={false}
            dataSource={grouped}
            columns={tableColumns}
            locale={{
              emptyText: (
                <Empty description="لا توجد قاعات مسجّلة بعد. استخدم «إضافة قاعة وأسرة» لبدء التهيئة." />
              ),
            }}
          />
        </div>
      )}

      <Modal
        title="إضافة قاعة جديدة"
        open={hallModalOpen}
        onCancel={() => setHallModalOpen(false)}
        footer={null}
        destroyOnClose
        width={isMobile ? 'calc(100vw - 24px)' : 440}
        centered
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          أدخل اسم القاعة كما تود ظهوره في الجداول والشاشات، ثم عدد الأسرة المراد إنشاؤها دفعة واحدة.
        </Text>
        <Form form={form} layout="vertical" onFinish={submitHall}>
          <Form.Item name="hall_name" label="اسم القاعة" rules={[{ required: true, message: 'يرجى إدخال اسم القاعة' }]}>
            <Input placeholder="مثال: القاعة أ — الطابق الأول" size="large" />
          </Form.Item>
          <Form.Item
            name="bed_count"
            label="عدد الأسرة في هذه القاعة"
            rules={[{ required: true, message: 'يرجى تحديد العدد' }]}
            initialValue={5}
          >
            <InputNumber min={1} max={80} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            حفظ وإنشاء الأسرة
          </Button>
        </Form>
      </Modal>

      <Modal
        title="تعديل القاعة"
        open={editHallName != null}
        onCancel={() => {
          setEditHallName(null);
          editForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={isMobile ? 'calc(100vw - 24px)' : 440}
        centered
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          يمكنك تغيير اسم القاعة أو عدد الأسرة. عند التقليل يُعطّل الأسرة الزائدة فقط إن لم تكن
          مرتبطة بمريض أو جلسة.
        </Text>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item
            name="hall_name"
            label="اسم القاعة"
            rules={[{ required: true, message: 'يرجى إدخال اسم القاعة' }]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item
            name="bed_count"
            label="عدد الأسرة"
            rules={[{ required: true, message: 'يرجى تحديد العدد' }]}
          >
            <InputNumber min={1} max={80} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={saving}>
            حفظ التعديلات
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default DialysisStructurePanel;
