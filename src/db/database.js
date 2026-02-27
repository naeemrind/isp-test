/**
 * database.js — File-based storage via Vite dev server API
 * Replaces IndexedDB/Dexie entirely.
 * Data is stored in galaxy-data.json at the project root.
 * All Chrome profiles, all browsers on the same machine share the same file.
 */

const API = "/api/data";

// In-memory cache so we don't hit the file on every single read
let _cache = null;

// Replace your existing readAll and writeAll in src/db/database.js with these:

async function readAll() {
  if (_cache) return _cache;

  // 1. Check if we are running inside the Electron Desktop App
  if (window.electronAPI) {
    _cache = await window.electronAPI.readData();
    return _cache;
  }

  // 2. Fallback for normal browser (npm run dev)
  const res = await fetch(API);
  if (!res.ok) throw new Error("Failed to read data file");
  _cache = await res.json();
  return _cache;
}

async function writeAll(data) {
  _cache = data;

  // 1. Check if we are running inside the Electron Desktop App
  if (window.electronAPI) {
    await window.electronAPI.writeData(data);
    return;
  }

  // 2. Fallback for normal browser (npm run dev)
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to write data file");
}
// Invalidate cache (called after writes so next read is fresh)
function invalidate() {
  _cache = null;
}

// ── Generic table operations ─────────────────────────────────────

async function getTable(table) {
  const data = await readAll();
  return data[table] || [];
}

async function addRow(table, row) {
  const data = await readAll();
  const rows = data[table] || [];
  // Auto-increment ID
  const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  const newRow = { ...row, id: maxId + 1 };
  data[table] = [...rows, newRow];
  await writeAll(data);
  return newRow;
}

async function updateRow(table, id, updates) {
  const data = await readAll();
  data[table] = (data[table] || []).map((r) =>
    r.id === id ? { ...r, ...updates } : r,
  );
  await writeAll(data);
}

async function deleteRow(table, id) {
  const data = await readAll();
  data[table] = (data[table] || []).filter((r) => r.id !== id);
  await writeAll(data);
}

async function getRow(table, id) {
  const rows = await getTable(table);
  return rows.find((r) => r.id === id) || null;
}

async function deleteManyWhere(table, field, value) {
  const data = await readAll();
  data[table] = (data[table] || []).filter((r) => r[field] !== value);
  await writeAll(data);
}

// ── Settings (key/value store) ───────────────────────────────────

async function getSetting(key) {
  const data = await readAll();
  const val = (data.settings || {})[key];
  return val !== undefined ? { key, value: val } : null;
}

async function setSetting(key, value) {
  const data = await readAll();
  data.settings = { ...(data.settings || {}), [key]: value };
  await writeAll(data);
}

// ── db interface (mirrors the Dexie API used by stores) ─────────

const db = {
  customers: {
    toArray: () => getTable("customers"),
    get: (id) => getRow("customers", id),
    add: (row) => addRow("customers", row).then((r) => r.id),
    update: (id, data) => updateRow("customers", id, data),
    delete: (id) => deleteRow("customers", id),
  },
  paymentCycles: {
    toArray: () => getTable("paymentCycles"),
    get: (id) => getRow("paymentCycles", id),
    add: (row) => addRow("paymentCycles", row).then((r) => r.id),
    update: (id, data) => updateRow("paymentCycles", id, data),
    delete: (id) => deleteRow("paymentCycles", id),
    where: (field) => ({
      equals: (value) => ({
        delete: () => deleteManyWhere("paymentCycles", field, value),
        toArray: async () => {
          const rows = await getTable("paymentCycles");
          return rows.filter((r) => r[field] === value);
        },
      }),
    }),
  },
  packages: {
    toArray: () => getTable("packages"),
    get: (id) => getRow("packages", id),
    add: (row) => addRow("packages", row).then((r) => r.id),
    update: (id, data) => updateRow("packages", id, data),
    delete: (id) => deleteRow("packages", id),
  },
  inventory: {
    toArray: () => getTable("inventory"),
    get: (id) => getRow("inventory", id),
    add: (row) => addRow("inventory", row).then((r) => r.id),
    update: (id, data) => updateRow("inventory", id, data),
    delete: (id) => deleteRow("inventory", id),
  },
  expenses: {
    toArray: () => getTable("expenses"),
    get: (id) => getRow("expenses", id),
    add: (row) => addRow("expenses", row).then((r) => r.id),
    update: (id, data) => updateRow("expenses", id, data),
    delete: (id) => deleteRow("expenses", id),
  },
  settings: {
    get: (key) => getSetting(key),
    put: ({ key, value }) => setSetting(key, value),
  },
};

export default db;
export { readAll, writeAll, invalidate };
