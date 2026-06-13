import React from 'react';
import { Avatar, Button, Space, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface Props {
  patientId: number;
  patientName: string;
  photoUrl?: string | null;
  confidence?: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const DialysisFaceConfirmPanel: React.FC<Props> = ({
  patientId,
  patientName,
  photoUrl,
  confidence,
  onConfirm,
  onCancel,
  loading,
}) => {
  const src = photoUrl || undefined;

  return (
    <div className="d-face-confirm-panel">
      <Title level={5} style={{ marginBottom: 12, textAlign: 'center' }}>
        تأكيد هوية المريض
      </Title>
      <div className="d-face-confirm-panel__card">
        <Avatar size={88} src={src} icon={<UserOutlined />} />
        <div className="d-face-confirm-panel__meta">
          <Text strong style={{ fontSize: 18 }}>
            {patientName}
          </Text>
          <Text type="secondary">#{patientId}</Text>
          {confidence != null ? (
            <Tag color="green">ثقة التعرف {Math.round(confidence * 100)}%</Tag>
          ) : null}
        </div>
      </div>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}>
        تأكد أن الوجه يطابق المريض قبل إنشاء الجلسة
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Button
          block
          type="primary"
          size="large"
          icon={<CheckOutlined />}
          loading={loading}
          onClick={onConfirm}
        >
          نعم — هذا المريض
        </Button>
        <Button block size="large" icon={<CloseOutlined />} onClick={onCancel}>
          ليس هذا المريض
        </Button>
      </Space>
    </div>
  );
};

export default DialysisFaceConfirmPanel;
