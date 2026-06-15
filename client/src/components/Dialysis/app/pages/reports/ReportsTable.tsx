import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { List, Table, Tag, Tooltip, Typography } from 'antd';
import { formatDialysisCalendarDate } from '../../../dialysisConstants';
import { DIALYSIS_FACE_ENABLED } from '../../../face/dialysisFaceConfig';
import { sessionPatientPhotoUrl } from '../../dialysisPatientPhoto';
import ReportSessionMobileCard from '../ReportSessionMobileCard';
import {
  PatientMatchBadge,
  ReconStatusIcon,
  ReportPatientCell,
} from '../reportSessionDisplay';
import {
  INTAKE_KIND_TAG_COLOR,
  INTAKE_LABEL_AR,
  INTAKE_ACCENT_HEX,
  SHIFT_LABEL_AR,
  STATUS_LABEL_AR,
  STATUS_TAG_COLOR,
} from './reportsPageConstants';
import type { PatientLookupRow, SessionReportRow } from './reportsPageTypes';
import {
  computeReconStatus,
  patientHasFaceEnrolled,
  sessionCreatorDisplayName,
} from './reportsPageUtils';

const { Title, Text } = Typography;

export interface ReportsTableProps {
  filteredReportRows: SessionReportRow[];
  reportLoading: boolean;
  reportTotal: number;
  reportTablePage: number;
  setReportTablePage: (page: number) => void;
  reportTablePageSize: number;
  isMobile: boolean;
  showHospitalInReports: boolean;
  statCoverageKeys: Set<string>;
  supplyMismatchKeys: Set<string>;
  canEditPatient: boolean;
  onFaceEnroll: (patient: PatientLookupRow) => void;
}

