import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import { User, UserEnhanced, Stats, Visit, Patient, ActivityLog } from '../../types';
import '../../App.css';

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<UserEnhanced[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'patients' | 'users' | 'activity'>('overview');
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchStats();
    if (activeTab === 'visits') fetchVisits();
    if (activeTab === 'patients') fetchPatients();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'activity') fetchActivities();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard/stats');
      setStats(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب الإحصائيات');
    }
  };

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/visits');
      setVisits(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب الزيارات');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/patients');
      setPatients(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب المرضى');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/activity-log');
      setActivities(response.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء جلب سجل الأنشطة');
    } finally {
      setLoading(false);
    }
  };

  const handleForceClose = async (visitId: number) => {
    if (!window.confirm('هل أنت متأكد من إغلاق هذه الزيارة؟')) return;

    try {
      await axios.post(`/api/admin/visits/${visitId}/force-close`);
      showMessage('success', 'تم إغلاق الزيارة بنجاح');
      fetchVisits();
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'حدث خطأ أثناء إغلاق الزيارة');
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
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>لوحة تحكم المدير</div>
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
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('overview')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              نظرة عامة
            </button>
            <button
              className={`btn ${activeTab === 'visits' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('visits')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              الزيارات
            </button>
            <button
              className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('patients')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              المرضى
            </button>
            <button
              className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('users')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              المستخدمون
            </button>
            <button
              className={`btn ${activeTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('activity')}
              style={{ borderRadius: '4px 4px 0 0', marginBottom: '-2px' }}
            >
              سجل الأنشطة
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.total_patients}</h3>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>إجمالي المرضى</p>
            </div>
            <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.total_visits}</h3>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>إجمالي الزيارات</p>
            </div>
            <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.today_visits}</h3>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>زيارات اليوم</p>
            </div>
            <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
              <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.completed_visits}</h3>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>الزيارات المكتملة</p>
            </div>
          </div>
        )}

        {activeTab === 'overview' && stats && (
          <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center', background: '#fff3cd', border: '2px solid #ffc107' }}>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#856404' }}>{stats.pending_lab}</h3>
              <p style={{ margin: 0, color: '#856404' }}>في انتظار التحاليل</p>
            </div>
            <div className="card" style={{ textAlign: 'center', background: '#d1ecf1', border: '2px solid #17a2b8' }}>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#0c5460' }}>{stats.pending_pharmacy}</h3>
              <p style={{ margin: 0, color: '#0c5460' }}>في انتظار الصيدلية</p>
            </div>
            <div className="card" style={{ textAlign: 'center', background: '#d4edda', border: '2px solid #28a745' }}>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#155724' }}>{stats.pending_doctor}</h3>
              <p style={{ margin: 0, color: '#155724' }}>في انتظار الطبيب</p>
            </div>
          </div>
        )}

        {/* Visits Tab */}
        {activeTab === 'visits' && (
          <div className="card">
            <h2 className="card-header">جميع الزيارات</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : visits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>لا توجد زيارات</div>
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
                          {visit.status !== 'completed' && (
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              onClick={() => handleForceClose(visit.id)}
                            >
                              إغلاق الزيارة
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="card">
            <h2 className="card-header">جميع المرضى</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>لا يوجد مرضى</div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>رقم الهوية</th>
                      <th>العمر</th>
                      <th>الجنس</th>
                      <th>تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id}>
                        <td>{patient.name}</td>
                        <td>{patient.national_id || '-'}</td>
                        <td>{patient.age || '-'}</td>
                        <td>{patient.gender || '-'}</td>
                        <td>{patient.created_at ? new Date(patient.created_at).toLocaleDateString('ar-SA') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="card">
            <h2 className="card-header">جميع المستخدمين</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>لا يوجد مستخدمون</div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>اسم المستخدم</th>
                      <th>الاسم</th>
                      <th>الدور</th>
                      <th>تاريخ الإنشاء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.name}</td>
                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}`}>
                            {u.role === 'admin' ? 'مدير' : 
                             u.role === 'inquiry' ? 'استعلامات' :
                             u.role === 'lab' ? 'تحليلات' :
                             u.role === 'pharmacist' ? 'صيدلي' :
                             u.role === 'doctor' ? 'طبيب' : u.role}
                          </span>
                        </td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('ar-SA') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="card">
            <h2 className="card-header">سجل الأنشطة</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>لا توجد أنشطة</div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المستخدم</th>
                      <th>الإجراء</th>
                      <th>النوع</th>
                      <th>التفاصيل</th>
                      <th>التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr key={activity.id}>
                        <td>
                          {activity.user_name || 'غير معروف'}
                          {activity.user_role && (
                            <span className="badge badge-info" style={{ marginRight: '0.5rem' }}>
                              {activity.user_role}
                            </span>
                          )}
                        </td>
                        <td>{activity.action}</td>
                        <td>{activity.entity_type || '-'}</td>
                        <td>{activity.details || '-'}</td>
                        <td>{new Date(activity.created_at).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
