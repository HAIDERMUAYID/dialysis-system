import React, { useMemo, useState } from 'react';
import { Alert, Button, Space, Table, Tag, Typography, Upload, message } from 'antd';
import {
  CheckOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PatientLookupRow } from './reportsPageTypes';
import {
  downloadStatisticalBulkTemplate,
  parseStatisticalBulkFile,
} from './parseStatisticalBulkFile';
import type {
  StatisticalBulkApiEntry,
  StatisticalBulkPreviewRow,
} from './statisticalBulkImportTypes';
import { SHIFT_LABEL_AR } from './reportsPageConstants';
import { formatDialysisCalendarDate } from '../../../dialysisConstants';

const { Text } = Typography;

export interface StatisticalBulkImportPanelProps {
  patients: PatientLookupRow[];
  loadingPatients?: boolean;
  onReloadPatients?: () => void;
  onSubmit: (entries: StatisticalBulkApiEntry[]) => Promise<void>;
  submitting?: boolean;
}

const StatisticalBulkImportPanel: React.FC<StatisticalBulkImportPanelProps> = ({
  patients,
  loadingPatients,
  onReloadPatients,
  onSubmit,
  submitting,
}) => {
  const [previewRows, setPreviewRows] = useState<StatisticalBulkPreviewRow[]>([]);
  const [validEntries, setValidEntries] = useState<StatisticalBulkApiEntry[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const stats = useMemo(() => {
    const valid = previewRows.filter((r) => r.status === 'valid').length;
    const warning = previewRows.filter((r) => r.status === 'warning').length;
    const error = previewRows.filter((r) => r.status === 'error').length;
    return { valid, warning, error, total: previewRows.length };
  }, [previewRows]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseStatisticalBulkFile(file, patients);
      setPreviewRows(result.rows);
      setValidEntries(result.validEntries);
      setFileName(result.fileName);
      if (!result.rows.length) {
        message.warning('لم يُعثر على صفوف قابلة للاستيراد');
      } else if (result.validEntries.length === 0) {
        message.error('كل الصفوف تحتوي أخطاء — راجع المعاينة');
      } else {
        message.success(`تمت قراءة ${result.rows.length} صف — ${result.validEntries.length} جاهز للحفظ`);
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err.message || 'تعذر قراءة الملف');
      setPreviewRows([]);
      setValidEntries([]);
      setFileName(null);
    } finally {
      setParsing(false);
    }
    return false;
  };

  const clearPreview = () => {
    setPreviewRows([]);
    setValidEntries([]);
    setFileName(null);
  };

  const saveValid = async () => {
    if (!validEntries.length) {
      message.warning('لا توجد صفوف صالحة للحفظ');
      return;
    }
    await onSubmit(validEntries);
    clearPreview();
  };

  const columns: ColumnsType<StatisticalBulkPreviewRow> = [
    { title: '#', dataIndex: 'rowNumber', width: 56 },
    {
      title: 'المريض',
      key: 'patient',
      ellipsis: true,
      render: (_, r) =>
        r.resolvedPatientName ||
        r.patientNameInput ||
        (r.patientIdInput ? `#${r.patientIdInput}` : '—'),
    },
    {
      title: 'التاريخ',
      key: 'date',
      width: 120,
      render: (_, r) =>
        r.sessionDate
          ? formatDialysisCalendarDate(r.sessionDate)
          : r.sessionDateInput || '—',
    },
    {
      title: 'الوردية',
      key: 'shift',
      width: 90,
      render: (_, r) => (r.shift ? SHIFT_LABEL_AR[r.shift] : r.shiftInput || '—'),
    },
    {
      title: 'الحالة',
      key: 'status',
      width: 110,
      render: (_, r) => {
        if (r.status === 'valid') return <Tag color="green">جاهز</Tag>;
        if (r.status === 'warning') return <Tag color="orange">تحذير</Tag>;
        return <Tag color="red">خطأ</Tag>;
      },
    },
    {
      title: 'ملاحظة',
      dataIndex: 'message',
      ellipsis: true,
      render: (m: string | undefined) => m || '—',
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Text type="secondary">
        ارفع ملف Excel (.xlsx) أو CSV. يُطابق النظام المرضى بالاسم أو رقم المريض، ثم تعرض معاينة
        قبل الحفظ. الأعمدة المدعومة: اسم المريض، رقم المريض، تاريخ الغسل، الوردية، مرجع المجلد،
        ملاحظات.
      </Text>

      <Space wrap>
        <Button icon={<DownloadOutlined />} onClick={downloadStatisticalBulkTemplate}>
          تنزيل نموذج Excel
        </Button>
        {onReloadPatients ? (
          <Button icon={<ReloadOutlined />} onClick={onReloadPatients} loading={loadingPatients}>
            تحديث قائمة المرضى
          </Button>
        ) : null}
        {previewRows.length > 0 ? (
          <Button onClick={clearPreview}>مسح المعاينة</Button>
        ) : null}
      </Space>

      <Upload.Dragger
        accept=".xlsx,.xls,.csv"
        showUploadList={false}
        multiple={false}
        beforeUpload={(file) => {
          void handleFile(file);
          return false;
        }}
        disabled={parsing || submitting}
      >
        <p className="ant-upload-drag-icon">
          <CloudUploadOutlined />
        </p>
        <p className="ant-upload-text">اسحب ملف Excel/CSV أو انقر للاختيار</p>
        <p className="ant-upload-hint">الحد الأقصى الموصى به: 500 صف في الملف</p>
      </Upload.Dragger>

      {fileName ? (
        <Alert
          type={stats.error ? 'warning' : 'info'}
          showIcon
          message={`الملف: ${fileName}`}
          description={
            <>
              {stats.total} صف — {stats.valid + stats.warning} جاهز للحفظ — {stats.error} بخطأ
              {stats.warning > 0 ? ` — ${stats.warning} بتحذير مطابقة` : null}
            </>
          }
        />
      ) : null}

      {previewRows.length > 0 ? (
        <>
          <div className="d-table-scroll">
            <Table<StatisticalBulkPreviewRow>
              rowKey={(r) => String(r.rowNumber)}
              size="small"
              dataSource={previewRows}
              columns={columns}
              pagination={{ pageSize: 15, showTotal: (t) => `${t} صف` }}
              scroll={{ x: 'max-content' }}
            />
          </div>
          <Button
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            loading={submitting}
            disabled={!validEntries.length}
            onClick={() => void saveValid()}
          >
            حفظ {validEntries.length} سطر صالح
          </Button>
        </>
      ) : null}
    </Space>
  );
};

export default StatisticalBulkImportPanel;
