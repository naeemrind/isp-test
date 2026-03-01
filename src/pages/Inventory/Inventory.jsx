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
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import InventoryForm from "./InventoryForm";
import IssueStockModal from "../../components/ui/IssueStockModal";
import IssueHistoryModal from "../../components/ui/Issuehistorymodal";
import RestockModal from "../../components/ui/RestockModal";
import RestockHistoryModal from "../../components/ui/RestockHistoryModal";
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
  const [sortField, setSortField] = useState("createdAt"); // default: newest first
  const [sortDir, setSortDir] = useState("desc");

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
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus size={15} /> Add Item
        </button>
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
                When you buy more of the same item months later, click{" "}
                <strong>Restock</strong>.
              </p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <ArrowUpCircle size={14} className="text-red-500" /> Issuing
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Click <strong>Issue</strong> to give stock to a technician. In
                Hand updates live.
              </p>
            </div>
            <div className="bg-white border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <History size={14} className="text-purple-600" /> History
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Each item shows two history buttons — one for{" "}
                <strong>issues</strong>, one for <strong>restocks</strong>.
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
        {/* Card 1 — Current Stock Value */}
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

        {/* Card 2 — Items */}
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

        {/* Card 3 — Total Purchased */}
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

        {/* Card 4 — Total Issued */}
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
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left text-xs uppercase tracking-wide">
                {/* Purchase Date — sortable */}
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  <button
                    onClick={() => toggleSort("date")}
                    className="flex items-center gap-1 hover:text-gray-800 transition-colors group/th"
                    title="Purchase Date — the date you entered when adding this item"
                  >
                    Purchase Date
                    <SortIcon
                      field="date"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  Invoice / PO
                </th>

                {/* Description — sortable */}
                <th className="px-3 py-3 font-semibold">
                  <button
                    onClick={() => toggleSort("description")}
                    className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    Description
                    <SortIcon
                      field="description"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  Unit
                </th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  <span
                    className="flex items-center gap-1"
                    title="Total stock received into warehouse"
                  >
                    <ArrowDownCircle size={11} className="text-green-500" /> In
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  <span
                    className="flex items-center gap-1"
                    title="Total stock issued to technicians"
                  >
                    <ArrowUpCircle size={11} className="text-red-400" /> Out
                  </span>
                </th>

                {/* In Hand — sortable */}
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  <button
                    onClick={() => toggleSort("inHand")}
                    className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    <Warehouse size={11} className="text-purple-500" /> In Hand
                    <SortIcon
                      field="inHand"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  Rate
                </th>

                {/* Current Value — sortable */}
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  <button
                    onClick={() => toggleSort("currentValue")}
                    className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                  >
                    Current Value
                    <SortIcon
                      field="currentValue"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  Remarks
                </th>
                <th
                  className="px-3 py-3 font-semibold whitespace-nowrap"
                  style={{ minWidth: "210px" }}
                >
                  Actions
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
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    {/* Purchase Date — with tooltip explaining what it means */}
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                      <div className="font-medium text-gray-700">
                        {formatDate(item.date)}
                      </div>
                      <div
                        className="text-gray-400 text-xs mt-0.5"
                        title="Date this item was added to the system"
                      >
                        Added{" "}
                        {formatDate(
                          (item.createdAt || item.date || "").slice(0, 10),
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <div>
                        {item.invoiceNo || (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                      {item.poNo && (
                        <div className="text-gray-400">{item.poNo}</div>
                      )}
                    </td>

                    <td className="px-3 py-3 font-semibold text-gray-900">
                      {item.description}
                    </td>

                    <td className="px-3 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {item.unit}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-green-600 font-medium text-xs whitespace-nowrap">
                      {item.stockIn || 0}
                    </td>

                    <td className="px-3 py-3 text-red-500 font-medium text-xs whitespace-nowrap">
                      {item.stockOut || 0}
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={getStockColor(item.inHand, item.quantity)}
                        >
                          {item.inHand}
                        </span>
                        {getStockBadge(item.inHand, item.quantity)}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">
                      PKR {item.unitRate?.toLocaleString()}
                    </td>

                    <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      PKR {currentValue.toLocaleString()}
                    </td>

                    <td className="px-3 py-3" style={{ maxWidth: "120px" }}>
                      {item.remarks ? (
                        <span
                          title={item.remarks}
                          className="block text-xs text-gray-400 truncate cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 hover:text-gray-700 transition-colors"
                        >
                          {item.remarks}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions — 2 neat rows */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {/* Row 1: Restock + Restock History */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setRestockItem(item)}
                            title="Add more stock (new bulk purchase)"
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap"
                          >
                            <RefreshCw size={11} /> Restock
                          </button>
                          <button
                            onClick={() => setRestockHistoryItem(item)}
                            title={
                              restockLogCount > 0
                                ? `${restockLogCount} restock purchase${restockLogCount !== 1 ? "s" : ""} — click to view`
                                : "No restock history yet"
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                              restockLogCount > 0
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                : "bg-gray-50 text-gray-400 border-gray-200 cursor-default"
                            }`}
                          >
                            <History size={11} />
                            <span>
                              {restockLogCount > 0 ? restockLogCount : "0"}
                            </span>
                          </button>
                        </div>

                        {/* Row 2: Issue + Issue History + Edit + Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setIssueItem(item)}
                            disabled={isOutOfStock}
                            title={
                              isOutOfStock
                                ? "Out of stock — restock first"
                                : `Issue ${item.description} to a technician`
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                              !isOutOfStock
                                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                : "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                            }`}
                          >
                            <ArrowUpCircle size={11} /> Issue
                          </button>
                          <button
                            onClick={() => setHistoryItem(item)}
                            title={
                              issueLogCount > 0
                                ? `${issueLogCount} issue event${issueLogCount !== 1 ? "s" : ""} — click to view`
                                : "No issues recorded yet"
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                              issueLogCount > 0
                                ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                                : "bg-gray-50 text-gray-400 border-gray-200 cursor-default"
                            }`}
                          >
                            <History size={11} />
                            <span>
                              {issueLogCount > 0 ? issueLogCount : "0"}
                            </span>
                          </button>
                          <button
                            onClick={() => setEditItem(item)}
                            title="Edit item"
                            className="p-1 rounded-md text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            title="Delete item"
                            className="p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
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

      {/* Modals */}
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
