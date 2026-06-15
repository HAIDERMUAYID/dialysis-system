import axios from 'axios';
import type { DialysisHospitalScope } from '../../dialysisContext';
import type { MinistryDashboardSummary } from './ministryDashboardTypes';

export async function fetchMinistryDashboardSummary(
  hospitalId: DialysisHospitalScope,
  dateFrom: string,
  dateTo: string
): Promise<MinistryDashboardSummary> {
  const { data } = await axios.get<MinistryDashboardSummary>('/api/dialysis/ministry/summary', {
    params: {
      hospital_id: hospitalId,
      date_from: dateFrom,
      date_to: dateTo,
    },
  });
  return data;
}

export async function downloadMinistryExcelExport(
  hospitalId: DialysisHospitalScope,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const { data } = await axios.get<ArrayBuffer>('/api/dialysis/ministry/export.xlsx', {
    params: {
      hospital_id: hospitalId,
      date_from: dateFrom,
      date_to: dateTo,
    },
    responseType: 'arraybuffer',
  });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ministry-dialysis-${dateFrom}_${dateTo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
