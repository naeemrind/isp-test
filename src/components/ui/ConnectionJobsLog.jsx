import { useState, useMemo } from "react";
import {
  Search,
  X,
  User,
  Wrench,
  Package,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Link2,
  Hammer,
  Receipt,
} from "lucide-react";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import useInventoryStore from "../../store/useInventoryStore";
import { formatDate } from "../../utils/dateUtils";

const ITEMS_PER_PAGE = 10;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a unified dispatch list from:
 * 1. Connection Jobs (from useConnectionJobStore) — type "connection"
 * 2. Ad-hoc issueLog entries from inventory items   — type "adhoc"
 *
 * Both types get the same shape so the list can be rendered uniformly.
 */
function buildAllDispatches(jobs, inventoryItems) {
  const list = [];

  // Path B: Connection Jobs
  for (const job of jobs) {
    list.push({
      id: `job-${job.id}`,
      _jobId: job.id,
      type: "connection",
      date: job.date || job.createdAt,
      createdAt: job.createdAt,
      subscriberName: job.subscriberName || null,
      subscriberUsername: job.subscriberUsername || null,
      technicianName: job.technicianName || null,
      note: job.note || null,
      items: job.items || [],
      totalValue: job.totalValue || 0,
    });
  }

  // Path A: Ad-hoc issueLog entries (those NOT tagged as connection)
  for (const item of inventoryItems) {
    const log = Array.isArray(item.issueLog) ? item.issueLog : [];
    for (const entry of log) {
      const isConnection =
        entry.jobRef === true || entry.dispatchType === "connection";
      if (isConnection) continue; // already covered by connection jobs above

      list.push({
        id: `adhoc-${item.id}-${entry.createdAt || entry.date}`,
        type: "adhoc",
        date: entry.date,
        createdAt: entry.createdAt || entry.date,
        subscriberName: entry.subscriberName || null,
        technicianName: entry.issuedTo || null,
        note: entry.note || null,
        items: [
          {
            description: item.description,
            unit: item.unit,
            qty: entry.qty,
            unitRate: entry.unitRate || item.unitRate,
            totalValue:
              entry.totalValue ||
              (entry.qty || 0) * (entry.unitRate || item.unitRate || 0),
          },
        ],
        totalValue:
          entry.totalValue ||
          (entry.qty || 0) * (entry.unitRate || item.unitRate || 0),
        _inventoryItem: item,
        _logEntry: entry,
      });
    }
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ConnectionJobsLog() {
  const jobs = useConnectionJobStore((s) => s.jobs);
  const deleteJob = useConnectionJobStore((s) => s.deleteJob);
  const inventoryItems = useInventoryStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "connection" | "adhoc"
  const [expanded, setExpanded] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [page, setPage] = useState(1);

  // ── Build unified list ─────────────────────────────────────────────────────
  const allDispatches = useMemo(
    () => buildAllDispatches(jobs, inventoryItems),
    [jobs, inventoryItems],
  );

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allDispatches;
    if (typeFilter !== "all") {
      list = list.filter((d) => d.type === typeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.subscriberName?.toLowerCase().includes(q) ||
          d.subscriberUsername?.toLowerCase().includes(q) ||
          d.technicianName?.toLowerCase().includes(q) ||
          d.note?.toLowerCase().includes(q) ||
          d.items?.some((i) => i.description?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allDispatches, typeFilter, search]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };
  const handleTypeFilter = (val) => {
    setTypeFilter(val);
    setPage(1);
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  // ── Aggregate totals ───────────────────────────────────────────────────────
  const connectionDispatches = allDispatches.filter(
    (d) => d.type === "connection",
  );
  const adhocDispatches = allDispatches.filter((d) => d.type === "adhoc");
  const connectionTotal = connectionDispatches.reduce(
    (s, d) => s + d.totalValue,
    0,
  );
  const adhocTotal = adhocDispatches.reduce((s, d) => s + d.totalValue, 0);
  const grandTotal = connectionTotal + adhocTotal;
  const filteredTotal = filtered.reduce((s, d) => s + d.totalValue, 0);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async (dispatch) => {
    if (dispatch.type === "connection" && dispatch._jobId) {
      await deleteJob(dispatch._jobId);
    }
    // Ad-hoc entries cannot be deleted from here (they live inside inventory item)
    setConfirmDelete(null);
    const newPages = Math.max(
      1,
      Math.ceil((filtered.length - 1) / ITEMS_PER_PAGE),
    );
    if (safePage > newPages) setPage(newPages);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          color="gray"
          label="All Dispatches"
          value={allDispatches.length}
          sub={`PKR ${grandTotal.toLocaleString()} total`}
        />
        <StatCard
          color="blue"
          label="Connections"
          value={connectionDispatches.length}
          sub={`PKR ${connectionTotal.toLocaleString()}`}
        />
        <StatCard
          color="amber"
          label="Ad-hoc"
          value={adhocDispatches.length}
          sub={`PKR ${adhocTotal.toLocaleString()}`}
        />
      </div>

      {/* ── Type filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {[
          { key: "all", label: "All", count: allDispatches.length },
          {
            key: "connection",
            label: "🔗 Connections",
            count: connectionDispatches.length,
          },
          { key: "adhoc", label: "🔧 Ad-hoc", count: adhocDispatches.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTypeFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              typeFilter === tab.key
                ? tab.key === "connection"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : tab.key === "adhoc"
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-gray-800 text-white border-gray-800 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.label}{" "}
            <span
              className={`ml-0.5 ${typeFilter === tab.key ? "opacity-80" : "text-gray-400"}`}
            >
              ({tab.count})
            </span>
          </button>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by subscriber, technician, or item description…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search result banner */}
      {(search.trim() || typeFilter !== "all") && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
          <span className="text-blue-700 font-medium">
            {filtered.length} dispatch{filtered.length !== 1 ? "es" : ""} shown
            {search.trim() && ` for "${search}"`}
          </span>
          {filtered.length > 0 && (
            <span className="font-bold text-blue-800">
              PKR {filteredTotal.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* ── Dispatch Cards ────────────────────────────────────────────────────── */}
      <div className="space-y-2.5 min-h-20">
        {pageItems.length === 0 ? (
          <EmptyState hasSearch={!!search.trim() || typeFilter !== "all"} />
        ) : (
          pageItems.map((dispatch, idx) => {
            const globalNum = filtered.length - (pageStart + idx);
            const isOpen = expanded.has(dispatch.id);
            const items = dispatch.items || [];
            const total = dispatch.totalValue || 0;
            const isConnection = dispatch.type === "connection";

            return (
              <div
                key={dispatch.id}
                className={`rounded-2xl border-2 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isConnection ? "border-blue-100" : "border-amber-100"
                }`}
              >
                {/* Header row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none group ${
                    isConnection
                      ? "hover:bg-blue-50/40"
                      : "hover:bg-amber-50/40"
                  } transition-colors`}
                  onClick={() => toggleExpand(dispatch.id)}
                >
                  {/* Expand arrow */}
                  <span className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0">
                    {isOpen ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </span>

                  {/* Number badge */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      isConnection
                        ? "bg-linear-to-br from-blue-500 to-indigo-600"
                        : "bg-linear-to-br from-amber-400 to-amber-600"
                    }`}
                  >
                    <span className="text-[11px] font-black text-white">
                      #{globalNum}
                    </span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type tag — Fix 4 */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isConnection
                            ? "bg-blue-100 border-blue-200 text-blue-700"
                            : "bg-amber-100 border-amber-200 text-amber-700"
                        }`}
                      >
                        {isConnection ? (
                          <>
                            <Link2 size={9} /> Subscriber Connection
                          </>
                        ) : (
                          <>
                            <Hammer size={9} /> Ad-hoc Dispatch
                          </>
                        )}
                      </span>
                      {dispatch.subscriberName ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-gray-900">
                          <User size={11} className="text-blue-500 shrink-0" />
                          {dispatch.subscriberName}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400 italic">
                          No subscriber
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar size={10} className="shrink-0" />
                        {formatDate(dispatch.date || dispatch.createdAt)}
                      </span>
                      {dispatch.technicianName && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Wrench size={10} className="shrink-0" />
                          {dispatch.technicianName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Package size={10} className="shrink-0" />
                        {items.length} item{items.length !== 1 ? "s" : ""}
                        {!isOpen && (
                          <span className="text-gray-300 ml-0.5">
                            · tap to expand
                          </span>
                        )}
                      </span>
                      {dispatch.note && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 italic max-w-44 truncate">
                          <FileText size={10} className="shrink-0" />
                          {dispatch.note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-right shrink-0 mr-2">
                    <p
                      className={`text-base font-black leading-tight ${
                        isConnection ? "text-blue-700" : "text-amber-700"
                      }`}
                    >
                      PKR {total.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">total value</p>
                  </div>

                  {/* Delete — only for connection jobs */}
                  {isConnection ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(dispatch);
                      }}
                      className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      title="Delete connection job record"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div
                      className="w-8 shrink-0"
                      title="Ad-hoc dispatches are managed in Inventory tab"
                    >
                      {/* spacer — ad-hoc entries are deleted from inventory tab */}
                    </div>
                  )}
                </div>

                {/* Expanded breakdown */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr
                            className={`border-b text-gray-500 ${
                              isConnection ? "bg-blue-50/60" : "bg-amber-50/60"
                            }`}
                          >
                            <th className="px-5 py-2 text-left font-bold uppercase tracking-wider">
                              Item / Material
                            </th>
                            <th className="px-4 py-2 text-center font-bold uppercase tracking-wider whitespace-nowrap">
                              Qty &amp; Unit
                            </th>
                            <th className="px-4 py-2 text-right font-bold uppercase tracking-wider whitespace-nowrap">
                              Rate Charged
                            </th>
                            <th className="px-4 py-2 pr-5 text-right font-bold uppercase tracking-wider">
                              Line Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item, i) => (
                            <tr
                              key={i}
                              className="bg-white hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                                      isConnection
                                        ? "bg-blue-100"
                                        : "bg-amber-100"
                                    }`}
                                  >
                                    <Package
                                      size={10}
                                      className={
                                        isConnection
                                          ? "text-blue-600"
                                          : "text-amber-600"
                                      }
                                    />
                                  </div>
                                  <span className="font-semibold text-gray-800">
                                    {item.description}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center gap-1 font-bold text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                  {item.qty}
                                  <span className="font-normal text-gray-500 text-[10px]">
                                    {item.unit}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="font-semibold text-gray-700">
                                  PKR {(item.unitRate || 0).toLocaleString()}
                                </span>
                                <span className="text-gray-400 ml-0.5">
                                  /{item.unit}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 pr-5 text-right font-bold text-gray-900">
                                PKR {(item.totalValue || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr
                            className={`border-t-2 ${isConnection ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}
                          >
                            <td colSpan={2} className="px-5 py-2.5">
                              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                {dispatch.technicianName && (
                                  <span className="flex items-center gap-1.5">
                                    <Wrench
                                      size={11}
                                      className="text-gray-400"
                                    />
                                    Technician:{" "}
                                    <strong className="text-gray-700">
                                      {dispatch.technicianName}
                                    </strong>
                                  </span>
                                )}
                                {dispatch.note && (
                                  <span className="flex items-center gap-1.5">
                                    <FileText
                                      size={11}
                                      className="text-gray-400"
                                    />
                                    <em className="text-gray-600">
                                      {dispatch.note}
                                    </em>
                                  </span>
                                )}
                                {!isConnection && (
                                  <span className="text-[10px] text-amber-600 italic">
                                    ℹ️ Manage ad-hoc entries in the Inventory
                                    tab
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold uppercase tracking-wide text-xs ${
                                isConnection
                                  ? "text-blue-700"
                                  : "text-amber-700"
                              }`}
                            >
                              Total Value
                            </td>
                            <td
                              className={`px-4 py-2.5 pr-5 text-right font-black text-sm ${
                                isConnection
                                  ? "text-blue-700"
                                  : "text-amber-700"
                              }`}
                            >
                              PKR {total.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {pageStart + 1}–
              {Math.min(pageStart + ITEMS_PER_PAGE, filtered.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-800">
              {filtered.length}
            </span>
          </p>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(1)} disabled={safePage === 1}>
              <ChevronsLeft size={14} />
            </PagBtn>
            <PagBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft size={14} />
            </PagBtn>
            {buildPageNumbers(safePage, totalPages).map((p, i) =>
              p === "…" ? (
                <span
                  key={`e${i}`}
                  className="w-6 text-center text-xs text-gray-400"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    p === safePage
                      ? "bg-blue-600 text-white shadow-md scale-105"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <PagBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </PagBtn>
            <PagBtn
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
            >
              <ChevronsRight size={14} />
            </PagBtn>
          </div>
        </div>
      )}

      {filtered.length > 0 && filtered.length <= ITEMS_PER_PAGE && (
        <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-2">
          {filtered.length} dispatch{filtered.length !== 1 ? "es" : ""} total
        </p>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  Delete connection job?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Subscriber:{" "}
                  <span className="font-semibold text-gray-800">
                    {confirmDelete.subscriberName || "Unknown"}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Total:{" "}
                  <span className="font-bold text-red-600">
                    PKR {(confirmDelete.totalValue || 0).toLocaleString()}
                  </span>
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 mb-5 leading-relaxed">
              ⚠️ <strong>Important:</strong> This only removes the job log
              entry. Inventory stock quantities are{" "}
              <strong>not restored</strong>. Use <strong>Restock</strong> in
              Inventory tab if you need to add stock back.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ hasSearch }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Receipt size={28} className="text-gray-300" />
      </div>
      <p className="font-bold text-gray-400 text-base">
        {hasSearch
          ? "No dispatches match your filter"
          : "No dispatches recorded yet"}
      </p>
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
        {hasSearch
          ? "Try changing the type filter or search terms"
          : "Dispatch stock via the Inventory tab or create a New Connection in the Subscribers tab"}
      </p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ color, label, value, sub }) {
  const s =
    {
      gray: {
        wrap: "bg-gray-50 border-gray-200",
        lbl: "text-gray-500",
        val: "text-gray-800",
        sub: "text-gray-400",
      },
      blue: {
        wrap: "bg-blue-50 border-blue-200",
        lbl: "text-blue-600",
        val: "text-blue-800",
        sub: "text-blue-400",
      },
      amber: {
        wrap: "bg-amber-50 border-amber-200",
        lbl: "text-amber-600",
        val: "text-amber-800",
        sub: "text-amber-400",
      },
    }[color] || {};
  return (
    <div className={`border rounded-2xl px-3 py-3.5 text-center ${s.wrap}`}>
      <p
        className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${s.lbl}`}
      >
        {label}
      </p>
      <p className={`text-2xl font-black leading-tight ${s.val}`}>{value}</p>
      <p className={`text-[10px] mt-1 ${s.sub}`}>{sub}</p>
    </div>
  );
}

function PagBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const show = new Set(
    [1, total, current, current - 1, current + 1].filter(
      (p) => p >= 1 && p <= total,
    ),
  );
  const arr = [...show].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i > 0 && arr[i] - arr[i - 1] > 1) result.push("…");
    result.push(arr[i]);
  }
  return result;
}
