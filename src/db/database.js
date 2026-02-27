/**
 * database.js — Modified for Vercel / LocalStorage
 */

// ------------------------------------------------------------------
// PART 1: ORIGINAL CODE (COMMENTED OUT)
// ------------------------------------------------------------------
/*
const API = "/api/data";

// In-memory cache so we don't hit the file on every single read
let _cache = null;

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

function invalidate() {
  _cache = null;
}
*/

// ------------------------------------------------------------------
// PART 2: NEW CODE (FOR VERCEL / LOCALSTORAGE)
// ------------------------------------------------------------------

// This key is where your data lives in the browser
const DB_KEY = "galaxy_isp_data_v1";

// New readAll function
async function readAll() {
  // 1. Try to get data from Chrome/Browser LocalStorage
  const rawData = localStorage.getItem(DB_KEY);

  // 2. If data exists, parse it into JSON and return it
  if (rawData) {
    return JSON.parse(rawData);
  }

  // 3. If NO data exists (first time loading), return an empty structure.
  // This prevents "undefined" errors in the rest of your app.
  return {
    customers: [],
    paymentCycles: [],
    packages: [],
    inventory: [],
    expenses: [],
    settings: {},
  };
}

// New writeAll function
async function writeAll(data) {
  // Save the data object as a string in LocalStorage
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// New invalidate function (does nothing, but prevents errors)
function invalidate() {
  // No cache to clear in LocalStorage mode
}

// ------------------------------------------------------------------
// PART 3: EXISTING LOGIC (KEEP EVERYTHING BELOW THIS LINE AS IS)
// ------------------------------------------------------------------
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
