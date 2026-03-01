import {
  ArrowUpCircle,
  User,
  FileText,
  Calendar,
  Package,
  Inbox,
  DollarSign,
} from "lucide-react";
import { formatDate } from "../../utils/dateUtils";

/**
 * IssueHistoryModal
 * Displays a timeline of all stock issue events for a single inventory item.
 * Now shows per-unit price and total value per issue.
 *
 * Props:
 *  item    – the inventory item object
 *  onClose – callback to close
 */
export default function IssueHistoryModal({ item, onClose }) {
  const log = Array.isArray(item.issueLog) ? [...item.issueLog].reverse() : [];
  const totalIssued = log.reduce((sum, e) => sum + (e.qty || 0), 0);
  const totalIssuedValue = log.reduce(
    (sum, e) =>
      sum + (e.totalValue || (e.qty || 0) * (e.unitRate || item.unitRate || 0)),
    0,
  );

  return (
    <div className="space-y-4">
      {/* ── Item summary bar ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Package size={16} className="text-gray-500" />
          <div>
            <p className="font-bold text-gray-900">{item.description}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Unit:{" "}
              <span className="font-semibold text-gray-700">{item.unit}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-center">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Issued</p>
            <p className="text-lg font-black text-red-500">
              {item.stockOut || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Value</p>
            <p className="text-base font-black text-orange-600">
              PKR {totalIssuedValue.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">In Hand</p>
            <p
              className={`text-lg font-black ${(item.inHand ?? 0) === 0 ? "text-red-500" : "text-green-600"}`}
            >
              {item.inHand ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Events</p>
            <p className="text-lg font-black text-gray-700">{log.length}</p>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      {log.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Inbox size={22} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-500">No issue history yet</p>
          <p className="text-xs text-gray-400">
            Use the <strong>Issue</strong> button to record stock being given
            out.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-4.75 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-3">
            {log.map((entry, idx) => {
              const entryRate = entry.unitRate || item.unitRate || 0;
              const entryValue =
                entry.totalValue || (entry.qty || 0) * entryRate;
              return (
                <div key={idx} className="flex gap-3 relative">
                  {/* dot */}
                  <div className="shrink-0 w-10 flex justify-center pt-1">
                    <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center z-10">
                      <ArrowUpCircle size={10} className="text-red-500" />
                    </div>
                  </div>

                  {/* card */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm mb-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      {/* qty badge + value */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-red-50 border border-red-200 text-red-700 text-sm font-black px-2.5 py-0.5 rounded-lg">
                          − {entry.qty} {item.unit}
                        </span>
                        <span className="bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-lg">
                          PKR {entryValue.toLocaleString()}
                        </span>
                        {idx === 0 && (
                          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                            Latest
                          </span>
                        )}
                      </div>
                      {/* date */}
                      <span className="flex items-center gap-1 text-xs text-gray-400 font-medium whitespace-nowrap">
                        <Calendar size={11} />
                        {formatDate(entry.date)}
                      </span>
                    </div>

                    {/* Rate row */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                      <DollarSign size={11} className="text-gray-400" />
                      <span>
                        PKR {entryRate.toLocaleString()} per {item.unit}
                        {entryRate !== item.unitRate && (
                          <span className="ml-1 text-amber-600 font-semibold">
                            (custom rate)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Technician */}
                    {entry.issuedTo && (
                      <p className="flex items-center gap-1.5 text-sm text-gray-700 font-medium mt-1.5">
                        <User size={12} className="text-gray-400 shrink-0" />
                        Technician: {entry.issuedTo}
                      </p>
                    )}

                    {/* Subscriber */}
                    {entry.subscriberName && (
                      <p className="flex items-center gap-1.5 text-sm text-gray-700 font-medium mt-1">
                        <User size={12} className="text-blue-400 shrink-0" />
                        Subscriber: {entry.subscriberName}
                      </p>
                    )}

                    {/* note */}
                    {entry.note && (
                      <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-1.5 leading-relaxed">
                        <FileText
                          size={11}
                          className="text-gray-400 shrink-0 mt-0.5"
                        />
                        {entry.note}
                      </p>
                    )}

                    {/* running balance */}
                    <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-1.5">
                      Balance after this issue:{" "}
                      <span className="font-semibold text-gray-600">
                        {entry.balanceAfter} {item.unit}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Total summary at bottom ── */}
          {log.length > 1 && (
            <div className="ml-10 mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  Total issued across all {log.length} events
                </span>
                <span className="font-bold text-red-600">
                  {totalIssued} {item.unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  Total issued value
                </span>
                <span className="font-bold text-orange-600">
                  PKR {totalIssuedValue.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Close ── */}
      <div className="flex justify-end pt-1 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
