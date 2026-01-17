import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LabResultsForm from '../Lab/LabResultsForm';
import PharmacyPrescriptionForm from '../Pharmacy/PharmacyPrescriptionForm';
import DiagnosisForm from '../Doctor/DiagnosisForm';
import { VisitDetails as VisitDetailsType } from '../../types';
import '../../App.css';

interface VisitDetailsProps {
  visitId: number;
  role: 'lab' | 'pharmacist' | 'doctor' | 'inquiry';
  onComplete: (visitId: number) => void;
  onClose: () => void;
  onUpdate: () => void;
}

const VisitDetails: React.FC<VisitDetailsProps> = ({ visitId, role, onComplete, onClose, onUpdate }) => {
  const [visit, setVisit] = useState<VisitDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLabForm, setShowLabForm] = useState(false);
  const [showPharmacyForm, setShowPharmacyForm] = useState(false);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [selectedLabResult, setSelectedLabResult] = useState<any>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<any>(null);

  useEffect(() => {
    fetchVisitDetails();
  }, [visitId]);

  const fetchVisitDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/visits/${visitId}`);
      setVisit(response.data);
    } catch (error: any) {
      console.error('Error fetching visit details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLabResultSaved = () => {
    setShowLabForm(false);
    setSelectedLabResult(null);
    fetchVisitDetails();
    onUpdate();
  };

  const handlePrescriptionSaved = () => {
    setShowPharmacyForm(false);
    setSelectedPrescription(null);
    fetchVisitDetails();
    onUpdate();
  };

  const handleDiagnosisSaved = () => {
    setShowDiagnosisForm(false);
    setSelectedDiagnosis(null);
    fetchVisitDetails();
    onUpdate();
  };

  const handleDeleteLabResult = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف نتيجة التحليل؟')) return;
    try {
      await axios.delete(`/api/lab/${id}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeletePrescription = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف الدواء؟')) return;
    try {
      await axios.delete(`/api/pharmacy/${id}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteDiagnosis = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف التشخيص؟')) return;
    try {
      await axios.delete(`/api/doctor/diagnosis/${id}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleCompleteVisit = () => {
    if (window.confirm('هل أنت متأكد من إكمال الزيارة؟')) {
      onComplete(visitId);
    }
  };

  const canComplete = () => {
    if (!visit) return false;
    if (role === 'lab' && visit.status === 'pending_lab' && visit.lab_results.length > 0) return true;
    if (role === 'pharmacist' && visit.status === 'pending_pharmacy' && visit.prescriptions.length > 0) return true;
    if (role === 'doctor' && visit.status === 'pending_doctor' && visit.diagnoses.length > 0) return true;
    return false;
  };

  const handleGenerateReport = () => {
    window.open(`/api/reports/${visitId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div style={{ textAlign: 'center', padding: '2rem', color: '#d32f2f' }}>
            حدث خطأ أثناء جلب بيانات الزيارة
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2 className="modal-header">تفاصيل الزيارة - {visit.visit_number}</h2>

          {/* Patient Information */}
          <div className="card" style={{ marginBottom: '1rem', background: '#f9f9f9' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#1976d2' }}>معلومات المريض</h3>
            <div className="grid grid-2">
              <div><strong>الاسم:</strong> {visit.patient_name}</div>
              <div><strong>رقم الهوية:</strong> {visit.national_id || '-'}</div>
              <div><strong>العمر:</strong> {visit.age || '-'}</div>
              <div><strong>الجنس:</strong> {visit.gender || '-'}</div>
              <div><strong>الهاتف:</strong> {visit.phone || '-'}</div>
              <div><strong>التاريخ:</strong> {new Date(visit.created_at).toLocaleDateString('ar-SA')}</div>
            </div>
          </div>

          {/* Lab Results - For Lab, Doctor roles */}
          {(role === 'lab' || role === 'doctor') && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#1976d2' }}>نتائج التحاليل</h3>
                {role === 'lab' && visit.status === 'pending_lab' && (
                  <button className="btn btn-primary" onClick={() => setShowLabForm(true)}>
                    إضافة تحليل
                  </button>
                )}
              </div>
              {visit.lab_results.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>لا توجد نتائج تحاليل</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>اسم التحليل</th>
                      <th>النتيجة</th>
                      <th>الوحدة</th>
                      <th>المدى الطبيعي</th>
                      <th>ملاحظات</th>
                      {role === 'lab' && visit.status === 'pending_lab' && <th>الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visit.lab_results.map((result, index) => (
                      <tr key={result.id || `lab-${index}`}>
                        <td>{result.test_name}</td>
                        <td>{result.result || '-'}</td>
                        <td>{result.unit || '-'}</td>
                        <td>{result.normal_range || '-'}</td>
                        <td>{result.notes || '-'}</td>
                        {role === 'lab' && visit.status === 'pending_lab' && result.id && (
                          <td>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => {
                                if (result.id) {
                                  handleDeleteLabResult(result.id);
                                }
                              }}
                            >
                              حذف
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Prescriptions - For Pharmacist, Doctor roles */}
          {(role === 'pharmacist' || role === 'doctor') && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#1976d2' }}>الأدوية المصروفة</h3>
                {role === 'pharmacist' && visit.status === 'pending_pharmacy' && (
                  <button className="btn btn-primary" onClick={() => setShowPharmacyForm(true)}>
                    إضافة دواء
                  </button>
                )}
              </div>
              {visit.prescriptions.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>لا توجد أدوية مصروفة</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>اسم الدواء</th>
                      <th>الجرعة</th>
                      <th>الكمية</th>
                      <th>التعليمات</th>
                      {role === 'pharmacist' && visit.status === 'pending_pharmacy' && <th>الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visit.prescriptions.map((prescription, index) => (
                      <tr key={prescription.id || `prescription-${index}`}>
                        <td>{prescription.medication_name}</td>
                        <td>{prescription.dosage || '-'}</td>
                        <td>{prescription.quantity || '-'}</td>
                        <td>{prescription.instructions || '-'}</td>
                        {role === 'pharmacist' && visit.status === 'pending_pharmacy' && prescription.id && (
                          <td>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => {
                                if (prescription.id) {
                                  handleDeletePrescription(prescription.id);
                                }
                              }}
                            >
                              حذف
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Diagnoses - For Doctor role only */}
          {role === 'doctor' && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#1976d2' }}>التشخيص</h3>
                {visit.status === 'pending_doctor' && (
                  <button className="btn btn-primary" onClick={() => setShowDiagnosisForm(true)}>
                    إضافة تشخيص
                  </button>
                )}
              </div>
              {visit.diagnoses.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>لا يوجد تشخيص</p>
              ) : (
                <div>
                  {visit.diagnoses.map((diagnosis, index) => (
                    <div key={diagnosis.id || `diagnosis-${index}`} style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
                      <p><strong>التشخيص:</strong> {diagnosis.diagnosis}</p>
                      {diagnosis.notes && <p><strong>ملاحظات:</strong> {diagnosis.notes}</p>}
                      <p style={{ fontSize: '0.9rem', color: '#666' }}>
                        <strong>الطبيب:</strong> {diagnosis.doctor_name || '-'} 
                        {diagnosis.created_at && (
                          <> | <strong> التاريخ:</strong> {new Date(diagnosis.created_at).toLocaleDateString('ar-SA')}</>
                        )}
                      </p>
                      {visit.status === 'pending_doctor' && diagnosis.id && (
                        <button
                          className="btn btn-danger"
                          style={{ marginTop: '0.5rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                          onClick={() => {
                            if (diagnosis.id) {
                              handleDeleteDiagnosis(diagnosis.id);
                            }
                          }}
                        >
                          حذف التشخيص
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status History */}
          {visit.status_history && visit.status_history.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem', background: '#f9f9f9' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#1976d2' }}>سجل الحالات</h3>
              <div>
                {visit.status_history.map((history, index) => (
                  <div key={history.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>{new Date(history.created_at).toLocaleString('ar-SA')}:</strong> {history.notes || history.status}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="modal-footer">
            {role === 'doctor' && visit.status === 'completed' && (
              <button className="btn btn-success" onClick={handleGenerateReport}>
                إنشاء تقرير طبي
              </button>
            )}
            {role === 'inquiry' && visit.status !== 'completed' && (
              <>
                {visit.status === 'pending_lab' && (
                  <button 
                    className="btn btn-warning" 
                    onClick={async () => {
                      const message = prompt('أدخل رسالة الإشعار:');
                      if (message) {
                        try {
                          await axios.post(`/api/visits/${visitId}/send-notification`, { 
                            to_role: 'lab', 
                            message 
                          });
                          alert('تم إرسال الإشعار بنجاح');
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'حدث خطأ');
                        }
                      }
                    }}
                  >
                    إشعار للتحاليل
                  </button>
                )}
                {visit.status === 'pending_pharmacy' && (
                  <button 
                    className="btn btn-warning" 
                    onClick={async () => {
                      const message = prompt('أدخل رسالة الإشعار:');
                      if (message) {
                        try {
                          await axios.post(`/api/visits/${visitId}/send-notification`, { 
                            to_role: 'pharmacist', 
                            message 
                          });
                          alert('تم إرسال الإشعار بنجاح');
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'حدث خطأ');
                        }
                      }
                    }}
                  >
                    إشعار للصيدلية
                  </button>
                )}
                {visit.status === 'pending_doctor' && (
                  <button 
                    className="btn btn-warning" 
                    onClick={async () => {
                      const message = prompt('أدخل رسالة الإشعار:');
                      if (message) {
                        try {
                          await axios.post(`/api/visits/${visitId}/send-notification`, { 
                            to_role: 'doctor', 
                            message 
                          });
                          alert('تم إرسال الإشعار بنجاح');
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'حدث خطأ');
                        }
                      }
                    }}
                  >
                    إشعار للطبيب
                  </button>
                )}
                <button 
                  className="btn btn-danger" 
                  onClick={async () => {
                    if (window.confirm('هل أنت متأكد من إغلاق هذه الزيارة؟')) {
                      try {
                        await axios.post(`/api/visits/${visitId}/close`);
                        alert('تم إغلاق الزيارة بنجاح');
                        onUpdate();
                        onClose();
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'حدث خطأ');
                      }
                    }
                  }}
                >
                  إنهاء الزيارة
                </button>
              </>
            )}
            {canComplete() && (
              <button className="btn btn-success" onClick={handleCompleteVisit}>
                {role === 'lab' && 'إكمال التحاليل'}
                {role === 'pharmacist' && 'صرف العلاج'}
                {role === 'doctor' && 'إكمال الزيارة'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
          </div>
        </div>
      </div>

      {showLabForm && (
        <LabResultsForm
          visitId={visitId}
          labResult={selectedLabResult}
          onSave={handleLabResultSaved}
          onCancel={() => {
            setShowLabForm(false);
            setSelectedLabResult(null);
          }}
        />
      )}

      {showPharmacyForm && (
        <PharmacyPrescriptionForm
          visitId={visitId}
          prescription={selectedPrescription}
          onSave={handlePrescriptionSaved}
          onCancel={() => {
            setShowPharmacyForm(false);
            setSelectedPrescription(null);
          }}
        />
      )}

      {showDiagnosisForm && (
        <DiagnosisForm
          visitId={visitId}
          diagnosis={selectedDiagnosis}
          onSave={handleDiagnosisSaved}
          onCancel={() => {
            setShowDiagnosisForm(false);
            setSelectedDiagnosis(null);
          }}
        />
      )}
    </>
  );
};

export default VisitDetails;
