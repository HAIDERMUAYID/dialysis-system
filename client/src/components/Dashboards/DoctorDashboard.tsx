import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import VisitDetails from '../Visits/VisitDetails';
import NotificationBell from '../Notifications/NotificationBell';
import { Patient, Visit } from '../../types';
import '../../App.css';

const DoctorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await axios.get(`/api/doctor/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء البحث');
    }
  };

  const handlePatientSelect = async (patientId: number) => {
    try {
      const response = await axios.get(`/api/doctor/patients/${patientId}/visits`);
      setVisits(response.data);
      setSelectedPatient(searchResults.find(p => p.id === patientId) || null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب تاريخ الزيارات');
    }
  };

  const handleComplete = async (visitId: number) => {
    try {
      await axios.post(`/api/doctor/complete/${visitId}`);
      showMessage('success', 'تم إكمال الزيارة بنجاح');
      fetchVisits();
      if (selectedVisit === visitId) {
        setSelectedVisit(null);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء إكمال الزيارة');
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      pending_lab: 'badge-warning',
      pending_pharmacy: 'badge-warning',
      pending_doctor: 'badge-warning',
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
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>الطبيب</div>
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
          <h2 className="card-header">البحث عن المريض</h2>
          <form onSubmit={handleSearch} className="flex gap-2" style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">بحث</button>
            {selectedPatient && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedPatient(null);
                  setSearchQuery('');
                  setSearchResults([]);
                  fetchVisits();
                }}
              >
                إعادة تعيين
              </button>
            )}
          </form>

          {searchResults.length > 0 && (
            <div className="card" style={{ marginTop: '1rem', background: '#f9f9f9' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>نتائج البحث:</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>رقم الهوية</th>
                    <th>العمر</th>
                    <th>الجنس</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.name}</td>
                      <td>{patient.national_id || '-'}</td>
                      <td>{patient.age || '-'}</td>
                      <td>{patient.gender || '-'}</td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                          onClick={() => handlePatientSelect(patient.id)}
                        >
                          عرض تاريخ الزيارات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedPatient && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              عرض تاريخ الزيارات للمريض: <strong>{selectedPatient.name}</strong>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-header">
            {selectedPatient ? `تاريخ زيارات: ${selectedPatient.name}` : 'الزيارات المعلقة والمكتملة'}
          </h2>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
          ) : visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              لا توجد زيارات
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
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                          onClick={() => setSelectedVisit(visit.id)}
                        >
                          عرض التفاصيل
                        </button>
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
          role="doctor"
          onComplete={handleComplete}
          onClose={() => setSelectedVisit(null)}
          onUpdate={fetchVisits}
        />
      )}
    </div>
  );
};

export default DoctorDashboard;
