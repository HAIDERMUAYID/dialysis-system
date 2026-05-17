import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AntdConfig } from './config/antd.config';
import Login from './components/Auth/LoginModern';
import WelcomeMessage from './components/Welcome/WelcomeMessage';
import InquiryDashboard from './components/Dashboards/InquiryDashboardModern';
import LabDashboard from './components/Dashboards/LabDashboardModern';
import PharmacyDashboard from './components/Dashboards/PharmacyDashboardModern';
import DoctorDashboard from './components/Dashboards/DoctorDashboardModern';
import AdminDashboard from './components/Dashboards/AdminDashboardModern';
import PatientFullReportPage from './components/Reports/PatientFullReportPage';
import PrintReportPage from './components/Reports/PrintReportPage';
import LabCatalogManagement from './components/Lab/LabCatalogManagement';
import LabPanelsManagement from './components/Lab/LabPanelsManagement';
import DrugsCatalogManagement from './components/Pharmacy/DrugsCatalogManagement';
import PrescriptionSetsManagement from './components/Pharmacy/PrescriptionSetsManagement';
import DialysisApp from './components/Dialysis/app/DialysisApp';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useGlobalShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './components/Common/KeyboardShortcutsHelp';
import './App.css';
import { resolveAppHomeRoute } from './utils/appHomeRoute';

/** اسم مستعار: تحديثات ساخنة قديمة أو كود لم يُحفظ قد يشير إلى DialysisDashboard بدون استيراد */
const DialysisDashboard = DialysisApp;

const PrivateRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
  /** أيّ صلاحية من القائمة يكفي (إلى جانب المدير) */
  requiredAnyPermission?: string[];
}> = ({ children, allowedRoles, requiredPermission, requiredAnyPermission }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">جاري التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // مدير له وصول كامل
  if (user.role === 'admin') return <>{children}</>;

  if (requiredAnyPermission && requiredAnyPermission.length > 0) {
    const hasAny = requiredAnyPermission.some((p) => user.permissions?.includes(p));
    if (hasAny) return <>{children}</>;
    if (allowedRoles && allowedRoles.includes(user.role)) return <>{children}</>;
    return <div className="error">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (!requiredPermission || !user.permissions?.includes(requiredPermission)) {
      return <div className="error">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
    }
  }

  if (requiredPermission && !user.permissions?.includes(requiredPermission)) {
    if (!allowedRoles || !allowedRoles.includes(user.role)) {
      return <div className="error">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
    }
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Global keyboard shortcuts
  useGlobalShortcuts();

  return (
    <>
      <Routes>
      {/* Root route - redirect to appropriate dashboard */}
      <Route path="/" element={
        loading ? (
          <div className="loading">جاري التحميل...</div>
        ) : user ? (
          <Navigate to={resolveAppHomeRoute(user)} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      
      <Route path="/login" element={
        user ? (
          <Navigate to={resolveAppHomeRoute(user)} replace />
        ) : <Login />
      } />

      <Route
        path="/dialysis-login"
        element={
          loading ? (
            <div className="loading">جاري التحميل...</div>
          ) : user ? (
            <Navigate to={resolveAppHomeRoute(user)} replace />
          ) : (
            <Login redirectAfterLogin="/dialysis" />
          )
        }
      />
      
      <Route
        path="/inquiry"
        element={
          <PrivateRoute allowedRoles={['inquiry']}>
            <InquiryDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/lab"
        element={
          <PrivateRoute allowedRoles={['lab', 'lab_manager']}>
            <LabDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/lab_manager"
        element={
          <PrivateRoute allowedRoles={['lab_manager']}>
            <LabDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/pharmacist"
        element={
          <PrivateRoute allowedRoles={['pharmacist', 'pharmacy_manager']}>
            <PharmacyDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/pharmacy_manager"
        element={
          <PrivateRoute allowedRoles={['pharmacy_manager']}>
            <PharmacyDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/doctor"
        element={
          <PrivateRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/admin"
        element={
          <PrivateRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/patients/:patientId/full-report"
        element={<PatientFullReportPage />}
      />
      
      <Route
        path="/patients/:patientId/print"
        element={<PrintReportPage />}
      />
      
      {/* Lab Catalog Management Routes */}
      <Route
        path="/lab/catalog"
        element={
          <PrivateRoute allowedRoles={['admin', 'lab_manager']}>
            <LabCatalogManagement />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/lab/panels"
        element={
          <PrivateRoute allowedRoles={['admin', 'lab', 'lab_manager']}>
            <LabPanelsManagement />
          </PrivateRoute>
        }
      />
      
      {/* Pharmacy Catalog Management Routes */}
      <Route
        path="/pharmacy/catalog"
        element={
          <PrivateRoute allowedRoles={['admin', 'pharmacy_manager']}>
            <DrugsCatalogManagement />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/pharmacy/sets"
        element={
          <PrivateRoute allowedRoles={['admin', 'pharmacist', 'pharmacy_manager']}>
            <PrescriptionSetsManagement />
          </PrivateRoute>
        }
      />

      <Route
        path="/dialysis/*"
        element={
          <PrivateRoute
            allowedRoles={['dialysis_staff']}
            requiredAnyPermission={[
              'dialysis:view',
              'dialysis:pharmacy:view',
              'dialysis:pharmacy:dispense',
              'dialysis:pharmacy:inventory',
            ]}
          >
            <DialysisDashboard />
          </PrivateRoute>
        }
      />
      
    </Routes>
    <KeyboardShortcutsHelp
      open={showShortcutsHelp}
      onClose={() => setShowShortcutsHelp(false)}
    />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AntdConfig>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </AntdConfig>
    </ThemeProvider>
  );
};

export default App;
