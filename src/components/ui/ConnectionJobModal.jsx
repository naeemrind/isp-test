import { useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Package,
  User,
  Wrench,
  FileText,
  ChevronDown,
  Zap,
} from "lucide-react";
import useInventoryStore from "../../store/useInventoryStore";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import useCustomerStore from "../../store/useCustomerStore";
import { today } from "../../utils/dateUtils";

/**
 * ConnectionJobModal
 * Issues multiple inventory items at once for a new connection.
 * Saves a "connection job" record for full traceability.
 * Each item issued is also logged into the inventory item's own issueLog.
 */
export default function ConnectionJobModal({ onClose }) {
  const inventoryItems = useInventoryStore((s) => s.items);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const addJob = useConnectionJobStore((s) => s.addJob);
  const customers = useCustomerStore((s) => s.customers);

  const [date, setDate] = useState(today());
  const [technicianName, setTechnicianName] = useState("");
  const [subscriberQuery, setSubscriberQuery] = useState("");
  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [showSubscriberDropdown, setShowSubscriberDropdown] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([]); // array of { itemId, qty, customRate }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedJob, setSavedJob] = useState(null);

  // Subscriber search — filters active customers
  const activeCustomers = customers.filter((c) => !c.isArchived);
  const filteredSubscribers = subscriberQuery.trim()
    ? activeCustomers.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(subscriberQuery.toLowerCase()) ||
          c.userName?.toLowerCase().includes(subscriberQuery.toLowerCase()),
      )
    : activeCustomers.slice(0, 8);

  const selectSubscriber = (c) => {
    setSelectedSubscriber(c);
    setSubscriberQuery(c.fullName + (c.userName ? ` (${c.userName})` : ""));
    setShowSubscriberDropdown(false);
  };

  // Available items (in stock only)
  const availableItems = inventoryItems.filter((i) => (i.inHand ?? 0) > 0);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), itemId: "", qty: "", customRate: "" },
    ]);
  };

  const removeLine = (id) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setErrors((prev) => {
      const e = { ...prev };
      delete e[`item_${id}`];
      delete e[`qty_${id}`];
      return e;
    });
  };

  const updateLine = (id, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Auto-fill rate when item is selected
        if (field === "itemId") {
          const item = inventoryItems.find((i) => i.id === Number(value));
          updated.customRate = item ? String(item.unitRate) : "";
        }
        return updated;
      }),
    );
    setErrors((prev) => {
      const e = { ...prev };
      delete e[`${field}_${id}`];
      return e;
    });
  };

  // Derived totals
  const lineDetails = lines.map((l) => {
    const item = inventoryItems.find((i) => i.id === Number(l.itemId));
    const qty = Number(l.qty) || 0;
    const rate = Number(l.customRate) || (item ? item.unitRate : 0);
    const total = qty * rate;
    const inHand = item ? (item.inHand ?? 0) : 0;
    const overIssue = qty > inHand;
    return { ...l, item, qty, rate, total, inHand, overIssue };
  });

  const grandTotal = lineDetails.reduce((s, l) => s + l.total, 0);

  const validate = () => {
    const e = {};
    if (lines.length === 0) e.general = "Add at least one item to issue.";
    lineDetails.forEach((l) => {
      if (!l.itemId) e[`item_${l.id}`] = "Select an item";
      if (!l.qty || l.qty <= 0) e[`qty_${l.id}`] = "Enter qty > 0";
      if (l.overIssue) e[`qty_${l.id}`] = `Max available: ${l.inHand}`;
      if (!l.rate || l.rate <= 0) e[`rate_${l.id}`] = "Rate must be > 0";
    });
    // Check for duplicate items
    const itemIds = lineDetails.filter((l) => l.itemId).map((l) => l.itemId);
    const seen = new Set();
    itemIds.forEach((id) => {
      if (seen.has(id))
        e.general = "Duplicate items detected. Use one line per item.";
      seen.add(id);
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // 1. Issue each item from inventory
      const issuedItems = [];
      for (const l of lineDetails) {
        const item = l.item;
        const existingLog = Array.isArray(item.issueLog) ? item.issueLog : [];
        const newStockOut = (item.stockOut || 0) + l.qty;
        const newInHand = (item.stockIn || 0) - newStockOut;

        const logEntry = {
          date,
          qty: l.qty,
          issuedTo: technicianName.trim() || null,
          subscriberName: selectedSubscriber
            ? selectedSubscriber.fullName
            : null,
          subscriberUsername: selectedSubscriber
            ? selectedSubscriber.userName
            : null,
          note: note.trim() || "Connection Job",
          balanceAfter: newInHand,
          unitRate: l.rate,
          totalValue: l.total,
          jobRef: true, // marks this was part of a connection job
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

        issuedItems.push({
          inventoryItemId: item.id,
          description: item.description,
          unit: item.unit,
          qty: l.qty,
          unitRate: l.rate,
          totalValue: l.total,
        });
      }

      // 2. Save the connection job record
      const job = await addJob({
        date,
        technicianName: technicianName.trim() || null,
        subscriberName: selectedSubscriber ? selectedSubscriber.fullName : null,
        subscriberUsername: selectedSubscriber
          ? selectedSubscriber.userName
          : null,
        subscriberId: selectedSubscriber ? selectedSubscriber.id : null,
        note: note.trim() || null,
        items: issuedItems,
        totalValue: grandTotal,
      });

      setSavedJob(job);
      setDone(true);
    } catch (err) {
      setErrors({ general: "Failed to save: " + err.message });
    }
    setSaving(false);
  };

  // ── Success State ──────────────────────────────────────────────────────────
  if (done && savedJob) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              Connection Job Saved!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {savedJob.items.length} item
              {savedJob.items.length !== 1 ? "s" : ""} issued
              {savedJob.subscriberName ? ` for ${savedJob.subscriberName}` : ""}
            </p>
          </div>
        </div>

        {/* Job Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-semibold">{savedJob.date}</span>
          </div>
          {savedJob.technicianName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Technician</span>
              <span className="font-semibold">{savedJob.technicianName}</span>
            </div>
          )}
          {savedJob.subscriberName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subscriber</span>
              <span className="font-semibold">
                {savedJob.subscriberName}
                {savedJob.subscriberUsername && (
                  <span className="text-gray-400 font-normal ml-1">
                    ({savedJob.subscriberUsername})
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3 space-y-1.5">
            {savedJob.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.description}
                  <span className="text-gray-400 ml-1">
                    × {item.qty} {item.unit}
                  </span>
                </span>
                <span className="font-semibold text-gray-800">
                  PKR {item.totalValue.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-300 pt-2 flex justify-between font-bold">
              <span className="text-gray-800">Total Material Value</span>
              <span className="text-green-700">
                PKR {savedJob.totalValue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <p className="font-semibold mb-1">💡 Next Step</p>
          <p>
            When you record this subscriber's first payment, include the
            material cost (PKR {savedJob.totalValue.toLocaleString()}) together
            with the package fee as one combined amount.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Top details */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <Wrench size={11} className="inline mr-1 text-gray-400" />
            Technician Name
          </label>
          <input
            type="text"
            placeholder="e.g. Ali"
            value={technicianName}
            onChange={(e) => setTechnicianName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Subscriber picker */}
      <div className="relative">
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          <User size={11} className="inline mr-1 text-gray-400" />
          Subscriber (name or username)
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search subscriber by name or username…"
            value={subscriberQuery}
            onChange={(e) => {
              setSubscriberQuery(e.target.value);
              setSelectedSubscriber(null);
              setShowSubscriberDropdown(true);
            }}
            onFocus={() => setShowSubscriberDropdown(true)}
            className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
          />
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
        {showSubscriberDropdown && filteredSubscribers.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
            {filteredSubscribers.map((c) => (
              <button
                key={c.id}
                onMouseDown={() => selectSubscriber(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-3 border-b border-gray-100 last:border-0"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User size={13} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{c.fullName}</p>
                  {c.userName && (
                    <p className="text-xs text-gray-400">{c.userName}</p>
                  )}
                </div>
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {c.status}
                </span>
              </button>
            ))}
          </div>
        )}
        {showSubscriberDropdown &&
          subscriberQuery &&
          filteredSubscribers.length === 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400">
              No subscribers match "{subscriberQuery}"
            </div>
          )}
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          <FileText size={11} className="inline mr-1 text-gray-400" />
          Note (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. New connection Gulshan Block 5"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Items section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
            <Package size={11} className="inline mr-1 text-gray-400" />
            Items to Issue
          </label>
          <button
            onClick={addLine}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={12} /> Add Item
          </button>
        </div>

        {lines.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400">
            <Package size={24} className="opacity-40" />
            <p className="text-sm font-medium">No items added yet</p>
            <button
              onClick={addLine}
              className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
            >
              + Add first item
            </button>
          </div>
        )}

        <div className="space-y-2">
          {lineDetails.map((l) => {
            const usedItemIds = lineDetails
              .filter((x) => x.id !== l.id && x.itemId)
              .map((x) => Number(x.itemId));
            const itemOptions = availableItems.filter(
              (i) => !usedItemIds.includes(i.id),
            );

            return (
              <div
                key={l.id}
                className={`border rounded-xl p-3 space-y-2 ${l.overIssue ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}
              >
                <div className="flex items-center gap-2">
                  {/* Item select */}
                  <div className="flex-1">
                    <select
                      value={l.itemId}
                      onChange={(e) =>
                        updateLine(l.id, "itemId", e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`item_${l.id}`] ? "border-red-400" : "border-gray-300"}`}
                    >
                      <option value="">-- Select item --</option>
                      {itemOptions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.description} ({i.inHand} {i.unit} available)
                        </option>
                      ))}
                    </select>
                    {errors[`item_${l.id}`] && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors[`item_${l.id}`]}
                      </p>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={l.qty}
                      onChange={(e) => updateLine(l.id, "qty", e.target.value)}
                      className={`w-full border rounded-lg px-2 h-9 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`qty_${l.id}`] ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    />
                    {errors[`qty_${l.id}`] && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors[`qty_${l.id}`]}
                      </p>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeLine(l.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Rate + total (only if item selected) */}
                {l.item && (
                  <div className="flex items-center gap-3 pl-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">PKR</span>
                      <input
                        type="number"
                        min="1"
                        value={l.customRate}
                        onChange={(e) =>
                          updateLine(l.id, "customRate", e.target.value)
                        }
                        className={`w-24 border rounded-lg px-2 h-8 text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`rate_${l.id}`] ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      />
                      <span className="text-xs text-gray-400">
                        per {l.item.unit}
                      </span>
                      {l.rate !== l.item.unitRate && l.rate > 0 && (
                        <span className="text-xs text-amber-600 font-semibold">
                          (custom)
                        </span>
                      )}
                    </div>
                    {l.qty > 0 && l.rate > 0 && (
                      <span className="ml-auto text-sm font-bold text-gray-800">
                        = PKR {l.total.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {l.overIssue && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                    <AlertTriangle size={12} /> Only {l.inHand} {l.item?.unit}{" "}
                    available in warehouse
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grand total */}
      {lines.length > 0 && grandTotal > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">
              Total Material Value
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              To be collected from subscriber along with package fee
            </p>
          </div>
          <p className="text-xl font-black text-green-700">
            PKR {grandTotal.toLocaleString()}
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.general && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle size={14} /> {errors.general}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || lines.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              <Zap size={15} />
              Issue All Items
              {grandTotal > 0 && (
                <span className="opacity-80">
                  · PKR {grandTotal.toLocaleString()}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
