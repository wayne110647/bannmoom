import { Dec, dec, div, mul } from './decimal';

/**
 * Supported units. Every ingredient stores its quantity in the BASE unit of
 * its dimension (g, ml, egg, piece). Units of different dimensions can never
 * be converted into each other (e.g. grams ↔ eggs).
 */
export type UnitCode = 'g' | 'kg' | 'ml' | 'l' | 'egg' | 'piece';
export type Dimension = 'mass' | 'volume' | 'egg' | 'piece';

interface UnitDef {
  label: string;
  dimension: Dimension;
  /** How many base units one of this unit equals. */
  toBase: number;
}

export const UNITS: Record<UnitCode, UnitDef> = {
  g: { label: 'กรัม', dimension: 'mass', toBase: 1 },
  kg: { label: 'กิโลกรัม', dimension: 'mass', toBase: 1000 },
  ml: { label: 'มิลลิลิตร', dimension: 'volume', toBase: 1 },
  l: { label: 'ลิตร', dimension: 'volume', toBase: 1000 },
  egg: { label: 'ฟอง', dimension: 'egg', toBase: 1 },
  piece: { label: 'ชิ้น', dimension: 'piece', toBase: 1 },
};

export const UNIT_CODES = Object.keys(UNITS) as UnitCode[];

const BASE_UNIT: Record<Dimension, UnitCode> = { mass: 'g', volume: 'ml', egg: 'egg', piece: 'piece' };

/** Short labels for compact displays (2.5 กก.). */
const SHORT_LABEL: Record<UnitCode, string> = { g: 'ก.', kg: 'กก.', ml: 'มล.', l: 'ล.', egg: 'ฟอง', piece: 'ชิ้น' };

export class UnitMismatchError extends Error {
  constructor(from: UnitCode, to: UnitCode) {
    super(`แปลงหน่วย "${UNITS[from].label}" เป็น "${UNITS[to].label}" ไม่ได้`);
  }
}

export const unitLabel = (unit: UnitCode) => UNITS[unit].label;
export const unitShort = (unit: UnitCode) => SHORT_LABEL[unit];
export const baseUnitOf = (unit: UnitCode): UnitCode => BASE_UNIT[UNITS[unit].dimension];
export const isCompatible = (a: UnitCode, b: UnitCode) => UNITS[a].dimension === UNITS[b].dimension;
export const compatibleUnits = (unit: UnitCode) => UNIT_CODES.filter((u) => isCompatible(u, unit));

/** Convert a quantity between two compatible units. Throws UnitMismatchError otherwise. */
export function convert(quantity: Dec, from: UnitCode, to: UnitCode): Dec {
  if (from === to) return quantity;
  if (!isCompatible(from, to)) throw new UnitMismatchError(from, to);
  return div(mul(quantity, dec(UNITS[from].toBase)), dec(UNITS[to].toBase));
}

export const toBase = (quantity: Dec, unit: UnitCode): Dec => convert(quantity, unit, baseUnitOf(unit));
