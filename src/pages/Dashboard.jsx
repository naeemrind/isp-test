import { useState, useEffect, useRef } from "react";
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
  Package,
  RefreshCw,
  Info,
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

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selDate, setSelDate] = useState(today());

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

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeCustomers = customers.filter((c) => !c.isArchived);

  // 1. ALL TIME
  let at_collected = 0,
    at_pending = 0,
    at_overdueMoney = 0,
    at_overdueCount = 0;
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

  // Warehouse stock value = money you already spent buying materials still sitting in your store.
  // This IS your cost. You paid PKR 19,000 for cable — that PKR 19,000 is gone from your pocket.
  // As you issue cable and collect the cable money from subscribers (included in their payment),
  // the warehouse stock decreases and Net Income naturally improves.
  const at_inventoryValue = inventoryItems.reduce(
    (s, i) => s + (i.inHand ?? 0) * (i.unitRate || 0),
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
    // Net Income = Total ever received − Recorded expenses − Current warehouse stock value
    // The warehouse stock IS a cost you have already paid. As subscribers pay you for
    // materials (included in their connection fee), your "Ever Collected" goes up and
    // the warehouse stock goes down — so Net Income grows naturally. Correct!
    netIncome: at_totalEver - at_totalExpenses - at_inventoryValue,
  };

  // 2. MONTHLY
  const monthStart = new Date(selYear, selMonth, 1);
  const monthEnd = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
  let mo_collected = 0,
    mo_pending = 0,
    mo_overdueMoney = 0,
    mo_newCustomers = 0;
  let mo_clearedCount = 0,
    mo_pendingCount = 0,
    mo_overdueCount = 0;

  activeCustomers.forEach((c) => {
    if (c.createdAt) {
      const d = new Date(c.createdAt);
      if (d >= monthStart && d <= monthEnd) mo_newCustomers++;
    }
    const cycle = getLatestCycle(cycles, c.id);
    if (!cycle) return;
    const cycleStart = new Date(cycle.cycleStartDate);
    const cycleEnd = new Date(cycle.cycleEndDate);
    if (cycleStart > monthEnd || cycleEnd < monthStart) return;
    mo_collected += cycle.amountPaid || 0;
    mo_pending += cycle.amountPending || 0;
    const days = daysUntil(cycle.cycleEndDate);
    if (cycle.amountPending === 0) mo_clearedCount++;
    else if (days < 0) {
      mo_overdueCount++;
      mo_overdueMoney += cycle.amountPending;
    } else mo_pendingCount++;
  });

  const mo_expenses = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const mo_inventoryValue = inventoryItems
    .filter((i) => {
      const d = new Date(i.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, i) => s + (i.inHand ?? 0) * (i.unitRate || 0), 0);

  let mo_totalCollected = 0;
  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      const d = new Date(inst.datePaid);
      if (d >= monthStart && d <= monthEnd)
        mo_totalCollected += inst.amountPaid || 0;
    });
  });

  const monthly = {
    collected: mo_collected,
    totalCollected: mo_totalCollected,
    pending: mo_pending,
    overdueMoney: mo_overdueMoney,
    newCustomers: mo_newCustomers,
    clearedCount: mo_clearedCount,
    pendingCount: mo_pendingCount,
    overdueCount: mo_overdueCount,
    totalExpenses: mo_expenses,
    inventoryValue: mo_inventoryValue,
    netIncome: mo_totalCollected - mo_expenses - mo_inventoryValue,
    pendingStatusBalance: 0,
    suspendedBalance: 0,
  };

  // 3. DAILY
  let day_collected = 0,
    day_newCustomers = 0;
  cycles.forEach((cy) => {
    (cy.installments || []).forEach((inst) => {
      if (inst.datePaid === selDate) day_collected += inst.amountPaid || 0;
    });
  });
  activeCustomers.forEach((c) => {
    if (c.createdAt && c.createdAt.startsWith(selDate)) day_newCustomers++;
  });
  const day_expenses = expenses
    .filter((e) => e.date === selDate)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const day_inventoryValue = inventoryItems
    .filter((i) => i.date === selDate)
    .reduce((s, i) => s + (i.inHand ?? 0) * (i.unitRate || 0), 0);

  const daily = {
    collected: day_collected,
    newCustomers: day_newCustomers,
    totalExpenses: day_expenses,
    inventoryValue: day_inventoryValue,
    netIncome: day_collected - day_expenses - day_inventoryValue,
  };

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const outOfStockInventory = inventoryItems.filter(
    (i) => (i.inHand ?? 0) <= 0 && (i.quantity || 0) > 0,
  );
  const lowStockInventory = inventoryItems.filter((i) => {
    if (!i.quantity) return false;
    const ratio = (i.inHand ?? 0) / i.quantity;
    return ratio <= 0.2 && (i.inHand ?? 0) > 0;
  });

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
  const totalAttentionCount =
    urgentCustomers.length +
    outOfStockInventory.length +
    lowStockInventory.length;

  return (
    <div className="p-5 space-y-5 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today()}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
          {["alltime", "monthly", "daily"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold ${mode === m ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"}`}
            >
              {m === "alltime"
                ? "All Time"
                : m === "monthly"
                  ? "Monthly"
                  : "Daily"}
            </button>
          ))}
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

      {/* CARDS */}
      {mode !== "daily" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigCard
              icon={<Users size={16} />}
              label="Total Subscribers"
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
              value={`PKR ${(mode === "monthly" ? monthly.totalCollected : allTime.totalEverCollected).toLocaleString()}`}
              sub={
                mode === "monthly"
                  ? "Payments received this month"
                  : "Sum of all payments ever received"
              }
              color="green"
              isSensitive={true}
              infoContent={
                mode === "alltime"
                  ? {
                      type: "everCollected",
                      totalCycles: cycles.length,
                      totalSubscribers: activeCustomers.length,
                      pendingBalance: allTime.pending,
                    }
                  : null
              }
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigCard
              icon={<Users size={16} />}
              label="Expired Accounts"
              value={displayStats.overdueCount}
              sub="Cycle ended + unpaid balance"
              color="red"
              highlight={displayStats.overdueCount > 0}
              onClick={() => onNavigate("customers", "expired")}
              isClickable
            />
            <BigCard
              icon={<AlertTriangle size={16} />}
              label="Total Expired Balance"
              value={`PKR ${displayStats.overdueMoney.toLocaleString()}`}
              sub="Expired cycles with unpaid balance"
              color="red"
              highlight={displayStats.overdueMoney > 0}
              onClick={() => onNavigate("customers", "expired")}
              isClickable
            />
            <BigCard
              icon={<TrendingUp size={16} />}
              label="Net Income"
              value={`PKR ${(mode === "monthly" ? monthly.netIncome : allTime.netIncome).toLocaleString()}`}
              sub="Collected − expenses − warehouse stock"
              color={
                (mode === "monthly" ? monthly.netIncome : allTime.netIncome) >=
                0
                  ? "green"
                  : "red"
              }
              isSensitive={true}
              infoContent={{
                type: "netIncome",
                collected:
                  mode === "monthly"
                    ? monthly.totalCollected
                    : allTime.totalEverCollected,
                expenses:
                  mode === "monthly"
                    ? monthly.totalExpenses
                    : allTime.totalExpenses,
                warehouseStock:
                  mode === "monthly"
                    ? monthly.inventoryValue
                    : allTime.inventoryValue,
              }}
            />
          </div>
        </>
      ) : (
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
            sub={`Expenses + new stock on ${formatDate(selDate)}`}
            color="red"
            inventoryValue={daily.inventoryValue || 0}
            expensesValue={daily.totalExpenses || 0}
          />
          <BigCard
            icon={<TrendingUp size={16} />}
            label="Daily Net Income"
            value={`PKR ${daily.netIncome.toLocaleString()}`}
            sub="Collected − expenses − new stock"
            color={daily.netIncome >= 0 ? "green" : "red"}
            isSensitive={true}
          />
          <BigCard
            icon={<Users size={16} />}
            label="New Subscribers"
            value={daily.newCustomers}
            sub="Joined today"
            color="blue"
          />
        </div>
      )}

      {/* NEEDS ATTENTION */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          Needs Attention
          {totalAttentionCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalAttentionCount}
            </span>
          )}
        </h2>

        {outOfStockInventory.map((item) => (
          <div
            key={`oos-${item.id}`}
            className="bg-red-50 border-2 border-red-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3 mb-3"
          >
            <div className="flex items-center gap-3">
              <Package size={18} className="text-red-500 shrink-0" />
              <div>
                <span className="font-bold text-red-700 text-sm">
                  {item.description}
                </span>
                <span className="text-xs text-red-500 ml-2">
                  — Out of Stock. 0 {item.unit} remaining. Restock required.
                </span>
              </div>
            </div>
            <button
              onClick={() => onNavigate("inventory")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              <RefreshCw size={11} /> Restock Now
            </button>
          </div>
        ))}

        {lowStockInventory.map((item) => (
          <div
            key={`low-${item.id}`}
            className="bg-amber-50 border-2 border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3 mb-3"
          >
            <div className="flex items-center gap-3">
              <Package size={18} className="text-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-amber-700 text-sm">
                  {item.description}
                </span>
                <span className="text-xs text-amber-600 ml-2">
                  — Low Stock: {item.inHand} {item.unit} left (
                  {Math.round(((item.inHand ?? 0) / item.quantity) * 100)}% of
                  original)
                </span>
              </div>
            </div>
            <button
              onClick={() => onNavigate("inventory")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
            >
              <RefreshCw size={11} /> Go to Inventory
            </button>
          </div>
        ))}

        {totalAttentionCount === 0 ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <CheckCircle size={22} className="text-green-600" />
            <span className="text-green-800 font-semibold text-base">
              All accounts are in good standing.
            </span>
          </div>
        ) : urgentCustomers.length > 0 ? (
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-white text-left">
                  <th className="px-4 py-3 text-sm font-semibold">
                    Subscriber
                  </th>
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
                  if (isExpiredUnpaid)
                    waMessage = MESSAGE_TEMPLATES.paymentOverdue(
                      customer,
                      cycle,
                    );
                  else if (cycle.amountPending > 0)
                    waMessage = MESSAGE_TEMPLATES.paymentDue(customer, cycle);
                  else
                    waMessage = MESSAGE_TEMPLATES.expiryReminder(
                      customer,
                      cycle,
                    );

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
                        {isExpiredUnpaid && <Badge status="expired" />}
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
        ) : null}
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

// ── Color map ─────────────────────────────────────────────────────────────────
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

// ── BigCard ───────────────────────────────────────────────────────────────────
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
  infoContent,
}) {
  const c = colorMap[color] || colorMap.blue;
  const [revealed, setRevealed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef(null);

  // Close tooltip when clicking anywhere outside
  useEffect(() => {
    if (!showInfo) return;
    const handler = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) {
        setShowInfo(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showInfo]);

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
          <div className="flex items-center gap-1.5">
            {/* Info tooltip */}
            {infoContent && (
              <div className="relative" ref={infoRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo((s) => !s);
                  }}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="More info"
                >
                  <Info size={14} />
                </button>
                {showInfo && (
                  <div className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-68 text-xs">
                    {infoContent.type === "everCollected" && (
                      <>
                        <p className="font-bold text-gray-800 mb-2 text-sm">
                          📥 What is Ever Collected?
                        </p>
                        <p className="text-gray-600 leading-relaxed mb-2">
                          The total of all actual cash payments ever received
                          from subscribers — across every billing cycle since
                          day one.
                        </p>
                        <div className="space-y-1 border-t border-gray-100 pt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Billing cycles total
                            </span>
                            <span className="font-semibold text-gray-700">
                              {infoContent.totalCycles}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Active subscribers
                            </span>
                            <span className="font-semibold text-gray-700">
                              {infoContent.totalSubscribers}
                            </span>
                          </div>
                          {infoContent.pendingBalance > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Still pending (not included)</span>
                              <span className="font-semibold">
                                PKR{" "}
                                {infoContent.pendingBalance.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-400 mt-2 italic">
                          Inventory and expenses are NOT included here — they
                          show in the Expenses card.
                        </p>
                      </>
                    )}
                    {infoContent.type === "netIncome" && (
                      <>
                        <p className="font-bold text-gray-800 mb-2 text-sm">
                          📊 Net Income Breakdown
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-green-700">
                            <span className="font-semibold">+ Collected</span>
                            <span className="font-bold">
                              PKR {infoContent.collected.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>− Recorded Expenses</span>
                            <span className="font-semibold">
                              PKR {infoContent.expenses.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>− Warehouse Stock</span>
                            <span className="font-semibold">
                              PKR {infoContent.warehouseStock.toLocaleString()}
                            </span>
                          </div>
                          <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-800">
                            <span>= Net Income</span>
                            <span>
                              PKR{" "}
                              {(
                                infoContent.collected -
                                infoContent.expenses -
                                infoContent.warehouseStock
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 text-blue-700 leading-relaxed">
                          <p className="font-semibold text-xs mb-0.5">
                            Why does issuing stock increase Net Income?
                          </p>
                          <p className="text-xs">
                            When you issue cable and the technician collects the
                            cable money from the subscriber (included in their
                            payment), your "Ever Collected" goes up AND your
                            warehouse stock goes down — so Net Income grows.
                            This is correct!
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
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
