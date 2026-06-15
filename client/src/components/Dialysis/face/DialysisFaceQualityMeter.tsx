import React from 'react';
import { Progress, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { FaceQualitySnapshot } from './dialysisFaceQuality';
import { qualityLevelColor } from './dialysisFaceQuality';
import { FACE_QUALITY_SIZE_LABEL } from './dialysisFaceConfig';

const { Text } = Typography;

interface Props {
  quality: FaceQualitySnapshot | null;
  compact?: boolean;
  /** سطر واحد — للهاتف أثناء التعرف التلقائي */
  minimal?: boolean;
}

const DialysisFaceQualityMeter: React.FC<Props> = ({ quality, compact, minimal }) => {
  if (!quality) {
    return (
      <div className="d-face-quality-meter d-face-quality-meter--idle">
        <Text type="secondary">بانتظار الكامره…</Text>
      </div>
    );
  }

  const color = qualityLevelColor(quality.level);
  const label =
    quality.level === 'excellent'
      ? 'ممتاز'
      : quality.level === 'good'
        ? 'جيد'
        : quality.level === 'fair'
          ? 'مقبول'
          : 'ضعيف';

  if (minimal) {
    return (
      <div className="d-face-quality-meter d-face-quality-meter--minimal">
        <Progress
          percent={quality.score}
          strokeColor={color}
          showInfo={false}
          size="small"
          style={{ flex: 1, marginBottom: 0 }}
        />
        <Text style={{ color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {label}
        </Text>
      </div>
    );
  }

  const items = [
    { key: 'face', label: 'وجه واحد', ok: quality.checks.singleFace && quality.checks.faceDetected },
    { key: 'size', label: FACE_QUALITY_SIZE_LABEL, ok: quality.checks.sizeOk },
    { key: 'light', label: 'الوضوح', ok: quality.checks.clarityOk },
    { key: 'tilt', label: 'استواء', ok: quality.checks.tiltOk },
    { key: 'center', label: 'توسيط', ok: quality.checks.centeredOk },
  ];

  return (
    <div className={`d-face-quality-meter${compact ? ' d-face-quality-meter--compact' : ''}`}>
      <div className="d-face-quality-meter__head">
        <Text strong style={{ color }}>
          جودة الوجه: {label}
        </Text>
        <Tag color={quality.ok ? 'success' : 'warning'}>{quality.score}%</Tag>
      </div>
      <Progress
        percent={quality.score}
        strokeColor={color}
        showInfo={false}
        size="small"
        style={{ marginBottom: compact ? 6 : 10 }}
      />
      {!compact ? (
        <Space size={[6, 6]} wrap>
          {items.map((item) => (
            <Tag
              key={item.key}
              icon={item.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={item.ok ? 'success' : 'default'}
            >
              {item.label}
            </Tag>
          ))}
        </Space>
      ) : null}
      <Text
        type={quality.ok ? 'success' : 'warning'}
        className="d-face-quality-meter__hint"
      >
        {quality.ok ? <CheckCircleOutlined /> : <WarningOutlined />}{' '}
        {quality.message}
      </Text>
    </div>
  );
};

export default DialysisFaceQualityMeter;
