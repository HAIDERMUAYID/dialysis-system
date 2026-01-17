import React, { useState, useEffect } from 'react';
import { Modal, Input, Table, Space, Avatar, Tag, Button, message } from 'antd';
import { SearchOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Patient } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import './PatientSearchModal.css';

const { Search } = Input;

interface PatientSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (patientId: number) => void;
  title?: string;
}

const PatientSearchModal: React.FC<PatientSearchModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = 'اختر مريض لعرض التقرير الشامل'
}) => {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible) {
      fetchPatients();
      // Hide header when modal is open
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = 'none';
      }
    } else {
      // Show header when modal closes
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    }
    
    return () => {
      // Ensure header is shown when component unmounts
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, [visible]);

  useEffect(() => {
    if (searchText.trim()) {
      const filtered = patients.filter(p =>
        (p.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (p.national_id || '').includes(searchText) ||
        (p.phone || '').includes(searchText)
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [searchText, patients]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/patients');
      // Handle both old format (array) and new format (object with data and pagination)
      const patientsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setPatients(patientsData);
      setFilteredPatients(patientsData);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء جلب قائمة المرضى');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (patient: Patient) => {
    onSelect(patient.id);
    onClose();
    setSearchText('');
  };

  const columns: ColumnsType<Patient> = [
    {
      title: 'المريض',
      key: 'patient',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{record.name}</div>
            {record.national_id && (
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                رقم الهوية: {record.national_id}
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'رقم الهوية',
      dataIndex: 'national_id',
      key: 'national_id',
      render: (text: string) => text || '-',
    },
    {
      title: 'الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => text || '-',
    },
    {
      title: 'العمر',
      dataIndex: 'age',
      key: 'age',
      render: (age: number) => age || '-',
    },
    {
      title: 'الجنس',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => (
        <Tag color={gender === 'ذكر' ? 'blue' : 'pink'}>{gender || '-'}</Tag>
      ),
    },
    {
      title: 'فئة المريض',
      dataIndex: 'patient_category',
      key: 'patient_category',
      render: (category: string) => category ? (
        <Tag color="cyan">{category}</Tag>
      ) : (
        <span>-</span>
      ),
    },
    {
      title: 'الإجراء',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => handleSelect(record)}
          size="small"
        >
          عرض التقرير
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined style={{ fontSize: '20px', color: '#667eea' }} />
          <span style={{ fontSize: '18px', fontWeight: 700 }}>{title}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      className="patient-search-modal"
    >
      <div className="patient-search-content">
        <Search
          placeholder="ابحث عن المريض بالاسم، رقم الهوية، أو رقم الهاتف..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 20 }}
          className="patient-search-input"
        />

        <Table
          columns={columns}
          dataSource={filteredPatients}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} مريض`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ y: 400 }}
          className="patient-search-table"
          onRow={(record) => ({
            onClick: () => handleSelect(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>
    </Modal>
  );
};

export default PatientSearchModal;
