import React from 'react';
import { Select } from 'antd';
import { DIALYSIS_FACE_ENABLED } from '../../../face/dialysisFaceConfig';
import { RECON_STATUS_LABEL, SHIFT_FILTER_OPTIONS } from './reportsPageConstants';
import type { PatientLookupRow, ReportReconFilter } from './reportsPageTypes';
import { patientHasFaceEnrolled } from './reportsPageUtils';

export interface ReportsFiltersProps {
  filterHall: string;
  setFilterHall: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterShift: string;
  setFilterShift: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterRecon: ReportReconFilter;
  setFilterRecon: (v: ReportReconFilter) => void;
  filterPatientMatch: string;
  setFilterPatientMatch: (v: string) => void;
  filterPatientId: number | undefined;
  setFilterPatientId: (v: number | undefined) => void;
  hallOptions: string[];
  reportPatientOptions: PatientLookupRow[];
}

const ReportsFilters: React.FC<ReportsFiltersProps> = ({
  filterHall,
  setFilterHall,
  filterType,
  setFilterType,
  filterShift,
  setFilterShift,
  filterStatus,
  setFilterStatus,
  filterRecon,
  setFilterRecon,
  filterPatientMatch,
  setFilterPatientMatch,
  filterPatientId,
  setFilterPatientId,
  hallOptions,
  reportPatientOptions,
}) => (
  <>
    <Select
      className="d-report-filter-field"
      value={filterHall}
      onChange={setFilterHall}
      placeholder="الصالة"
      options={[{ value: '', label: 'كل الصالات' }, ...hallOptions.map((h) => ({ value: h, label: h }))]}
    />
    <Select
      className="d-report-filter-field"
      value={filterType}
      onChange={setFilterType}
      placeholder="نوع الجلسة"
      options={[
        { value: '', label: 'كل الأنواع' },
        { value: 'SCHEDULED', label: 'مجدولة' },
        { value: 'OFF_SCHEDULE', label: 'غير مجدولة' },
        { value: 'EMERGENCY', label: 'طارئة' },
      ]}
    />
    <Select
      className="d-report-filter-field"
      value={filterShift}
      onChange={setFilterShift}
      placeholder="النوبة"
      options={SHIFT_FILTER_OPTIONS}
    />
    <Select
      className="d-report-filter-field"
      value={filterStatus}
      onChange={setFilterStatus}
      placeholder="حالة الجلسة"
      options={[
        { value: '', label: 'كل الحالات' },
        { value: 'ACTIVE', label: 'نشطة' },
        { value: 'COMPLETED', label: 'منتهية' },
        { value: 'CANCELLED', label: 'ملغاة' },
      ]}
    />
    <Select
      className="d-report-filter-field"
      value={filterRecon || ''}
      onChange={(v) => setFilterRecon((v || '') as ReportReconFilter)}
      placeholder="مطابقة الإحصاء"
      options={[
        { value: '', label: 'كل حالات المطابقة' },
        { value: 'matched', label: RECON_STATUS_LABEL.matched },
        { value: 'missing', label: RECON_STATUS_LABEL.missing },
        { value: 'supply', label: RECON_STATUS_LABEL.supply },
        { value: 'na', label: RECON_STATUS_LABEL.na },
      ]}
    />
    <Select
      className="d-report-filter-field"
      value={filterPatientMatch || ''}
      onChange={setFilterPatientMatch}
      placeholder="طريقة الإدخال / الوجه"
      options={[
        { value: '', label: 'كل طرق الإدخال' },
        { value: 'FACE', label: 'تعرف بالوجه' },
        { value: 'MANUAL', label: 'يدوي' },
        ...(DIALYSIS_FACE_ENABLED ? [{ value: 'NO_FACE', label: 'مرضى بلا بصمة' }] : []),
      ]}
    />
    <Select
      className="d-report-filter-field"
      allowClear
      showSearch
      optionFilterProp="label"
      value={filterPatientId}
      onChange={(v) => setFilterPatientId(v)}
      placeholder="المريض"
      options={reportPatientOptions.map((p) => ({
        value: p.id,
        label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})${
          patientHasFaceEnrolled(p) ? '' : ' — بلا بصمة'
        }`,
      }))}
    />
  </>
);

export default ReportsFilters;
