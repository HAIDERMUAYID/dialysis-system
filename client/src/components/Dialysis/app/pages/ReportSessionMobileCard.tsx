import React from 'react';
import { CalendarOutlined, CameraOutlined, EnvironmentOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import dayjs from 'dayjs';
import { formatDialysisCalendarDate } from '../../dialysisConstants';
import { sessionPatientPhotoUrl } from '../dialysisPatientPhoto';
import {
  type ReconRowStatus,
  PatientMatchBadge,
  ReconStatusIcon,
  ReportPatientCell,
} from './reportSessionDisplay';

export interface ReportSessionRow {
  id: number;
  sessionDate: string;
  status: string;
  intakeKind?: string | null;
  shift?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  patientMatchMethod?: 'MANUAL' | 'FACE' | null;
  hospital?: { name: string } | null;
  dialysisPatient?: { fullName: string; id?: number; photoUrl?: string | null; photo_url?: string | null } | null;
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
  reconStatus: ReconRowStatus;
  creatorName: string;
  accentColor?: string;
  showFaceEnroll?: boolean;
  onFaceEnroll?: () => void;
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
  reconStatus,
  creatorName,
  accentColor = '#157c67',
  showFaceEnroll = false,
  onFaceEnroll,
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
            <ReportPatientCell
              name={row.dialysisPatient?.fullName}
              photoUrl={sessionPatientPhotoUrl(row.dialysisPatient)}
              cacheKey={row.dialysisPatient?.id}
              size={32}
            />
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
          <PatientMatchBadge method={row.patientMatchMethod} compact />
          <span className="d-report-session-card__recon-icon">
            <ReconStatusIcon status={reconStatus} size={18} />
          </span>
          {showHospital && row.hospital?.name ? (
            <Tag className="d-report-session-card__hosp" color="geekblue">
              {row.hospital.name}
            </Tag>
          ) : null}
          {showFaceEnroll && onFaceEnroll ? (
            <Button
              type="primary"
              size="small"
              ghost
              className="d-report-session-card__face-btn"
              icon={<CameraOutlined />}
              onClick={onFaceEnroll}
            >
              تسجيل الوجه
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default ReportSessionMobileCard;
