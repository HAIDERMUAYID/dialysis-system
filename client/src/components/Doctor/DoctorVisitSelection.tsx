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
  Divider,
  Select
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

interface SelectedItem {
  id: number;
  notes?: string;
}

interface DoctorVisitSelectionProps {
  visitId: number;
  visitNumber: string;
  onSave: (labTests: SelectedItem[], drugs: SelectedItem[]) => Promise<void>;
  onCancel: () => void;
  onDiagnosisOnly?: () => void; // Allow diagnosis only without tests/drugs
}

const DoctorVisitSelection: React.FC<DoctorVisitSelectionProps> = ({
  visitId,
  visitNumber,
  onSave,
  onCancel,
  onDiagnosisOnly
}) => {
  const [loading, setLoading] = useState(false);
  const [labTestsCatalog, setLabTestsCatalog] = useState<LabTestCatalog[]>([]);
  const [drugsCatalog, setDrugsCatalog] = useState<DrugCatalog[]>([]);
  const [labPanels, setLabPanels] = useState<any[]>([]);
  const [prescriptionSets, setPrescriptionSets] = useState<any[]>([]);
  const [selectedLabTests, setSelectedLabTests] = useState<Map<number, SelectedItem>>(new Map());
  const [selectedDrugs, setSelectedDrugs] = useState<Map<number, SelectedItem>>(new Map());
  const [labSearchText, setLabSearchText] = useState('');
  const [drugSearchText, setDrugSearchText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ type: 'lab' | 'drug', id: number } | null>(null);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const [labResponse, drugResponse, panelsResponse, setsResponse] = await Promise.all([
        axios.get('/api/lab/catalog?is_active=true'),
        axios.get('/api/pharmacy/catalog?is_active=true'),
        axios.get('/api/lab/panels?is_active=true').catch(() => ({ data: [] })),
        axios.get('/api/pharmacy/sets?is_active=true').catch(() => ({ data: [] }))
      ]);
      
      setLabTestsCatalog(labResponse.data || []);
      setDrugsCatalog(drugResponse.data || []);
      setLabPanels(panelsResponse.data || []);
      setPrescriptionSets(setsResponse.data || []);
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
    setSelectedLabTests(prev => {
      const newMap = new Map(prev);
      if (newMap.has(testId)) {
        newMap.delete(testId);
      } else {
        newMap.set(testId, { id: testId, notes: '' });
      }
      return newMap;
    });
  };

  const handleDrugToggle = (drugId: number) => {
    setSelectedDrugs(prev => {
      const newMap = new Map(prev);
      if (newMap.has(drugId)) {
        newMap.delete(drugId);
      } else {
        newMap.set(drugId, { id: drugId, notes: '' });
      }
      return newMap;
    });
  };

  const handleAddPanel = (panel: any) => {
    if (panel.items && Array.isArray(panel.items)) {
      const newMap = new Map(selectedLabTests);
      panel.items.forEach((item: any) => {
        const testId = item.test_catalog_id;
        if (testId && !newMap.has(testId)) {
          newMap.set(testId, { id: testId, notes: '' });
        }
      });
      setSelectedLabTests(newMap);
      message.success(`تم إضافة ${panel.items.length} تحليل من مجموعة "${panel.panel_name_ar || panel.panel_name}"`);
    }
  };

  const handleAddSet = (set: any) => {
    if (set.items && Array.isArray(set.items)) {
      const newMap = new Map(selectedDrugs);
      set.items.forEach((item: any) => {
        const drugId = item.drug_catalog_id;
        if (drugId && !newMap.has(drugId)) {
          newMap.set(drugId, { id: drugId, notes: '' });
        }
      });
      setSelectedDrugs(newMap);
      message.success(`تم إضافة ${set.items.length} دواء من مجموعة "${set.set_name_ar || set.set_name}"`);
    }
  };

  const handleUpdateNotes = (type: 'lab' | 'drug', id: number, notes: string) => {
    if (type === 'lab') {
      setSelectedLabTests(prev => {
        const newMap = new Map(prev);
        const item = newMap.get(id);
        if (item) {
          newMap.set(id, { ...item, notes });
        }
        return newMap;
      });
    } else {
      setSelectedDrugs(prev => {
        const newMap = new Map(prev);
        const item = newMap.get(id);
        if (item) {
          newMap.set(id, { ...item, notes });
        }
        return newMap;
      });
    }
  };

  const handleSave = async () => {
    if (selectedLabTests.size === 0 && selectedDrugs.size === 0) {
      message.warning('يرجى اختيار تحليل واحد على الأقل أو دواء واحد على الأقل، أو الاكتفاء بالتشخيص فقط');
      return;
    }

    try {
      setSaving(true);
      const labTestsArray = Array.from(selectedLabTests.values());
      const drugsArray = Array.from(selectedDrugs.values());
      await onSave(labTestsArray, drugsArray);
      message.success('تم حفظ الاختيارات بنجاح');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDiagnosisOnly = () => {
    if (onDiagnosisOnly) {
      onDiagnosisOnly();
    }
  };

  const labColumns: ColumnsType<LabTestCatalog> = [
    {
      title: 'التحليل',
      key: 'test',
      render: (_, record) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Checkbox
              checked={selectedLabTests.has(record.id)}
              onChange={() => handleLabTestToggle(record.id)}
            />
            <div>
              <div style={{ fontWeight: 600 }}>{record.test_name_ar || record.test_name}</div>
              {record.test_name_ar && record.test_name !== record.test_name_ar && (
                <Text type="secondary" style={{ fontSize: '12px' }}>{record.test_name}</Text>
              )}
            </div>
          </Space>
          {selectedLabTests.has(record.id) && (
            <Input.TextArea
              placeholder="ملاحظات أو تعليمات خاصة بهذا التحليل (اختياري)"
              value={selectedLabTests.get(record.id)?.notes || ''}
              onChange={(e) => handleUpdateNotes('lab', record.id, e.target.value)}
              rows={2}
              style={{ marginLeft: '24px', fontSize: '12px' }}
            />
          )}
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
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Checkbox
              checked={selectedDrugs.has(record.id)}
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
          {selectedDrugs.has(record.id) && (
            <Input.TextArea
              placeholder="ملاحظات أو تعليمات خاصة بهذا الدواء (اختياري)"
              value={selectedDrugs.get(record.id)?.notes || ''}
              onChange={(e) => handleUpdateNotes('drug', record.id, e.target.value)}
              rows={2}
              style={{ marginLeft: '24px', fontSize: '12px' }}
            />
          )}
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
        onDiagnosisOnly && (
          <Button
            key="diagnosis-only"
            onClick={handleDiagnosisOnly}
            style={{ marginRight: '8px' }}
            type="default"
          >
            التشخيص فقط (بدون تحاليل أو أدوية)
          </Button>
        ),
        <Button
          key="save"
          type="primary"
          icon={<CheckOutlined />}
          loading={saving}
          onClick={handleSave}
          disabled={selectedLabTests.size === 0 && selectedDrugs.size === 0}
        >
          حفظ الاختيارات ({selectedLabTests.size} تحليل، {selectedDrugs.size} دواء)
        </Button>
      ].filter(Boolean)}
    >
      <Spin spinning={loading}>
        <Tabs defaultActiveKey="lab">
          <TabPane
            tab={
              <Space>
                <ExperimentOutlined />
                <span>التحاليل ({selectedLabTests.size})</span>
              </Space>
            }
            key="lab"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space style={{ width: '100%', marginBottom: '16px' }}>
                <Input
                  placeholder="بحث في التحاليل..."
                  prefix={<SearchOutlined />}
                  value={labSearchText}
                  onChange={(e) => setLabSearchText(e.target.value)}
                  allowClear
                  style={{ flex: 1 }}
                />
                {labPanels.length > 0 && (
                  <Select
                    placeholder="إضافة مجموعة تحاليل"
                    style={{ width: 200 }}
                    onChange={(panelId) => {
                      const panel = labPanels.find(p => p.id === panelId);
                      if (panel) handleAddPanel(panel);
                    }}
                    allowClear
                  >
                    {labPanels.map(panel => (
                      <Select.Option key={panel.id} value={panel.id}>
                        {panel.panel_name_ar || panel.panel_name}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Space>
              
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
                <span>الأدوية ({selectedDrugs.size})</span>
              </Space>
            }
            key="drugs"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space style={{ width: '100%', marginBottom: '16px' }}>
                <Input
                  placeholder="بحث في الأدوية..."
                  prefix={<SearchOutlined />}
                  value={drugSearchText}
                  onChange={(e) => setDrugSearchText(e.target.value)}
                  allowClear
                  style={{ flex: 1 }}
                />
                {prescriptionSets.length > 0 && (
                  <Select
                    placeholder="إضافة مجموعة أدوية"
                    style={{ width: 200 }}
                    onChange={(setId) => {
                      const set = prescriptionSets.find(s => s.id === setId);
                      if (set) handleAddSet(set);
                    }}
                    allowClear
                  >
                    {prescriptionSets.map(set => (
                      <Select.Option key={set.id} value={set.id}>
                        {set.set_name_ar || set.set_name}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Space>
              
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
                <Text strong>التحاليل المختارة: {selectedLabTests.size}</Text>
              </Space>
            </Col>
            <Col span={12}>
              <Space>
                <MedicineBoxOutlined style={{ color: '#0284c7' }} />
                <Text strong>الأدوية المختارة: {selectedDrugs.size}</Text>
              </Space>
            </Col>
          </Row>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
            {selectedLabTests.size === 0 && selectedDrugs.size === 0 && (
              <Text type="secondary">يرجى اختيار تحليل واحد على الأقل أو دواء واحد على الأقل، أو الاكتفاء بالتشخيص فقط</Text>
            )}
            {selectedLabTests.size > 0 && selectedDrugs.size === 0 && (
              <Text type="secondary">سيتم إرسال التحاليل المختارة فقط إلى المختبر</Text>
            )}
            {selectedLabTests.size === 0 && selectedDrugs.size > 0 && (
              <Text type="secondary">سيتم إرسال الأدوية المختارة فقط إلى الصيدلية</Text>
            )}
            {selectedLabTests.size > 0 && selectedDrugs.size > 0 && (
              <Text type="secondary">سيتم إرسال التحاليل إلى المختبر والأدوية إلى الصيدلية</Text>
            )}
          </div>
        </Card>
      </Spin>
    </Modal>
  );
};

export default DoctorVisitSelection;
