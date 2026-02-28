import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  CreditCard,
  Calendar,
  Info,
  FileText,
} from "lucide-react";
import { today, daysUntil } from "../../utils/dateUtils";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import InvoiceModal from "../../components/ui/InvoiceModal";

// ─── Scenario helpers ────────────────────────────────────────────────────────

/**
 * Returns one of four scenarios:
 *   "overdue"       – cycle expired AND unpaid balance remains
 *   "early_renewal" – cycle still active AND fully clear (paid), renewing early
 *   "partial_active"– cycle still active BUT balance still pending (partial pay)
 *   "no_cycle"      – customer has never had a cycle
 */
function getScenario(activeCycle, days) {
  if (!activeCycle) return "no_cycle";
  const expired = days < 0;
  const clear = activeCycle.status === "clear";
  if (expired) return "overdue";
  if (clear) return "early_renewal";
  return "partial_active";
}

// ─── Alert banner sub-component ──────────────────────────────────────────────

function ScenarioBanner({ scenario, days, activeCycle }) {
  if (scenario === "no_cycle") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold">No active billing cycle found.</p>
          <p className="mt-0.5 text-blue-700">
            This will create the customer&apos;s very first billing cycle.
          </p>
        </div>
      </div>
    );
  }

  if (scenario === "overdue") {
    const overdueDays = Math.abs(days);
    return (
      <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
        <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">
            ⚠️ Account is overdue by {overdueDays} day
            {overdueDays !== 1 ? "s" : ""}!
          </p>
          <p className="mt-0.5 text-red-700">
            Cycle ended on <strong>{activeCycle.cycleEndDate}</strong>.
            {activeCycle.amountPending > 0 && (
              <>
                {" "}
                Outstanding balance of{" "}
                <strong>
                  PKR {activeCycle.amountPending.toLocaleString()}
                </strong>{" "}
                will be carried forward automatically into the new cycle.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (scenario === "early_renewal") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">
            ⚠️ Renewing early — {days} day{days !== 1 ? "s" : ""} remaining in
            current cycle.
          </p>
          <p className="mt-0.5 text-amber-700">
            The current cycle ends on{" "}
            <strong>{activeCycle.cycleEndDate}</strong>. Renewing now will{" "}
            <strong>
              waste the remaining {days} day{days !== 1 ? "s" : ""}
            </strong>
            . The new cycle starts today.
          </p>
        </div>
      </div>
    );
  }

  if (scenario === "partial_active") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
        <CreditCard size={18} className="text-yellow-700 mt-0.5 shrink-0" />
        <div className="text-sm text-yellow-800">
          <p className="font-semibold">Pending payment on active cycle.</p>
          <p className="mt-0.5 text-yellow-700">
            The current cycle has{" "}
            <strong>
              {days} day{days !== 1 ? "s" : ""} left
            </strong>{" "}
            (expires <strong>{activeCycle.cycleEndDate}</strong>). Record a
            payment below or renew the cycle early.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Billing summary row ──────────────────────────────────────────────────────

function SummaryRow({ label, value, valueClass = "text-gray-800" }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentForm({ customer, onClose }) {
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);
  const addInstallment = usePaymentStore((s) => s.addInstallment);
  const renewCycle = usePaymentStore((s) => s.renewCycle);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const packages = usePackageStore((s) => s.packages);

  const activeCycle = getActiveCycle(customer.id);
  const days = activeCycle ? daysUntil(activeCycle.cycleEndDate) : 0;

  const scenario = getScenario(activeCycle, days);

  // Whether to show the RENEWAL UI vs. just "record payment" UI
  // Overdue and no_cycle always force renewal.
  // partial_active: admin can optionally choose to renew early.
  // early_renewal: already flagged, show renewal by default.
  const forceRenewal = scenario === "overdue" || scenario === "no_cycle";
  const [wantsRenewal, setWantsRenewal] = useState(
    forceRenewal || scenario === "early_renewal",
  );
  const isRenewal = forceRenewal || wantsRenewal;

  const [selectedPkgId, setSelectedPkgId] = useState(
    String(customer.packageId || (packages[0]?.id ?? "")),
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // After a successful save, store the resulting cycle here to offer invoice
  const [invoiceData, setInvoiceData] = useState(null);

  const selectedPkg = packages.find(
    (p) => String(p.id) === String(selectedPkgId),
  );
  const renewalPrice = selectedPkg ? Number(selectedPkg.price) : 0;

  // Auto-fill amount whenever package or mode changes
  useEffect(() => {
    if (isRenewal) {
      setAmount(renewalPrice > 0 ? String(renewalPrice) : "");
    } else if (activeCycle) {
      setAmount(String(activeCycle.amountPending));
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenewal, selectedPkgId]);

  const maxPayable = isRenewal ? undefined : (activeCycle?.amountPending ?? 0);

  const handleSubmit = async () => {
    setError("");
    const amt = Number(amount) || 0;

    if (!isRenewal) {
      if (amt <= 0) {
        setError("Enter a valid amount greater than 0.");
        return;
      }
      if (activeCycle && amt > activeCycle.amountPending) {
        setError(
          `Amount exceeds outstanding balance of PKR ${activeCycle.amountPending.toLocaleString()}.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      let resultCycle;
      if (isRenewal) {
        if (String(selectedPkgId) !== String(customer.packageId)) {
          await updateCustomer(customer.id, {
            packageId: Number(selectedPkgId),
            lockedPackagePrice: renewalPrice,
          });
        }
        resultCycle = await renewCycle(customer.id, date, renewalPrice);
        if (amt > 0) {
          await addInstallment(resultCycle.id, amt, date, note);
          // Re-fetch cycle from store so amountPaid is up to date
          resultCycle = usePaymentStore.getState().getActiveCycle(customer.id);
        }
      } else {
        await addInstallment(activeCycle.id, amt, date, note);
        resultCycle = usePaymentStore.getState().getActiveCycle(customer.id);
      }
      // Show invoice prompt instead of immediately closing
      setInvoiceData({
        cycle: resultCycle,
        packageName: selectedPkg?.name || "—",
      });
    } catch (err) {
      setError("Error: " + err.message);
    }
    setSaving(false);
  };

  // ── Derived labels ──
  const modeTag = isRenewal ? (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
      <RefreshCw size={11} />
      RENEWAL
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
      <CreditCard size={11} />
      PAYMENT
    </span>
  );

  return (
    <div className="space-y-5 p-1">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            {customer.fullName}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{customer.userName}</p>
        </div>
        {modeTag}
      </div>

      {/* ── SCENARIO BANNER ── */}
      <ScenarioBanner
        scenario={scenario}
        days={days}
        activeCycle={activeCycle}
      />

      {/* ── CURRENT CYCLE SUMMARY (shown only when cycle is active & not doing renewal) ── */}
      {activeCycle && !isRenewal && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-0.5">
          <p className="text-xs font-bold uppercase text-gray-400 tracking-wide mb-2">
            Current Billing Cycle
          </p>
          <SummaryRow
            label="Period"
            value={`${activeCycle.cycleStartDate} → ${activeCycle.cycleEndDate}`}
          />
          <SummaryRow
            label="Total Bill"
            value={`PKR ${Number(activeCycle.totalAmount).toLocaleString()}`}
          />
          <SummaryRow
            label="Paid So Far"
            value={`PKR ${Number(activeCycle.amountPaid).toLocaleString()}`}
            valueClass="text-green-700"
          />
          <SummaryRow
            label="Outstanding Balance"
            value={`PKR ${Number(activeCycle.amountPending).toLocaleString()}`}
            valueClass={
              activeCycle.amountPending > 0 ? "text-red-600" : "text-green-700"
            }
          />
          {activeCycle.amountPending === 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-700 font-semibold">
              <CheckCircle size={13} />
              Fully paid for this cycle
            </div>
          )}
        </div>
      )}

      {/* ── RENEWAL: PACKAGE SELECTOR ── */}
      {isRenewal && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 space-y-3">
          <p className="text-xs font-bold uppercase text-blue-700 tracking-wide">
            New Billing Cycle — Select Package
          </p>
          <select
            value={selectedPkgId}
            onChange={(e) => {
              setSelectedPkgId(e.target.value);
              setAmount("");
            }}
            className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — PKR {Number(p.price).toLocaleString()}
              </option>
            ))}
          </select>

          {/* Show carried-over debt clearly */}
          {activeCycle && activeCycle.amountPending > 0 && (
            <div className="bg-white border border-red-200 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="font-semibold text-gray-700">New cycle summary:</p>
              <div className="flex justify-between text-gray-600">
                <span>Package price</span>
                <span>PKR {renewalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>Carried over debt</span>
                <span>
                  + PKR {Number(activeCycle.amountPending).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1 mt-1">
                <span>Total due</span>
                <span>
                  PKR{" "}
                  {(
                    renewalPrice + Number(activeCycle.amountPending)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOGGLE: offer early renewal for partial_active ── */}
      {scenario === "partial_active" && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <input
            type="checkbox"
            id="earlyRenew"
            checked={wantsRenewal}
            onChange={(e) => setWantsRenewal(e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <label
            htmlFor="earlyRenew"
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            <span className="font-semibold">Renew cycle early instead</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              This will start a fresh 30-day cycle today and carry over any
              unpaid balance.
            </span>
          </label>
        </div>
      )}

      {/* ── INPUT FIELDS ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Amount Paid{" "}
            {isRenewal && (
              <span className="text-gray-400 font-normal">(Optional)</span>
            )}
          </label>
          <input
            type="number"
            min="0"
            max={maxPayable || undefined}
            className="w-full border border-gray-300 rounded-lg px-3 h-11 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            placeholder={
              isRenewal
                ? `Suggested: ${renewalPrice.toLocaleString()}`
                : `Max: PKR ${(maxPayable || 0).toLocaleString()}`
            }
          />
          {isRenewal && (
            <p className="text-xs text-gray-400 mt-1">
              Leave 0 to renew without recording a payment now.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="date"
              max={today()}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Note <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Cash, JazzCash, EasyPaisa..."
        />
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── QUICK SUMMARY before submit — hidden after successful save ── */}
      {!invoiceData && (Number(amount) > 0 || isRenewal) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-1.5">
            <Clock size={12} className="inline mr-1 mb-0.5" />
            Action Summary
          </p>
          {isRenewal && (
            <p>
              ✅ Start a new 30-day billing cycle for{" "}
              <strong>{selectedPkg?.name}</strong> at{" "}
              <strong>PKR {renewalPrice.toLocaleString()}</strong>.
            </p>
          )}
          {Number(amount) > 0 && (
            <p>
              💰 Record payment of{" "}
              <strong>PKR {Number(amount).toLocaleString()}</strong> on{" "}
              <strong>{date}</strong>
              {note ? ` via ${note}` : ""}.
            </p>
          )}
          {isRenewal && Number(amount) === 0 && (
            <p className="text-amber-600">
              ⚠️ No payment recorded — cycle will be renewed with full amount
              pending.
            </p>
          )}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !!invoiceData}
          className={`px-6 py-2.5 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
            isRenewal
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {saving ? (
            "Processing..."
          ) : isRenewal ? (
            <>
              <RefreshCw size={14} />
              Renew Cycle
            </>
          ) : (
            <>
              <CreditCard size={14} />
              Record Payment
            </>
          )}
        </button>
      </div>

      {/* ── SUCCESS: show invoice prompt after save ── */}
      {invoiceData && (
        <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-green-800 font-medium">
            <CheckCircle size={16} className="text-green-600" />
            Saved successfully!
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setInvoiceData({ ...invoiceData, show: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FileText size={13} />
              View Invoice
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Invoice modal — shown after successful save */}
      <InvoiceModal
        isOpen={!!invoiceData?.show}
        onClose={() => setInvoiceData(null)}
        customer={customer}
        cycle={invoiceData?.cycle}
        packageName={invoiceData?.packageName}
      />
    </div>
  );
}
