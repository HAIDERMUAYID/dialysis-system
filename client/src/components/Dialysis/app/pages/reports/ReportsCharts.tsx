import React from 'react';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  PieChartOutlined,
  RiseOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Card, Col, Progress, Row, Space, Table, Typography } from 'antd';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_PALETTE } from './reportsPageConstants';
import type { ReportsData } from './useReportsData';

const { Text, Title } = Typography;

export interface ReportsChartsProps {
  kpis: ReportsData['kpis'];
  chartByHall: ReportsData['chartByHall'];
  chartByHospital: ReportsData['chartByHospital'];
  hospitalDistributionRows: ReportsData['hospitalDistributionRows'];
  chartByType: ReportsData['chartByType'];
  chartByShift: ReportsData['chartByShift'];
  chartByStatus: ReportsData['chartByStatus'];
  chartReconSummary: ReportsData['chartReconSummary'];
  monthlyTrendData: ReportsData['monthlyTrendData'];
  showHospitalInReports: boolean;
  isMobile: boolean;
  canRecon: boolean;
}

export const ReportsHero: React.FC<{ kpis: ReportsChartsProps['kpis']; isMobile: boolean }> = ({
  kpis,
  isMobile,
}) => (
  <div className="d-report-hero">
    <Space direction="vertical" size={6} className="d-report-hero-text">
      <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
        لوحة تحليل الجلسات
      </Title>
      {!isMobile ? (
        <Text type="secondary" style={{ maxWidth: 720 }}>
          مؤشرات ومخططات حسب الفلاتر — تُقارن كل جلسة حوكمة مع وجود سجل إحصائي لنفس المريض والتاريخ والنوبة.
          نسبة التغطية تستثني الجلسات الملغاة.
        </Text>
      ) : null}
    </Space>
    <div className="d-report-hero-progress">
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        تغطية السجل الإحصائي
      </Text>
      <Progress
        percent={kpis.statCoveragePct}
        strokeColor={{ '0%': '#6366f1', '100%': '#14b8a6' }}
        status="active"
        format={(p) => `${p}%`}
      />
    </div>
  </div>
);

export const ReportsKpiCards: React.FC<{ kpis: ReportsChartsProps['kpis'] }> = ({ kpis }) => (
  <>
    {[
      { label: 'إجمالي الجلسات', value: kpis.total, icon: <CalendarOutlined />, accent: '#6366f1' },
      { label: 'مرضى فريدون', value: kpis.uniquePatients, icon: <TeamOutlined />, accent: '#8b5cf6' },
      { label: 'مجدولة', value: kpis.scheduled, icon: <FileDoneOutlined />, accent: '#3b82f6' },
      { label: 'غير مجدولة', value: kpis.unscheduled, icon: <RiseOutlined />, accent: '#f59e0b' },
      { label: 'طارئة', value: kpis.emergency, icon: <ThunderboltOutlined />, accent: '#ec4899' },
      { label: 'صباحية', value: kpis.morning, icon: <PieChartOutlined />, accent: '#14b8a6' },
      { label: 'مسائية', value: kpis.evening, icon: <PieChartOutlined />, accent: '#0d9488' },
      { label: 'نشطة', value: kpis.active, icon: <CheckCircleOutlined />, accent: '#22c55e' },
      { label: 'منتهية', value: kpis.completed, icon: <CheckCircleOutlined />, accent: '#15803d' },
      { label: 'ملغاة', value: kpis.cancelled, icon: <WarningOutlined />, accent: '#94a3b8' },
      { label: 'مسجّل إحصاء', value: kpis.reconMatched, icon: <FileDoneOutlined />, accent: '#10b981' },
      { label: 'غير مسجّل', value: kpis.reconMissing, icon: <WarningOutlined />, accent: '#f97316' },
      { label: 'فرق مواد', value: kpis.reconSupply, icon: <WarningOutlined />, accent: '#dc2626' },
    ].map((c) => (
      <div key={c.label} className="d-report-kpi-card" style={{ ['--accent' as string]: c.accent }}>
        <span className="d-report-kpi-icon">{c.icon}</span>
        <div>
          <div className="d-report-kpi-value">{c.value}</div>
          <div className="d-report-kpi-label">{c.label}</div>
        </div>
      </div>
    ))}
  </>
);

export const ReportsChartsSection: React.FC<
  Pick<
    ReportsChartsProps,
    | 'showHospitalInReports'
    | 'chartByHospital'
    | 'hospitalDistributionRows'
    | 'chartByHall'
    | 'monthlyTrendData'
    | 'chartByType'
    | 'chartByShift'
    | 'chartByStatus'
    | 'chartReconSummary'
  >
> = ({
  showHospitalInReports,
  chartByHospital,
  hospitalDistributionRows,
  chartByHall,
  monthlyTrendData,
  chartByType,
  chartByShift,
  chartByStatus,
  chartReconSummary,
}) => (
  <>
    {showHospitalInReports ? (
      <Card
        size="small"
        title="توزيع الجلسات حسب المستشفى"
        className="d-report-chart-card"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div className="d-report-chart-plot" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartByHospital} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="جلسات" radius={[8, 8, 0, 0]}>
                    {chartByHospital.map((_, idx) => (
                      <Cell key={`hosp-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={hospitalDistributionRows}
              locale={{ emptyText: 'لا توجد جلسات في الفترة' }}
              columns={[
                { title: 'المستشفى', dataIndex: 'hospitalName', ellipsis: true },
                { title: 'عدد الجلسات', dataIndex: 'count', width: 110 },
                {
                  title: 'النسبة %',
                  dataIndex: 'pct',
                  width: 90,
                  render: (p: number) => `${p}%`,
                },
              ]}
            />
          </Col>
        </Row>
      </Card>
    ) : null}

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={14}>
        <Card size="small" title="توزيع الجلسات على الصالات" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartByHall} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartByHall.map((_, idx) => (
                    <Cell key={`hall-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card size="small" title="اتجاه الجلسات شهرياً" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dReportAreaTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dReportAreaTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={8}>
        <Card size="small" title="نوع الجلسة" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartByType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {chartByType.map((_, idx) => (
                    <Cell key={`type-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card size="small" title="النوبة" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartByShift}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {chartByShift.map((_, idx) => (
                    <Cell key={`shift-${idx}`} fill={CHART_PALETTE[(idx + 2) % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card size="small" title="حالة الجلسة" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartByStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {chartByStatus.map((_, idx) => (
                    <Cell key={`st-${idx}`} fill={CHART_PALETTE[(idx + 4) % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
    </Row>

    <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
      <Col xs={24} md={12} lg={10}>
        <Card size="small" title="مطابقة الجلسات مع الإحصاء" className="d-report-chart-card">
          <div className="d-report-chart-plot" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartReconSummary}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {chartReconSummary.map((_, idx) => (
                    <Cell key={`rc-${idx}`} fill={CHART_PALETTE[(idx + 1) % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
    </Row>
  </>
);

const ReportsCharts: React.FC<ReportsChartsProps> = (props) => {
  const { kpis, isMobile, canRecon } = props;

  return (
    <>
      <ReportsHero kpis={kpis} isMobile={isMobile} />
      {!canRecon ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 14, fontSize: 12 }}>
          بلا صلاحية مطابقة: يُعرض «مسجّل / غير مسجّل» من السجل الإحصائي فقط. كشف «فرق في المواد»
          يتطلّب صلاحية المطابقة.
        </Text>
      ) : null}
      <div className="d-report-kpi-grid">
        <ReportsKpiCards kpis={kpis} />
      </div>
      <ReportsChartsSection {...props} />
    </>
  );
};

export default ReportsCharts;
