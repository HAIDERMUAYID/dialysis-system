import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Space, Tag, Popconfirm, Card, Typography, Row, Col, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { LabTestCatalog } from '../../types';
import './LabCatalogManagement.css';

const { Title } = Typography;

const LabCatalogManagement: React.FC = () => {
  const [tests, setTests] = useState<LabTestCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTestCatalog | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchTests();
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

  const fetchTests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/lab/catalog', {
        params: { is_active: true }
      });
      setTests(response.data);
    } catch (error: any) {
      message.error('فشل تحميل كتالوج التحاليل');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTest(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (test: LabTestCatalog) => {
    setEditingTest(test);
    form.setFieldsValue({
      test_name: test.test_name,
      test_name_ar: test.test_name_ar,
      unit: test.unit,
      normal_range_min: test.normal_range_min,
      normal_range_max: test.normal_range_max,
      normal_range_text: test.normal_range_text,
      description: test.description,
      is_active: test.is_active === 1
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/lab/catalog/${id}`);
      message.success('تم حذف التحليل بنجاح');
      fetchTests();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل حذف التحليل');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0
      };

      if (editingTest) {
        await axios.put(`/api/lab/catalog/${editingTest.id}`, payload);
        message.success('تم تحديث التحليل بنجاح');
      } else {
        await axios.post('/api/lab/catalog', payload);
        message.success('تم إضافة التحليل بنجاح');
      }

      setModalVisible(false);
      form.resetFields();
      fetchTests();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    }
  };

  const filteredTests = tests.filter(test =>
    (test.test_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (test.test_name_ar || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'اسم التحليل (إنجليزي)',
      dataIndex: 'test_name',
      key: 'test_name',
      sorter: (a: LabTestCatalog, b: LabTestCatalog) => {
        const nameA = (a.test_name || '').toLowerCase();
        const nameB = (b.test_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (text: string, record: LabTestCatalog) => record.test_name || '-',
    },
    {
      title: 'اسم التحليل (عربي)',
      dataIndex: 'test_name_ar',
      key: 'test_name_ar',
      render: (text: string, record: LabTestCatalog) => record.test_name_ar || '-',
    },
    {
      title: 'وحدة القياس',
      dataIndex: 'unit',
      key: 'unit',
    },
    {
      title: 'المدى الطبيعي',
      key: 'normal_range',
      render: (record: LabTestCatalog) => {
        if (record.normal_range_text) {
          return <span>{record.normal_range_text}</span>;
        } else if (record.normal_range_min && record.normal_range_max) {
          return <span>{record.normal_range_min} - {record.normal_range_max}</span>;
        } else if (record.normal_range_min) {
          return <span>≥ {record.normal_range_min}</span>;
        } else if (record.normal_range_max) {
          return <span>≤ {record.normal_range_max}</span>;
        }
        return <span>-</span>;
      },
    },
    {
      title: 'الحالة',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: number, record: LabTestCatalog) => {
        const active = isActive !== undefined ? isActive : (record.is_active !== undefined ? record.is_active : 1);
        return (
          <Tag color={active === 1 ? 'green' : 'red'}>
            {active === 1 ? 'نشط' : 'معطل'}
          </Tag>
        );
      },
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      render: (_: any, record: LabTestCatalog) => (
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
            title="هل أنت متأكد من حذف هذا التحليل؟"
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
    <div className="lab-catalog-management">
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              إدارة كتالوج التحاليل
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
                إضافة تحليل جديد
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider />

        <Table
          columns={columns}
          dataSource={filteredTests}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} تحليل`,
          }}
        />
      </Card>

      <Modal
        title={editingTest ? 'تعديل التحليل' : 'إضافة تحليل جديد'}
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
            name="test_name"
            label="اسم التحليل (إنجليزي) *"
            rules={[{ required: true, message: 'يرجى إدخال اسم التحليل' }]}
          >
            <Input placeholder="مثال: Creatinine" />
          </Form.Item>

          <Form.Item
            name="test_name_ar"
            label="اسم التحليل (عربي)"
          >
            <Input placeholder="مثال: الكرياتينين" />
          </Form.Item>

          <Form.Item
            name="unit"
            label="وحدة القياس *"
            rules={[{ required: true, message: 'يرجى إدخال وحدة القياس' }]}
          >
            <Input placeholder="مثال: mg/dL" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="normal_range_min"
                label="الحد الأدنى"
              >
                <InputNumber style={{ width: '100%' }} placeholder="مثال: 0.6" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="normal_range_max"
                label="الحد الأعلى"
              >
                <InputNumber style={{ width: '100%' }} placeholder="مثال: 1.2" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="normal_range_text"
            label="المدى الطبيعي (نص)"
            tooltip="إذا أردت إدخال المدى الطبيعي كنص بدلاً من الأرقام"
          >
            <Input placeholder="مثال: 0.6 - 1.2 mg/dL" />
          </Form.Item>

          <Form.Item
            name="description"
            label="الوصف"
          >
            <Input.TextArea rows={3} placeholder="وصف التحليل..." />
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
                {editingTest ? 'تحديث' : 'إضافة'}
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

export default LabCatalogManagement;
