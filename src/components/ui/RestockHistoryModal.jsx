import {
  ArrowDownCircle,
  Package,
  FileText,
  Calendar,
  Inbox,
  Star,
} from "lucide-react";
import { formatDate } from "../../utils/dateUtils";

/**
 * RestockHistoryModal
 * Shows the original purchase + all restock events in a single timeline.
 *
 * Props:
 *  item    – the inventory item object
 *  onClose – callback to close
 */
export default function RestockHistoryModal({ item, onClose }) {
  // Restock log entries (newest first after reverse)
  const restockLog = Array.isArray(item.restockLog)
    ? [...item.restockLog].reverse()
    : [];

  // Build the original purchase entry from the item itself
  const originalEntry = {
    _isOriginal: true,
    date: item.date,
    qty: item.quantity || 0,
    unitRate: item.unitRate || 0,
    invoiceNo: item.invoiceNo || null,
    poNo: item.poNo || null,
    note: item.remarks || null,
    inHandAfter: null, // we don't know the exact state at creation
  };

  // Full timeline: restocks newest-first, original at the bottom
  const timeline = [...restockLog, originalEntry];

  // Totals include original purchase + all restocks
  const totalAllQty =
    (item.quantity || 0) + restockLog.reduce((sum, e) => sum + (e.qty || 0), 0);
  const totalAllSpent =
    (item.quantity || 0) * (item.unitRate || 0) +
    restockLog.reduce((sum, e) => sum + (e.qty || 0) * (e.unitRate || 0), 0);

  return (
    <div className="space-y-4">
      {/* Item summary bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Package size={16} className="text-gray-500" />
          <div>
            <p className="font-bold text-gray-900">{item.description}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Unit:{" "}
              <span className="font-semibold text-gray-700">{item.unit}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-center">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Purchased</p>
            <p className="text-lg font-black text-green-600">+{totalAllQty}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Spent</p>
            <p className="text-lg font-black text-blue-600">
              PKR {totalAllSpent.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Purchases</p>
            <p className="text-lg font-black text-gray-700">
              {timeline.length}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-4.75 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-3">
          {timeline.map((entry, idx) => {
            const isOriginal = entry._isOriginal;
            const purchaseValue = (entry.qty || 0) * (entry.unitRate || 0);

            return (
              <div key={idx} className="flex gap-3 relative">
                {/* Timeline dot */}
                <div className="shrink-0 w-10 flex justify-center pt-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 ${
                      isOriginal
                        ? "bg-blue-100 border-blue-400"
                        : "bg-green-100 border-green-400"
                    }`}
                  >
                    {isOriginal ? (
                      <Star size={9} className="text-blue-600" />
                    ) : (
                      <ArrowDownCircle size={10} className="text-green-600" />
                    )}
                  </div>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 border rounded-xl px-4 py-3 shadow-sm mb-1 ${
                    isOriginal
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-black px-2.5 py-0.5 rounded-lg border ${
                          isOriginal
                            ? "bg-blue-100 border-blue-200 text-blue-700"
                            : "bg-green-50 border-green-200 text-green-700"
                        }`}
                      >
                        + {entry.qty} {item.unit}
                      </span>
                      <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-lg">
                        PKR {(entry.unitRate || 0).toLocaleString()}/{item.unit}
                      </span>
                      {isOriginal && (
                        <span className="text-xs bg-blue-600 text-white font-semibold px-2 py-0.5 rounded-full">
                          Original Purchase
                        </span>
                      )}
                      {!isOriginal && idx === 0 && (
                        <span className="text-xs bg-green-600 text-white font-semibold px-2 py-0.5 rounded-full">
                          Latest Restock
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-medium whitespace-nowrap">
                      <Calendar size={11} />
                      {formatDate(entry.date)}
                    </span>
                  </div>

                  {/* Invoice / PO */}
                  {(entry.invoiceNo || entry.poNo) && (
                    <p className="flex items-center gap-1.5 text-sm text-gray-700 font-medium mt-2">
                      <FileText size={12} className="text-gray-400 shrink-0" />
                      {entry.invoiceNo && <>Invoice: {entry.invoiceNo}</>}
                      {entry.invoiceNo && entry.poNo && (
                        <span className="text-gray-300 mx-1">|</span>
                      )}
                      {entry.poNo && <>PO: {entry.poNo}</>}
                    </p>
                  )}

                  {/* Note / Remarks */}
                  {entry.note && (
                    <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-1.5 leading-relaxed">
                      <FileText
                        size={11}
                        className="text-gray-400 shrink-0 mt-0.5"
                      />
                      {entry.note}
                    </p>
                  )}

                  {/* Bottom row: purchase value + stock after */}
                  <div className="flex items-center justify-between mt-2 border-t border-gray-100 pt-1.5">
                    <p className="text-xs text-gray-400">
                      Purchase value:{" "}
                      <span className="font-semibold text-gray-600">
                        PKR {purchaseValue.toLocaleString()}
                      </span>
                    </p>
                    {!isOriginal && entry.inHandAfter != null && (
                      <p className="text-xs text-gray-400">
                        Stock after:{" "}
                        <span className="font-semibold text-gray-600">
                          {entry.inHandAfter} {item.unit}
                        </span>
                      </p>
                    )}
                    {isOriginal && (
                      <p className="text-xs text-blue-400 italic">
                        First stock entry
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total summary at bottom */}
        {timeline.length > 1 && (
          <div className="ml-10 mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">
              Total spent across all {timeline.length} purchases
            </span>
            <span className="font-bold text-blue-600">
              PKR {totalAllSpent.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Close */}
      <div className="flex justify-end pt-1 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
