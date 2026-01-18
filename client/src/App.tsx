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
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useGlobalShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './components/Common/KeyboardShortcutsHelp';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">جاري التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <div className="error">ليس لديك صلاحية للوصول لهذه الصفحة</div>;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Global keyboard shortcuts
  useGlobalShortcuts();

  // Helper function to get dashboard route based on role
  const getDashboardRoute = (role: string | undefined): string => {
    if (!role) return '/login';
    switch (role) {
      case 'admin':
        return '/admin';
      case 'inquiry':
        return '/inquiry';
      case 'lab':
      case 'lab_manager':
        return '/lab';
      case 'pharmacist':
      case 'pharmacy_manager':
        return '/pharmacist';
      case 'doctor':
        return '/doctor';
      default:
        return '/login';
    }
  };

  return (
    <>
      <Routes>
      {/* Root route - redirect to appropriate dashboard */}
      <Route path="/" element={
        loading ? (
          <div className="loading">جاري التحميل...</div>
        ) : user ? (
          <Navigate to={getDashboardRoute(user.role)} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      
      <Route path="/login" element={
        user ? (
          <Navigate to={getDashboardRoute(user.role)} replace />
        ) : <Login />
      } />
      
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
      
      <Route path="/" element={
        user ? (
          user.role === 'admin' ? <Navigate to="/admin" /> :
          user.role === 'inquiry' ? <Navigate to="/inquiry" /> :
          user.role === 'lab' || user.role === 'lab_manager' ? <Navigate to="/lab" /> :
          user.role === 'pharmacist' || user.role === 'pharmacy_manager' ? <Navigate to="/pharmacist" /> :
          user.role === 'doctor' ? <Navigate to="/doctor" /> :
          <Navigate to="/login" />
        ) : <Navigate to="/login" />
      } />
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
    <AntdConfig>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </AntdConfig>
  );
};

export default App;
