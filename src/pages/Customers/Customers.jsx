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
  Package,
  AlertTriangle,
  Calendar,
  Wrench,
  FileText,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CustomerTable from "./CustomerTable";
import { getCycleFacts } from "../../utils/Statusutils";
import CustomerForm from "./CustomerForm";
import PaymentForm from "../Payments/PaymentForm";
import NewConnectionForm from "./NewConnectionForm";
import BulkIssueStockModal from "../../components/ui/BulkIssueStockModal";
import useCustomerStore from "../../store/useCustomerStore";
import useConnectionJobStore from "../../store/useConnectionJobStore";
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
  const jobs = useConnectionJobStore((s) => s.jobs);

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
  const filteredActive = activeCustomers.filter((c) => {
    if (!matchSearch(c)) return false;
    if (filter === "all") return true;

    const cycle = getActiveCycle(c.id);
    const { expired, unpaid } = getCycleFacts(cycle);
    const isSuspended = c.status === "suspended";

    if (filter === "suspended") return isSuspended;
    if (filter === "active") return !isSuspended;
    if (filter === "expired") return expired && unpaid;
    if (filter === "balance-due") return unpaid;
    if (filter === "pending") return !isSuspended && !expired && unpaid;
    if (filter === "renewal-due") return !isSuspended && expired && !unpaid;
    if (filter === "inventory-dues") {
      return jobs.some(
        (j) => j.subscriberId === c.id && (j.amountPending || 0) > 0,
      );
    }
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

  // ── Filter counts ───────────────────────────────────────────────────────────
  const filterCounts = {
    all: activeCustomers.length,
    active: activeCustomers.filter((c) => c.status !== "suspended").length,
    pending: activeCustomers.filter((c) => {
      const cy = getActiveCycle(c.id);
      const { expired, unpaid } = getCycleFacts(cy);
      return c.status !== "suspended" && !expired && unpaid;
    }).length,
    expired: activeCustomers.filter((c) => {
      const cy = getActiveCycle(c.id);
      const { expired, unpaid } = getCycleFacts(cy);
      return expired && unpaid;
    }).length,
    "balance-due": activeCustomers.filter((c) => {
      const cy = getActiveCycle(c.id);
      const { unpaid } = getCycleFacts(cy);
      return unpaid;
    }).length,
    suspended: activeCustomers.filter((c) => c.status === "suspended").length,
    "renewal-due": activeCustomers.filter((c) => {
      const cy = getActiveCycle(c.id);
      const { expired, unpaid } = getCycleFacts(cy);
      return c.status !== "suspended" && expired && !unpaid;
    }).length,
    "inventory-dues": activeCustomers.filter((c) =>
      jobs.some((j) => j.subscriberId === c.id && (j.amountPending || 0) > 0),
    ).length,
  };

  const filterOptions = [
    { id: "all", label: "All", dot: null, activeDot: null },
    {
      id: "active",
      label: "Active",
      dot: "bg-green-400",
      activeDot: "bg-green-300",
    },
    {
      id: "pending",
      label: "Pending",
      dot: "bg-yellow-400",
      activeDot: "bg-yellow-300",
    },
    {
      id: "expired",
      label: "Expired",
      dot: "bg-red-400",
      activeDot: "bg-red-300",
    },
    {
      id: "balance-due",
      label: "Balance Due",
      dot: "bg-orange-400",
      activeDot: "bg-orange-300",
    },
    {
      id: "suspended",
      label: "Suspended",
      dot: "bg-gray-400",
      activeDot: "bg-gray-300",
    },
    {
      id: "renewal-due",
      label: "Renewal Due",
      dot: "bg-orange-400",
      activeDot: "bg-orange-300",
    },
    {
      id: "inventory-dues",
      label: "Inventory Dues",
      dot: "bg-purple-400",
      activeDot: "bg-purple-300",
    },
  ];

  return (
    <div className="p-4 space-y-4">
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
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Zap size={14} /> New Connection
          </button>
        )}
      </div>

      {/* ── SEARCH BAR (Full Width Row) ── */}
      <div className="relative w-full">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-shadow"
          placeholder="Search subscribers by name, username, mobile, or area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── FILTER CHIPS + SORT (Row 2) ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {view === "active" && (
          <div className="flex gap-1.5 flex-wrap flex-1">
            {filterOptions.map((f) => {
              const isActive = filter === f.id;
              const count = filterCounts[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  title={f.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-gray-800 text-white shadow-md"
                      : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm"
                  }`}
                >
                  {f.dot && (
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? f.activeDot : f.dot}`}
                    />
                  )}
                  {f.label}
                  {count > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Hide the default sort dropdown if "inventory-dues" is active because we use a custom one there */}
        {view === "active" && filter !== "inventory-dues" && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="text-xs text-gray-500 font-medium">Sort by:</span>
            <div className="relative">
              <ArrowUpDown
                size={14}
                className="absolute left-2.5 top-2 text-gray-500 pointer-events-none"
              />
              <select
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer appearance-none min-w-36"
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

      {/* ── INVENTORY DUES VIEW — special rich view when that filter is active ── */}
      {view === "active" && filter === "inventory-dues" && (
        <InventoryDuesView customers={filteredActive} jobs={jobs} />
      )}

      {/* ── ACTIVE TABLE ── */}
      {view === "active" && filter !== "inventory-dues" && (
        <div className="space-y-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <CustomerTable
              customers={pagedActive}
              searchQuery=""
              onEdit={(c) => setEditSubscriber(c)}
              onPay={(c) => setPaySubscriber(c)}
              onDelete={(c) => setArchiveTarget(c)}
              page={activePage}
              pageSize={PAGE_SIZE}
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
        <div className="space-y-3">
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
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-medium shadow-sm"
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

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
                    <th className="px-4 py-3 font-medium">Subscriber</th>
                    <th className="px-4 py-3 font-medium">Area</th>
                    <th className="px-4 py-3 font-medium">Archived On</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Total Ever Paid</th>
                    <th className="px-4 py-3 font-medium">Cycles</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
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
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm transition-colors"
                            >
                              <ArchiveRestore size={14} /> Restore
                            </button>
                            <button
                              onClick={() => setPurgeTarget(c)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm transition-colors"
                            >
                              <Trash2 size={14} /> Purge
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

// ─── Inventory Dues View ───────────────────────────────────────────────────────
// Rich, compact card view shown when the "Inventory Dues" filter is active.
// Includes internal sorting by job date/amount.

function InventoryDuesView({ customers, jobs }) {
  const [issueTarget, setIssueTarget] = useState(null);
  const [payJobTarget, setPayJobTarget] = useState(null);
  const [sortMode, setSortMode] = useState("oldest"); // 'oldest' | 'newest' | 'highest'

  // Build a map: customerId → list of pending jobs
  const pendingJobsByCustomer = {};
  jobs.forEach((job) => {
    if ((job.amountPending || 0) <= 0) return;
    if (!job.subscriberId) return;
    if (!pendingJobsByCustomer[job.subscriberId])
      pendingJobsByCustomer[job.subscriberId] = [];
    pendingJobsByCustomer[job.subscriberId].push(job);
  });

  const dueCustomers = customers.filter(
    (c) => pendingJobsByCustomer[c.id]?.length > 0,
  );

  if (dueCustomers.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Package size={26} className="text-green-600" />
        </div>
        <p className="text-base font-semibold text-gray-800">
          No pending inventory dues
        </p>
        <p className="text-sm text-gray-500">
          All issued inventory items have been fully paid for.
        </p>
      </div>
    );
  }

  // Pre-calculate stats for sorting
  const dueCustomersWithStats = dueCustomers.map((c) => {
    const pendingJobs = pendingJobsByCustomer[c.id] || [];
    const totalPending = pendingJobs.reduce(
      (s, j) => s + (j.amountPending || 0),
      0,
    );
    const totalIssued = pendingJobs.reduce(
      (s, j) => s + (j.totalValue || 0),
      0,
    );
    const totalPaid = pendingJobs.reduce((s, j) => s + (j.amountPaid || 0), 0);

    const dates = pendingJobs.map((j) =>
      new Date(j.date || j.createdAt || 0).getTime(),
    );
    const oldestTime = Math.min(...dates);
    const newestTime = Math.max(...dates);

    // Sort the jobs array chronologically internally
    const sortedJobs = [...pendingJobs].sort((a, b) => {
      return (
        new Date(a.date || a.createdAt || 0).getTime() -
        new Date(b.date || b.createdAt || 0).getTime()
      );
    });

    return {
      ...c,
      pendingJobs: sortedJobs,
      totalPending,
      totalIssued,
      totalPaid,
      oldestTime,
      newestTime,
    };
  });

  // Sort the actual array
  dueCustomersWithStats.sort((a, b) => {
    if (sortMode === "oldest") return a.oldestTime - b.oldestTime;
    if (sortMode === "newest") return b.newestTime - a.newestTime;
    if (sortMode === "highest") return b.totalPending - a.totalPending;
    return 0;
  });

  const grandTotal = dueCustomersWithStats.reduce(
    (sum, c) => sum + c.totalPending,
    0,
  );

  return (
    <div className="space-y-3">
      {/* Summary bar with Sorting */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">
            {dueCustomersWithStats.length} subscriber
            {dueCustomersWithStats.length !== 1 ? "s" : ""} with unpaid
            inventory
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs bg-white border border-purple-200 rounded-lg px-2 py-1 shadow-sm">
            <span className="text-purple-600 font-semibold pl-1">Sort:</span>
            <select
              className="bg-transparent text-purple-900 font-medium focus:outline-none cursor-pointer pr-1"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              <option value="oldest">Oldest Dues First</option>
              <option value="newest">Newest Dues First</option>
              <option value="highest">Highest Amount</option>
            </select>
          </div>
          <span className="text-sm font-bold text-purple-800 bg-purple-200/50 px-3 py-1.5 rounded-lg border border-purple-200">
            Total: PKR {grandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Per-subscriber cards */}
      {dueCustomersWithStats.map((customer) => {
        return (
          <div
            key={customer.id}
            className="bg-white border border-purple-100 rounded-xl overflow-hidden shadow-sm mb-3"
          >
            {/* Subscriber header - COMPACT */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50/50 border-b border-purple-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-purple-700">
                    {customer.fullName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">
                      {customer.fullName}
                    </span>
                    <span className="text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                      @{customer.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="hidden sm:inline text-gray-300">•</span>
                    {customer.mobileNo && <span>{customer.mobileNo}</span>}
                    {customer.mainArea && (
                      <>
                        <span className="hidden sm:inline text-gray-300">
                          •
                        </span>
                        <span>{customer.mainArea}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 font-medium">
                    Total Due:
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    PKR {customer.totalPending.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setIssueTarget({ customer })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors shadow-sm"
                  title="Issue more inventory to this subscriber"
                >
                  <Package size={14} /> Issue More
                </button>
              </div>
            </div>

            {/* Job rows - COMPACT HORIZONTAL LAYOUT */}
            <div className="divide-y divide-gray-50">
              {customer.pendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="px-4 py-2.5 hover:bg-gray-50/80 transition-colors flex flex-wrap md:flex-nowrap items-center justify-between gap-3"
                >
                  {/* Left: Date + Items */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 w-24 shrink-0 font-medium">
                      <Calendar size={13} className="text-gray-400" />{" "}
                      {job.date || "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      {(job.items || []).map((item, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md px-2 py-1 font-medium shadow-sm"
                        >
                          {item.description}
                          <span className="text-gray-400 font-normal">
                            ×{item.qty} {item.unit}
                          </span>
                        </span>
                      ))}
                      {job.technicianName && (
                        <span
                          className="text-[11px] text-gray-400 flex items-center gap-1 ml-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100"
                          title="Technician"
                        >
                          <Wrench size={10} /> {job.technicianName}
                        </span>
                      )}
                      {job.note && (
                        <span
                          className="text-[11px] text-gray-400 flex items-center gap-1 ml-1 truncate max-w-[160px]"
                          title={job.note}
                        >
                          <FileText size={10} /> {job.note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Financials + Action */}
                  <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end mt-1 md:mt-0">
                    <div className="flex items-center gap-4 text-[11px]">
                      <div className="text-gray-500 flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-gray-400">
                          Issued
                        </span>
                        <span className="font-semibold text-gray-700">
                          PKR {(job.totalValue || 0).toLocaleString()}
                        </span>
                      </div>
                      {(job.amountPaid || 0) > 0 && (
                        <div className="text-green-600 flex flex-col items-end">
                          <span className="text-[9px] uppercase font-bold text-green-500/70">
                            Paid
                          </span>
                          <span className="font-medium">
                            PKR {job.amountPaid.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-md border border-red-100 shadow-sm ml-1">
                        <span className="font-bold uppercase text-[10px]">
                          Due:
                        </span>
                        <span className="font-black text-sm">
                          PKR {(job.amountPending || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {(job.amountPending || 0) > 0 && (
                      <button
                        onClick={() => setPayJobTarget(job)}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-semibold transition-colors"
                      >
                        Pay Dues
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer summary for this subscriber (Only show if >1 job) */}
            {customer.pendingJobs.length > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80 border-t border-gray-100 text-[11px]">
                <span className="text-gray-500 font-medium">
                  Total Issued: PKR {customer.totalIssued.toLocaleString()}{" "}
                  <span className="mx-1.5 text-gray-300">•</span> Paid: PKR{" "}
                  {customer.totalPaid.toLocaleString()}
                </span>
                <span className="font-bold text-red-600">
                  Total Outstanding: PKR{" "}
                  {customer.totalPending.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Pay Job Dues modal */}
      {payJobTarget && (
        <Modal
          isOpen={!!payJobTarget}
          onClose={() => setPayJobTarget(null)}
          title={`Pay Inventory Dues — ${payJobTarget.subscriberName}`}
          size="sm"
        >
          <PayJobForm
            job={payJobTarget}
            onClose={() => setPayJobTarget(null)}
          />
        </Modal>
      )}

      {/* Issue More modal */}
      {issueTarget && (
        <Modal
          isOpen={!!issueTarget}
          onClose={() => setIssueTarget(null)}
          title={`Issue Inventory — ${issueTarget.customer.fullName}`}
          size="lg"
        >
          <BulkIssueStockModal
            customer={issueTarget.customer}
            onClose={() => setIssueTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── PayJobForm ───────────────────────────────────────────────────────────────
function PayJobForm({ job, onClose }) {
  const recordInventoryPayment = useConnectionJobStore(
    (s) => s.recordInventoryPayment,
  );
  const [amount, setAmount] = useState(String(job.amountPending || ""));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > job.amountPending) return;
    setSaving(true);
    await recordInventoryPayment(job.id, amt);
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4 p-1">
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm">
        <div className="flex justify-between text-gray-600 mb-1">
          <span>Total Issued</span>
          <span className="font-semibold">
            PKR {job.totalValue?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Pending Dues</span>
          <span className="font-bold">
            PKR {job.amountPending?.toLocaleString()}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Amount to Pay
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
            PKR
          </span>
          <input
            type="number"
            min="1"
            max={job.amountPending}
            className="w-full border border-gray-300 rounded-lg pl-10 pr-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            onKeyDown={(e) =>
              ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()
            }
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            saving ||
            !Number(amount) ||
            Number(amount) <= 0 ||
            Number(amount) > job.amountPending
          }
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "Saving..." : "Record Payment"}
        </button>
      </div>
    </div>
  );
}
