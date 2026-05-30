import React from 'react';
import { Button, Tag, Typography } from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatDialysisCalendarDate } from '../../dialysisConstants';

const { Text } = Typography;

export interface SessionMobileCardRow {
  id: number;
  hospitalId?: number;
  sessionDate: string;
  status: string;
  intakeKind?: string | null;
  startedAt?: string | null;
  dialysisPatient?: { fullName: string; kind?: string };
  location?: { hallName: string; bedCode: string } | null;
  hospital?: { name: string };
  created_by_display?: string | null;
}

interface StatusMeta {
  label: string;
  color: string;
}

interface SessionMobileCardProps {
  row: SessionMobileCardRow;
  showHospital: boolean;
  statusMeta: StatusMeta;
  intakeLabel?: string;
  intakeColor?: string;
  canEdit: boolean;
  canDelete: boolean;
  onOpenRecord: () => void;
  onEnd: () => void;
  onDelete: () => void;
}

const SessionMobileCard: React.FC<SessionMobileCardProps> = ({
  row,
  showHospital,
  statusMeta,
  intakeLabel,
  intakeColor,
  canEdit,
  canDelete,
  onOpenRecord,
  onEnd,
  onDelete,
}) => {
  const patientKind =
    row.dialysisPatient?.kind === 'EMERGENCY'
      ? 'طارئ'
      : row.dialysisPatient?.kind
        ? 'دائم'
        : null;

  return (
    <article className="d-session-card">
      <div className="d-session-card__head">
        <Text strong className="d-session-card__name">
          {row.dialysisPatient?.fullName ?? '—'}
        </Text>
        <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
      </div>

      {showHospital && row.hospital?.name ? (
        <Tag color="geekblue" className="d-session-card__hospital">
          {row.hospital.name}
        </Tag>
      ) : null}

      <div className="d-session-card__meta">
        <span>
          <CalendarOutlined />
          {formatDialysisCalendarDate(row.sessionDate)}
          {row.startedAt ? ` · ${dayjs(row.startedAt).format('HH:mm')}` : ''}
        </span>
        {row.location ? (
          <span>
            <EnvironmentOutlined />
            {row.location.hallName} — {row.location.bedCode}
          </span>
        ) : null}
      </div>

      <div className="d-session-card__tags">
        {patientKind ? (
          <Tag color={row.dialysisPatient?.kind === 'EMERGENCY' ? 'volcano' : 'blue'}>
            {patientKind}
          </Tag>
        ) : null}
        {intakeLabel ? (
          <Tag color={intakeColor || 'default'}>{intakeLabel}</Tag>
        ) : (
          <Tag>غير مصنّف</Tag>
        )}
      </div>

      <div className="d-session-card__creator">
        <Text type="secondary">أضافها:</Text>
        <Text>{row.created_by_display ?? '—'}</Text>
      </div>

      <div className="d-session-card__actions">
        <Button size="small" icon={<FileSearchOutlined />} onClick={onOpenRecord}>
          السجل
        </Button>
        {canEdit && row.status === 'ACTIVE' && (
          <Button size="small" type="primary" icon={<StopOutlined />} onClick={onEnd}>
            إنهاء
          </Button>
        )}
        {canDelete && (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
        )}
      </div>
    </article>
  );
};

export default SessionMobileCard;
