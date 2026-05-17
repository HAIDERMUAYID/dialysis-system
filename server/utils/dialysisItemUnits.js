/**
 * سلم تعبئة هرمي: من الأكبر (بوكس) → الأصغر (حبة).
 * وحدة المخزون = ما يختاره المستخدم.
 * multiplierToBase = عدد وحدات المخزون في 1 من هذه الوحدة.
 */
const { Prisma } = require('@prisma/client');

function dec(v) {
  return new Prisma.Decimal(String(v));
}

function sortUnits(units) {
  return [...units].sort((a, b) => a.levelOrder - b.levelOrder || a.id - b.id);
}

function slugUnitCode(label, index) {
  const raw = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u0600-\u06ff]/gi, '');
  return raw || `u${index}`;
}

function isSmallestFirstDirection(options, ladder) {
  const dir = String(
    options.packagingDirection ?? options.packaging_direction ?? ''
  ).toLowerCase();
  if (dir === 'smallest_first') return true;
  if (dir === 'largest_first') return false;
  return false;
}

/** تحويل إدخال «أصغر أولاً» (قديم) إلى أكبر أولاً */
function convertSmallestFirstLadderToLargest(ladder) {
  if (!Array.isArray(ladder) || ladder.length < 2) return ladder || [];
  const rev = [...ladder].reverse();
  return rev.map((row, idx) => ({
    unit_code: row.unit_code || slugUnitCode(row.label, idx),
    label: row.label,
    per_parent: idx === 0 ? null : ladder[ladder.length - idx]?.per_parent ?? null,
  }));
}

function buildUnitsFromLadder(ladder, options = {}) {
  const baseUnitLabel = options.baseUnitLabel || options.base_unit_label || '';
  const invCodeRaw = options.inventoryBaseUnitCode ?? options.inventory_base_unit_code;

  if (!Array.isArray(ladder) || ladder.length === 0) {
    return { units: [], inventoryBaseUnitCode: invCodeRaw || null, baseUnitLabel };
  }

  let normalized = ladder;
  if (isSmallestFirstDirection(options, ladder)) {
    normalized = convertSmallestFirstLadderToLargest(ladder);
  }

  const rows = normalized.map((row, idx) => {
    const label = String(row.label ?? row.label_ar ?? '').trim();
    const unitCode = String(row.unit_code ?? row.code ?? slugUnitCode(label, idx))
      .trim()
      .toLowerCase();
    const perRaw =
      row.per_parent != null && row.per_parent !== ''
        ? row.per_parent
        : row.contains_in_parent != null && row.contains_in_parent !== ''
          ? row.contains_in_parent
          : row.per_in_parent;
    const perInParent =
      idx === 0
        ? null
        : perRaw != null && perRaw !== ''
          ? parseFloat(String(perRaw))
          : null;
    return { unitCode, label: label || unitCode, perInParent, levelOrder: idx };
  });

  const codes = new Set();
  for (const r of rows) {
    if (codes.has(r.unitCode)) throw new Error(`رمز الوحدة مكرر: ${r.unitCode}`);
    codes.add(r.unitCode);
  }

  const factorToSmallest = new Array(rows.length);
  factorToSmallest[rows.length - 1] = dec(1);

  for (let i = rows.length - 2; i >= 0; i--) {
    const child = rows[i + 1];
    const per = child.perInParent;
    if (!Number.isFinite(per) || per <= 0) {
      const larger = rows[i].label;
      throw new Error(
        `«${child.label}»: كم ${child.label} في 1 ${larger}؟ (مثال: 100 شريط في الكرتون)`
      );
    }
    factorToSmallest[i] = factorToSmallest[i + 1].times(dec(per));
  }

  let inventoryBaseUnitCode = invCodeRaw
    ? String(invCodeRaw).trim().toLowerCase()
    : rows[rows.length - 1].unitCode;

  if (!rows.some((r) => r.unitCode === inventoryBaseUnitCode)) {
    inventoryBaseUnitCode = rows[rows.length - 1].unitCode;
  }

  const invIndex = rows.findIndex((r) => r.unitCode === inventoryBaseUnitCode);
  const invFactor = factorToSmallest[invIndex];

  const built = rows.map((row, i) => ({
    unitCode: row.unitCode,
    label: row.label,
    levelOrder: row.levelOrder,
    multiplierToBase: factorToSmallest[i].div(invFactor),
    parentUnitCode: i > 0 ? rows[i - 1].unitCode : null,
  }));

  const invLabel = rows.find((r) => r.unitCode === inventoryBaseUnitCode)?.label;

  return {
    units: built,
    inventoryBaseUnitCode,
    baseUnitLabel: invLabel || baseUnitLabel,
  };
}

function getInventoryBaseUnit(units, inventoryBaseUnitCode) {
  if (!units?.length) return null;
  if (inventoryBaseUnitCode) {
    const u = unitByCode(units, inventoryBaseUnitCode);
    if (u) return u;
  }
  const sorted = sortUnits(units);
  const withOne = sorted.find((u) => dec(u.multiplierToBase).eq(1));
  if (withOne) return withOne;
  return sorted[sorted.length - 1];
}

