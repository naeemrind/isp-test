import { useState, useEffect } from "react";
import { today, daysUntil, formatDate } from "../../utils/dateUtils";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import db from "../../db/database"; // Imported to handle debt transfer
import { AlertTriangle, ArrowRight, Receipt, AlertCircle } from "lucide-react";

export default function PaymentForm({ customer, onClose }) {
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);
  const addInstallment = usePaymentStore((s) => s.addInstallment);
  const renewCycle = usePaymentStore((s) => s.renewCycle);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const packages = usePackageStore((s) => s.packages);

  // 1. Get Current Cycle Info
  const activeCycle = getActiveCycle(customer.id);
  const days = activeCycle ? daysUntil(activeCycle.cycleEndDate) : 0;
  const isClear = activeCycle && activeCycle.status === "clear";
  const isExpired = activeCycle && days < 0;

  // 2. Determine if Renewal is needed/allowed
  const needsRenewal = !activeCycle || (isClear && days <= 5) || isExpired;

  // 3. State Setup
  const [selectedPkgId, setSelectedPkgId] = useState(customer.packageId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 4. Calculations
  const selectedPkg = packages.find(
    (p) => String(p.id) === String(selectedPkgId),
  );

  // Previous Pending: Debt from the currently active (or expired) cycle
  const previousPending =
    activeCycle && activeCycle.amountPending > 0
      ? activeCycle.amountPending
      : 0;

  // New Cycle Price
  const newPackagePrice = selectedPkg ? Number(selectedPkg.price) : 0;

  // Grand Total Calculation
  const grandTotal = needsRenewal
    ? previousPending + newPackagePrice
    : previousPending;

  // Auto-fill amount with Grand Total when opening (convenience)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!amount && grandTotal > 0) {
        setAmount(String(grandTotal));
      } else if (!amount && grandTotal === 0 && needsRenewal) {
        setAmount("0");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [grandTotal, needsRenewal]); // Intentionally omitting 'amount' to allow user edits

  const handleSubmit = async () => {
    let payAmount = Number(amount);

    // Validation
    if (isNaN(payAmount) || payAmount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!needsRenewal && payAmount <= 0) {
      setError("Enter a valid amount to pay.");
      return;
    }

    // Prevent overpaying existing cycle
    if (!needsRenewal && payAmount > activeCycle.amountPending) {
      setError(`Amount exceeds balance of PKR ${activeCycle.amountPending}`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (needsRenewal) {
        // --- RENEWAL LOGIC ---

        // 1. Update Customer Package if changed
        if (
          selectedPkgId &&
          String(selectedPkgId) !== String(customer.packageId)
        ) {
          await updateCustomer(customer.id, {
            packageId: Number(selectedPkgId),
            lockedPackagePrice: newPackagePrice,
          });
        }

        // 2. Handle Previous Debt (Balance Transfer)
        let carriedBalance = 0;
        if (activeCycle && previousPending > 0) {
          carriedBalance = previousPending;

          // Modify OLD cycle to mark it as cleared/transferred
          // Note Update: We now store the exact amount in the note!
          const transferNote = `[Bal Transferred: ${carriedBalance}]`;

          await db.paymentCycles.update(activeCycle.id, {
            amountPending: 0,
            status: "clear",
            totalAmount: activeCycle.amountPaid, // Shrink bill to match payment
            note: activeCycle.note
              ? activeCycle.note + " " + transferNote
              : transferNote,
          });
        }

        // 3. Start New Cycle
        // Total = New Price + Old Debt
        const cycleTotal = newPackagePrice + carriedBalance;
        const newCycle = await renewCycle(customer.id, date, cycleTotal);

        // 4. Record Payment (if any)
        if (payAmount > 0) {
          await addInstallment(newCycle.id, payAmount, date, note);
        }

        // 5. Force Refresh Store
        await usePaymentStore.getState().loadCycles();
      } else {
        // --- STANDARD PAYMENT LOGIC (No Renewal) ---
        await addInstallment(activeCycle.id, payAmount, date, note);
      }

      onClose();
    } catch (err) {
      setError("Error: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 p-1">
      {/* ── HEADER / SUMMARY CARD ── */}
      <div
        className={`rounded-xl overflow-hidden border ${
          needsRenewal
            ? "bg-blue-50 border-blue-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        {/* Title Bar */}
        <div
          className={`px-5 py-3 border-b flex justify-between items-center ${
            needsRenewal
              ? "bg-blue-100/50 border-blue-200"
              : "bg-gray-100 border-gray-200"
          }`}
        >
          <div>
            <h3 className="text-base font-bold text-gray-800">
              {customer.fullName}
            </h3>
            <p className="text-xs text-gray-500">{customer.userName}</p>
          </div>
          {needsRenewal ? (
            <span className="bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-sm">
              New Cycle
            </span>
          ) : (
            <span className="bg-gray-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-sm">
              Payment Only
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {needsRenewal ? (
            // ── RENEWAL VIEW ──
            <>
              {/* 1. Previous Debt Section (Only if exists) */}
              {previousPending > 0 && (
                <div className="flex items-center justify-between text-sm bg-red-50 border border-red-100 p-2.5 rounded-lg text-red-800 mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span className="font-semibold">Previous Overdue</span>
                  </div>
                  <span className="font-bold">
                    PKR {previousPending.toLocaleString()}
                  </span>
                </div>
              )}

              {/* 2. New Package Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">
                  Select Package for New Cycle
                </label>
                <div className="relative">
                  <select
                    value={selectedPkgId}
                    onChange={(e) => {
                      setSelectedPkgId(e.target.value);
                      // Reset amount to trigger auto-calc
                      setAmount("");
                    }}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm transition-all"
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.speedMbps ? `${p.speedMbps} Mbps` : ""} —
                        PKR {Number(p.price).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                    <ArrowRight size={14} className="rotate-90" />
                  </div>
                </div>
              </div>

              {/* 3. New Cycle Details */}
              <div className="flex justify-between items-center text-sm px-1">
                <span className="text-gray-600">New Subscription Cost</span>
                <span className="font-semibold text-gray-900">
                  PKR {newPackagePrice.toLocaleString()}
                </span>
              </div>

              {/* 4. Divider */}
              <div className="border-t border-blue-200 border-dashed my-1"></div>

              {/* 5. Total */}
              <div className="flex justify-between items-center bg-blue-600 text-white p-3 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <Receipt size={18} />
                  <span className="font-bold text-sm">Total Payable</span>
                </div>
                <span className="text-lg font-black">
                  PKR {grandTotal.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            // ── EXISTING CYCLE VIEW (No Renewal) ──
            <div className="text-sm space-y-3">
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                <span className="text-gray-500">Current Cycle</span>
                <span className="font-semibold text-gray-700">
                  {formatDate(activeCycle?.cycleStartDate)} →{" "}
                  {formatDate(activeCycle?.cycleEndDate)}
                </span>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-gray-500">Total Bill</span>
                <span className="font-medium">
                  PKR {activeCycle?.totalAmount}
                </span>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-gray-500">Already Paid</span>
                <span className="font-medium text-green-600">
                  PKR {activeCycle?.amountPaid}
                </span>
              </div>
              <div className="border-t border-gray-200 my-1"></div>
              <div className="flex justify-between items-center px-1">
                <span className="font-bold text-gray-700">Remaining Due</span>
                <span className="font-black text-xl text-red-600">
                  PKR {activeCycle?.amountPending}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── INPUT FIELDS ── */}
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-1">
              Amount Paid <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-medium">
                PKR
              </span>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="0"
              />
            </div>
            {needsRenewal && Number(amount) === 0 && (
              <p className="text-[10px] text-orange-600 mt-1.5 ml-1 font-medium">
                * Zero payment allowed for activation
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={today()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-1">
            Note (optional)
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cash, JazzCash, clearing old dues..."
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-all flex items-center gap-2 ${
            needsRenewal
              ? "bg-blue-600 hover:bg-blue-700 hover:shadow-md"
              : "bg-green-600 hover:bg-green-700 hover:shadow-md"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {saving ? (
            "Processing..."
          ) : needsRenewal ? (
            <>
              <ArrowRight size={16} /> Renew & Pay
            </>
          ) : (
            "Record Payment"
          )}
        </button>
      </div>
    </div>
  );
}
