import React from 'react';
import { Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  MedicineBoxOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import DialysisBrandLogo from '../DialysisBrandLogo';
import { DIALYSIS_MINISTRY_LINE, DIALYSIS_SYSTEM_TITLE } from '../dialysisBrand';
import { formatDialysisCalendarDate } from '../../dialysisConstants';

const { Text } = Typography;

export interface DossierItemLite {
  id: number;
  name: string;
  sku?: string | null;
  baseUnitLabel?: string | null;
}

export interface ConsumptionLine {
  id: number;
  quantityBase: unknown;
  displayUnitCode?: string | null;
  item?: DossierItemLite | null;
}

export interface DispenseLine {
  id: number;
  dosage?: string | null;
  quantity: unknown;
  dispenseUnitCode?: string | null;
  dispenseUnitQty?: unknown;
  instructions?: string | null;
  frequencyKind?: string;
  dialysisItem?: DossierItemLite | null;
  drugCatalog?: {
    drugName?: string | null;
    drugNameAr?: string | null;
    form?: string | null;
    strength?: string | null;
  } | null;
}

export interface SessionDossierRow {
  id: number;
  sessionDate: string;
  shift: string;
  status: string;
  weightPreKg?: unknown;
  weightPostKg?: unknown;
  preSystolic?: number | null;
  preDiastolic?: number | null;
  postSystolic?: number | null;
  postDiastolic?: number | null;
  ufGoalMl?: number | null;
  ktV?: unknown;
  complicationsNote?: string | null;
  nursingNote?: string | null;
  notes?: string | null;
  location?: { hallName: string; bedCode: string } | null;
  shiftSlot?: { name: string } | null;
  machine?: {
    id: number;
    assetTag?: string | null;
    model?: string | null;
    serialNumber?: string | null;
  } | null;
  consumptions?: ConsumptionLine[];
  pharmacyDispense?: {
    status: string;
    lines?: DispenseLine[];
  } | null;
}

export interface TreatmentHistoryRow {
  kind: 'PHARMACY_DISPENSE' | 'SESSION_CONSUMPTION';
  sessionId: number;
  sessionDate: string;
  shift: string;
  status?: string;
  itemName: string | null;
  quantity: string;
  unitCode?: string | null;
  dosage?: string | null;
  instructions?: string | null;
  frequencyKind?: string;
}

function shiftLabelAr(shift: string): string {
  if (shift === 'MORNING') return 'صباحي';
  if (shift === 'EVENING') return 'مسائي';
  return shift || '—';
}

function sessionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'مكتملة',
    ACTIVE: 'نشطة',
    SCHEDULED: 'مجدولة',
    CANCELLED: 'ملغاة',
  };
  return map[status] ?? status;
}

function sessionStatusColor(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'success',
    ACTIVE: 'processing',
    SCHEDULED: 'warning',
    CANCELLED: 'default',
  };
  return map[status] ?? 'default';
}

/** أوزان/كميات — يدعم Prisma Decimal */
export function formatDossierNum(v: unknown, digits = 2): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(digits);
  if (typeof v === 'string') {
    const n = parseFloat(v.trim().replace(',', '.'));
    if (Number.isFinite(n)) return n.toFixed(digits);
    return v.trim() || '—';
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as { toNumber?: () => number; toString?: () => string };
    if (typeof o.toNumber === 'function') {
      try {
        const n = o.toNumber();
        if (Number.isFinite(n)) return n.toFixed(digits);
      } catch {
        /* ignore */
      }
    }
    if (typeof o.toString === 'function') {
      const n = parseFloat(String(o.toString()).replace(',', '.'));
      if (Number.isFinite(n)) return n.toFixed(digits);
      return String(o.toString());
    }
  }
  const n = Number(v);
  if (Number.isFinite(n)) return n.toFixed(digits);
  return '—';
}

export function dispenseLineLabel(line: DispenseLine): string {
  return (
    line.dialysisItem?.name ||
    line.drugCatalog?.drugNameAr ||
    line.drugCatalog?.drugName ||
    'صنف غير مسمّى'
  );
}

function frequencyLabel(kind?: string): string {
  if (kind === 'DAILY_TO_NEXT_DIALYSIS') return 'يومي حتى الغسلة القادمة';
  if (kind === 'PER_SESSION') return 'عند الجلسة';
  return kind || '—';
}

function treatmentKindTag(kind: TreatmentHistoryRow['kind']) {
  if (kind === 'PHARMACY_DISPENSE') {
    return (
      <Tag color="purple" icon={<MedicineBoxOutlined />}>
        صرف صيدلة
      </Tag>
    );
  }
  return (
    <Tag color="cyan" icon={<ToolOutlined />}>
      استهلاك جلسة
    </Tag>
  );
}

