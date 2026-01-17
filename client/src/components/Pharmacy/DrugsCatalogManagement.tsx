import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message, Space, Tag, Popconfirm, Card, Typography, Row, Col, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { DrugCatalog } from '../../types';
import './DrugsCatalogManagement.css';

const { Title } = Typography;

const DrugsCatalogManagement: React.FC = () => {
  const [drugs, setDrugs] = useState<DrugCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugCatalog | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
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

  const fetchDrugs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/pharmacy/catalog', {
        params: { is_active: true }
      });
      setDrugs(response.data);
    } catch (error: any) {
      message.error('فشل تحميل كتالوج الأدوية');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDrug(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (drug: DrugCatalog) => {
    setEditingDrug(drug);
    form.setFieldsValue({
      drug_name: drug.drug_name,
      drug_name_ar: drug.drug_name_ar,
      form: drug.form,
      strength: drug.strength,
      manufacturer: drug.manufacturer,
      description: drug.description,
      is_active: drug.is_active === 1
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/pharmacy/catalog/${id}`);
      message.success('تم حذف الدواء بنجاح');
      fetchDrugs();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل حذف الدواء');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0
      };

      if (editingDrug) {
        await axios.put(`/api/pharmacy/catalog/${editingDrug.id}`, payload);
        message.success('تم تحديث الدواء بنجاح');
      } else {
        await axios.post('/api/pharmacy/catalog', payload);
        message.success('تم إضافة الدواء بنجاح');
      }

      setModalVisible(false);
      form.resetFields();
      fetchDrugs();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    }
  };

  const filteredDrugs = drugs.filter(drug =>
    drug.drug_name.toLowerCase().includes(searchText.toLowerCase()) ||
    (drug.drug_name_ar && drug.drug_name_ar.includes(searchText))
  );

  const columns = [
    {
      title: 'اسم الدواء (إنجليزي)',
      dataIndex: 'drug_name',
      key: 'drug_name',
      sorter: (a: DrugCatalog, b: DrugCatalog) => a.drug_name.localeCompare(b.drug_name),
    },
    {
      title: 'اسم الدواء (عربي)',
      dataIndex: 'drug_name_ar',
      key: 'drug_name_ar',
    },
    {
      title: 'الشكل',
      dataIndex: 'form',
      key: 'form',
    },
    {
      title: 'التركيز/العيار',
      dataIndex: 'strength',
      key: 'strength',
    },
    {
      title: 'الشركة المصنعة',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
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
      render: (_: any, record: DrugCatalog) => (
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
            title="هل أنت متأكد من حذف هذا الدواء؟"
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
    <div className="drugs-catalog-management">
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              إدارة كتالوج الأدوية
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
                إضافة دواء جديد
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider />

        <Table
          columns={columns}
          dataSource={filteredDrugs}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} دواء`,
          }}
        />
      </Card>

      <Modal
        title={editingDrug ? 'تعديل الدواء' : 'إضافة دواء جديد'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="drug_name"
            label="اسم الدواء (إنجليزي) *"
            rules={[{ required: true, message: 'يرجى إدخال اسم الدواء' }]}
          >
            <Input placeholder="مثال: Calcium Carbonate" />
          </Form.Item>

          <Form.Item
            name="drug_name_ar"
            label="اسم الدواء (عربي)"
          >
            <Input placeholder="مثال: كربونات الكالسيوم" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="form"
                label="الشكل"
              >
                <Input placeholder="مثال: Tablet, Capsule, Injection" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="strength"
                label="التركيز/العيار"
              >
                <Input placeholder="مثال: 500mg, 1000 IU" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="manufacturer"
            label="الشركة المصنعة"
          >
            <Input placeholder="اسم الشركة المصنعة" />
          </Form.Item>

          <Form.Item
            name="description"
            label="الوصف"
          >
            <Input.TextArea rows={3} placeholder="وصف الدواء..." />
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
                {editingDrug ? 'تحديث' : 'إضافة'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
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

export default DrugsCatalogManagement;
