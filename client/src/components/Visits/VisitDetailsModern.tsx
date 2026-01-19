import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  Empty,
  Spin,
  message,
  Upload,
  Popconfirm,
  Tooltip,
  Badge,
  Row,
  Col,
  Descriptions,
  Timeline,
  Form,
  Input,
  Select,
  InputNumber,
  Progress
} from 'antd';
import {
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  ShoppingOutlined,
  MedicineBoxOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AppstoreAddOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import axios from 'axios';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import type { ColumnsType } from 'antd/es/table';
import { VisitDetails as VisitDetailsType, LabResult, Prescription, Diagnosis, Attachment, LabTestCatalog, LabTestPanel, DrugCatalog, PrescriptionSet } from '../../types';
import { useAuth } from '../../context/AuthContext';
import dayjs from 'dayjs';
import { formatBaghdadDateTimeArabic } from '../../utils/dayjs-config';
import { EnhancedTooltip } from '../Common/EnhancedTooltip';
import DoctorVisitSelection from '../Doctor/DoctorVisitSelection';
import './VisitDetailsModern.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface VisitDetailsModernProps {
  visitId: number;
  role: 'lab' | 'lab_manager' | 'pharmacist' | 'pharmacy_manager' | 'doctor' | 'inquiry' | 'admin';
  onComplete: (visitId: number) => void;
  onClose: () => void;
  onUpdate: () => void;
}

