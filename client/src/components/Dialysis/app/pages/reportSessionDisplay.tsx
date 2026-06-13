import React from 'react';
import { Avatar, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  MinusOutlined,
  ScanOutlined,
  UserOutlined,
} from '@ant-design/icons';

export type ReconRowStatus = 'matched' | 'missing' | 'supply' | 'na';

export type PatientMatchMethod = 'MANUAL' | 'FACE' | null | undefined;

export const RECON_STATUS_TOOLTIP: Record<ReconRowStatus, string> = {
  matched: 'مسجّل في الإحصاء',
  missing: 'غير مسجّل في الإحصاء',
  supply: 'فرق في المواد',
  na: 'لا ينطبق',
};

export function reconPrintSymbol(status: ReconRowStatus): string {
  if (status === 'matched') return '✓';
  if (status === 'missing') return '✗';
  if (status === 'supply') return '!';
  return '—';
}

export function patientMatchLabel(method?: PatientMatchMethod): string {
  return method === 'FACE' ? 'وجه' : 'يدوي';
}

/** مسار الصورة النسبي → رابط كامل للعرض والطباعة */
export function resolveDialysisAssetUrl(
  path?: string | null,
  cacheKey?: string | number
): string | undefined {
  if (!path?.trim()) return undefined;
  let base: string;
  if (/^(https?:|data:|blob:)/i.test(path)) {
    base = path;
  } else {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    base = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
  if (cacheKey == null) return base;
  return `${base}${base.includes('?') ? '&' : '?'}v=${cacheKey}`;
}

export function buildReportPatientPrintHtml(
  name: string,
  photoUrl?: string | null,
  esc: (s: string) => string = (s) => s
): string {
  const label = esc(name || '—');
  const abs = resolveDialysisAssetUrl(photoUrl);
  if (abs) {
    return `<div class="patient-cell"><img class="patient-photo" src="${esc(abs)}" alt="" crossorigin="anonymous" /><span class="patient-name">${label}</span></div>`;
  }
  return `<div class="patient-cell"><span class="patient-photo patient-photo--empty" aria-hidden="true"></span><span class="patient-name">${label}</span></div>`;
}

export const ReconStatusIcon: React.FC<{ status: ReconRowStatus; size?: number }> = ({
  status,
  size = 20,
}) => {
  const tip = RECON_STATUS_TOOLTIP[status];
  const style = { fontSize: size };

  let icon: React.ReactNode;
  if (status === 'matched') {
    icon = <CheckCircleOutlined style={{ ...style, color: '#16a34a' }} />;
  } else if (status === 'missing') {
    icon = <CloseCircleOutlined style={{ ...style, color: '#ea580c' }} />;
  } else if (status === 'supply') {
    icon = <ExclamationCircleOutlined style={{ ...style, color: '#dc2626' }} />;
  } else {
    icon = <MinusOutlined style={{ ...style, color: '#94a3b8' }} />;
  }

  return (
    <Tooltip title={tip}>
      <span className="d-report-recon-icon" role="img" aria-label={tip}>
        {icon}
      </span>
    </Tooltip>
  );
};

export const PatientMatchBadge: React.FC<{ method?: PatientMatchMethod; compact?: boolean }> = ({
  method,
  compact = false,
}) => {
  const isFace = method === 'FACE';
  const label = patientMatchLabel(method);
  return (
    <Tag
      className="d-report-match-badge"
      color={isFace ? 'purple' : 'default'}
      icon={isFace ? <ScanOutlined /> : <FormOutlined />}
    >
      {compact ? label : isFace ? 'تعرف بالوجه' : 'إدخال يدوي'}
    </Tag>
  );
};

export const ReportPatientCell: React.FC<{
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  cacheKey?: string | number;
}> = ({ name, photoUrl, size = 36, cacheKey }) => (
  <div className="d-report-patient-cell">
    <Avatar
      size={size}
      src={resolveDialysisAssetUrl(photoUrl, cacheKey)}
      icon={<UserOutlined />}
      className="d-report-patient-cell__avatar"
    />
    <span className="d-report-patient-cell__name">{name?.trim() || '—'}</span>
  </div>
);
