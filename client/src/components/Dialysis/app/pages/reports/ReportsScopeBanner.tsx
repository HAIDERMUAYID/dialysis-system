import React, { useState } from 'react';
import { Button, Card, Space, Tag, Typography } from 'antd';
import type { DialysisPrintFilterChip } from '../../dialysisPrint';
import DialysisBrandLogo from '../../DialysisBrandLogo';
import { DIALYSIS_MINISTRY_LINE } from '../../dialysisBrand';

const { Text, Title } = Typography;

export interface ReportsScopeBannerProps {
  isMobile: boolean;
  reportHospitalLabel: string;
  printTitle: string;
  printSessionSummary: string;
  reportPrintFilters: DialysisPrintFilterChip[];
}

const ReportsScopeBanner: React.FC<ReportsScopeBannerProps> = ({
  isMobile,
  reportHospitalLabel,
  printTitle,
  printSessionSummary,
  reportPrintFilters,
}) => {
  const [scopeTagsExpanded, setScopeTagsExpanded] = useState(false);

  return (
    <Card
      className={`d-report-scope-banner${isMobile ? ' d-report-scope-banner--mobile' : ''}${scopeTagsExpanded ? ' is-expanded' : ''}`}
      size="small"
    >
      <div className="d-report-scope-banner__inner">
        <DialysisBrandLogo size="md" />
        <div className="d-report-scope-banner__body">
          <Text type="secondary" className="d-report-scope-banner__ministry">
            {DIALYSIS_MINISTRY_LINE}
          </Text>
          <Title level={5} style={{ margin: '4px 0 8px' }}>
            {reportHospitalLabel}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {printTitle} — {printSessionSummary}
          </Text>
          {isMobile ? (
            <>
              <Button
                type="link"
                className="d-report-scope-toggle"
                onClick={() => setScopeTagsExpanded((v) => !v)}
              >
                {scopeTagsExpanded ? 'إخفاء الفلاتر' : 'عرض تفاصيل الفلاتر'}
              </Button>
              <Space
                size={[6, 6]}
                wrap
                className={`d-report-scope-tags-collapsed${scopeTagsExpanded ? '' : ''}`}
              >
                {reportPrintFilters.map((f) => (
                  <Tag key={f.label} color="processing" style={{ margin: 0 }}>
                    {f.label}: {f.value}
                  </Tag>
                ))}
              </Space>
            </>
          ) : (
            <Space size={[6, 6]} wrap>
              {reportPrintFilters.map((f) => (
                <Tag key={f.label} color="processing" style={{ margin: 0 }}>
                  {f.label}: {f.value}
                </Tag>
              ))}
            </Space>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ReportsScopeBanner;
