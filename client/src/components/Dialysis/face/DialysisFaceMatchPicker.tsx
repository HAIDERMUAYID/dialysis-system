import React from 'react';
import { Button, Tag, Typography } from 'antd';
import { UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { FaceMatchRow } from './DialysisFaceIdentifyModal';
import { FACE_STRONG_MATCH_THRESHOLD } from './dialysisFaceConfig';

const { Text } = Typography;

interface Props {
  matches: FaceMatchRow[];
  onPick: (row: FaceMatchRow) => void;
  title?: string;
}

const DialysisFaceMatchPicker: React.FC<Props> = ({
  matches,
  onPick,
  title = 'اختر المريض الصحيح:',
}) => {
  if (!matches.length) return null;

  return (
    <div className="d-face-match-picker">
      <Text strong className="d-face-match-picker__title">
        {title}
      </Text>
      <div className="d-face-match-picker__list">
        {matches.map((row) => (
          <button
            key={row.patient_id}
            type="button"
            className="d-face-match-picker__row"
            onClick={() => onPick(row)}
          >
            <span className="d-face-match-picker__avatar">
              {row.photo_url ? (
                <img src={row.photo_url} alt="" />
              ) : (
                <UserOutlined />
              )}
            </span>
            <span className="d-face-match-picker__info">
              <span className="d-face-match-picker__name">{row.full_name}</span>
              <Tag
                color={row.confidence >= FACE_STRONG_MATCH_THRESHOLD ? 'success' : 'processing'}
                icon={
                  row.confidence >= FACE_STRONG_MATCH_THRESHOLD ? (
                    <CheckCircleOutlined />
                  ) : undefined
                }
              >
                {Math.round(row.confidence * 100)}%
              </Tag>
            </span>
            <Button type="primary" size="small" className="d-face-match-picker__pick">
              اختيار
            </Button>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DialysisFaceMatchPicker;
