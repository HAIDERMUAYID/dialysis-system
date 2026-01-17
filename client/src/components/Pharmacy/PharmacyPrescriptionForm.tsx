import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Prescription } from '../../types';
import '../../App.css';

interface PrescriptionFormData {
  medication_name: string;
  dosage: string;
  quantity: number | '';
  instructions: string;
}

interface PharmacyPrescriptionFormProps {
  visitId: number;
  prescription?: Prescription | null;
  onSave: () => void;
  onCancel: () => void;
}

const PharmacyPrescriptionForm: React.FC<PharmacyPrescriptionFormProps> = ({ 
  visitId, 
  prescription, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<PrescriptionFormData>({
    medication_name: '',
    dosage: '',
    quantity: '',
    instructions: ''
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
    if (prescription) {
      setFormData({
        medication_name: prescription.medication_name || '',
        dosage: prescription.dosage || '',
        quantity: prescription.quantity || '',
        instructions: prescription.instructions || ''
      });
    }
  }, [prescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        quantity: formData.quantity === '' ? undefined : formData.quantity
      };
      
      if (prescription?.id) {
        await axios.put(`/api/pharmacy/${prescription.id}`, submitData);
      } else {
        await axios.post('/api/pharmacy', { ...submitData, visit_id: visitId });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ الدواء');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? (value === '' ? '' : parseInt(value) || '') : value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-header">{prescription?.id ? 'تعديل الدواء' : 'إضافة دواء'}</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">اسم الدواء *</label>
            <input
              type="text"
              name="medication_name"
              className="form-control"
              value={formData.medication_name}
              onChange={handleChange}
              required
              placeholder="اسم الدواء"
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">الجرعة</label>
              <input
                type="text"
                name="dosage"
                className="form-control"
                value={formData.dosage}
                onChange={handleChange}
                placeholder="مثال: 500mg مرتين يومياً"
              />
            </div>

            <div className="form-group">
              <label className="form-label">الكمية</label>
              <input
                type="number"
                name="quantity"
                className="form-control"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                placeholder="عدد العبوات/العلب"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">التعليمات</label>
            <textarea
              name="instructions"
              className="form-control"
              value={formData.instructions}
              onChange={handleChange}
              placeholder="تعليمات الاستخدام"
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

export default PharmacyPrescriptionForm;
