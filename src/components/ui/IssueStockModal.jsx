import { useState, useEffect, useRef } from "react";
import {
  ArrowUpCircle,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  History,
  DollarSign,
  TrendingDown,
  Wrench,
  Link2,
  Hammer,
  ChevronRight,
  CreditCard,
  Search,
  X,
} from "lucide-react";
import useInventoryStore from "../../store/useInventoryStore";
import useCustomerStore from "../../store/useCustomerStore";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import { today } from "../../utils/dateUtils";

/**
 * IssueStockModal — "Dispatch Stock"
 *
 * Step 1: Choose purpose — "connection" (New Subscriber) or "adhoc" (Ad-hoc)
 * Step 2: Fill dispatch form.
 *
 * Both modes support:
 *   - Linking to a subscriber (required for connection, optional for adhoc)
 *   - Amount Paid input (determines pending dues)
 *
 * Financial rules:
 *   - Connection dispatches: ALWAYS create a connectionJob (tracked in Inventory Dues)
 *   - Ad-hoc dispatches: ALWAYS create a connectionJob with dispatchType="adhoc"
 *       so that revenue, COGS, and balance-due are computed from the same table.
 *   - COGS: only counted once a job's amountPending === 0 (fully paid)
 *   - Revenue: only the amountPaid portion (partial payments count immediately)
 *   - Balance Due on Dashboard: subscription pending + all job amountPending
 */
