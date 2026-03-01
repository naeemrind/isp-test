// src/utils/devTools.js
// ─────────────────────────────────────────────────────────────────────────────
//  Galaxy ISP — Developer / Test-Data Tools
//  Attach to window so you can call them from the browser console.
// ─────────────────────────────────────────────────────────────────────────────
import db from "../db/database";
import usePaymentStore from "../store/usePaymentStore";
import useCustomerStore from "../store/useCustomerStore";
import useExpenseStore from "../store/useExpenseStore";
import useInventoryStore from "../store/useInventoryStore";
import usePackageStore from "../store/usePackageStore";
import useConnectionJobStore from "../store/useConnectionJobStore";
import { addDays, today, CYCLE_LENGTH_DAYS } from "./dateUtils";

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_AREAS = [
  "City Center",
  "North Town",
  "South Block",
  "Garden Colony",
  "Model Town",
  "DHA Phase 1",
];

const SEED_AGENTS = [
  "Usman Tariq",
  "Bilal Raza",
  "Kamran Sheikh",
  "Naveed Akhtar",
  "Zubair Malik",
  "Adeel Hussain",
];

const SEED_PACKAGES = [
  { name: "Starter 5 MB", speedMbps: 5, price: 800 },
  { name: "Basic 10 MB", speedMbps: 10, price: 1400 },
  { name: "Standard 25 MB", speedMbps: 25, price: 2200 },
  { name: "Fast 50 MB", speedMbps: 50, price: 3200 },
  { name: "Ultra 100 MB", speedMbps: 100, price: 4800 },
];

// 7 inventory items with varied stock levels
const SEED_INVENTORY = [
  { description: "ONU Device", unit: "piece", qty: 250, unitRate: 900 },
  { description: "Fiber Cable", unit: "meter", qty: 8000, unitRate: 18 },
  { description: "Ethernet Cable", unit: "meter", qty: 4000, unitRate: 12 },
  { description: "Splitter 1:8", unit: "piece", qty: 120, unitRate: 380 },
  { description: "Wall Socket", unit: "piece", qty: 350, unitRate: 130 },
  { description: "Cable Tie", unit: "piece", qty: 2000, unitRate: 5 },
  { description: "Fiber Connector", unit: "piece", qty: 500, unitRate: 45 },
];

// Pakistani names pool
const FIRST_NAMES = [
  "Ahmed",
  "Ali",
  "Hassan",
  "Usman",
  "Bilal",
  "Tariq",
  "Imran",
  "Faisal",
  "Zubair",
  "Naveed",
  "Kamran",
  "Salman",
  "Asad",
  "Omar",
  "Adeel",
  "Hamid",
  "Waseem",
  "Shoaib",
  "Irfan",
  "Javed",
  "Fatima",
  "Ayesha",
  "Sana",
  "Nadia",
  "Maria",
  "Hira",
  "Zara",
  "Sara",
  "Amna",
  "Rabia",
  "Saima",
  "Uzma",
  "Shazia",
  "Bushra",
  "Nazia",
  "Sobia",
  "Rubina",
  "Samia",
  "Asma",
  "Kiran",
];
const LAST_NAMES = [
  "Khan",
  "Ahmed",
  "Ali",
  "Malik",
  "Sheikh",
  "Butt",
  "Chaudhry",
  "Akhtar",
  "Hussain",
  "Baig",
  "Mirza",
  "Qureshi",
  "Siddiqui",
  "Ansari",
  "Hashmi",
  "Raza",
  "Rizvi",
  "Javed",
  "Iqbal",
  "Nawaz",
  "Zafar",
  "Mehmood",
  "Aslam",
  "Farooq",
  "Bhatti",
  "Dogar",
  "Gondal",
  "Niazi",
  "Warraich",
  "Bajwa",
];

// ─── Status Distribution ──────────────────────────────────────────────────────
//
//  Display statuses (from Statusutils.js):
//    "clear"     → active customer, active cycle, fully paid
//    "pending"   → active customer, active cycle, unpaid balance
//    "expired"   → active customer, cycle ended + unpaid
//    "renewal"   → active customer, cycle ended + paid (needs renewal)
//    "suspended" → manually suspended by operator
//
//  We map these to internal "scenario" keys used by buildCycles():
//    "clear"     → 35 %
//    "pending"   → 25 %
//    "expired"   → 15 %
//    "renewal"   → 10 %
//    "suspended" → 10 %
//    "archived"  → 5  %

