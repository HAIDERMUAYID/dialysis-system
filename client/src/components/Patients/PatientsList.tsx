import React from 'react';
import { Patient } from '../../types';
import '../../App.css';

interface PatientsListProps {
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onDelete: (id: number) => void;
  onCreateVisit: (patient: Patient) => void;
}

const PatientsList: React.FC<PatientsListProps> = ({ patients, onEdit, onDelete, onCreateVisit }) => {
  if (patients.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        لا يوجد مرضى مسجلون
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>رقم الهوية</th>
            <th>العمر</th>
            <th>الجنس</th>
            <th>رقم الهاتف</th>
            <th>تاريخ التسجيل</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id}>
              <td>{patient.name}</td>
              <td>{patient.national_id || '-'}</td>
              <td>{patient.age || '-'}</td>
              <td>{patient.gender || '-'}</td>
              <td>{patient.phone || '-'}</td>
              <td>{patient.created_at ? new Date(patient.created_at).toLocaleDateString('ar-SA') : '-'}</td>
              <td>
                <div className="flex gap-1">
                  <button
                    className="btn btn-success"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    onClick={() => onCreateVisit(patient)}
                    title="إنشاء زيارة جديدة"
                  >
                    زيارة جديدة
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    onClick={() => onEdit(patient)}
                  >
                    تعديل
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    onClick={() => onDelete(patient.id)}
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientsList;
