export interface StatisticalBulkApiEntry {
  dialysis_patient_id: number;
  session_date: string;
  shift: 'MORNING' | 'EVENING';
  folder_reference?: string | null;
  notes?: string | null;
}

export interface StatisticalBulkPreviewRow {
  rowNumber: number;
  patientNameInput?: string;
  patientIdInput?: string;
  sessionDateInput?: string;
  shiftInput?: string;
  folderReference?: string;
  notes?: string;
  dialysisPatientId?: number;
  resolvedPatientName?: string;
  sessionDate?: string;
  shift?: 'MORNING' | 'EVENING';
  status: 'valid' | 'error' | 'warning';
  message?: string;
}

export interface StatisticalBulkParseResult {
  rows: StatisticalBulkPreviewRow[];
  validEntries: StatisticalBulkApiEntry[];
  fileName: string;
}
