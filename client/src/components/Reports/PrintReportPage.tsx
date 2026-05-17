import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, message } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatBaghdadDate } from '../../utils/dayjs-config';
import { PatientFullReport } from '../../types';
import './PrintReportPage.css';

const PrintReportPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<PatientFullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    if (patientId) {
      fetchPatientFullReport(parseInt(patientId));
    }
  }, [patientId]);

  const fetchPatientFullReport = async (id: number) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/patients/${id}/full-report`);
      setReport(response.data);
    } catch (err: any) {
      console.error('Error fetching patient full report:', err);
      message.error('فشل تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleDownloadPDF = async () => {
    if (!patientId) return;
    const reportElement = document.querySelector('.print-content') as HTMLElement | null;
    if (!reportElement) {
      message.error('تعذر تجهيز محتوى التقرير للتصدير.');
      return;
    }

    setPdfExporting(true);
    try {
      const canvas = await html2canvas(reportElement, {
        scale: Math.min(window.devicePixelRatio || 2, 2.4),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * usableWidth) / canvas.width;
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      let remainingHeight = imageHeight;
      let positionY = margin;
      pdf.addImage(imageData, 'JPEG', margin, positionY, usableWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= usableHeight;

      while (remainingHeight > 0) {
        pdf.addPage();
        positionY = margin - (imageHeight - remainingHeight);
        pdf.addImage(imageData, 'JPEG', margin, positionY, usableWidth, imageHeight, undefined, 'FAST');
        remainingHeight -= usableHeight;
      }

      const timestamp = dayjs().format('YYYY-MM-DD-HH-mm');
      pdf.save(`patient-report-${patientId}-${timestamp}.pdf`);
      message.success('تم تنزيل ملف PDF بنجاح');
    } catch (error) {
      console.error('PDF export failed:', error);
      message.error('فشل تصدير PDF، حاول مرة أخرى.');
    } finally {
      setPdfExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="جاري تحميل التقرير..." />
      </div>
    );
  }

  if (!report || !report.patient) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>لا توجد بيانات متاحة</p>
        <Button onClick={handleBack}>العودة</Button>
      </div>
    );
  }

  const { patient, visits } = report;
  const currentDate = new Date();
  const dateStr = currentDate.toISOString().split('T')[0];

  return (
    <div className="print-report-container">
      {/* Print Controls - Hidden when printing */}
      <div className="print-controls no-print">
        <div className="controls-content">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            className="control-btn back-btn"
          >
            العودة
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            size="large"
            className="control-btn print-btn"
          >
            طباعة
          </Button>
          <Button
            type="default"
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            loading={pdfExporting}
            size="large"
            className="control-btn download-btn"
          >
            تحميل PDF
          </Button>
        </div>
      </div>
      <div className="mobile-quick-actions no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} className="mobile-quick-btn">
          رجوع للنظام
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} className="mobile-quick-btn">
          طباعة
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF} loading={pdfExporting} className="mobile-quick-btn">
          PDF
        </Button>
      </div>

      {/* Report Content */}
      <div className="print-content">
        {/* Header */}
        <div className="report-header">
          <div className="header-top">
            <div className="hospital-logo">
              <img 
                src="/images/ministry-logo.png" 
                alt="شعار وزارة الصحة العراقية"
                className="logo-image"
                onError={(e) => {
                  // Fallback to emoji if image not found
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="logo-icon" style={{ display: 'none' }}>🏥</div>
            </div>
            <div className="hospital-info">
              <h1 className="ministry-name">وزارة الصحة العراقية</h1>
              <h2 className="health-directorate">دائرة صحة النجف الاشرف</h2>
              <h3 className="hospital-name">مستشفى الحكيم العام</h3>
              <h4 className="department-name">شعبة الكلية الصناعية</h4>
            </div>
          </div>
          <div className="report-title-section">
            <h3 className="report-title">التقرير الطبي الشامل</h3>
            <div className="report-badge">وثيقة رسمية</div>
          </div>
          <div className="document-info">
            <div className="doc-info-row">
              <span className="doc-label">تاريخ التقرير:</span>
              <span className="doc-value">{formatBaghdadDate(dateStr)}</span>
            </div>
            <div className="doc-info-row">
              <span className="doc-label">رقم الوثيقة:</span>
              <span className="doc-value">{patient.national_id || `PAT-${patient.id}`}</span>
            </div>
            <div className="doc-info-row">
              <span className="doc-label">رقم المرجع:</span>
              <span className="doc-value">{`REF-${dateStr.replace(/-/g, '')}-${patient.id}`}</span>
            </div>
          </div>
        </div>

        <div className="report-divider">
          <div className="divider-line"></div>
          <div className="divider-icon">⚕️</div>
          <div className="divider-line"></div>
        </div>

        {/* Patient Information */}
        <div className="section">
          <h2 className="section-title">معلومات المريض</h2>
          <div className="patient-info-grid">
            <div className="info-column">
              <div className="info-row">
                <span className="info-label">الاسم:</span>
                <span className="info-value">{patient.name || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">رقم الهوية:</span>
                <span className="info-value">{patient.national_id || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">تاريخ الميلاد:</span>
                <span className="info-value">
                  {patient.date_of_birth ? formatBaghdadDate(patient.date_of_birth) : 'غير محدد'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">العمر:</span>
                <span className="info-value">{patient.age || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">الجنس:</span>
                <span className="info-value">{patient.gender || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">فصيلة الدم:</span>
                <span className="info-value">{patient.blood_type || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">الفئة:</span>
                <span className="info-value">{patient.patient_category || 'غير محدد'}</span>
              </div>
            </div>
            <div className="info-column">
              <div className="info-row">
                <span className="info-label">الهاتف:</span>
                <span className="info-value">{patient.phone || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">الجوال:</span>
                <span className="info-value">{patient.mobile || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">البريد الإلكتروني:</span>
                <span className="info-value">{patient.email || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">العنوان:</span>
                <span className="info-value">{patient.address || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">المدينة:</span>
                <span className="info-value">{patient.city || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">تاريخ التسجيل:</span>
                <span className="info-value">
                  {patient.created_at ? formatBaghdadDate(patient.created_at) : 'غير محدد'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Medical History */}
        {(patient.medical_history || patient.allergies || patient.chronic_diseases || patient.current_medications) && (
          <div className="section">
            <h2 className="section-title">
              <span className="section-icon">🏥</span>
              السجل الطبي
            </h2>
            <div className="medical-history">
              {patient.allergies && (
                <div className="history-item">
                  <span className="history-label">الحساسية:</span>
                  <span className="history-value">{patient.allergies}</span>
                </div>
              )}
              {patient.chronic_diseases && (
                <div className="history-item">
                  <span className="history-label">الأمراض المزمنة:</span>
                  <span className="history-value">{patient.chronic_diseases}</span>
                </div>
              )}
              {patient.medical_history && (
                <div className="history-item">
                  <span className="history-label">التاريخ الطبي:</span>
                  <span className="history-value">{patient.medical_history}</span>
                </div>
              )}
              {patient.current_medications && (
                <div className="history-item">
                  <span className="history-label">الأدوية الحالية:</span>
                  <span className="history-value">{patient.current_medications}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        {patient.emergency_contact_name && (
          <div className="section">
            <h2 className="section-title">
              <span className="section-icon">📞</span>
              جهة الاتصال للطوارئ
            </h2>
            <div className="emergency-contact">
              <div className="info-row">
                <span className="info-label">الاسم:</span>
                <span className="info-value">{patient.emergency_contact_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">الهاتف:</span>
                <span className="info-value">{patient.emergency_contact_phone || 'غير محدد'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">العلاقة:</span>
                <span className="info-value">{patient.emergency_contact_relation || 'غير محدد'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Visits Details */}
        {visits.length > 0 && (
          <div className="section">
            <h2 className="section-title">تفاصيل الزيارات</h2>
            {visits.map((visit, index) => (
              <div key={visit.id} className="visit-section">
                <div className="visit-header">
                  <h3 className="visit-title">الزيارة رقم {index + 1}</h3>
                  <div className="visit-meta">
                    <span>رقم الزيارة: {visit.visit_number}</span>
                    <span>التاريخ: {visit.created_at ? formatBaghdadDate(visit.created_at) : 'غير محدد'}</span>
                    <span>الحالة: {visit.status === 'completed' ? 'مكتملة' : 'قيد المعالجة'}</span>
                  </div>
                </div>

                <div className="visit-status-grid">
                  <div className={`status-badge ${visit.lab_completed === 1 ? 'completed' : 'pending'}`}>
                    <span className="status-icon">🔬</span>
                    <div className="status-info">
                      <span className="status-label">المختبر</span>
                      <span className="status-value">
                        {visit.lab_completed === 1 ? 'مكتمل' : 'معلق'}
                      </span>
                    </div>
                  </div>
                  <div className={`status-badge ${visit.pharmacy_completed === 1 ? 'completed' : 'pending'}`}>
                    <span className="status-icon">💊</span>
                    <div className="status-info">
                      <span className="status-label">الصيدلية</span>
                      <span className="status-value">
                        {visit.pharmacy_completed === 1 ? 'مكتملة' : 'معلقة'}
                      </span>
                    </div>
                  </div>
                  <div className={`status-badge ${visit.doctor_completed === 1 ? 'completed' : 'pending'}`}>
                    <span className="status-icon">👨‍⚕️</span>
                    <div className="status-info">
                      <span className="status-label">الطبيب</span>
                      <span className="status-value">
                        {visit.doctor_completed === 1 ? 'مكتمل' : 'معلق'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lab Results */}
                {visit.lab_results && visit.lab_results.length > 0 && (
                  <div className="visit-subsection">
                    <h4 className="subsection-title">
                      <span className="subsection-icon">🔬</span>
                      نتائج التحاليل
                    </h4>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>اسم التحليل</th>
                          <th>النتيجة</th>
                          <th>الوحدة</th>
                          <th>المدى الطبيعي</th>
                          <th>التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visit.lab_results.map((result) => (
                          <tr key={result.id}>
                            <td>{result.test_name || 'غير محدد'}</td>
                            <td>{result.result || 'غير محدد'}</td>
                            <td>{result.unit || '-'}</td>
                            <td>{result.normal_range || '-'}</td>
                            <td>
                              {result.created_at
                                ? formatBaghdadDate(result.created_at)
                                : 'غير محدد'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Prescriptions */}
                {visit.prescriptions && visit.prescriptions.length > 0 && (
                  <div className="visit-subsection">
                    <h4 className="subsection-title">
                      <span className="subsection-icon">💊</span>
                      الأدوية المصروفة
                    </h4>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الدواء</th>
                          <th>الجرعة</th>
                          <th>الكمية</th>
                          <th>التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visit.prescriptions.map((prescription) => (
                          <tr key={prescription.id}>
                            <td>{prescription.medication_name || 'غير محدد'}</td>
                            <td>{prescription.dosage || '-'}</td>
                            <td>{prescription.quantity ? prescription.quantity.toString() : '-'}</td>
                            <td>
                              {prescription.created_at
                                ? formatBaghdadDate(prescription.created_at)
                                : 'غير محدد'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Diagnoses */}
                {visit.diagnoses && visit.diagnoses.length > 0 && (
                  <div className="visit-subsection">
                    <h4 className="subsection-title">
                      <span className="subsection-icon">📝</span>
                      التشخيص
                    </h4>
                    {visit.diagnoses.map((diagnosis, idx) => (
                      <div key={diagnosis.id} className="diagnosis-item">
                        <div className="diagnosis-main">
                          <span className="diagnosis-number">{idx + 1}.</span>
                          <span className="diagnosis-text">{diagnosis.diagnosis || 'غير محدد'}</span>
                        </div>
                        {diagnosis.notes && (
                          <div className="diagnosis-notes">ملاحظات: {diagnosis.notes}</div>
                        )}
                        <div className="diagnosis-meta">
                          <span>الطبيب: {diagnosis.doctor_name || 'غير محدد'}</span>
                          <span>
                            التاريخ:{' '}
                            {diagnosis.created_at
                              ? formatBaghdadDate(diagnosis.created_at)
                              : 'غير محدد'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="report-footer">
          <div className="footer-divider">
            <div className="divider-line"></div>
          </div>
          <div className="footer-content">
            <div className="footer-certification">
              <p className="footer-cert-text">
                هذا التقرير وثيقة طبية رسمية معتمدة من وزارة الصحة العراقية - دائرة صحة النجف الاشرف - مستشفى الحكيم العام - شعبة الكلية الصناعية
              </p>
              <p className="footer-cert-text">
                يمكن استخدام هذا المستند كسجل طبي رسمي معتمد للأغراض الطبية والقانونية
              </p>
            </div>
            <div className="footer-details">
              <div className="footer-row">
                <span className="footer-label">تاريخ إنشاء التقرير:</span>
                <span className="footer-value">{formatBaghdadDate(dateStr)}</span>
              </div>
              <div className="footer-row">
                <span className="footer-label">المستشفى:</span>
                <span className="footer-value">وزارة الصحة العراقية - دائرة صحة النجف الاشرف - مستشفى الحكيم العام - شعبة الكلية الصناعية</span>
              </div>
            </div>
            <div className="footer-signatures">
              <div className="signature-block">
                <div className="signature-line"></div>
                <p className="signature-label">توقيع المسؤول الطبي</p>
              </div>
              <div className="signature-block">
                <div className="signature-line"></div>
                <p className="signature-label">ختم المستشفى</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReportPage;
