import { ZERO, add, dec, div, mul, toNumber } from './decimal';

export type StockLevel = 'out' | 'low' | 'ok';

export function stockLevel(quantityOnHand: number, minQuantity: number): StockLevel {
  if (quantityOnHand <= 0) return 'out';
  if (quantityOnHand <= minQuantity) return 'low';
  return 'ok';
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = { out: 'หมด', low: 'ใกล้หมด', ok: 'ปกติ' };

/** Days from today until the given ISO date (negative = already expired). */
export function daysUntil(isoDate: string, today = new Date()): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000);
}

export function isExpiringSoon(isoDate: string | null, withinDays: number): boolean {
  return isoDate !== null && daysUntil(isoDate) <= withinDays;
}

/**
 * Weighted Average Cost after receiving stock.
 *   ต้นทุนเฉลี่ยใหม่ = (คงเหลือเดิม × ต้นทุนเดิม + จำนวนรับ × ต้นทุนรับ) ÷ (คงเหลือเดิม + จำนวนรับ)
 * If nothing (or a negative/unknown-cost amount) was on hand, the new batch cost is used.
 */
export function weightedAverageCost(
  onHandQty: number,
  onHandCost: number | null,
  receivedQty: number,
  receivedCostPerUnit: number,
): number {
  const oldQty = dec(onHandQty);
  if (oldQty <= ZERO || onHandCost === null) return receivedCostPerUnit;
  const inQty = dec(receivedQty);
  const value = add(mul(oldQty, dec(onHandCost)), mul(inQty, dec(receivedCostPerUnit)));
  return toNumber(div(value, add(oldQty, inQty)));
}

/** Cost per base unit of a purchase: ราคารวม ÷ ปริมาณรวม (in base unit). */
export function costPerBaseUnit(totalPrice: number, baseQuantity: number): number {
  return toNumber(div(dec(totalPrice), dec(baseQuantity)));
}
