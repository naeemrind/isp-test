/**
 * database.js
 *
 * This file has THREE sections:
 *
 *   PART 1 — Production code (Electron + npm run dev)
 *             ► UNCOMMENT this when development is complete and you switch to Electron.
 *             ► KEEP COMMENTED during the Vercel demo phase.
 *
 *   PART 2 — Temporary Vercel / localStorage code
 *             ► KEEP this ACTIVE right now (development / Vercel demo phase).
 *             ► DELETE entirely when you switch to Electron production.
 *
 *   PART 3 — Shared database logic (NEVER touch this section)
 *             ► Always active. Never comment this out. Both Part 1 and Part 2
 *               plug into this section through readAll() / writeAll().
 *
 * ─── How to switch when going to production ──────────────────────────────────
 *   1. Delete all of PART 2 (localStorage block).
 *   2. Uncomment PART 1.
 *   3. Done. Nothing else in the app needs to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// =============================================================================
// PART 1 — PRODUCTION CODE (Electron desktop app + npm run dev)
// STATUS: 🔴 COMMENTED OUT — only uncomment when switching to Electron
// =============================================================================
/*

const API = "/api/data";

// In-memory cache. Stores a deep-clone of the last known database state so
// that every read operation works on an isolated copy and never accidentally
// mutates the shared cache object.
let _cache = null;

async function readAll() {
  // Return a deep clone of the cache so callers can freely mutate the result
  // without corrupting the shared in-memory state. This prevents the race
  // condition where two concurrent writes both read the same cache reference
  // and the second write silently overwrites whatever the first write added.
  if (_cache) return structuredClone(_cache);

  let data;

  // ── Path A: Running inside the packaged Electron desktop app ──────────────
  if (window.electronAPI) {
    data = await window.electronAPI.readData();

    // Electron may return null/undefined if the data file is brand new or
    // was deleted. Fall back to an empty structure so the app never crashes.
    if (!data || typeof data !== "object") data = _getEmptyStructure();

    // Ensure every expected table exists even if the file predates a new
    // table being added (forward-compatibility guard).
    data = _ensureAllTables(data);

    _cache = structuredClone(data);
    return structuredClone(_cache);
  }

  // ── Path B: Running in the browser with `npm run dev` ─────────────────────
  // Vite's localDataPlugin in vite.config.js serves galaxy-data.json via
  // GET /api/data and accepts POST /api/data to write it back to disk.
  const res = await fetch(API);
  if (!res.ok) throw new Error(`[db] Failed to read data file: ${res.status}`);
  data = await res.json();

  data = _ensureAllTables(data);
  _cache = structuredClone(data);
  return structuredClone(_cache);
}

async function writeAll(data) {
  // Store a deep clone so future mutation of `data` by the caller cannot
  // corrupt the cache.
  _cache = structuredClone(data);

  // ── Path A: Electron ───────────────────────────────────────────────────────
  if (window.electronAPI) {
    const result = await window.electronAPI.writeData(data);
    if (result && result.ok === false) {
      // The Electron main process reported a write failure. Invalidate the
      // cache so the next read goes back to disk and we don't serve stale data.
      _cache = null;
      throw new Error(`[db] Electron write failed: ${result.error}`);
    }
    return;
  }

  // ── Path B: npm run dev (Vite dev server) ──────────────────────────────────
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    _cache = null; // invalidate on failure so next read is fresh from disk
    throw new Error(`[db] Failed to write data file: ${res.status}`);
  }
}

// Call this if you ever write to the data file from outside the normal db
// interface (e.g. a one-off migration script). Forces the next readAll() to
// re-read from disk instead of serving stale cache.
function invalidate() {
  _cache = null;
}

*/

// =============================================================================
// PART 2 — TEMPORARY CODE (Vercel demo / localStorage)
// STATUS: 🟢 ACTIVE — delete this entire block when switching to Electron
// =============================================================================

const DB_KEY = "galaxy_isp_data_v1";

async function readAll() {
  const raw = localStorage.getItem(DB_KEY);
  const data = raw ? JSON.parse(raw) : _getEmptyStructure();
  return _ensureAllTables(data);
}

async function writeAll(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function invalidate() {
  // No cache to clear in localStorage mode — localStorage.getItem always
  // reads the latest value, so there is no stale-data problem here.
}

// =============================================================================
// PART 3 — SHARED DATABASE LOGIC
// STATUS: 🟢 ALWAYS ACTIVE — never comment this out
// This section never cares whether Part 1 or Part 2 is active above.
// =============================================================================

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the canonical empty database structure.
 * Add new tables here when you add a new feature — they will automatically
 * appear for existing users on their next app launch (forward-compatibility).
 */
function _getEmptyStructure() {
  return {
    customers: [],
    paymentCycles: [],
    packages: [],
    inventory: [],
    expenses: [],
    connectionJobs: [],
    settings: {},
  };
}

/**
 * Guarantees every expected table exists on a data object loaded from disk.
 * This is important for users who installed an older version of the app —
 * their data file won't have tables that were added in newer versions, and
 * without this guard those missing tables would crash the app.
 */
function _ensureAllTables(data) {
  const empty = _getEmptyStructure();
  const result = { ...data };
  for (const key of Object.keys(empty)) {
    if (result[key] === undefined) {
      result[key] = empty[key];
    }
  }
  return result;
}

// ── Generic table operations ──────────────────────────────────────────────────

async function getTable(table) {
  const data = await readAll();
  return data[table] || [];
}

async function addRow(table, row) {
  const data = await readAll();
  const rows = data[table] || [];

  // Auto-increment ID: always one higher than the current maximum.
  // Using max() instead of rows.length ensures IDs stay unique even if rows
  // were deleted in the past (deleted ID 3 out of [1,2,3,4] → next is still 5,
  // not 4, which would collide with existing row 4).
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

// ── Settings (key/value store) ────────────────────────────────────────────────

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

// ── Public db interface ───────────────────────────────────────────────────────
// All Zustand stores and utility functions in the app talk to this object only.
// They never call readAll() or writeAll() directly (except backup.js which is
// a deliberate low-level utility).

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

  connectionJobs: {
    toArray: () => getTable("connectionJobs"),
    get: (id) => getRow("connectionJobs", id),
    add: (row) => addRow("connectionJobs", row).then((r) => r.id),
    update: (id, data) => updateRow("connectionJobs", id, data),
    delete: (id) => deleteRow("connectionJobs", id),
  },

  settings: {
    get: (key) => getSetting(key),
    put: ({ key, value }) => setSetting(key, value),
  },
};

export default db;
export { readAll, writeAll, invalidate };
