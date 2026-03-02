import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ExpenseForm from "./ExpenseForm";
import useExpenseStore, {
  EXPENSE_CATEGORIES,
} from "../../store/useExpenseStore";
import { formatDate } from "../../utils/dateUtils";

const PAGE_SIZE = 20;

// Pagination Component
function Pagination({ page, total, count, pageSize, onChange }) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <span className="text-xs text-gray-500 font-medium">
        Showing {count === 0 ? 0 : start}–{end} of {count} expenses
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: total }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === total || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, idx) =>
            p === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-xs text-gray-400"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`min-w-[28px] h-7 rounded-lg text-xs font-bold transition-all border ${
                  p === page
                    ? "bg-gray-800 text-white border-gray-900 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === total || total === 0}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Expenses() {
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);

  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [pendingEditExpense, setPendingEditExpense] = useState(null); // Intercepts edit for password
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters & Pagination
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when search or category changes
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(t);
  }, [searchQuery, filterCategory]);

  // Apply Search & Filters
  const filtered = expenses.filter((e) => {
    const matchCategory =
      filterCategory === "all" || e.category === filterCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      e.nameOrDept?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q);

    return matchCategory && matchSearch;
  });

  // Sort (Newest first)
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginatedExpenses = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Totals
  const grandTotal = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );
  const filteredTotal = filtered.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track operational costs, salaries, and uplink bills.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
              Total Expenses (All Time)
            </p>
            <p className="text-xl font-black text-red-700 leading-tight">
              PKR {grandTotal.toLocaleString()}
            </p>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all active:scale-95 h-full"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Controls: Search & Category Chips */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by vendor, name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 p-0.5 rounded-md transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              filterCategory === "all"
                ? "bg-gray-800 text-white border-gray-900 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All Categories
          </button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                filterCategory === c
                  ? "bg-gray-800 text-white border-gray-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Context Banner */}
      {(filterCategory !== "all" || searchQuery) && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-blue-700 font-medium">
            Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {filterCategory !== "all" && (
              <span>
                {" "}
                for <strong className="font-bold">"{filterCategory}"</strong>
              </span>
            )}
            {searchQuery && (
              <span>
                {" "}
                matching <strong className="font-bold">"{searchQuery}"</strong>
              </span>
            )}
          </span>
          <span className="font-bold text-blue-800">
            Total: PKR {filteredTotal.toLocaleString()}
          </span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-bold text-xs whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 font-bold text-xs whitespace-nowrap">
                  Category
                </th>
                <th className="px-4 py-3 font-bold text-xs whitespace-nowrap">
                  Vendor / Dept
                </th>
                <th className="px-4 py-3 font-bold text-xs">Description</th>
                <th className="px-4 py-3 font-bold text-xs text-right whitespace-nowrap">
                  Amount
                </th>
                <th className="px-4 py-3 font-bold text-xs text-center w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedExpenses.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                    {e.nameOrDept}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">
                    {e.description || (
                      <span className="italic text-gray-300">
                        No description
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-black text-gray-900 text-right whitespace-nowrap">
                    PKR {Number(e.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                      {/* Edit Button opens password prompt first */}
                      <button
                        onClick={() => setPendingEditExpense(e)}
                        className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                        title="Edit Expense"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(e)}
                        className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                        title="Delete Expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center">
                        <Receipt size={24} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {searchQuery || filterCategory !== "all"
                          ? "No expenses match your filters."
                          : "No expenses recorded yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Render Pagination only if there are items */}
        {sorted.length > 0 && (
          <Pagination
            page={currentPage}
            total={totalPages}
            count={sorted.length}
            pageSize={PAGE_SIZE}
            onChange={(p) => setCurrentPage(p)}
          />
        )}
      </div>

      {/* ── Modals ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Expense"
        size="md"
      >
        <ExpenseForm onClose={() => setShowAdd(false)} />
      </Modal>

      {/* Actual Edit Modal */}
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

      {/* Password Prompt for Edit */}
      <ConfirmDialog
        isOpen={!!pendingEditExpense}
        onClose={() => setPendingEditExpense(null)}
        onConfirm={() => {
          setEditExpense(pendingEditExpense); // Open the edit form
          setPendingEditExpense(null); // Close this dialog
        }}
        title="Authorize Edit"
        message="Editing a logged expense alters financial history. Please enter the Admin password to proceed."
        confirmLabel="Proceed to Edit"
        requirePassword={true}
        danger={false} // Makes button Blue instead of Red
      />

      {/* Password Prompt for Delete */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteExpense(deleteTarget.id)}
        title="Delete Expense"
        message={
          <>
            Are you sure you want to delete this{" "}
            <strong>{deleteTarget?.category}</strong> expense of{" "}
            <strong className="text-red-600">
              PKR {deleteTarget?.amount?.toLocaleString()}
            </strong>
            ? This action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete"
        requirePassword={true} // Now protected
        danger={true}
      />
    </div>
  );
}
