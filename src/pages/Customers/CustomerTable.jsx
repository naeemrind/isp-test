import { Pencil, Trash2, CreditCard, History } from "lucide-react";
import Badge from "../../components/ui/Badge";
import WhatsAppButton from "../../components/shared/WhatsAppButton";
import { formatDate, daysUntil } from "../../utils/dateUtils";
import { MESSAGE_TEMPLATES } from "../../config/messageTemplates";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";

export default function CustomerTable({
  customers,
  onEdit,
  onPay,
  onDelete,
  onHistory,
  searchQuery,
}) {
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);
  const packages = usePackageStore((s) => s.packages);

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
                      <div className="text-xs font-semibold text-gray-700">
                        {formatDate(cycle.cycleEndDate)}
                      </div>
                      <div
                        className={`text-xs ${days < 0 ? "text-red-600 font-bold" : days <= 3 ? "text-yellow-700 font-bold" : "text-gray-400"}`}
                      >
                        {days < 0
                          ? `${Math.abs(days)}d overdue`
                          : days === 0
                            ? "Expires today"
                            : `${days + 1}d left`}{" "}
                        {/* Added +1 for Inclusive Count */}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {cycle && cycle.amountPending > 0 ? (
                    <span className="text-red-600 font-medium">
                      PKR {cycle.amountPending.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-green-600 text-xs font-bold">
                      Paid
                    </span>
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
                    <button
                      onClick={() => onPay(customer)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 transition-colors"
                      title="Record Payment"
                    >
                      <CreditCard size={13} /> Pay
                    </button>

                    <button
                      onClick={() => onEdit(customer)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-gray-700 rounded hover:bg-gray-50 border border-gray-300 transition-colors"
                      title="Edit Customer"
                    >
                      <Pencil size={13} /> Edit
                    </button>

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

                    <button
                      onClick={() => onHistory(customer)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300 transition-colors"
                      title="View Payment History"
                    >
                      <History size={13} />
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
  );
}
