import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  ArrowUpCircle,
  CheckCircle,
  AlertTriangle,
  Package,
  DollarSign,
  User,
  FileText,
  CreditCard,
} from "lucide-react";
import useInventoryStore from "../../store/useInventoryStore";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import { today } from "../../utils/dateUtils";

/**
 * BulkIssueStockModal
 * Issues multiple inventory items to a subscriber in one go.
 * Now tracks amountPaid so inventory dues flow into the Dashboard.
 *
 * Props:
 *  customer  – the subscriber object
 *  onClose   – callback to close the modal
 */
export default function BulkIssueStockModal({ customer, onClose }) {
  const inventoryItems = useInventoryStore((s) => s.items);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const addJob = useConnectionJobStore((s) => s.addJob);
  const nextId = useRef(2);

  const availableItems = inventoryItems.filter((i) => (i.inHand ?? 0) > 0);

  const [rows, setRows] = useState(() => [
    {
      id: 1,
      itemId: availableItems[0]?.id ?? "",
      qty: "",
      customRate: availableItems[0]
        ? String(availableItems[0].unitRate || "")
        : "",
    },
  ]);

  const [technicianName, setTechnicianName] = useState("");
  const [subscriberName, setSubscriberName] = useState(
    customer?.fullName || "",
  );
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [issuedSummary, setIssuedSummary] = useState([]);
  const [finalPaid, setFinalPaid] = useState(0);
  const [finalPending, setFinalPending] = useState(0);

  // ── Row helpers ──────────────────────────────────────────────────────────────

  const addRow = () => {
    const firstUnused = availableItems.find(
      (i) => !rows.some((r) => r.itemId === i.id),
    );
    const item = firstUnused || availableItems[0];
    setRows((prev) => [
      ...prev,
      {
        id: nextId.current++,
        itemId: item?.id ?? "",
        qty: "",
        customRate: item ? String(item.unitRate || "") : "",
      },
    ]);
  };

  const removeRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const updateRow = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (field === "itemId") {
          const item = inventoryItems.find((i) => i.id === Number(value));
          return {
            ...r,
            itemId: Number(value),
            customRate: item ? String(item.unitRate || "") : "",
          };
        }
        return { ...r, [field]: value };
      }),
    );
    setError("");
  };

  // ── Derived totals ───────────────────────────────────────────────────────────

  const grandTotal = rows.reduce((sum, r) => {
    const item = inventoryItems.find((i) => i.id === r.itemId);
    if (!item) return sum;
    const qty = Number(r.qty) || 0;
    const rate = Number(r.customRate) || item.unitRate || 0;
    return sum + qty * rate;
  }, 0);

  const paid = Math.min(grandTotal, Math.max(0, Number(amountPaid) || 0));
  const remaining = Math.max(0, grandTotal - paid);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError("");

    if (rows.length === 0) {
      setError("Add at least one item to issue.");
      return;
    }

    for (const r of rows) {
      const item = inventoryItems.find((i) => i.id === r.itemId);
      if (!item) {
        setError("Please select a valid item for every row.");
        return;
      }
      const qty = Number(r.qty);
      if (!qty || qty <= 0) {
        setError(`Enter a quantity > 0 for "${item.description}".`);
        return;
      }
      if (qty > (item.inHand ?? 0)) {
        setError(
          `Only ${item.inHand} ${item.unit}(s) available for "${item.description}".`,
        );
        return;
      }
      const rate = Number(r.customRate) || item.unitRate || 0;
      if (!rate || rate <= 0) {
        setError(`Per-unit price must be > 0 for "${item.description}".`);
        return;
      }
    }

    const selectedIds = rows.map((r) => r.itemId);
    if (new Set(selectedIds).size !== selectedIds.length) {
      setError(
        "You have selected the same item more than once. Remove duplicates.",
      );
      return;
    }

    setSaving(true);
    try {
      const summary = [];
      const issuedItems = [];

      for (const r of rows) {
        const item = inventoryItems.find((i) => i.id === r.itemId);
        const qty = Number(r.qty);
        const rate = Number(r.customRate) || item.unitRate || 0;
        const rowTotal = qty * rate;

        const newStockOut = (item.stockOut || 0) + qty;
        const newInHand = (item.stockIn || 0) - newStockOut;

        const logEntry = {
          date,
          qty,
          unitRate: rate,
          totalValue: rowTotal,
          issuedTo: technicianName.trim() || null,
          subscriberName: subscriberName.trim() || null,
          subscriberUsername: customer?.userName || null,
          subscriberId: customer?.id ?? null,
          note: note.trim() || null,
          balanceAfter: newInHand,
          createdAt: new Date().toISOString(),
        };

        const existingLog = Array.isArray(item.issueLog) ? item.issueLog : [];

        await updateItem(item.id, {
          ...item,
          stockOut: newStockOut,
          inHand: newInHand,
          balanced: newInHand,
          issued: newStockOut,
          issueLog: [...existingLog, logEntry],
        });

        summary.push({
          description: item.description,
          unit: item.unit,
          qty,
          rate,
          total: rowTotal,
          purchaseCost: item.unitRate || 0,
        });

        issuedItems.push({
          inventoryItemId: item.id,
          description: item.description,
          unit: item.unit,
          qty,
          unitRate: rate,
          purchaseCost: item.unitRate || 0,
          totalValue: rowTotal,
        });
      }

      const jobGrandTotal = issuedItems.reduce((s, i) => s + i.totalValue, 0);
      const paidAmt = Math.min(
        jobGrandTotal,
        Math.max(0, Number(amountPaid) || 0),
      );
      const pendingAmt = Math.max(0, jobGrandTotal - paidAmt);

      await addJob({
        date,
        technicianName: technicianName.trim() || null,
        subscriberName: subscriberName.trim() || customer?.fullName || null,
        subscriberUsername: customer?.userName || null,
        subscriberId: customer?.id ?? null,
        note: note.trim() || null,
        items: issuedItems,
        totalValue: jobGrandTotal,
        amountPaid: paidAmt,
        amountPending: pendingAmt,
      });

      setFinalPaid(paidAmt);
      setFinalPending(pendingAmt);
      setIssuedSummary(summary);
      setDone(true);
    } catch (err) {
      setError("Failed to issue stock: " + err.message);
    }
    setSaving(false);
  };

  // ── Success State ────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">Stock Issued!</p>
          <p className="text-sm text-gray-500 mt-1">
            Items issued to{" "}
            <span className="font-semibold text-gray-800">
              {subscriberName || customer?.fullName}
            </span>
            {customer?.userName && (
              <span className="text-gray-400"> (@{customer.userName})</span>
            )}
          </p>
        </div>

        <div className="w-full bg-gray-50 border border-gray-200 rounded-xl overflow-hidden text-left">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs font-semibold uppercase">
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-center">Qty</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {issuedSummary.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {row.description}
                    {row.rate !== row.purchaseCost && row.purchaseCost > 0 && (
                      <span className="ml-1 text-[10px] text-blue-500 font-normal">
                        (cost PKR {row.purchaseCost})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-600">
                    {row.qty} {row.unit}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    PKR {row.rate.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">
                    PKR {row.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td
                  colSpan={3}
                  className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase"
                >
                  Grand Total
                </td>
                <td className="px-4 py-2 text-right font-bold text-red-700">
                  PKR{" "}
                  {issuedSummary
                    .reduce((s, r) => s + r.total, 0)
                    .toLocaleString()}
                </td>
              </tr>
              {finalPaid > 0 && (
                <tr className="border-t border-green-100 bg-green-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-right text-xs font-bold text-green-600 uppercase"
                  >
                    Paid Now
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-green-700">
                    PKR {finalPaid.toLocaleString()}
                  </td>
                </tr>
              )}
              {finalPending > 0 && (
                <tr className="border-t border-amber-100 bg-amber-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-right text-xs font-bold text-amber-600 uppercase"
                  >
                    Still Pending
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-amber-700">
                    PKR {finalPending.toLocaleString()}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <button
          onClick={onClose}
          className="px-8 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors mt-1"
        >
          Done
        </button>
      </div>
    );
  }

  // ── No Stock Available ───────────────────────────────────────────────────────

  if (availableItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <Package size={36} className="text-gray-300" />
        <p className="text-gray-500 text-sm font-medium">
          No inventory items with stock available.
        </p>
        <p className="text-gray-400 text-xs">
          Restock items in the Inventory tab first.
        </p>
        <button
          onClick={onClose}
          className="mt-2 px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Form State ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Date + Technician ── */}
      <div className="grid grid-cols-2 gap-3">
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
            value={technicianName}
            onChange={(e) => setTechnicianName(e.target.value)}
          />
        </div>
      </div>

      {/* ── Subscriber identity (read-only if from customer row) ── */}
      {customer?.userName && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <User size={13} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">
              {customer.fullName}
            </div>
            <div className="text-[11px] text-blue-600 font-mono font-medium">
              @{customer.userName}
            </div>
          </div>
          <div className="ml-auto text-[10px] text-gray-400 shrink-0">
            Linked by username
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <User size={12} /> Subscriber Name
              <span className="font-normal text-gray-400">(optional)</span>
            </span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="e.g. Ahmed Ali"
            value={subscriberName}
            onChange={(e) => setSubscriberName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <FileText size={12} /> Note
              <span className="font-normal text-gray-400">(optional)</span>
            </span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="e.g. New connection at Gulshan..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* ── Items table ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
            Items to Issue
          </label>
          {rows.length < availableItems.length && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus size={13} /> Add Item
            </button>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-0 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
            <span>Item</span>
            <span>Quantity</span>
            <span className="flex items-center gap-1">
              <DollarSign size={11} /> Per Unit (PKR)
            </span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const selectedItem = inventoryItems.find(
                (i) => i.id === row.itemId,
              );
              const inHand = selectedItem?.inHand ?? 0;
              const rate =
                Number(row.customRate) || selectedItem?.unitRate || 0;
              const qty = Number(row.qty) || 0;
              const rowTotal = qty * rate;
              const isOverIssue = qty > inHand;
              const hasProfit =
                selectedItem &&
                Number(row.customRate) > 0 &&
                Number(row.customRate) !== selectedItem.unitRate;

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[2fr_1fr_1.5fr_auto] gap-2 items-center px-3 py-3 ${
                    isOverIssue ? "bg-red-50" : ""
                  }`}
                >
                  {/* Item selector */}
                  <div>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                      value={row.itemId}
                      onChange={(e) =>
                        updateRow(row.id, "itemId", e.target.value)
                      }
                    >
                      {availableItems.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={rows.some(
                            (r) => r.id !== row.id && r.itemId === item.id,
                          )}
                        >
                          {item.description} ({item.inHand} {item.unit})
                        </option>
                      ))}
                    </select>
                    {selectedItem && (
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-0.5">
                        Cost: PKR {selectedItem.unitRate}/unit · In hand:{" "}
                        <span
                          className={`font-semibold ${
                            inHand === 0 ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {inHand}
                        </span>{" "}
                        {selectedItem.unit}
                        {qty > 0 && rate > 0 && (
                          <span className="text-gray-500 ml-1">
                            · PKR {rowTotal.toLocaleString()}
                          </span>
                        )}
                        {hasProfit && qty > 0 && (
                          <span className="text-blue-500 ml-1 font-medium">
                            (profit PKR{" "}
                            {(
                              (Number(row.customRate) - selectedItem.unitRate) *
                              qty
                            ).toLocaleString()}
                            )
                          </span>
                        )}
                      </p>
                    )}
                    {isOverIssue && (
                      <p className="text-[10px] text-red-600 font-semibold mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={10} /> Exceeds available stock
                      </p>
                    )}
                  </div>

                  {/* Quantity */}
                  <input
                    type="number"
                    min="1"
                    max={inHand}
                    placeholder={`Max ${inHand}`}
                    className={`border rounded-lg px-2 h-9 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full ${
                      isOverIssue
                        ? "border-red-400 bg-red-50"
                        : "border-gray-300"
                    }`}
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                    autoFocus={idx === 0}
                    onKeyDown={(e) =>
                      ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
                    }
                  />

                  {/* Per unit price */}
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">
                      PKR
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder={
                        selectedItem ? String(selectedItem.unitRate || 0) : "0"
                      }
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-2 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={row.customRate}
                      onChange={(e) =>
                        updateRow(row.id, "customRate", e.target.value)
                      }
                      onKeyDown={(e) =>
                        ["-", "+", "e", "E"].includes(e.key) &&
                        e.preventDefault()
                      }
                    />
                  </div>

                  {/* Remove row */}
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove this item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Grand Total footer */}
          {grandTotal > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-t border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Grand Total
              </span>
              <span className="text-sm font-bold text-red-600">
                PKR {grandTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {rows.length < availableItems.length && (
          <button
            onClick={addRow}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            <Plus size={14} /> Add Another Item
          </button>
        )}
      </div>

      {/* ── Payment Section ── always visible ── */}
      <div
        className={`border rounded-xl p-4 space-y-3 transition-all ${grandTotal > 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50 opacity-60"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard
              size={14}
              className={grandTotal > 0 ? "text-blue-600" : "text-gray-400"}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wide ${grandTotal > 0 ? "text-blue-700" : "text-gray-400"}`}
            >
              Payment Received (for Inventory)
            </span>
          </div>
          {grandTotal > 0 && (
            <span className="text-xs font-semibold text-gray-600">
              Total:{" "}
              <span className="text-red-600 font-bold">
                PKR {grandTotal.toLocaleString()}
              </span>
            </span>
          )}
          {grandTotal === 0 && (
            <span className="text-[10px] text-gray-400">
              Fill items above first
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Amount Paid by Subscriber
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">
                PKR
              </span>
              <input
                type="number"
                min="0"
                max={grandTotal || undefined}
                disabled={grandTotal === 0}
                placeholder={
                  grandTotal > 0 ? "0  (leave blank = not paid)" : "—"
                }
                className={`w-full border rounded-lg pl-10 pr-2 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  grandTotal === 0
                    ? "bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400"
                    : "bg-white border-blue-200"
                }`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                onKeyDown={(e) =>
                  ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
                }
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Enter 0 or leave blank if subscriber hasn't paid yet.
            </p>
          </div>

          <div className="space-y-1.5 pt-6">
            {grandTotal > 0 && paid === 0 && (
              <div className="flex justify-between text-xs bg-amber-100 rounded-lg px-3 py-2">
                <span className="text-amber-700 font-medium">
                  ⏳ Not paid yet
                </span>
                <span className="font-bold text-amber-800">
                  PKR {grandTotal.toLocaleString()} due
                </span>
              </div>
            )}
            {paid > 0 && remaining > 0 && (
              <>
                <div className="flex justify-between text-xs bg-green-100 rounded-lg px-3 py-2">
                  <span className="text-green-700 font-medium">✓ Paid Now</span>
                  <span className="font-bold text-green-800">
                    PKR {paid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs bg-amber-100 rounded-lg px-3 py-2">
                  <span className="text-amber-700 font-medium">
                    ⏳ Still Pending
                  </span>
                  <span className="font-bold text-amber-800">
                    PKR {remaining.toLocaleString()}
                  </span>
                </div>
              </>
            )}
            {remaining === 0 && grandTotal > 0 && paid > 0 && (
              <div className="flex justify-between text-xs bg-green-100 rounded-lg px-3 py-2 border border-green-200">
                <span className="text-green-700 font-medium">
                  ✅ Fully Paid
                </span>
                <span className="font-bold text-green-800">
                  PKR {grandTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
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
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? (
            "Issuing..."
          ) : (
            <>
              <ArrowUpCircle size={15} />
              Issue {rows.length > 1 ? `${rows.length} Items` : "Stock"}
              {grandTotal > 0 && ` · PKR ${grandTotal.toLocaleString()}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
