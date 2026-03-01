import { daysUntil } from "./dateUtils";

/**
 * Raw billing facts about a customer's cycle.
 * These are INDEPENDENT of customer.status (suspended/active).
 * Use these for filters and dashboard counts — they always reflect
 * the true billing reality regardless of manual suspension.
 */
export function getCycleFacts(cycle) {
  if (!cycle) return { expired: false, unpaid: false, daysLeft: null };
  const days = daysUntil(cycle.cycleEndDate);
  return {
    expired: days < 0,
    unpaid: cycle.amountPending > 0,
    daysLeft: days,
  };
}

/**
 * Single source of truth for the STATUS BADGE shown on each row.
 *
 * customer.status in DB is ONLY "active" or "suspended" (manually set).
 * Everything else is derived from cycle data.
 *
 *  "suspended"  → operator manually suspended (shown on badge regardless of cycle)
 *  "expired"    → active customer, cycle ended + unpaid balance
 *  "renewal"    → active customer, cycle ended + fully paid (needs new cycle)
 *  "pending"    → active customer, cycle active + unpaid balance
 *  "clear"      → active customer, cycle active + fully paid
 *
 * NOTE: A suspended customer might ALSO have an expired/unpaid cycle.
 *       The badge shows "Suspended" (the manual operator action takes
 *       visual priority). But FILTERS use getCycleFacts() directly so
 *       that suspended customers still appear in "Expired" / "Balance Due".
 */
export function computeDisplayStatus(customer, cycle) {
  if (customer.status === "suspended") return "suspended";
  if (!cycle) return "pending"; // no cycle yet → needs setup

  const { expired, unpaid } = getCycleFacts(cycle);

  if (expired && unpaid) return "expired"; // cycle ended, still owes money
  if (expired && !unpaid) return "renewal"; // cycle ended, paid — needs renew
  if (!expired && unpaid) return "pending"; // within cycle, partially paid
  return "clear"; // within cycle, fully paid
}
