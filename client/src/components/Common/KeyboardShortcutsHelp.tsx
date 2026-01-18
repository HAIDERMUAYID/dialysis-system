/**
 * Keyboard Shortcuts Help Modal
 * عرض جميع الاختصارات المتاحة
 */

import React from 'react';
import { Modal, Table, Tag, Space } from 'antd';
import { KeyboardOutlined } from '@ant-design/icons';

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  { key: 'Ctrl + /', description: 'التركيز على البحث', category: 'عام' },
  { key: 'Ctrl + N', description: 'إضافة جديد (مريض/زيارة)', category: 'عام' },
  { key: 'Ctrl + S', description: 'حفظ النموذج الحالي', category: 'عام' },
  { key: 'Esc', description: 'إغلاق النوافذ المنبثقة', category: 'عام' },
  { key: 'Shift + ?', description: 'عرض هذه المساعدة', category: 'عام' },
  { key: 'Ctrl + 1', description: 'الانتقال إلى Dashboard', category: 'التنقل' },
  { key: 'Ctrl + R', description: 'تحديث البيانات', category: 'التنقل' },
];

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ open, onClose }) => {
  const columns = [
    {
      title: 'الاختصار',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {key}
        </Tag>
      ),
    },
    {
      title: 'الوصف',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'الفئة',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="purple">{category}</Tag>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <KeyboardOutlined />
          <span>اختصارات لوحة المفاتيح</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      className="keyboard-shortcuts-modal"
    >
      <Table
        dataSource={shortcuts}
        columns={columns}
        pagination={false}
        rowKey="key"
        size="middle"
      />
      <div style={{ marginTop: 20, padding: 15, background: 'var(--gray-50)', borderRadius: 8 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
          💡 <strong>نصيحة:</strong> يمكنك استخدام هذه الاختصارات لتسريع عملك في النظام
        </p>
      </div>
    </Modal>
  );
};
