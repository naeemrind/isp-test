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
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import useCustomerStore from "../store/useCustomerStore";
import usePaymentStore from "../store/usePaymentStore";
import useExpenseStore from "../store/useExpenseStore";
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

export default function Dashboard({ onNavigateToCustomers }) {
  const customers = useCustomerStore((s) => s.customers);
  const cycles = usePaymentStore((s) => s.cycles);
  const expenses = useExpenseStore((s) => s.expenses);

  const [payCustomer, setPayCustomer] = useState(null);
  const [mode, setMode] = useState("alltime");

  // New State for Needs Attention Table
  const [naSearch, setNaSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "days",
    direction: "asc",
  });

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());

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

  // ── Stats (computed inline — no useMemo, always fresh) ──────────
  const activeCustomers = customers.filter((c) => !c.isArchived);

  // Stats Variables
  let at_collected = 0;
  let at_pendingActiveAmount = 0; // Only non-expired pending
  let at_overdueAmount = 0; // Only expired pending
  let at_overdueCount = 0;
  let at_expiringCount = 0;
  let at_renewalCount = 0;
  let at_activeCount = 0;
  let at_suspendedCount = 0;
  let at_totalEver = 0;

  activeCustomers.forEach((c) => {
    if (c.status === "active") at_activeCount++;
    if (c.status === "suspended") at_suspendedCount++;

    const cycle = getLatestCycle(cycles, c.id);
    if (!cycle) return;

    at_collected += cycle.amountPaid || 0;

    // Split Pending Amount Logic
    const pending = cycle.amountPending || 0;
    const days = daysUntil(cycle.cycleEndDate);

    if (pending > 0) {
      if (days < 0) {
        // Expired
        at_overdueAmount += pending;
        at_overdueCount++;
      } else {
        // Active (Not Expired)
        at_pendingActiveAmount += pending;
      }
    }

    if (days >= 0 && days <= 5) at_expiringCount++;
    if (days < 0) at_renewalCount++;
  });

  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      at_totalEver += inst.amountPaid || 0;
    });
  });

  const at_totalExpenses = expenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0,
  );

  const allTime = {
    totalCustomers: activeCustomers.length,
    activeCount: at_activeCount,
    suspendedCount: at_suspendedCount,
    collected: at_collected,
    pendingActive: at_pendingActiveAmount, // Updated key
    overdueAmount: at_overdueAmount, // New key
    totalEverCollected: at_totalEver,
    overdueCount: at_overdueCount,
    expiringCount: at_expiringCount,
    renewalCount: at_renewalCount,
    totalExpenses: at_totalExpenses,
    netIncome: at_totalEver - at_totalExpenses,
  };

  // Monthly stats (Simpler logic: Pending = Any pending balance falling in this month's window)
  const monthStart = new Date(selYear, selMonth, 1);
  const monthEnd = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
  let mo_collected = 0,
    mo_pending = 0,
    mo_newCustomers = 0;
  let mo_clearedCount = 0,
    mo_pendingCount = 0;

  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      const d = new Date(inst.datePaid);
      if (d >= monthStart && d <= monthEnd)
        mo_collected += inst.amountPaid || 0;
    });
    const cStart = new Date(cy.cycleStartDate);
    const cEnd = new Date(cy.cycleEndDate);
    if (cStart <= monthEnd && cEnd >= monthStart) {
      mo_pending += cy.amountPending || 0;
      if (cy.status === "clear") mo_clearedCount++;
      else mo_pendingCount++;
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

  const monthly = {
    collected: mo_collected,
    pending: mo_pending,
    newCustomers: mo_newCustomers,
    clearedCount: mo_clearedCount,
    pendingCount: mo_pendingCount,
    totalExpenses: mo_expenses,
    netIncome: mo_collected - mo_expenses,
  };

  // ── Logic for "Needs Attention" Table ──

  // 1. Base List: Get everyone who needs attention
  const baseUrgent = activeCustomers
    .map((c) => ({ customer: c, cycle: getLatestCycle(cycles, c.id) }))
    .filter(({ cycle }) => {
      if (!cycle) return true; // No cycle = Needs setup
      const days = daysUntil(cycle.cycleEndDate);
      return days < 0 || days <= 5;
    });

  // 2. Search Filter
  const filteredUrgent = baseUrgent.filter(({ customer }) => {
    const q = naSearch.toLowerCase();
    return (
      customer.fullName.toLowerCase().includes(q) ||
      customer.userName.toLowerCase().includes(q) ||
      (customer.mobileNo && customer.mobileNo.includes(q)) ||
      (customer.mainArea && customer.mainArea.toLowerCase().includes(q))
    );
  });

  // 3. Sorting
  const sortedUrgent = [...filteredUrgent].sort((a, b) => {
    const { key, direction } = sortConfig;
    const modifier = direction === "asc" ? 1 : -1;

    // Helper for days (handle missing cycle)
    const getDays = (item) =>
      item.cycle ? daysUntil(item.cycle.cycleEndDate) : -9999;

    switch (key) {
      case "name":
        return (
          modifier * a.customer.fullName.localeCompare(b.customer.fullName)
        );
      case "area":
        return (
          modifier *
          (a.customer.mainArea || "").localeCompare(b.customer.mainArea || "")
        );
      case "date": {
        const dateA = a.cycle ? new Date(a.cycle.cycleEndDate) : new Date(0);
        const dateB = b.cycle ? new Date(b.cycle.cycleEndDate) : new Date(0);
        return modifier * (dateA - dateB);
      }
      case "days":
        return modifier * (getDays(a) - getDays(b));
      case "balance": {
        const balA = a.cycle ? a.cycle.amountPending : 0;
        const balB = b.cycle ? b.cycle.amountPending : 0;
        return modifier * (balA - balB);
      }
      default:
        return 0;
    }
  });

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <div className="w-3.5 h-3.5" />; // spacer
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={14} />
    ) : (
      <ArrowDown size={14} />
    );
  };

  return (
    <div className="p-5 space-y-5 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
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
        </div>
      </div>

      {/* MONTH NAVIGATOR */}
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

      {/* CARDS — ALL TIME */}
      {mode === "alltime" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <BigCard
              icon={<Users size={20} />}
              label="Total Customers"
              value={allTime.totalCustomers}
              sub={`${allTime.activeCount} active · ${allTime.suspendedCount} suspended`}
              color="blue"
            />
            <BigCard
              icon={<CheckCircle size={20} />}
              label="Total Collected"
              value={`PKR ${allTime.totalEverCollected.toLocaleString()}`}
              sub="All payments ever received"
              color="green"
              isSensitive={true} // Hidden by default
            />
            {/* CLICKABLE PENDING CARD (ACTIVE ONLY) */}
            <BigCard
              icon={<Clock size={20} />}
              label="Currently Pending"
              value={`PKR ${allTime.pendingActive.toLocaleString()}`}
              sub="Active cycles (Not Overdue)"
              color="amber"
              onClick={() => onNavigateToCustomers("pending")}
            />
            {/* NEW: TOTAL OVERDUE CARD */}
            <BigCard
              icon={<AlertTriangle size={20} />}
              label="Total Overdue"
              value={`PKR ${allTime.overdueAmount.toLocaleString()}`}
              sub="Expired cycles with balance"
              color="red"
              highlight={allTime.overdueAmount > 0}
              onClick={() => onNavigateToCustomers("overdue")}
            />
            <BigCard
              icon={<XCircle size={20} />}
              label="Total Expenses"
              value={`PKR ${allTime.totalExpenses.toLocaleString()}`}
              sub="All recorded expenses"
              color="red"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CLICKABLE OVERDUE COUNT CARD */}
            <BigCard
              icon={<Users size={20} />}
              label="Overdue Customers"
              value={allTime.overdueCount}
              sub="Count of customers overdue"
              color="red"
              highlight={allTime.overdueCount > 0}
              onClick={() => onNavigateToCustomers("overdue")}
            />
            <BigCard
              icon={<RefreshCw size={20} />}
              label="Needs Renewal"
              value={allTime.renewalCount}
              sub="Cycle expired, renew now"
              color="red"
              highlight={allTime.renewalCount > 0}
            />
            <BigCard
              icon={<Activity size={20} />}
              label="Expiring in 5 Days"
              value={allTime.expiringCount}
              sub="Collect before cutoff"
              color="amber"
              highlight={allTime.expiringCount > 0}
            />
            <BigCard
              icon={<TrendingUp size={20} />}
              label="Net Income"
              value={`PKR ${allTime.netIncome.toLocaleString()}`}
              sub="Total collected − expenses"
              color={allTime.netIncome >= 0 ? "green" : "red"}
              isSensitive={true} // Hidden by default
            />
          </div>
        </>
      )}

      {/* CARDS — MONTHLY (Unchanged mostly, pending remains grouped as snapshot) */}
      {mode === "monthly" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigCard
              icon={<CreditCard size={20} />}
              label="Collected"
              value={`PKR ${monthly.collected.toLocaleString()}`}
              sub="Payments received"
              color="green"
              isSensitive={true}
            />
            <BigCard
              icon={<Clock size={20} />}
              label="Pending"
              value={`PKR ${monthly.pending.toLocaleString()}`}
              sub="Unpaid balances"
              color="amber"
            />
            <BigCard
              icon={<XCircle size={20} />}
              label="Expenses"
              value={`PKR ${monthly.totalExpenses.toLocaleString()}`}
              sub="Recorded expenses"
              color="red"
            />
            <BigCard
              icon={<TrendingUp size={20} />}
              label="Net Income"
              value={`PKR ${monthly.netIncome.toLocaleString()}`}
              sub="Collected − expenses"
              color={monthly.netIncome >= 0 ? "green" : "red"}
              isSensitive={true}
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <BigCard
              icon={<Users size={20} />}
              label="New Customers"
              value={monthly.newCustomers}
              sub="Joined this month"
              color="blue"
            />
            <BigCard
              icon={<CheckCircle size={20} />}
              label="Cleared Cycles"
              value={monthly.clearedCount}
              sub="Fully paid"
              color="green"
            />
            <BigCard
              icon={<AlertTriangle size={20} />}
              label="Pending Cycles"
              value={monthly.pendingCount}
              sub="Unpaid cycles"
              color="amber"
              highlight={monthly.pendingCount > 0}
            />
          </div>
        </>
      )}

      {/* NEEDS ATTENTION TABLE */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Needs Attention
            {baseUrgent.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {baseUrgent.length}
              </span>
            )}
          </h2>

          {/* Search Bar for this table */}
          {baseUrgent.length > 0 && (
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-gray-400"
              />
              <input
                value={naSearch}
                onChange={(e) => setNaSearch(e.target.value)}
                placeholder="Search list..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {baseUrgent.length === 0 ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <CheckCircle size={22} className="text-green-600" />
            <span className="text-green-800 font-semibold text-base">
              All accounts are in good standing.
            </span>
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full relative border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-900 text-white text-left">
                    <th
                      onClick={() => requestSort("name")}
                      className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1">
                        Customer <SortIcon column="name" />
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("area")}
                      className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1">
                        Area <SortIcon column="area" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                      Mobile
                    </th>
                    <th
                      onClick={() => requestSort("date")}
                      className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1">
                        Cycle Ended <SortIcon column="date" />
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("days")}
                      className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1">
                        Days <SortIcon column="days" />
                      </div>
                    </th>
                    <th
                      onClick={() => requestSort("balance")}
                      className="px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1">
                        Balance Due <SortIcon column="balance" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUrgent.map(({ customer, cycle }) => {
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
                              {days === 0
                                ? "Expires today"
                                : `${days + 1}d left`}
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

                  {sortedUrgent.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-gray-400 bg-white"
                      >
                        No matches found for "{naSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
  onClick = null,
}) {
  const c = colorMap[color] || colorMap.blue;
  const [revealed, setRevealed] = useState(false);
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-5 ${c.bg} flex flex-col justify-between 
        ${highlight ? "ring-2 ring-offset-1 ring-red-300" : ""}
        ${isClickable ? "cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" : ""}
      `}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.iconBox} ${c.icon}`}
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
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </div>
      </div>

      <div className="mt-2">
        <div className="text-2xl font-bold text-gray-900 leading-tight">
          {isSensitive && !revealed ? (
            <span className="tracking-widest text-gray-400">••••••</span>
          ) : (
            value
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1 font-medium">{sub}</div>
      </div>
    </div>
  );
}
