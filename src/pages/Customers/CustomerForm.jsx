import { useState, useEffect, useCallback } from "react";
import { checkDuplicate } from "../../utils/duplicateCheck";
import { today } from "../../utils/dateUtils";
import usePackageStore from "../../store/usePackageStore";
import useCustomerStore from "../../store/useCustomerStore";
import usePaymentStore from "../../store/usePaymentStore";
import db from "../../db/database";

const INITIAL = {
  fullName: "",
  userName: "",
  mobileNo: "",
  mainArea: "",
  recoveryAgent: "",
  packageId: "",
  status: "active",
  notes: "",
  startDate: today(),
};

const PAYMENT_INITIAL = {
  recordPayment: false,
  amountPaid: "",
  paymentDate: today(),
  paymentNote: "",
};

export default function CustomerForm({ customer, onClose }) {
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const createInitialCycle = usePaymentStore((s) => s.createInitialCycle);
  const addInstallment = usePaymentStore((s) => s.addInstallment);
  const allPackages = usePackageStore((s) => s.packages);
  const packages = allPackages.filter((p) => p.isActive !== false);
  const isEdit = !!customer;

  const [form, setFormState] = useState(
    isEdit ? { ...customer, startDate: today() } : INITIAL,
  );
  const [payment, setPaymentState] = useState(PAYMENT_INITIAL);
  const [errors, setErrors] = useState({});
  const [dupWarning, setDupWarning] = useState(null);
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.settings.get("areas").then((r) => setAreas(r?.value || []));
    db.settings.get("agents").then((r) => setAgents(r?.value || []));
  }, []);

  // When package changes, auto-fill amountPaid with full price as default
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isEdit && form.packageId) {
        const pkg = packages.find(
          (p) => Number(p.id) === Number(form.packageId),
        );
        if (pkg && !payment.amountPaid) {
          setPaymentState((p) => ({ ...p, amountPaid: String(pkg.price) }));
        }
      }
    }, 0);
    return clearTimeout(timer);
  }, [form.packageId, isEdit, packages, payment]);

  const setField = (field, value) => {
    setFormState((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const setPayField = (field, value) => {
    setPaymentState((p) => ({ ...p, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const checkDup = useCallback(
    async (field, value) => {
      if (!value) return setDupWarning(null);
      const result = await checkDuplicate(
        field === "userName" ? value : form.userName,
        field === "mobileNo" ? value : form.mobileNo,
        isEdit ? customer.id : null,
      );
      if (result.hasDuplicate) {
        setDupWarning(
          `${field === "userName" ? "Username" : "Mobile"} already used by: ${result.existing.fullName}`,
        );
      } else {
        setDupWarning(null);
      }
    },
    [form.userName, form.mobileNo, isEdit, customer],
  );

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Required";
    if (!form.userName.trim()) e.userName = "Required";
    if (!form.packageId) e.packageId = "Select a package";
    if (!form.mainArea) e.mainArea = "Select an area";
    if (form.mobileNo && String(form.mobileNo).replace(/\D/g, "").length < 10)
      e.mobileNo = "Must be at least 10 digits";

    // Validate payment section only if enabled
    if (!isEdit && payment.recordPayment) {
      const amt = Number(payment.amountPaid);
      if (!payment.amountPaid || amt <= 0)
        e.amountPaid = "Enter a valid amount";
      const pkg = packages.find((p) => Number(p.id) === Number(form.packageId));
      if (pkg && amt > pkg.price)
        e.amountPaid = `Cannot exceed PKR ${pkg.price} (package price)`;
      if (!payment.paymentDate) e.paymentDate = "Required";
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (dupWarning) return;

    setSaving(true);
    try {
      const pkgId = Number(form.packageId);
      const pkg = packages.find((p) => Number(p.id) === pkgId);
      const lockedPrice = pkg ? Number(pkg.price) : 0;

      if (isEdit) {
        await updateCustomer(customer.id, {
          fullName: form.fullName.trim(),
          userName: form.userName.trim(),
          mobileNo: form.mobileNo,
          mainArea: form.mainArea,
          recoveryAgent: form.recoveryAgent,
          packageId: pkgId,
          lockedPackagePrice: lockedPrice,
          status: form.status,
          notes: form.notes,
        });
      } else {
        const newCustomer = await addCustomer({
          fullName: form.fullName.trim(),
          userName: form.userName.trim(),
          mobileNo: form.mobileNo,
          mainArea: form.mainArea,
          recoveryAgent: form.recoveryAgent,
          packageId: pkgId,
          lockedPackagePrice: lockedPrice,
          status: "active",
          notes: form.notes,
        });

        // Always create the billing cycle first
        const newCycle = await createInitialCycle(
          newCustomer.id,
          form.startDate,
          lockedPrice,
        );

        // If staff also entered a payment, record it immediately
        if (payment.recordPayment && Number(payment.amountPaid) > 0) {
          await addInstallment(
            newCycle.id,
            Number(payment.amountPaid),
            payment.paymentDate,
            payment.paymentNote || "",
          );
        }
      }
      onClose();
    } catch (err) {
      alert("Error saving: " + err.message);
    }
    setSaving(false);
  };

  // Derived: selected package price for display
  const selectedPkg = packages.find(
    (p) => Number(p.id) === Number(form.packageId),
  );
  const packagePrice = selectedPkg ? Number(selectedPkg.price) : 0;
  const amountPaidNum = Number(payment.amountPaid) || 0;
  const remaining = packagePrice - amountPaidNum;

  return (
    <div className="space-y-5">
      {/* ── DUPLICATE WARNING ── */}
      {dupWarning && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded-lg">
          ⚠ Duplicate detected: {dupWarning}
        </div>
      )}

      {/* ── CUSTOMER INFO ── */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Customer Information
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name *" error={errors.fullName}>
            <input
              className={inp(errors.fullName)}
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="e.g. Muhammad Qasim"
            />
          </Field>

          <Field label="Username *" error={errors.userName}>
            <input
              className={inp(errors.userName)}
              value={form.userName}
              onChange={(e) => {
                setField("userName", e.target.value);
                checkDup("userName", e.target.value);
              }}
              placeholder="e.g. Qasim6655"
            />
          </Field>

          <Field label="Mobile No" error={errors.mobileNo}>
            <input
              className={inp(errors.mobileNo)}
              value={form.mobileNo}
              onChange={(e) => {
                setField("mobileNo", e.target.value);
                checkDup("mobileNo", e.target.value);
              }}
              placeholder="e.g. 3001234567"
              type="tel"
            />
          </Field>

          <Field label="Package *" error={errors.packageId}>
            <select
              className={inp(errors.packageId)}
              value={form.packageId}
              onChange={(e) => {
                setField("packageId", e.target.value);
                // Reset payment amount so it auto-fills with new price
                setPaymentState((p) => ({ ...p, amountPaid: "" }));
              }}
            >
              <option value="">— Select Package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — PKR {Number(p.price).toLocaleString()}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Main Area *" error={errors.mainArea}>
            <select
              className={inp(errors.mainArea)}
              value={form.mainArea}
              onChange={(e) => setField("mainArea", e.target.value)}
            >
              <option value="">— Select Area —</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Recovery Agent">
            <select
              className={inp()}
              value={form.recoveryAgent}
              onChange={(e) => setField("recoveryAgent", e.target.value)}
            >
              <option value="">— Select Agent —</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          {!isEdit && (
            <Field label="Subscription Start Date *">
              <input
                type="date"
                className={inp()}
                value={form.startDate}
                max={today()}
                onChange={(e) => setField("startDate", e.target.value)}
              />
            </Field>
          )}

          {isEdit && (
            <Field label="Status">
              <select
                className={inp()}
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </Field>
          )}
        </div>

        <div className="mt-4">
          <Field label="Notes">
            <textarea
              className={inp() + " resize-none"}
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional notes..."
            />
          </Field>
        </div>
      </div>

      {/* ── PAYMENT SECTION (Add mode only) ── */}
      {!isEdit && (
        <div className="border-t border-gray-200 pt-4">
          {/* Toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
            <div
              onClick={() =>
                setPayField("recordPayment", !payment.recordPayment)
              }
              className={`relative w-11 h-6 rounded-full transition-colors ${
                payment.recordPayment ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  payment.recordPayment ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-800">
                Record First Payment Now
              </span>
              <p className="text-xs text-gray-400">
                Optionally log a payment while adding the customer
              </p>
            </div>
          </label>

          {payment.recordPayment && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
              {/* Package price hint */}
              {selectedPkg && (
                <div className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-4 py-2 text-sm">
                  <span className="text-gray-500">Package Total</span>
                  <span className="font-bold text-gray-800">
                    PKR {packagePrice.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount Paid *" error={errors.amountPaid}>
                  <input
                    type="number"
                    min="1"
                    max={packagePrice || undefined}
                    className={inp(errors.amountPaid)}
                    value={payment.amountPaid}
                    onChange={(e) => setPayField("amountPaid", e.target.value)}
                    placeholder={`Max PKR ${packagePrice.toLocaleString()}`}
                  />
                </Field>

                <Field label="Payment Date *" error={errors.paymentDate}>
                  <input
                    type="date"
                    className={inp(errors.paymentDate)}
                    value={payment.paymentDate}
                    max={today()}
                    onChange={(e) => setPayField("paymentDate", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Payment Note (optional)">
                <input
                  className={inp()}
                  value={payment.paymentNote}
                  onChange={(e) => setPayField("paymentNote", e.target.value)}
                  placeholder="e.g. Cash received, Bank transfer..."
                />
              </Field>

              {/* Live remaining balance */}
              {selectedPkg && amountPaidNum > 0 && (
                <div
                  className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm font-semibold ${
                    remaining <= 0
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  <span>
                    {remaining <= 0 ? "✓ Fully Paid" : "Remaining Balance"}
                  </span>
                  <span>
                    {remaining <= 0
                      ? "PKR 0"
                      : `PKR ${remaining.toLocaleString()}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER BUTTONS ── */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !!dupWarning}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : isEdit
              ? "Save Changes"
              : payment.recordPayment
                ? "Add Customer & Record Payment"
                : "Add Customer"}
        </button>
      </div>
    </div>
  );
}

const inp = (err) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    err ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
  }`;

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
