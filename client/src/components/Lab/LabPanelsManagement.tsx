import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message, Space, Tag, Popconfirm, Card, Typography, Row, Col, Divider, Select, Transfer, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { LabTestPanel, LabTestCatalog } from '../../types';
import './LabPanelsManagement.css';

const { Title } = Typography;
const { Option } = Select;

const LabPanelsManagement: React.FC = () => {
  const [panels, setPanels] = useState<LabTestPanel[]>([]);
  const [tests, setTests] = useState<LabTestCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPanel, setEditingPanel] = useState<LabTestPanel | null>(null);
  const [selectedTests, setSelectedTests] = useState<number[]>([]);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchPanels();
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

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/lab/panels');
      // Filter active panels on frontend
      setPanels(response.data.filter((p: LabTestPanel) => p.is_active === 1));
    } catch (error: any) {
      message.error('فشل تحميل مجموعات التحاليل');
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const response = await axios.get('/api/lab/catalog', {
        params: { is_active: true }
      });
      setTests(response.data);
    } catch (error: any) {
      message.error('فشل تحميل كتالوج التحاليل');
    }
  };

  const fetchPanelDetails = async (id: number) => {
    try {
      const response = await axios.get(`/api/lab/panels/${id}`);
      return response.data;
    } catch (error: any) {
      message.error('فشل تحميل تفاصيل المجموعة');
      return null;
    }
  };

  const handleAdd = () => {
    setEditingPanel(null);
    setSelectedTests([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (panel: LabTestPanel) => {
    setEditingPanel(panel);
    const details = await fetchPanelDetails(panel.id);
    
    form.setFieldsValue({
      panel_name: panel.panel_name,
      panel_name_ar: panel.panel_name_ar,
      description: panel.description,
      is_active: panel.is_active === 1
    });

    if (details && details.tests) {
      setSelectedTests(details.tests.map((t: any) => t.test_catalog_id));
    } else {
      setSelectedTests([]);
    }
    
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/lab/panels/${id}`);
      message.success('تم حذف المجموعة بنجاح');
      fetchPanels();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل حذف المجموعة');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (selectedTests.length === 0) {
        message.warning('يجب اختيار تحليل واحد على الأقل');
        return;
      }

      setLoading(true);
      
      const payload = {
        ...values,
        is_active: values.is_active !== undefined ? (values.is_active ? 1 : 0) : 1,
        test_ids: selectedTests
      };

      if (editingPanel) {
        await axios.put(`/api/lab/panels/${editingPanel.id}`, payload);
        message.success('تم تحديث المجموعة بنجاح');
      } else {
        await axios.post('/api/lab/panels', payload);
        message.success('تم إضافة المجموعة بنجاح');
      }

      setModalVisible(false);
      form.resetFields();
      setSelectedTests([]);
      setEditingPanel(null);
      await fetchPanels();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const filteredPanels = panels.filter(panel =>
    (panel.panel_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (panel.panel_name_ar || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'اسم المجموعة (إنجليزي)',
      dataIndex: 'panel_name',
      key: 'panel_name',
      sorter: (a: LabTestPanel, b: LabTestPanel) => {
        const nameA = (a.panel_name || '').toLowerCase();
        const nameB = (b.panel_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (text: string, record: LabTestPanel) => record.panel_name || '-',
    },
    {
      title: 'اسم المجموعة (عربي)',
      dataIndex: 'panel_name_ar',
      key: 'panel_name_ar',
      render: (text: string, record: LabTestPanel) => record.panel_name_ar || '-',
    },
    {
      title: 'عدد التحاليل',
      dataIndex: 'tests_count',
      key: 'tests_count',
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
      render: (_: any, record: LabTestPanel) => (
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
    <div className="lab-panels-management">
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              إدارة مجموعات التحاليل
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
          dataSource={filteredPanels}
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
        title={editingPanel ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setSelectedTests([]);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="panel_name"
            label="اسم المجموعة (إنجليزي) *"
            rules={[{ required: true, message: 'يرجى إدخال اسم المجموعة' }]}
          >
            <Input placeholder="مثال: Dialysis Panel" />
          </Form.Item>

          <Form.Item
            name="panel_name_ar"
            label="اسم المجموعة (عربي)"
          >
            <Input placeholder="مثال: تحاليل غسيل الكلى" />
          </Form.Item>

          <Form.Item
            name="description"
            label="الوصف"
          >
            <Input.TextArea rows={3} placeholder="وصف المجموعة..." />
          </Form.Item>

          <Form.Item
            label="اختر التحاليل *"
            required
          >
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12 }}>
              <Checkbox.Group
                value={selectedTests}
                onChange={(values) => setSelectedTests(values as number[])}
                style={{ width: '100%' }}
              >
                {tests.map(test => (
                  <div key={test.id} style={{ marginBottom: 8 }}>
                    <Checkbox value={test.id}>
                      {test.test_name_ar || test.test_name} ({test.unit})
                    </Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            </div>
            {selectedTests.length > 0 && (
              <div style={{ marginTop: 8, color: '#52c41a' }}>
                تم اختيار {selectedTests.length} تحليل
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
                {editingPanel ? 'تحديث' : 'إضافة'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setSelectedTests([]);
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

export default LabPanelsManagement;
