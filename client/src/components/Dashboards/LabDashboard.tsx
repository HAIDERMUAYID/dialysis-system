import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import VisitDetails from '../Visits/VisitDetails';
import LabResultsForm from '../Lab/LabResultsForm';
import NotificationBell from '../Notifications/NotificationBell';
import { Visit } from '../../types';
import '../../App.css';

const LabDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/visits');
      // Handle both old format (array) and new format (object with data and pagination)
      const visitsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setVisits(visitsData);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب الزيارات');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (visitId: number) => {
    try {
      await axios.post(`/api/lab/complete/${visitId}`);
      showMessage('success', 'تم إكمال التحاليل بنجاح');
      fetchVisits();
      if (selectedVisit === visitId) {
        setSelectedVisit(null);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء إكمال التحاليل');
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      pending_lab: 'badge-warning',
      pending_pharmacy: 'badge-info',
      pending_doctor: 'badge-info',
      completed: 'badge-success'
    };
    return badges[status] || 'badge-secondary';
  };

  const getStatusText = (status: string) => {
    const texts: { [key: string]: string } = {
      pending_lab: 'في انتظار التحاليل',
      pending_pharmacy: 'في انتظار الصيدلية',
      pending_doctor: 'في انتظار الطبيب',
      completed: 'مكتملة'
    };
    return texts[status] || status;
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-content">
          <div>
            <div className="navbar-title">مستشفى الحكيم - شعبة الكلية الصناعية</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>موظف التحليلات</div>
          </div>
          <div className="navbar-user">
            <NotificationBell />
            <span>{user?.name}</span>
            <button className="btn btn-secondary" onClick={logout}>تسجيل الخروج</button>
          </div>
        </div>
      </nav>

      <div className="container">
        {message && (
          <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
            {message.text}
          </div>
        )}

        <div className="card">
          <h2 className="card-header">الزيارات المعلقة - التحاليل</h2>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
          ) : visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              لا توجد زيارات معلقة
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم الزيارة</th>
                    <th>اسم المريض</th>
                    <th>رقم الهوية</th>
                    <th>العمر</th>
                    <th>الجنس</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr key={visit.id}>
                      <td>{visit.visit_number}</td>
                      <td>{visit.patient_name}</td>
                      <td>{visit.national_id || '-'}</td>
                      <td>{visit.age || '-'}</td>
                      <td>{visit.gender || '-'}</td>
                      <td>{new Date(visit.created_at).toLocaleDateString('ar-SA')}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(visit.status)}`}>
                          {getStatusText(visit.status)}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            onClick={() => setSelectedVisit(visit.id)}
                          >
                            عرض التفاصيل
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedVisit && (
        <VisitDetails
          visitId={selectedVisit}
          role="lab"
          onComplete={handleComplete}
          onClose={() => setSelectedVisit(null)}
          onUpdate={fetchVisits}
        />
      )}
    </div>
  );
};

export default LabDashboard;
