import React from 'react';
import { QueryClientProvider } from 'react-query';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DialysisProvider } from './dialysisContext';
import { DialysisThemeProvider } from './DialysisThemeProvider';
import { dialysisQueryClient } from './hooks/dialysisQueryConfig';
import DialysisAppLayout from './DialysisAppLayout';
import OverviewPage from './pages/OverviewPage';
import PatientsPage from './pages/PatientsPage';
import PatientMedicalRecordPage from './pages/PatientMedicalRecordPage';
import SessionsPage from './pages/SessionsPage';
import LivePage from './pages/LivePage';
import LiveTvPage from './pages/LiveTvPage';
import HallsPage from './pages/HallsPage';
import ShiftsPage from './pages/ShiftsPage';
import MachinesPage from './pages/MachinesPage';
import InventoryPage from './pages/InventoryPage';
import PharmacyDialysisPage from './pages/PharmacyDialysisPage';
import DialysisPharmacyStockPage from './pages/DialysisPharmacyStockPage';
import ReportsPage from './pages/ReportsPage';
import MinistryDashboardPage from './pages/ministry/MinistryDashboardPage';
import AccessPage from './pages/AccessPage';
import { useDialysisRouteCaps } from './dialysisRouteAccess';

/** مستخدم صيدلية فقط أو طبيب مطابقة — توجيه للصفحة المناسبة */
const DialysisIndexGate: React.FC = () => {
  const caps = useDialysisRouteCaps();
  if (caps.pharmacyOnly) {
    return <Navigate to="pharmacy" replace />;
  }
  if (caps.reconciliationLanding) {
    return <Navigate to="statistics" replace />;
  }
  return <OverviewPage />;
};

const DialysisApp: React.FC = () => (
  <QueryClientProvider client={dialysisQueryClient}>
    <DialysisProvider>
      <DialysisThemeProvider>
      <Routes>
        <Route path="live/tv" element={<LiveTvPage />} />
        <Route element={<DialysisAppLayout />}>
          <Route index element={<DialysisIndexGate />} />
          <Route path="patients/:patientId" element={<PatientMedicalRecordPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="halls" element={<HallsPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="machines" element={<MachinesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="pharmacy" element={<PharmacyDialysisPage />} />
          <Route path="pharmacy-stock" element={<DialysisPharmacyStockPage />} />
          <Route path="reports" element={<ReportsPage variant="reports" />} />
          <Route path="ministry" element={<MinistryDashboardPage />} />
          <Route path="statistics" element={<ReportsPage variant="statistics" />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
      </Routes>
      </DialysisThemeProvider>
    </DialysisProvider>
  </QueryClientProvider>
);

export default DialysisApp;
