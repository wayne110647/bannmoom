/** Shop dates are Thai dates (UTC+7, no daylight saving); Workers run in UTC. All dates are 'YYYY-MM-DD'. */
const SHOP_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

export const shopToday = (now = Date.now()) => new Date(now + SHOP_OFFSET_MS).toISOString().slice(0, 10);

/** The shop date a moment falls on. */
export const shopDateOf = (at: Date | string) => shopToday(new Date(at).getTime());

export const addDays = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Midnight at the start of a shop date, as a UTC timestamp for timestamptz comparisons. */
export const shopDayStart = (isoDate: string) => new Date(Date.parse(`${isoDate}T00:00:00+07:00`)).toISOString();
