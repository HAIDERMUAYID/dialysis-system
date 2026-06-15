import React from 'react';
import { Table, Typography } from 'antd';
import type { MonthlyStatRow } from './reportsPageTypes';

const { Title, Text } = Typography;

export interface ReportsExtendedAnalyticsProps {
  shouldShowExtendedSections: boolean;
  topPatients: { name: string; count: number }[];
  monthlyStats: MonthlyStatRow[];
}

const ReportsExtendedAnalytics: React.FC<ReportsExtendedAnalyticsProps> = ({
  shouldShowExtendedSections,
  topPatients,
  monthlyStats,
}) => {
  if (shouldShowExtendedSections) {
    return (
      <>
        <div className="d-table-scroll" style={{ marginBottom: 16 }}>
          <Title level={5}>أكثر 10 مراجعين غسلات في الفترة</Title>
          <Table
            rowKey={(r) => r.name}
            pagination={false}
            dataSource={topPatients.map((r, idx) => ({ rank: idx + 1, ...r }))}
            columns={[
              { title: 'الترتيب', dataIndex: 'rank', width: 90 },
              { title: 'اسم المريض', dataIndex: 'name' },
              { title: 'عدد الجلسات', dataIndex: 'count', width: 130 },
            ]}
          />
        </div>

        <div className="d-table-scroll" style={{ marginBottom: 16 }}>
          <Title level={5}>الإحصاءات الشهرية</Title>
          <Table
            rowKey={(r) => r.month}
            dataSource={monthlyStats}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'الشهر', dataIndex: 'month' },
              { title: 'الإجمالي', dataIndex: 'total' },
              { title: 'صباحية', dataIndex: 'morning' },
              { title: 'مسائية', dataIndex: 'evening' },
              { title: 'مجدولة', dataIndex: 'scheduled' },
              { title: 'غير مجدولة', dataIndex: 'unscheduled' },
              { title: 'طارئة', dataIndex: 'emergency' },
              { title: 'مرضى فريدون', dataIndex: 'uniquePatients' },
              { title: 'معدل يومي', dataIndex: 'dailyAverage' },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <Text type="secondary" className="d-report-extended-hint" style={{ display: 'block', marginBottom: 16 }}>
      الجداول التفصيلية (أعلى 10، شهري، نوع/نوبة) تظهر عند فترة 20 يوماً أو أكثر.
    </Text>
  );
};

export default ReportsExtendedAnalytics;
