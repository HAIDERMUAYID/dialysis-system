import React, { useMemo } from 'react';
import { InputNumber, Select, Space, Typography } from 'antd';
import type { PackagingUnitRow } from './dialysisUnitUtils';
import { estimateBaseQty, defaultUnitForItem } from './dialysisUnitUtils';

const { Text } = Typography;

interface Props {
  units: PackagingUnitRow[];
  quantity: number | null | undefined;
  unitCode: string | undefined;
  onQuantityChange: (q: number | null) => void;
  onUnitChange: (code: string) => void;
  min?: number;
  disabled?: boolean;
  /** عرض تقديري بالوحدة الأساسية */
  showBaseHint?: boolean;
}

const DialysisUnitQuantityInput: React.FC<Props> = ({
  units,
  quantity,
  unitCode,
  onQuantityChange,
  onUnitChange,
  min = 0.001,
  disabled,
  showBaseHint = true,
}) => {
  const options = useMemo(() => {
    if (!units.length) return [];
    return units.map((u) => ({
      value: u.unit_code,
      label: u.label,
    }));
  }, [units]);

  const effectiveUnit = unitCode || defaultUnitForItem(units);
  const baseLabel =
    units.find((u) => u.is_inventory_base || u.is_base)?.label ?? units[0]?.label ?? 'مخزون';
  const baseEstimate =
    quantity != null && Number.isFinite(quantity)
      ? estimateBaseQty(units, quantity, effectiveUnit)
      : null;

  if (!units.length) {
    return (
      <InputNumber
        min={min}
        value={quantity ?? undefined}
        onChange={(v) => onQuantityChange(typeof v === 'number' ? v : null)}
        disabled={disabled}
        style={{ width: '100%' }}
      />
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Space.Compact style={{ width: '100%' }}>
        <InputNumber
          min={min}
          value={quantity ?? undefined}
          onChange={(v) => onQuantityChange(typeof v === 'number' ? v : null)}
          disabled={disabled}
          style={{ flex: 1, minWidth: 100 }}
        />
        <Select
          value={effectiveUnit}
          onChange={onUnitChange}
          options={options}
          disabled={disabled}
          style={{ minWidth: 110 }}
        />
      </Space.Compact>
      {showBaseHint && baseEstimate != null && baseEstimate > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          ≈ {baseEstimate} {baseLabel} (وحدة المخزون)
        </Text>
      )}
    </Space>
  );
};

export default DialysisUnitQuantityInput;
