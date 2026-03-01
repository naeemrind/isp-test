import { useState, useEffect } from "react";
import {
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CustomerTable from "./CustomerTable";
import { getCycleFacts } from "../../utils/Statusutils";
import CustomerForm from "./CustomerForm";
import PaymentForm from "../Payments/PaymentForm";
import NewConnectionForm from "./NewConnectionForm";
import useCustomerStore from "../../store/useCustomerStore";
import usePaymentStore from "../../store/usePaymentStore";
import { formatDate } from "../../utils/dateUtils";

function Pagination({ page, total, count, pageSize, onChange }) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-xs text-gray-400">
        Showing {start}–{end} of {count}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
                className={`min-w-7 h-7 rounded-lg text-xs font-semibold border ${
                  p === page
                    ? "bg-gray-800 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === total}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Customers({ initialFilter }) {
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
  const [sortBy, setSortBy] = useState("newest");
  const [archiveFilter, setArchiveFilter] = useState("all");
  const [archiveSort, setArchiveSort] = useState("newest");
  const [activePage, setActivePage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  const PAGE_SIZE = 20;

  // Modal state
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [editSubscriber, setEditSubscriber] = useState(null);
  const [paySubscriber, setPaySubscriber] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (initialFilter) {
        setFilter(initialFilter);
        setActivePage(1);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [initialFilter]);

  useEffect(() => {
    const t = setTimeout(() => setActivePage(1), 0);
    return () => clearTimeout(t);
  }, [search, filter, sortBy]);

  useEffect(() => {
    const t = setTimeout(() => setArchivePage(1), 0);
    return () => clearTimeout(t);
  }, [search]);

  const activeCustomers = customers.filter((c) => !c.isArchived);
  const archivedCustomers = customers.filter((c) => c.isArchived);

  const q = search.toLowerCase();
  const matchSearch = (c) =>
    !search ||
    c.fullName?.toLowerCase().includes(q) ||
    c.userName?.toLowerCase().includes(q) ||
    c.mobileNo?.includes(q) ||
    c.mainArea?.toLowerCase().includes(q);

  // ── Filter logic ────────────────────────────────────────────────────────────────────
  // IMPORTANT: "expired" and "balance-due" filters use raw cycle facts
  // (getCycleFacts) NOT computeDisplayStatus. This ensures a manually
  // suspended customer whose cycle is also expired still appears correctly.
  // The badge shows "Suspended" but the filter finds them by billing reality.
  const filteredActive = activeCustomers.filter((c) => {
    if (!matchSearch(c)) return false;
    if (filter === "all") return true;

    const cycle = getActiveCycle(c.id);
    const { expired, unpaid } = getCycleFacts(cycle);
    const isSuspended = c.status === "suspended";

    if (filter === "suspended") return isSuspended;
    if (filter === "active") return !isSuspended;
    // expired and balance-due intentionally include suspended customers
    if (filter === "expired") return expired && unpaid;
    if (filter === "balance-due") return unpaid;
    // pending = within cycle, unpaid, not suspended
    if (filter === "pending") return !isSuspended && !expired && unpaid;
    return true;
  });

  const sortedActive = [...filteredActive].sort((a, b) => {
    const cA = getActiveCycle(a.id);
    const cB = getActiveCycle(b.id);
    switch (sortBy) {
      case "name":
        return a.fullName.localeCompare(b.fullName);
      case "pending":
        return (cB?.amountPending || 0) - (cA?.amountPending || 0);
      case "expiring":
        if (!cA) return 1;
        if (!cB) return -1;
        return new Date(cA.cycleEndDate) - new Date(cB.cycleEndDate);
      default:
        return b.id - a.id;
    }
  });

  const filteredArchived = archivedCustomers
    .filter((c) => {
      if (!matchSearch(c)) return false;
      if (archiveFilter === "terminated")
        return c.archiveReason === "Terminated";
      if (archiveFilter === "deleted") return c.archiveReason !== "Terminated";
      return true;
    })
    .sort((a, b) => {
      if (archiveSort === "name") return a.fullName.localeCompare(b.fullName);
      if (archiveSort === "oldest")
        return new Date(a.archivedAt || 0) - new Date(b.archivedAt || 0);
      return new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0);
    });

  const totalActivePages = Math.max(
    1,
    Math.ceil(sortedActive.length / PAGE_SIZE),
  );
  const totalArchivePages = Math.max(
    1,
    Math.ceil(filteredArchived.length / PAGE_SIZE),
  );
  const pagedActive = sortedActive.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );
  const pagedArchived = filteredArchived.slice(
    (archivePage - 1) * PAGE_SIZE,
    archivePage * PAGE_SIZE,
  );

  // ── Filter tab definitions ─────────────────────────────────────────────────
  // "Overdue" label is removed — replaced with "Expired" to match status badge.
  // "Balance Due" = pending + expired (all who owe money).
  const filterOptions = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending" }, // within cycle, unpaid
    { id: "expired", label: "Expired" }, // cycle ended, unpaid (was "Overdue")
    { id: "balance-due", label: "Balance Due" }, // pending + expired combined
    { id: "suspended", label: "Suspended" },
  ];

  return (
    <div className="p-4 space-y-3">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-800">Subscribers</h1>

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
            onClick={() => setShowNewConnection(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            <Zap size={14} /> New Connection
          </button>
        )}
      </div>

      {/* ── SEARCH + FILTER + SORT ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-62.5">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-2.5 top-2 text-gray-400"
            />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search subscribers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === "active" && (
            <div className="flex gap-1 flex-wrap">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 text-xs rounded capitalize transition-colors ${
                    filter === f.id
                      ? "bg-gray-800 text-white"
                      : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

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

      {/* ── ACTIVE TABLE ── */}
      {view === "active" && (
        <div className="space-y-2">
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <CustomerTable
              customers={pagedActive}
              searchQuery=""
              onEdit={(c) => setEditSubscriber(c)}
              onPay={(c) => setPaySubscriber(c)}
              onDelete={(c) => setArchiveTarget(c)}
            />
          </div>
          {totalActivePages > 1 && (
            <Pagination
              page={activePage}
              total={totalActivePages}
              count={sortedActive.length}
              pageSize={PAGE_SIZE}
              onChange={(p) => setActivePage(p)}
            />
          )}
        </div>
      )}

      {/* ── ARCHIVED TABLE ── */}
      {view === "archived" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[
                { id: "all", label: "All" },
                { id: "deleted", label: "Deleted" },
                { id: "terminated", label: "Terminated" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setArchiveFilter(opt.id);
                    setArchivePage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    archiveFilter === opt.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={archiveSort}
              onChange={(e) => {
                setArchiveSort(e.target.value);
                setArchivePage(1);
              }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-medium"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name A–Z</option>
            </select>
            <span className="text-xs text-gray-400 ml-1">
              {filteredArchived.length} record
              {filteredArchived.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            {filteredArchived.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
                <Archive size={36} className="text-gray-300" />
                <p className="text-sm font-medium">No archived subscribers</p>
                <p className="text-xs text-gray-300">
                  Deleted subscribers appear here — nothing is ever lost.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white text-left text-xs">
                    <th className="px-4 py-2.5 font-medium">Subscriber</th>
                    <th className="px-4 py-2.5 font-medium">Area</th>
                    <th className="px-4 py-2.5 font-medium">Archived On</th>
                    <th className="px-4 py-2.5 font-medium">Reason</th>
                    <th className="px-4 py-2.5 font-medium">Total Ever Paid</th>
                    <th className="px-4 py-2.5 font-medium">Cycles</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedArchived.map((c) => {
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
                    const isTerminated = c.archiveReason === "Terminated";
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
                        <td className="px-4 py-3 text-xs">
                          {isTerminated ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                              Terminated
                            </span>
                          ) : c.archiveReason ? (
                            <span className="text-gray-500">
                              {c.archiveReason}
                            </span>
                          ) : (
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
          {totalArchivePages > 1 && (
            <Pagination
              page={archivePage}
              total={totalArchivePages}
              count={filteredArchived.length}
              pageSize={PAGE_SIZE}
              onChange={(p) => setArchivePage(p)}
            />
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* New Connection */}
      <Modal
        isOpen={showNewConnection}
        onClose={() => setShowNewConnection(false)}
        title="New Connection"
        size="lg"
      >
        <NewConnectionForm onClose={() => setShowNewConnection(false)} />
      </Modal>

      {/* Edit Subscriber */}
      <Modal
        isOpen={!!editSubscriber}
        onClose={() => setEditSubscriber(null)}
        title="Edit Subscriber"
        size="lg"
      >
        {editSubscriber && (
          <CustomerForm
            customer={editSubscriber}
            onClose={() => setEditSubscriber(null)}
          />
        )}
      </Modal>

      {/* Record Payment */}
      <Modal
        isOpen={!!paySubscriber}
        onClose={() => setPaySubscriber(null)}
        title="Record Payment"
        size="md"
      >
        {paySubscriber && (
          <PaymentForm
            customer={paySubscriber}
            onClose={() => setPaySubscriber(null)}
          />
        )}
      </Modal>

      {/* Archive */}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={(reason) => archiveCustomer(archiveTarget.id, reason)}
        title="Archive Subscriber"
        message={`"${archiveTarget?.fullName}" will be moved to the Archived tab. All payment history is preserved.`}
        confirmLabel="Archive Subscriber"
        confirmText={archiveTarget?.fullName}
        showReason
        reasonLabel="Reason for archiving (optional)"
        danger
      />

      {/* Restore */}
      <ConfirmDialog
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreCustomer(restoreTarget.id)}
        title="Restore Subscriber"
        message={`Restore "${restoreTarget?.fullName}" back to active? Their full payment history will remain intact.`}
        confirmLabel="Yes, Restore"
        danger={false}
      />

      {/* Purge */}
      <ConfirmDialog
        isOpen={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={() => permanentlyDeleteCustomer(purgeTarget.id)}
        title="Permanently Delete"
        message={`This will PERMANENTLY delete "${purgeTarget?.fullName}" and all payment records forever. This cannot be undone.`}
        confirmLabel="Permanently Delete"
        confirmText={purgeTarget?.fullName}
        requirePassword
        danger
      />
    </div>
  );
}
