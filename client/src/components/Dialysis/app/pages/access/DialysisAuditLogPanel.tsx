import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Empty, Select, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useDialysisContext } from '../../dialysisContext';
import { useDialysisMobile } from '../../useDialysisMobile';

const { Text } = Typography;

const ACTION_OPTIONS = [
  { value: '', label: 'كل العمليات' },
  { value: 'session_delete', label: 'حذف جلسة' },
  { value: 'stat_entry_delete', label: 'حذف سطر إحصائي' },
  { value: 'face_enroll', label: 'تسجيل بصمة وجه' },
  { value: 'face_enroll_clear', label: 'إزالة بصمة وجه' },
  { value: 'patient_promote', label: 'ترقية مريض' },
  { value: 'dispense_complete', label: 'تأكيد صرف صيدلية' },
];

export interface AuditLogRow {
  id: number;
  action: string;
  action_label: string;
  summary: string;
  patient_name?: string | null;
  hospital_id?: number | null;
  entity_id?: number | null;
  created_at: string;
  user?: { name?: string; username?: string } | null;
}

const DialysisAuditLogPanel: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const isMobile = useDialysisMobile();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const pageSize = isMobile ? 10 : 20;

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<{ items: AuditLogRow[]; total: number }>(
        '/api/dialysis/audit-log',
        {
          params: {
            hospital_id: hospitalId,
            limit: pageSize,
            offset: (page - 1) * pageSize,
            action: action || undefined,
            date_from: range?.[0]?.format('YYYY-MM-DD'),
            date_to: range?.[1]?.format('YYYY-MM-DD'),
          },
        }
      );
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      message.error('تعذر تحميل سجل التدقيق');
    } finally {
      setLoading(false);
    }
  }, [hospitalId, page, pageSize, action, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AuditLogRow> = [
    {
      title: 'الوقت',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'العملية',
      dataIndex: 'action_label',
      width: 140,
      render: (label: string) => <Tag color="blue">{label}</Tag>,
    },
    {
      title: 'الملخص',
      dataIndex: 'summary',
      ellipsis: true,
    },
    {
      title: 'المستخدم',
      key: 'user',
      width: 120,
      render: (_, r) => r.user?.name || r.user?.username || '—',
    },
    {
      title: 'مرجع',
      dataIndex: 'entity_id',
      width: 80,
      render: (id: number | null) => (id != null ? `#${id}` : '—'),
    },
  ];

  return (
    <div className="d-card">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        سجل العمليات الحساسة: حذف، صرف صيدلية، تسجيل/إزالة الوجه، ترقية مريض. للمشرفين فقط.
      </Text>
      <div className="d-toolbar">
        <Select
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={ACTION_OPTIONS}
          style={{ minWidth: isMobile ? '100%' : 200 }}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            setRange(v as [Dayjs, Dayjs] | null);
            setPage(1);
          }}
          style={{ width: '100%', maxWidth: 360 }}
        />
        <span className="grow" />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          تحديث
        </Button>
      </div>
      <div className="d-table-scroll">
        <Table<AuditLogRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          locale={{ emptyText: <Empty description="لا توجد أحداث في الفترة المحددة" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `${t} حدث`,
            onChange: (p) => setPage(p),
          }}
          scroll={{ x: 'max-content' }}
          size={isMobile ? 'small' : 'middle'}
        />
      </div>
    </div>
  );
};

export default DialysisAuditLogPanel;
