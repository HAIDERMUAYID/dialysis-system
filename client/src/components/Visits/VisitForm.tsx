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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/visits', { patient_id: patient.id });
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
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            سيتم إنشاء زيارة جديدة وفتح ملف باسم المريض. بعد إنشاء الزيارة، ستنتقل إلى موظف التحليلات.
          </p>
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
