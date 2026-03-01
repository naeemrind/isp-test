import { useState, useRef } from "react";
import { Download, Upload, Settings } from "lucide-react";
import { exportBackup, importBackup } from "../../utils/backup";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function Navbar({ activeTab, onTabChange }) {
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef();

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "customers", label: "Subscribers" },
    { id: "inventory", label: "Inventory" },
    { id: "expenses", label: "Expenses" },
    { id: "settings", label: "Settings" },
  ];

  const handleImportSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmImport(true);
    e.target.value = "";
  };

  const doImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      await importBackup(pendingFile);
      window.location.reload();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
    setImporting(false);
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 flex items-center justify-between h-12">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-800 text-sm mr-4">
            Galaxy ISP
          </span>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`px-3 py-1.5 text-sm rounded font-medium ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Download size={14} />
            Backup
          </button>
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload size={14} />
            Restore
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportSelect}
          />
        </div>
      </nav>

      <ConfirmDialog
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        onConfirm={doImport}
        title="Restore from Backup"
        message="This will REPLACE all current data with the backup file. This cannot be undone. Are you sure?"
        confirmLabel="Yes, Restore"
        danger
      />
    </>
  );
}