function unitByCode(units, code) {
  if (!code) return null;
  const c = String(code).trim().toLowerCase();
  return units.find((u) => u.unitCode.toLowerCase() === c) || null;
}

function convertToBase(units, quantity, unitCode, inventoryBaseUnitCode) {
  const q = dec(quantity);
  if (q.lte(0)) throw new Error('الكمية يجب أن تكون أكبر من صفر');

  if (!units || units.length === 0) {
    return { quantityBase: q, unit: null };
  }

  const baseUnit = getInventoryBaseUnit(units, inventoryBaseUnitCode);
  const u = unitCode ? unitByCode(units, unitCode) : baseUnit;
  if (!u) {
    throw new Error(`وحدة غير معرّفة لهذا الصنف: ${unitCode}`);
  }
  return {
    quantityBase: q.times(dec(u.multiplierToBase)),
    unit: u,
  };
}

function formatBaseQuantity(units, quantityBase, inventoryBaseUnitCode) {
  let remaining = dec(quantityBase);
  if (remaining.lte(0)) return '0';

  if (!units || units.length === 0) {
    return remaining.toFixed();
  }

  const sorted = sortUnits(units).slice().reverse();
  const baseU = getInventoryBaseUnit(units, inventoryBaseUnitCode);
  const parts = [];

  for (const u of sorted) {
    const mult = dec(u.multiplierToBase);
    if (mult.lte(0)) continue;
    if (remaining.lt(mult)) continue;
    const whole = remaining.div(mult).floor();
    if (whole.gt(0)) {
      parts.push(`${whole.toString()} ${u.label}`);
      remaining = remaining.minus(whole.times(mult));
    }
  }

  if (remaining.gt(0)) {
    parts.push(`${remaining.toFixed(4).replace(/\.?0+$/, '')} ${baseU?.label ?? ''}`.trim());
  }

  return parts.join(' + ') || '0';
}

function unitOptionsForItem(item) {
  const units = sortUnits(item.units || []);
  const invCode = item.inventoryBaseUnitCode || null;
  const base = getInventoryBaseUnit(units, invCode);
  return units.map((u) => ({
    unit_code: u.unitCode,
    label: u.label,
    multiplier_to_base: u.multiplierToBase.toString(),
    is_base: base ? u.unitCode === base.unitCode : false,
    is_inventory_base: base ? u.unitCode === base.unitCode : false,
    level_order: u.levelOrder,
    is_smallest: u.levelOrder === units[units.length - 1]?.levelOrder,
    is_largest: u.levelOrder === units[0]?.levelOrder,
  }));
}

async function loadItemUnits(prisma, itemId) {
  return prisma.dialysisItemUnit.findMany({
    where: { itemId },
    orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }],
  });
}

async function loadItemWithUnits(prisma, itemId) {
  return prisma.dialysisItem.findUnique({
    where: { id: itemId },
    select: { id: true, baseUnitLabel: true, inventoryBaseUnitCode: true },
  });
}

async function replaceItemUnits(prisma, itemId, ladder, options = {}, audit = {}) {
  const builtPack = buildUnitsFromLadder(ladder, options);
  const { units: built, inventoryBaseUnitCode, baseUnitLabel } = builtPack;

  await prisma.dialysisItem.update({
    where: { id: itemId },
    data: {
      inventoryBaseUnitCode: inventoryBaseUnitCode || null,
      baseUnitLabel: baseUnitLabel || undefined,
      ...audit,
    },
  });

  await prisma.dialysisItemUnit.deleteMany({ where: { itemId } });
  if (!built.length) return [];

  const codeToId = new Map();
  const created = [];
  for (const row of built) {
    const parentId = row.parentUnitCode ? codeToId.get(row.parentUnitCode) ?? null : null;
    const rec = await prisma.dialysisItemUnit.create({
      data: {
        itemId,
        unitCode: row.unitCode,
        label: row.label,
        levelOrder: row.levelOrder,
        multiplierToBase: row.multiplierToBase,
        parentUnitId: parentId,
        ...audit,
      },
    });
    codeToId.set(row.unitCode, rec.id);
    created.push(rec);
  }
  return created;
}

