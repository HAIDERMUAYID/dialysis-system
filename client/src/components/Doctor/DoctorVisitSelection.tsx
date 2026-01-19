import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Tabs,
  Table,
  Checkbox,
  Button,
  Space,
  Input,
  message,
  Tag,
  Empty,
  Spin,
  Typography,
  Row,
  Col,
  Divider
} from 'antd';
import {
  ExperimentOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  CheckOutlined
} from '@ant-design/icons';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';
import { LabTestCatalog, DrugCatalog } from '../../types';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface DoctorVisitSelectionProps {
  visitId: number;
  visitNumber: string;
  onSave: (labTestIds: number[], drugIds: number[]) => Promise<void>;
  onCancel: () => void;
}

const DoctorVisitSelection: React.FC<DoctorVisitSelectionProps> = ({
  visitId,
  visitNumber,
  onSave,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [labTestsCatalog, setLabTestsCatalog] = useState<LabTestCatalog[]>([]);
  const [drugsCatalog, setDrugsCatalog] = useState<DrugCatalog[]>([]);
  const [selectedLabTests, setSelectedLabTests] = useState<number[]>([]);
  const [selectedDrugs, setSelectedDrugs] = useState<number[]>([]);
  const [labSearchText, setLabSearchText] = useState('');
  const [drugSearchText, setDrugSearchText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const [labResponse, drugResponse] = await Promise.all([
        axios.get('/api/lab/catalog?is_active=true'),
        axios.get('/api/pharmacy/catalog?is_active=true')
      ]);
      
      setLabTestsCatalog(labResponse.data || []);
      setDrugsCatalog(drugResponse.data || []);
    } catch (error: any) {
      console.error('Error fetching catalogs:', error);
      message.error('حدث خطأ أثناء جلب الكتالوجات');
    } finally {
      setLoading(false);
    }
  };

  const filteredLabTests = labTestsCatalog.filter(test =>
    (test.test_name || '').toLowerCase().includes(labSearchText.toLowerCase()) ||
    (test.test_name_ar || '').toLowerCase().includes(labSearchText.toLowerCase())
  );

  const filteredDrugs = drugsCatalog.filter(drug =>
    (drug.drug_name || '').toLowerCase().includes(drugSearchText.toLowerCase()) ||
    (drug.drug_name_ar || '').toLowerCase().includes(drugSearchText.toLowerCase())
  );

  const handleLabTestToggle = (testId: number) => {
    setSelectedLabTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const handleDrugToggle = (drugId: number) => {
    setSelectedDrugs(prev =>
      prev.includes(drugId)
        ? prev.filter(id => id !== drugId)
        : [...prev, drugId]
    );
  };

  const handleSave = async () => {
    if (selectedLabTests.length === 0 && selectedDrugs.length === 0) {
      message.warning('يرجى اختيار تحليل واحد على الأقل أو دواء واحد على الأقل');
      return;
    }

    try {
      setSaving(true);
      await onSave(selectedLabTests, selectedDrugs);
      message.success('تم حفظ الاختيارات بنجاح');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const labColumns: ColumnsType<LabTestCatalog> = [
    {
      title: 'التحليل',
      key: 'test',
      render: (_, record) => (
        <Space>
          <Checkbox
            checked={selectedLabTests.includes(record.id)}
            onChange={() => handleLabTestToggle(record.id)}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{record.test_name_ar || record.test_name}</div>
            {record.test_name_ar && record.test_name !== record.test_name_ar && (
              <Text type="secondary" style={{ fontSize: '12px' }}>{record.test_name}</Text>
            )}
          </div>
        </Space>
      )
    },
    {
      title: 'الوحدة',
      dataIndex: 'unit',
      key: 'unit',
      render: (unit) => unit || '-'
    },
    {
      title: 'المدى الطبيعي',
      key: 'normal_range',
      render: (_, record) => {
        if (record.normal_range_text) return record.normal_range_text;
        if (record.normal_range_min && record.normal_range_max) {
          return `${record.normal_range_min} - ${record.normal_range_max}`;
        }
        return '-';
      }
    }
  ];

  const drugColumns: ColumnsType<DrugCatalog> = [
    {
      title: 'الدواء',
      key: 'drug',
      render: (_, record) => (
        <Space>
          <Checkbox
            checked={selectedDrugs.includes(record.id)}
            onChange={() => handleDrugToggle(record.id)}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{record.drug_name_ar || record.drug_name}</div>
            {record.drug_name_ar && record.drug_name !== record.drug_name_ar && (
              <Text type="secondary" style={{ fontSize: '12px' }}>{record.drug_name}</Text>
            )}
            {record.strength && (
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                {record.strength} {record.form && `- ${record.form}`}
              </Text>
            )}
          </div>
        </Space>
      )
    },
    {
      title: 'الشركة المصنعة',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      render: (manufacturer) => manufacturer || '-'
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <MedicineBoxOutlined />
          <span>اختيار التحاليل والأدوية - زيارة {visitNumber}</span>
        </Space>
      }
      open={true}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          إلغاء
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<CheckOutlined />}
          loading={saving}
          onClick={handleSave}
          disabled={selectedLabTests.length === 0 && selectedDrugs.length === 0}
        >
          حفظ الاختيارات ({selectedLabTests.length} تحليل، {selectedDrugs.length} دواء)
        </Button>
      ]}
    >
      <Spin spinning={loading}>
        <Tabs defaultActiveKey="lab">
          <TabPane
            tab={
              <Space>
                <ExperimentOutlined />
                <span>التحاليل ({selectedLabTests.length})</span>
              </Space>
            }
            key="lab"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Input
                placeholder="بحث في التحاليل..."
                prefix={<SearchOutlined />}
                value={labSearchText}
                onChange={(e) => setLabSearchText(e.target.value)}
                allowClear
                style={{ marginBottom: '16px' }}
              />
              
              {filteredLabTests.length > 0 ? (
                <Table
                  columns={labColumns}
                  dataSource={filteredLabTests}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              ) : (
                <Empty description="لا توجد تحاليل متاحة" />
              )}
            </Space>
          </TabPane>

          <TabPane
            tab={
              <Space>
                <MedicineBoxOutlined />
                <span>الأدوية ({selectedDrugs.length})</span>
              </Space>
            }
            key="drugs"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Input
                placeholder="بحث في الأدوية..."
                prefix={<SearchOutlined />}
                value={drugSearchText}
                onChange={(e) => setDrugSearchText(e.target.value)}
                allowClear
                style={{ marginBottom: '16px' }}
              />
              
              {filteredDrugs.length > 0 ? (
                <Table
                  columns={drugColumns}
                  dataSource={filteredDrugs}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              ) : (
                <Empty description="لا توجد أدوية متاحة" />
              )}
            </Space>
          </TabPane>
        </Tabs>

        <Divider />

        <Card size="small" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Space>
                <ExperimentOutlined style={{ color: '#0284c7' }} />
                <Text strong>التحاليل المختارة: {selectedLabTests.length}</Text>
              </Space>
            </Col>
            <Col span={12}>
              <Space>
                <MedicineBoxOutlined style={{ color: '#0284c7' }} />
                <Text strong>الأدوية المختارة: {selectedDrugs.length}</Text>
              </Space>
            </Col>
          </Row>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
            {selectedLabTests.length === 0 && selectedDrugs.length === 0 && (
              <Text type="secondary">يرجى اختيار تحليل واحد على الأقل أو دواء واحد على الأقل</Text>
            )}
            {selectedLabTests.length > 0 && selectedDrugs.length === 0 && (
              <Text type="secondary">سيتم إرسال التحاليل المختارة فقط إلى المختبر</Text>
            )}
            {selectedLabTests.length === 0 && selectedDrugs.length > 0 && (
              <Text type="secondary">سيتم إرسال الأدوية المختارة فقط إلى الصيدلية</Text>
            )}
            {selectedLabTests.length > 0 && selectedDrugs.length > 0 && (
              <Text type="secondary">سيتم إرسال التحاليل إلى المختبر والأدوية إلى الصيدلية</Text>
            )}
          </div>
        </Card>
      </Spin>
    </Modal>
  );
};

export default DoctorVisitSelection;