export function sessionHasClinicalExtras(s: SessionDossierRow): boolean {
  const lines = s.pharmacyDispense?.lines?.length ?? 0;
  const cons = s.consumptions?.length ?? 0;
  return (
    lines > 0 ||
    cons > 0 ||
    Boolean(s.complicationsNote || s.nursingNote || s.notes)
  );
}

export function PatientDossierCover({
  patientName,
  hospitalName,
  fileNumber,
  patientId,
  sessionTotal,
  treatmentCount,
  generatedAt,
}: {
  patientName: string;
  hospitalName: string;
  fileNumber: string | null;
  patientId: number;
  sessionTotal: number;
  treatmentCount: number;
  generatedAt: string;
}) {
  return (
    <section className="d-medical-dossier-cover" dir="rtl" aria-label="غلاف الملف الطبي">
      <div className="d-medical-dossier-cover-bg" aria-hidden />
      <div className="d-medical-dossier-cover-stripe" aria-hidden />
      <div className="d-medical-dossier-cover-inner">
        <div className="d-medical-dossier-cover-brand">
          <DialysisBrandLogo size="xl" />
          <div>
            <div className="d-medical-dossier-cover-ministry">{DIALYSIS_MINISTRY_LINE}</div>
            <div className="d-medical-dossier-cover-system">{DIALYSIS_SYSTEM_TITLE}</div>
          </div>
        </div>
        <h2 className="d-medical-dossier-cover-title">الملف الطبي الشامل للمريض</h2>
        <p className="d-medical-dossier-cover-sub">
          وثيقة موحّدة تجمع السجل السريري، جلسات الغسل، العلاجات، والمتابعة — بصيغة قريبة من الملف
          الورقي المسلّم من المستشفى
        </p>
        <div className="d-medical-dossier-cover-patient">
          <span className="d-medical-dossier-cover-patient-label">المريض</span>
          <span className="d-medical-dossier-cover-patient-name">{patientName}</span>
        </div>
        <dl className="d-medical-dossier-cover-meta">
          <div>
            <dt>المستشفى</dt>
            <dd>{hospitalName || '—'}</dd>
          </div>
          <div>
            <dt>رقم الملف الداخلي</dt>
            <dd>{fileNumber || '—'}</dd>
          </div>
          <div>
            <dt>المعرّف في النظام</dt>
            <dd>#{patientId}</dd>
          </div>
          <div>
            <dt>إجمالي الجلسات</dt>
            <dd>{sessionTotal}</dd>
          </div>
          <div>
            <dt>سجلات علاج / صرف</dt>
            <dd>{treatmentCount}</dd>
          </div>
          <div>
            <dt>تاريخ إصدار الملف</dt>
            <dd>{generatedAt}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function SessionClinicalDetail({ session }: { session: SessionDossierRow }) {
  const lines = session.pharmacyDispense?.lines ?? [];
  const cons = session.consumptions ?? [];
  const notes = [session.complicationsNote, session.nursingNote, session.notes].filter(Boolean);

  if (!sessionHasClinicalExtras(session)) {
    return <Text type="secondary">لا تفاصيل إضافية لهذه الجلسة</Text>;
  }

  return (
    <div className="d-dossier-session-detail">
      {lines.length > 0 && (
        <div className="d-dossier-session-detail-block">
          <h4>
            <MedicineBoxOutlined /> صرف الصيدلة
            {session.pharmacyDispense?.status && (
              <Tag style={{ marginInlineStart: 8 }}>{session.pharmacyDispense.status}</Tag>
            )}
          </h4>
          <ul className="d-dossier-treatment-list">
            {lines.map((line) => (
              <li key={line.id}>
                <strong>{dispenseLineLabel(line)}</strong>
                <span>
                  {formatDossierNum(line.quantity, 2)}
                  {line.dispenseUnitCode ? ` ${line.dispenseUnitCode}` : ''}
                  {line.dosage ? ` · جرعة: ${line.dosage}` : ''}
                  {line.frequencyKind ? ` · ${frequencyLabel(line.frequencyKind)}` : ''}
                </span>
                {line.instructions && (
                  <Text type="secondary" className="d-dossier-treatment-instr">
                    {line.instructions}
                  </Text>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cons.length > 0 && (
        <div className="d-dossier-session-detail-block">
          <h4>
            <ToolOutlined /> مواد مستهلكة في الجلسة
          </h4>
          <ul className="d-dossier-treatment-list">
            {cons.map((c) => (
              <li key={c.id}>
                <strong>{c.item?.name ?? 'صنف'}</strong>
                <span>
                  {formatDossierNum(c.quantityBase, 2)}
                  {c.displayUnitCode || c.item?.baseUnitLabel
                    ? ` ${c.displayUnitCode || c.item?.baseUnitLabel}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="d-dossier-session-detail-block">
          <h4>ملاحظات سريرية</h4>
          <p className="d-dossier-session-notes">{notes.join(' — ')}</p>
        </div>
      )}
    </div>
  );
}

export function PatientDossierSessionTimeline({
  sessions,
  formatMachine,
}: {
  sessions: SessionDossierRow[];
  formatMachine: (s: SessionDossierRow) => string;
}) {
  if (sessions.length === 0) {
    return <Empty description="لا توجد جلسات مسجّلة" />;
  }

  return (
    <div className="d-dossier-timeline" role="list">
      {sessions.map((s, idx) => {
        const lines = s.pharmacyDispense?.lines?.length ?? 0;
        const cons = s.consumptions?.length ?? 0;
        return (
          <article key={s.id} className="d-dossier-timeline-card" role="listitem">
            <div className="d-dossier-timeline-rail" aria-hidden>
              <span className="d-dossier-timeline-dot" />
              {idx < sessions.length - 1 && <span className="d-dossier-timeline-line" />}
            </div>
            <div className="d-dossier-timeline-body">
              <header className="d-dossier-timeline-head">
                <time dateTime={s.sessionDate}>
                  {formatDialysisCalendarDate(s.sessionDate)}
                </time>
                <Tag color={sessionStatusColor(s.status)}>{sessionStatusLabel(s.status)}</Tag>
                <span className="d-dossier-timeline-shift">{shiftLabelAr(s.shift)}</span>
              </header>
              <dl className="d-dossier-timeline-metrics">
                <div>
                  <dt>المكان</dt>
                  <dd>
                    {s.location ? `${s.location.hallName} — ${s.location.bedCode}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>الجهاز</dt>
                  <dd>{formatMachine(s)}</dd>
                </div>
                <div>
                  <dt>وزن قبل/بعد</dt>
                  <dd>
                    {formatDossierNum(s.weightPreKg)} / {formatDossierNum(s.weightPostKg)} كغ
                  </dd>
                </div>
                <div>
                  <dt>Kt/V</dt>
                  <dd>{formatDossierNum(s.ktV)}</dd>
                </div>
              </dl>
              {(lines > 0 || cons > 0) && (
                <div className="d-dossier-timeline-tags">
                  {lines > 0 && <Tag color="purple">{lines} صرف</Tag>}
                  {cons > 0 && <Tag color="cyan">{cons} استهلاك</Tag>}
                </div>
              )}
              <SessionClinicalDetail session={s} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PatientDossierTreatmentsTable({
  rows,
  printLayout,
}: {
  rows: TreatmentHistoryRow[];
  printLayout?: boolean;
}) {
  const columns: ColumnsType<TreatmentHistoryRow> = [
    {
      title: 'تاريخ الجلسة',
      key: 'd',
      width: 108,
      render: (_, r) => formatDialysisCalendarDate(r.sessionDate),
    },
    {
      title: 'الوردية',
      key: 'sh',
      width: 78,
      render: (_, r) => shiftLabelAr(r.shift),
    },
    {
      title: 'النوع',
      key: 'kind',
      width: 118,
      render: (_, r) => treatmentKindTag(r.kind),
    },
    {
      title: 'الصنف / العلاج',
      key: 'item',
      ellipsis: true,
      render: (_, r) => r.itemName || '—',
    },
    {
      title: 'الكمية',
      key: 'qty',
      width: 88,
      render: (_, r) => {
        const u = r.unitCode ? ` ${r.unitCode}` : '';
        return `${r.quantity}${u}`;
      },
    },
    {
      title: 'الجرعة / التعليمات',
      key: 'extra',
      ellipsis: true,
      render: (_, r) => {
        const parts = [
          r.dosage,
          r.frequencyKind ? frequencyLabel(r.frequencyKind) : null,
          r.instructions,
        ].filter(Boolean);
        return parts.length ? parts.join(' · ') : '—';
      },
    },
  ];

  return (
    <Table<TreatmentHistoryRow>
      rowKey={(_, i) => String(i)}
      size="small"
      className="d-medical-print-table"
      scroll={printLayout ? undefined : { x: 'max-content' }}
      pagination={
        printLayout ? false : { pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} سجل` }
      }
      dataSource={rows}
      columns={columns}
      locale={{
        emptyText: <Empty description="لا توجد سجلات علاج أو صرف ضمن الجلسات المحمّلة" />,
      }}
    />
  );
}
