import React from 'react';
import { Button, Typography } from 'antd';
import { LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import DialysisBrandLogo from './DialysisBrandLogo';
import { useDialysisDefaultRoute } from './dialysisRouteAccess';
import './dialysis-forbidden.css';

const { Title, Paragraph } = Typography;

const DialysisForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const homeRoute = useDialysisDefaultRoute();

  return (
    <div className="d-forbidden-page">
      <DialysisBrandLogo size="sm" className="d-forbidden-page__logo" />
      <div className="d-forbidden-page__icon" aria-hidden>
        <LockOutlined />
      </div>
      <Title level={3} className="d-forbidden-page__title">
        ليس لديك صلاحية لهذه الصفحة
      </Title>
      <Paragraph type="secondary" className="d-forbidden-page__desc">
        حسابك لا يسمح بالوصول إلى هذا القسم من D-IRS. تواصل مع مشرف الوحدة إذا كنت تحتاج صلاحية
        إضافية.
      </Paragraph>
      <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(homeRoute)}>
        العودة للصفحة المسموحة
      </Button>
    </div>
  );
};

export default DialysisForbiddenPage;
