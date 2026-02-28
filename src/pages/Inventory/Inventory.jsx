import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Warehouse,
  Search,
  X,
  Info,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import InventoryForm from "./InventoryForm";
import IssueStockModal from "../../components/ui/IssueStockModal";
import IssueHistoryModal from "../../components/ui/Issuehistorymodal";
import useInventoryStore from "../../store/useInventoryStore";
import { formatDate } from "../../utils/dateUtils";

export default function Inventory() {
  const items = useInventoryStore((s) => s.items);
  const deleteItem = useInventoryStore((s) => s.deleteItem);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [issueItem, setIssueItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const totalValue = items.reduce((sum, i) => sum + (i.amount || 0), 0);

  const filtered = items.filter(
    (item) =>
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      item.poNo?.toLowerCase().includes(search.toLowerCase()) ||
      item.remarks?.toLowerCase().includes(search.toLowerCase()),
  );

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
      {/* ── Header ── */}
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

      {/* ── Help Panel ── */}
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
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <ArrowDownCircle size={14} className="text-green-600" /> Buying
                Stock
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                When you buy items in bulk (e.g. 100m fiber cable), click{" "}
                <strong>Add Item</strong>. Enter total quantity and cost per
                unit. Set <strong>Stock In</strong> to how much arrived at your
                warehouse.
              </p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <ArrowUpCircle size={14} className="text-red-500" /> Issuing
                Stock
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Click the <strong>Issue</strong> button on any row to quickly
                issue stock to a technician or customer connection. The{" "}
                <strong>In Hand</strong> balance updates automatically.
              </p>
            </div>
            <div className="bg-white border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <History size={14} className="text-purple-600" /> Issue History
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Click the <strong>History</strong> button on any row to see a
                full timeline of all past issue events — who received the stock,
                when, and what the balance was after each issue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Summary Bar ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Package size={18} className="text-blue-600" />
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Stock Value
            </span>
            <p className="text-xl font-bold text-blue-700 leading-tight">
              PKR {totalValue.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="text-center">
            <p className="text-xs text-gray-400 font-medium">Items</p>
            <p className="font-bold text-gray-800 text-base">{items.length}</p>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
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

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left text-xs uppercase tracking-wide">
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Invoice / PO</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Unit</th>
                <th className="px-3 py-3 font-semibold">Total Qty</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="flex items-center gap-1">
                    <ArrowDownCircle size={11} className="text-green-500" />{" "}
                    Stock In
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold">
                  <span className="flex items-center gap-1">
                    <ArrowUpCircle size={11} className="text-red-400" /> Stock
                    Out
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold">
                  <span className="flex items-center gap-1">
                    <Warehouse size={11} className="text-purple-500" /> In Hand
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold">Rate (PKR)</th>
                <th className="px-3 py-3 font-semibold">Total Value</th>
                <th className="px-3 py-3 font-semibold">Remarks</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => {
                const logCount = Array.isArray(item.issueLog)
                  ? item.issueLog.length
                  : 0;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      <div>
                        {item.invoiceNo || (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                      {item.poNo && (
                        <div className="text-gray-400">{item.poNo}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-40">
                      {item.description}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {item.unit}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-green-600 font-medium">
                      {item.stockIn || 0}
                    </td>
                    <td className="px-3 py-2.5 text-red-500 font-medium">
                      {item.stockOut || 0}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={getStockColor(item.inHand, item.quantity)}
                        >
                          {item.inHand}
                        </span>
                        {getStockBadge(item.inHand, item.quantity)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {item.unitRate?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900">
                      PKR {(item.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 max-w-35">
                      {item.remarks ? (
                        <span
                          title={item.remarks}
                          className="block text-xs text-gray-400 truncate cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 hover:text-gray-700 hover:decoration-gray-500 transition-colors"
                        >
                          {item.remarks}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* ── Actions cell ── */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Issue — always visible */}
                        <button
                          onClick={() => setIssueItem(item)}
                          disabled={(item.inHand ?? 0) <= 0}
                          title={
                            (item.inHand ?? 0) <= 0
                              ? "Out of stock"
                              : `Issue ${item.description}`
                          }
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            (item.inHand ?? 0) > 0
                              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                              : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                          }`}
                        >
                          <ArrowUpCircle size={12} />
                          Issue
                        </button>

                        {/* History — shown when log exists, always visible */}
                        <button
                          onClick={() => setHistoryItem(item)}
                          title={`View issue history (${logCount} event${logCount !== 1 ? "s" : ""})`}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            logCount > 0
                              ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                              : "bg-gray-50 text-gray-400 border-gray-200"
                          }`}
                        >
                          <History size={12} />
                          {logCount > 0 ? logCount : ""}
                        </button>

                        {/* Edit + Delete — hover only */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditItem(item)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Edit item"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-14 text-center">
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

      {/* ── Add Modal ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Inventory Item"
        size="lg"
      >
        <InventoryForm onClose={() => setShowAdd(false)} />
      </Modal>

      {/* ── Edit Modal ── */}
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

      {/* ── Issue Stock Modal ── */}
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

      {/* ── Issue History Modal ── */}
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

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteItem(deleteTarget.id)}
        title="Delete Item"
        message={`Delete "${deleteTarget?.description}"? This cannot be undone.`}
        danger
      />
    </div>
  );
}
