import { useState } from "react";
import {
  ArrowDownCircle,
  Package,
  FileText,
  CheckCircle,
  AlertTriangle,
  History,
  TrendingUp,
} from "lucide-react";
import useInventoryStore from "../../store/useInventoryStore";
import { today } from "../../utils/dateUtils";

/**
 * RestockModal
 * Allows adding a new bulk purchase to an existing inventory item.
 * Updates stockIn, quantity, inHand, and appends to restockLog.
 *
 * Props:
 *  item          – the inventory item object (required)
 *  onClose       – callback to close the modal
 *  onViewHistory – optional callback to open restock history
 */
export default function RestockModal({ item, onClose, onViewHistory }) {
  const restockItem = useInventoryStore((s) => s.restockItem);

  const [qty, setQty] = useState("");
  const [unitRate, setUnitRate] = useState(String(item.unitRate || ""));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const addedQty = Number(qty) || 0;
  const newRate = Number(unitRate) || item.unitRate || 0;
  const newInHand = (item.inHand || 0) + addedQty;
  const addedValue = addedQty * newRate;

  // Weighted average rate preview
  const oldValue = (item.inHand || 0) * (item.unitRate || 0);
  const newAvgRate =
    newInHand > 0 ? Math.round((oldValue + addedValue) / newInHand) : newRate;

  const restockLogCount = Array.isArray(item.restockLog)
    ? item.restockLog.length
    : 0;

  const handleSubmit = async () => {
    setError("");
    if (!addedQty || addedQty <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    if (!newRate || newRate <= 0) {
      setError("Enter a valid unit rate.");
      return;
    }

    setSaving(true);
    try {
      await restockItem(item.id, {
        qty: addedQty,
        unitRate: newRate,
        invoiceNo,
        date,
        note,
      });
      setDone(true);
    } catch (err) {
      setError("Failed to restock: " + err.message);
    }
    setSaving(false);
  };

  // ── Success State ──
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">Stock Restocked!</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-green-600">
              +{addedQty} {item.unit}
            </span>{" "}
            added to <span className="font-semibold">{item.description}</span>.
            <br />
            <span className="text-gray-400">
              New in hand:{" "}
              <span className="font-semibold text-gray-600">
                {newInHand} {item.unit}
              </span>
            </span>
          </p>
        </div>
        <div className="flex gap-3 mt-1">
          {onViewHistory && (
            <button
              onClick={() => {
                onClose();
                onViewHistory();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <History size={14} /> View History
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Item Summary ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Package size={16} className="text-blue-600" />
          <div>
            <p className="font-bold text-gray-900">{item.description}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Unit: <span className="font-semibold">{item.unit}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-center">
          <div>
            <p className="text-xs text-gray-400 font-medium">Current In Hand</p>
            <p className="text-lg font-black text-green-600">
              {item.inHand ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Current Rate</p>
            <p className="text-lg font-black text-gray-700">
              PKR {(item.unitRate || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Restock Details ── */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
          <ArrowDownCircle size={13} className="text-green-600" />
          New Stock Purchase
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Purchase Date
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Invoice No */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Invoice No{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={invoiceNo}
              placeholder="e.g. INV-045"
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Qty to Add <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <ArrowDownCircle
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none"
              />
              <input
                type="number"
                min="1"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={qty}
                placeholder={`How many ${item.unit}s purchased?`}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Unit Rate */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Unit Rate (PKR) <span className="text-red-500">*</span>
              {newRate !== item.unitRate && item.unitRate > 0 && (
                <span className="ml-1 font-normal text-amber-500">
                  (was PKR {item.unitRate})
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                PKR
              </span>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg pl-12 pr-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={unitRate}
                placeholder="Cost per unit"
                onChange={(e) => setUnitRate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Note{" "}
            <span className="font-normal text-gray-400">
              (optional — supplier, location…)
            </span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={note}
            placeholder="e.g. Bought from Ali Traders, Lahore"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* ── Live Preview ── */}
      {addedQty > 0 && newRate > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp size={13} /> After Restock Preview
          </p>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-white rounded-lg py-2 border border-green-100">
              <p className="text-xs text-gray-400 font-medium">In Hand</p>
              <p className="font-black text-green-600 text-base">
                {newInHand} {item.unit}
              </p>
            </div>
            <div className="bg-white rounded-lg py-2 border border-green-100">
              <p className="text-xs text-gray-400 font-medium">Avg Rate</p>
              <p className="font-black text-gray-700 text-base">
                PKR {newAvgRate.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg py-2 border border-green-100">
              <p className="text-xs text-gray-400 font-medium">This Purchase</p>
              <p className="font-black text-blue-600 text-base">
                PKR {addedValue.toLocaleString()}
              </p>
            </div>
          </div>
          {newRate !== item.unitRate && item.unitRate > 0 && (
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle size={11} />
              Rate changed — unit cost will update to weighted average PKR{" "}
              {newAvgRate.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex justify-between items-center gap-3 pt-1 border-t border-gray-100">
        <div className="text-xs text-gray-400">
          {restockLogCount > 0
            ? `${restockLogCount} previous restock${restockLogCount !== 1 ? "s" : ""} recorded`
            : "First restock for this item"}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !addedQty || !newRate}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <ArrowDownCircle size={14} />
            {saving ? "Saving..." : "Confirm Restock"}
          </button>
        </div>
      </div>
    </div>
  );
}
