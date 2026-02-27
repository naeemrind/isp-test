import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import InventoryForm from "./InventoryForm";
import useInventoryStore from "../../store/useInventoryStore";
import { formatDate } from "../../utils/dateUtils";

export default function Inventory() {
  const items = useInventoryStore((s) => s.items);
  const deleteItem = useInventoryStore((s) => s.deleteItem);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalValue = items.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-800">Inventory</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {items.length} items
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      <div className="bg-blue-50 rounded p-3 text-sm">
        <span className="text-gray-500">Total Inventory Value:</span>{" "}
        <strong className="text-blue-700">
          PKR {totalValue.toLocaleString()}
        </strong>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-left">
              {[
                "Date",
                "Invoice",
                "PO",
                "Description",
                "Unit",
                "Qty",
                "Received",
                "Issued",
                "Balanced",
                "Rate",
                "Amount",
                "Remarks",
                "",
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {formatDate(item.date)}
                </td>
                <td className="px-3 py-2 text-xs">{item.invoiceNo || "-"}</td>
                <td className="px-3 py-2 text-xs">{item.poNo || "-"}</td>
                <td className="px-3 py-2 font-medium">{item.description}</td>
                <td className="px-3 py-2 text-xs">{item.unit}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{item.received}</td>
                <td className="px-3 py-2">{item.issued}</td>
                <td className="px-3 py-2">{item.balanced}</td>
                <td className="px-3 py-2">{item.unitRate}</td>
                <td className="px-3 py-2 font-medium">
                  PKR {(item.amount || 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">
                  {item.remarks || "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1 rounded text-gray-500 hover:bg-gray-100"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1 rounded text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  className="px-3 py-8 text-center text-gray-400 text-sm"
                >
                  No inventory items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
        title="Edit Item"
        size="lg"
      >
        {editItem && (
          <InventoryForm item={editItem} onClose={() => setEditItem(null)} />
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteItem(deleteTarget.id)}
        title="Delete Item"
        message={`Delete "${deleteTarget?.description}"?`}
      />
    </div>
  );
}
