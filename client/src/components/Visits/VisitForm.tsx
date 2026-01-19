import React, { useState } from 'react';
import axios from 'axios';
import { Patient } from '../../types';
import '../../App.css';

interface VisitFormProps {
  patient: Patient;
  onSave: () => void;
  onCancel: () => void;
}

const VisitForm: React.FC<VisitFormProps> = ({ patient, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visitType, setVisitType] = useState<'normal' | 'doctor_directed'>('normal');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/visits', { 
        patient_id: patient.id,
        visit_type: visitType
      });
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء إنشاء الزيارة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-header">إنشاء زيارة جديدة</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <div style={{ marginBottom: '1.5rem' }}>
          <p><strong>المريض:</strong> {patient.name}</p>
          
          <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: '#333' }}>
              نوع الزيارة:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: visitType === 'normal' ? '2px solid #1976d2' : '2px solid #e0e0e0', backgroundColor: visitType === 'normal' ? '#e3f2fd' : 'white' }}>
                <input
                  type="radio"
                  name="visit_type"
                  value="normal"
                  checked={visitType === 'normal'}
                  onChange={(e) => setVisitType(e.target.value as 'normal')}
                  style={{ marginLeft: '0.5rem' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>زيارة عادية</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                    تبدأ عند موظف التحليلات ثم الصيدلية ثم الطبيب
                  </div>
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: visitType === 'doctor_directed' ? '2px solid #1976d2' : '2px solid #e0e0e0', backgroundColor: visitType === 'doctor_directed' ? '#e3f2fd' : 'white' }}>
                <input
                  type="radio"
                  name="visit_type"
                  value="doctor_directed"
                  checked={visitType === 'doctor_directed'}
                  onChange={(e) => setVisitType(e.target.value as 'doctor_directed')}
                  style={{ marginLeft: '0.5rem' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>زيارة من خلال الطبيب</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                    تبدأ مباشرة عند الطبيب الذي يختار التحاليل والأدوية المطلوبة
                  </div>
                </div>
              </label>
            </div>
          </div>
          
          {visitType === 'normal' && (
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              سيتم إنشاء زيارة جديدة وفتح ملف باسم المريض. بعد إنشاء الزيارة، ستنتقل إلى موظف التحليلات.
            </p>
          )}
          
          {visitType === 'doctor_directed' && (
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              سيتم إنشاء زيارة تبدأ مباشرة عند الطبيب. الطبيب سيختار التحاليل والأدوية المطلوبة من الكتالوجات.
            </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              إلغاء
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري الإنشاء...' : 'إنشاء زيارة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VisitForm;
