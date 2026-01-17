import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Diagnosis } from '../../types';
import '../../App.css';

interface DiagnosisFormData {
  diagnosis: string;
  notes: string;
}

interface DiagnosisFormProps {
  visitId: number;
  diagnosis?: Diagnosis | null;
  onSave: () => void;
  onCancel: () => void;
}

const DiagnosisForm: React.FC<DiagnosisFormProps> = ({ visitId, diagnosis, onSave, onCancel }) => {
  const [formData, setFormData] = useState<DiagnosisFormData>({
    diagnosis: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Hide header when form is open
  useEffect(() => {
    const header = document.querySelector('.modern-header, .modern-header-with-logo');
    if (header) {
      (header as HTMLElement).style.display = 'none';
    }
    
    return () => {
      // Show header when form closes
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, []);

  useEffect(() => {
    if (diagnosis) {
      setFormData({
        diagnosis: diagnosis.diagnosis || '',
        notes: diagnosis.notes || ''
      });
    }
  }, [diagnosis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (diagnosis?.id) {
        await axios.put(`/api/doctor/diagnosis/${diagnosis.id}`, formData);
      } else {
        await axios.post('/api/doctor/diagnosis', { ...formData, visit_id: visitId });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ التشخيص');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-header">{diagnosis?.id ? 'تعديل التشخيص' : 'إضافة تشخيص'}</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">التشخيص *</label>
            <input
              type="text"
              name="diagnosis"
              className="form-control"
              value={formData.diagnosis}
              onChange={handleChange}
              required
              placeholder="أدخل التشخيص"
            />
          </div>

          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea
              name="notes"
              className="form-control"
              value={formData.notes}
              onChange={handleChange}
              placeholder="أي ملاحظات إضافية حول التشخيص أو التوصيات"
              rows={5}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              إلغاء
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiagnosisForm;
