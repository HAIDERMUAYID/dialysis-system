export interface MinistryDashboardKpis {
  total: number;
  uniquePatients: number;
  completed: number;
  active: number;
  cancelled: number;
  morning: number;
  evening: number;
  scheduled: number;
  unscheduled: number;
  emergency: number;
  statisticalEntries: number;
  reconMatched: number;
  reconMissing: number;
  reconSupply: number;
  reconNa: number;
  statCoveragePct: number;
}

export interface MinistryHospitalRow {
  hospitalId: number;
  name: string;
  code?: string | null;
  province?: string | null;
  directorate?: string | null;
  registeredPatients: number;
  sessionsTotal: number;
  sessionsCompleted: number;
  sessionsActive: number;
  uniquePatients: number;
  morning: number;
  evening: number;
  scheduled: number;
  emergency: number;
  statisticalEntries: number;
  statCoveragePct: number;
  reconMatched: number;
  reconMissing: number;
  reconSupply: number;
}

export interface MinistryDashboardSummary {
  period: { from: string; to: string };
  generatedAt: string;
  kpis: MinistryDashboardKpis | null;
  byHospital: MinistryHospitalRow[];
  charts: {
    byHall: { name: string; value: number }[];
    byHospital: { name: string; value: number }[];
  };
}
