import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { getLastBackupDate, exportBackup } from "../../utils/backup";
import { today } from "../../utils/dateUtils";

export default function BackupBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLastBackupDate().then((date) => {
      if (date !== today()) setShow(true);
    });
  }, []);

  if (!show) return null;

  const handleBackup = async () => {
    setLoading(true);
    await exportBackup();
    setLoading(false);
    setShow(false);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <AlertTriangle size={15} />
        <span>No backup yet today. Save your data before closing.</span>
      </div>
      <button
        onClick={handleBackup}
        disabled={loading}
        className="text-amber-800 underline font-medium hover:text-amber-900 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Backup Now"}
      </button>
    </div>
  );
}
