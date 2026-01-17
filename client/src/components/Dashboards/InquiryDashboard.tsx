import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import PatientForm from '../Patients/PatientForm';
import PatientsList from '../Patients/PatientsList';
import VisitForm from '../Visits/VisitForm';
import VisitDetails from '../Visits/VisitDetails';
import NotificationBell from '../Notifications/NotificationBell';
import { Patient, Visit } from '../../types';
import '../../App.css';

const InquiryDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'patients' | 'visits'>('patients');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'patients') {
      fetchPatients();
    } else {
      fetchVisits();
    }
  }, [activeTab]);

  const fetchPatients = async () => {
    try {
      const response = await axios.get('/api/patients');
      // Handle both old format (array) and new format (object with data and pagination)
      const patientsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setPatients(patientsData);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب المرضى');
    }
  };

  const handleAddPatient = () => {
    setSelectedPatient(null);
    setShowPatientForm(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientForm(true);
  };

  const handleDeletePatient = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المريض؟')) return;

    try {
      await axios.delete(`/api/patients/${id}`);
      showMessage('success', 'تم حذف المريض بنجاح');
      fetchPatients();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء حذف المريض');
    }
  };

  const handlePatientSaved = () => {
    setShowPatientForm(false);
    setSelectedPatient(null);
    fetchPatients();
    showMessage('success', 'تم حفظ بيانات المريض بنجاح');
  };

  const handleCreateVisit = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowVisitForm(true);
  };

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

  const handleVisitCreated = () => {
    setShowVisitForm(false);
    setSelectedPatient(null);
    showMessage('success', 'تم إنشاء زيارة جديدة بنجاح');
    if (activeTab === 'visits') {
      fetchVisits();
    }
  };

  const handleCloseVisit = async (visitId: number) => {
    if (!window.confirm('هل أنت متأكد من إغلاق هذه الزيارة؟')) return;

    try {
      await axios.post(`/api/visits/${visitId}/close`);
      showMessage('success', 'تم إغلاق الزيارة بنجاح');
      fetchVisits();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء إغلاق الزيارة');
    }
  };

  const handleSendNotification = async (visitId: number, toRole: string) => {
    const message = prompt('أدخل رسالة الإشعار:');
    if (!message) return;

    try {
      await axios.post(`/api/visits/${visitId}/send-notification`, { to_role: toRole, message });
      showMessage('success', 'تم إرسال الإشعار بنجاح');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء إرسال الإشعار');
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
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>موظف الاستعلامات</div>
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

        {/* Tabs */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="flex" style={{ gap: '1rem', borderBottom: '2px solid #e0e0e0' }}>
            <button
              className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('patients')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              المرضى
            </button>
            <button
              className={`btn ${activeTab === 'visits' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('visits')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              الزيارات المفتوحة
            </button>
          </div>
        </div>

        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="card">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 className="card-header" style={{ margin: 0 }}>إدارة المرضى</h2>
              <button className="btn btn-primary" onClick={handleAddPatient}>
                إضافة مريض جديد
              </button>
            </div>

            <PatientsList
              patients={patients}
              onEdit={handleEditPatient}
              onDelete={handleDeletePatient}
              onCreateVisit={handleCreateVisit}
            />
          </div>
        )}

        {/* Visits Tab */}
        {activeTab === 'visits' && (
          <div className="card">
            <h2 className="card-header">الزيارات المفتوحة</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : visits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                لا توجد زيارات مفتوحة
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>رقم الزيارة</th>
                      <th>اسم المريض</th>
                      <th>رقم الهوية</th>
                      <th>الحالة</th>
                      <th>التاريخ</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((visit) => (
                      <tr key={visit.id}>
                        <td>{visit.visit_number}</td>
                        <td>{visit.patient_name}</td>
                        <td>{visit.national_id || '-'}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(visit.status)}`}>
                            {getStatusText(visit.status)}
                          </span>
                        </td>
                        <td>{new Date(visit.created_at).toLocaleDateString('ar-SA')}</td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              onClick={() => setSelectedVisit(visit.id)}
                            >
                              عرض التفاصيل
                            </button>
                            {visit.status === 'pending_lab' && (
                              <button
                                className="btn btn-warning"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={() => handleSendNotification(visit.id, 'lab')}
                              >
                                إشعار للتحاليل
                              </button>
                            )}
                            {visit.status === 'pending_pharmacy' && (
                              <button
                                className="btn btn-warning"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={() => handleSendNotification(visit.id, 'pharmacist')}
                              >
                                إشعار للصيدلية
                              </button>
                            )}
                            {visit.status === 'pending_doctor' && (
                              <button
                                className="btn btn-warning"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={() => handleSendNotification(visit.id, 'doctor')}
                              >
                                إشعار للطبيب
                              </button>
                            )}
                            {visit.status !== 'completed' && (
                              <button
                                className="btn btn-danger"
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={() => handleCloseVisit(visit.id)}
                              >
                                إنهاء الزيارة
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showPatientForm && (
        <PatientForm
          patient={selectedPatient}
          onSave={handlePatientSaved}
          onCancel={() => {
            setShowPatientForm(false);
            setSelectedPatient(null);
          }}
        />
      )}

      {showVisitForm && selectedPatient && (
        <VisitForm
          patient={selectedPatient}
          onSave={handleVisitCreated}
          onCancel={() => {
            setShowVisitForm(false);
            setSelectedPatient(null);
          }}
        />
      )}

      {selectedVisit && (
        <VisitDetails
          visitId={selectedVisit}
          role="inquiry"
          onComplete={() => {}}
          onClose={() => setSelectedVisit(null)}
          onUpdate={fetchVisits}
        />
      )}
    </div>
  );
};

export default InquiryDashboard;
