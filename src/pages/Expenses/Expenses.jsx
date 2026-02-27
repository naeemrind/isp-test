import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ExpenseForm from "./ExpenseForm";
import useExpenseStore, {
  EXPENSE_CATEGORIES,
} from "../../store/useExpenseStore";
import { formatDate } from "../../utils/dateUtils";

export default function Expenses() {
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");

  const filtered =
    filterCategory === "all"
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);
  const total = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-800">Expenses</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus size={14} /> Add Expense
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1 text-xs rounded ${filterCategory === "all" ? "bg-gray-800 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            className={`px-3 py-1 text-xs rounded ${filterCategory === c ? "bg-gray-800 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-red-50 rounded p-3 text-sm">
        <span className="text-gray-500">
          Total Expenses{filterCategory !== "all" ? ` (${filterCategory})` : ""}
          :
        </span>{" "}
        <strong className="text-red-700">PKR {total.toLocaleString()}</strong>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Name / Dept</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr
                key={e.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {formatDate(e.date)}
                </td>
                <td className="px-3 py-2">{e.nameOrDept}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {e.description || "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {e.category}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  PKR {Number(e.amount).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditExpense(e)}
                      className="p-1 rounded text-gray-500 hover:bg-gray-100"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(e)}
                      className="p-1 rounded text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Expense"
        size="md"
      >
        <ExpenseForm onClose={() => setShowAdd(false)} />
      </Modal>
      <Modal
        isOpen={!!editExpense}
        onClose={() => setEditExpense(null)}
        title="Edit Expense"
        size="md"
      >
        {editExpense && (
          <ExpenseForm
            expense={editExpense}
            onClose={() => setEditExpense(null)}
          />
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteExpense(deleteTarget.id)}
        title="Delete Expense"
        message={`Delete this expense of PKR ${deleteTarget?.amount}?`}
      />
    </div>
  );
}
