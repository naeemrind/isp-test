import { useState } from "react";
import { today } from "../../utils/dateUtils";
import useInventoryStore from "../../store/useInventoryStore";

const UNITS = ["meter", "piece", "box", "roll", "set", "kg", "liter"];

const EMPTY = {
  date: today(),
  invoiceNo: "",
  poNo: "",
  description: "",
  unit: "piece",
  quantity: "",
  received: "",
  issued: "",
  unitRate: "",
  remarks: "",
};

export default function InventoryForm({ item, onClose }) {
  const addItem = useInventoryStore((s) => s.addItem);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const isEdit = !!item;
  const [form, setForm] = useState(isEdit ? item : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const autoCalc = {
    amount: (Number(form.quantity) || 0) * (Number(form.unitRate) || 0),
    balanced: (Number(form.received) || 0) - (Number(form.issued) || 0),
  };

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = "Required";
    if (!form.quantity || Number(form.quantity) <= 0)
      e.quantity = "Must be > 0";
    if (!form.unitRate || Number(form.unitRate) <= 0)
      e.unitRate = "Must be > 0";
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
        quantity: Number(form.quantity),
        received: Number(form.received) || 0,
        issued: Number(form.issued) || 0,
        unitRate: Number(form.unitRate),
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
            onChange={(e) => set("invoiceNo", e.target.value)}
          />
        </Field>
        <Field label="PO No">
          <input
            className={inp()}
            value={form.poNo}
            onChange={(e) => set("poNo", e.target.value)}
          />
        </Field>
        <Field label="Unit">
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
        <Field
          label="Description *"
          error={errors.description}
          className="col-span-2"
        >
          <input
            className={inp(errors.description)}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. Fiber Cable Rim"
          />
        </Field>
        <Field label="Quantity *" error={errors.quantity}>
          <input
            type="number"
            min="0"
            className={inp(errors.quantity)}
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </Field>
        <Field label="Received">
          <input
            type="number"
            min="0"
            className={inp()}
            value={form.received}
            onChange={(e) => set("received", e.target.value)}
          />
        </Field>
        <Field label="Issued">
          <input
            type="number"
            min="0"
            className={inp()}
            value={form.issued}
            onChange={(e) => set("issued", e.target.value)}
          />
        </Field>
        <Field label="Balanced (auto)">
          <input
            readOnly
            className={inp() + " bg-gray-50 text-gray-500"}
            value={autoCalc.balanced}
          />
        </Field>
        <Field label="Unit Rate (PKR) *" error={errors.unitRate}>
          <input
            type="number"
            min="0"
            className={inp(errors.unitRate)}
            value={form.unitRate}
            onChange={(e) => set("unitRate", e.target.value)}
          />
        </Field>
        <Field label="Amount (auto)">
          <input
            readOnly
            className={inp() + " bg-gray-50 text-gray-500 font-medium"}
            value={`PKR ${autoCalc.amount.toLocaleString()}`}
          />
        </Field>
      </div>
      <Field label="Remarks">
        <input
          className={inp()}
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
        </button>
      </div>
    </div>
  );
}

const inp = (err) =>
  `w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${err ? "border-red-400" : "border-gray-300"}`;
function Field({ label, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