const STATUS_POOL = [
  ...Array(35).fill("clear"),
  ...Array(25).fill("pending"),
  ...Array(15).fill("expired"),
  ...Array(10).fill("renewal"),
  ...Array(10).fill("suspended"),
  ...Array(5).fill("archived"),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone() {
  const prefixes = [
    "0300",
    "0301",
    "0302",
    "0303",
    "0311",
    "0312",
    "0321",
    "0333",
    "0345",
    "0346",
  ];
  return pick(prefixes) + String(rand(1000000, 9999999));
}

function randomUsername(firstName, lastName, idx) {
  return (firstName + lastName).toLowerCase().replace(/\s/g, "") + idx;
}

function makeInstallment(amountPaid, datePaid, note = "Seeded") {
  return {
    id: crypto.randomUUID(),
    amountPaid,
    datePaid,
    note,
    createdAt: new Date().toISOString(),
  };
}

async function reloadAll() {
  await Promise.all([
    useCustomerStore.getState().loadCustomers(),
    usePaymentStore.getState().loadCycles(),
    useExpenseStore.getState().loadExpenses(),
    useInventoryStore.getState().loadInventory(),
    usePackageStore.getState().loadPackages(),
    useConnectionJobStore.getState().loadJobs(),
  ]);
}

// ─── Core: Build payment cycles for one customer ──────────────────────────────
//
//  numHistoricalCycles: how many past cycles to create before the current one.
//  scenario:           drives the shape of the CURRENT (latest) cycle.
//
//  Historical pattern (cycles before the current one):
//    Even index → paid in full
//    Odd  index → carried forward (shifted to next cycle)
//
async function buildCycles(
  customerId,
  packagePrice,
  scenario,
  numHistoricalCycles = 3,
) {
  const totalCycles = numHistoricalCycles + 1; // historical + current

  // Build date ranges (oldest → newest)
  const ranges = [];
  // Current cycle: started 5 days ago, ends CYCLE_LENGTH_DAYS later
  let end = addDays(today(), CYCLE_LENGTH_DAYS - 5);
  let start = addDays(today(), -5);
  for (let i = 0; i < totalCycles; i++) {
    ranges.unshift({ start, end });
    end = addDays(start, -1);
    start = addDays(end, -CYCLE_LENGTH_DAYS);
  }

  let pendingFromPrev = 0;

  // Historical cycles
  for (let i = 0; i < numHistoricalCycles; i++) {
    const { start: s, end: e } = ranges[i];
    const isPaid = i % 2 === 0;
    const totalAmount = packagePrice + pendingFromPrev;
    const previousBalance = pendingFromPrev;

    if (isPaid) {
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: s,
        cycleEndDate: e,
        totalAmount,
        amountPaid: totalAmount,
        amountPending: 0,
        status: "clear",
        shiftedAmount: 0,
        previousBalance,
        installments: [makeInstallment(totalAmount, s, "Seed: paid")],
        isRenewal: i > 0,
        createdAt: new Date().toISOString(),
      });
      pendingFromPrev = 0;
    } else {
      // Unpaid — carried forward
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: s,
        cycleEndDate: e,
        totalAmount,
        amountPaid: 0,
        amountPending: 0,
        status: "clear",
        shiftedAmount: totalAmount,
        previousBalance,
        installments: [],
        isRenewal: i > 0,
        createdAt: new Date().toISOString(),
      });
      pendingFromPrev = totalAmount;
    }
  }

  // Current cycle
  const { start: cs, end: ce } = ranges[totalCycles - 1];
  const totalAmount = packagePrice + pendingFromPrev;
  const previousBalance = pendingFromPrev;

  switch (scenario) {
    case "clear":
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: cs,
        cycleEndDate: ce,
        totalAmount,
        amountPaid: totalAmount,
        amountPending: 0,
        status: "clear",
        shiftedAmount: 0,
        previousBalance,
        installments: [makeInstallment(totalAmount, cs, "Seed: cleared")],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;

    case "pending": {
      // Partially paid — some amount still owed within active cycle
      const partialPaid = Math.floor(totalAmount * (rand(10, 60) / 100));
      const stillOwed = totalAmount - partialPaid;
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: cs,
        cycleEndDate: ce,
        totalAmount,
        amountPaid: partialPaid,
        amountPending: stillOwed,
        status: "pending",
        shiftedAmount: 0,
        previousBalance,
        installments:
          partialPaid > 0
            ? [
                makeInstallment(
                  partialPaid,
                  addDays(cs, rand(1, 5)),
                  "Seed: partial",
                ),
              ]
            : [],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    case "expired": {
      // Cycle ended 10–20 days ago, still unpaid
      const expiredEnd = addDays(today(), -rand(10, 20));
      const expiredStart = addDays(expiredEnd, -CYCLE_LENGTH_DAYS);
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: expiredStart,
        cycleEndDate: expiredEnd,
        totalAmount,
        amountPaid: 0,
        amountPending: totalAmount,
        status: "pending",
        shiftedAmount: 0,
        previousBalance,
        installments: [],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    case "renewal": {
      // Cycle ended recently, fully paid → needs renewal
      const renewEnd = addDays(today(), -rand(1, 5));
      const renewStart = addDays(renewEnd, -CYCLE_LENGTH_DAYS);
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: renewStart,
        cycleEndDate: renewEnd,
        totalAmount,
        amountPaid: totalAmount,
        amountPending: 0,
        status: "clear",
        shiftedAmount: 0,
        previousBalance,
        installments: [
          makeInstallment(totalAmount, renewStart, "Seed: renewal"),
        ],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    case "suspended": {
      // Partial payment, cycle active, customer manually suspended
      const partial = Math.floor(totalAmount * (rand(20, 50) / 100));
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: cs,
        cycleEndDate: ce,
        totalAmount,
        amountPaid: partial,
        amountPending: totalAmount - partial,
        status: "pending",
        shiftedAmount: 0,
        previousBalance,
        installments: [
          makeInstallment(
            partial,
            addDays(cs, 2),
            "Seed: partial before suspend",
          ),
        ],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    case "archived": {
      // Old, fully paid cycle from 60–90 days ago
      const archEnd = addDays(today(), -rand(60, 90));
      const archStart = addDays(archEnd, -CYCLE_LENGTH_DAYS);
      await db.paymentCycles.add({
        customerId: Number(customerId),
        cycleStartDate: archStart,
        cycleEndDate: archEnd,
        totalAmount: packagePrice,
        amountPaid: packagePrice,
        amountPending: 0,
        status: "clear",
        shiftedAmount: 0,
        previousBalance: 0,
        installments: [
          makeInstallment(packagePrice, archStart, "Seed: archived final"),
        ],
        isRenewal: true,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    default:
      break;
  }
}

// ─── Main DevTools Setup ──────────────────────────────────────────────────────

export const setupDevTools = () => {
  // ════════════════════════════════════════════════════════════════════════════
  //  seedAll(count, wipeFirst)
  //  The one-command full seeder.
  //
  //  Usage:
  //    seedAll()              → seed everything with 1000 subscribers
  //    seedAll(200)           → 200 subscribers (faster for quick checks)
  //    seedAll(1000, true)    → wipe all existing data first, then seed 1000
  // ════════════════════════════════════════════════════════════════════════════
  window.seedAll = async (count = 1000, wipeFirst = false) => {
    if (wipeFirst) {
      const ok = confirm(
        `⚠️ This will DELETE all existing data and seed ${count} subscribers. Continue?`,
      );
      if (!ok) return;
      await _wipeAllData(true);
    }

    console.log(
      `⏳ Starting full seed: areas + agents + packages + inventory + ${count} subscribers…`,
    );
    const t0 = Date.now();

    // ── Areas ────────────────────────────────────────────────────────────────
    const existingAreas = (await db.settings.get("areas"))?.value || [];
    const mergedAreas = [...new Set([...existingAreas, ...SEED_AREAS])];
    await db.settings.put({ key: "areas", value: mergedAreas });
    console.log(
      `  ✅ Areas (${mergedAreas.length}): ${mergedAreas.join(", ")}`,
    );

    // ── Recovery Agents ──────────────────────────────────────────────────────
    const existingAgents = (await db.settings.get("agents"))?.value || [];
    const mergedAgents = [...new Set([...existingAgents, ...SEED_AGENTS])];
    await db.settings.put({ key: "agents", value: mergedAgents });
    console.log(
      `  ✅ Agents (${mergedAgents.length}): ${mergedAgents.join(", ")}`,
    );

    // ── Packages ─────────────────────────────────────────────────────────────
    let existingPkgs = await db.packages.toArray();
    if (existingPkgs.length === 0) {
      for (const pkg of SEED_PACKAGES) {
        await db.packages.add({
          ...pkg,
          priceHistory: [],
          lastUpdated: null,
          createdAt: new Date().toISOString(),
        });
      }
      existingPkgs = await db.packages.toArray();
      console.log(
        `  ✅ Packages (${existingPkgs.length}): ${existingPkgs.map((p) => p.name).join(", ")}`,
      );
    } else {
      console.log(
        `  ℹ️  Packages already exist (${existingPkgs.length}), skipping.`,
      );
    }

    // ── Inventory ────────────────────────────────────────────────────────────
    let existingInv = await db.inventory.toArray();
    if (existingInv.length === 0) {
      for (const item of SEED_INVENTORY) {
        await db.inventory.add({
          description: item.description,
          unit: item.unit,
          quantity: item.qty,
          unitRate: item.unitRate,
          amount: item.qty * item.unitRate,
          stockIn: item.qty,
          stockOut: 0,
          inHand: item.qty,
          received: item.qty,
          issued: 0,
          balanced: item.qty,
          purchaseDate: today(),
          invoiceNo: null,
          remarks: "Seeded by devTools",
          restockLog: [],
          issueLog: [],
          createdAt: new Date().toISOString(),
        });
      }
      console.log(
        `  ✅ Inventory (${SEED_INVENTORY.length} items): ${SEED_INVENTORY.map((i) => i.description).join(", ")}`,
      );
    } else {
      console.log(
        `  ℹ️  Inventory already exists (${existingInv.length} items), skipping.`,
      );
    }

    // ── Subscribers ──────────────────────────────────────────────────────────
    const packages = await db.packages.toArray();
    const areas = (await db.settings.get("areas"))?.value || SEED_AREAS;

    let created = 0,
      failed = 0;
    const BATCH = 50;

    for (let i = 0; i < count; i++) {
      try {
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const scenario = STATUS_POOL[i % STATUS_POOL.length];
        const pkg = pick(packages);
        const area = pick(areas);
        const isArchived = scenario === "archived";
        const isSuspended = scenario === "suspended";

        // Some subscribers get extra historical cycles (2–6) to stress-test multi-cycle UI
        const numHistorical = rand(1, 6);

        const customerId = await db.customers.add({
          fullName: `${firstName} ${lastName}`,
          userName: randomUsername(firstName, lastName, i + 1),
          mobileNo: randomPhone(),
          mainArea: area,
          packageId: pkg.id,
          status: isArchived
            ? "terminated"
            : isSuspended
              ? "suspended"
              : "active",
          isArchived,
          archivedAt: isArchived ? addDays(today(), -rand(50, 100)) : null,
          archiveReason: isArchived
            ? pick([
                "Left area",
                "Relocated",
                "Switched provider",
                "Non-payment",
              ])
            : "",
          lockedPackagePrice: pkg.price,
          createdAt: new Date().toISOString(),
        });

        await buildCycles(customerId, pkg.price, scenario, numHistorical);
        created++;

        if ((i + 1) % BATCH === 0) {
          console.log(`  ⏳ ${i + 1}/${count} subscribers created…`);
        }
      } catch (err) {
        failed++;
        console.warn(`  ⚠️  Failed on subscriber ${i + 1}:`, err.message);
      }
    }

    // Reload all stores
    await reloadAll();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const breakdown = {
      "✅ Clear (paid)": Math.round(count * 0.35),
      "🟡 Pending": Math.round(count * 0.25),
      "🔴 Expired": Math.round(count * 0.15),
      "🔄 Renewal due": Math.round(count * 0.1),
      "⛔ Suspended": Math.round(count * 0.1),
      "📦 Archived": Math.round(count * 0.05),
    };
    console.log(`\n✅ Seeding complete in ${elapsed}s`);
    console.log(`   👥 Subscribers: ${created} created, ${failed} failed`);
    console.log(`   📊 Approximate status breakdown:`);
    Object.entries(breakdown).forEach(([k, v]) =>
      console.log(`      ${k}: ~${v}`),
    );
    console.log(
      `\n   ℹ️  Each subscriber has 2–7 historical cycles (great for stress-testing).`,
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  seedAreas(customList?)
  //  Usage:
  //    seedAreas()
  //    seedAreas(["Block A", "Cantt", "Gulberg"])
  // ════════════════════════════════════════════════════════════════════════════
  window.seedAreas = async (customList) => {
    const list = customList || SEED_AREAS;
    const existing = (await db.settings.get("areas"))?.value || [];
    const merged = [...new Set([...existing, ...list])];
    await db.settings.put({ key: "areas", value: merged });
    await reloadAll();
    console.log(`✅ Areas saved (${merged.length}): ${merged.join(", ")}`);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  seedAgents(customList?)
  //  Usage:
  //    seedAgents()
  //    seedAgents(["Ali Raza", "Hamid Khan"])
  // ════════════════════════════════════════════════════════════════════════════
  window.seedAgents = async (customList) => {
    const list = customList || SEED_AGENTS;
    const existing = (await db.settings.get("agents"))?.value || [];
    const merged = [...new Set([...existing, ...list])];
    await db.settings.put({ key: "agents", value: merged });
    await reloadAll();
    console.log(
      `✅ Recovery Agents saved (${merged.length}): ${merged.join(", ")}`,
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  seedPackages(customList?)
  //  Usage:
  //    seedPackages()
  //    seedPackages([{ name: "Gold 20MB", speedMbps: 20, price: 1800 }])
  // ════════════════════════════════════════════════════════════════════════════
  window.seedPackages = async (customList) => {
    const list = customList || SEED_PACKAGES;
    for (const pkg of list) {
      await db.packages.add({
        ...pkg,
        price: Number(pkg.price),
        speedMbps: Number(pkg.speedMbps) || 0,
        priceHistory: [],
        lastUpdated: null,
        createdAt: new Date().toISOString(),
      });
    }
    await usePackageStore.getState().loadPackages();
    console.log(`✅ Added ${list.length} packages:`);
    console.table(list);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  seedInventory(customList?)
  //  Usage:
  //    seedInventory()
  //    seedInventory([{ description: "Router", unit: "piece", qty: 50, unitRate: 2500 }])
  // ════════════════════════════════════════════════════════════════════════════
  window.seedInventory = async (customList) => {
    const list = customList || SEED_INVENTORY;
    for (const item of list) {
      await db.inventory.add({
        description: item.description,
        unit: item.unit,
        quantity: item.qty,
        unitRate: item.unitRate,
        amount: item.qty * item.unitRate,
        stockIn: item.qty,
        stockOut: 0,
        inHand: item.qty,
        received: item.qty,
        issued: 0,
        balanced: item.qty,
        purchaseDate: today(),
        invoiceNo: null,
        remarks: "Seeded by devTools",
        restockLog: [],
        issueLog: [],
        createdAt: new Date().toISOString(),
      });
    }
    await useInventoryStore.getState().loadInventory();
    console.log(`✅ Added ${list.length} inventory items:`);
    console.table(
      list.map((i) => ({
        Item: i.description,
        Unit: i.unit,
        Qty: i.qty,
        Rate: i.unitRate,
      })),
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  seedSubscribers(count)
  //  Adds more subscribers using already-seeded packages and areas.
  //  Usage:
  //    seedSubscribers(500)
  // ════════════════════════════════════════════════════════════════════════════
  window.seedSubscribers = async (count = 100) => {
    const packages = await db.packages.toArray();
    const areas = (await db.settings.get("areas"))?.value || [];

    if (packages.length === 0)
      return console.error("❌ No packages. Run seedPackages() first.");
    if (areas.length === 0)
      return console.error("❌ No areas. Run seedAreas() first.");

    console.log(`⏳ Adding ${count} subscribers…`);
    let created = 0;

    for (let i = 0; i < count; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const scenario = STATUS_POOL[i % STATUS_POOL.length];
      const pkg = pick(packages);
      const area = pick(areas);
      const isArchived = scenario === "archived";
      const isSuspended = scenario === "suspended";
      const numHistorical = rand(1, 6);

      const customerId = await db.customers.add({
        fullName: `${firstName} ${lastName}`,
        userName: randomUsername(firstName, lastName, Date.now() + i),
        mobileNo: randomPhone(),
        mainArea: area,
        packageId: pkg.id,
        status: isArchived
          ? "terminated"
          : isSuspended
            ? "suspended"
            : "active",
        isArchived,
        archivedAt: isArchived ? addDays(today(), -rand(50, 100)) : null,
        archiveReason: isArchived
          ? pick(["Left area", "Relocated", "Non-payment"])
          : "",
        lockedPackagePrice: pkg.price,
        createdAt: new Date().toISOString(),
      });

      await buildCycles(customerId, pkg.price, scenario, numHistorical);
      created++;
    }

    await useCustomerStore.getState().loadCustomers();
    await usePaymentStore.getState().loadCycles();
    console.log(`✅ Added ${created} subscribers.`);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  generateTestCycles(customerId, packagePrice, numCycles)
  //  Replace a specific customer's cycles with a full alternating paid/unpaid history.
  //  Usage:
  //    generateTestCycles(5, 2500, 10)
  // ════════════════════════════════════════════════════════════════════════════
  window.generateTestCycles = async (
    customerId,
    packagePrice = 2500,
    numCycles = 10,
  ) => {
    if (!customerId)
      return console.error(
        "❌ Provide a customerId. Example: generateTestCycles(5, 2500, 10)",
      );
    try {
      // Wipe existing cycles for this customer
      const allCycles = await db.paymentCycles.toArray();
      for (const c of allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      )) {
        await db.paymentCycles.delete(c.id);
      }

      const ranges = [];
      let end = addDays(today(), CYCLE_LENGTH_DAYS - 10);
      let start = addDays(today(), -10);
      for (let i = 0; i < numCycles; i++) {
        ranges.unshift({ start, end });
        end = addDays(start, -1);
        start = addDays(end, -CYCLE_LENGTH_DAYS);
      }

      let pendingFromPrev = 0;
      for (let i = 0; i < ranges.length; i++) {
        const { start: cs, end: ce } = ranges[i];
        const isNewest = i === ranges.length - 1;
        const isPaid = !isNewest && i % 2 !== 0;
        const totalAmount = packagePrice + pendingFromPrev;
        const prevBal = pendingFromPrev;

        if (isPaid) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: totalAmount,
            amountPending: 0,
            status: "clear",
            shiftedAmount: 0,
            previousBalance: prevBal,
            installments: [makeInstallment(totalAmount, cs, `Cycle ${i + 1}`)],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else if (!isNewest) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: 0,
            amountPending: 0,
            status: "clear",
            shiftedAmount: totalAmount,
            previousBalance: prevBal,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = totalAmount;
        } else {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: 0,
            amountPending: totalAmount,
            status: "pending",
            shiftedAmount: 0,
            previousBalance: prevBal,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
        }
      }

      await usePaymentStore.getState().loadCycles();
      console.log(
        `✅ ${numCycles} alternating cycles created for customer ${customerId}.`,
      );
    } catch (err) {
      console.error("❌", err);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  generateStreakTest(customerId, packagePrice, unpaidStreak, totalCycles)
  //  Creates a streak of consecutive unpaid cycles, then a mega-clearance payment.
  //  Usage:
  //    generateStreakTest(5, 1500, 4, 8)
  //    → 4 unpaid → mega payment → alternating paid/unpaid until newest (pending)
  // ════════════════════════════════════════════════════════════════════════════
  window.generateStreakTest = async (
    customerId,
    packagePrice = 1500,
    unpaidStreak = 4,
    totalCycles = 8,
  ) => {
    if (!customerId) return console.error("❌ Provide a customerId.");
    if (unpaidStreak >= totalCycles)
      return console.error("❌ unpaidStreak must be < totalCycles.");
    try {
      const allCycles = await db.paymentCycles.toArray();
      for (const c of allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      )) {
        await db.paymentCycles.delete(c.id);
      }

      const ranges = [];
      let end = addDays(today(), CYCLE_LENGTH_DAYS - 10);
      let start = addDays(today(), -10);
      for (let i = 0; i < totalCycles; i++) {
        ranges.unshift({ start, end });
        end = addDays(start, -1);
        start = addDays(end, -CYCLE_LENGTH_DAYS);
      }

      let pendingFromPrev = 0;
      for (let i = 0; i < ranges.length; i++) {
        const { start: cs, end: ce } = ranges[i];
        const isNewest = i === ranges.length - 1;
        const totalAmount = packagePrice + pendingFromPrev;
        const prevBal = pendingFromPrev;
        const isInStreak = i < unpaidStreak;
        const isMegaPayment = i === unpaidStreak;
        const isPaidPostStreak = !isNewest && (i - unpaidStreak) % 2 === 1;

        if (isInStreak) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: 0,
            amountPending: 0,
            status: "clear",
            shiftedAmount: totalAmount,
            previousBalance: prevBal,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = totalAmount;
        } else if (isMegaPayment) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: totalAmount,
            amountPending: 0,
            status: "clear",
            shiftedAmount: 0,
            previousBalance: prevBal,
            installments: [
              makeInstallment(
                totalAmount,
                cs,
                `Full clearance — PKR ${totalAmount.toLocaleString()}`,
              ),
            ],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else if (isNewest) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: 0,
            amountPending: totalAmount,
            status: "pending",
            shiftedAmount: 0,
            previousBalance: prevBal,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
        } else if (isPaidPostStreak) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: totalAmount,
            amountPending: 0,
            status: "clear",
            shiftedAmount: 0,
            previousBalance: prevBal,
            installments: [makeInstallment(totalAmount, cs, `Cycle ${i + 1}`)],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cs,
            cycleEndDate: ce,
            totalAmount,
            amountPaid: 0,
            amountPending: 0,
            status: "clear",
            shiftedAmount: totalAmount,
            previousBalance: prevBal,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = totalAmount;
        }
      }

      await usePaymentStore.getState().loadCycles();
      console.log(`✅ Streak test set for customer ${customerId}:`);
      console.log(
        `   ${unpaidStreak} unpaid → mega clearance → alternating → newest pending`,
      );
    } catch (err) {
      console.error("❌", err);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  inspectCustomer(customerId)
  //  Print full cycle history for one subscriber.
  //  Usage:
  //    inspectCustomer(5)
  // ════════════════════════════════════════════════════════════════════════════
  window.inspectCustomer = async (customerId) => {
    if (!customerId) return console.error("❌ Provide a customerId.");
    const customer = await db.customers.get(Number(customerId));
    if (!customer) return console.error(`❌ No customer with id ${customerId}`);
    const allCycles = await db.paymentCycles.toArray();
    const cycles = allCycles
      .filter((c) => Number(c.customerId) === Number(customerId))
      .sort((a, b) => a.cycleStartDate.localeCompare(b.cycleStartDate));

    console.log(
      `\n👤 ${customer.fullName} (@${customer.userName}) — ${customer.status}`,
    );
    console.log(
      `   Package ID: ${customer.packageId} | Area: ${customer.mainArea}`,
    );
    console.log(`   Cycles: ${cycles.length}`);
    console.table(
      cycles.map((c, i) => ({
        "#": i + 1,
        Start: c.cycleStartDate,
        End: c.cycleEndDate,
        Total: c.totalAmount,
        Paid: c.amountPaid,
        Pending: c.amountPending,
        Shifted: c.shiftedAmount,
        PrevBal: c.previousBalance,
        Status: c.status,
        Payments: c.installments?.length || 0,
      })),
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  listCustomers()
  //  Quick table of all subscribers with their IDs.
  // ════════════════════════════════════════════════════════════════════════════
  window.listCustomers = () => {
    const customers = useCustomerStore.getState().customers;
    console.table(
      customers.map((c, i) => ({
        "#": i + 1,
        ID: c.id,
        Name: c.fullName,
        Username: c.userName,
        Area: c.mainArea,
        Status: c.status,
        Archived: c.isArchived ? "Yes" : "No",
      })),
    );
    console.log(`Total: ${customers.length} subscribers (incl. archived)`);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  dbStats()
  //  Print row counts for every table + status breakdown.
  // ════════════════════════════════════════════════════════════════════════════
  window.dbStats = async () => {
    const [customers, cycles, packages, inventory, expenses] =
      await Promise.all([
        db.customers.toArray(),
        db.paymentCycles.toArray(),
        db.packages.toArray(),
        db.inventory.toArray(),
        db.expenses.toArray(),
      ]);
    const areas = (await db.settings.get("areas"))?.value || [];
    const agents = (await db.settings.get("agents"))?.value || [];

    const active = customers.filter(
      (c) => !c.isArchived && c.status === "active",
    );
    const suspended = customers.filter((c) => c.status === "suspended");
    const archived = customers.filter((c) => c.isArchived);

    console.log("📊 Database Stats:");
    console.table({
      "Subscribers (total)": { count: customers.length },
      "  → Active": { count: active.length },
      "  → Suspended": { count: suspended.length },
      "  → Archived": { count: archived.length },
      "Payment Cycles": { count: cycles.length },
      Packages: { count: packages.length },
      "Inventory Items": { count: inventory.length },
      Expenses: { count: expenses.length },
      "Coverage Areas": { count: areas.length },
      "Recovery Agents": { count: agents.length },
    });

    const cyclesByCustomer = {};
    for (const c of cycles) {
      cyclesByCustomer[c.customerId] =
        (cyclesByCustomer[c.customerId] || 0) + 1;
    }
    const counts = Object.values(cyclesByCustomer);
    if (counts.length > 0) {
      const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(
        1,
      );
      const max = Math.max(...counts);
      console.log(`\n   Cycles per subscriber — avg: ${avg}, max: ${max}`);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  clearAllData()    — removes subscribers, payments, inventory, expenses
  //  clearEverything() — also removes packages and areas
  // ════════════════════════════════════════════════════════════════════════════
  window.clearAllData = async () => {
    if (
      !confirm(
        "⚠️ DELETE all subscribers, payments, inventory, and expenses?\n(Packages and areas will be kept.)",
      )
    )
      return;
    await _wipeAllData(false);
    console.log("✨ Data cleared. Packages, areas, and agents kept.");
  };

  window.clearEverything = async () => {
    if (
      !confirm(
        "⚠️ DELETE ABSOLUTELY EVERYTHING including packages, areas, and agents?",
      )
    )
      return;
    await _wipeAllData(true);
    console.log("💥 Everything wiped. Fresh slate.");
  };

  // ── Internal wipe helper ──────────────────────────────────────────────────
  async function _wipeAllData(alsoWipeSettings = false) {
    console.log("🧹 Wiping data…");
    const [customers, cycles, expenses, inventory, packages] =
      await Promise.all([
        db.customers.toArray(),
        db.paymentCycles.toArray(),
        db.expenses.toArray(),
        db.inventory.toArray(),
        db.packages.toArray(),
      ]);

    for (const r of customers) await db.customers.delete(r.id);
    for (const r of cycles) await db.paymentCycles.delete(r.id);
    for (const r of expenses) await db.expenses.delete(r.id);
    for (const r of inventory) await db.inventory.delete(r.id);

    if (alsoWipeSettings) {
      for (const r of packages) await db.packages.delete(r.id);
      await db.settings.put({ key: "areas", value: [] });
      await db.settings.put({ key: "agents", value: [] });
    }

    await reloadAll();
  }

  // ── Help banner ───────────────────────────────────────────────────────────
  console.log(
    "%c🛠️  Galaxy ISP DevTools Ready",
    "font-weight:bold;font-size:14px;color:#4f46e5",
  );
  console.log("");
  console.log(
    "── QUICK START ──────────────────────────────────────────────────────────",
  );
  console.log(
    "  seedAll()              → seed EVERYTHING with 1000 subscribers",
  );
  console.log(
    "  seedAll(200)           → same but only 200 subscribers (faster)",
  );
  console.log("  seedAll(1000, true)    → wipe all data first, then seed 1000");
  console.log("");
  console.log(
    "── SEED INDIVIDUALLY ────────────────────────────────────────────────────",
  );
  console.log("  seedAreas()            → add 6 coverage areas to Settings");
  console.log("  seedAgents()           → add 6 recovery agents to Settings");
  console.log("  seedPackages()         → add 5 packages (Starter → Ultra)");
  console.log("  seedInventory()        → add 7 inventory items");
  console.log(
    "  seedSubscribers(500)   → add 500 more subscribers (needs packages+areas)",
  );
  console.log("");
  console.log(
    "── STATUS MIX (per 100 subscribers) ────────────────────────────────────",
  );
  console.log(
    "  ✅ Clear (paid)    ~35   🟡 Pending     ~25   🔴 Expired    ~15",
  );
  console.log(
    "  🔄 Renewal due     ~10   ⛔ Suspended   ~10   📦 Archived   ~5",
  );
  console.log("");
  console.log(
    "── INSPECT ──────────────────────────────────────────────────────────────",
  );
  console.log("  dbStats()              → count every table + cycle stats");
  console.log("  listCustomers()        → table of all subscriber IDs/names");
  console.log(
    "  inspectCustomer(id)    → full cycle history for one subscriber",
  );
  console.log("");
  console.log(
    "── CYCLE TOOLS ──────────────────────────────────────────────────────────",
  );
  console.log(
    "  generateTestCycles(id, price, count)         → alternating paid/unpaid",
  );
  console.log(
    "  generateStreakTest(id, price, streak, total) → streak + mega clearance",
  );
  console.log("");
  console.log(
    "── CLEAR DATA ───────────────────────────────────────────────────────────",
  );
  console.log(
    "  clearAllData()         → delete subscribers, payments, inventory",
  );
  console.log(
    "  clearEverything()      → delete EVERYTHING (incl. packages, areas)",
  );
};
