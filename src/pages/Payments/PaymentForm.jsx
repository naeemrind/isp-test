import { useState, useEffect } from "react";
import { today, daysUntil, formatDate } from "../../utils/dateUtils";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import { AlertTriangle } from "lucide-react";

export default function PaymentForm({ customer, onClose }) {
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);
  const addInstallment = usePaymentStore((s) => s.addInstallment);
  const renewCycle = usePaymentStore((s) => s.renewCycle);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const packages = usePackageStore((s) => s.packages);

  const activeCycle = getActiveCycle(customer.id);
  const days = activeCycle ? daysUntil(activeCycle.cycleEndDate) : 0;
  const isClear = activeCycle && activeCycle.status === "clear";

  // Renewal needed if: No active cycle OR (Cycle is clear AND (Expired OR Expiring within 5 days))
  const needsRenewal = !activeCycle || (isClear && days <= 5);

  // -- STATE --
  // Initialize with customer's current package
  const [selectedPkgId, setSelectedPkgId] = useState(customer.packageId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Calculate price based on selected package (for renewal) OR existing cycle
  const selectedPkg = packages.find(
    (p) => String(p.id) === String(selectedPkgId),
  );

  // If renewing, use the selected package price. If paying pending balance, use cycle balance.
  const renewalPrice = selectedPkg ? Number(selectedPkg.price) : 0;
  const maxPayable =
    activeCycle && !needsRenewal ? activeCycle.amountPending : renewalPrice;

  // Auto-fill amount if renewing (optional convenience)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (needsRenewal && renewalPrice > 0 && !amount) {
        setAmount(String(renewalPrice));
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [needsRenewal, renewalPrice, amount]);

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!needsRenewal && amt > activeCycle.amountPending) {
      setError(`Amount exceeds balance of PKR ${activeCycle.amountPending}`);
      return;
    }

    setSaving(true);
    try {
      if (needsRenewal) {
        // 1. If package changed, update customer profile first
        if (String(selectedPkgId) !== String(customer.packageId)) {
          await updateCustomer(customer.id, {
            packageId: Number(selectedPkgId),
            lockedPackagePrice: renewalPrice,
          });
        }

        // 2. Start new cycle with NEW package price
        await renewCycle(customer.id, date, renewalPrice);

        // 3. Add payment to the new cycle
        const updatedCycle = usePaymentStore
          .getState()
          .getActiveCycle(customer.id);
        if (updatedCycle && amt > 0) {
          await addInstallment(updatedCycle.id, amt, date, note);
        }
      } else {
        // Standard payment for existing cycle
        await addInstallment(activeCycle.id, amt, date, note);
      }
      onClose();
    } catch (err) {
      setError("Error: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 p-2">
      {/* ── SUMMARY SECTION ── */}
      <div
        className={`rounded-xl p-5 border ${needsRenewal ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-200"}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {customer.fullName}
            </h3>
            <p className="text-sm text-gray-500">{customer.userName}</p>
          </div>
          {needsRenewal && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
              RENEWAL
            </span>
          )}
        </div>

        {needsRenewal ? (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-semibold text-blue-800">
                Starting a new billing cycle.
              </p>

              {activeCycle && days < 0 && (
                <p className="text-xs text-blue-600 mt-1 opacity-80">
                  Previous cycle ended on {formatDate(activeCycle.cycleEndDate)}{" "}
                  ({-days} days ago).
                </p>
              )}
              {activeCycle && days === 0 && (
                <p className="text-xs text-blue-600 mt-1 opacity-80">
                  Current cycle expires today.
                </p>
              )}

              {/* ACTIVE CYCLE WARNING */}
              {activeCycle && days > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex items-start gap-2.5">
                  <AlertTriangle
                    size={16}
                    className="text-amber-600 shrink-0 mt-0.5"
                  />
                  <div className="text-xs leading-relaxed">
                    <p>
                      Current package has <strong>{days} days remaining</strong>{" "}
                      (Ends: {formatDate(activeCycle.cycleEndDate)}).
                    </p>
                    <p className="mt-1 text-amber-700">
                      Renewing now will start a new 30-day cycle immediately.
                      Remaining days will be overwritten.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* PACKAGE SELECTOR (Only visible during renewal) */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase text-blue-800 mb-1.5">
                Select Package for Renewal
              </label>
              <select
                value={selectedPkgId}
                onChange={(e) => {
                  setSelectedPkgId(e.target.value);
                  setAmount(""); // Reset amount so it can auto-fill new price
                }}
                className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — PKR {Number(p.price).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          // EXISTING CYCLE SUMMARY
          <div className="text-sm space-y-1">
            <div className="flex justify-between border-b border-gray-200 pb-2 mb-2">
              <span className="text-gray-500">Current Cycle</span>
              <span className="font-medium text-gray-800">
                {formatDate(activeCycle?.cycleStartDate)} →{" "}
                {formatDate(activeCycle?.cycleEndDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Bill</span>
              <span className="font-medium">
                PKR {activeCycle?.totalAmount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid So Far</span>
              <span className="font-medium text-green-600">
                PKR {activeCycle?.amountPaid}
              </span>
            </div>
            <div className="flex justify-between text-base pt-1">
              <span className="font-bold text-gray-700">Remaining Due</span>
              <span className="font-bold text-red-600">
                PKR {activeCycle?.amountPending}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── INPUT FIELDS ── */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amount Paid <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={maxPayable || undefined}
              className="w-full border border-gray-300 rounded-lg px-3 h-11 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder={
                needsRenewal ? `Price: ${renewalPrice}` : `Max: ${maxPayable}`
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={today()}
              className="w-full border border-gray-300 rounded-lg px-3 h-11 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Note (optional)
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cash, JazzCash, EasyPaisa..."
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="px-6 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
        >
          {saving
            ? "Processing..."
            : needsRenewal
              ? "Renew Cycle & Pay"
              : "Record Payment"}
        </button>
      </div>
    </div>
  );
}