const ReportsTable: React.FC<ReportsTableProps> = ({
  filteredReportRows,
  reportLoading,
  reportTotal,
  reportTablePage,
  setReportTablePage,
  reportTablePageSize,
  isMobile,
  showHospitalInReports,
  statCoverageKeys,
  supplyMismatchKeys,
  canEditPatient,
  onFaceEnroll,
}) => {
  const sessionReportColumns = useMemo(
    () => [
      {
        title: '#',
        key: 'idx',
        width: 70,
        render: (_: unknown, __: SessionReportRow, idx: number) =>
          (reportTablePage - 1) * reportTablePageSize + idx + 1,
      },
      ...(showHospitalInReports
        ? [
            {
              title: 'المستشفى',
              key: 'hosp',
              width: 160,
              render: (_: unknown, r: SessionReportRow) =>
                r.hospital?.name ? <Tag color="geekblue">{r.hospital.name}</Tag> : '—',
            },
          ]
        : []),
      {
        title: 'المريض',
        key: 'p',
        width: 200,
        render: (_: unknown, r: SessionReportRow) => (
          <ReportPatientCell
            name={r.dialysisPatient?.fullName}
            photoUrl={sessionPatientPhotoUrl(r.dialysisPatient)}
            cacheKey={r.dialysisPatient?.id}
          />
        ),
      },
      {
        title: 'الصالة',
        key: 'h',
        render: (_: unknown, r: SessionReportRow) => r.location?.hallName || '—',
      },
      {
        title: 'السرير',
        key: 'b',
        render: (_: unknown, r: SessionReportRow) => r.location?.bedCode || '—',
      },
      {
        title: 'تاريخ الجلسة',
        dataIndex: 'sessionDate',
        render: (d: string) => formatDialysisCalendarDate(d),
      },
      {
        title: 'الوقت',
        key: 't',
        render: (_: unknown, r: SessionReportRow) =>
          r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—',
      },
      {
        title: 'النوبة',
        key: 's',
        render: (_: unknown, r: SessionReportRow) =>
          SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—',
      },
      {
        title: 'نوع الجلسة',
        key: 'ik',
        render: (_: unknown, r: SessionReportRow) => {
          const k = r.intakeKind || '';
          const label = INTAKE_LABEL_AR[k] || '—';
          return <Tag color={INTAKE_KIND_TAG_COLOR[k] || 'default'}>{label}</Tag>;
        },
      },
      {
        title: 'الحالة',
        key: 'st',
        render: (_: unknown, r: SessionReportRow) => {
          const st = (r.status || '').toUpperCase();
          const label = STATUS_LABEL_AR[st] || r.status || '—';
          return <Tag color={STATUS_TAG_COLOR[st] || 'default'}>{label}</Tag>;
        },
      },
      {
        title: 'اسم الموظف',
        key: 'cu',
        width: 140,
        render: (_: unknown, r: SessionReportRow) => {
          const name = sessionCreatorDisplayName(r);
          const hint =
            r.created_by_username && name !== r.created_by_username
              ? `اسم الدخول: ${r.created_by_username}`
              : null;
          const inner = <span className="d-report-user-cell">{name}</span>;
          return hint ? <Tooltip title={hint}>{inner}</Tooltip> : inner;
        },
      },
      {
        title: 'الإدخال',
        key: 'pm',
        width: 110,
        align: 'center' as const,
        render: (_: unknown, r: SessionReportRow) => (
          <PatientMatchBadge method={r.patientMatchMethod} compact />
        ),
      },
      {
        title: 'إحصاء',
        key: 'rc',
        width: 72,
        align: 'center' as const,
        render: (_: unknown, r: SessionReportRow) => {
          const rs = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
          return <ReconStatusIcon status={rs} />;
        },
      },
      { title: 'ملاحظات', dataIndex: 'notes', render: (n?: string | null) => n || '—' },
    ],
    [showHospitalInReports, statCoverageKeys, supplyMismatchKeys, reportTablePage, reportTablePageSize]
  );

  return (
    <div className="d-report-sessions-section">
      <div className="d-report-sessions-header">
        <div className="d-report-sessions-header__text">
          <Title level={5}>{isMobile ? 'الجلسات' : 'كل الجلسات حسب الفلاتر'}</Title>
          <Text type="secondary">حسب الفلاتر المحددة</Text>
        </div>
        <span className="d-report-sessions-count">{reportTotal}</span>
      </div>
      {isMobile ? (
        <List<SessionReportRow>
          className="d-report-session-list"
          loading={reportLoading}
          dataSource={filteredReportRows}
          rowKey="id"
          pagination={{
            current: reportTablePage,
            pageSize: reportTablePageSize,
            total: reportTotal,
            onChange: (page) => setReportTablePage(page),
            showTotal: (t) => `إجمالي ${t}`,
            size: 'small',
            simple: true,
          }}
          locale={{ emptyText: 'لا توجد جلسات للفلاتر المحددة' }}
          renderItem={(row, idx) => {
            const ik = row.intakeKind || '';
            const st = (row.status || '').toUpperCase();
            const rs = computeReconStatus(row, statCoverageKeys, supplyMismatchKeys);
            return (
              <List.Item>
                <ReportSessionMobileCard
                  row={row}
                  index={(reportTablePage - 1) * reportTablePageSize + idx + 1}
                  showHospital={showHospitalInReports}
                  shiftLabel={SHIFT_LABEL_AR[(row.shift || '').toUpperCase()] || '—'}
                  intakeLabel={INTAKE_LABEL_AR[ik] || '—'}
                  intakeColor={INTAKE_KIND_TAG_COLOR[ik] || 'default'}
                  accentColor={INTAKE_ACCENT_HEX[ik] || '#6366f1'}
                  statusLabel={STATUS_LABEL_AR[st] || row.status || '—'}
                  statusColor={STATUS_TAG_COLOR[st] || 'default'}
                  reconStatus={rs}
                  creatorName={sessionCreatorDisplayName(row)}
                  showFaceEnroll={
                    DIALYSIS_FACE_ENABLED &&
                    canEditPatient &&
                    Boolean(row.dialysisPatient?.id) &&
                    !patientHasFaceEnrolled(row.dialysisPatient)
                  }
                  onFaceEnroll={
                    row.dialysisPatient?.id
                      ? () =>
                          onFaceEnroll({
                            id: row.dialysisPatient!.id!,
                            fullName: row.dialysisPatient!.fullName,
                            hasFaceEnrolled: patientHasFaceEnrolled(row.dialysisPatient),
                          })
                      : undefined
                  }
                />
              </List.Item>
            );
          }}
        />
      ) : (
        <div className="d-table-scroll">
          <Table<SessionReportRow>
            rowKey="id"
            loading={reportLoading}
            dataSource={filteredReportRows}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: reportTablePage,
              pageSize: reportTablePageSize,
              total: reportTotal,
              onChange: (page) => setReportTablePage(page),
              showTotal: (t) => `إجمالي ${t} جلسة`,
            }}
            columns={sessionReportColumns}
          />
        </div>
      )}
    </div>
  );
};

export default ReportsTable;
