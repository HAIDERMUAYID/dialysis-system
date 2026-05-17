import React, { useEffect, useMemo } from 'react';
import { Form, Input, InputNumber, Button, Select, Typography, Card, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { PackagingLadderRow } from './dialysisUnitUtils';
import { slugUnitCode, syncHierarchyCodesLargestFirst, previewLadderChain } from './dialysisUnitUtils';

const { Text } = Typography;

interface Props {
  form: FormInstance;
  ladderName?: string;
  inventoryBaseField?: string;
}

/** إدخال من الأكبر → الأصغر؛ الحساب على الخادم بنفس الترتيب */
const DialysisPackagingEditor: React.FC<Props> = ({
  form,
  ladderName = 'packaging_ladder',
  inventoryBaseField = 'inventory_base_unit_code',
}) => {
  const rows = Form.useWatch(ladderName, form) as PackagingLadderRow[] | undefined;
  const invCode = Form.useWatch(inventoryBaseField, form) as string | undefined;

  useEffect(() => {
    if (rows?.length) {
      syncHierarchyCodesLargestFirst(form, ladderName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows?.length, rows?.map((r) => `${r?.label}|${r?.per_parent}`).join(';')]);

  const unitOptions = useMemo(() => {
    if (!rows?.length) return [];
    return rows
      .filter((r) => r?.label?.trim())
      .map((r) => ({
        value: r.unit_code || slugUnitCode(r.label, 0),
        label: r.label.trim(),
      }));
  }, [rows]);

  const chainPreview = useMemo(
    () => previewLadderChain(rows, invCode),
    [rows, invCode]
  );

  useEffect(() => {
    if (!unitOptions.length) return;
    const cur = form.getFieldValue(inventoryBaseField);
    if (!cur || !unitOptions.some((o) => o.value === cur)) {
      const smallest = unitOptions[unitOptions.length - 1]?.value;
      form.setFieldsValue({ [inventoryBaseField]: smallest });
    }
  }, [unitOptions, form, inventoryBaseField]);

  useEffect(() => {
    const row = rows?.find((r) => r.unit_code === invCode);
    if (row?.label) {
      form.setFieldsValue({ base_unit_label: row.label });
    }
  }, [invCode, rows, form]);

  return (
    <div className="d-packaging-editor">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        من <strong>الأكبر</strong> إلى <strong>الأصغر</strong>: ابدأ ببوكس أو كرتون، ثم أضف الأصغر.
        مثال: بوكس ← كرتون (1 بوكس = 20 كرتون) ← شريط (1 كرتون = 100 شريط) ← حبة (1 شريط = 10
        حبات). <strong>لا تضع الحبة في الخانة الأولى</strong> إن كان لديك شريط أو كرتون.
      </Text>

      <Form.Item name="packaging_direction" initialValue="largest_first" hidden>
        <Input />
      </Form.Item>

      <Form.List name={ladderName}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => {
              const currentRows = (form.getFieldValue(ladderName) as PackagingLadderRow[]) || [];
              const parentLabel =
                index > 0 ? currentRows[index - 1]?.label?.trim() || 'الأكبر' : null;
              const currentLabel = currentRows[index]?.label?.trim() || 'الأصغر';

              return (
                <Card
                  key={field.key}
                  size="small"
                  className="d-packaging-row-card"
                  style={{ marginBottom: 10 }}
                >
                  {index > 0 ? (
                    <div className="d-packaging-connector" aria-hidden>
                      <ArrowDownOutlined />
                      <Text type="secondary" style={{ fontSize: 11, marginInlineStart: 6 }}>
                        ثم أصغر
                      </Text>
                    </div>
                  ) : null}
                  <div className="d-packaging-row">
                    {index === 0 ? (
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        التقسيم الأكبر
                      </Text>
                    ) : (
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        تقسيم أصغر
                      </Text>
                    )}
                    <Form.Item
                      {...field}
                      name={[field.name, 'label']}
                      label="الاسم"
                      rules={[{ required: true, message: 'مطلوب' }]}
                      style={{ marginBottom: index > 0 ? 8 : 0 }}
                    >
                      <Input
                        placeholder={
                          index === 0 ? 'بوكس / كرتون' : index === 1 ? 'شريط / كرتون' : 'حبة / شريط'
                        }
                      />
                    </Form.Item>
                    {index > 0 && parentLabel ? (
                      <Form.Item
                        {...field}
                        name={[field.name, 'per_parent']}
                        label={`1 ${parentLabel} يحتوي على`}
                        rules={[{ required: true, message: 'مطلوب' }]}
                        extra={`عدد ${currentLabel} داخل كل ${parentLabel}`}
                      >
                        <InputNumber
                          min={1}
                          precision={0}
                          style={{ width: '100%' }}
                          addonAfter={currentLabel}
                        />
                      </Form.Item>
                    ) : null}
                    {index > 0 ? (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        حذف هذا المستوى
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                const current: PackagingLadderRow[] = form.getFieldValue(ladderName) || [];
                if (current.length === 0) {
                  add({ label: '', per_parent: null, unit_code: 'u0' });
                } else {
                  add({
                    label: '',
                    per_parent: undefined,
                    unit_code: `u${current.length}`,
                  });
                }
                setTimeout(() => syncHierarchyCodesLargestFirst(form, ladderName), 0);
              }}
              block
            >
              {fields.length === 0 ? 'إضافة التقسيم الأكبر' : 'إضافة تقسيم أصغر'}
            </Button>
          </>
        )}
      </Form.List>

      {chainPreview ? (
        <Alert type="info" showIcon style={{ marginTop: 12 }} message={chainPreview} />
      ) : null}

      {unitOptions.length > 0 ? (
        <Form.Item
          name={inventoryBaseField}
          label="وحدة المخزون والحساب"
          rules={[{ required: true, message: 'اختر وحدة المخزون' }]}
          style={{ marginTop: 16 }}
          extra="يُسجَّل الرصيد والوارد والخصم بهذه الوحدة. الصرف مسموح بأي مستوى عرّفته."
        >
          <Select
            options={unitOptions}
            placeholder="مثال: شريط"
            optionRender={(opt) => (
              <span>
                {opt.label}
                {opt.value === unitOptions[0]?.value ? (
                  <Text type="secondary"> (الأكبر)</Text>
                ) : null}
                {opt.value === unitOptions[unitOptions.length - 1]?.value ? (
                  <Text type="secondary"> (الأصغر)</Text>
                ) : null}
              </span>
            )}
          />
        </Form.Item>
      ) : (
        <Form.Item
          name="base_unit_label"
          label="وحدة المخزون"
          rules={[{ required: true, message: 'مطلوب' }]}
          style={{ marginTop: 16 }}
        >
          <Input placeholder="مثال: حبة، أمبولة" />
        </Form.Item>
      )}

      {unitOptions.length > 0 ? (
        <Form.Item name="base_unit_label" hidden>
          <Input />
        </Form.Item>
      ) : null}
    </div>
  );
};

export default DialysisPackagingEditor;
