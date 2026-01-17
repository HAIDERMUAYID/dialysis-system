import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Space } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import axios from 'axios';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const response = await axios.post('/api/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password
      });

      message.success('تم تغيير كلمة المرور بنجاح');
      form.resetFields();
      onClose();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء تغيير كلمة المرور';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <LockOutlined />
          <span>تغيير كلمة المرور</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="current_password"
          label="كلمة المرور الحالية"
          rules={[
            { required: true, message: 'يرجى إدخال كلمة المرور الحالية' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="أدخل كلمة المرور الحالية"
            size="large"
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Form.Item
          name="new_password"
          label="كلمة المرور الجديدة"
          rules={[
            { required: true, message: 'يرجى إدخال كلمة المرور الجديدة' },
            { min: 6, message: 'كلمة المرور يجب أن تكون على الأقل 6 أحرف' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="أدخل كلمة المرور الجديدة"
            size="large"
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="تأكيد كلمة المرور الجديدة"
          dependencies={['new_password']}
          rules={[
            { required: true, message: 'يرجى تأكيد كلمة المرور الجديدة' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('كلمة المرور الجديدة وتأكيدها غير متطابقين'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="أعد إدخال كلمة المرور الجديدة"
            size="large"
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>
              إلغاء
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              تغيير كلمة المرور
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
