import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Card,
  Divider,
  Typography,
  InputNumber,
  Switch,
  message,
  Tabs
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  HeartOutlined,
  ContactsOutlined,
  InsuranceOutlined,
  CalendarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { Patient } from '../../types';
import dayjs from 'dayjs';
import './PatientFormModern.css';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

interface PatientFormModernProps {
  patient?: Patient | null;
  open: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const PatientFormModern: React.FC<PatientFormModernProps> = ({ patient, open, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const patientCategories = [
    'غسل كلوي',
    'زراعة كلية',
    'متابعة ما بعد الزراعة',
    'تشخيص أولي',
    'متابعة دورية',
    'حالة طارئة',
    'أخرى'
  ];

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
  const genderOptions = ['ذكر', 'أنثى'];
  const emergencyRelations = ['زوج/زوجة', 'أب/أم', 'ابن/ابنة', 'أخ/أخت', 'قريب', 'صديق', 'آخر'];
  const iraqiGovernorates = [
    'بغداد',
    'البصرة',
    'الموصل',
    'أربيل',
    'كركوك',
    'النجف',
    'كربلاء',
    'السليمانية',
    'ديالى',
    'واسط',
    'ميسان',
    'ذي قار',
    'المثنى',
    'القادسية',
    'بابل',
    'دهوك',
    'صلاح الدين',
    'الأنبار'
  ];

  // Hide header when modal is open
  useEffect(() => {
    if (open) {
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = 'none';
      }
    } else {
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    }
    
    return () => {
      // Show header when modal closes
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, [open]);

  useEffect(() => {
    if (patient && open) {
      form.setFieldsValue({
        ...patient,
        date_of_birth: patient.date_of_birth ? dayjs(patient.date_of_birth) : null
      });
    } else if (open && !patient) {
      form.resetFields();
    }
  }, [patient, open, form]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const formData = {
        ...values,
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : null,
        age: values.age || null
      };

      if (patient?.id) {
        await axios.put(`/api/patients/${patient.id}`, formData);
        message.success('تم تحديث بيانات المريض بنجاح');
      } else {
        await axios.post('/api/patients', formData);
        message.success('تم إضافة المريض بنجاح');
      }
      
      form.resetFields();
      onSave();
    } catch (error: any) {
      console.error('Error saving patient:', error);
      const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ أثناء حفظ بيانات المريض';
      message.error(errorMessage);
      
      // Log full error for debugging
      if (error.response) {
        console.error('Response error:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <span>{patient?.id ? 'تعديل بيانات المريض' : 'إضافة مريض جديد'}</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      className="patient-form-modal"
      width="95%"
      style={{ 
        maxWidth: '1200px', 
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
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          is_active: 1,
          gender: '',
          patient_category: '',
          blood_type: ''
        }}
      >
        <Tabs 
          defaultActiveKey="basic" 
          size="large"
          items={[
            {
              key: 'basic',
              label: (
                <span>
                  <IdcardOutlined />
                  المعلومات الأساسية
                </span>
              ),
              children: (
                <>
            <Card title="المعلومات الشخصية" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="name"
                    label="الاسم الكامل"
                    rules={[{ required: true, message: 'يرجى إدخال الاسم' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="الاسم الكامل" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="national_id"
                    label="رقم الهوية الوطنية"
                  >
                    <Input prefix={<IdcardOutlined />} placeholder="رقم الهوية" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="patient_category"
                    label="فئة المريض"
                    rules={[{ required: true, message: 'يرجى اختيار فئة المريض' }]}
                  >
                    <Select placeholder="اختر فئة المريض" size="large" allowClear>
                      {patientCategories.map(cat => (
                        <Option key={cat} value={cat}>{cat}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="gender"
                    label="الجنس"
                  >
                    <Select placeholder="اختر الجنس" size="large" allowClear>
                      {genderOptions.map(g => (
                        <Option key={g} value={g}>{g}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="date_of_birth"
                    label="تاريخ الميلاد"
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="اختر تاريخ الميلاد"
                      format="YYYY-MM-DD"
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="age"
                    label="العمر"
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="العمر"
                      min={0}
                      max={150}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="blood_type"
                    label="فصيلة الدم"
                  >
                    <Select placeholder="اختر فصيلة الدم" size="large" allowClear>
                      {bloodTypes.map(bt => (
                        <Option key={bt} value={bt}>{bt}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="معلومات الاتصال" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="phone"
                    label="رقم الهاتف"
                  >
                    <Input prefix={<PhoneOutlined />} placeholder="رقم الهاتف" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="email"
                    label="البريد الإلكتروني"
                    rules={[{ type: 'email', message: 'يرجى إدخال بريد إلكتروني صحيح' }]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="البريد الإلكتروني" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="city"
                    label="المحافظة"
                  >
                    <Select placeholder="اختر المحافظة" size="large" allowClear>
                      {iraqiGovernorates.map(gov => (
                        <Option key={gov} value={gov}>{gov}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={24}>
                  <Form.Item
                    name="address"
                    label="العنوان"
                  >
                    <TextArea rows={2} placeholder="العنوان التفصيلي" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
                </>
              )
            },
            {
              key: 'medical',
              label: (
                <span>
                  <MedicineBoxOutlined />
                  المعلومات الطبية
                </span>
              ),
              children: (
                <>
            <Card title="السجل الطبي" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item
                    name="medical_history"
                    label="السجل الطبي"
                  >
                    <TextArea
                      rows={4}
                      placeholder="أدخل السجل الطبي للمريض (الأمراض السابقة، العمليات الجراحية، إلخ)"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="allergies"
                    label="الحساسية"
                  >
                    <TextArea
                      rows={3}
                      placeholder="أدخل أنواع الحساسية المعروفة للمريض"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="chronic_diseases"
                    label="الأمراض المزمنة"
                  >
                    <TextArea
                      rows={3}
                      placeholder="أدخل الأمراض المزمنة (السكري، الضغط، إلخ)"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name="current_medications"
                    label="الأدوية الحالية"
                  >
                    <TextArea
                      rows={3}
                      placeholder="أدخل الأدوية التي يتناولها المريض حالياً"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
                </>
              )
            },
            {
              key: 'contact',
              label: (
                <span>
                  <ContactsOutlined />
                  جهة الاتصال والتأمين
                </span>
              ),
              children: (
                <>
            <Card title="جهة الاتصال في حالة الطوارئ" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="emergency_contact_name"
                    label="اسم جهة الاتصال"
                  >
                    <Input prefix={<ContactsOutlined />} placeholder="اسم جهة الاتصال" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="emergency_contact_relation"
                    label="العلاقة"
                  >
                    <Select placeholder="اختر العلاقة" size="large" allowClear>
                      {emergencyRelations.map(rel => (
                        <Option key={rel} value={rel}>{rel}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="emergency_contact_phone"
                    label="رقم الهاتف"
                  >
                    <Input prefix={<PhoneOutlined />} placeholder="رقم الهاتف" size="large" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
                </>
              )
            },
            {
              key: 'notes',
              label: (
                <span>
                  <FileTextOutlined />
                  ملاحظات إضافية
                </span>
              ),
              children: (
                <>
            <Card title="ملاحظات إضافية" size="small">
              <Form.Item
                name="notes"
                label="ملاحظات"
              >
                <TextArea
                  rows={6}
                  placeholder="أدخل أي ملاحظات إضافية عن المريض"
                />
              </Form.Item>
              {patient?.id && (
                <Form.Item
                  name="is_active"
                  label="الحالة"
                  valuePropName="checked"
                  getValueFromEvent={(checked) => checked ? 1 : 0}
                  getValueProps={(value) => ({ checked: value === 1 })}
                >
                  <Switch
                    checkedChildren="نشط"
                    unCheckedChildren="غير نشط"
                  />
                </Form.Item>
              )}
            </Card>
                </>
              )
            }
          ]}
        />

        <Divider />
        
        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel} size="large">
              إلغاء
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              {patient?.id ? 'تحديث' : 'إضافة'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PatientFormModern;
