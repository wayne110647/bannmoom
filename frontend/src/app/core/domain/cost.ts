import { Dec, ZERO, add, dec, div, mul, round, sub, toNumber } from './decimal';
import { UnitCode, UnitMismatchError, convert } from './units';

/**
 * Cost formulas (single source of truth — never re-implement in components):
 *   ต้นทุนวัตถุดิบ      = ปริมาณที่ใช้ × ต้นทุนต่อหน่วย
 *   ต้นทุนรวม          = ต้นทุนวัตถุดิบ + บรรจุภัณฑ์ + ค่าแรง + ค่าใช้จ่ายอื่น
 *   ต้นทุนต่อชิ้น        = ต้นทุนรวม ÷ จำนวนชิ้นที่ผลิตได้
 *   กำไรขั้นต้นต่อชิ้น    = ราคาขาย − ต้นทุนต่อชิ้น
 *   อัตรากำไรขั้นต้น %   = กำไรขั้นต้นต่อชิ้น ÷ ราคาขาย × 100   (Gross margin)
 *   บวกกำไรจากทุน %    = กำไรขั้นต้นต่อชิ้น ÷ ต้นทุนต่อชิ้น × 100 (Markup — คนละตัวกับ margin)
 */

export interface CostLineInput {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: UnitCode;
  /** Weighted-average cost per BASE unit of the ingredient; null = no price recorded yet. */
  costPerBaseUnit: number | null;
  baseUnit: UnitCode;
}

export interface CostInput {
  lines: CostLineInput[];
  packagingCost: number;
  laborCost: number;
  otherCost: number;
  yieldQty: number;
  sellPrice: number | null;
}

export interface CostLineResult extends CostLineInput {
  cost: number | null;
  /** Short reason this line has no cost (e.g. "ยังไม่มีราคาซื้อ"). */
  problem: string | null;
}

export interface CostResult {
  lines: CostLineResult[];
  /** False when any ingredient has no cost or a unit can't be converted — totals must not be shown as real. */
  complete: boolean;
  problems: string[];
  ingredientsTotal: number | null;
  extrasTotal: number;
  total: number | null;
  perPiece: number | null;
  grossProfitPerPiece: number | null;
  grossMarginPct: number | null;
  markupPct: number | null;
  profitPerBatch: number | null;
}

export function calculateCost(input: CostInput): CostResult {
  const problems: string[] = [];

  const lines: CostLineResult[] = input.lines.map((line) => {
    const fail = (problem: string): CostLineResult => {
      problems.push(`${line.name}: ${problem}`);
      return { ...line, cost: null, problem };
    };
    if (line.costPerBaseUnit === null) return fail('ยังไม่มีราคาซื้อ');
    try {
      const baseQty = convert(dec(line.quantity), line.unit, line.baseUnit);
      return { ...line, cost: toNumber(mul(baseQty, dec(line.costPerBaseUnit))), problem: null };
    } catch (e) {
      return fail(e instanceof UnitMismatchError ? e.message : 'คำนวณไม่ได้');
    }
  });

  if (!(input.yieldQty > 0)) problems.push('กรุณาระบุจำนวนชิ้นที่ผลิตได้');

  const extras = add(dec(input.packagingCost), dec(input.laborCost), dec(input.otherCost));
  const complete = problems.length === 0;

  if (!complete) {
    return {
      lines, complete, problems,
      ingredientsTotal: null, extrasTotal: toNumber(extras), total: null, perPiece: null,
      grossProfitPerPiece: null, grossMarginPct: null, markupPct: null, profitPerBatch: null,
    };
  }

  const ingredients = lines.reduce<Dec>((sum, l) => sum + dec(l.cost), ZERO);
  const total = add(ingredients, extras);
  const yieldQty = dec(input.yieldQty);
  const perPiece = div(total, yieldQty);

  let grossProfitPerPiece: Dec | null = null;
  let grossMarginPct: Dec | null = null;
  let markupPct: Dec | null = null;
  let profitPerBatch: Dec | null = null;
  if (input.sellPrice !== null && input.sellPrice > 0) {
    const price = dec(input.sellPrice);
    grossProfitPerPiece = sub(price, perPiece);
    grossMarginPct = mul(div(grossProfitPerPiece, price), dec(100));
    markupPct = perPiece > ZERO ? mul(div(grossProfitPerPiece, perPiece), dec(100)) : null;
    profitPerBatch = mul(grossProfitPerPiece, yieldQty);
  }

  const money = (v: Dec | null) => (v === null ? null : toNumber(round(v, 2)));
  return {
    lines, complete, problems,
    ingredientsTotal: money(ingredients),
    extrasTotal: money(extras)!,
    total: money(total),
    perPiece: money(perPiece),
    grossProfitPerPiece: money(grossProfitPerPiece),
    grossMarginPct: money(grossMarginPct),
    markupPct: money(markupPct),
    profitPerBatch: money(profitPerBatch),
  };
}

/** Selling price that gives the wanted gross margin: ราคา = ต้นทุน ÷ (1 − margin). */
export function priceForMargin(costPerPiece: number, marginPct: number): number {
  if (marginPct >= 100) throw new RangeError('margin must be below 100%');
  const factor = sub(dec(1), div(dec(marginPct), dec(100)));
  return toNumber(round(div(dec(costPerPiece), factor), 2));
}
