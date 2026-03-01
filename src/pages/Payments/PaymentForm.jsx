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
  Wallet,
} from "lucide-react";
import { today, daysUntil } from "../../utils/dateUtils";
import usePaymentStore from "../../store/usePaymentStore";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import InvoiceModal from "../../components/ui/InvoiceModal";

// ─── helpers ─────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, valueClass = "text-gray-800", highlight }) {
  return (
    <div
      className={`flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0 ${highlight ? "font-bold" : ""}`}
    >
      <span className={highlight ? "text-gray-800" : "text-gray-500"}>
        {label}
      </span>
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

  // ── Determine situation ───────────────────────────────────────────────────
  const isExpired = days < 0; // cycle ended
  const hasNoCycle = !activeCycle; // brand new customer
  const isPaid = activeCycle?.amountPending === 0; // fully paid
  const pendingAmount = activeCycle?.amountPending ?? 0;

  // For expired+unpaid: operator chooses mode.
  // For active+unpaid:  always "pay only" (no reason to force renewal mid-cycle).
  // For active+paid:    always "renew" (only reason to open Pay form).
  // For no cycle:       always "renew" (create first cycle).
  const canChooseMode = isExpired && !hasNoCycle;
  const defaultRenew = hasNoCycle || isPaid || (isExpired && isPaid);
  const [wantsRenewal, setWantsRenewal] = useState(defaultRenew);
  const isRenewal = wantsRenewal;

  const [selectedPkgId, setSelectedPkgId] = useState(
    String(customer.packageId || packages[0]?.id || ""),
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);

  const selectedPkg = packages.find(
    (p) => String(p.id) === String(selectedPkgId),
  );
  const renewalPrice = selectedPkg ? Number(selectedPkg.price) : 0;

  // Auto-fill amount when mode or package changes
  useEffect(() => {
    if (isRenewal) {
      // Suggest the package price only (debt will carry forward automatically)
      setAmount(renewalPrice > 0 ? String(renewalPrice) : "");
    } else {
      // Suggest the full outstanding balance
      setAmount(pendingAmount > 0 ? String(pendingAmount) : "");
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenewal, selectedPkgId]);

  // ── Derived amounts ───────────────────────────────────────────────────────
  const enteredAmt = Number(amount) || 0;

  // In "Pay Dues Only" mode: what will be left after this payment?
  const remainingAfterPayment = Math.max(0, pendingAmount - enteredAmt);

  // In "Renew" mode: total new cycle = package price + carried debt
  const carriedDebt = isRenewal ? pendingAmount : 0;
  const newCycleTotal = renewalPrice + carriedDebt;
  // Remaining on new cycle after payment
  const remainingOnNewCycle = Math.max(0, newCycleTotal - enteredAmt);

  // Result status preview
  const resultStatus = isRenewal
    ? remainingOnNewCycle === 0
      ? "Clear ✓"
      : `Pending — PKR ${remainingOnNewCycle.toLocaleString()} left`
    : remainingAfterPayment === 0
      ? "Clear ✓"
      : `Pending — PKR ${remainingAfterPayment.toLocaleString()} left`;

  const resultStatusIsGood = isRenewal
    ? remainingOnNewCycle === 0
    : remainingAfterPayment === 0;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    const amt = enteredAmt;

    // Validate
    if (!isRenewal) {
      if (amt <= 0) {
        setError("Enter an amount greater than 0.");
        return;
      }
      if (amt > pendingAmount) {
        setError(
          `Cannot exceed outstanding balance of PKR ${pendingAmount.toLocaleString()}.`,
        );
        return;
      }
    }
    // Renewal: amount is optional (0 = renew with full debt pending)

    setSaving(true);
    try {
      let resultCycle;

      if (isRenewal) {
        // If package changed, update customer record first
        if (String(selectedPkgId) !== String(customer.packageId)) {
          await updateCustomer(customer.id, {
            packageId: Number(selectedPkgId),
            lockedPackagePrice: renewalPrice,
          });
        }
        // Create new cycle (carries forward unpaid debt automatically)
        resultCycle = await renewCycle(customer.id, date, renewalPrice);
        // Record payment against the new cycle if amount entered
        if (amt > 0) {
          await addInstallment(resultCycle.id, amt, date, note);
          resultCycle = usePaymentStore.getState().getActiveCycle(customer.id);
        }
      } else {
        // Pay dues only — record against existing cycle, no new cycle created
        await addInstallment(activeCycle.id, amt, date, note);
        resultCycle = usePaymentStore.getState().getActiveCycle(customer.id);
      }

      setInvoiceData({
        cycle: resultCycle,
        packageName: selectedPkg?.name || "—",
      });
    } catch (err) {
      setError("Error: " + err.message);
    }
    setSaving(false);
  };

  // ── Early-return: show invoice success state ──────────────────────────────
  if (invoiceData && !invoiceData.show) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              Saved Successfully!
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {isRenewal
                ? "New 30-day cycle started."
                : "Payment recorded on existing cycle."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setInvoiceData({ ...invoiceData, show: true })}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText size={14} /> View Invoice
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
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

  return (
    <div className="space-y-5 p-1">
      {/* ── HEADER ── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900">{customer.fullName}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{customer.userName}</p>
      </div>

      {/* ── MODE TOGGLE (only shown when cycle is expired+unpaid) ── */}
      {canChooseMode && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            What would you like to do?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Pay Dues Only */}
            <button
              onClick={() => setWantsRenewal(false)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                !isRenewal
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Wallet
                  size={16}
                  className={!isRenewal ? "text-green-600" : "text-gray-400"}
                />
                <span
                  className={`text-sm font-bold ${!isRenewal ? "text-green-700" : "text-gray-600"}`}
                >
                  Pay Dues Only
                </span>
                {!isRenewal && (
                  <span className="ml-auto text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Record a payment on the expired cycle. No new 30-day period
                starts.
              </p>
            </button>

            {/* Pay & Renew */}
            <button
              onClick={() => setWantsRenewal(true)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                isRenewal
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw
                  size={16}
                  className={isRenewal ? "text-blue-600" : "text-gray-400"}
                />
                <span
                  className={`text-sm font-bold ${isRenewal ? "text-blue-700" : "text-gray-600"}`}
                >
                  Pay & Renew Cycle
                </span>
                {isRenewal && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Start a fresh 30-day cycle. Any unpaid dues carry forward
                automatically.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ── INFO BANNER ── */}
      {hasNoCycle && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">No billing cycle yet.</span> This
            will create the customer&apos;s first 30-day cycle.
          </p>
        </div>
      )}

      {isExpired && !hasNoCycle && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">
              Cycle expired {Math.abs(days)} day
              {Math.abs(days) !== 1 ? "s" : ""} ago
              {pendingAmount > 0 &&
                ` — PKR ${pendingAmount.toLocaleString()} outstanding`}
              .
            </p>
            {!isRenewal && (
              <p className="mt-0.5 text-red-700 text-xs">
                The cycle remains expired after this payment. Renew the cycle
                when the customer is ready for a new 30-day period.
              </p>
            )}
          </div>
        </div>
      )}

      {!isExpired && !hasNoCycle && !isPaid && days <= 3 && (
        <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
          <Clock size={16} className="text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">
              {days === 0
                ? "Expires today!"
                : `${days} day${days !== 1 ? "s" : ""} left`}
            </span>{" "}
            — cycle ends on <strong>{activeCycle.cycleEndDate}</strong>.
          </p>
        </div>
      )}

      {!isExpired && !hasNoCycle && isPaid && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Early renewal.</span> The current
            cycle has{" "}
            <strong>
              {days} day{days !== 1 ? "s" : ""} remaining
            </strong>{" "}
            and is fully paid. Renewing now will start a new cycle from today.
          </p>
        </div>
      )}

      {/* ── CURRENT CYCLE SUMMARY (Pay Dues Only mode) ── */}
      {!isRenewal && activeCycle && (
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
            label="Already Paid"
            value={`PKR ${Number(activeCycle.amountPaid).toLocaleString()}`}
            valueClass="text-green-700"
          />
          <SummaryRow
            label="Outstanding Balance"
            value={`PKR ${pendingAmount.toLocaleString()}`}
            valueClass={pendingAmount > 0 ? "text-red-600" : "text-green-700"}
            highlight
          />
        </div>
      )}

      {/* ── RENEWAL: PACKAGE SELECTOR + NEW CYCLE SUMMARY ── */}
      {isRenewal && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-4 space-y-3">
          <p className="text-xs font-bold uppercase text-blue-700 tracking-wide">
            New 30-Day Cycle — Select Package
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

          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <span>Package price</span>
              <span>PKR {renewalPrice.toLocaleString()}</span>
            </div>
            {carriedDebt > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Carried over debt</span>
                <span>+ PKR {carriedDebt.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1.5 mt-1">
              <span>New cycle total</span>
              <span>PKR {newCycleTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT INPUT ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Amount Paid{" "}
            {isRenewal && (
              <span className="text-gray-400 font-normal text-xs">
                (Optional)
              </span>
            )}
          </label>
          <input
            type="number"
            min="0"
            max={!isRenewal ? pendingAmount : undefined}
            className="w-full border border-gray-300 rounded-lg px-3 h-11 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            placeholder={
              isRenewal
                ? `Suggested: PKR ${renewalPrice.toLocaleString()}`
                : `Max: PKR ${pendingAmount.toLocaleString()}`
            }
          />
          {isRenewal && (
            <p className="text-xs text-gray-400 mt-1">
              Leave empty or 0 to renew without payment now.
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
          Note{" "}
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Cash, JazzCash, EasyPaisa..."
        />
      </div>

      {/* ── LIVE RESULT PREVIEW ── */}
      {(enteredAmt > 0 || isRenewal) && !error && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm space-y-1 ${
            resultStatusIsGood
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-wide mb-1 ${
              resultStatusIsGood ? "text-green-600" : "text-yellow-600"
            }`}
          >
            <Clock size={11} className="inline mr-1 mb-0.5" />
            After this action
          </p>
          {isRenewal && (
            <p
              className={
                resultStatusIsGood ? "text-green-800" : "text-yellow-800"
              }
            >
              🔄 New 30-day cycle starts from <strong>{date}</strong> for{" "}
              <strong>{selectedPkg?.name}</strong>.
            </p>
          )}
          {enteredAmt > 0 && (
            <p
              className={
                resultStatusIsGood ? "text-green-800" : "text-yellow-800"
              }
            >
              💰 PKR <strong>{enteredAmt.toLocaleString()}</strong> recorded on{" "}
              <strong>{date}</strong>
              {note ? ` via ${note}` : ""}.
            </p>
          )}
          <p
            className={`font-semibold mt-1 ${
              resultStatusIsGood ? "text-green-700" : "text-yellow-700"
            }`}
          >
            Status after save:{" "}
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                resultStatusIsGood
                  ? "bg-green-200 text-green-800"
                  : "bg-yellow-200 text-yellow-800"
              }`}
            >
              {resultStatus}
            </span>
          </p>
          {isRenewal && enteredAmt === 0 && (
            <p className="text-amber-600 text-xs mt-1">
              ⚠️ No payment entered — full amount of PKR{" "}
              {newCycleTotal.toLocaleString()} will be pending on the new cycle.
            </p>
          )}
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── SUBMIT BUTTON ── */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
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
              {enteredAmt > 0 ? "Pay & Renew Cycle" : "Renew Cycle"}
            </>
          ) : (
            <>
              <CreditCard size={14} />
              Record Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
