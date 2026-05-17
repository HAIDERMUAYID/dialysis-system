import React from 'react';
import { CalendarOutlined, UserOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import dayjs from 'dayjs';
import { formatDialysisCalendarDate } from '../../dialysisConstants';

export interface ReportSessionRow {
  id: number;
  sessionDate: string;
  status: string;
  intakeKind?: string | null;
  shift?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  hospital?: { name: string } | null;
  dialysisPatient?: { fullName: string } | null;
  location?: { hallName: string; bedCode: string } | null;
  created_by_display?: string | null;
  created_by_username?: string | null;
}

interface ReportSessionMobileCardProps {
  row: ReportSessionRow;
  index?: number;
  showHospital: boolean;
  shiftLabel: string;
  intakeLabel: string;
  intakeColor: string;
  statusLabel: string;
  statusColor: string;
  reconLabel: string;
  reconColor: string;
  creatorName: string;
  accentColor?: string;
}

const ReportSessionMobileCard: React.FC<ReportSessionMobileCardProps> = ({
  row,
  index,
  showHospital,
  shiftLabel,
  intakeLabel,
  intakeColor,
  statusLabel,
  statusColor,
  reconLabel,
  reconColor,
  creatorName,
  accentColor = '#157c67',
}) => {
  const hall = row.location?.hallName?.trim();
  const bed = row.location?.bedCode?.trim();
  const location =
    hall || bed ? [hall, bed].filter(Boolean).join(' · ') : null;
  const time = row.startedAt ? dayjs(row.startedAt).format('HH:mm') : null;
  const dateStr = formatDialysisCalendarDate(row.sessionDate);

  return (
    <article
      className="d-report-session-card"
      style={{ ['--session-accent' as string]: accentColor }}
    >
      <span className="d-report-session-card__accent" aria-hidden />
      <div className="d-report-session-card__main">
        <div className="d-report-session-card__top">
          <div className="d-report-session-card__id-name">
            {index != null ? <span className="d-report-session-card__idx">{index}</span> : null}
            <span className="d-report-session-card__name">
              {row.dialysisPatient?.fullName || '—'}
            </span>
          </div>
          <Tag className="d-report-session-card__status" color={statusColor}>
            {statusLabel}
          </Tag>
        </div>

        <div className="d-report-session-card__meta">
          <span className="d-report-session-card__chip">
            <CalendarOutlined />
            {dateStr}
            {time ? ` · ${time}` : ''}
          </span>
          <span className="d-report-session-card__chip">{shiftLabel}</span>
          <Tag className="d-report-session-card__type" color={intakeColor}>
            {intakeLabel}
          </Tag>
        </div>

        <div className="d-report-session-card__bottom">
          <span className="d-report-session-card__chip d-report-session-card__chip--muted">
            <UserOutlined />
            {creatorName}
          </span>
          {location ? (
            <span className="d-report-session-card__chip d-report-session-card__chip--muted">
              <EnvironmentOutlined />
              {location}
            </span>
          ) : null}
          <Tag className="d-report-session-card__recon" color={reconColor}>
            {reconLabel}
          </Tag>
          {showHospital && row.hospital?.name ? (
            <Tag className="d-report-session-card__hosp" color="geekblue">
              {row.hospital.name}
            </Tag>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default ReportSessionMobileCard;
