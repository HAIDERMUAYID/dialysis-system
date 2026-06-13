/** فصل أصناف مستودع المستلزمات العامة عن مخزن صيدلية الغسل */

const WAREHOUSE_TYPES = ['GENERAL_MEDICAL', 'PHARMACY'];

function parseWarehouseType(raw) {
  if (raw == null || raw === '') return null;
  const t = String(raw).trim().toUpperCase();
  return WAREHOUSE_TYPES.includes(t) ? t : null;
}

/** شرط Prisma لأصناف حسب نوع المستودع */
function itemWhereForWarehouseType(warehouseType) {
  if (warehouseType === 'PHARMACY') {
    return { drugCatalogId: { not: null } };
  }
  if (warehouseType === 'GENERAL_MEDICAL') {
    return { drugCatalogId: null };
  }
  return {};
}

function assertItemMatchesWarehouseType(item, warehouseType) {
  if (!item || !warehouseType) return;
  if (warehouseType === 'GENERAL_MEDICAL' && item.drugCatalogId != null) {
    const err = new Error(
      'هذا الصنف دواء صيدلية — أدِر مخزونه من «مخزن صيدلية الغسل»'
    );
    err.code = 400;
    throw err;
  }
}

module.exports = {
  WAREHOUSE_TYPES,
  parseWarehouseType,
  itemWhereForWarehouseType,
  assertItemMatchesWarehouseType,
};
