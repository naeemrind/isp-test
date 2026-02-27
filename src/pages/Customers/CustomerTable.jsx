import { useState } from "react";
import {
  Pencil,
  Trash2,
  CreditCard,
  History,
  CornerDownRight,
  AlertCircle,
} from "lucide-react";
import Badge from "../../components/ui/Badge";
import WhatsAppButton from "../../components/shared/WhatsAppButton";
import Modal from "../../components/ui/Modal";
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

  // State for the History Modal
  const [historyTarget, setHistoryTarget] = useState(null);

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
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Pending</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => {
              const cycle = getActiveCycle(customer.id);
              const pkg = packages.find((p) => p.id === customer.packageId);
              const days = cycle ? daysUntil(cycle.cycleEndDate) : null;

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
                  <td className="px-3 py-2 text-gray-600">
                    {pkg ? pkg.name : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {cycle ? (
                      <div>
                        <div className="text-xs">
                          {formatDate(cycle.cycleEndDate)}
                        </div>
                        <div
                          className={`text-xs ${days < 0 ? "text-red-600" : days <= 3 ? "text-yellow-700" : "text-gray-400"}`}
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
                        customer.status === "active"
                          ? cycleStatus
                          : customer.status
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Pay Button */}
                      <button
                        onClick={() => onPay(customer)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 transition-colors"
                        title="Record Payment"
                      >
                        <CreditCard size={13} /> Pay
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEdit(customer)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-gray-700 rounded hover:bg-gray-50 border border-gray-300 transition-colors"
                        title="Edit Customer"
                      >
                        <Pencil size={13} /> Edit
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDelete(customer)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-red-600 rounded hover:bg-red-50 border border-gray-200 transition-colors"
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

                      {/* History Button (Modal Trigger) */}
                      <button
                        onClick={() => setHistoryTarget(customer)}
                        className="flex items-center justify-center w-7 h-7 rounded border bg-white border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
                        title="View Payment History"
                      >
                        <History size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-gray-400 text-sm"
                >
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      <Modal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={historyTarget ? `History: ${historyTarget.fullName}` : "History"}
        size="md"
      >
        {historyTarget && (
          <PaymentHistory
            customerId={historyTarget.id}
            getCyclesForCustomer={getCyclesForCustomer}
          />
        )}
      </Modal>
    </>
  );
}

function PaymentHistory({ customerId, getCyclesForCustomer }) {
  const cycles = getCyclesForCustomer(customerId);

  if (!cycles || cycles.length === 0)
    return (
      <p className="text-sm text-gray-400 italic p-2">
        No payment history available.
      </p>
    );

  return (
    <div className="space-y-4">
      {cycles.map((c) => (
        <div
          key={c.id}
          className="border border-gray-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors"
        >
          {/* Header of Cycle */}
          <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
            <div>
              <div className="text-sm font-bold text-gray-800">
                {formatDate(c.cycleStartDate)} — {formatDate(c.cycleEndDate)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Total Bill:{" "}
                <span className="font-medium text-gray-700">
                  PKR {c.totalAmount}
                </span>
              </div>
            </div>
            <Badge status={c.status} />
          </div>

          {/* Payment Status Bar */}
          <div className="flex items-center gap-4 text-xs mb-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Paid:</span>
              <span className="font-bold text-gray-900">
                PKR {c.amountPaid}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${c.amountPending > 0 ? "bg-red-500" : "bg-gray-300"}`}
              ></div>
              <span className="text-gray-600">Pending:</span>
              <span
                className={`font-bold ${c.amountPending > 0 ? "text-red-600" : "text-gray-400"}`}
              >
                PKR {c.amountPending}
              </span>
            </div>
          </div>

          {/* Outgoing Shifted Amount Notification (On the OLD Cycle) */}
          {c.shiftedAmount > 0 && (
            <div className="mb-3 bg-orange-50 border border-orange-100 rounded px-3 py-2 flex items-start gap-2">
              <CornerDownRight
                size={15}
                className="text-orange-500 mt-0.5 shrink-0"
              />
              <div className="text-xs text-orange-800">
                <span className="font-semibold block mb-0.5">
                  Unpaid Debt Shifted: PKR {c.shiftedAmount}
                </span>
                <span className="text-orange-600/90 text-[11px] leading-tight block">
                  This unpaid balance was moved to the next billing cycle.
                </span>
              </div>
            </div>
          )}

          {/* Incoming Previous Balance Notification (On the NEW Cycle) */}
          {c.previousBalance > 0 && (
            <div className="mb-3 bg-blue-50 border border-blue-100 rounded px-3 py-2 flex items-start gap-2">
              <AlertCircle
                size={15}
                className="text-blue-500 mt-0.5 shrink-0"
              />
              <div className="text-xs text-blue-800">
                <span className="font-semibold block mb-0.5">
                  Includes Previous Debt: PKR {c.previousBalance}
                </span>
                <span className="text-blue-600/90 text-[11px] leading-tight block">
                  This cycle's total bill includes an unpaid balance carried
                  over from the previous cycle.
                </span>
              </div>
            </div>
          )}

          {/* Installments List */}
          {c.installments && c.installments.length > 0 ? (
            <div className="bg-gray-50 rounded-md p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Payments Log
              </p>
              {c.installments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex justify-between items-center text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      {formatDate(inst.datePaid)}
                    </span>
                    {inst.note && (
                      <span className="text-gray-400 italic">
                        ({inst.note})
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-gray-700">
                    PKR {inst.amountPaid}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded-md">
              No payments recorded yet.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