async function resolveQuantityToBase(prisma, itemId, body) {
  const [units, item] = await Promise.all([
    loadItemUnits(prisma, itemId),
    loadItemWithUnits(prisma, itemId),
  ]);
  const invCode = item?.inventoryBaseUnitCode ?? null;

  const rawBase =
    body.quantity_remaining_base ?? body.quantity_base ?? body.quantityBase ?? null;

  if (rawBase !== undefined && rawBase !== null && rawBase !== '') {
    const base = dec(rawBase);
    return {
      quantityBase: base,
      displayUnitCode: getInventoryBaseUnit(units, invCode)?.unitCode ?? null,
      displayUnitQty: base,
      formatted: formatBaseQuantity(units, base, invCode),
    };
  }

  const qtyRaw = body.quantity ?? body.qty ?? body.dispense_quantity ?? body.dispense_qty;
  if (qtyRaw === undefined || qtyRaw === null || qtyRaw === '') {
    throw new Error('أدخل الكمية');
  }

  const unitCode = body.unit_code ?? body.unitCode ?? body.dispense_unit_code ?? body.dispenseUnitCode;

  if (!units.length) {
    const base = dec(qtyRaw);
    return {
      quantityBase: base,
      displayUnitCode: null,
      displayUnitQty: base,
      formatted: base.toFixed(),
    };
  }

  const { quantityBase, unit } = convertToBase(units, qtyRaw, unitCode, invCode);
  return {
    quantityBase,
    displayUnitCode: unit?.unitCode ?? null,
    displayUnitQty: dec(qtyRaw),
    formatted: formatBaseQuantity(units, quantityBase, invCode),
  };
}

function ladderFromUnits(units, item = {}) {
  const sorted = sortUnits(units);
  if (!sorted.length) return [];

  const invCode = item.inventoryBaseUnitCode ?? null;

  return sorted.map((u, idx) => {
    const parent = u.parentUnitId ? sorted.find((x) => x.id === u.parentUnitId) : null;
    let perInParent = null;
    if (parent) {
      const pMult = dec(parent.multiplierToBase);
      const m = dec(u.multiplierToBase);
      if (m.gt(0)) {
        perInParent = pMult.div(m).toNumber();
      }
    }
    return {
      unit_code: u.unitCode,
      label: u.label,
      parent_unit_code: parent?.unitCode ?? null,
      per_parent: perInParent,
      multiplier_to_base: u.multiplierToBase.toString(),
      level_order: u.levelOrder,
      is_inventory_base: invCode ? u.unitCode === invCode : dec(u.multiplierToBase).eq(1),
    };
  });
}

async function resolveDispenseLineQuantities(prisma, itemId, line, bridgeDays) {
  const fkRaw = line.frequency_kind ?? line.frequencyKind ?? 'PER_SESSION';
  const frequencyKind =
    String(fkRaw).toUpperCase() === 'DAILY_TO_NEXT_DIALYSIS'
      ? 'DAILY_TO_NEXT_DIALYSIS'
      : 'PER_SESSION';

  const hasExplicitTotal =
    (line.quantity !== undefined && line.quantity !== null && line.quantity !== '') ||
    (line.dispense_quantity !== undefined &&
      line.dispense_quantity !== null &&
      line.dispense_quantity !== '') ||
    (line.quantity_base !== undefined && line.quantity_base !== null && line.quantity_base !== '');

  let quantityBase = null;
  let dispenseUnitCode = null;
  let dispenseUnitQty = null;
  let dailyUnitQty = null;

  if (frequencyKind === 'DAILY_TO_NEXT_DIALYSIS') {
    const dailyRaw = line.daily_unit_qty ?? line.dailyUnitQty;
    if (dailyRaw !== undefined && dailyRaw !== null && dailyRaw !== '') {
      const dailyRes = await resolveQuantityToBase(prisma, itemId, {
        quantity: dailyRaw,
        unit_code: line.daily_unit_code ?? line.dailyUnitCode,
      });
      dailyUnitQty = dailyRes.displayUnitQty;
      if (!hasExplicitTotal) {
        const days = Math.max(1, parseInt(String(bridgeDays ?? 1), 10) || 1);
        quantityBase = dailyRes.quantityBase.times(days);
        dispenseUnitCode = dailyRes.displayUnitCode;
        dispenseUnitQty = dailyRes.displayUnitQty;
      }
    }
  }

  if (hasExplicitTotal) {
    const totalRes = await resolveQuantityToBase(prisma, itemId, {
      quantity: line.dispense_quantity ?? line.quantity,
      unit_code: line.dispense_unit_code ?? line.unit_code ?? line.dispenseUnitCode,
      quantity_base: line.quantity_base,
    });
    quantityBase = totalRes.quantityBase;
    dispenseUnitCode = totalRes.displayUnitCode;
    dispenseUnitQty = totalRes.displayUnitQty;
  }

  if (!quantityBase || quantityBase.lte(0)) {
    throw new Error('كمية الصرف غير صالحة — اختر الوحدة وأدخل الكمية');
  }

  const [units, item] = await Promise.all([
    loadItemUnits(prisma, itemId),
    loadItemWithUnits(prisma, itemId),
  ]);

  return {
    frequencyKind,
    quantity: quantityBase,
    dispenseUnitCode,
    dispenseUnitQty,
    dailyUnitQty,
    formatted: formatBaseQuantity(units, quantityBase, item?.inventoryBaseUnitCode),
  };
}

module.exports = {
  buildUnitsFromLadder,
  convertToBase,
  formatBaseQuantity,
  unitOptionsForItem,
  loadItemUnits,
  replaceItemUnits,
  resolveQuantityToBase,
  resolveDispenseLineQuantities,
  ladderFromUnits,
  sortUnits,
  convertSmallestFirstLadderToLargest,
  getInventoryBaseUnit,
};
