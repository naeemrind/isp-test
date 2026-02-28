import { useState } from "react";
import {
  Pencil,
  Trash2,
  CreditCard,
  History,
  CornerDownRight,
  AlertCircle,
  CheckCircle2,
  ArrowDownCircle,
  Clock,
  XCircle,
  FileText,
  Printer,
} from "lucide-react";
import Badge from "../../components/ui/Badge";
import WhatsAppButton from "../../components/shared/WhatsAppButton";
import Modal from "../../components/ui/Modal";
import InvoiceModal from "../../components/ui/InvoiceModal";
import { formatDate, daysUntil } from "../../utils/dateUtils";
import { MESSAGE_TEMPLATES } from "../../config/messageTemplates";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";

export default function CustomerTable({
  customers,
  onEdit,
  onPay,
  onDelete,
  searchQuery,
}) {
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);
  const getCyclesForCustomer = usePaymentStore((s) => s.getCyclesForCustomer);
  const packages = usePackageStore((s) => s.packages);

  const [historyTarget, setHistoryTarget] = useState(null);
  // invoiceTarget: { customer, cycle, packageName }
  const [invoiceTarget, setInvoiceTarget] = useState(null);

  const filtered = customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.userName?.toLowerCase().includes(q) ||
      c.mobileNo?.includes(q) ||
      c.mainArea?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-left">
              <th className="px-3 py-2 font-medium w-10 text-center">#</th>
              <th className="px-3 py-2 font-medium min-w-48">Customer</th>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Pending</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer, idx) => {
              const cycle = getActiveCycle(customer.id);
              const pkg = packages.find((p) => p.id === customer.packageId);
              const days = cycle ? daysUntil(cycle.cycleEndDate) : null;

              // Historical price: locked at last renewal > derived from cycle > current pkg price
              let displayPrice = null;
              if (customer.lockedPackagePrice != null) {
                displayPrice = Number(customer.lockedPackagePrice);
              } else if (cycle) {
                const carried = Number(cycle.previousBalance) || 0;
                displayPrice = Number(cycle.totalAmount) - carried;
              } else if (pkg) {
                displayPrice = Number(pkg.price);
              }

              const currentPkgPrice = pkg ? Number(pkg.price) : null;
              const priceChangedSinceLock =
                displayPrice != null &&
                currentPkgPrice != null &&
                displayPrice !== currentPkgPrice;

              let rowBg = "";
              let cycleStatus = cycle ? cycle.status : "pending";
              if (cycle) {
                if (days !== null && days < 0 && cycleStatus !== "clear") {
                  cycleStatus = "overdue";
                  rowBg = "bg-red-50";
                } else if (
                  days !== null &&
                  days <= 3 &&
                  cycleStatus !== "clear"
                ) {
                  rowBg = "bg-yellow-50";
                } else if (cycleStatus === "clear") {
                  rowBg = "";
                }
              }

              const waMessage =
                cycle && cycle.amountPending > 0
                  ? MESSAGE_TEMPLATES.paymentDue(customer, cycle)
                  : cycle
                    ? MESSAGE_TEMPLATES.expiryReminder(customer, cycle)
                    : "";

              return (
                <tr
                  key={customer.id}
                  className={`border-b border-gray-100 ${rowBg} hover:bg-gray-50`}
                >
                  <td className="px-3 py-2 text-center text-xs text-gray-400 font-medium w-10">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">
                      {customer.fullName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {customer.userName}
                    </div>
                    {customer.mobileNo && (
                      <div className="text-xs text-gray-400">
                        {customer.mobileNo}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {customer.mainArea || "-"}
                  </td>

                  {/* Package column with locked historical price */}
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-700">
                      {pkg ? pkg.name : "-"}
                    </div>
                    {displayPrice != null && (
                      <div
                        className="text-xs text-gray-400 mt-0.5"
                        title={
                          priceChangedSinceLock
                            ? `Current package price is PKR ${currentPkgPrice?.toLocaleString()} — customer is on the old locked rate`
                            : undefined
                        }
                      >
                        PKR {displayPrice.toLocaleString()}
                        {priceChangedSinceLock && (
                          <span className="ml-1 text-amber-500 font-semibold">
                            *
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {cycle ? (
                      <div>
                        <div className="text-xs">
                          {formatDate(cycle.cycleEndDate)}
                        </div>
                        <div
                          className={`text-xs ${
                            days < 0
                              ? "text-red-600"
                              : days <= 3
                                ? "text-yellow-700"
                                : "text-gray-400"
                          }`}
                        >
                          {days < 0
                            ? `${-days}d overdue`
                            : days === 0
                              ? "expires today"
                              : `${days}d left`}
                        </div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {cycle && cycle.amountPending > 0 ? (
                      <span className="text-red-600 font-medium">
                        PKR {cycle.amountPending}
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">Paid</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      status={
                        customer.status === "suspended" &&
                        (!cycle || cycle.amountPending === 0)
                          ? "clear"
                          : customer.status === "active"
                            ? cycleStatus
                            : customer.status
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {/* Labeled action buttons */}
                      <button
                        onClick={() => onPay(customer)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 transition-colors whitespace-nowrap"
                        title="Record Payment"
                      >
                        <CreditCard size={12} /> Pay
                      </button>
                      <button
                        onClick={() => onEdit(customer)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white text-gray-700 rounded hover:bg-gray-50 border border-gray-300 transition-colors"
                        title="Edit Customer"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => onDelete(customer)}
                        className="flex items-center justify-center w-7 h-7 text-xs font-medium bg-white text-red-500 rounded hover:bg-red-50 border border-gray-200 transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 size={13} />
                      </button>
                      {customer.mobileNo && (
                        <WhatsAppButton
                          mobileNo={customer.mobileNo}
                          message={waMessage}
                          label="Send"
                        />
                      )}
                      {/* Divider */}
                      <div className="w-px h-5 bg-gray-200 mx-0.5" />
                      {/* Icon-only utility buttons */}
                      <button
                        onClick={() => setHistoryTarget(customer)}
                        className="flex items-center justify-center w-7 h-7 rounded border bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        title="View Payment History"
                      >
                        <History size={14} />
                      </button>
                      {cycle ? (
                        <button
                          onClick={() =>
                            setInvoiceTarget({
                              customer,
                              cycle,
                              packageName: pkg?.name || "—",
                            })
                          }
                          className="flex items-center justify-center w-7 h-7 rounded border bg-white border-gray-200 text-gray-400 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 transition-colors"
                          title="View / Print Latest Invoice"
                        >
                          <FileText size={14} />
                        </button>
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-gray-400 text-sm"
                >
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* History Modal — size "lg" for more breathing room */}
      <Modal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={
          historyTarget
            ? `Payment History — ${historyTarget.fullName}`
            : "History"
        }
        size="lg"
      >
        {historyTarget && (
          <PaymentHistory
            customer={historyTarget}
            getCyclesForCustomer={getCyclesForCustomer}
            packages={packages}
            onInvoice={(cycle, pkgName) =>
              setInvoiceTarget({
                customer: historyTarget,
                cycle,
                packageName: pkgName,
              })
            }
          />
        )}
      </Modal>

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        customer={invoiceTarget?.customer}
        cycle={invoiceTarget?.cycle}
        packageName={invoiceTarget?.packageName}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A cycle that has shiftedAmount > 0 was forcibly "cleared" by the system at
 * renewal time — the customer never actually paid. We override the display
 * status to "carried_forward" so staff are not misled by "Clear".
 */
function getCycleDisplayStatus(cycle) {
  if (Number(cycle.shiftedAmount) > 0) return "carried_forward";
  return cycle.status;
}

const STATUS_CFG = {
  clear: {
    label: "Fully Paid",
    icon: <CheckCircle2 size={13} />,
    badge: "bg-green-100 text-green-800 border-green-200",
    headerBg: "bg-green-50 border-green-200",
    cardBorder: "border-green-200",
    bar: "bg-green-500",
    pendingBg: "bg-gray-50",
    pendingText: "text-gray-400",
  },
  pending: {
    label: "Pending",
    icon: <Clock size={13} />,
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    headerBg: "bg-yellow-50 border-yellow-200",
    cardBorder: "border-yellow-200",
    bar: "bg-blue-500",
    pendingBg: "bg-red-50",
    pendingText: "text-red-700",
  },
  overdue: {
    label: "Overdue",
    icon: <XCircle size={13} />,
    badge: "bg-red-100 text-red-800 border-red-200",
    headerBg: "bg-red-50 border-red-200",
    cardBorder: "border-red-300",
    bar: "bg-red-400",
    pendingBg: "bg-red-50",
    pendingText: "text-red-700",
  },
  carried_forward: {
    label: "Carried Forward",
    icon: <CornerDownRight size={13} />,
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    headerBg: "bg-orange-50 border-orange-200",
    cardBorder: "border-orange-300",
    bar: "bg-orange-400",
    pendingBg: "bg-orange-50",
    pendingText: "text-orange-700",
  },
};

function StatusPill({ statusKey }) {
  const cfg = STATUS_CFG[statusKey] || STATUS_CFG.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── PaymentHistory ───────────────────────────────────────────────────────────

function PaymentHistory({
  customer,
  getCyclesForCustomer,
  packages,
  onInvoice,
}) {
  const cycles = getCyclesForCustomer(customer.id);

  if (!cycles || cycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-gray-400">
        <History size={36} className="mb-3 opacity-25" />
        <p className="text-sm">No payment history available.</p>
      </div>
    );
  }

  // Overall summary across all cycles.
  //
  // WHY we subtract previousBalance from totalAmount:
  //   When a customer is renewed with unpaid dues, the new cycle's totalAmount
  //   already includes the carried-over debt (e.g. PKR 1600 package + PKR 1600
  //   debt = PKR 3200). The old cycle's totalAmount is ALSO PKR 1600. If we
  //   naively sum all totalAmounts we count that PKR 1600 debt twice (PKR 4800).
  //   Subtracting previousBalance from each cycle gives us only the actual new
  //   package charge per cycle, avoiding double-counting.
  //
  // grandPending: only the latest cycle's amountPending is the real current
  //   outstanding — older cycles were either paid or their debt was rolled
  //   forward into the latest cycle (and is already counted there).
  const grandBilled = cycles.reduce(
    (s, c) => s + Number(c.totalAmount || 0) - Number(c.previousBalance || 0),
    0,
  );
  const grandPaid = cycles.reduce((s, c) => s + Number(c.amountPaid || 0), 0);
  const grandPending = Number(cycles[0]?.amountPending || 0);

  return (
    <div className="space-y-5">
      {/* ── Grand summary ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-1">
            Total Billed
          </p>
          <p className="text-base font-bold text-gray-800">
            PKR {grandBilled.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {cycles.length} cycle{cycles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] font-bold uppercase text-green-600 tracking-wide mb-1">
            Total Paid
          </p>
          <p className="text-base font-bold text-green-700">
            PKR {grandPaid.toLocaleString()}
          </p>
          <p className="text-[10px] text-green-600/70 mt-0.5">
            {grandBilled > 0
              ? Math.min(100, Math.round((grandPaid / grandBilled) * 100))
              : 0}
            % of total billed
          </p>
        </div>
        <div
          className={`rounded-xl px-4 py-3 text-center border ${
            grandPending > 0
              ? "bg-red-50 border-red-200"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <p
            className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${
              grandPending > 0 ? "text-red-500" : "text-gray-400"
            }`}
          >
            Outstanding
          </p>
          <p
            className={`text-base font-bold ${
              grandPending > 0 ? "text-red-700" : "text-gray-400"
            }`}
          >
            PKR {grandPending.toLocaleString()}
          </p>
          <p
            className={`text-[10px] mt-0.5 ${grandPending > 0 ? "text-red-400" : "text-gray-400"}`}
          >
            {grandPending > 0 ? "still owed" : "fully settled"}
          </p>
        </div>
      </div>

      {/* ── Per-cycle cards ── */}
      <div className="space-y-4">
        {cycles.map((cycle, index) => {
          const displayStatus = getCycleDisplayStatus(cycle);
          const cfg = STATUS_CFG[displayStatus] || STATUS_CFG.pending;
          const isCarriedForward = displayStatus === "carried_forward";
          const isClear = displayStatus === "clear";
          const hasIncomingDebt = Number(cycle.previousBalance) > 0;
          const packageOnlyPrice =
            Number(cycle.totalAmount) - Number(cycle.previousBalance || 0);
          const isLatest = index === 0;

          const percentPaid =
            Number(cycle.totalAmount) > 0
              ? Math.min(
                  100,
                  Math.round(
                    (Number(cycle.amountPaid) / Number(cycle.totalAmount)) *
                      100,
                  ),
                )
              : isClear
                ? 100
                : 0;

          // For carried-forward cycles the "pending" shown should be what was shifted
          const pendingDisplay = isCarriedForward
            ? Number(cycle.shiftedAmount)
            : Number(cycle.amountPending);

          return (
            <div
              key={cycle.id}
              className={`rounded-xl border-2 overflow-hidden ${cfg.cardBorder}`}
            >
              {/* Card header */}
              <div
                className={`px-4 py-3 flex items-center justify-between border-b ${cfg.headerBg}`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">
                      {formatDate(cycle.cycleStartDate)}
                    </span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span className="text-sm font-bold text-gray-800">
                      {formatDate(cycle.cycleEndDate)}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cycle.isRenewal ? "Renewal" : "Initial"} cycle
                    {" · "}
                    {cycle.installments?.length || 0} payment
                    {(cycle.installments?.length || 0) !== 1 ? "s" : ""}{" "}
                    recorded
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill statusKey={displayStatus} />
                  <button
                    onClick={() => {
                      // Resolve package name for this cycle
                      const pkgName =
                        packages?.find(
                          (p) => String(p.id) === String(customer.packageId),
                        )?.name || "—";
                      onInvoice(cycle, pkgName);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded border bg-white border-gray-300 text-gray-400 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-colors"
                    title="View / Print Invoice"
                  >
                    <Printer size={13} />
                  </button>
                </div>
              </div>

              <div className="px-4 py-4 bg-white space-y-4">
                {/* ── CARRIED FORWARD alert — shown on the OLD cycle ── */}
                {isCarriedForward && (
                  <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-3">
                    <CornerDownRight
                      size={16}
                      className="text-orange-500 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">
                        Unpaid dues moved to next cycle — PKR{" "}
                        {Number(cycle.shiftedAmount).toLocaleString()}
                      </p>
                      <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                        The customer did not pay this cycle. When the next cycle
                        was started, the full outstanding amount of{" "}
                        <strong>
                          PKR {Number(cycle.shiftedAmount).toLocaleString()}
                        </strong>{" "}
                        was automatically added to the new cycle&apos;s total
                        bill. This cycle was then marked as &quot;settled&quot;
                        by the system, but no actual payment was received.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── INCOMING DEBT notice — shown on the NEW cycle ── */}
                {hasIncomingDebt && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-3">
                    <ArrowDownCircle
                      size={16}
                      className="text-blue-500 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">
                        Includes unpaid debt from previous cycle — PKR{" "}
                        {Number(cycle.previousBalance).toLocaleString()}
                      </p>
                      <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        This cycle&apos;s total of{" "}
                        <strong>
                          PKR {Number(cycle.totalAmount).toLocaleString()}
                        </strong>{" "}
                        is made up of the package price{" "}
                        <strong>
                          (PKR {packageOnlyPrice.toLocaleString()})
                        </strong>{" "}
                        plus the carried-over balance from the previous cycle{" "}
                        <strong>
                          (PKR {Number(cycle.previousBalance).toLocaleString()})
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Financials grid ── */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide mb-1">
                      Total Bill
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      PKR {Number(cycle.totalAmount).toLocaleString()}
                    </p>
                    {hasIncomingDebt && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        incl. PKR{" "}
                        {Number(cycle.previousBalance).toLocaleString()} debt
                      </p>
                    )}
                  </div>

                  <div className="bg-green-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-green-600 tracking-wide mb-1">
                      Paid
                    </p>
                    <p className="text-sm font-bold text-green-700">
                      PKR {Number(cycle.amountPaid).toLocaleString()}
                    </p>
                  </div>

                  <div className={`rounded-lg px-3 py-2.5 ${cfg.pendingBg}`}>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${
                        isCarriedForward
                          ? "text-orange-500"
                          : pendingDisplay > 0
                            ? "text-red-500"
                            : "text-gray-400"
                      }`}
                    >
                      {isCarriedForward ? "Moved Forward" : "Pending"}
                    </p>
                    <p className={`text-sm font-bold ${cfg.pendingText}`}>
                      PKR {pendingDisplay.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* ── Progress bar ── */}
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Payment progress</span>
                    <span>{percentPaid}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${cfg.bar}`}
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                {/* ── Installments list ── */}
                {cycle.installments && cycle.installments.length > 0 ? (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                      Payments Received
                    </p>
                    <div className="space-y-2">
                      {cycle.installments.map((inst) => (
                        <div
                          key={inst.id}
                          className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <CheckCircle2
                                size={12}
                                className="text-green-600"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-800">
                                {formatDate(inst.datePaid)}
                              </p>
                              {inst.note && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  via {inst.note}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-800">
                            PKR {Number(inst.amountPaid).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  !isCarriedForward && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                      <AlertCircle size={13} className="shrink-0" />
                      No payments recorded for this cycle.
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
