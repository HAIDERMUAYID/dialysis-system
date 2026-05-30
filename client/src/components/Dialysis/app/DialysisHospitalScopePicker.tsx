import React from 'react';
import { Button, Space, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import { dialysisHaptic } from './useDialysisHaptic';
import type { DialysisHospitalScope } from './dialysisContext';
import './dialysis-hospital-picker.css';

export interface HospitalOption {
  value: DialysisHospitalScope;
  label: string;
}

interface DialysisHospitalScopePickerProps {
  options: HospitalOption[];
  value: DialysisHospitalScope | null;
  onChange: (value: DialysisHospitalScope) => void;
  onRefresh: () => void;
  canManageHospital: boolean;
  onNewHospital: () => void;
}

const DialysisHospitalScopePicker: React.FC<DialysisHospitalScopePickerProps> = ({
  options,
  value,
  onChange,
  onRefresh,
  canManageHospital,
  onNewHospital,
}) => (
  <div className="d-app-hospital-picker-mobile">
    {options.length === 0 ? (
      <Empty description="لا توجد مستشفيات متاحة. اضغط «تحديث القائمة»." />
    ) : (
    <div className="d-app-hospital-picker-mobile__list" role="listbox" aria-label="اختر المستشفى">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="option"
            aria-selected={selected}
            className={`d-app-hospital-picker-mobile__item${selected ? ' is-selected' : ''}`}
            onClick={() => {
              dialysisHaptic('tap');
              onChange(opt.value);
            }}
          >
            <span className="d-app-hospital-picker-mobile__label">{opt.label}</span>
            {selected ? <CheckOutlined className="d-app-hospital-picker-mobile__check" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
    )}
    <Space direction="vertical" size="small" className="d-app-hospital-picker-mobile__actions">
      <Button icon={<ReloadOutlined />} block size="large" onClick={onRefresh}>
        تحديث القائمة
      </Button>
      {canManageHospital && (
        <Button type="primary" icon={<PlusOutlined />} block size="large" onClick={onNewHospital}>
          مستشفى جديد
        </Button>
      )}
    </Space>
  </div>
);

export default DialysisHospitalScopePicker;
