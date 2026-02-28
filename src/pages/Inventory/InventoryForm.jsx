import { useState } from "react";
import { today } from "../../utils/dateUtils";
import useInventoryStore from "../../store/useInventoryStore";
import {
  Package,
  FileText,
  Ruler,
  Calculator,
  ArrowDownCircle,
  ArrowUpCircle,
  Warehouse,
  CheckCircle,
  AlertTriangle,
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

  // Map legacy field names to new ones when editing
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

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const inHand = (Number(form.stockIn) || 0) - (Number(form.stockOut) || 0);
  const totalAmount =
    (Number(form.quantity) || 0) * (Number(form.unitRate) || 0);
  const stockOutExceedsIn =
    Number(form.stockOut) > 0 &&
    Number(form.stockIn) > 0 &&
    Number(form.stockOut) > Number(form.stockIn);

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.quantity || Number(form.quantity) <= 0)
      e.quantity = "Must be greater than 0";
    if (!form.unitRate || Number(form.unitRate) <= 0)
      e.unitRate = "Must be greater than 0";
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
      const stockIn = Number(form.stockIn) || 0;
      const stockOut = Number(form.stockOut) || 0;
      const data = {
        ...form,
        quantity: Number(form.quantity),
        stockIn,
        stockOut,
        inHand: stockIn - stockOut,
        // Keep legacy fields in sync for backward compatibility
        received: stockIn,
        issued: stockOut,
        balanced: stockIn - stockOut,
        unitRate: Number(form.unitRate),
        amount: (Number(form.quantity) || 0) * (Number(form.unitRate) || 0),
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

      {/* ── Section 3: Quantity Purchased ── */}
      <Section icon={<Ruler size={13} />} label="Quantity Purchased">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Qty Purchased" required error={errors.quantity}>
            <input
              type="number"
              min="0"
              className={inp(errors.quantity)}
              value={form.quantity}
              placeholder="How many did you buy in total?"
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <div className="flex items-end pb-0.5">
            <p className="text-xs text-gray-400 leading-relaxed">
              This is the total purchase order quantity — used to calculate
              total value.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Section 4: Stock Movement ── */}
      <Section icon={<Warehouse size={13} />} label="Stock Movement">
        <div className="grid grid-cols-3 gap-3">
          {/* Stock In */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <ArrowDownCircle size={13} className="text-green-600" />
                <span>Stock In</span>
                <span className="font-normal text-gray-400">
                  (arrived in warehouse)
                </span>
              </span>
            }
          >
            <input
              type="number"
              min="0"
              className={inp()}
              value={form.stockIn}
              placeholder="Units received so far"
              onChange={(e) => set("stockIn", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              How many units physically arrived at your store.
            </p>
          </Field>

          {/* Stock Out */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <ArrowUpCircle size={13} className="text-red-500" />
                <span>Stock Out</span>
                <span className="font-normal text-gray-400">
                  (issued to field)
                </span>
              </span>
            }
          >
            <input
              type="number"
              min="0"
              className={inp(stockOutExceedsIn ? "err" : "")}
              value={form.stockOut}
              placeholder="Units given to technicians"
              onChange={(e) => set("stockOut", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Units used for customer connections or fieldwork.
            </p>
          </Field>

          {/* In Hand (auto) */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                <Warehouse size={13} className="text-purple-600" />
                <span>In Hand</span>
                <span className="font-normal text-gray-400">
                  (auto calculated)
                </span>
              </span>
            }
          >
            <div
              className={`w-full border rounded-lg px-3 h-10 flex items-center text-sm font-bold ${
                inHand < 0
                  ? "bg-red-50 border-red-200 text-red-600"
                  : inHand === 0
                    ? "bg-gray-50 border-gray-200 text-gray-400"
                    : "bg-green-50 border-green-200 text-green-700"
              }`}
            >
              {inHand} {form.unit || "units"}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Stock In minus Stock Out.
            </p>
          </Field>
        </div>

        {/* Warning if stock out exceeds stock in */}
        {stockOutExceedsIn && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium mt-1">
            <AlertTriangle size={13} className="shrink-0" />
            Stock Out is greater than Stock In. Please double-check your
            numbers.
          </div>
        )}
      </Section>

      {/* ── Section 5: Pricing ── */}
      <Section icon={<Calculator size={13} />} label="Pricing">
        <div className="grid grid-cols-2 gap-3">
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
          </Field>
          <Field label="Total Value (auto)">
            <div
              className={`w-full border rounded-lg px-3 h-10 flex items-center text-sm font-bold transition-colors ${
                totalAmount > 0
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              PKR {totalAmount > 0 ? totalAmount.toLocaleString() : "0"}
            </div>
            <p className="text-xs text-gray-400 mt-1">Total Qty × Unit Rate</p>
          </Field>
        </div>
      </Section>

      {/* ── Remarks ── */}
      <Field label="Remarks (optional)">
        <input
          className={inp()}
          value={form.remarks}
          placeholder="Any additional notes, e.g. supplier name, location..."
          onChange={(e) => set("remarks", e.target.value)}
        />
      </Field>

      {/* ── Summary Banner ── */}
      {totalAmount > 0 && form.description && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <span className="font-semibold">{form.description}</span>
            {" — "}
            {form.quantity} {form.unit} @ PKR{" "}
            {Number(form.unitRate || 0).toLocaleString()} each
            {" = "}
            <span className="font-bold">
              PKR {totalAmount.toLocaleString()}
            </span>
            {Number(form.stockIn) > 0 && (
              <span className="ml-2 text-green-600">
                · {form.stockIn} {form.unit} in warehouse
              </span>
            )}
            {Number(form.stockOut) > 0 && (
              <span className="ml-2 text-red-500">
                · {form.stockOut} {form.unit} issued
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
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
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
