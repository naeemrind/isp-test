import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  History,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import usePackageStore from "../store/usePackageStore";
import db from "../db/database";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatDate, today } from "../utils/dateUtils";

// ─── HELPER COMPONENT (Defined outside to avoid re-render issues) ───
const SortIcon = ({ column, sortConfig }) => {
  if (sortConfig.key !== column)
    return <div className="w-3.5 h-3.5 inline-block" />;

  return sortConfig.direction === "asc" ? (
    <ArrowUp size={14} className="inline-block text-gray-700" />
  ) : (
    <ArrowDown size={14} className="inline-block text-gray-700" />
  );
};

export default function Settings() {
  // Store Hooks
  const packages = usePackageStore((s) => s.packages);
  const addPackage = usePackageStore((s) => s.addPackage);
  const updatePackage = usePackageStore((s) => s.updatePackage);
  const deletePackage = usePackageStore((s) => s.deletePackage);

  // Local Settings State (Areas/Agents)
  const [areas, setAreas] = useState([]);
  const [agents, setAgents] = useState([]);
  const [newArea, setNewArea] = useState("");
  const [newAgent, setNewAgent] = useState("");

  // Package Management State
  const [newPkg, setNewPkg] = useState({ name: "", price: "", speedMbps: "" });
  const [editPkgId, setEditPkgId] = useState(null);
  const [editPkgData, setEditPkgData] = useState({});
  const [historyPkg, setHistoryPkg] = useState(null);
  const [deletePkg, setDeletePkg] = useState(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState({
    key: "price",
    direction: "asc",
  });

  // Load Initial Data
  useEffect(() => {
    const loadSettings = async () => {
      const a = await db.settings.get("areas");
      const g = await db.settings.get("agents");
      setAreas(a?.value || []);
      setAgents(g?.value || []);
    };
    loadSettings();
  }, []);

  // ── AREA / AGENT HANDLERS ──
  const saveAreas = async (list) => {
    setAreas(list);
    await db.settings.put({ key: "areas", value: list });
  };
  const saveAgents = async (list) => {
    setAgents(list);
    await db.settings.put({ key: "agents", value: list });
  };

  const addArea = async () => {
    const v = newArea.trim();
    if (!v || areas.includes(v)) return;
    await saveAreas([...areas, v]);
    setNewArea("");
  };
  const removeArea = (a) => saveAreas(areas.filter((x) => x !== a));

  const addAgent = async () => {
    const v = newAgent.trim();
    if (!v || agents.includes(v)) return;
    await saveAgents([...agents, v]);
    setNewAgent("");
  };
  const removeAgent = (a) => saveAgents(agents.filter((x) => x !== a));

  // ── PACKAGE HANDLERS ──
  const handleAddPkg = async () => {
    if (!newPkg.name || !newPkg.price) return;
    await addPackage({
      name: newPkg.name,
      price: newPkg.price,
      speedMbps: newPkg.speedMbps,
    });
    setNewPkg({ name: "", price: "", speedMbps: "" });
  };

  const startEdit = (pkg) => {
    setEditPkgId(pkg.id);
    // Copy all fields to edit state
    setEditPkgData({
      name: pkg.name,
      price: pkg.price,
      speedMbps: pkg.speedMbps || "",
    });
  };

  const saveEdit = async () => {
    if (!editPkgId) return;
    await updatePackage(editPkgId, editPkgData);
    setEditPkgId(null);
    setEditPkgData({});
  };

  const cancelEdit = () => {
    setEditPkgId(null);
    setEditPkgData({});
  };

  const handleConfirmDelete = async () => {
    if (deletePkg) {
      await deletePackage(deletePkg.id);
      setDeletePkg(null);
    }
  };

  // ── SORTING LOGIC ──
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPackages = [...packages].sort((a, b) => {
    const { key, direction } = sortConfig;
    const modifier = direction === "asc" ? 1 : -1;

    switch (key) {
      case "name":
        return modifier * a.name.localeCompare(b.name);
      case "speedMbps":
        return (
          modifier * ((Number(a.speedMbps) || 0) - (Number(b.speedMbps) || 0))
        );
      case "price":
        return modifier * (Number(a.price) - Number(b.price));
      case "lastUpdated": {
        // Wrapped in braces to fix lexical declaration error
        const dateA = a.lastUpdated ? new Date(a.lastUpdated) : new Date(0);
        const dateB = b.lastUpdated ? new Date(b.lastUpdated) : new Date(0);
        return modifier * (dateA - dateB);
      }
      default:
        return 0;
    }
  });

  return (
    <div className="p-5 space-y-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your internet packages, coverage areas, and recovery agents.
        </p>
      </div>

      {/* PACKAGES SECTION */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              Internet Packages
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Active customer cycles are{" "}
              <strong className="text-gray-700">NOT</strong> affected by price
              changes until they renew.
            </p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            {packages.length} Packages
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white text-gray-500 text-left border-b border-gray-200">
                <th
                  onClick={() => requestSort("name")}
                  className="px-6 py-4 font-semibold w-1/4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Package Name{" "}
                    <SortIcon column="name" sortConfig={sortConfig} />
                  </div>
                </th>
                <th
                  onClick={() => requestSort("speedMbps")}
                  className="px-6 py-4 font-semibold w-1/6 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Speed{" "}
                    <SortIcon column="speedMbps" sortConfig={sortConfig} />
                  </div>
                </th>
                <th
                  onClick={() => requestSort("price")}
                  className="px-6 py-4 font-semibold w-1/6 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Current Price{" "}
                    <SortIcon column="price" sortConfig={sortConfig} />
                  </div>
                </th>
                <th
                  onClick={() => requestSort("lastUpdated")}
                  className="px-6 py-4 font-semibold w-1/6 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Last Updated{" "}
                    <SortIcon column="lastUpdated" sortConfig={sortConfig} />
                  </div>
                </th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPackages.map((pkg) => (
                <tr
                  key={pkg.id}
                  className="hover:bg-gray-50/80 transition-colors"
                >
                  {editPkgId === pkg.id ? (
                    // EDIT MODE
                    <>
                      <td className="px-6 py-3">
                        <input
                          autoFocus
                          className={inp()}
                          value={editPkgData.name}
                          onChange={(e) =>
                            setEditPkgData((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          className={inp()}
                          value={editPkgData.speedMbps}
                          placeholder="Mbps"
                          onChange={(e) =>
                            setEditPkgData((d) => ({
                              ...d,
                              speedMbps: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          className={inp()}
                          value={editPkgData.price}
                          onChange={(e) =>
                            setEditPkgData((d) => ({
                              ...d,
                              price: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="px-6 py-3 text-gray-400 text-xs italic">
                        Editing...
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveEdit}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            title="Save Changes"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800 text-base">
                          {pkg.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded text-xs font-medium border border-gray-200">
                          {pkg.speedMbps ? `${pkg.speedMbps} Mbps` : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-700 text-base">
                          PKR {Number(pkg.price).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {pkg.lastUpdated ? (
                          <div
                            className={`flex items-center gap-1.5 text-xs ${pkg.lastUpdated === today() ? "text-green-600 font-bold" : ""}`}
                          >
                            <Calendar
                              size={13}
                              className={
                                pkg.lastUpdated === today()
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                            />
                            {pkg.lastUpdated === today()
                              ? "Today"
                              : formatDate(pkg.lastUpdated)}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Original
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setHistoryPkg(pkg)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
                          >
                            <History size={14} /> History
                          </button>

                          <button
                            onClick={() => startEdit(pkg)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() => setDeletePkg(pkg)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    No packages configured. Add your first package below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ADD FORM */}
        <div className="p-5 bg-gray-50 border-t border-gray-200 flex flex-wrap md:flex-nowrap gap-4 items-center">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
            Add New Package:
          </span>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className={inp()}
              placeholder="Name (e.g. Gamer Plus)"
              value={newPkg.name}
              onChange={(e) =>
                setNewPkg((d) => ({ ...d, name: e.target.value }))
              }
            />
            <input
              type="number"
              className={inp()}
              placeholder="Price (PKR)"
              value={newPkg.price}
              onChange={(e) =>
                setNewPkg((d) => ({ ...d, price: e.target.value }))
              }
            />
            <input
              type="number"
              className={inp()}
              placeholder="Speed (Mbps)"
              value={newPkg.speedMbps}
              onChange={(e) =>
                setNewPkg((d) => ({ ...d, speedMbps: e.target.value }))
              }
            />
          </div>
          <button
            onClick={handleAddPkg}
            className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 shadow-lg shadow-gray-200"
          >
            <Plus size={16} /> Add Package
          </button>
        </div>
      </section>

      {/* LISTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <ListManager
          title="Coverage Areas"
          items={areas}
          newValue={newArea}
          onNewValueChange={setNewArea}
          onAdd={addArea}
          onRemove={removeArea}
          placeholder="e.g. Model Town"
        />
        <ListManager
          title="Recovery Agents"
          items={agents}
          newValue={newAgent}
          onNewValueChange={setNewAgent}
          onAdd={addAgent}
          onRemove={removeAgent}
          placeholder="e.g. Ali Raza"
        />
      </div>

      {/* HISTORY MODAL (TIMELINE) */}
      <Modal
        isOpen={!!historyPkg}
        onClose={() => setHistoryPkg(null)}
        title={`Price History: ${historyPkg?.name}`}
        size="md"
      >
        <div className="p-1">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">
                Current Price
              </p>
              <p className="text-2xl font-black text-blue-900">
                PKR {Number(historyPkg?.price).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-2 rounded-full shadow-sm">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-800 mb-4 px-1">
            Change Log
          </h3>

          <div className="relative pl-4 border-l-2 border-gray-200 space-y-8 ml-2">
            {(historyPkg?.priceHistory || []).length === 0 ? (
              <div className="text-gray-400 text-sm flex items-center gap-2 pl-2">
                <AlertCircle size={16} /> No price changes recorded since
                creation.
              </div>
            ) : (
              [...historyPkg.priceHistory].reverse().map((h, i) => (
                <div key={i} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[21px] top-3.5 w-3 h-3 bg-white rounded-full border-2 border-blue-500 ring-4 ring-blue-50"></div>

                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-gray-500">
                        {formatDate(h.changedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-800">
                      <span className="font-medium text-gray-400 line-through decoration-red-400">
                        PKR {h.oldPrice.toLocaleString()}
                      </span>
                      <ArrowRight size={14} className="text-gray-300" />
                      <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        PKR {Number(h.newPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Initial Entry (Virtual) */}
            <div className="relative pt-4">
              <div className="absolute -left-[21px] top-5 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
              <div className="text-xs text-gray-400 pl-2 pt-1">
                Package Created{" "}
                {historyPkg?.createdAt
                  ? `on ${formatDate(historyPkg.createdAt)}`
                  : ""}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setHistoryPkg(null)}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deletePkg}
        onClose={() => setDeletePkg(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Package"
        message={`Are you sure you want to delete "${deletePkg?.name}"? This cannot be undone.`}
        confirmLabel="Delete Package"
        requirePassword={true}
        danger={true}
      />
    </div>
  );
}

// Sub-component
function ListManager({
  title,
  items,
  newValue,
  onNewValueChange,
  onAdd,
  onRemove,
  placeholder,
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            className={`${inp()} flex-1`}
            placeholder={placeholder}
            value={newValue}
            onChange={(e) => onNewValueChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          <button
            onClick={onAdd}
            className="px-4 py-2 text-sm bg-gray-900 text-white font-medium rounded-lg hover:bg-black flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} /> Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm"
            >
              {item}
              <button
                onClick={() => onRemove(item)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </span>
          ))}
          {items.length === 0 && (
            <span className="text-sm text-gray-400 italic">
              None added yet.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

const inp = () =>
  "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full";
