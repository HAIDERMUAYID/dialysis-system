import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '../../../../../context/AuthContext';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../../dialysisContext';
import { useDialysisMobile } from '../../useDialysisMobile';
import DialysisMergedScopeBanner from '../../DialysisMergedScopeBanner';
import DialysisPageHeader from '../../DialysisPageHeader';
import DialysisPullRefresh from '../../DialysisPullRefresh';
import {
  downloadMinistryExcelExport,
  fetchMinistryDashboardSummary,
} from './ministryDashboardApi';
import { exportMinistryDashboardPdf } from './ministryDashboardExport';
import type { MinistryDashboardSummary, MinistryHospitalRow } from './ministryDashboardTypes';
import './ministry-dashboard.css';

const { Text } = Typography;

const MinistryDashboardPage: React.FC = () => {
  const { hospitalId, hospitals } = useDialysisContext();
  const { user } = useAuth();
  const isMobile = useDialysisMobile();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;

  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);
  const [summary, setSummary] = useState<MinistryDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const dateFrom = range[0].format('YYYY-MM-DD');
  const dateTo = range[1].format('YYYY-MM-DD');

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const data = await fetchMinistryDashboardSummary(hospitalId, dateFrom, dateTo);
      setSummary(data);
    } catch {
      message.error('تعذر تحميل لوحة الوزارة');
    } finally {
      setLoading(false);
    }
  }, [hospitalId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = summary?.kpis;

  const kpiCards = useMemo(
    () =>
      kpis
        ? [
            { key: 'total', label: 'إجمالي الجلسات', value: kpis.total, color: 'blue' },
            { key: 'patients', label: 'مرضى فريدون', value: kpis.uniquePatients, color: 'purple' },
            { key: 'completed', label: 'جلسات منتهية', value: kpis.completed, color: 'green' },
            { key: 'morning', label: 'صباحي', value: kpis.morning, color: 'cyan' },
            { key: 'evening', label: 'مسائي', value: kpis.evening, color: 'geekblue' },
            {
              key: 'coverage',
              label: 'تغطية الإحصاء',
              value: `${kpis.statCoveragePct}%`,
              color: kpis.statCoveragePct >= 90 ? 'green' : 'orange',
            },
            { key: 'stats', label: 'سطور السجل الإحصائي', value: kpis.statisticalEntries, color: 'gold' },
            { key: 'missing', label: 'ناقص في الإحصاء', value: kpis.reconMissing, color: 'red' },
          ]
        : [],
    [kpis]
  );

  const columns: ColumnsType<MinistryHospitalRow> = [
    { title: 'المستشفى', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'الرمز', dataIndex: 'code', key: 'code', width: 100, render: (v) => v || '—' },
    {
      title: 'مرضى مسجلون',
      dataIndex: 'registeredPatients',
      key: 'registeredPatients',
      width: 110,
    },
    { title: 'جلسات', dataIndex: 'sessionsTotal', key: 'sessionsTotal', width: 80 },
    { title: 'منتهية', dataIndex: 'sessionsCompleted', key: 'sessionsCompleted', width: 80 },
    { title: 'صباحي', dataIndex: 'morning', key: 'morning', width: 70 },
    { title: 'مسائي', dataIndex: 'evening', key: 'evening', width: 70 },
    {
      title: 'سطور إحصاء',
      dataIndex: 'statisticalEntries',
      key: 'statisticalEntries',
      width: 100,
    },
    {
      title: 'تغطية %',
      dataIndex: 'statCoveragePct',
      key: 'statCoveragePct',
      width: 90,
      render: (v: number) => (
        <Tag color={v >= 90 ? 'green' : v >= 70 ? 'orange' : 'red'}>{v}%</Tag>
      ),
    },
    { title: 'ناقص', dataIndex: 'reconMissing', key: 'reconMissing', width: 70 },
  ];

  const handlePdf = async () => {
    if (!summary || hospitalId == null) return;
    setExportingPdf(true);
    try {
      await exportMinistryDashboardPdf({
        summary,
        hospitalId,
        hospitals,
        printedBy: user?.name || user?.username || undefined,
      });
      message.success('تم تنزيل PDF');
    } catch {
      message.error('فشل تصدير PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExcel = async () => {
    if (hospitalId == null) return;
    setExportingExcel(true);
    try {
      await downloadMinistryExcelExport(hospitalId, dateFrom, dateTo);
      message.success('تم تنزيل Excel');
    } catch {
      message.error('فشل تصدير Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  const body = (
    <div className={isMobile ? 'd-ministry-page' : undefined}>
      <DialysisPageHeader
        title="لوحة الوزارة"
        subtitle="مؤشرات مجمّعة لوحدة الغسل الكلوي — للتقديم الرسمي. يمكن تصدير PDF أو Excel، مع أرشفة أسبوعية تلقائية عند تفعيل DIALYSIS_MINISTRY_REPORT_CRON على الخادم."
      />

      <DialysisMergedScopeBanner />

      <div className="d-card d-ministry-toolbar">
        <Text>الفترة:</Text>
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => v && setRange(v as [Dayjs, Dayjs])}
          allowClear={false}
          style={{ width: '100%', maxWidth: 360 }}
        />
        <span className="grow" />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          تحديث
        </Button>
        <Button
          icon={<FilePdfOutlined />}
          onClick={() => void handlePdf()}
          loading={exportingPdf}
          disabled={!summary}
        >
          PDF
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => void handleExcel()}
          loading={exportingExcel}
        >
          Excel
        </Button>
      </div>

      <Spin spinning={loading}>
        {!kpis && !loading ? (
          <div className="d-card">
            <Empty description="لا توجد بيانات للفترة المحددة" />
          </div>
        ) : (
          <>
            <div className={`d-ministry-kpis${isMobile ? ' d-ministry-kpis--mobile' : ''}`}>
              {kpiCards.map((c) => (
                <div key={c.key} className="d-ministry-kpi-card">
                  <Text type="secondary" className="d-ministry-kpi-card__label">
                    {c.label}
                  </Text>
                  <div className="d-ministry-kpi-card__value">
                    <Tag color={c.color}>{c.value}</Tag>
                  </div>
                </div>
              ))}
            </div>

            {mergedScope && (summary?.byHospital?.length ?? 0) > 1 ? (
              <div className="d-card">
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  تفصيل حسب المستشفى
                </Text>
                <div className="d-table-scroll">
                  <Table<MinistryHospitalRow>
                    rowKey="hospitalId"
                    size="small"
                    dataSource={summary?.byHospital ?? []}
                    columns={columns}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              </div>
            ) : null}

            {summary?.generatedAt ? (
              <Text type="secondary" className="d-ministry-generated">
                آخر تحديث: {dayjs(summary.generatedAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            ) : null}
          </>
        )}
      </Spin>
    </div>
  );

  if (isMobile) {
    return (
      <DialysisPullRefresh onRefresh={load} disabled={hospitalId == null}>
        {body}
      </DialysisPullRefresh>
    );
  }

  return body;
};

export default MinistryDashboardPage;
