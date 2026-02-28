// src/utils/dateUtils.js

// ─── Core constant ────────────────────────────────────────────────────────────
// A billing cycle is exactly 30 days inclusive of both start and end date.
// That means: endDate = startDate + 29 days.
//
// Why 29 and not 30?
//   Day 1  = startDate         (e.g. 28-Feb)
//   Day 30 = startDate + 29    (e.g. 29-Mar)
//   startDate + 30 would be Day 31 — one day too many.
//
// This constant is used by the payment store wherever it creates cycles.
// Never hard-code 29 or 30 directly — always use this.
export const CYCLE_LENGTH_DAYS = 29; // offset to add to startDate to get endDate

// ─── addDays ─────────────────────────────────────────────────────────────────
// Adds `days` to a YYYY-MM-DD string and returns a new YYYY-MM-DD string.
//
// Implementation notes:
//   • We parse year/month/day manually to avoid any timezone shifting that
//     `new Date(dateStr)` can cause (it parses ISO strings as UTC midnight,
//     but `new Date(y, m, d)` uses LOCAL midnight — mixing the two is a bug).
//   • We always construct dates with `new Date(y, m - 1, d)` (local).
//   • JavaScript's Date handles month/year rollovers automatically:
//       new Date(2026, 1, 28 + 1) → 1 Mar 2026  ✓  (Feb has 28 days in 2026)
//       new Date(2024, 1, 28 + 1) → 29 Feb 2024 ✓  (2024 is a leap year)
//       new Date(2026, 11, 31 + 1)→ 1 Jan 2027  ✓  (Dec → Jan rollover)
//   • `days` may be negative (used for "go back N days").
export const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days); // JS handles overflow/underflow
  return _toYMD(date);
};

// ─── formatDate ──────────────────────────────────────────────────────────────
// Returns a human-readable date like "27-Feb-2026".
// Always parses as local midnight (y, m-1, d) to avoid UTC-offset surprises.
export const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const raw = dateStr.split("T")[0]; // strip any time component
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return "-";
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return "-";
  return date
    .toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\//g, "-");
};

// ─── today ───────────────────────────────────────────────────────────────────
// Returns today's local date as YYYY-MM-DD.
// Uses local getFullYear/getMonth/getDate — never UTC — so it matches the
// machine's wall-clock date regardless of timezone.
export const today = () => {
  return _toYMD(new Date());
};

// ─── daysUntil ───────────────────────────────────────────────────────────────
// Returns how many days from today until `dateStr` (negative = past).
// Both dates are normalised to local midnight so partial-day offsets don't
// affect the result.
export const daysUntil = (dateStr) => {
  if (!dateStr) return 0;
  const raw = dateStr.split("T")[0];
  const [y, m, d] = raw.split("-").map(Number);
  const target = new Date(y, m - 1, d); // local midnight on target date
  const now = new Date();
  now.setHours(0, 0, 0, 0); // local midnight today
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
};

// ─── daysSince ───────────────────────────────────────────────────────────────
// Inverse of daysUntil: positive = date is in the past.
export const daysSince = (dateStr) => -daysUntil(dateStr);

// ─── Internal helper ──────────────────────────────────────────────────────────
// Converts a local Date object to a zero-padded YYYY-MM-DD string.
function _toYMD(date) {
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
