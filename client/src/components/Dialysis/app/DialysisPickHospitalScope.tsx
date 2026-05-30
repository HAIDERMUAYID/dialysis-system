import React from 'react';
import { Alert, Button, Card, Col, Row, Select, Spin, Typography } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { useDialysisContext } from './dialysisContext';
import './dialysis-pick-hospital-scope.css';

const { Title, Paragraph, Text } = Typography;

export interface DialysisPickHospitalScopeProps {
  title: string;
  description: string;
}

/**
 * عند اختيار «جميع المستشفيات» أو عدم جاهزية النطاق — صفحات تحتاج hospital_id رقمياً.
 * تعرض بطاقة بعرض المحتوى مع اختيار صريح بدل Empty صغير في منتصف فراغ أبيض.
 */
export const DialysisPickHospitalScope: React.FC<DialysisPickHospitalScopeProps> = ({
  title,
  description,
}) => {
  const { hospitals, setHospitalId, loading } = useDialysisContext();

  if (loading) {
    return (
      <div className="d-pick-hospital-scope">
        <Card bordered={false} className="d-pick-hospital-scope__card">
          <div className="d-pick-hospital-scope__loading">
            <Spin size="large" />
            <Text type="secondary">جاري تحميل المستشفيات…</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (!hospitals.length) {
    return (
      <div className="d-pick-hospital-scope">
        <Alert
          type="warning"
          showIcon
          message="لا توجد مستشفيات مرتبطة بحسابك في وحدة الغسل."
          description="اطلب من المشرف ربطك بمستشفى من «إدارة الوصول»."
        />
      </div>
    );
  }

  const showQuickGrid = hospitals.length <= 16;

  return (
    <div className="d-pick-hospital-scope">
      <Card bordered={false} className="d-pick-hospital-scope__card">
        <div className="d-pick-hospital-scope__head">
          <BankOutlined className="d-pick-hospital-scope__icon" aria-hidden />
          <div>
            <Title level={4} className="d-pick-hospital-scope__title">
              {title}
            </Title>
            <Paragraph type="secondary" className="d-pick-hospital-scope__desc">
              {description}
            </Paragraph>
            <Text type="secondary" className="d-pick-hospital-scope__hint">
              يمكنك أيضاً اختيار المستشفى من «نطاق العمل» في القائمة الجانبية أو من الشريط العلوي على الهاتف.
            </Text>
          </div>
        </div>

        <Select
          className="d-pick-hospital-scope__select"
          size="large"
          showSearch
          optionFilterProp="label"
          placeholder="اختر مستشفى العمل…"
          options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
          onChange={(v) => {
            if (typeof v === 'number') setHospitalId(v);
          }}
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.trim().toLowerCase())
          }
        />

        {showQuickGrid ? (
          <Row gutter={[12, 12]} className="d-pick-hospital-scope__grid">
            {hospitals.map((h) => (
              <Col xs={24} sm={12} md={8} lg={6} key={h.id}>
                <Button block size="large" type="default" onClick={() => setHospitalId(h.id)}>
                  {h.name}
                </Button>
              </Col>
            ))}
          </Row>
        ) : (
          <Paragraph type="secondary" className="d-pick-hospital-scope__many">
            عدد كبير من المستشفيات — استخدم حقل البحث أعلاه للوصول السريع.
          </Paragraph>
        )}
      </Card>
    </div>
  );
};
