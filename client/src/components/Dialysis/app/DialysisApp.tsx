import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DialysisProvider } from './dialysisContext';
import DialysisAppLayout from './DialysisAppLayout';
import OverviewPage from './pages/OverviewPage';
import PatientsPage from './pages/PatientsPage';
import PatientMedicalRecordPage from './pages/PatientMedicalRecordPage';
import SessionsPage from './pages/SessionsPage';
import LivePage from './pages/LivePage';
import HallsPage from './pages/HallsPage';
import ShiftsPage from './pages/ShiftsPage';
import MachinesPage from './pages/MachinesPage';
import InventoryPage from './pages/InventoryPage';
import PharmacyDialysisPage from './pages/PharmacyDialysisPage';
import DialysisPharmacyStockPage from './pages/DialysisPharmacyStockPage';
import ReportsPage from './pages/ReportsPage';
import AccessPage from './pages/AccessPage';
import { usePermission } from '../../../hooks/usePermission';

/** مستخدم صيدلية فقط (بدون dialysis:view) يُوجَّه مباشرة لصفحة الصيدلية */
const DialysisIndexGate: React.FC = () => {
  const canFull = usePermission('dialysis:view');
  const permPharmView = usePermission('dialysis:pharmacy:view');
  const permPharmDisp = usePermission('dialysis:pharmacy:dispense');
  const permPharmInv = usePermission('dialysis:pharmacy:inventory');
  const canPharmOnly = permPharmView || permPharmDisp || permPharmInv;
  if (!canFull && canPharmOnly) {
    return <Navigate to="pharmacy" replace />;
  }
  return <OverviewPage />;
};

const DialysisApp: React.FC = () => (
  <DialysisProvider>
    <Routes>
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
        <Route path="statistics" element={<ReportsPage variant="statistics" />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  </DialysisProvider>
);

export default DialysisApp;
