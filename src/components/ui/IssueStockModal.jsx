import { useState } from "react";
import {
  ArrowUpCircle,
  Warehouse,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  History,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import useInventoryStore from "../../store/useInventoryStore";
import { today } from "../../utils/dateUtils";

/**
 * IssueStockModal
 * A focused modal for issuing stock out of a specific inventory item.
 * Supports custom per-unit price override (defaults to item's recorded rate).
 * Writes structured entries to item.issueLog (array) for full history tracking.
 *
 * Props:
 *  item          – the inventory item object (required)
 *  onClose       – callback to close the modal
 *  onViewHistory – optional callback to open the history modal
 */
export default function IssueStockModal({ item, onClose, onViewHistory }) {
  const updateItem = useInventoryStore((s) => s.updateItem);

  const [qty, setQty] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [subscriberName, setSubscriberName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [customRate, setCustomRate] = useState(String(item.unitRate || ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const currentInHand = item.inHand ?? 0;
  const issueQty = Number(qty) || 0;
  const effectiveRate = Number(customRate) || item.unitRate || 0;
  const remaining = currentInHand - issueQty;
  const totalIssueValue = issueQty * effectiveRate;

  const stockAfterPercent =
    item.quantity > 0 ? Math.max(0, (remaining / item.quantity) * 100) : 0;

  const barColor =
    remaining <= 0
      ? "bg-red-500"
      : stockAfterPercent <= 20
        ? "bg-amber-400"
        : "bg-green-500";

  const statusLabel =
    remaining < 0
      ? "Over-issuing!"
      : remaining === 0
        ? "Stock will be empty"
        : stockAfterPercent <= 20
          ? "Low stock after issue"
          : "Stock OK";

  const statusColor =
    remaining < 0
      ? "text-red-600"
      : remaining === 0
        ? "text-amber-600"
        : stockAfterPercent <= 20
          ? "text-amber-500"
          : "text-green-600";

  const existingLog = Array.isArray(item.issueLog) ? item.issueLog : [];
  const historyCount = existingLog.length;

  const handleSubmit = async () => {
    setError("");
    if (!issueQty || issueQty <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    if (issueQty > currentInHand) {
      setError(
        `Only ${currentInHand} ${item.unit}(s) available in hand. Cannot issue more.`,
      );
      return;
    }
    if (!effectiveRate || effectiveRate <= 0) {
      setError("Per-unit price must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const newStockOut = (item.stockOut || 0) + issueQty;
      const newInHand = (item.stockIn || 0) - newStockOut;

      // Build structured log entry — now includes rate & total value
      const logEntry = {
        date,
        qty: issueQty,
        unitRate: effectiveRate,
        totalValue: issueQty * effectiveRate,
        issuedTo: issuedTo.trim() || null,
        subscriberName: subscriberName.trim() || null,
        note: note.trim() || null,
        balanceAfter: newInHand,
        createdAt: new Date().toISOString(),
      };

      await updateItem(item.id, {
        ...item,
        stockOut: newStockOut,
        inHand: newInHand,
        balanced: newInHand,
        issued: newStockOut,
        issueLog: [...existingLog, logEntry],
      });
      setDone(true);
    } catch (err) {
      setError("Failed to issue stock: " + err.message);
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
          <p className="text-base font-bold text-gray-900">Stock Issued!</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-red-500">
              {issueQty} {item.unit}
            </span>{" "}
            of <span className="font-semibold">{item.description}</span> issued
            successfully.
            <br />
            <span className="text-gray-400">
              Total value:{" "}
              <span className="font-semibold text-gray-700">
                PKR {totalIssueValue.toLocaleString()}
              </span>
            </span>
            <br />
            <span className="text-gray-400">
              Remaining in hand:{" "}
              <span className="font-semibold text-gray-600">
                {remaining} {item.unit}
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
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Form State ──
  return (
    <div className="space-y-5">
      {/* ── Item Info Banner ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
            Item
          </p>
          <p className="font-bold text-gray-900 text-base">
            {item.description}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Unit:{" "}
            <span className="font-semibold text-gray-700">{item.unit}</span>
            {" · "}
            <span className="text-gray-400">
              Recorded rate: PKR {(item.unitRate || 0).toLocaleString()}
            </span>
          </p>
        </div>
        <div className="flex items-end gap-4">
          {/* History badge */}
          {historyCount > 0 && onViewHistory && (
            <button
              onClick={() => {
                onClose();
                onViewHistory();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <History size={13} />
              {historyCount} issue{historyCount !== 1 ? "s" : ""} logged
            </button>
          )}
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Available In Hand
            </p>
            <p
              className={`text-2xl font-black leading-tight ${
                currentInHand === 0 ? "text-red-500" : "text-green-600"
              }`}
            >
              {currentInHand}
            </p>
            <p className="text-xs text-gray-400">{item.unit}(s)</p>
          </div>
        </div>
      </div>

      {/* ── Out-of-stock warning ── */}
      {currentInHand === 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 font-medium">
          <AlertTriangle size={14} className="shrink-0" />
          This item is out of stock. No units can be issued.
        </div>
      )}

      {/* ── Qty + Date + Per Unit Price row ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Quantity to Issue <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max={currentInHand}
            disabled={currentInHand === 0}
            className={`w-full border rounded-lg px-3 h-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
              error && (!issueQty || issueQty > currentInHand)
                ? "border-red-400 bg-red-50"
                : "border-gray-300"
            }`}
            placeholder={`Max: ${currentInHand}`}
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError("");
            }}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            max={today()}
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Per Unit Price — full width */}
        <div className="col-span-2">
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <DollarSign size={12} /> Per Unit Price (PKR){" "}
              <span className="text-red-500">*</span>
              <span className="font-normal text-gray-400">
                — default is recorded purchase rate
              </span>
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
              PKR
            </span>
            <input
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg pl-12 pr-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={customRate}
              placeholder={`Default: ${item.unitRate || 0}`}
              onChange={(e) => {
                setCustomRate(e.target.value);
                setError("");
              }}
            />
          </div>
          {Number(customRate) !== item.unitRate && item.unitRate > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle size={11} />
              Rate changed from recorded PKR {item.unitRate?.toLocaleString()} —
              this only affects this issue entry, not the item record.
            </p>
          )}
        </div>
      </div>

      {/* ── Live Stock + Value Preview ── */}
      {issueQty > 0 && effectiveRate > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Stock After Issuing</span>
            <span className={statusColor}>{statusLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-gray-600">
              {currentInHand} →{" "}
              <span
                className={remaining < 0 ? "text-red-600" : "text-gray-900"}
              >
                {remaining}
              </span>{" "}
              <span className="font-normal text-gray-400">{item.unit}(s)</span>
            </span>
            <span className="text-xs text-gray-400">
              of {item.quantity} total
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{
                width: `${Math.max(0, Math.min(100, stockAfterPercent))}%`,
              }}
            />
          </div>
          {/* Total value of this issue */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <TrendingDown size={12} className="text-red-500" />
              Total value of this issue
            </span>
            <span className="text-sm font-bold text-red-600">
              PKR {totalIssueValue.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* ── Issued To (Technician) ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <User size={12} /> Technician Name
              <span className="font-normal text-gray-400">(optional)</span>
            </span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="e.g. Ali Technician"
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <User size={12} /> Subscriber Name
              <span className="font-normal text-gray-400">(optional)</span>
            </span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="e.g. Ahmed Ali (customer)"
            value={subscriberName}
            onChange={(e) => setSubscriberName(e.target.value)}
          />
        </div>
      </div>

      {/* ── Note ── */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          <span className="flex items-center gap-1.5">
            <FileText size={12} /> Note
            <span className="font-normal text-gray-400">(optional)</span>
          </span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="e.g. New connection at Gulshan, fiber repair..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 font-medium">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-1 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || currentInHand === 0}
          className="flex items-center gap-2 px-6 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? (
            "Issuing..."
          ) : (
            <>
              <ArrowUpCircle size={15} />
              Issue{" "}
              {issueQty > 0
                ? `${issueQty} ${item.unit} · PKR ${totalIssueValue.toLocaleString()}`
                : "Stock"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
