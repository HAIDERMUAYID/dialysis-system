import React from 'react';
import { Modal, Progress, Typography } from 'antd';

const { Text } = Typography;

export interface ReportsPdfExportModalProps {
  open: boolean;
  step: number;
}

const ReportsPdfExportModal: React.FC<ReportsPdfExportModalProps> = ({ open, step }) => (
  <Modal
    open={open}
    footer={null}
    closable={false}
    centered
    title="تصدير PDF"
    maskClosable={false}
    zIndex={1400}
  >
    <Progress
      percent={step}
      status={step >= 100 ? 'success' : 'active'}
      strokeColor={{ '0%': '#157c67', '100%': '#0d9488' }}
    />
    <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
      {step < 50 ? 'تجهيز محتوى التقرير…' : step < 100 ? 'تحويل إلى PDF…' : 'اكتمل التصدير'}
    </Text>
  </Modal>
);

export default ReportsPdfExportModal;
