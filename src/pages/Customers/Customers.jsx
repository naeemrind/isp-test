import { useState } from "react";
import {
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CustomerTable from "./CustomerTable";
import CustomerForm from "./CustomerForm";
import PaymentForm from "../Payments/PaymentForm";
import useCustomerStore from "../../store/useCustomerStore";
import usePaymentStore from "../../store/usePaymentStore";
import { formatDate } from "../../utils/dateUtils";
import HistoryModal from "../../components/ui/HistoryModal";

export default function Customers() {
  const customers = useCustomerStore((s) => s.customers);
  const archiveCustomer = useCustomerStore((s) => s.archiveCustomer);
  const restoreCustomer = useCustomerStore((s) => s.restoreCustomer);
  const permanentlyDeleteCustomer = useCustomerStore(
    (s) => s.permanentlyDeleteCustomer,
  );
  const getCyclesForCustomer = usePaymentStore((s) => s.getCyclesForCustomer);
  const getActiveCycle = usePaymentStore((s) => s.getActiveCycle);

  const [view, setView] = useState("active");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // Default sort

  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [payCustomer, setPayCustomer] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null); // <-- Add State for History

  const activeCustomers = customers.filter((c) => !c.isArchived);
  const archivedCustomers = customers.filter((c) => c.isArchived);

  // 1. FILTERING
  const q = search.toLowerCase();
  const matchSearch = (c) =>
    !search ||
    c.fullName?.toLowerCase().includes(q) ||
    c.userName?.toLowerCase().includes(q) ||
    c.mobileNo?.includes(q) ||
    c.mainArea?.toLowerCase().includes(q);

  const filteredActive = activeCustomers.filter((c) => {
    const matchFilter =
      filter === "active"
        ? c.status === "active"
        : filter === "suspended"
          ? c.status === "suspended"
          : filter === "terminated"
            ? c.status === "terminated"
            : true;
    return matchFilter && matchSearch(c);
  });

  // 2. SORTING
  // Removed useMemo because filteredActive is a new reference every render.
  const sortedActive = [...filteredActive].sort((a, b) => {
    const cycleA = getActiveCycle(a.id);
    const cycleB = getActiveCycle(b.id);

    switch (sortBy) {
      case "name":
        return a.fullName.localeCompare(b.fullName);

      case "pending":
        // Highest balance first
        return (cycleB?.amountPending || 0) - (cycleA?.amountPending || 0);

      case "expiring":
        // Soonest expiry date first.
        // If no cycle (e.g. new/terminated), push to bottom.
        if (!cycleA) return 1;
        if (!cycleB) return -1;
        return new Date(cycleA.cycleEndDate) - new Date(cycleB.cycleEndDate);

      case "newest":
      default:
        // IDs are auto-incrementing, so higher ID = newer
        return b.id - a.id;
    }
  });

  const filteredArchived = archivedCustomers.filter(matchSearch);

  return (
    <div className="p-4 space-y-3">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-800">Customers</h1>

          {/* Active / Archived tab switcher */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("active")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === "active"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Active
              <span className="ml-1.5 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">
                {activeCustomers.length}
              </span>
            </button>
            <button
              onClick={() => setView("archived")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === "archived"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Archived
              {archivedCustomers.length > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-xs">
                  {archivedCustomers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {view === "active" && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={14} /> Add Customer
          </button>
        )}
      </div>

      {/* SEARCH + FILTER + SORT */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Left Side: Search & Status Filters */}
        <div className="flex items-center gap-2 flex-1 min-w-62.5">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-2.5 top-2 text-gray-400"
            />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === "active" && (
            <div className="flex gap-1">
              {["all", "active", "suspended"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded capitalize ${
                    filter === f
                      ? "bg-gray-800 text-white"
                      : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Sorting Dropdown */}
        {view === "active" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Sort by:</span>
            <div className="relative">
              <ArrowUpDown
                size={14}
                className="absolute left-2.5 top-2 text-gray-500 pointer-events-none"
              />
              <select
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer appearance-none min-w-35"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="expiring">Expiring Soon</option>
                <option value="pending">Highest Debt</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE TABLE */}
      {view === "active" && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <CustomerTable
            customers={sortedActive}
            searchQuery={""}
            onEdit={(c) => setEditCustomer(c)}
            onPay={(c) => setPayCustomer(c)}
            onDelete={(c) => setArchiveTarget(c)}
            onHistory={(c) => setHistoryCustomer(c)}
          />
        </div>
      )}

      {/* ARCHIVED TABLE */}
      {view === "archived" && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          {filteredArchived.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
              <Archive size={36} className="text-gray-300" />
              <p className="text-sm font-medium">No archived customers</p>
              <p className="text-xs text-gray-300">
                Deleted customers appear here — nothing is ever lost.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Area</th>
                  <th className="px-4 py-2.5 font-medium">Archived On</th>
                  <th className="px-4 py-2.5 font-medium">Reason</th>
                  <th className="px-4 py-2.5 font-medium">Total Ever Paid</th>
                  <th className="px-4 py-2.5 font-medium">Cycles</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchived.map((c) => {
                  const cycles = getCyclesForCustomer(c.id);
                  const totalPaid = cycles.reduce(
                    (sum, cy) =>
                      sum +
                      (cy.installments || []).reduce(
                        (s, i) => s + (i.amountPaid || 0),
                        0,
                      ),
                    0,
                  );
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">
                          {c.fullName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {c.userName}
                        </div>
                        {c.mobileNo && (
                          <div className="text-xs text-gray-400">
                            {c.mobileNo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.mainArea || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.archivedAt ? formatDate(c.archivedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-50">
                        {c.archiveReason || (
                          <span className="text-gray-300 italic">
                            No reason given
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        PKR {totalPaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {cycles.length}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setRestoreTarget(c)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                          >
                            <ArchiveRestore size={12} /> Restore
                          </button>
                          <button
                            onClick={() => setPurgeTarget(c)}
                            title="Permanently delete all data"
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                          >
                            <Trash2 size={12} /> Purge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODALS */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Customer"
        size="lg"
      >
        <CustomerForm onClose={() => setShowAdd(false)} />
      </Modal>

      <Modal
        isOpen={!!editCustomer}
        onClose={() => setEditCustomer(null)}
        title="Edit Customer"
        size="lg"
      >
        {editCustomer && (
          <CustomerForm
            customer={editCustomer}
            onClose={() => setEditCustomer(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!payCustomer}
        onClose={() => setPayCustomer(null)}
        title="Record Payment"
        size="md"
      >
        {payCustomer && (
          <PaymentForm
            customer={payCustomer}
            onClose={() => setPayCustomer(null)}
          />
        )}
      </Modal>

      <HistoryModal
        customer={historyCustomer}
        onClose={() => setHistoryCustomer(null)}
      />

      {/* Archive dialog */}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={(reason) => archiveCustomer(archiveTarget.id, reason)}
        title="Archive Customer"
        message={`"${archiveTarget?.fullName}" will be moved to the Archived tab. All payment history is preserved and you can restore them at any time.`}
        confirmLabel="Archive Customer"
        confirmText={archiveTarget?.fullName}
        showReason
        reasonLabel="Reason for archiving (optional)"
        danger
      />

      {/* Restore dialog */}
      <ConfirmDialog
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreCustomer(restoreTarget.id)}
        title="Restore Customer"
        message={`Restore "${restoreTarget?.fullName}" back to Active customers? Their full payment history will remain intact.`}
        confirmLabel="Yes, Restore"
        danger={false}
      />

      {/* Purge dialog */}
      <ConfirmDialog
        isOpen={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={() => permanentlyDeleteCustomer(purgeTarget.id)}
        title="Permanently Delete"
        message={`This will PERMANENTLY delete "${purgeTarget?.fullName}" and every payment record forever. This cannot be undone.`}
        confirmLabel="Permanently Delete"
        confirmText={purgeTarget?.fullName}
        requirePassword
        danger
      />
    </div>
  );
}
