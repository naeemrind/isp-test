import { useState } from "react";
import {
  Plus,
  Search,
  X,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Warehouse,
  Pencil,
  Trash2,
  Info,
  History,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  DollarSign,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Zap,
  ClipboardList,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import InventoryForm from "./InventoryForm";
import IssueStockModal from "../../components/ui/IssueStockModal";
import IssueHistoryModal from "../../components/ui/Issuehistorymodal";
import RestockModal from "../../components/ui/RestockModal";
import RestockHistoryModal from "../../components/ui/RestockHistoryModal";
import ConnectionJobModal from "../../components/ui/ConnectionJobModal";
import ConnectionJobsLog from "../../components/ui/ConnectionJobsLog";
import useInventoryStore from "../../store/useInventoryStore";
import { formatDate } from "../../utils/dateUtils";

export default function Inventory() {
  const items = useInventoryStore((s) => s.items);
  const deleteItem = useInventoryStore((s) => s.deleteItem);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [issueItem, setIssueItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [restockItem, setRestockItem] = useState(null);
  const [restockHistoryItem, setRestockHistoryItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [showConnectionJob, setShowConnectionJob] = useState(false);
  const [showJobsLog, setShowJobsLog] = useState(false);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" || field === "date" ? "desc" : "asc");
    }
  };

  const totalCurrentValue = items.reduce(
    (sum, i) => sum + (i.inHand ?? 0) * (i.unitRate || 0),
    0,
  );
  const totalOriginalCost = items.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalIssuedValue = items.reduce(
    (sum, i) => sum + (i.stockOut || 0) * (i.unitRate || 0),
    0,
  );

  const lowStockItems = items.filter((i) => {
    if (!i.quantity) return false;
    return (i.inHand ?? 0) / i.quantity <= 0.2 && (i.inHand ?? 0) > 0;
  });
  const outOfStockItems = items.filter(
    (i) => (i.inHand ?? 0) <= 0 && (i.quantity || 0) > 0,
  );

  const filtered = items.filter(
    (item) =>
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      item.poNo?.toLowerCase().includes(search.toLowerCase()) ||
      item.remarks?.toLowerCase().includes(search.toLowerCase()),
  );

  const sortedFiltered = [...filtered].sort((a, b) => {
    let aVal, bVal;
    switch (sortField) {
      case "date":
        aVal = a.date || "";
        bVal = b.date || "";
        break;
      case "createdAt":
        aVal = a.createdAt || a.date || "";
        bVal = b.createdAt || b.date || "";
        break;
      case "description":
        aVal = (a.description || "").toLowerCase();
        bVal = (b.description || "").toLowerCase();
        break;
      case "inHand":
        aVal = a.inHand ?? 0;
        bVal = b.inHand ?? 0;
        break;
      case "currentValue":
        aVal = (a.inHand ?? 0) * (a.unitRate || 0);
        bVal = (b.inHand ?? 0) * (b.unitRate || 0);
        break;
      default:
        aVal = a.createdAt || "";
        bVal = b.createdAt || "";
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const getStockColor = (inHand, quantity) => {
    if (!quantity) return "text-gray-500";
    const ratio = inHand / quantity;
    if (ratio > 0.5) return "text-green-600 font-bold";
    if (ratio > 0.2) return "text-amber-600 font-bold";
    return "text-red-600 font-bold";
  };

  const getStockBadge = (inHand, quantity) => {
    if (!quantity) return null;
    const ratio = inHand / quantity;
    if (ratio <= 0)
      return (
        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
          Out
        </span>
      );
    if (ratio <= 0.2)
      return (
        <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">
          Low
        </span>
      );
    return null;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className={`transition-colors ${showHelp ? "text-blue-500" : "text-gray-400 hover:text-blue-500"}`}
              title="How does inventory work?"
            >
              <Info size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length} items tracked
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Jobs Log */}
          <button
            onClick={() => setShowJobsLog(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
          >
            <ClipboardList size={15} /> Jobs Log
          </button>

          {/* New Connection Job — highlighted */}
          <button
            onClick={() => setShowConnectionJob(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors"
          >
            <Zap size={15} /> New Connection Job
          </button>

          {/* Add Item */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <p className="font-bold text-blue-800">How Inventory Works</p>
            <button
              onClick={() => setShowHelp(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <ArrowDownCircle size={14} className="text-green-600" /> Buying
                Stock
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Click <strong>Add Item</strong> the first time you buy
                something.
              </p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <RefreshCw size={14} className="text-green-500" /> Restocking
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                When you buy more of the same item later, click{" "}
                <strong>Restock</strong>.
              </p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Zap size={14} className="text-green-600" /> Connection Job
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Issue <strong>multiple items at once</strong> for a new
                subscriber connection. Tracks who got what.
              </p>
            </div>
            <div className="bg-white border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <History size={14} className="text-purple-600" /> History
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Each item shows history buttons for <strong>issues</strong> and{" "}
                <strong>restocks</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="space-y-2">
          {outOfStockItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={15} className="text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-700">
                  {item.description}
                </span>
                <span className="text-xs text-red-500">
                  — Out of Stock (0 {item.unit})
                </span>
              </div>
              <button
                onClick={() => setRestockItem(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={11} /> Restock Now
              </button>
            </div>
          ))}
          {lowStockItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-700">
                  {item.description}
                </span>
                <span className="text-xs text-amber-600">
                  — Low Stock: {item.inHand} {item.unit} left (
                  {Math.round(((item.inHand ?? 0) / item.quantity) * 100)}%)
                </span>
              </div>
              <button
                onClick={() => setRestockItem(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={11} /> Restock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-1 bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Package size={14} className="text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">
              Current Stock Value
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">
            PKR {totalCurrentValue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            What your warehouse stock is worth <em>right now</em> — in-hand qty
            × unit rate. Updates when you issue or restock.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Warehouse size={14} className="text-gray-500" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Items Tracked
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">
            {items.length}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Unique stock types being tracked in your warehouse.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <DollarSign size={14} className="text-green-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Purchased
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">
            PKR {totalOriginalCost.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Total money spent buying stock — across all purchases ever made.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <TrendingDown size={14} className="text-red-500" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Issued
            </span>
          </div>
          <p className="text-2xl font-black text-red-500 leading-tight">
            PKR {totalIssuedValue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Value of stock already given out to technicians for field work.
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
          placeholder="Search by description, invoice no, PO or remarks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-white text-left">
                <th
                  className="px-3 py-3 font-semibold text-xs whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Purchase Date{" "}
                    <SortIcon
                      field="date"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </div>
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap">
                  INVOICE / PO
                </th>
                <th
                  className="px-3 py-3 font-semibold text-xs whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("description")}
                >
                  <div className="flex items-center gap-1">
                    Description{" "}
                    <SortIcon
                      field="description"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </div>
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap">
                  UNIT
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap text-green-400">
                  <div className="flex items-center gap-1">
                    <ArrowDownCircle size={12} />
                    IN
                  </div>
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap text-red-400">
                  <div className="flex items-center gap-1">
                    <ArrowUpCircle size={12} />
                    OUT
                  </div>
                </th>
                <th
                  className="px-3 py-3 font-semibold text-xs whitespace-nowrap cursor-pointer select-none text-purple-300"
                  onClick={() => toggleSort("inHand")}
                >
                  <div className="flex items-center gap-1">
                    In Hand{" "}
                    <SortIcon
                      field="inHand"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </div>
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap">
                  RATE
                </th>
                <th
                  className="px-3 py-3 font-semibold text-xs whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("currentValue")}
                >
                  <div className="flex items-center gap-1">
                    Current Value{" "}
                    <SortIcon
                      field="currentValue"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </div>
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap">
                  REMARKS
                </th>
                <th className="px-3 py-3 font-semibold text-xs whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedFiltered.map((item) => {
                const issueLogCount = Array.isArray(item.issueLog)
                  ? item.issueLog.length
                  : 0;
                const restockLogCount = Array.isArray(item.restockLog)
                  ? item.restockLog.length
                  : 0;
                const currentValue = (item.inHand ?? 0) * (item.unitRate || 0);
                const isOutOfStock = (item.inHand ?? 0) <= 0;

                return (
                  <tr
                    key={item.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800 text-xs">
                        {formatDate(item.date)}
                      </p>
                      <p className="text-gray-400 text-[10px]">
                        Added {formatDate(item.createdAt || item.date)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {item.invoiceNo || item.poNo ? (
                        <div>
                          {item.invoiceNo && <p>INV: {item.invoiceNo}</p>}
                          {item.poNo && <p>PO: {item.poNo}</p>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-gray-900">
                        {item.description}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        {item.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-green-600">
                      {item.stockIn || 0}
                    </td>
                    <td className="px-3 py-3 font-bold text-red-500">
                      {item.stockOut || 0}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={getStockColor(item.inHand, item.quantity)}
                        >
                          {item.inHand}
                        </span>
                        {getStockBadge(item.inHand, item.quantity)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700 font-medium text-xs">
                      PKR {(item.unitRate || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-800 text-xs">
                      PKR {currentValue.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-32 truncate">
                      {item.remarks || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setRestockItem(item)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors whitespace-nowrap"
                          >
                            <RefreshCw size={10} /> Restock
                          </button>
                          <button
                            onClick={() => setRestockHistoryItem(item)}
                            title={`${restockLogCount} restock event(s)`}
                            className="flex items-center gap-0.5 px-1.5 py-1 text-xs font-semibold text-gray-400 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <History size={11} />
                            <span>{restockLogCount || "0"}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (!isOutOfStock) setIssueItem(item);
                            }}
                            disabled={isOutOfStock}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold border rounded-md transition-colors whitespace-nowrap ${
                              isOutOfStock
                                ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            }`}
                          >
                            <ArrowUpCircle size={10} /> Issue
                          </button>
                          <button
                            onClick={() => setHistoryItem(item)}
                            title={
                              issueLogCount > 0
                                ? `${issueLogCount} issue event(s) — click to view`
                                : "No issue history"
                            }
                            className={`flex items-center gap-0.5 px-1.5 py-1 text-xs font-semibold border rounded-md transition-colors ${
                              issueLogCount > 0
                                ? "text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100"
                                : "text-gray-400 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <History size={11} />
                            <span>
                              {issueLogCount > 0 ? issueLogCount : "0"}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditItem(item)}
                            title="Edit item"
                            className="p-1 rounded-md text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            title="Delete item"
                            className="p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedFiltered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-gray-300" />
                      <p className="font-medium text-gray-500">
                        {search
                          ? "No items match your search"
                          : "No inventory items yet"}
                      </p>
                      {!search && (
                        <p className="text-xs text-gray-400">
                          Click <strong>Add Item</strong> to record your first
                          stock purchase
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Inventory Item"
        size="lg"
      >
        <InventoryForm onClose={() => setShowAdd(false)} />
      </Modal>

      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Inventory Item"
        size="lg"
      >
        {editItem && (
          <InventoryForm item={editItem} onClose={() => setEditItem(null)} />
        )}
      </Modal>

      <Modal
        isOpen={!!restockItem}
        onClose={() => setRestockItem(null)}
        title={`Restock — ${restockItem?.description ?? ""}`}
        size="md"
      >
        {restockItem && (
          <RestockModal
            item={restockItem}
            onClose={() => setRestockItem(null)}
            onViewHistory={() => {
              setRestockHistoryItem(restockItem);
              setRestockItem(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!restockHistoryItem}
        onClose={() => setRestockHistoryItem(null)}
        title={`Purchase History — ${restockHistoryItem?.description ?? ""}`}
        size="md"
      >
        {restockHistoryItem && (
          <RestockHistoryModal
            item={restockHistoryItem}
            onClose={() => setRestockHistoryItem(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!issueItem}
        onClose={() => setIssueItem(null)}
        title="Issue Stock"
        size="md"
      >
        {issueItem && (
          <IssueStockModal
            item={issueItem}
            onClose={() => setIssueItem(null)}
            onViewHistory={() => setHistoryItem(issueItem)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title="Issue History"
        size="md"
      >
        {historyItem && (
          <IssueHistoryModal
            item={historyItem}
            onClose={() => setHistoryItem(null)}
          />
        )}
      </Modal>

      {/* New Connection Job Modal */}
      <Modal
        isOpen={showConnectionJob}
        onClose={() => setShowConnectionJob(false)}
        title="New Connection Job"
        size="lg"
      >
        <ConnectionJobModal onClose={() => setShowConnectionJob(false)} />
      </Modal>

      {/* Connection Jobs Log Modal */}
      <Modal
        isOpen={showJobsLog}
        onClose={() => setShowJobsLog(false)}
        title="Connection Jobs Log"
        size="lg"
      >
        <ConnectionJobsLog onClose={() => setShowJobsLog(false)} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteItem(deleteTarget.id)}
        title="Delete Inventory Item"
        message={`Delete "${deleteTarget?.description}"? All stock data and history for this item will be permanently removed.`}
        confirmText={deleteTarget?.description}
        requirePassword
        danger
      />
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field)
    return <ChevronsUpDown size={11} className="text-gray-300" />;
  return sortDir === "asc" ? (
    <ChevronUp size={11} className="text-blue-500" />
  ) : (
    <ChevronDown size={11} className="text-blue-500" />
  );
}
