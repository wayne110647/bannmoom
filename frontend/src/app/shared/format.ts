import { Pipe, PipeTransform } from '@angular/core';
import { dec, mul, toNumber } from '../core/domain/decimal';
import { UnitCode, convert, unitLabel, unitShort } from '../core/domain/units';

const bahtFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bahtWholeFmt = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const smallFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const qtyFmt =new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const thDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const thDateTime = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatBaht = (value: number, whole = false) => `฿${(whole ? bahtWholeFmt : bahtFmt).format(value)}`;
export const formatQty = (value: number) => qtyFmt.format(value);

/** ฿1,234.50 — `whole` drops satang for big headline numbers. */
@Pipe({ name: 'baht' })
export class BahtPipe implements PipeTransform {
  transform(value: number | null | undefined, whole = false): string {
    return value === null || value === undefined ? '—' : formatBaht(value, whole);
  }
}

/** Show a base-unit quantity in the ingredient's preferred unit: 2500 g → "2.5 กก." */
@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(baseQty: number, baseUnit: UnitCode, displayUnit: UnitCode = baseUnit, withUnit = true): string {
    const value = toNumber(convert(dec(baseQty), baseUnit, displayUnit));
    return withUnit ? `${formatQty(value)} ${unitShort(displayUnit)}` : formatQty(value);
  }
}

@Pipe({ name: 'unit' })
export class UnitPipe implements PipeTransform {
  transform(unit: UnitCode, long = false): string {
    return long ? unitLabel(unit) : unitShort(unit);
  }
}

/** Cost per base unit shown per display unit: 0.032 ฿/g with kg → "฿32.00/กก." */
@Pipe({ name: 'unitCost' })
export class UnitCostPipe implements PipeTransform {
  transform(costPerBase: number | null, baseUnit: UnitCode, displayUnit: UnitCode = baseUnit): string {
    if (costPerBase === null) return '—';
    const perDisplay = toNumber(mul(dec(costPerBase), convert(dec(1), displayUnit, baseUnit)));
    // Per-gram costs are often below ฿1 — keep enough decimals to be meaningful.
    const text = perDisplay < 1 ? `฿${smallFmt.format(perDisplay)}` : formatBaht(perDisplay);
    return `${text}/${unitShort(displayUnit)}`;
  }
}

@Pipe({ name: 'thDate' })
export class ThaiDatePipe implements PipeTransform {
  transform(iso: string | null | undefined, withTime = false): string {
    if (!iso) return '—';
    return (withTime ? thDateTime : thDate).format(new Date(iso));
  }
}
