import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LabResult } from '../../types';
import '../../App.css';

interface LabResultFormData {
  test_name: string;
  result: string;
  unit: string;
  normal_range: string;
  notes: string;
}

interface LabResultsFormProps {
  visitId: number;
  labResult?: LabResult | null;
  onSave: () => void;
  onCancel: () => void;
}

const LabResultsForm: React.FC<LabResultsFormProps> = ({ visitId, labResult, onSave, onCancel }) => {
  const [formData, setFormData] = useState<LabResultFormData>({
    test_name: '',
    result: '',
    unit: '',
    normal_range: '',
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
    if (labResult) {
      setFormData({
        test_name: labResult.test_name || '',
        result: labResult.result || '',
        unit: labResult.unit || '',
        normal_range: labResult.normal_range || '',
        notes: labResult.notes || ''
      });
    }
  }, [labResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (labResult?.id) {
        await axios.put(`/api/lab/${labResult.id}`, formData);
      } else {
        await axios.post('/api/lab', { ...formData, visit_id: visitId });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ نتيجة التحليل');
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
        <h2 className="modal-header">{labResult?.id ? 'تعديل نتيجة التحليل' : 'إضافة نتيجة تحليل'}</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">اسم التحليل *</label>
            <input
              type="text"
              name="test_name"
              className="form-control"
              value={formData.test_name}
              onChange={handleChange}
              required
              placeholder="مثال: سكر الدم، ضغط الدم، إلخ"
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">النتيجة</label>
              <input
                type="text"
                name="result"
                className="form-control"
                value={formData.result}
                onChange={handleChange}
                placeholder="قيمة النتيجة"
              />
            </div>

            <div className="form-group">
              <label className="form-label">الوحدة</label>
              <input
                type="text"
                name="unit"
                className="form-control"
                value={formData.unit}
                onChange={handleChange}
                placeholder="مثال: mg/dl, mmol/L"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">المدى الطبيعي</label>
            <input
              type="text"
              name="normal_range"
              className="form-control"
              value={formData.normal_range}
              onChange={handleChange}
              placeholder="مثال: 70-100 mg/dl"
            />
          </div>

          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea
              name="notes"
              className="form-control"
              value={formData.notes}
              onChange={handleChange}
              placeholder="أي ملاحظات إضافية"
              rows={3}
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

export default LabResultsForm;