export default function IssueStockModal({ item, onClose, onViewHistory }) {
  const updateItem = useInventoryStore((s) => s.updateItem);
  const customers = useCustomerStore((s) => s.customers);
  const addJob = useConnectionJobStore((s) => s.addJob);

  const activeCustomers = customers.filter((c) => !c.isArchived);

  // ── Step 1: purpose selection ──────────────────────────────────────────────
  const [purpose, setPurpose] = useState(null); // null | "connection" | "adhoc"

  // ── Step 2: form fields ────────────────────────────────────────────────────
  const [qty, setQty] = useState("");
  const [issuedTo, setIssuedTo] = useState(""); // technician

  // Subscriber search (shared by both modes; required for connection, optional for adhoc)
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // For ad-hoc when no subscriber selected — free-text reference
  const [adhocReference, setAdhocReference] = useState("");

  const [amountPaid, setAmountPaid] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [customRate, setCustomRate] = useState(String(item.unitRate || ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [finalSummary, setFinalSummary] = useState(null);

  const currentInHand = item.inHand ?? 0;
  const issueQty = Number(qty) || 0;
  const effectiveRate = Number(customRate) || item.unitRate || 0;
  const remaining = currentInHand - issueQty;
  const totalIssueValue = issueQty * effectiveRate;

  // Live Payment Previews
  const rawPaid = Number(amountPaid);
  const paidPreview = isNaN(rawPaid)
    ? 0
    : Math.min(totalIssueValue, Math.max(0, rawPaid));
  const remainingPreview = Math.max(0, totalIssueValue - paidPreview);

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
      ? "Over-dispatching!"
      : remaining === 0
        ? "Stock will be empty"
        : stockAfterPercent <= 20
          ? "Low stock after dispatch"
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

  const isConnection = purpose === "connection";

  // Handle clicking outside the custom dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = activeCustomers.filter((c) => {
    const q = subscriberSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.userName.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async () => {
    setError("");
    if (!issueQty || issueQty <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    if (issueQty > currentInHand) {
      setError(
        `Only ${currentInHand} ${item.unit}(s) available. Cannot dispatch more.`,
      );
      return;
    }
    if (!effectiveRate || effectiveRate <= 0) {
      setError("Per-unit price must be greater than 0.");
      return;
    }
    if (!selectedCustomerId) {
      setError("Please select a subscriber to link this dispatch to.");
      return;
    }

    setSaving(true);
    try {
      const newStockOut = (item.stockOut || 0) + issueQty;
      const newInHand = (item.stockIn || 0) - newStockOut;

      // Both connection and adhoc support partial/full payment
      const paidAmt = paidPreview;
      const pendingAmt = remainingPreview;

      // Resolve subscriber details
      let subName = null;
      let subUser = null;
      let subId = null;

      if (selectedCustomerId) {
        const customer = activeCustomers.find(
          (c) => String(c.id) === selectedCustomerId,
        );
        if (customer) {
          subName = customer.fullName;
          subUser = customer.userName;
          subId = customer.id;
        }
      }

      // For ad-hoc without subscriber, use reference text as name
      if (!isConnection && !subName) {
        subName = adhocReference.trim() || null;
      }

      // 1. Create a Job record FIRST so we get its ID
      // Both connection and adhoc always create a job for financial tracking.
      // This ensures Dashboard revenue/COGS/balance-due are all computed
      // from the same connectionJobs table without special-casing.
      const newJob = await addJob({
        date,
        dispatchType: purpose, // "connection" | "adhoc"
        technicianName: issuedTo.trim() || null,
        subscriberName: subName,
        subscriberUsername: subUser,
        subscriberId: subId,
        note: note.trim() || null,
        reference: !isConnection ? adhocReference.trim() || null : null,
        items: [
          {
            inventoryItemId: item.id,
            description: item.description,
            unit: item.unit,
            qty: issueQty,
            unitRate: effectiveRate,
            totalValue: totalIssueValue,
          },
        ],
        totalValue: totalIssueValue,
        amountPaid: paidAmt,
        amountPending: pendingAmt,
      });

      // 2. Update Inventory Item (Stock OUT & Issue Log)
      // Tag the logEntry with the job ID so the Jobs Log can skip it
      // (avoiding duplicate display of the same dispatch).
      const logEntry = {
        date,
        qty: issueQty,
        unitRate: effectiveRate,
        totalValue: totalIssueValue,
        issuedTo: issuedTo.trim() || null,
        subscriberName: subName,
        subscriberUsername: subUser,
        subscriberId: subId,
        note: note.trim() || null,
        balanceAfter: newInHand,
        jobRef: isConnection, // true for connection, false for adhoc
        dispatchType: purpose, // "connection" | "adhoc"
        jobId: newJob?.id || null, // link to the job record
        amountPaid: paidAmt,
        amountPending: pendingAmt,
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

      setFinalSummary({
        isConnection,
        qty: issueQty,
        total: totalIssueValue,
        paid: paidAmt,
        pending: pendingAmt,
        remainingInHand: newInHand,
        subName,
      });

      setDone(true);
    } catch (err) {
      setError("Failed to dispatch stock: " + err.message);
    }
    setSaving(false);
  };

  // ── Success State ────────────────────────────────────────────────────────────
  if (done && finalSummary) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center px-2">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">Stock Dispatched!</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-red-500">
              {finalSummary.qty} {item.unit}
            </span>{" "}
            of <span className="font-semibold">{item.description}</span>{" "}
            dispatched.
            {finalSummary.subName && (
              <>
                <br />
                <span className="text-gray-400">
                  Linked to:{" "}
                  <span className="font-semibold text-gray-700">
                    {finalSummary.subName}
                  </span>
                </span>
              </>
            )}
            <br />
            <span className="text-gray-400">
              Remaining in warehouse:{" "}
              <span className="font-semibold text-gray-600">
                {finalSummary.remainingInHand} {item.unit}
              </span>
            </span>
          </p>

          {/* Financial Breakdown */}
          <div className="text-sm bg-gray-50 border border-gray-200 rounded-xl p-4 w-full text-left space-y-1.5 mt-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Value:</span>
              <span className="font-semibold text-gray-800">
                PKR {finalSummary.total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid Now:</span>
              <span className="font-semibold text-green-600">
                PKR {finalSummary.paid.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-500 font-medium">Pending Dues:</span>
              <span
                className={`font-bold ${finalSummary.pending > 0 ? "text-red-600" : "text-green-600"}`}
              >
                PKR {finalSummary.pending.toLocaleString()}
              </span>
            </div>
            {finalSummary.pending > 0 && (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1">
                {finalSummary.isConnection
                  ? "Pending amount will appear in Subscriber's Inventory Dues tab."
                  : finalSummary.subName
                    ? "Pending amount will appear in the linked subscriber's Inventory Dues tab and Dashboard Balance Due."
                    : "Pending amount will appear in Dashboard Total Balance Due."}
              </p>
            )}
            {finalSummary.pending === 0 && (
              <p className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 mt-1">
                Fully paid — this dispatch will be counted in COGS and Revenue.
              </p>
            )}
          </div>

          {/* Type tag on success */}
          <div
            className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold ${
              finalSummary.isConnection
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-amber-100 text-amber-700 border border-amber-200"
            }`}
          >
            {finalSummary.isConnection ? (
              <>
                <Link2 size={11} /> Subscriber Connection
              </>
            ) : (
              <>
                <Hammer size={11} /> Ad-hoc Dispatch
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-2">
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

  // ── Step 1: Purpose Selector ─────────────────────────────────────────────────
  if (purpose === null) {
    return (
      <div className="space-y-4">
        {/* Item info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Dispatching from
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
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Available
            </p>
            <p
              className={`text-3xl font-black leading-tight ${currentInHand === 0 ? "text-red-500" : "text-green-600"}`}
            >
              {currentInHand}
            </p>
            <p className="text-xs text-gray-400">{item.unit}(s)</p>
          </div>
        </div>

        {currentInHand === 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 font-medium">
            <AlertTriangle size={14} className="shrink-0" />
            This item is out of stock. No units can be dispatched.
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-700 mb-3">
            Why are you dispatching this stock?
          </p>

          {/* Option A: New Subscriber Connection */}
          <button
            disabled={currentInHand === 0}
            onClick={() => setPurpose("connection")}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Link2 size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-blue-800 text-sm">
                  New Subscriber Connection
                </p>
                <ChevronRight
                  size={16}
                  className="text-blue-400 group-hover:text-blue-600 transition-colors"
                />
              </div>
              <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                Fiber, cable, or equipment for a new customer's setup. Logs a
                job and tracks payments in the <strong>Subscribers Dues</strong>{" "}
                tab.
              </p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  🔗 Syncs to Subscriber Dues
                </span>
                <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Tracks Payment
                </span>
              </div>
            </div>
          </button>

          {/* Option B: Ad-hoc */}
          <button
            disabled={currentInHand === 0}
            onClick={() => setPurpose("adhoc")}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <Hammer size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-amber-800 text-sm">
                  Ad-hoc / General Dispatch
                </p>
                <ChevronRight
                  size={16}
                  className="text-amber-400 group-hover:text-amber-600 transition-colors"
                />
              </div>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Repair work, spare parts, testing, field maintenance. Optionally
                link to a subscriber for due tracking.
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  🔧 Internal Record
                </span>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Optional Subscriber Link
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-1 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Dispatch Form ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Purpose tag + back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setPurpose(null);
            setError("");
            setSelectedCustomerId("");
            setSubscriberSearch("");
            setAdhocReference("");
            setAmountPaid("");
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium bg-gray-100 px-2 py-1 rounded-md"
        >
          ← Change purpose
        </button>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            isConnection
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "bg-amber-100 text-amber-700 border border-amber-200"
          }`}
        >
          {isConnection ? <Link2 size={11} /> : <Hammer size={11} />}
          {isConnection ? "New Subscriber Connection" : "Ad-hoc Dispatch"}
        </div>
      </div>

      {/* Item Info Banner */}
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
          {historyCount > 0 && onViewHistory && (
            <button
              onClick={() => {
                onClose();
                onViewHistory();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <History size={13} />
              {historyCount} dispatch{historyCount !== 1 ? "es" : ""} logged
            </button>
          )}
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Available
            </p>
            <p
              className={`text-2xl font-black leading-tight ${currentInHand === 0 ? "text-red-500" : "text-green-600"}`}
            >
              {currentInHand}
            </p>
            <p className="text-xs text-gray-400">{item.unit}(s)</p>
          </div>
        </div>
      </div>

      {/* Qty + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Quantity to Dispatch <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max={currentInHand}
            className={`w-full border rounded-lg px-3 h-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
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
            onKeyDown={(e) =>
              ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
            }
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

        {/* Per Unit Price */}
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
              onKeyDown={(e) =>
                ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
              }
            />
          </div>
          {Number(customRate) !== item.unitRate && item.unitRate > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle size={11} />
              Rate changed from recorded PKR {item.unitRate?.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Live Preview */}
      {issueQty > 0 && effectiveRate > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Stock After Dispatch</span>
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
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <TrendingDown size={12} className="text-red-500" />
              Total Value of Issued Material
            </span>
            <span className="text-sm font-bold text-red-600">
              PKR {totalIssueValue.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Technician + Subscriber */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Wrench size={12} /> Technician Name
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

        {/* Subscriber search — required for connection, optional for adhoc */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <User size={12} />
              Subscriber
              <span className="text-red-500">*</span>
            </span>
          </label>
          <div className="relative" ref={dropdownRef}>
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              className={`w-full border rounded-lg pl-9 pr-8 h-10 text-sm focus:outline-none focus:ring-2 bg-white ${
                error && !selectedCustomerId
                  ? "border-red-400 bg-red-50 focus:ring-red-400"
                  : isConnection
                    ? "border-gray-300 focus:ring-blue-500"
                    : "border-gray-300 focus:ring-amber-400"
              }`}
              placeholder="Search username or name..."
              value={subscriberSearch}
              onChange={(e) => {
                setSubscriberSearch(e.target.value);
                setSelectedCustomerId("");
                setShowDropdown(true);
                setError("");
              }}
              onFocus={() => setShowDropdown(true)}
            />
            {selectedCustomerId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId("");
                  setSubscriberSearch("");
                  setShowDropdown(true);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 transition-colors"
                      onClick={() => {
                        setSelectedCustomerId(String(c.id));
                        setSubscriberSearch(`${c.fullName} (@${c.userName})`);
                        setShowDropdown(false);
                        setError("");
                      }}
                    >
                      <div className="font-semibold text-gray-800">
                        {c.fullName}
                      </div>
                      <div className="text-xs text-blue-600 font-mono mt-0.5">
                        @{c.userName}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-gray-500 text-center italic">
                    No matching subscribers found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          <span className="flex items-center gap-1.5">
            <FileText size={12} /> Note
            <span className="font-normal text-gray-400">(optional)</span>
          </span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder={
            isConnection
              ? "e.g. New connection at Gulshan B5..."
              : "e.g. Fiber repair at main junction..."
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* ── Payment Section — always visible for both Connection and Ad-hoc ── */}
      <div
        className={`border rounded-xl p-4 space-y-3 mt-1 shadow-sm ${
          isConnection
            ? "border-blue-200 bg-blue-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard
              size={15}
              className={isConnection ? "text-blue-600" : "text-amber-600"}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wide ${isConnection ? "text-blue-700" : "text-amber-700"}`}
            >
              Payment Received
            </span>
          </div>
          <span
            className={`text-xs font-semibold bg-white px-2 py-0.5 rounded-full border ${isConnection ? "text-gray-600 border-blue-200" : "text-gray-600 border-amber-200"}`}
          >
            Total: PKR {totalIssueValue.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          <div>
            <label
              className={`block text-xs font-medium mb-1.5 ${isConnection ? "text-blue-900" : "text-amber-900"}`}
            >
              Amount Paid Now
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">
                PKR
              </span>
              <input
                type="number"
                min="0"
                max={totalIssueValue > 0 ? totalIssueValue : undefined}
                placeholder="0 (leave blank = unpaid)"
                className={`w-full border bg-white rounded-lg pl-9 pr-2 h-10 text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${
                  isConnection
                    ? "border-blue-200 focus:ring-blue-500"
                    : "border-amber-200 focus:ring-amber-400"
                }`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                onKeyDown={(e) =>
                  ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
                }
              />
            </div>
            <p
              className={`text-[10px] mt-1 leading-tight ${isConnection ? "text-blue-600" : "text-amber-700"}`}
            >
              {isConnection
                ? "Unpaid balance will appear in Subscriber's Inventory Dues."
                : selectedCustomerId
                  ? "Unpaid balance will appear in linked subscriber's Inventory Dues and Dashboard Balance Due."
                  : "Unpaid balance will appear in Dashboard Total Balance Due."}
            </p>
          </div>

          <div className="space-y-1.5 pt-6">
            {totalIssueValue === 0 ? (
              <div className="flex justify-between text-xs bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-gray-500 font-medium italic">
                  Enter qty &amp; rate above
                </span>
              </div>
            ) : paidPreview === 0 ? (
              <div className="flex justify-between text-xs bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-amber-700 font-medium">
                  ⏳ Not paid yet
                </span>
                <span className="font-bold text-amber-800">
                  PKR {totalIssueValue.toLocaleString()} due
                </span>
              </div>
            ) : remainingPreview > 0 ? (
              <>
                <div className="flex justify-between text-xs bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-green-700 font-medium">✓ Paid Now</span>
                  <span className="font-bold text-green-800">
                    PKR {paidPreview.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-amber-700 font-medium">
                    ⏳ Still Pending
                  </span>
                  <span className="font-bold text-amber-800">
                    PKR {remainingPreview.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xs bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-700 font-medium">
                  ✅ Fully Paid
                </span>
                <span className="font-bold text-green-800">
                  PKR {totalIssueValue.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* COGS hint */}
        {totalIssueValue > 0 && paidPreview > 0 && remainingPreview === 0 && (
          <p className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
            ✅ Fully paid — will be counted in Revenue and COGS on Dashboard.
          </p>
        )}
        {totalIssueValue > 0 && remainingPreview > 0 && (
          <p className="text-[10px] text-amber-700 bg-white border border-amber-200 rounded-lg px-2 py-1.5">
            ⚠ COGS will only be counted once the full balance is cleared.
          </p>
        )}
        {totalIssueValue > 0 && paidPreview === 0 && amountPaid === "" && (
          <p className="text-[10px] text-amber-700 bg-white border border-amber-200 rounded-lg px-2 py-1.5">
            ⚠ COGS will only be counted once the full balance is cleared.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 font-medium mt-3">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-2">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm ${
            isConnection
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-amber-500 hover:bg-amber-600"
          }`}
        >
          {saving ? (
            "Dispatching..."
          ) : (
            <>
              <ArrowUpCircle size={15} />
              Dispatch{" "}
              {issueQty > 0
                ? `${issueQty} ${item.unit}` +
                  (paidPreview > 0
                    ? ` · PKR ${paidPreview.toLocaleString()} Paid`
                    : "")
                : "Stock"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
