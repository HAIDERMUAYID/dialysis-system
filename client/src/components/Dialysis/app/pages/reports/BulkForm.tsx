import React, { useState } from 'react';
import { Button, Input, Space } from 'antd';

const { TextArea } = Input;

export interface BulkFormProps {
  placeholder: string;
  onSubmit: (raw: string) => void;
}

const BulkForm: React.FC<BulkFormProps> = ({ placeholder, onSubmit }) => {
  const [text, setText] = useState(placeholder);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <TextArea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="primary" onClick={() => onSubmit(text)}>
        إرسال
      </Button>
    </Space>
  );
};

export default BulkForm;
