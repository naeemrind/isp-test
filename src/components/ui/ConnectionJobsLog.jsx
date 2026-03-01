import { useState } from "react";
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
} from "lucide-react";
import useConnectionJobStore from "../../store/useConnectionJobStore";
import { formatDate } from "../../utils/dateUtils";

/**
 * ConnectionJobsLog
 * Shows all past connection jobs with filtering by subscriber / technician.
 * Expandable rows show line-by-line item details.
 */
export default function ConnectionJobsLog({ onClose }) {
  const jobs = useConnectionJobStore((s) => s.jobs);
  const deleteJob = useConnectionJobStore((s) => s.deleteJob);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = [...jobs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((j) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        j.subscriberName?.toLowerCase().includes(q) ||
        j.subscriberUsername?.toLowerCase().includes(q) ||
        j.technicianName?.toLowerCase().includes(q) ||
        j.note?.toLowerCase().includes(q) ||
        j.items?.some((i) => i.description?.toLowerCase().includes(q))
      );
    });

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (job) => {
    await deleteJob(job.id);
    setConfirmDelete(null);
  };

  const totalValue = filtered.reduce((s, j) => s + (j.totalValue || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-center">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
            Jobs
          </p>
          <p className="text-xl font-black text-blue-700">{filtered.length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 text-center">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">
            Total Value
          </p>
          <p className="text-lg font-black text-green-700">
            PKR {totalValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 text-center">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">
            Items Issued
          </p>
          <p className="text-xl font-black text-purple-700">
            {filtered.reduce((s, j) => s + (j.items?.length || 0), 0)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by subscriber, technician, item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Jobs list */}
      <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Package size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">
              No connection jobs found
            </p>
            <p className="text-xs mt-1">
              Use "New Connection Job" to issue items for a subscriber
            </p>
          </div>
        )}

        {filtered.map((job) => {
          const isOpen = expanded.has(job.id);
          return (
            <div
              key={job.id}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white"
            >
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(job.id)}
              >
                <div className="text-gray-400">
                  {isOpen ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.subscriberName ? (
                      <span className="font-bold text-gray-900 text-sm">
                        {job.subscriberName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm italic">
                        No subscriber recorded
                      </span>
                    )}
                    {job.subscriberUsername && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        @{job.subscriberUsername}
                      </span>
                    )}
                    {job.technicianName && (
                      <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Wrench size={10} /> {job.technicianName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={11} /> {formatDate(job.date)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {job.items?.length || 0} item
                      {job.items?.length !== 1 ? "s" : ""}
                    </span>
                    {job.note && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-36">
                        <FileText size={11} /> {job.note}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">
                    PKR {(job.totalValue || 0).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(job);
                  }}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Delete job"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
                  {(job.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Package size={13} className="text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800">
                          {item.description}
                        </span>
                        <span className="text-gray-400">
                          × {item.qty} {item.unit}
                        </span>
                        <span className="text-xs text-gray-400">
                          @ PKR {item.unitRate}/{item.unit}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-700">
                        PKR {item.totalValue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm">
                    <span className="text-gray-700">Total Material Value</span>
                    <span className="text-green-700">
                      PKR {(job.totalValue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <p className="font-bold text-gray-900">Delete this job?</p>
            <p className="text-sm text-gray-500">
              Job for{" "}
              <strong>
                {confirmDelete.subscriberName || "Unknown subscriber"}
              </strong>{" "}
              on {formatDate(confirmDelete.date)} will be removed from history.
              <br />
              <span className="text-amber-600 font-medium">
                Note: Inventory changes are NOT reversed.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        Close
      </button>
    </div>
  );
}
