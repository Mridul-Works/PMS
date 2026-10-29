const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export const inr = (n: number) => inrFmt.format(Math.round(n || 0));
export const num = (n: number) => numFmt.format(n || 0);

/** Short form: ₹12.5L, ₹1.2Cr */
export function inrShort(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return inr(n);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD */
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/**
 * The app's time zone. Servers (e.g. Vercel) run on UTC, so "today" is always worked out in
 * India time unless APP_TIMEZONE says otherwise.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const todayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date (YYYY-MM-DD) in the app's time zone, no matter where the server runs. */
export const today = () => todayFmt.format(new Date());
export const thisMonth = () => today().slice(0, 7);

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function prettyDate(s: string) {
  return parseISODate(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function prettyMonth(ym: string) {
  return parseISODate(`${ym}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function shiftMonth(ym: string, delta: number) {
  const d = parseISODate(`${ym}-01`);
  d.setMonth(d.getMonth() + delta);
  return toISODate(d).slice(0, 7);
}
export function shiftDay(s: string, delta: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export const isMonth = (s?: string) => !!s && /^\d{4}-\d{2}$/.test(s);
export const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
