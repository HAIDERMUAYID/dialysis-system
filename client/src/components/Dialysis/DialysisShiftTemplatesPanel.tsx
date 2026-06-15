import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  TimePicker,
  Checkbox,
  Divider,
  Select,
  message,
  Typography,
  Tag,
  Empty,
  Spin,
} from 'antd';
import { PlusOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { confirmDialysisDelete } from './app/dialysisConfirmDelete';
import dayjs from 'dayjs';
import { WEEKDAY_OPTIONS_AR, minutesToLabel, weekdayLabelAr } from './dialysisConstants';
import { useDialysisMobile } from './app/useDialysisMobile';
import './dialysis-shift-templates-panel.css';

const { Text } = Typography;

interface ShiftSlotRow {
  id: number;
  weekday: number;
  name: string;
  startMinutes: number;
  endMinutes: number;
  capacityApprox: number | null;
  displayOrder: number;
}

interface Props {
  hospitalId: number | null;
  canManage: boolean;
}

function dayjsFromMinutes(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return dayjs().hour(h).minute(mm).second(0).millisecond(0);
}

const DialysisShiftTemplatesPanel: React.FC<Props> = ({ hospitalId, canManage }) => {
  const isMobile = useDialysisMobile();
  const [rows, setRows] = useState<ShiftSlotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftSlotRow | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ShiftSlotRow[]>('/api/dialysis/shift-slots', {
        params: { hospital_id: hospitalId },
      });
      setRows(data);
    } catch {
      message.error('تعذر تحميل الشفتات. تأكد من الاتصال ثم أعد فتح هذه الصفحة.');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.displayOrder - b.displayOrder ||
          a.name.localeCompare(b.name, 'ar')
      ),
    [rows]
  );

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      range: [dayjsFromMinutes(8 * 60), dayjsFromMinutes(10 * 60)],
      weekdays: [],
    });
    setModalOpen(true);
  };

  const openEdit = (r: ShiftSlotRow) => {
    setEditing(r);
    form.setFieldsValue({
      weekday: r.weekday,
      name: r.name,
      range: [dayjsFromMinutes(r.startMinutes), dayjsFromMinutes(r.endMinutes)],
      capacity_approx: r.capacityApprox ?? undefined,
      display_order: r.displayOrder,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!hospitalId) return;
    try {
      const v = await form.validateFields();
      const [a, b] = v.range as [dayjs.Dayjs, dayjs.Dayjs];
      const startMinutes = a.hour() * 60 + a.minute();
      const endMinutes = b.hour() * 60 + b.minute();
      if (editing) {
        const payload = {
          hospital_id: hospitalId,
          weekday: v.weekday,
          name: v.name,
          start_minutes: startMinutes,
          end_minutes: endMinutes,
          capacity_approx: v.capacity_approx ?? null,
          display_order: v.display_order ?? 0,
        };
        await axios.patch(`/api/dialysis/shift-slots/${editing.id}`, payload);
        message.success('تم حفظ التعديلات على هذا الشفت.');
      } else {
        const weekdays = v.weekdays as number[];
        const { data } = await axios.post<{
          count: number;
          skippedWeekdays?: number[];
        }>('/api/dialysis/shift-slots/batch', {
          hospital_id: hospitalId,
          name: v.name,
          start_minutes: startMinutes,
          end_minutes: endMinutes,
          capacity_approx: v.capacity_approx ?? null,
          display_order: v.display_order ?? 0,
          weekdays,
        });
        if (data.skippedWeekdays?.length) {
          const labels = data.skippedWeekdays.map((w) => weekdayLabelAr(w)).join('، ');
          message.warning(`لم تُضف الشفت في بعض الأيام لأن هناك شفت بنفس الاسم مسبقاً: ${labels}`);
        }
        if (data.count > 0) {
          message.success(
            data.count === 1
              ? 'تمت إضافة الشفت ليوم واحد.'
              : `تمت إضافة الشفت في ${data.count} أيام من الأسبوع.`
          );
        }
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const err = e as { response?: { data?: { error?: string } } };
      const serverMsg = err.response?.data?.error;
      message.error(
        typeof serverMsg === 'string' && serverMsg.trim()
          ? serverMsg
          : 'لم يتم الحفظ. راجع الأوقات والاسم ثم حاول مرة أخرى.'
      );
    }
  };

  const confirmSoftDelete = (id: number, name: string) => {
    confirmDialysisDelete({
      title: 'إيقاف الشفت؟',
      content: `سيتم إيقاف «${name}» عن الظهور في القوائم. يمكنك إضافة شفت جديد لاحقاً.`,
      okText: 'إيقاف',
      onOk: async () => {
        await axios.delete(`/api/dialysis/shift-slots/${id}`);
        message.success('تم إيقاف هذا الشفت عن الظهور في القوائم.');
        load();
      },
    });
  };

  const tableColumns = [
    {
      title: 'اليوم',
      dataIndex: 'weekday',
      width: 110,
      render: (w: unknown) => (
        <Tag color="blue" className="d-weekday-tag">
          {weekdayLabelAr(w)}
        </Tag>
      ),
    },
    { title: 'اسم الشفت', dataIndex: 'name', key: 'n', ellipsis: true },
    {
      title: 'من — إلى',
      key: 't',
      render: (_: unknown, r: ShiftSlotRow) => (
        <span>
          {minutesToLabel(r.startMinutes)} — {minutesToLabel(r.endMinutes)}
        </span>
      ),
    },
    {
      title: 'عدد الغسلات (تقريبي)',
      dataIndex: 'capacityApprox',
      width: 130,
      align: 'right' as const,
      render: (c: number | null) => (c != null ? c : '—'),
    },
    {
      title: 'إجراءات',
      key: 'a',
      width: 190,
      render: (_: unknown, r: ShiftSlotRow) =>
        canManage ? (
          <Space wrap>
            <Button size="small" onClick={() => openEdit(r)}>
              تعديل
            </Button>
            <Button size="small" danger onClick={() => confirmSoftDelete(r.id, r.name)}>
              إيقاف
            </Button>
          </Space>
        ) : null,
    },
  ];

  if (!hospitalId) {
    return (
      <div className="d-shift-panel">
        <Text type="secondary">اختر المستشفى من أعلى الشاشة لعرض شفتاته.</Text>
      </div>
    );
  }

  return (
    <div className="d-shift-panel">
      <div className="d-shift-toolbar">
        <h3 className="d-shift-toolbar__title">
          <ClockCircleOutlined aria-hidden />
          شفتات الغسل حسب اليوم
        </h3>
        {canManage ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size={isMobile ? 'large' : 'middle'}
            onClick={openAdd}
          >
            إضافة شفت
          </Button>
        ) : null}
      </div>

      <Text type="secondary" className="d-shift-help">
        يُعرض كل شفت مع اليوم الذي يعمل فيه والوقت تقريباً. عند إضافة شفت جديد تُدخل اسمه والفترة الزمنية
        ثم تُحدد أيام الأسبوع التي يتكرر فيها؛ التعديل يتم لكل يوم من الجدول أو من البطاقة على الهاتف.
      </Text>

      {isMobile ? (
        <div className="d-shift-cards">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">جاري التحميل…</Text>
              </div>
            </div>
          ) : sortedRows.length === 0 ? (
            <Empty description="لا توجد شفتات بعد. اضغط «إضافة شفت» لتعريف أول فترة عمل إن وُجدت صلاحية التعديل." />
          ) : (
            sortedRows.map((r) => (
              <article key={r.id} className="d-shift-card">
                <div className="d-shift-card__week">
                  <Tag color="blue" className="d-weekday-tag">
                    {weekdayLabelAr(r.weekday)}
                  </Tag>
                </div>
                <div className="d-shift-card__name">{r.name}</div>
                <div className="d-shift-card__time">
                  {minutesToLabel(r.startMinutes)} — {minutesToLabel(r.endMinutes)}
                </div>
                <div className="d-shift-card__meta">
                  {r.capacityApprox != null ? (
                    <>
                      عدد الغسلات التقريبي في الشفت: <strong>{r.capacityApprox}</strong>
                    </>
                  ) : (
                    'عدد الغسلات التقريبي: غير محدد'
                  )}
                </div>
                {canManage ? (
                  <div className="d-shift-card__actions">
                    <Button onClick={() => openEdit(r)}>تعديل</Button>
                    <Button danger onClick={() => confirmSoftDelete(r.id, r.name)}>
                      إيقاف الشفت
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="d-shift-table-wrap d-table-scroll d-table-scroll--compact">
          <Table
            loading={loading}
            rowKey="id"
            dataSource={sortedRows}
            pagination={{ pageSize: 12, showSizeChanger: false }}
            columns={tableColumns}
            locale={{
              emptyText: (
                <Empty description="لا توجد شفتات بعد. استخدم «إضافة شفت» لبدء التهيئة." />
              ),
            }}
          />
        </div>
      )}

      <Modal
        title={editing ? 'تعديل شفت' : 'إضافة شفت جديد'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText="حفظ"
        destroyOnClose
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        centered={isMobile}
      >
        {!editing ? (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            املأ اسم الشفت والوقت، ثم حدد أيام الأسبوع التي يتكرر فيها هذا الشفت في المستشفى.
          </Text>
        ) : (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            يمكن تغيير اليوم أو الاسم أو أوقات البداية والنهاية لهذا السطر فقط.
          </Text>
        )}
        <Form form={form} layout="vertical">
          {!editing && (
            <>
              <Divider plain>بيانات الشفت</Divider>
            </>
          )}
          {editing && (
            <Form.Item name="weekday" label="يوم الأسبوع" rules={[{ required: true, message: 'اختر اليوم' }]}>
              <Select options={WEEKDAY_OPTIONS_AR} size="large" />
            </Form.Item>
          )}
          <Form.Item name="name" label="اسم الشفت" rules={[{ required: true, message: 'يرجى إدخال الاسم' }]}>
            <Input placeholder="مثال: صباحي — القاعة أ" size="large" />
          </Form.Item>
          <Form.Item
            name="range"
            label="وقت البداية والانتهاء"
            rules={[{ required: true, message: 'حدد الفترة الزمنية' }]}
          >
            <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} order={false} size="large" />
          </Form.Item>
          <Form.Item name="capacity_approx" label="عدد الغسلات التقريبي في الشفت (اختياري)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="اتركه فارغاً إن لم يُحدد" size="large" />
          </Form.Item>
          <Form.Item
            name="display_order"
            label="ترتيب الظهور في القوائم (الأصغر يظهر أولاً)"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          {!editing && (
            <>
              <Divider plain>أيام تكرار الشفت</Divider>
              <Form.Item
                name="weekdays"
                label="أيام الأسبوع التي يعمل فيها هذا الشفت"
                rules={[
                  {
                    validator: (_, val) =>
                      Array.isArray(val) && val.length > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error('حدد يوماً واحداً على الأقل')),
                  },
                ]}
              >
                <Checkbox.Group
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px' }}
                  options={WEEKDAY_OPTIONS_AR.map((o) => ({ label: o.label, value: o.value }))}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DialysisShiftTemplatesPanel;
