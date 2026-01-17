import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message, Space, Tag, Popconfirm, Card, Typography, Row, Col, Divider, Checkbox, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { PrescriptionSet, DrugCatalog } from '../../types';
import './PrescriptionSetsManagement.css';

const { Title } = Typography;

const PrescriptionSetsManagement: React.FC = () => {
  const [sets, setSets] = useState<PrescriptionSet[]>([]);
  const [drugs, setDrugs] = useState<DrugCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSet, setEditingSet] = useState<PrescriptionSet | null>(null);
  const [selectedDrugs, setSelectedDrugs] = useState<{ drug_id: number; default_dosage?: string }[]>([]);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchSets();
    fetchDrugs();
  }, []);

  // Hide header when modal is open
  useEffect(() => {
    if (modalVisible) {
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
  }, [modalVisible]);

  const fetchSets = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/pharmacy/sets', {
        params: { is_active: true }
      });
      setSets(response.data);
    } catch (error: any) {
      message.error('فشل تحميل مجموعات الوصفات');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrugs = async () => {
    try {
      const response = await axios.get('/api/pharmacy/catalog', {
        params: { is_active: true }
      });
      setDrugs(response.data);
    } catch (error: any) {
      message.error('فشل تحميل كتالوج الأدوية');
    }
  };

  const fetchSetDetails = async (id: number) => {
    try {
      const response = await axios.get(`/api/pharmacy/sets/${id}`);
      return response.data;
    } catch (error: any) {
      message.error('فشل تحميل تفاصيل المجموعة');
      return null;
    }
  };

  const handleAdd = () => {
    setEditingSet(null);
    setSelectedDrugs([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (set: PrescriptionSet) => {
    setEditingSet(set);
    const details = await fetchSetDetails(set.id);
    
    form.setFieldsValue({
      set_name: set.set_name,
      set_name_ar: set.set_name_ar,
      description: set.description,
      is_active: set.is_active === 1
    });

    if (details && details.drugs) {
      setSelectedDrugs(details.drugs.map((d: any) => ({
        drug_id: d.drug_catalog_id,
        default_dosage: d.default_dosage
      })));
    } else {
      setSelectedDrugs([]);
    }
    
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/pharmacy/sets/${id}`);
      message.success('تم حذف المجموعة بنجاح');
      fetchSets();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل حذف المجموعة');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (selectedDrugs.length === 0) {
        message.warning('يجب اختيار دواء واحد على الأقل');
        return;
      }

      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0,
        drug_ids: selectedDrugs.map(d => d.drug_id),
        default_dosages: selectedDrugs.map(d => d.default_dosage || '')
      };

      if (editingSet) {
        await axios.put(`/api/pharmacy/sets/${editingSet.id}`, payload);
        message.success('تم تحديث المجموعة بنجاح');
      } else {
        await axios.post('/api/pharmacy/sets', payload);
        message.success('تم إضافة المجموعة بنجاح');
      }

      setModalVisible(false);
      form.resetFields();
      setSelectedDrugs([]);
      fetchSets();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    }
  };

  const toggleDrug = (drugId: number) => {
    const index = selectedDrugs.findIndex(d => d.drug_id === drugId);
    if (index >= 0) {
      setSelectedDrugs(selectedDrugs.filter(d => d.drug_id !== drugId));
    } else {
      setSelectedDrugs([...selectedDrugs, { drug_id: drugId, default_dosage: '' }]);
    }
  };

  const updateDosage = (drugId: number, dosage: string) => {
    setSelectedDrugs(selectedDrugs.map(d =>
      d.drug_id === drugId ? { ...d, default_dosage: dosage } : d
    ));
  };

  const isDrugSelected = (drugId: number) => {
    return selectedDrugs.some(d => d.drug_id === drugId);
  };

  const getDrugDosage = (drugId: number) => {
    const drug = selectedDrugs.find(d => d.drug_id === drugId);
    return drug?.default_dosage || '';
  };

  const filteredSets = sets.filter(set => {
    const setName = set.set_name || '';
    const setNameAr = set.set_name_ar || '';
    const searchLower = searchText.toLowerCase();
    return (
      setName.toLowerCase().includes(searchLower) ||
      setNameAr.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    {
      title: 'اسم المجموعة (إنجليزي)',
      dataIndex: 'set_name',
      key: 'set_name',
      sorter: (a: PrescriptionSet, b: PrescriptionSet) => {
        const nameA = (a.set_name || '').toLowerCase();
        const nameB = (b.set_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (text: string, record: PrescriptionSet) => record.set_name || '-',
    },
    {
      title: 'اسم المجموعة (عربي)',
      dataIndex: 'set_name_ar',
      key: 'set_name_ar',
      render: (text: string, record: PrescriptionSet) => record.set_name_ar || '-',
    },
    {
      title: 'عدد الأدوية',
      dataIndex: 'drugs_count',
      key: 'drugs_count',
      render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
    },
    {
      title: 'الحالة',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: number) => (
        <Tag color={isActive === 1 ? 'green' : 'red'}>
          {isActive === 1 ? 'نشط' : 'معطل'}
        </Tag>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      render: (_: any, record: PrescriptionSet) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            تعديل
          </Button>
          <Popconfirm
            title="هل أنت متأكد من حذف هذه المجموعة؟"
            onConfirm={() => handleDelete(record.id)}
            okText="نعم"
            cancelText="لا"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              حذف
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="prescription-sets-management">
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              إدارة مجموعات الوصفات
            </Title>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="بحث..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 250 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                size="large"
              >
                إضافة مجموعة جديدة
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider />

        <Table
          columns={columns}
          dataSource={filteredSets}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} مجموعة`,
          }}
        />
      </Card>

      <Modal
        title={editingSet ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setSelectedDrugs([]);
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="set_name"
            label="اسم المجموعة (إنجليزي) *"
            rules={[{ required: true, message: 'يرجى إدخال اسم المجموعة' }]}
          >
            <Input placeholder="مثال: Dialysis Prescription" />
          </Form.Item>

          <Form.Item
            name="set_name_ar"
            label="اسم المجموعة (عربي)"
          >
            <Input placeholder="مثال: وصفة غسيل كلى شائعة" />
          </Form.Item>

          <Form.Item
            name="description"
            label="الوصف"
          >
            <Input.TextArea rows={3} placeholder="وصف المجموعة..." />
          </Form.Item>

          <Form.Item
            label="اختر الأدوية *"
            required
          >
            <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12 }}>
              {drugs.map(drug => (
                <div key={drug.id} style={{ marginBottom: 16, padding: 8, border: isDrugSelected(drug.id) ? '2px solid #1890ff' : '1px solid #d9d9d9', borderRadius: 4 }}>
                  <Checkbox
                    checked={isDrugSelected(drug.id)}
                    onChange={() => toggleDrug(drug.id)}
                  >
                    <strong>{drug.drug_name_ar || drug.drug_name}</strong>
                    {drug.strength && ` (${drug.strength})`}
                    {drug.form && ` - ${drug.form}`}
                  </Checkbox>
                  {isDrugSelected(drug.id) && (
                    <div style={{ marginTop: 8, marginRight: 24 }}>
                      <Input
                        placeholder="الجرعة الافتراضية (اختياري)"
                        value={getDrugDosage(drug.id)}
                        onChange={(e) => updateDosage(drug.id, e.target.value)}
                        size="small"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedDrugs.length > 0 && (
              <div style={{ marginTop: 8, color: '#52c41a' }}>
                تم اختيار {selectedDrugs.length} دواء
              </div>
            )}
          </Form.Item>

          <Form.Item
            name="is_active"
            label="الحالة"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="نشط" unCheckedChildren="معطل" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingSet ? 'تحديث' : 'إضافة'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setSelectedDrugs([]);
              }}>
                إلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PrescriptionSetsManagement;
