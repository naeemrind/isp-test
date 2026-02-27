import { readAll, writeAll } from "../db/database";

export const exportBackup = async () => {
  const data = await readAll();

  const backup = {
    exportedAt: new Date().toISOString(),
    version: "2.0",
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = `galaxy-isp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);

  // Save last backup date
  const updated = await readAll();
  updated.settings = {
    ...(updated.settings || {}),
    lastBackupDate: new Date().toISOString().slice(0, 10),
  };
  await writeAll(updated);
};

export const importBackup = async (file) => {
  const text = await file.text();
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup file. Could not parse JSON.");
  }

  // Support both v1 (Dexie) and v2 (file-based) backup formats
  let restored;
  if (backup.data && backup.version === "2.0") {
    restored = backup.data;
  } else if (backup.data) {
    // v1 format conversion
    const d = backup.data;
    restored = {
      customers: d.customers || [],
      paymentCycles: d.cycles || [],
      packages: d.packages || [],
      inventory: d.inventory || [],
      expenses: d.expenses || [],
      settings: {},
    };
    (d.settings || []).forEach((s) => {
      restored.settings[s.key] = s.value;
    });
  } else {
    throw new Error("Invalid backup format.");
  }

  await writeAll(restored);
};

export const getLastBackupDate = async () => {
  const data = await readAll();
  return (data.settings || {}).lastBackupDate || null;
};
