import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Patient } from '../../types';
import '../../App.css';

interface PatientFormData {
  name: string;
  national_id: string;
  phone: string;
  age: number | '';
  gender: string;
  address: string;
}

interface PatientFormProps {
  patient?: Patient | null;
  onSave: () => void;
  onCancel: () => void;
}

const PatientForm: React.FC<PatientFormProps> = ({ patient, onSave, onCancel }) => {
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    national_id: '',
    phone: '',
    age: '',
    gender: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        national_id: patient.national_id || '',
        phone: patient.phone || '',
        age: patient.age || '',
        gender: patient.gender || '',
        address: patient.address || ''
      });
    }
  }, [patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (patient?.id) {
        await axios.put(`/api/patients/${patient.id}`, formData);
      } else {
        await axios.post('/api/patients', formData);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ بيانات المريض');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' ? (value === '' ? '' : parseInt(value) || '') : value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-header">{patient?.id ? 'تعديل بيانات المريض' : 'إضافة مريض جديد'}</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">الاسم *</label>
            <input
              type="text"
              name="name"
              className="form-control"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="اسم المريض"
            />
          </div>

          <div className="form-group">
            <label className="form-label">رقم الهوية</label>
            <input
              type="text"
              name="national_id"
              className="form-control"
              value={formData.national_id}
              onChange={handleChange}
              placeholder="رقم الهوية الوطنية"
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">العمر</label>
              <input
                type="number"
                name="age"
                className="form-control"
                value={formData.age}
                onChange={handleChange}
                min="0"
                max="150"
                placeholder="العمر"
              />
            </div>

            <div className="form-group">
              <label className="form-label">الجنس</label>
              <select
                name="gender"
                className="form-control"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">اختر...</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">رقم الهاتف</label>
            <input
              type="tel"
              name="phone"
              className="form-control"
              value={formData.phone}
              onChange={handleChange}
              placeholder="رقم الهاتف"
            />
          </div>

          <div className="form-group">
            <label className="form-label">العنوان</label>
            <textarea
              name="address"
              className="form-control"
              value={formData.address}
              onChange={handleChange}
              placeholder="عنوان المريض"
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

export default PatientForm;