const VisitDetailsModern: React.FC<VisitDetailsModernProps> = ({ visitId, role, onComplete, onClose, onUpdate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<VisitDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  
  // Forms visibility
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Local state for pending items (like cashier list) - not saved to DB yet
  const [pendingLabResults, setPendingLabResults] = useState<(Partial<LabResult> & { tempKey?: string })[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<(Partial<Prescription> & { tempKey?: string })[]>([]);
  const [pendingDiagnoses, setPendingDiagnoses] = useState<(Partial<Diagnosis> & { tempKey?: string })[]>([]);
  
  // Editing state
  const [editingLabResultKey, setEditingLabResultKey] = useState<string | null>(null);
  const [editingPrescriptionKey, setEditingPrescriptionKey] = useState<string | null>(null);
  const [editingDiagnosisKey, setEditingDiagnosisKey] = useState<string | null>(null);
  
  const [uploadForm] = Form.useForm();
  
  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Catalog states
  const [labTestsCatalog, setLabTestsCatalog] = useState<LabTestCatalog[]>([]);
  const [labPanels, setLabPanels] = useState<LabTestPanel[]>([]);
  const [drugsCatalog, setDrugsCatalog] = useState<DrugCatalog[]>([]);
  const [prescriptionSets, setPrescriptionSets] = useState<PrescriptionSet[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  
  // Modal states for panels/sets
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedPanelTests, setSelectedPanelTests] = useState<any[]>([]);
  const [selectedSetDrugs, setSelectedSetDrugs] = useState<any[]>([]);
  
  // Doctor visit selection modal
  const [showDoctorSelection, setShowDoctorSelection] = useState(false);

  // Hide header when modal is open
  useEffect(() => {
    const header = document.querySelector('.modern-header, .modern-header-with-logo');
    if (header) {
      (header as HTMLElement).style.display = 'none';
    }
    
    return () => {
      // Show header when modal closes
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchVisitDetails();
      }
      if (isMounted) {
        if (role === 'lab' || role === 'lab_manager') {
          fetchLabCatalogs();
        }
        if (role === 'pharmacist' || role === 'pharmacy_manager') {
          // Add small delay to avoid rate limiting
          setTimeout(() => {
            if (isMounted) {
              fetchPharmacyCatalogs();
            }
          }, 300);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [visitId, role]);

  useEffect(() => {
    if (visit?.attachments) {
      setAttachments(visit.attachments);
    } else {
      fetchAttachments();
    }
  }, [visit]);

  const fetchVisitDetails = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await axios.get(`/api/visits/${visitId}`);
      setVisit(response.data);
      // Set attachments if they exist in visit data
      if (response.data.attachments) {
        setAttachments(response.data.attachments);
      }
    } catch (error: any) {
      console.error('Error fetching visit details:', error);
      // Don't show error if it's a 429 (rate limit) - just log it
      if (error.response?.status !== 429) {
        message.error('حدث خطأ أثناء جلب بيانات الزيارة');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchLabCatalogs = async () => {
    try {
      setLoadingCatalogs(true);
      const [testsRes, panelsRes] = await Promise.all([
        axios.get('/api/lab/catalog', { params: { is_active: true } }),
        axios.get('/api/lab/panels', { params: { is_active: true } })
      ]);
      setLabTestsCatalog(testsRes.data);
      setLabPanels(panelsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching lab catalogs:', error);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const fetchPharmacyCatalogs = async (retryCount = 0) => {
    try {
      setLoadingCatalogs(true);
      const [drugsRes, setsRes] = await Promise.all([
        axios.get('/api/pharmacy/catalog', { params: { is_active: true } }),
        axios.get('/api/pharmacy/sets', { params: { is_active: true } })
      ]);
      setDrugsCatalog(drugsRes.data || []);
      setPrescriptionSets(setsRes.data || []);
      
      if (!drugsRes.data || drugsRes.data.length === 0) {
        message.warning('لا توجد أدوية في الكتالوج. يرجى إضافة أدوية من إدارة الكتالوج أولاً.');
      }
    } catch (error: any) {
      console.error('Error fetching pharmacy catalogs:', error);
      
      // Handle 429 (Too Many Requests) with retry
      if (error.response?.status === 429 && retryCount < 2) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        setTimeout(() => {
          fetchPharmacyCatalogs(retryCount + 1);
        }, delay);
        return;
      }
      
      // Only show error if not 429 or if retries exhausted
      if (error.response?.status !== 429 || retryCount >= 2) {
        const errorMsg = error.response?.status === 429 
          ? 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.'
          : 'فشل تحميل كتالوج الأدوية: ' + (error.response?.data?.error || error.message);
        message.error(errorMsg);
      }
    } finally {
      setLoadingCatalogs(false);
    }
  };

  // Removed fetchPanelDetails and fetchSetDetails - no longer needed with inline editing

  const fetchAttachments = async () => {
    try {
      const deptMap: { [key: string]: string } = {
        'lab': 'lab',
        'lab_manager': 'lab',
        'pharmacist': 'pharmacy',
        'pharmacy_manager': 'pharmacy',
        'doctor': 'doctor',
        'inquiry': 'inquiry',
        'admin': ''
      };
      const department = deptMap[role];
      const response = await axios.get(`/api/attachments/visit/${visitId}${department ? `?department=${department}` : ''}`);
      setAttachments(response.data || []);
    } catch (error: any) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    }
  };

  // Check if this is a doctor-directed visit
  const isDoctorDirected = visit?.visit_type === 'doctor_directed';
  
  // Inline editing handlers for cashier-style list (Lab Results)
  const handleAddLabResult = () => {
    // For doctor-directed visits, lab can only edit existing results, not add new ones
    if (isDoctorDirected && role === 'lab') {
      message.warning('في الزيارات من خلال الطبيب، يمكنك فقط تعديل النتائج المختارة من قبل الطبيب');
      return;
    }
    
    const newKey = `pending-${Date.now()}-${Math.random()}`;
    const newItem: Partial<LabResult> & { tempKey: string } = {
      tempKey: newKey,
      test_catalog_id: undefined,
      test_name: '',
      result: '',
      unit: '',
      normal_range: '',
      notes: ''
    };
    setPendingLabResults([...pendingLabResults, newItem]);
    setEditingLabResultKey(newKey);
    // Scroll to the new row after a short delay
    setTimeout(() => {
      const element = document.querySelector(`[data-row-key="${newKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleUpdateLabResult = (key: string, field: string, value: any) => {
    setPendingLabResults(prev => prev.map(item => 
      item.tempKey === key ? { ...item, [field]: value } : item
    ));
  };

  const handleDeletePendingLabResult = (key: string) => {
    setPendingLabResults(pendingLabResults.filter(item => item.tempKey !== key));
    if (editingLabResultKey === key) {
      setEditingLabResultKey(null);
    }
  };

  // Inline editing handlers for cashier-style list (Prescriptions)
  const handleAddPrescription = () => {
    // For doctor-directed visits, pharmacy can only edit existing prescriptions, not add new ones
    if (isDoctorDirected && role === 'pharmacist') {
      message.warning('في الزيارات من خلال الطبيب، يمكنك فقط تعديل الأدوية المختارة من قبل الطبيب');
      return;
    }
    
    const newKey = `pending-${Date.now()}-${Math.random()}`;
    const newItem: Partial<Prescription> & { tempKey: string } = {
      tempKey: newKey,
      drug_catalog_id: undefined,
      medication_name: '',
      dosage: '',
      quantity: 1,
      instructions: ''
    };
    setPendingPrescriptions([...pendingPrescriptions, newItem]);
    setEditingPrescriptionKey(newKey);
    // Scroll to the new row after a short delay
    setTimeout(() => {
      const element = document.querySelector(`[data-row-key="${newKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleUpdatePrescription = (key: string, field: string, value: any) => {
    setPendingPrescriptions(prev => prev.map(item => 
      item.tempKey === key ? { ...item, [field]: value } : item
    ));
  };

  const handleDeletePendingPrescription = (key: string) => {
    setPendingPrescriptions(pendingPrescriptions.filter(item => item.tempKey !== key));
    if (editingPrescriptionKey === key) {
      setEditingPrescriptionKey(null);
    }
  };

  // Inline editing handlers for cashier-style list (Diagnoses)
  const handleAddDiagnosis = () => {
    const newKey = `pending-${Date.now()}-${Math.random()}`;
    const userName = user?.name || user?.username || 'غير معروف';
    const newItem: Partial<Diagnosis> & { tempKey: string; doctor_name?: string } = {
      tempKey: newKey,
      diagnosis: '',
      notes: '',
      doctor_name: userName
    };
    setPendingDiagnoses([...pendingDiagnoses, newItem]);
    setEditingDiagnosisKey(newKey);
    // Scroll to the new row after a short delay
    setTimeout(() => {
      const element = document.querySelector(`[data-row-key="${newKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleUpdateDiagnosis = (key: string, field: string, value: any) => {
    setPendingDiagnoses(prev => prev.map(item => 
      item.tempKey === key ? { ...item, [field]: value } : item
    ));
  };

  const handleDeletePendingDiagnosis = (key: string) => {
    setPendingDiagnoses(pendingDiagnoses.filter(item => item.tempKey !== key));
    if (editingDiagnosisKey === key) {
      setEditingDiagnosisKey(null);
    }
  };

  // Load panel tests for editing
  const handleSelectPanel = async (panelId: number) => {
    try {
      const response = await axios.get(`/api/lab/panels/${panelId}`);
      if (response.data.tests && response.data.tests.length > 0) {
        const tests = response.data.tests.map((test: any) => ({
          test_catalog_id: test.test_catalog_id,
          test_name: test.test_name_ar || test.test_name || '',
          unit: test.unit || '',
          normal_range: test.normal_range_text || 
            (test.normal_range_min && test.normal_range_max ? 
              `${test.normal_range_min} - ${test.normal_range_max}` : 
              test.normal_range_min ? `≥ ${test.normal_range_min}` :
              test.normal_range_max ? `≤ ${test.normal_range_max}` : ''),
          result: '',
          notes: ''
        }));
        setSelectedPanelTests(tests);
      }
    } catch (error: any) {
      message.error('فشل تحميل تفاصيل المجموعة');
    }
  };

  // Add panel tests to pending list after user enters results
  const handleConfirmPanel = () => {
    if (selectedPanelTests.length === 0) {
      message.warning('لا توجد تحاليل في المجموعة');
      return;
    }
    
    const newItems = selectedPanelTests.map((test: any) => {
      const newKey = `pending-${Date.now()}-${Math.random()}`;
      return {
        tempKey: newKey,
        test_catalog_id: test.test_catalog_id,
        test_name: test.test_name,
        result: test.result || '',
        unit: test.unit || '',
        normal_range: test.normal_range || '',
        notes: test.notes || ''
      } as Partial<LabResult> & { tempKey: string };
    });
    
    setPendingLabResults([...pendingLabResults, ...newItems]);
    setSelectedPanelTests([]);
    setShowPanelModal(false);
    message.success(`تم إضافة ${newItems.length} تحليل من المجموعة`);
  };

  // Load set drugs for editing
  const handleSelectSet = async (setId: number) => {
    try {
      const response = await axios.get(`/api/pharmacy/sets/${setId}`);
      if (response.data.drugs && response.data.drugs.length > 0) {
        const drugs = response.data.drugs.map((drug: any) => {
          let medicationName = drug.drug_name_ar || drug.drug_name || '';
          if (drug.strength) medicationName += ` ${drug.strength}`;
          if (drug.form) medicationName += ` (${drug.form})`;
          return {
            drug_catalog_id: drug.drug_catalog_id,
            medication_name: medicationName,
            dosage: drug.default_dosage || '',
            quantity: 1,
            instructions: ''
          };
        });
        setSelectedSetDrugs(drugs);
      }
    } catch (error: any) {
      message.error('فشل تحميل تفاصيل المجموعة');
    }
  };

  // Add set drugs to pending list after user enters quantities
  const handleConfirmSet = () => {
    if (selectedSetDrugs.length === 0) {
      message.warning('لا توجد أدوية في المجموعة');
      return;
    }
    
    // Validate quantities
    const invalidDrugs = selectedSetDrugs.filter(d => !d.quantity || d.quantity < 1);
    if (invalidDrugs.length > 0) {
      message.warning('يرجى تحديد الكمية لجميع الأدوية');
      return;
    }
    
    const newItems = selectedSetDrugs.map((drug: any) => {
      const newKey = `pending-${Date.now()}-${Math.random()}`;
      return {
        tempKey: newKey,
        drug_catalog_id: drug.drug_catalog_id,
        medication_name: drug.medication_name,
        dosage: drug.dosage || '',
        quantity: drug.quantity || 1,
        instructions: drug.instructions || ''
      } as Partial<Prescription> & { tempKey: string };
    });
    
    setPendingPrescriptions([...pendingPrescriptions, ...newItems]);
    setSelectedSetDrugs([]);
    setShowSetModal(false);
    message.success(`تم إضافة ${newItems.length} دواء من المجموعة`);
  };

  // Save all pending items and complete session
  const handleSaveAndCompleteSession = async () => {
    try {
      const userName = user?.name || user?.username || 'غير معروف';
      const userRole = user?.role === 'lab' ? 'التحاليل' : 
                      user?.role === 'lab_manager' ? 'مدير المختبر' :
                      user?.role === 'pharmacist' ? 'الصيدلية' :
                      user?.role === 'pharmacy_manager' ? 'مدير الصيدلية' :
                      user?.role === 'doctor' ? 'الطبيب' : 'غير معروف';

      if (role === 'lab' || role === 'lab_manager') {
        if (pendingLabResults.length === 0) {
          message.warning('يجب إضافة على الأقل نتيجة تحليل واحدة قبل إنهاء الجلسة');
          return;
        }

        // Validate all items have test_catalog_id or test_name
        const invalidItems = pendingLabResults.filter(item => !item.test_catalog_id && !item.test_name);
        if (invalidItems.length > 0) {
          message.warning('يرجى إكمال بيانات جميع التحاليل قبل إنهاء الجلسة');
          return;
        }

        // Send all lab results
        const results = await Promise.all(
          pendingLabResults.map(item => 
            axios.post('/api/lab', {
              visit_id: visitId,
              test_catalog_id: item.test_catalog_id || undefined,
              test_name: item.test_name || undefined,
              result: item.result || undefined,
              unit: item.unit || undefined,
              normal_range: item.normal_range || undefined,
              notes: item.notes || undefined
            })
          )
        );

        // Complete lab session
        await axios.post(`/api/lab/complete/${visitId}`);
        
        // Refresh visit details first to get updated data
        await fetchVisitDetails(false);
        
        // Clear pending results after data is refreshed
        setPendingLabResults([]);
        setEditingLabResultKey(null);
        
        message.success(`تم حفظ وإنهاء جلسة التحاليل بنجاح - تم إضافة ${results.length} تحليل بواسطة ${userName} (${userRole})`);
      } else if (role === 'pharmacist' || role === 'pharmacy_manager') {
        if (pendingPrescriptions.length === 0) {
          message.warning('يجب إضافة على الأقل دواء واحد قبل إنهاء الجلسة');
          return;
        }

        // Validate all items have drug_catalog_id or medication_name
        const invalidItems = pendingPrescriptions.filter(item => !item.drug_catalog_id && !item.medication_name);
        if (invalidItems.length > 0) {
          message.warning('يرجى إكمال بيانات جميع الأدوية قبل إنهاء الجلسة');
          return;
        }

        // Validate all items have quantity
        const invalidQuantity = pendingPrescriptions.filter(item => !item.quantity || item.quantity < 1);
        if (invalidQuantity.length > 0) {
          message.warning('يرجى تحديد الكمية لجميع الأدوية قبل إنهاء الجلسة');
          return;
        }

        // Send all prescriptions
        const prescriptions = await Promise.all(
          pendingPrescriptions.map(item => 
            axios.post('/api/pharmacy', {
              visit_id: visitId,
              drug_catalog_id: item.drug_catalog_id || undefined,
              medication_name: item.medication_name || undefined,
              dosage: item.dosage || undefined,
              quantity: item.quantity || 1,
              instructions: item.instructions || undefined
            })
          )
        );

        // Complete pharmacy session
        await axios.post(`/api/pharmacy/complete/${visitId}`);
        
        // Refresh visit details first to get updated data
        await fetchVisitDetails(false);
        
        // Clear pending prescriptions after data is refreshed
        setPendingPrescriptions([]);
        setEditingPrescriptionKey(null);
        
        message.success(`تم حفظ وإنهاء جلسة الصيدلية بنجاح - تم إضافة ${prescriptions.length} دواء بواسطة ${userName} (${userRole})`);
      } else if (role === 'doctor') {
        if (pendingDiagnoses.length === 0) {
          message.warning('يجب إضافة على الأقل تشخيص واحد قبل إنهاء الجلسة');
          return;
        }

        // Validate all items have diagnosis
        const invalidItems = pendingDiagnoses.filter(item => !item.diagnosis || item.diagnosis.trim() === '');
        if (invalidItems.length > 0) {
          message.warning('يرجى إكمال بيانات جميع التشخيصات قبل إنهاء الجلسة');
          return;
        }

        // Send all diagnoses
        const diagnoses = await Promise.all(
          pendingDiagnoses.map(item => 
            axios.post('/api/doctor/diagnosis', {
              visit_id: visitId,
              diagnosis: item.diagnosis,
              notes: item.notes || undefined
            })
          )
        );

        // Complete doctor session
        await axios.post(`/api/doctor/complete/${visitId}`);
        
        // Refresh visit details first to get updated data
        await fetchVisitDetails(false);
        
        // Clear pending diagnoses after data is refreshed
        setPendingDiagnoses([]);
        setEditingDiagnosisKey(null);
        
        message.success(`تم حفظ وإنهاء جلسة التشخيص بنجاح - تم إضافة ${diagnoses.length} تشخيص بواسطة ${userName} (${userRole})`);
      }

      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء حفظ وإنهاء الجلسة');
    }
  };

  const handleDeleteLabResult = async (id: number) => {
    try {
      await axios.delete(`/api/lab/${id}`);
      const userName = user?.name || user?.username || 'غير معروف';
      message.success(`تم حذف نتيجة التحليل بنجاح بواسطة ${userName}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleDeletePrescription = async (id: number) => {
    try {
      await axios.delete(`/api/pharmacy/${id}`);
      const userName = user?.name || user?.username || 'غير معروف';
      message.success(`تم حذف الدواء بنجاح بواسطة ${userName}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleDeleteDiagnosis = async (id: number) => {
    try {
      await axios.delete(`/api/doctor/diagnosis/${id}`);
      const userName = user?.name || user?.username || 'غير معروف';
      message.success(`تم حذف التشخيص بنجاح بواسطة ${userName}`);
      fetchVisitDetails();
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleFileUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file as File);
      
      const deptMap: { [key: string]: string } = {
        'lab': 'lab',
        'pharmacist': 'pharmacy',
        'doctor': 'doctor',
        'inquiry': 'inquiry'
      };
      
      const description = uploadForm.getFieldValue('description');
      formData.append('visit_id', visitId.toString());
      formData.append('department', deptMap[role] || 'inquiry');
      if (description) formData.append('description', description);

      await axios.post('/api/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const userName = user?.name || user?.username || 'غير معروف';
      message.success(`تم رفع الملف بنجاح بواسطة ${userName}`);
      fetchAttachments();
      fetchVisitDetails(); // Refresh visit details to get updated attachments
      setShowUploadModal(false);
      uploadForm.resetFields();
      if (onSuccess) onSuccess({} as any);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء رفع الملف');
      if (onError) onError(error as Error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: number) => {
    try {
      window.open(`/api/attachments/${attachmentId}/download`, '_blank');
    } catch (error: any) {
      message.error('حدث خطأ أثناء تحميل الملف');
    }
  };

  const handleDeleteAttachment = async (id: number) => {
    try {
      await axios.delete(`/api/attachments/${id}`);
      const userName = user?.name || user?.username || 'غير معروف';
      message.success(`تم حذف الملف بنجاح بواسطة ${userName}`);
      fetchAttachments();
      fetchVisitDetails(); // Refresh visit details
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ');
    }
  };


  // Lab Results columns with inline editing
  const labColumns: ColumnsType<any> = [
    {
      title: 'اسم التحليل',
      key: 'test_name',
      width: 200,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingLabResultKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Select
              showSearch
              placeholder="اختر التحليل..."
              style={{ width: '100%' }}
              value={record.test_catalog_id}
              onChange={(value) => {
                const selectedTest = labTestsCatalog.find(t => t.id === value);
                if (selectedTest) {
                  // Update all fields at once
                  setPendingLabResults(prev => prev.map(item => {
                    if (item.tempKey === record.tempKey) {
                      let normalRange = '';
                      if (selectedTest.normal_range_text) {
                        normalRange = selectedTest.normal_range_text;
                      } else if (selectedTest.normal_range_min && selectedTest.normal_range_max) {
                        normalRange = `${selectedTest.normal_range_min} - ${selectedTest.normal_range_max}`;
                      } else if (selectedTest.normal_range_min) {
                        normalRange = `≥ ${selectedTest.normal_range_min}`;
                      } else if (selectedTest.normal_range_max) {
                        normalRange = `≤ ${selectedTest.normal_range_max}`;
                      }
                      return {
                        ...item,
                        test_catalog_id: value,
                        test_name: selectedTest.test_name_ar || selectedTest.test_name || '',
                        unit: selectedTest.unit || '',
                        normal_range: normalRange
                      };
                    }
                    return item;
                  }));
                } else {
                  handleUpdateLabResult(record.tempKey, 'test_catalog_id', value);
                }
              }}
              filterOption={(input, option) => {
                const label = typeof option?.label === 'string' ? option.label : 
                             typeof option?.children === 'string' ? option.children : '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              loading={loadingCatalogs}
            >
              {labTestsCatalog.map(test => (
                <Option key={test.id} value={test.id}>
                  {test.test_name_ar || test.test_name}
                </Option>
              ))}
            </Select>
          );
        }
        return <Text>{record.test_name || '-'}</Text>;
      }
    },
    {
      title: 'النتيجة',
      key: 'result',
      width: 120,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingLabResultKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.result || ''}
              onChange={(e) => handleUpdateLabResult(record.tempKey, 'result', e.target.value)}
              placeholder="النتيجة"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{record.result || '-'}</Text>;
      }
    },
    {
      title: 'الوحدة',
      key: 'unit',
      width: 100,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingLabResultKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.unit || ''}
              onChange={(e) => handleUpdateLabResult(record.tempKey, 'unit', e.target.value)}
              placeholder="الوحدة"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{record.unit || '-'}</Text>;
      }
    },
    {
      title: 'المدى الطبيعي',
      key: 'normal_range',
      width: 150,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingLabResultKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.normal_range || ''}
              onChange={(e) => handleUpdateLabResult(record.tempKey, 'normal_range', e.target.value)}
              placeholder="المدى الطبيعي"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{record.normal_range || '-'}</Text>;
      }
    },
    {
      title: 'ملاحظات',
      key: 'notes',
      width: 150,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingLabResultKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.notes || ''}
              onChange={(e) => handleUpdateLabResult(record.tempKey, 'notes', e.target.value)}
              placeholder="ملاحظات"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text ellipsis>{record.notes || '-'}</Text>;
      }
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string, record: any) => {
        if (record.tempKey) return <Text type="secondary">جديد</Text>;
        // Try multiple date formats and fields
        const dateValue = date || record.created_at || record.createdAt;
        if (!dateValue) return <Text type="secondary">-</Text>;
        try {
          // Try dayjs first
          let dateObj = dayjs(dateValue);
          if (!dateObj.isValid()) {
            // Try as Date object
            dateObj = dayjs(new Date(dateValue));
          }
          if (dateObj.isValid()) {
            return formatBaghdadDateTimeArabic(dateValue);
          }
          return <Text type="secondary">-</Text>;
        } catch (error) {
          console.warn('Date formatting error:', error, 'Date value:', dateValue);
          return <Text type="secondary">-</Text>;
        }
      }
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        
        if (isPending) {
          return (
            <Space size="small">
              {editingLabResultKey === record.tempKey ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setEditingLabResultKey(null)}
                >
                  حفظ
                </Button>
              ) : (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditingLabResultKey(record.tempKey)}
                >
                  تعديل
                </Button>
              )}
              <Popconfirm
                title="حذف"
                onConfirm={() => handleDeletePendingLabResult(record.tempKey)}
                okText="نعم"
                cancelText="لا"
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          );
        }
        
        // For saved items, show edit/delete from DB
        return (
          <Space size="small">
            {(role === 'lab' || role === 'lab_manager') && record.id && (
              <Popconfirm
                title="حذف نتيجة التحليل"
                description="هل أنت متأكد من حذف هذه النتيجة؟"
                onConfirm={async () => {
                  try {
                    await axios.delete(`/api/lab/${record.id}`);
                    message.success('تم حذف نتيجة التحليل');
                    fetchVisitDetails();
                    onUpdate();
                  } catch (error: any) {
                    message.error(error.response?.data?.error || 'حدث خطأ');
                  }
                }}
                okText="نعم"
                cancelText="لا"
              >
                <Tooltip title="حذف">
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  // Prescriptions columns with inline editing
  const prescriptionColumns: ColumnsType<any> = [
    {
      title: 'اسم الدواء',
      key: 'medication_name',
      width: 200,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingPrescriptionKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Select
              showSearch
              placeholder="اختر الدواء..."
              style={{ width: '100%' }}
              value={record.drug_catalog_id}
              onChange={(value) => {
                const selectedDrug = drugsCatalog.find(d => d.id === value);
                handleUpdatePrescription(record.tempKey, 'drug_catalog_id', value);
                if (selectedDrug) {
                  let drugName = selectedDrug.drug_name_ar || selectedDrug.drug_name;
                  if (selectedDrug.strength) drugName += ` ${selectedDrug.strength}`;
                  if (selectedDrug.form) drugName += ` (${selectedDrug.form})`;
                  handleUpdatePrescription(record.tempKey, 'medication_name', drugName);
                }
              }}
              filterOption={(input, option) => {
                const label = typeof option?.label === 'string' ? option.label : 
                             typeof option?.children === 'string' ? option.children : '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              loading={loadingCatalogs}
            >
              {drugsCatalog.map(drug => (
                <Option key={drug.id} value={drug.id}>
                  {drug.drug_name_ar || drug.drug_name} {drug.strength ? `(${drug.strength})` : ''} {drug.form ? `[${drug.form}]` : ''}
                </Option>
              ))}
            </Select>
          );
        }
        return <Text>{record.medication_name || '-'}</Text>;
      }
    },
    {
      title: 'الجرعة',
      key: 'dosage',
      width: 120,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingPrescriptionKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.dosage || ''}
              onChange={(e) => handleUpdatePrescription(record.tempKey, 'dosage', e.target.value)}
              placeholder="الجرعة"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{record.dosage || '-'}</Text>;
      }
    },
    {
      title: 'الكمية',
      key: 'quantity',
      width: 100,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingPrescriptionKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <InputNumber
              value={record.quantity || 1}
              onChange={(value) => handleUpdatePrescription(record.tempKey, 'quantity', value || 1)}
              min={1}
              style={{ width: '100%' }}
            />
          );
        }
        return <Text>{record.quantity || '-'}</Text>;
      }
    },
    {
      title: 'التعليمات',
      key: 'instructions',
      width: 150,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingPrescriptionKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <Input
              value={record.instructions || ''}
              onChange={(e) => handleUpdatePrescription(record.tempKey, 'instructions', e.target.value)}
              placeholder="التعليمات"
              style={{ width: '100%' }}
            />
          );
        }
        return <Text ellipsis>{record.instructions || '-'}</Text>;
      }
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string, record: any) => {
        if (record.tempKey) return <Text type="secondary">جديد</Text>;
        // Try multiple date formats and fields
        const dateValue = date || record.created_at || record.createdAt;
        if (!dateValue) return <Text type="secondary">-</Text>;
        try {
          // Try dayjs first
          let dateObj = dayjs(dateValue);
          if (!dateObj.isValid()) {
            // Try as Date object
            dateObj = dayjs(new Date(dateValue));
          }
          if (dateObj.isValid()) {
            return formatBaghdadDateTimeArabic(dateValue);
          }
          return <Text type="secondary">-</Text>;
        } catch (error) {
          console.warn('Date formatting error:', error, 'Date value:', dateValue);
          return <Text type="secondary">-</Text>;
        }
      }
    },
    {
      title: 'بواسطة',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 180,
      render: (text: string, record: any) => {
        if (record.tempKey) return <Text type="secondary">-</Text>;
        return text ? (
          <Space>
            <Text strong>{text}</Text>
            <Tag color="orange">الصيدلية</Tag>
          </Space>
        ) : '-';
      }
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        
        if (isPending) {
          return (
            <Space size="small">
              {editingPrescriptionKey === record.tempKey ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setEditingPrescriptionKey(null)}
                >
                  حفظ
                </Button>
              ) : (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditingPrescriptionKey(record.tempKey)}
                >
                  تعديل
                </Button>
              )}
              <Popconfirm
                title="حذف"
                onConfirm={() => handleDeletePendingPrescription(record.tempKey)}
                okText="نعم"
                cancelText="لا"
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          );
        }
        
        // For saved items, show delete from DB
        return (
          <Space size="small">
            {(role === 'pharmacist' || role === 'pharmacy_manager') && record.id && (
              <Popconfirm
                title="حذف الدواء"
                description="هل أنت متأكد من حذف هذا الدواء؟"
                onConfirm={async () => {
                  try {
                    await axios.delete(`/api/pharmacy/${record.id}`);
                    message.success('تم حذف الدواء');
                    fetchVisitDetails();
                    onUpdate();
                  } catch (error: any) {
                    message.error(error.response?.data?.error || 'حدث خطأ');
                  }
                }}
                okText="نعم"
                cancelText="لا"
              >
                <Tooltip title="حذف">
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  // Diagnoses columns with inline editing
  const diagnosisColumns: ColumnsType<any> = [
    {
      title: 'التشخيص',
      key: 'diagnosis',
      width: 300,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingDiagnosisKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <TextArea
              value={record.diagnosis || ''}
              onChange={(e) => handleUpdateDiagnosis(record.tempKey, 'diagnosis', e.target.value)}
              placeholder="التشخيص"
              rows={2}
              style={{ width: '100%' }}
            />
          );
        }
        return <Text ellipsis>{record.diagnosis || '-'}</Text>;
      }
    },
    {
      title: 'ملاحظات',
      key: 'notes',
      width: 200,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        const isEditing = editingDiagnosisKey === record.tempKey;
        
        if (isPending && isEditing) {
          return (
            <TextArea
              value={record.notes || ''}
              onChange={(e) => handleUpdateDiagnosis(record.tempKey, 'notes', e.target.value)}
              placeholder="ملاحظات"
              rows={2}
              style={{ width: '100%' }}
            />
          );
        }
        return <Text ellipsis>{record.notes || '-'}</Text>;
      }
    },
    {
      title: 'الطبيب',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 150,
      render: (text: string, record: any) => {
        const doctorName = record.tempKey ? record.doctor_name : (text || record.doctor_name);
        if (record.tempKey) {
          return doctorName ? (
            <Space>
              <Text strong>{doctorName}</Text>
              <Tag color="purple">الطبيب</Tag>
            </Space>
          ) : <Text type="secondary">-</Text>;
        }
        return doctorName ? (
          <Space>
            <Text strong>{doctorName}</Text>
            <Tag color="purple">الطبيب</Tag>
          </Space>
        ) : '-';
      }
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string, record: any) => {
        if (record.tempKey) return <Text type="secondary">جديد</Text>;
        // Try multiple date formats and fields
        const dateValue = date || record.created_at || record.createdAt;
        if (!dateValue) return <Text type="secondary">-</Text>;
        try {
          // Try dayjs first
          let dateObj = dayjs(dateValue);
          if (!dateObj.isValid()) {
            // Try as Date object
            dateObj = dayjs(new Date(dateValue));
          }
          if (dateObj.isValid()) {
            return formatBaghdadDateTimeArabic(dateValue);
          }
          return <Text type="secondary">-</Text>;
        } catch (error) {
          console.warn('Date formatting error:', error, 'Date value:', dateValue);
          return <Text type="secondary">-</Text>;
        }
      }
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_, record: any) => {
        const isPending = record.tempKey;
        
        if (isPending) {
          return (
            <Space size="small">
              {editingDiagnosisKey === record.tempKey ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setEditingDiagnosisKey(null)}
                >
                  حفظ
                </Button>
              ) : (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditingDiagnosisKey(record.tempKey)}
                >
                  تعديل
                </Button>
              )}
              <Popconfirm
                title="حذف"
                onConfirm={() => handleDeletePendingDiagnosis(record.tempKey)}
                okText="نعم"
                cancelText="لا"
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          );
        }
        
        // For saved items, show delete from DB
        return (
          <Space size="small">
            {role === 'doctor' && record.id && (
              <Popconfirm
                title="حذف التشخيص"
                description="هل أنت متأكد من حذف هذا التشخيص؟"
                onConfirm={async () => {
                  try {
                    await axios.delete(`/api/doctor/diagnosis/${record.id}`);
                    message.success('تم حذف التشخيص');
                    fetchVisitDetails();
                    onUpdate();
                  } catch (error: any) {
                    message.error(error.response?.data?.error || 'حدث خطأ');
                  }
                }}
                okText="نعم"
                cancelText="لا"
              >
                <Tooltip title="حذف">
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  // Attachments columns
  const attachmentColumns: ColumnsType<Attachment> = [
    {
      title: 'اسم الملف',
      key: 'filename',
      render: (_, record) => (
        <Space>
          <PaperClipOutlined />
          <Text>{record.original_filename}</Text>
        </Space>
      ),
      sorter: (a, b) => a.original_filename.localeCompare(b.original_filename)
    },
    {
      title: 'القسم',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => {
        const deptNames: { [key: string]: string } = {
          'lab': 'المختبر',
          'pharmacy': 'الصيدلية',
          'doctor': 'الطبيب',
          'inquiry': 'الاستعلامات'
        };
        return <Tag color="blue">{deptNames[dept] || dept}</Tag>;
      }
    },
    {
      title: 'الحجم',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => {
        if (!size) return '-';
        const mb = size / 1024 / 1024;
        return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(size / 1024).toFixed(2)} KB`;
      },
      width: 100
    },
    {
      title: 'رفع بواسطة',
      dataIndex: 'uploaded_by_name',
      key: 'uploaded_by_name',
      render: (text: string) => text || '-'
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatBaghdadDateTimeArabic(date),
      width: 150
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="تحميل">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownloadAttachment(record.id)}
            />
          </Tooltip>
          {(record.uploaded_by === user?.id || role === 'admin') && (
            <Popconfirm
              title="حذف الملف"
              description="هل أنت متأكد من حذف هذا الملف؟"
              onConfirm={() => handleDeleteAttachment(record.id)}
              okText="نعم"
              cancelText="لا"
            >
              <Tooltip title="حذف">
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const deptMap: { [key: string]: 'lab' | 'pharmacy' | 'doctor' } = {
    'lab': 'lab',
    'pharmacist': 'pharmacy',
    'doctor': 'doctor'
  };

  const currentDepartment = deptMap[role];
  const isLabCompleted = visit?.lab_completed === 1;
  const isPharmacyCompleted = visit?.pharmacy_completed === 1;
  const isDoctorCompleted = visit?.doctor_completed === 1;

  // Build tabs items array using useMemo with stable dependencies
  // IMPORTANT: useMemo must be called before any early returns (React Hooks rules)
  const tabItems = useMemo(() => {
    if (!visit) return [];
    
    const items: any[] = [
      {
        key: 'info',
        label: (
          <span>
            <EyeOutlined />
            معلومات المريض
          </span>
        ),
        children: (
          <>
            <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="الاسم الكامل">
                <Text strong>{visit.patient_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="رقم الهوية">
                {visit.national_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="العمر">
                {visit.age || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="الجنس">
                <Tag color={visit.gender === 'ذكر' ? 'blue' : 'pink'}>
                  {visit.gender || '-'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="الهاتف">
                {visit.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="العنوان">
                {visit.address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="تاريخ الإنشاء">
                {formatBaghdadDateTimeArabic(visit.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="أنشئ بواسطة">
                {visit.created_by_name || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider>حالة الأقسام</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <ExperimentOutlined style={{ fontSize: '20px', color: '#fa8c16' }} />
                      <Text strong>المختبر</Text>
                    </Space>
                    <Tag color={isLabCompleted ? 'green' : 'orange'} icon={isLabCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
                      {isLabCompleted ? 'منجز' : 'معلق'}
                    </Tag>
                    {!isLabCompleted && (role === 'lab' || role === 'lab_manager') && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        أضف التحاليل ثم اضغط "حفظ وإنهاء الجلسة"
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <ShoppingOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                      <Text strong>الصيدلية</Text>
                    </Space>
                    <Tag color={isPharmacyCompleted ? 'green' : 'orange'} icon={isPharmacyCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
                      {isPharmacyCompleted ? 'منجز' : 'معلق'}
                    </Tag>
                    {!isPharmacyCompleted && (role === 'pharmacist' || role === 'pharmacy_manager') && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        أضف الأدوية ثم اضغط "حفظ وإنهاء الجلسة"
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <MedicineBoxOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
                      <Text strong>الطبيب</Text>
                    </Space>
                    <Tag color={isDoctorCompleted ? 'green' : 'orange'} icon={isDoctorCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
                      {isDoctorCompleted ? 'منجز' : 'معلق'}
                    </Tag>
                    {!isDoctorCompleted && role === 'doctor' && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        أضف التشخيص ثم اضغط "حفظ وإنهاء الجلسة"
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>
          </>
        )
      }
    ];

    // Lab Results Tab
    if (role === 'lab' || role === 'lab_manager' || role === 'doctor' || role === 'inquiry' || role === 'admin') {
      items.push({
        key: 'lab',
        label: (
          <span>
            <ExperimentOutlined />
            التحاليل
            {visit.lab_results && visit.lab_results.length > 0 && (
              <Badge count={visit.lab_results.length} style={{ backgroundColor: '#fa8c16', marginLeft: '8px' }} />
            )}
          </span>
        ),
        children: (
          <Card
            title={
              <Space>
                <ExperimentOutlined />
                <span>نتائج التحاليل</span>
                <Tag color={isLabCompleted ? 'green' : 'orange'}>
                  {isLabCompleted ? 'منجز' : 'معلق'}
                </Tag>
              </Space>
            }
            extra={
              (role === 'lab' || role === 'lab_manager') && !isLabCompleted && (
                <Space>
                  {!isDoctorDirected && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddLabResult}
                    >
                      إضافة تحليل
                    </Button>
                  )}
                  {isDoctorDirected && (
                    <Tag color="purple" icon={<MedicineBoxOutlined />}>
                      زيارة من خلال الطبيب - تعديل النتائج فقط
                    </Tag>
                  )}
                  {labPanels.length > 0 && (
                    <Button
                      icon={<AppstoreAddOutlined />}
                      onClick={() => setShowPanelModal(true)}
                    >
                      إضافة مجموعة
                    </Button>
                  )}
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => setShowUploadModal(true)}
                  >
                    رفع ملف
                  </Button>
                </Space>
              )
            }
          >
            {(() => {
              // Combine saved results with pending results
              const savedResults = (visit.lab_results || []).map((r: any) => ({ 
                ...r, 
                tempKey: null,
                // Fallback to visit date if created_at is missing
                created_at: r.created_at || visit.created_at || null
              }));
              const allResults = [...savedResults, ...pendingLabResults];
              
              if (allResults.length === 0) {
                return <Empty description="لا توجد نتائج تحاليل" />;
              }
              
              return (
                <Table
                  columns={labColumns}
                  dataSource={allResults}
                  rowKey={(record: any) => record.tempKey || record.id?.toString() || `lab-${Math.random()}`}
                  rowClassName={(record: any) => record.tempKey && editingLabResultKey === record.tempKey ? 'editing-row' : ''}
                  pagination={false}
                  size="middle"
                />
              );
            })()}
          </Card>
        )
      });
    }

    // Prescriptions Tab
    if (role === 'pharmacist' || role === 'pharmacy_manager' || role === 'doctor' || role === 'inquiry' || role === 'admin') {
      items.push({
        key: 'pharmacy',
        label: (
          <span>
            <ShoppingOutlined />
            الأدوية
            {visit.prescriptions && visit.prescriptions.length > 0 && (
              <Badge count={visit.prescriptions.length} style={{ backgroundColor: '#1890ff', marginLeft: '8px' }} />
            )}
          </span>
        ),
        children: (
          <Card
            title={
              <Space>
                <ShoppingOutlined />
                <span>الأدوية المصروفة</span>
                <Tag color={isPharmacyCompleted ? 'green' : 'orange'}>
                  {isPharmacyCompleted ? 'منجز' : 'معلق'}
                </Tag>
              </Space>
            }
            extra={
              (role === 'pharmacist' || role === 'pharmacy_manager') && !isPharmacyCompleted && (
                <Space>
                  {!isDoctorDirected && (
                    <>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddPrescription}
                      >
                        إضافة دواء
                      </Button>
                      {prescriptionSets.length > 0 && (
                        <Button
                          icon={<AppstoreAddOutlined />}
                          onClick={() => setShowSetModal(true)}
                        >
                          إضافة مجموعة
                        </Button>
                      )}
                    </>
                  )}
                  {isDoctorDirected && (
                    <Tag color="purple" icon={<MedicineBoxOutlined />}>
                      زيارة من خلال الطبيب - تعديل الكميات فقط
                    </Tag>
                  )}
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => setShowUploadModal(true)}
                  >
                    رفع ملف
                  </Button>
                </Space>
              )
            }
          >
            {(() => {
              // Combine saved prescriptions with pending prescriptions
              const savedPrescriptions = (visit.prescriptions || []).map((p: any) => ({ 
                ...p, 
                tempKey: null,
                // Fallback to visit date if created_at is missing
                created_at: p.created_at || visit.created_at || null
              }));
              const allPrescriptions = [...savedPrescriptions, ...pendingPrescriptions];
              
              if (allPrescriptions.length === 0) {
                return <Empty description="لا توجد أدوية مصروفة" />;
              }
              
              return (
                <Table
                  columns={prescriptionColumns}
                  dataSource={allPrescriptions}
                  rowKey={(record: any) => record.tempKey || record.id?.toString() || `prescription-${Math.random()}`}
                  rowClassName={(record: any) => record.tempKey && editingPrescriptionKey === record.tempKey ? 'editing-row' : ''}
                  pagination={false}
                  size="middle"
                />
              );
            })()}
          </Card>
        )
      });
    }

    // Diagnoses Tab
    if (role === 'doctor' || role === 'inquiry' || role === 'admin') {
      items.push({
        key: 'diagnosis',
        label: (
          <span>
            <MedicineBoxOutlined />
            التشخيص
            {visit.diagnoses && visit.diagnoses.length > 0 && (
              <Badge count={visit.diagnoses.length} style={{ backgroundColor: '#722ed1', marginLeft: '8px' }} />
            )}
          </span>
        ),
        children: (
          <Card
            title={
              <Space>
                <MedicineBoxOutlined />
                <span>التشخيص</span>
                <Tag color={isDoctorCompleted ? 'green' : 'orange'}>
                  {isDoctorCompleted ? 'منجز' : 'معلق'}
                </Tag>
              </Space>
            }
            extra={
              <Space>
                {role === 'doctor' && visit.patient_id && (
                  <Button
                    type="default"
                    icon={<HistoryOutlined />}
                    onClick={() => navigate(`/patients/${visit.patient_id}/full-report`)}
                  >
                    التقرير الطبي الشامل
                  </Button>
                )}
                {role === 'doctor' && !isDoctorCompleted && (
                  <>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddDiagnosis}
                    >
                      إضافة تشخيص
                    </Button>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => setShowUploadModal(true)}
                    >
                      رفع ملف
                    </Button>
                  </>
                )}
              </Space>
            }
          >
            {(() => {
              // Combine saved diagnoses with pending diagnoses
              const savedDiagnoses = (visit.diagnoses || []).map((d: any) => ({ 
                ...d, 
                tempKey: null,
                // Fallback to visit date if created_at is missing
                created_at: d.created_at || visit.created_at || null
              }));
              const allDiagnoses = [...savedDiagnoses, ...pendingDiagnoses];
              
              if (allDiagnoses.length === 0) {
                return <Empty description="لا يوجد تشخيص" />;
              }
              
              return (
                <Table
                  columns={diagnosisColumns}
                  dataSource={allDiagnoses}
                  rowKey={(record: any) => record.tempKey || record.id?.toString() || `diagnosis-${Math.random()}`}
                  rowClassName={(record: any) => record.tempKey && editingDiagnosisKey === record.tempKey ? 'editing-row' : ''}
                  pagination={false}
                  size="middle"
                />
              );
            })()}
          </Card>
        )
      });
    }

    // Attachments Tab
    items.push({
      key: 'attachments',
      label: (
        <span>
          <PaperClipOutlined />
          المرفقات
          {attachments.length > 0 && (
            <Badge count={attachments.length} style={{ backgroundColor: '#52c41a', marginLeft: '8px' }} />
          )}
        </span>
      ),
      children: (
        <Card
          title={
            <Space>
              <PaperClipOutlined />
              <span>الملفات المرفقة</span>
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setShowUploadModal(true)}
            >
              رفع ملف جديد
            </Button>
          }
        >
          {attachments.length > 0 ? (
            <Table
              columns={attachmentColumns}
              dataSource={attachments}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          ) : (
            <Empty description="لا توجد مرفقات" />
          )}
        </Card>
      )
    });

    // Status History Tab
    if (visit.status_history && visit.status_history.length > 0) {
      items.push({
        key: 'history',
        label: (
          <span>
            <ClockCircleOutlined />
            سجل الحالات
          </span>
        ),
        children: (
          <Card title="سجل تغيير الحالات">
            <Timeline mode="right">
              {visit.status_history.map((history) => (
                <Timeline.Item
                  key={history.id}
                  label={formatBaghdadDateTimeArabic(history.created_at)}
                >
                  <Text strong>{history.notes || history.status}</Text>
                  {history.changed_by_name && (
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        بواسطة: {history.changed_by_name}
                      </Text>
                    </div>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        )
      });
    }

    return items;
  }, [
    visit,
    role,
    isLabCompleted,
    isPharmacyCompleted,
    isDoctorCompleted,
    pendingLabResults,
    pendingPrescriptions,
    pendingDiagnoses,
    editingLabResultKey,
    editingPrescriptionKey,
    editingDiagnosisKey,
    attachments,
    labPanels,
    prescriptionSets,
    labColumns,
    prescriptionColumns,
    diagnosisColumns,
    attachmentColumns
  ]);

  if (loading) {
    return (
      <Modal
        open={true}
        onCancel={onClose}
        footer={null}
        width="90%"
        style={{ maxWidth: '1400px' }}
        title="تفاصيل الزيارة"
      >
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" />
        </div>
      </Modal>
    );
  }

  if (!visit) {
    return (
      <Modal
        open={true}
        onCancel={onClose}
        footer={null}
        width={600}
        title="خطأ"
      >
        <Empty description="حدث خطأ أثناء جلب بيانات الزيارة" />
      </Modal>
    );
  }

  // Check if this is a doctor-directed visit that needs selection
  const isDoctorDirected = visit?.visit_type === 'doctor_directed';
  const needsDoctorSelection = isDoctorDirected && 
                               role === 'doctor' && 
                               visit?.status === 'pending_doctor' &&
                               (!visit?.lab_results || visit.lab_results.length === 0) &&
                               (!visit?.prescriptions || visit.prescriptions.length === 0);

  // Auto-show doctor selection modal if needed
  useEffect(() => {
    if (needsDoctorSelection && !showDoctorSelection && visit) {
      setShowDoctorSelection(true);
    }
  }, [needsDoctorSelection, showDoctorSelection, visit]);

  const handleDoctorSelectionSave = async (labTestIds: number[], drugIds: number[]) => {
    try {
      await axios.post(`/api/doctor/select-items/${visitId}`, {
        lab_test_ids: labTestIds,
        drug_ids: drugIds
      });
      await fetchVisitDetails();
      setShowDoctorSelection(false);
      onUpdate();
      message.success('تم حفظ الاختيارات بنجاح');
    } catch (error: any) {
      throw error; // Let DoctorVisitSelection handle the error
    }
  };

  const handleDoctorSelectionSave = async (labTestIds: number[], drugIds: number[]) => {
    try {
      await axios.post(`/api/doctor/select-items/${visitId}`, {
        lab_test_ids: labTestIds,
        drug_ids: drugIds
      });
      await fetchVisitDetails();
      setShowDoctorSelection(false);
      onUpdate();
      message.success('تم حفظ الاختيارات بنجاح');
    } catch (error: any) {
      throw error; // Let DoctorVisitSelection handle the error
    }
  };

  return (
    <>
      {showDoctorSelection && visit && (
        <DoctorVisitSelection
          visitId={visitId}
          visitNumber={visit.visit_number}
          onSave={handleDoctorSelectionSave}
          onCancel={() => setShowDoctorSelection(false)}
        />
      )}
      <Modal
        open={true}
        onCancel={onClose}
        className="visit-details-modal"
        footer={
          <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button onClick={onClose}>إغلاق</Button>
            {(role === 'lab' || role === 'lab_manager') && !isLabCompleted && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSaveAndCompleteSession}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                disabled={pendingLabResults.length === 0}
              >
                حفظ وإنهاء الجلسة ({pendingLabResults.length})
              </Button>
            )}
            {(role === 'pharmacist' || role === 'pharmacy_manager') && !isPharmacyCompleted && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSaveAndCompleteSession}
                style={{ background: '#1890ff', borderColor: '#1890ff' }}
                disabled={pendingPrescriptions.length === 0}
              >
                حفظ وإنهاء الجلسة ({pendingPrescriptions.length})
              </Button>
            )}
            {role === 'doctor' && !isDoctorCompleted && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSaveAndCompleteSession}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                disabled={pendingDiagnoses.length === 0}
              >
                حفظ وإنهاء الجلسة ({pendingDiagnoses.length})
              </Button>
            )}
          </Space>
        }
        width="95%"
        style={{ 
          maxWidth: '1400px', 
          top: '20px',
          paddingBottom: 0,
          margin: '0 auto'
        }}
        styles={{
          body: {
            maxHeight: 'calc(90vh - 120px)',
            overflowY: 'auto',
            padding: '20px'
          }
        }}
        title={
          <Space>
            <FileTextOutlined />
            <span>تفاصيل الزيارة - {visit.visit_number}</span>
            <Tag color={visit.status === 'completed' ? 'green' : 'orange'}>
              {visit.status === 'completed' ? 'مكتملة' : 'قيد المعالجة'}
            </Tag>
          </Space>
        }
        destroyOnClose
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={(key: string) => {
            console.log('Tab change requested:', key);
            setActiveTab(key);
          }} 
          size="large"
          items={tabItems}
        />
      </Modal>

      {/* Removed old modals - now using inline editing like cashier */}

      {/* Lab Panel Selection Modal */}
      <Modal
        title="إضافة مجموعة التحاليل"
        open={showPanelModal}
        onCancel={() => {
          setShowPanelModal(false);
          setSelectedPanelTests([]);
        }}
        onOk={handleConfirmPanel}
        okText="إضافة"
        cancelText="إلغاء"
        width={800}
        okButtonProps={{ disabled: selectedPanelTests.length === 0 }}
      >
        {selectedPanelTests.length === 0 ? (
          <Select
            placeholder="اختر مجموعة التحاليل..."
            style={{ width: '100%' }}
            showSearch
            loading={loadingCatalogs}
            filterOption={(input, option) => {
              const label = typeof option?.label === 'string' ? option.label : 
                           typeof option?.children === 'string' ? option.children : '';
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            onChange={(value) => {
              if (value) {
                handleSelectPanel(value);
              }
            }}
          >
            {labPanels.map(panel => (
              <Option key={panel.id} value={panel.id}>
                {panel.panel_name_ar || panel.panel_name} ({panel.tests_count || 0} تحليل)
              </Option>
            ))}
          </Select>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Divider>أدخل النتائج</Divider>
            {selectedPanelTests.map((test, index) => (
              <Card key={test.test_catalog_id} size="small" style={{ marginBottom: 12 }}>
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text strong>{test.test_name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {test.unit} | {test.normal_range}
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Input
                      placeholder="النتيجة"
                      value={test.result}
                      onChange={(e) => {
                        const updated = [...selectedPanelTests];
                        updated[index].result = e.target.value;
                        setSelectedPanelTests(updated);
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <Input
                      placeholder="ملاحظات (اختياري)"
                      value={test.notes}
                      onChange={(e) => {
                        const updated = [...selectedPanelTests];
                        updated[index].notes = e.target.value;
                        setSelectedPanelTests(updated);
                      }}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* Prescription Set Selection Modal */}
      <Modal
        title="إضافة مجموعة الأدوية"
        open={showSetModal}
        onCancel={() => {
          setShowSetModal(false);
          setSelectedSetDrugs([]);
        }}
        onOk={handleConfirmSet}
        okText="إضافة"
        cancelText="إلغاء"
        width={900}
        okButtonProps={{ 
          disabled: selectedSetDrugs.length === 0 || selectedSetDrugs.some(d => !d.quantity || d.quantity < 1)
        }}
      >
        {selectedSetDrugs.length === 0 ? (
          <Select
            placeholder="اختر مجموعة الأدوية..."
            style={{ width: '100%' }}
            showSearch
            loading={loadingCatalogs}
            filterOption={(input, option) => {
              const label = typeof option?.label === 'string' ? option.label : 
                           typeof option?.children === 'string' ? option.children : '';
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            onChange={(value) => {
              if (value) {
                handleSelectSet(value);
              }
            }}
          >
            {prescriptionSets.map(set => (
              <Option key={set.id} value={set.id}>
                {set.set_name_ar || set.set_name} ({set.drugs_count || 0} دواء)
              </Option>
            ))}
          </Select>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Divider>حدد الكميات</Divider>
            {selectedSetDrugs.map((drug, index) => (
              <Card key={drug.drug_catalog_id} size="small" style={{ marginBottom: 12 }}>
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text strong>{drug.medication_name}</Text>
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="الجرعة"
                      value={drug.dosage}
                      onChange={(e) => {
                        const updated = [...selectedSetDrugs];
                        updated[index].dosage = e.target.value;
                        setSelectedSetDrugs(updated);
                      }}
                    />
                  </Col>
                  <Col span={5}>
                    <InputNumber
                      placeholder="الكمية *"
                      min={1}
                      value={drug.quantity}
                      onChange={(value) => {
                        const updated = [...selectedSetDrugs];
                        updated[index].quantity = value || 1;
                        setSelectedSetDrugs(updated);
                      }}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={5}>
                    <Input
                      placeholder="تعليمات (اختياري)"
                      value={drug.instructions}
                      onChange={(e) => {
                        const updated = [...selectedSetDrugs];
                        updated[index].instructions = e.target.value;
                        setSelectedSetDrugs(updated);
                      }}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* Upload File Modal */}
      <Modal
        title="رفع ملف مرفق"
        open={showUploadModal}
        onCancel={() => {
          setShowUploadModal(false);
          uploadForm.resetFields();
          setUploading(false);
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={uploadForm}
          layout="vertical"
        >
          <Form.Item
            name="file"
            label="اختر الملف"
            rules={[{ required: true, message: 'يرجى اختيار ملف للرفع' }]}
          >
            <Upload
              customRequest={handleFileUpload}
              maxCount={1}
              beforeUpload={() => false}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              disabled={uploading}
            >
              <Button icon={<UploadOutlined />} loading={uploading} block size="large">
                {uploading ? 'جاري الرفع...' : 'اختر ملف للرفع'}
              </Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
              يُسمح بالصور و PDF والوثائق (حتى 10MB)
            </Text>
          </Form.Item>
          <Form.Item name="description" label="وصف الملف (اختياري)">
            <TextArea rows={3} placeholder="وصف الملف" />
          </Form.Item>
          {uploading && (
            <Form.Item>
              <Progress percent={100} status="active" showInfo={false} />
            </Form.Item>
          )}
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setShowUploadModal(false);
                uploadForm.resetFields();
                setUploading(false);
              }}>
                إلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default VisitDetailsModern;
