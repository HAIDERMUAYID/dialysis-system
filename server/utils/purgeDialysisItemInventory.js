/**
 * إزالة مخزون صنف الغسل (دفعات + حركة الدفتر + وحدات التعبئة) ثم تعطيل الصنف.
 * لا يُحذف الصنف نفسه إن وُجدت سجلات صرف مرتبطة (قيود مرجعية).
 */
async function purgeDialysisItemInventory(prisma, itemId, hospitalId, audit = {}) {
  const item = await prisma.dialysisItem.findFirst({
    where: { id: itemId, hospitalId },
  });
  if (!item) {
    throw Object.assign(new Error('الصنف غير موجود'), { code: 404 });
  }

  const dispenseLineCount = await prisma.dialysisSessionDispenseLine.count({
    where: { dialysisItemId: itemId },
  });

  const result = await prisma.$transaction(async (tx) => {
    const ledgerDeleted = await tx.dialysisInventoryLedger.deleteMany({
      where: { hospitalId, itemId },
    });
    const batchesDeleted = await tx.dialysisInventoryBatch.deleteMany({
      where: { hospitalId, itemId },
    });
    const unitsDeleted = await tx.dialysisItemUnit.deleteMany({
      where: { itemId },
    });

    let itemRemoved = false;
    if (dispenseLineCount === 0) {
      await tx.dialysisItem.delete({ where: { id: itemId } });
      itemRemoved = true;
    } else {
      await tx.dialysisItem.update({
        where: { id: itemId },
        data: { isActive: 0, ...audit },
      });
    }

    return {
      ledgerDeleted: ledgerDeleted.count,
      batchesDeleted: batchesDeleted.count,
      unitsDeleted: unitsDeleted.count,
      itemRemoved,
      dispenseLineCount,
    };
  });

  return result;
}

/** تنظيف مخزون كل الأصناف المعطّلة في المستشفى (بعد حذف قديم لم يُزِل الدفعات) */
async function purgeInactiveDialysisItemsInventory(prisma, hospitalId) {
  const inactive = await prisma.dialysisItem.findMany({
    where: { hospitalId, isActive: 0 },
    select: { id: true },
  });
  let totals = { items: 0, ledger: 0, batches: 0, units: 0, removed: 0 };
  for (const { id } of inactive) {
    const r = await purgeDialysisItemInventory(prisma, id, hospitalId);
    totals.items += 1;
    totals.ledger += r.ledgerDeleted;
    totals.batches += r.batchesDeleted;
    totals.units += r.unitsDeleted;
    if (r.itemRemoved) totals.removed += 1;
  }
  return totals;
}

module.exports = {
  purgeDialysisItemInventory,
  purgeInactiveDialysisItemsInventory,
};
