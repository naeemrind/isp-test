import { useState } from "react";
import {
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import useCustomerStore from "../store/useCustomerStore";
import usePaymentStore from "../store/usePaymentStore";
import useExpenseStore from "../store/useExpenseStore";
import useInventoryStore from "../store/useInventoryStore";
import { daysUntil, formatDate, today } from "../utils/dateUtils";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import PaymentForm from "./Payments/PaymentForm";
import WhatsAppButton from "../components/shared/WhatsAppButton";
import { MESSAGE_TEMPLATES } from "../config/messageTemplates";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getLatestCycle(cycles, customerId) {
  return (
    cycles
      .filter((c) => c.customerId === customerId)
      .sort(
        (a, b) => new Date(b.cycleStartDate) - new Date(a.cycleStartDate),
      )[0] || null
  );
}

export default function Dashboard({ onNavigate }) {
  const customers = useCustomerStore((s) => s.customers);
  const cycles = usePaymentStore((s) => s.cycles);
  const expenses = useExpenseStore((s) => s.expenses);
  const inventoryItems = useInventoryStore((s) => s.items);

  const [payCustomer, setPayCustomer] = useState(null);
  const [mode, setMode] = useState("alltime"); // alltime | monthly | daily

  // Date state for Monthly view
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());

  // Date state for Daily view
  const [selDate, setSelDate] = useState(today());

  // Monthly Navigation
  const prevMonth = () => {
    if (selMonth === 0) {
      setSelMonth(11);
      setSelYear((y) => y - 1);
    } else setSelMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selYear === now.getFullYear() && selMonth === now.getMonth()) return;
    if (selMonth === 11) {
      setSelMonth(0);
      setSelYear((y) => y + 1);
    } else setSelMonth((m) => m + 1);
  };
  const isCurrentMonth =
    selYear === now.getFullYear() && selMonth === now.getMonth();

  // ── Stats Calculation ─────────────────────────────────────────────
  const activeCustomers = customers.filter((c) => !c.isArchived);

  // 1. ALL TIME STATS
  let at_collected = 0,
    at_pending = 0,
    at_overdueMoney = 0;
  let at_overdueCount = 0;
  let at_activeCount = 0,
    at_suspendedCount = 0,
    at_totalEver = 0;
  let at_pendingStatusBalance = 0,
    at_suspendedBalance = 0;

  activeCustomers.forEach((c) => {
    if (c.status === "active") at_activeCount++;
    if (c.status === "suspended") at_suspendedCount++;
    const cycle = getLatestCycle(cycles, c.id);
    if (!cycle) return;

    at_collected += cycle.amountPaid || 0;
    at_pending += cycle.amountPending || 0;

    const bal = cycle.amountPending || 0;
    if (bal > 0) {
      if (c.status === "suspended") at_suspendedBalance += bal;
      else at_pendingStatusBalance += bal;
    }

    const days = daysUntil(cycle.cycleEndDate);

    // Overdue Logic (Pending AND Expired)
    if (cycle.amountPending > 0 && days < 0) {
      at_overdueCount++;
      at_overdueMoney += cycle.amountPending;
    }
  });

  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      at_totalEver += inst.amountPaid || 0;
    });
  });

  // All-time inventory value
  const at_inventoryValue = inventoryItems.reduce(
    (s, i) => s + (i.amount || 0),
    0,
  );

  const at_totalExpenses = expenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0,
  );

  const allTime = {
    totalCustomers: activeCustomers.length,
    activeCount: at_activeCount,
    suspendedCount: at_suspendedCount,
    collected: at_collected,
    pending: at_pending,
    overdueMoney: at_overdueMoney,
    totalEverCollected: at_totalEver,
    overdueCount: at_overdueCount,
    pendingStatusBalance: at_pendingStatusBalance,
    suspendedBalance: at_suspendedBalance,
    totalExpenses: at_totalExpenses,
    inventoryValue: at_inventoryValue,
    netIncome: at_totalEver - at_totalExpenses - at_inventoryValue,
  };

  // 2. MONTHLY STATS
  const monthStart = new Date(selYear, selMonth, 1);
  const monthEnd = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
  let mo_collected = 0,
    mo_pending = 0,
    mo_overdueMoney = 0,
    mo_newCustomers = 0;
  let mo_clearedCount = 0,
    mo_pendingCount = 0,
    mo_overdueCount = 0;

  cycles.forEach((cy) => {
    // Collected in this month
    (cy.installments || []).forEach((inst) => {
      const d = new Date(inst.datePaid);
      if (d >= monthStart && d <= monthEnd)
        mo_collected += inst.amountPaid || 0;
    });

    // Check if cycle is relevant to this month
    const cStart = new Date(cy.cycleStartDate);
    const cEnd = new Date(cy.cycleEndDate);
    if (cStart <= monthEnd && cEnd >= monthStart) {
      mo_pending += cy.amountPending || 0;
      if (cy.status === "clear") mo_clearedCount++;
      else mo_pendingCount++;

      const days = daysUntil(cy.cycleEndDate);
      if (days < 0 && cy.amountPending > 0) {
        mo_overdueMoney += cy.amountPending;
        mo_overdueCount++;
      }
    }
  });

  activeCustomers.forEach((c) => {
    const d = new Date(c.createdAt);
    if (d >= monthStart && d <= monthEnd) mo_newCustomers++;
  });

  const mo_expenses = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Inventory items purchased this month (filtered by item.date)
  const mo_inventoryValue = inventoryItems
    .filter((i) => {
      const d = new Date(i.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, i) => s + (i.amount || 0), 0);

  const monthly = {
    collected: mo_collected,
    pending: mo_pending,
    overdueMoney: mo_overdueMoney,
    newCustomers: mo_newCustomers,
    clearedCount: mo_clearedCount,
    pendingCount: mo_pendingCount,
    overdueCount: mo_overdueCount,
    totalExpenses: mo_expenses,
    inventoryValue: mo_inventoryValue,
    netIncome: mo_collected - mo_expenses - mo_inventoryValue,
  };

  // 3. DAILY STATS
  let day_collected = 0;
  let day_newCustomers = 0;

  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      if (inst.datePaid === selDate) {
        day_collected += inst.amountPaid || 0;
      }
    });
  });

  activeCustomers.forEach((c) => {
    if (c.createdAt && c.createdAt.startsWith(selDate)) {
      day_newCustomers++;
    }
  });

  const day_expenses = expenses
    .filter((e) => e.date === selDate)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const day_inventoryValue = inventoryItems
    .filter((i) => i.date === selDate)
    .reduce((s, i) => s + (i.amount || 0), 0);

  const daily = {
    collected: day_collected,
    newCustomers: day_newCustomers,
    totalExpenses: day_expenses,
    inventoryValue: day_inventoryValue,
    netIncome: day_collected - day_expenses - day_inventoryValue,
  };

  // ── Urgent List Logic ─────────────────────────────────────────────
  const urgentCustomers = activeCustomers
    .map((c) => ({ customer: c, cycle: getLatestCycle(cycles, c.id) }))
    .filter(({ cycle }) => {
      if (!cycle) return true;
      const days = daysUntil(cycle.cycleEndDate);
      return days < 0 || days <= 5;
    })
    .sort((a, b) => {
      const da = a.cycle ? daysUntil(a.cycle.cycleEndDate) : -999;
      const db2 = b.cycle ? daysUntil(b.cycle.cycleEndDate) : -999;
      return da - db2;
    });

  const displayStats = mode === "monthly" ? monthly : allTime;

  return (
    <div className="p-5 space-y-5 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today()}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
          <button
            onClick={() => setMode("alltime")}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold ${mode === "alltime" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"}`}
          >
            All Time
          </button>
          <button
            onClick={() => setMode("monthly")}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold ${mode === "monthly" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setMode("daily")}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold ${mode === "daily" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"}`}
          >
            Daily
          </button>
        </div>
      </div>

      {/* FILTERS */}
      {mode === "monthly" && (
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 w-fit">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-700"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-43 justify-center">
            <Calendar size={17} className="text-blue-600" />
            <span className="font-bold text-gray-900 text-lg">
              {MONTH_NAMES[selMonth]} {selYear}
            </span>
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {mode === "daily" && (
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-2 w-fit">
          <Calendar size={18} className="text-blue-600" />
          <input
            type="date"
            value={selDate}
            max={today()}
            onChange={(e) => setSelDate(e.target.value)}
            className="font-bold text-gray-900 text-lg outline-none cursor-pointer"
          />
        </div>
      )}

      {/* ─── CARDS GRID ─── */}

      {mode !== "daily" ? (
        <>
          {/* Top Row: 4 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigCard
              icon={<Users size={16} />}
              label="Total Customers"
              value={
                mode === "monthly"
                  ? monthly.newCustomers
                  : allTime.totalCustomers
              }
              sub={
                mode === "monthly"
                  ? "Joined this month"
                  : `${allTime.activeCount} active`
              }
              color="blue"
            />
            <BigCard
              icon={<CheckCircle size={16} />}
              label={
                mode === "monthly" ? "Collected This Month" : "Ever Collected"
              }
              value={`PKR ${mode === "monthly" ? monthly.collected.toLocaleString() : allTime.totalEverCollected.toLocaleString()}`}
              sub={
                mode === "monthly"
                  ? "Payments received this month"
                  : "Sum of all payments ever"
              }
              color="green"
              isSensitive={true}
            />
            <BigCard
              icon={<XCircle size={16} />}
              label="Total Expenses"
              value={`PKR ${((displayStats.totalExpenses || 0) + (displayStats.inventoryValue || 0)).toLocaleString()}`}
              sub="Recorded expenses"
              color="red"
              inventoryValue={displayStats.inventoryValue || 0}
              expensesValue={displayStats.totalExpenses || 0}
            />
            <BigCard
              icon={<Clock size={16} />}
              label="Total Balance Due"
              value={`PKR ${displayStats.pending.toLocaleString()}`}
              sub="Click to view all"
              color="amber"
              onClick={() => onNavigate("customers", "balance-due")}
              isClickable
              pendingStatusBalance={displayStats.pendingStatusBalance || 0}
              suspendedBalance={displayStats.suspendedBalance || 0}
            />
          </div>

          {/* Bottom Row: 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigCard
              icon={<Users size={16} />}
              label="Overdue Customers"
              value={displayStats.overdueCount}
              sub="Count of customers overdue"
              color="red"
              highlight={displayStats.overdueCount > 0}
            />
            <BigCard
              icon={<AlertTriangle size={16} />}
              label="Total Overdue"
              value={`PKR ${displayStats.overdueMoney.toLocaleString()}`}
              sub="Expired + Unpaid"
              color="red"
              highlight={displayStats.overdueMoney > 0}
              onClick={() => onNavigate("customers", "overdue")}
              isClickable
            />
            <BigCard
              icon={<TrendingUp size={16} />}
              label="Net Income"
              value={`PKR ${displayStats.netIncome.toLocaleString()}`}
              sub="Total collected − expenses"
              color={displayStats.netIncome >= 0 ? "green" : "red"}
              isSensitive={true}
            />
          </div>
        </>
      ) : (
        /* Daily View */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <BigCard
            icon={<CreditCard size={16} />}
            label="Collected Today"
            value={`PKR ${daily.collected.toLocaleString()}`}
            sub={`Payments received on ${formatDate(selDate)}`}
            color="green"
            isSensitive={true}
          />
          <BigCard
            icon={<XCircle size={16} />}
            label="Expenses Today"
            value={`PKR ${(daily.totalExpenses + (daily.inventoryValue || 0)).toLocaleString()}`}
            sub={`Expenses recorded on ${formatDate(selDate)}`}
            color="red"
          />
          <BigCard
            icon={<TrendingUp size={16} />}
            label="Daily Net Income"
            value={`PKR ${daily.netIncome.toLocaleString()}`}
            sub="Collected − expenses"
            color={daily.netIncome >= 0 ? "green" : "red"}
            isSensitive={true}
          />
          <BigCard
            icon={<Users size={16} />}
            label="New Customers"
            value={daily.newCustomers}
            sub="Joined today"
            color="blue"
          />
        </div>
      )}

      {/* NEEDS ATTENTION TABLE */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          Needs Attention
          {urgentCustomers.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {urgentCustomers.length}
            </span>
          )}
        </h2>

        {urgentCustomers.length === 0 ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <CheckCircle size={22} className="text-green-600" />
            <span className="text-green-800 font-semibold text-base">
              All accounts are in good standing.
            </span>
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-white text-left">
                  <th className="px-4 py-3 text-sm font-semibold">Customer</th>
                  <th className="px-4 py-3 text-sm font-semibold">Area</th>
                  <th className="px-4 py-3 text-sm font-semibold">Mobile</th>
                  <th className="px-4 py-3 text-sm font-semibold">
                    Cycle Ended
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold">Days</th>
                  <th className="px-4 py-3 text-sm font-semibold">
                    Balance Due
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {urgentCustomers.map(({ customer, cycle }) => {
                  if (!cycle)
                    return (
                      <tr
                        key={customer.id}
                        className="border-t border-gray-200 bg-gray-50"
                      >
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {customer.fullName}
                        </td>
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-sm text-gray-500"
                        >
                          No billing cycle — needs setup
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setPayCustomer(customer)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                          >
                            Pay Now
                          </button>
                        </td>
                      </tr>
                    );

                  const days = daysUntil(cycle.cycleEndDate);
                  const isExpiredUnpaid = days < 0 && cycle.amountPending > 0;
                  const isExpiredPaid = days < 0 && cycle.amountPending === 0;
                  const isExpiringSoon = days >= 0 && days <= 5;

                  let waMessage = "";
                  if (isExpiredUnpaid) {
                    waMessage = MESSAGE_TEMPLATES.paymentOverdue(
                      customer,
                      cycle,
                    );
                  } else if (cycle.amountPending > 0) {
                    waMessage = MESSAGE_TEMPLATES.paymentDue(customer, cycle);
                  } else {
                    waMessage = MESSAGE_TEMPLATES.expiryReminder(
                      customer,
                      cycle,
                    );
                  }

                  const showPayButton =
                    cycle.amountPending > 0 || isExpiredPaid;

                  const rowBg = isExpiredUnpaid
                    ? "bg-red-50"
                    : isExpiredPaid
                      ? "bg-orange-50"
                      : "bg-yellow-50";

                  return (
                    <tr
                      key={customer.id}
                      className={`border-t border-gray-200 ${rowBg}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 text-sm">
                          {customer.fullName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.userName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {customer.mainArea || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {customer.mobileNo || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {formatDate(cycle.cycleEndDate)}
                      </td>
                      <td className="px-4 py-3">
                        {isExpiredUnpaid && (
                          <span className="text-sm font-bold text-red-700">
                            {-days}d overdue
                          </span>
                        )}
                        {isExpiredPaid && (
                          <span className="text-sm font-bold text-orange-700">
                            {-days}d ago — needs renewal
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-sm font-bold text-yellow-700">
                            {days}d left
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cycle.amountPending > 0 ? (
                          <span className="text-sm font-bold text-red-700">
                            PKR {Number(cycle.amountPending).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-green-700">
                            Paid ✓
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isExpiredUnpaid && <Badge status="overdue" />}
                        {isExpiredPaid && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Renewal Due
                          </span>
                        )}
                        {isExpiringSoon && <Badge status="pending" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {showPayButton && (
                            <button
                              onClick={() => setPayCustomer(customer)}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                            >
                              {isExpiredPaid ? "Renew" : "Pay Now"}
                            </button>
                          )}
                          <WhatsAppButton
                            mobileNo={customer.mobileNo}
                            message={waMessage}
                            label="WhatsApp"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!payCustomer}
        onClose={() => setPayCustomer(null)}
        title="Record Payment"
        size="md"
      >
        {payCustomer && (
          <PaymentForm
            customer={payCustomer}
            onClose={() => setPayCustomer(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// Updated Colors: Softer backgrounds with borders and icons
const colorMap = {
  blue: {
    bg: "bg-blue-50 border border-blue-200",
    iconBox: "bg-blue-100",
    icon: "text-blue-600",
  },
  green: {
    bg: "bg-green-50 border border-green-200",
    iconBox: "bg-green-100",
    icon: "text-green-600",
  },
  amber: {
    bg: "bg-amber-50 border border-amber-200",
    iconBox: "bg-amber-100",
    icon: "text-amber-600",
  },
  red: {
    bg: "bg-red-50 border border-red-200",
    iconBox: "bg-red-100",
    icon: "text-red-600",
  },
};

function BigCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight = false,
  isSensitive = false,
  onClick,
  isClickable = false,
  inventoryValue,
  expensesValue,
  pendingStatusBalance,
  suspendedBalance,
}) {
  const c = colorMap[color] || colorMap.blue;
  const [revealed, setRevealed] = useState(false);
  const hasExpenseBreakdown =
    inventoryValue !== undefined && expensesValue !== undefined;
  const hasBalanceBreakdown =
    pendingStatusBalance !== undefined && suspendedBalance !== undefined;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`rounded-xl px-4 py-3 ${c.bg} flex flex-col justify-between ${highlight ? "ring-2 ring-offset-1 ring-red-300" : ""} ${isClickable ? "cursor-pointer hover:shadow-md transition-shadow active:scale-95" : ""}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.iconBox} ${c.icon}`}
          >
            {icon}
          </div>
          {isSensitive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRevealed(!revealed);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title={revealed ? "Hide Amount" : "Show Amount"}
            >
              {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </div>
      </div>

      <div className="mt-1">
        <div
          className={`font-bold text-gray-900 leading-tight ${String(value).length > 12 ? "text-base" : "text-lg"}`}
        >
          {isSensitive && !revealed ? (
            <span className="tracking-widest text-gray-400">••••••</span>
          ) : (
            value
          )}
        </div>
        {hasExpenseBreakdown ? (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">
                Recorded expenses
              </span>
              <span className="font-semibold text-gray-700">
                PKR {expensesValue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-blue-600 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Inventory Stock
              </span>
              <span className="font-semibold text-blue-600">
                PKR {inventoryValue.toLocaleString()}
              </span>
            </div>
          </div>
        ) : hasBalanceBreakdown ? (
          <div className="mt-1 space-y-0.5">
            {pendingStatusBalance > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Pending
                </span>
                <span className="font-semibold text-amber-700">
                  PKR {pendingStatusBalance.toLocaleString()}
                </span>
              </div>
            )}
            {suspendedBalance > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-orange-600 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  Suspended
                </span>
                <span className="font-semibold text-orange-700">
                  PKR {suspendedBalance.toLocaleString()}
                </span>
              </div>
            )}
            <div className="text-xs text-gray-400 mt-0.5">
              Click to view all
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 mt-0.5 font-medium">{sub}</div>
        )}
      </div>
    </div>
  );
}
