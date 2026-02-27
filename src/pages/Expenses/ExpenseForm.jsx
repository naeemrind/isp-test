import { useState } from "react";
import { today } from "../../utils/dateUtils";
import useExpenseStore, {
  EXPENSE_CATEGORIES,
} from "../../store/useExpenseStore";

const EMPTY = {
  date: today(),
  nameOrDept: "",
  description: "",
  category: "",
  amount: "",
};

export default function ExpenseForm({ expense, onClose }) {
  const addExpense = useExpenseStore((s) => s.addExpense);
  const updateExpense = useExpenseStore((s) => s.updateExpense);
  const isEdit = !!expense;
  const [form, setForm] = useState(isEdit ? expense : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.date) e.date = "Required";
    if (!form.nameOrDept.trim()) e.nameOrDept = "Required";
    if (!form.category) e.category = "Required";
    if (!form.amount || Number(form.amount) <= 0) e.amount = "Must be > 0";
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
      const data = { ...form, amount: Number(form.amount) };
      if (isEdit) await updateExpense(expense.id, data);
      else await addExpense(data);
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date *" error={errors.date}>
          <input
            type="date"
            className={inp(errors.date)}
            value={form.date}
            max={today()}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Category *" error={errors.category}>
          <select
            className={inp(errors.category)}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">— Select Category —</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name / Department *" error={errors.nameOrDept}>
          <input
            className={inp(errors.nameOrDept)}
            value={form.nameOrDept}
            onChange={(e) => set("nameOrDept", e.target.value)}
            placeholder="e.g. Ali Muhammad, Wapda"
          />
        </Field>
        <Field label="Amount (PKR) *" error={errors.amount}>
          <input
            type="number"
            min="1"
            className={inp(errors.amount)}
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </Field>
        <Field label="Description" className="col-span-2">
          <input
            className={inp()}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional details..."
          />
        </Field>
      </div>
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
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Expense"}
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
