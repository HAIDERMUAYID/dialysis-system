/** وحدات التعبئة — الواجهة (أكبر → أصغر + وحدة مخزون مختارة) */

import type { FormInstance } from 'antd';

export interface PackagingUnitRow {
  unit_code: string;
  label: string;
  multiplier_to_base?: string;
  is_base?: boolean;
  is_inventory_base?: boolean;
  level_order?: number;
  is_smallest?: boolean;
  is_largest?: boolean;
}

export interface ItemUnitApi {
  id?: number;
  unitCode: string;
  label: string;
  multiplierToBase: string | number;
  levelOrder: number;
  parentUnitId?: number | null;
}

export interface PackagingLadderRow {
  unit_code: string;
  label: string;
  parent_unit_code?: string | null;
  per_parent?: number | null;
  is_inventory_base?: boolean;
}

export function slugUnitCode(label: string, index: number): string {
  const raw = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u0600-\u06ff]/gi, '');
  return raw || `u${index}`;
}

/** أكبر → أصغر: الصف السابق = الوحدة الأكبر */
export function syncHierarchyCodesLargestFirst(form: FormInstance, ladderName: string) {
  const rows: PackagingLadderRow[] = form.getFieldValue(ladderName) || [];
  if (!rows.length) return;
  const next = rows.map((row, i) => ({
    ...row,
    unit_code: row.label?.trim() ? slugUnitCode(row.label, i) : row.unit_code || `u${i}`,
    parent_unit_code: i > 0 ? slugUnitCode(rows[i - 1]?.label || '', i - 1) : null,
    per_parent: i === 0 ? null : row.per_parent ?? 1,
  }));
  form.setFieldsValue({ [ladderName]: next });
}

/** معاينة سلسلة التحويل قبل الحفظ */
export function previewLadderChain(
  rows: PackagingLadderRow[] | undefined,
  invCode?: string
): string | null {
  if (!rows?.length || !rows.every((r) => r.label?.trim())) return null;
  const parts: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const larger = rows[i - 1].label?.trim();
    const smaller = rows[i].label?.trim();
    const n = rows[i].per_parent;
    if (!larger || !smaller || !n) return null;
    parts.push(`1 ${larger} = ${n} ${smaller}`);
  }
  const invRow = rows.find((r) => r.unit_code === invCode) || rows[rows.length - 1];
  const invLabel = invRow?.label?.trim();
  if (!parts.length) return invLabel ? `وحدة المخزون: ${invLabel}` : null;
  return `السلسلة: ${parts.join(' ← ')}${invLabel ? ` · المخزون: ${invLabel}` : ''}`;
}

export function unitsFromApi(
  units: ItemUnitApi[] | undefined,
  inventoryBaseUnitCode?: string | null
): PackagingUnitRow[] {
  if (!units?.length) return [];
  const sorted = [...units].sort((a, b) => a.levelOrder - b.levelOrder);
  const inv =
    inventoryBaseUnitCode ||
    sorted.find((u) => Number(u.multiplierToBase) === 1)?.unitCode ||
    sorted[sorted.length - 1]?.unitCode;
  return sorted.map((u) => ({
    unit_code: u.unitCode,
    label: u.label,
    multiplier_to_base: String(u.multiplierToBase),
    is_base: u.unitCode === inv,
    is_inventory_base: u.unitCode === inv,
    level_order: u.levelOrder,
    is_smallest: u.levelOrder === sorted[sorted.length - 1]?.levelOrder,
    is_largest: u.levelOrder === sorted[0]?.levelOrder,
  }));
}

/** ترتيب قاعدة البيانات (أكبر أولاً) للعرض الداخلي */
export function ladderFromApi(
  units: ItemUnitApi[] | undefined,
  inventoryBaseUnitCode?: string | null
): PackagingLadderRow[] {
  if (!units?.length) return [];
  const sorted = [...units].sort((a, b) => a.levelOrder - b.levelOrder);
  const inv = inventoryBaseUnitCode || sorted.find((u) => Number(u.multiplierToBase) === 1)?.unitCode;

  return sorted.map((u) => {
    const parent = u.parentUnitId ? sorted.find((x) => x.id === u.parentUnitId) : null;
    let perInParent: number | null = null;
    if (parent) {
      const pMult = Number(parent.multiplierToBase);
      const m = Number(u.multiplierToBase);
      if (m > 0) perInParent = pMult / m;
    }
    return {
      unit_code: u.unitCode,
      label: u.label,
      parent_unit_code: parent?.unitCode ?? null,
      per_parent: perInParent,
      is_inventory_base: inv ? u.unitCode === inv : Number(u.multiplierToBase) === 1,
    };
  });
}

/** للمحرّر: نفس ترتيب قاعدة البيانات (أكبر → أصغر) */
export const ladderFromApiForEditor = ladderFromApi;

/** قالب مثال: بوكس → كرتون → شريط → حبة */
export function defaultHierarchyTemplate(): PackagingLadderRow[] {
  return [
    { unit_code: 'box', label: 'بوكس', per_parent: null },
    { unit_code: 'carton', label: 'كرتون', per_parent: 20 },
    { unit_code: 'strip', label: 'شريط', per_parent: 100 },
    { unit_code: 'pill', label: 'حبة', per_parent: 10 },
  ];
}

/** @deprecated استخدم defaultHierarchyTemplate */
export function defaultLadderTemplate(_baseLabel: string): PackagingLadderRow[] {
  return defaultHierarchyTemplate();
}

export function estimateBaseQty(
  units: PackagingUnitRow[],
  qty: number,
  unitCode: string
): number {
  const u = units.find((x) => x.unit_code === unitCode);
  if (!u) return qty;
  const mult = Number(u.multiplier_to_base || 1);
  return qty * mult;
}

export function defaultUnitForItem(
  packagingUnits: PackagingUnitRow[],
  preferInventoryBase = true
): string {
  if (!packagingUnits.length) return 'base';
  const inv = packagingUnits.find((u) => u.is_inventory_base || u.is_base);
  if (preferInventoryBase && inv) return inv.unit_code;
  return packagingUnits[packagingUnits.length - 1]?.unit_code ?? packagingUnits[0].unit_code;
}
