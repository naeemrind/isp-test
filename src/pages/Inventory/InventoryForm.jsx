import { useState, useEffect } from "react";
import { today } from "../../utils/dateUtils";
import useInventoryStore from "../../store/useInventoryStore";
import {
  Package,
  FileText,
  Calculator,
  ArrowDownCircle,
  ArrowUpCircle,
  Warehouse,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

const UNITS = ["meter", "piece", "box", "roll", "set", "kg", "liter"];

const EMPTY = {
  date: today(),
  invoiceNo: "",
  poNo: "",
  description: "",
  unit: "piece",
  quantity: "",
  stockIn: "",
  stockOut: "",
  unitRate: "",
  remarks: "",
};

export default function InventoryForm({ item, onClose }) {
  const addItem = useInventoryStore((s) => s.addItem);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const isEdit = !!item;

  const initialForm = isEdit
    ? {
        ...item,
        stockIn: item.stockIn ?? item.received ?? "",
        stockOut: item.stockOut ?? item.issued ?? "",
      }
    : EMPTY;

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const qty = Number(form.quantity) || 0;
  const stockIn = Number(form.stockIn) || 0;
  const stockOut = Number(form.stockOut) || 0;
  const inHand = stockIn - stockOut;
  const totalAmount = qty * (Number(form.unitRate) || 0);

  // Auto-fill Stock In when Total Qty is set (only on Add, not Edit)
  // Only auto-fill if stockIn is still empty/zero and user hasn't touched it
  const [stockInTouched, setStockInTouched] = useState(isEdit);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isEdit && !stockInTouched && qty > 0) {
        setForm((f) => ({ ...f, stockIn: String(qty) }));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [qty, isEdit, stockInTouched]);

  const set = (field, value) => {
    if (field === "stockIn") setStockInTouched(true);
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "", stockMovement: "" }));
  };

  // ── Derived warnings ──
  // Stock In + Stock Out must not exceed Total Qty
  const stockInExceedsQty = qty > 0 && stockIn > qty;
  const stockOutExceedsQty = qty > 0 && stockOut > qty;
  const totalMovementExceedsQty = qty > 0 && stockIn + stockOut > qty;
  const stockOutExceedsIn = stockOut > 0 && stockIn > 0 && stockOut > stockIn;
  const stockMovementEmpty = qty > 0 && stockIn === 0 && stockOut === 0;

  // remaining qty not yet assigned to Stock In or Stock Out
  const assigned = stockIn + stockOut;
  const unassigned = qty - assigned;

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.quantity || qty <= 0) e.quantity = "Must be greater than 0";
    if (!form.unitRate || Number(form.unitRate) <= 0)
      e.unitRate = "Must be greater than 0";
    if (qty > 0 && stockIn === 0 && stockOut === 0)
      e.stockMovement =
        "Enter at least Stock In — how many units arrived in your warehouse?";
    if (stockInExceedsQty)
      e.stockIn = `Cannot exceed total qty purchased (${qty})`;
    if (stockOutExceedsQty)
      e.stockOut = `Cannot exceed total qty purchased (${qty})`;
    if (totalMovementExceedsQty)
      e.stockMovement = `Stock In + Stock Out (${assigned}) exceeds total qty purchased (${qty})`;
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        quantity: qty,
        stockIn,
        stockOut,
        inHand: stockIn - stockOut,
        received: stockIn,
        issued: stockOut,
        balanced: stockIn - stockOut,
        unitRate: Number(form.unitRate),
        amount: qty * (Number(form.unitRate) || 0),
      };
      if (isEdit) await updateItem(item.id, data);
      else await addItem(data);
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Section 1: Reference Info ── */}
      <Section icon={<FileText size={13} />} label="Reference Info (optional)">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input
              type="date"
              className={inp()}
              value={form.date}
              max={today()}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Invoice No">
            <input
              className={inp()}
              value={form.invoiceNo}
              placeholder="e.g. INV-001"
              onChange={(e) => set("invoiceNo", e.target.value)}
            />
          </Field>
          <Field label="PO No">
            <input
              className={inp()}
              value={form.poNo}
              placeholder="e.g. PO-2024"
              onChange={(e) => set("poNo", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Section 2: Item Details ── */}
      <Section icon={<Package size={13} />} label="Item Details">
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Description"
            required
            error={errors.description}
            className="col-span-2"
          >
            <input
              className={inp(errors.description)}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Fiber Cable, ONU Device, Splitter..."
              autoFocus={!isEdit}
            />
          </Field>
          <Field label="Unit of Measure">
            <select
              className={inp()}
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ── Section 3: Pricing ── */}
      <Section icon={<Calculator size={13} />} label="Pricing">
        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Total Qty Purchased" required error={errors.quantity}>
            <input
              type="number"
              min="1"
              className={inp(errors.quantity)}
              value={form.quantity}
              placeholder="How many did you buy in total?"
              onChange={(e) => set("quantity", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Total units on the purchase invoice.
            </p>
          </Field>
          <Field label="Unit Rate (PKR)" required error={errors.unitRate}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                PKR
              </span>
              <input
                type="number"
                min="0"
                className={`${inp(errors.unitRate)} pl-12`}
                value={form.unitRate}
                placeholder="Cost per unit"
                onChange={(e) => set("unitRate", e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Price you paid per unit.
            </p>
          </Field>
        </div>

        {/* Total Value auto-preview */}
        {totalAmount > 0 && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
            <span className="text-xs text-gray-500 font-medium">
              Total Purchase Value:
            </span>
            <span className="text-sm font-black text-gray-900">
              PKR {totalAmount.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">
              ({qty} {form.unit || "units"} × PKR{" "}
              {Number(form.unitRate || 0).toLocaleString()})
            </span>
          </div>
        )}
      </Section>

      {/* ── Section 4: Stock Movement ── */}
      <Section icon={<Warehouse size={13} />} label="Stock Movement">
        {/* Explainer */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            <strong>
              Stock In + Stock Out must equal Total Qty ({qty || "?"}).
            </strong>{" "}
            Usually all {qty || "?"} units go to Stock In (arrived in
            warehouse). Only split if some were issued directly on the same day
            you received them.
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 items-start">
          {/* Stock In */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <ArrowDownCircle size={13} className="text-green-600" />
                <span>Stock In</span>
                <span className="font-normal text-gray-400 text-xs">
                  (in warehouse)
                </span>
              </span>
            }
            required
            error={errors.stockIn}
          >
            <input
              type="number"
              min="0"
              max={qty || undefined}
              className={inp(errors.stockIn || stockInExceedsQty)}
              value={form.stockIn}
              placeholder={qty ? `Max ${qty}` : "Units received"}
              onChange={(e) => set("stockIn", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Units physically in your warehouse now.
            </p>
          </Field>

          {/* Stock Out */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <ArrowUpCircle size={13} className="text-red-500" />
                <span>Stock Out</span>
                <span className="font-normal text-gray-400 text-xs">
                  (already issued)
                </span>
              </span>
            }
            error={errors.stockOut}
          >
            <input
              type="number"
              min="0"
              max={qty || undefined}
              className={inp(
                errors.stockOut || stockOutExceedsQty || stockOutExceedsIn,
              )}
              value={form.stockOut}
              placeholder="0"
              onChange={(e) => set("stockOut", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Units already given to technicians.
            </p>
          </Field>

          {/* In Hand (auto) */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <Warehouse size={13} className="text-purple-600" />
                <span>In Hand</span>
                <span className="font-normal text-gray-400 text-xs">
                  (auto)
                </span>
              </span>
            }
          >
            <div
              className={`w-full border rounded-lg px-3 h-10 flex items-center text-sm font-bold ${
                inHand < 0
                  ? "bg-red-50 border-red-200 text-red-600"
                  : inHand === 0 && qty > 0
                    ? "bg-amber-50 border-amber-200 text-amber-600"
                    : inHand > 0
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              {inHand} {form.unit || "units"}
            </div>
            <p className="text-xs text-gray-400 mt-1">Stock In − Stock Out.</p>
          </Field>
        </div>

        {/* ── Validation warnings ── */}
        {stockMovementEmpty && !errors.stockMovement && qty > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
            <AlertTriangle size={13} className="shrink-0" />
            Enter Stock In — how many of the {qty} {form.unit}s arrived in your
            warehouse?
          </div>
        )}

        {errors.stockMovement && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 font-medium">
            <AlertTriangle size={13} className="shrink-0" />
            {errors.stockMovement}
          </div>
        )}

        {stockOutExceedsIn && !stockInExceedsQty && !stockOutExceedsQty && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
            <AlertTriangle size={13} className="shrink-0" />
            Stock Out is more than Stock In — In Hand will be negative. Please
            check your numbers.
          </div>
        )}

        {/* ── Unassigned hint (helpful nudge) ── */}
        {qty > 0 && assigned > 0 && assigned < qty && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
            <Info size={13} className="shrink-0" />
            {unassigned} {form.unit}
            {unassigned !== 1 ? "s" : ""} still unaccounted for (Total {qty} −
            assigned {assigned} = {unassigned}). Add them to Stock In if they
            are in your warehouse.
          </div>
        )}

        {/* ── Perfect match confirmation ── */}
        {qty > 0 && assigned === qty && assigned > 0 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-medium">
            <CheckCircle size={13} className="shrink-0" />
            All {qty} {form.unit}s accounted for — Stock In ({stockIn}) + Stock
            Out ({stockOut}) = {qty} ✓
          </div>
        )}
      </Section>

      {/* ── Remarks ── */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          Remarks <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          className={inp()}
          value={form.remarks}
          placeholder="Supplier name, location, notes..."
          onChange={(e) => set("remarks", e.target.value)}
        />
      </div>

      {/* ── Summary Banner ── */}
      {totalAmount > 0 && form.description && inHand >= 0 && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 leading-relaxed">
            <span className="font-semibold">{form.description}</span>
            {" — "}
            {qty} {form.unit} @ PKR{" "}
            {Number(form.unitRate || 0).toLocaleString()} each
            {" = "}
            <span className="font-bold">
              PKR {totalAmount.toLocaleString()}
            </span>
            {stockIn > 0 && (
              <span className="ml-2 text-green-700 font-medium">
                · {stockIn} in warehouse
              </span>
            )}
            {stockOut > 0 && (
              <span className="ml-2 text-red-500 font-medium">
                · {stockOut} already issued
              </span>
            )}
            {inHand > 0 && (
              <span className="ml-2 text-purple-600 font-medium">
                · {inHand} in hand
              </span>
            )}
          </div>
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
          className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ── */
const inp = (err) =>
  `w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
    err ? "border-red-400 bg-red-50" : "border-gray-300"
  }`;

function Section({ icon, label, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1.5">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 mb-1.5 min-h-[16px]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
