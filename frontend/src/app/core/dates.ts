/** Calendar dates as 'YYYY-MM-DD' in the device's local time (the shop's phone is in Thailand). */

const pad = (n: number) => String(n).padStart(2, '0');

export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => toIsoDate(new Date());

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** First day of the month `offset` months from the month of `isoDate` (0 = same month, -1 = previous). */
export function monthStartIso(isoDate: string, offset = 0): string {
  const [y, m] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1 + offset, 1));
}
