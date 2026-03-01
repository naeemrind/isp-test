// src/utils/devTools.js
import db from "../db/database";
import usePaymentStore from "../store/usePaymentStore";
import useCustomerStore from "../store/useCustomerStore";
import useExpenseStore from "../store/useExpenseStore";
import useInventoryStore from "../store/useInventoryStore";
import usePackageStore from "../store/usePackageStore";
import useConnectionJobStore from "../store/useConnectionJobStore";
import { addDays, today, CYCLE_LENGTH_DAYS } from "./dateUtils";

// ─── Seed Data Definitions ────────────────────────────────────────────────────

const SEED_AREAS = [
  "City Center",
  "North Town",
  "South Block",
  "Garden Colony",
  "Model Town",
  "DHA Phase 1",
];

const SEED_PACKAGES = [
  { name: "Basic 5 MB", speedMbps: 5, price: 800 },
  { name: "Standard 10 MB", speedMbps: 10, price: 1500 },
  { name: "Fast 25 MB", speedMbps: 25, price: 2200 },
  { name: "Ultra 50 MB", speedMbps: 50, price: 3200 },
  { name: "Pro 100 MB", speedMbps: 100, price: 4500 },
];

const SEED_INVENTORY = [
  { description: "ONU", unit: "piece", qty: 200, unitRate: 850 },
  { description: "Fiber Cable", unit: "meter", qty: 5000, unitRate: 18 },
  { description: "Ethernet Cable", unit: "meter", qty: 3000, unitRate: 12 },
  { description: "Splitter 1:8", unit: "piece", qty: 100, unitRate: 350 },
  { description: "Wall Socket", unit: "piece", qty: 300, unitRate: 120 },
  { description: "Cable Tie", unit: "piece", qty: 1000, unitRate: 5 },
];

// Pakistani-sounding first and last names for realistic data
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
];

// Payment status distribution weights for 500 subscribers:
// active-paid 40%, active-pending 30%, active-expired 10%,
// suspended 10%, archived 10%
const STATUS_POOL = [
  ...Array(40).fill("active_paid"),
  ...Array(30).fill("active_pending"),
  ...Array(10).fill("active_expired"),
  ...Array(10).fill("suspended"),
  ...Array(10).fill("archived"),
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
  return pick(prefixes) + String(Math.floor(Math.random() * 9000000) + 1000000);
}

function randomUsername(firstName, lastName, idx) {
  const base = (firstName.toLowerCase() + lastName.toLowerCase()).replace(
    /\s/g,
    "",
  );
  return base + idx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function buildCyclesForCustomer(customerId, packagePrice, statusType) {
  // All subscribers get 3 historical cycles + 1 current cycle
  const numCycles = 4;
  const ranges = [];
  let end = addDays(addDays(today(), -5), CYCLE_LENGTH_DAYS);
  let start = addDays(today(), -5);
  for (let i = 0; i < numCycles; i++) {
    ranges.unshift({ start, end });
    end = addDays(start, -1);
    start = addDays(end, -CYCLE_LENGTH_DAYS);
  }

  // First 3 historical cycles — always alternating paid / carried-forward
  let pendingFromPrev = 0;
  for (let i = 0; i < numCycles - 1; i++) {
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
        installments: [
          {
            id: crypto.randomUUID(),
            amountPaid: totalAmount,
            datePaid: s,
            note: "Seed: paid",
            createdAt: new Date().toISOString(),
          },
        ],
        isRenewal: i > 0,
        createdAt: new Date().toISOString(),
      });
      pendingFromPrev = 0;
    } else {
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

  // Current (newest) cycle — shape depends on statusType
  const { start: cs, end: ce } = ranges[numCycles - 1];
  const totalAmount = packagePrice + pendingFromPrev;
  const previousBalance = pendingFromPrev;

  if (statusType === "active_paid") {
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
      installments: [
        {
          id: crypto.randomUUID(),
          amountPaid: totalAmount,
          datePaid: cs,
          note: "Seed: paid",
          createdAt: new Date().toISOString(),
        },
      ],
      isRenewal: true,
      createdAt: new Date().toISOString(),
    });
  } else if (statusType === "active_pending") {
    await db.paymentCycles.add({
      customerId: Number(customerId),
      cycleStartDate: cs,
      cycleEndDate: ce,
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
  } else if (statusType === "active_expired") {
    // Expired: cycle ended 10 days ago, still unpaid
    const expiredEnd = addDays(today(), -10);
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
  } else if (statusType === "suspended") {
    // Partially paid, still owes balance
    const partial = Math.floor(totalAmount * 0.4);
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
        {
          id: crypto.randomUUID(),
          amountPaid: partial,
          datePaid: cs,
          note: "Seed: partial",
          createdAt: new Date().toISOString(),
        },
      ],
      isRenewal: true,
      createdAt: new Date().toISOString(),
    });
  } else if (statusType === "archived") {
    // Archived subscribers get no current cycle — their last cycle is old
    const oldEnd = addDays(today(), -60);
    const oldStart = addDays(oldEnd, -CYCLE_LENGTH_DAYS);
    await db.paymentCycles.add({
      customerId: Number(customerId),
      cycleStartDate: oldStart,
      cycleEndDate: oldEnd,
      totalAmount: packagePrice,
      amountPaid: packagePrice,
      amountPending: 0,
      status: "clear",
      shiftedAmount: 0,
      previousBalance: 0,
      installments: [
        {
          id: crypto.randomUUID(),
          amountPaid: packagePrice,
          datePaid: oldStart,
          note: "Seed: paid",
          createdAt: new Date().toISOString(),
        },
      ],
      isRenewal: true,
      createdAt: new Date().toISOString(),
    });
  }
}

// ─── Main DevTools Setup ───────────────────────────────────────────────────────

export const setupDevTools = () => {
  // ── 1. Seed Everything ──────────────────────────────────────────────────────
  /**
   * Seeds areas, packages, inventory, and N subscribers with mixed statuses.
   * Usage: seedAll()         → 500 subscribers
   *        seedAll(50)       → 50 subscribers (quick test)
   *        seedAll(500, true) → also wipes existing data first
   */
  window.seedAll = async (count = 500, wipeFirst = false) => {
    if (wipeFirst) {
      const ok = confirm(
        `⚠️ This will DELETE all existing data and seed ${count} subscribers. Continue?`,
      );
      if (!ok) return;
      await _wipeAllData();
    }

    console.log(
      `⏳ Seeding ${count} subscribers + packages + areas + inventory...`,
    );
    const t0 = Date.now();

    // ── Step 1: Areas ──────────────────────────────────────────────────────
    const existingAreas = (await db.settings.get("areas"))?.value || [];
    const mergedAreas = [...new Set([...existingAreas, ...SEED_AREAS])];
    await db.settings.put({ key: "areas", value: mergedAreas });
    console.log(`  ✅ Areas: ${mergedAreas.join(", ")}`);

    // ── Step 2: Packages ──────────────────────────────────────────────────
    let existingPackages = await db.packages.toArray();
    if (existingPackages.length === 0) {
      for (const pkg of SEED_PACKAGES) {
        await db.packages.add({
          ...pkg,
          priceHistory: [],
          lastUpdated: null,
          createdAt: new Date().toISOString(),
        });
      }
      existingPackages = await db.packages.toArray();
      console.log(
        `  ✅ Packages: ${existingPackages.map((p) => p.name).join(", ")}`,
      );
    } else {
      console.log(
        `  ℹ️  Packages already exist (${existingPackages.length}), skipping.`,
      );
    }

    // ── Step 3: Inventory ─────────────────────────────────────────────────
    let existingInventory = await db.inventory.toArray();
    if (existingInventory.length === 0) {
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
        `  ✅ Inventory: ${SEED_INVENTORY.map((i) => i.description).join(", ")}`,
      );
    } else {
      console.log(
        `  ℹ️  Inventory already exists (${existingInventory.length} items), skipping.`,
      );
    }

    // ── Step 4: Subscribers ───────────────────────────────────────────────
    const packages = await db.packages.toArray();
    const areas = (await db.settings.get("areas"))?.value || SEED_AREAS;

    let created = 0,
      failed = 0;
    const batchSize = 50;

    for (let i = 0; i < count; i++) {
      try {
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const statusType = STATUS_POOL[i % STATUS_POOL.length];
        const pkg = pick(packages);
        const area = pick(areas);
        const isArchived = statusType === "archived";

        const customerId = await db.customers.add({
          fullName: `${firstName} ${lastName}`,
          userName: randomUsername(firstName, lastName, i + 1),
          mobileNo: randomPhone(),
          mainArea: area,
          packageId: pkg.id,
          status: isArchived ? "terminated" : "active",
          isArchived: isArchived,
          archivedAt: isArchived ? addDays(today(), -50) : null,
          archiveReason: isArchived ? "Left area" : "",
          lockedPackagePrice: pkg.price,
          createdAt: new Date().toISOString(),
        });

        await buildCyclesForCustomer(customerId, pkg.price, statusType);
        created++;

        // Progress log every batch
        if ((i + 1) % batchSize === 0) {
          console.log(`  ⏳ ${i + 1}/${count} subscribers created...`);
        }
      } catch (err) {
        failed++;
        console.warn(`  ⚠️  Failed on subscriber ${i + 1}:`, err.message);
      }
    }

    // ── Step 5: Reload stores ─────────────────────────────────────────────
    await reloadAll();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ Seeding complete in ${elapsed}s`);
    console.log(`   👥 Subscribers: ${created} created, ${failed} failed`);
    console.log(`   📦 Status breakdown (~):`);
    console.log(`      Paid (active):     ${Math.round(count * 0.4)}`);
    console.log(`      Pending (active):  ${Math.round(count * 0.3)}`);
    console.log(`      Expired:           ${Math.round(count * 0.1)}`);
    console.log(`      Suspended:         ${Math.round(count * 0.1)}`);
    console.log(`      Archived:          ${Math.round(count * 0.1)}`);
  };

  // ── 2. Seed only Areas ──────────────────────────────────────────────────────
  /**
   * Usage: seedAreas()
   *        seedAreas(["Block A", "Block B", "Cantt"])  → custom list
   */
  window.seedAreas = async (customAreas) => {
    const list = customAreas || SEED_AREAS;
    const existing = (await db.settings.get("areas"))?.value || [];
    const merged = [...new Set([...existing, ...list])];
    await db.settings.put({ key: "areas", value: merged });
    await reloadAll();
    console.log(`✅ Areas saved: ${merged.join(", ")}`);
  };

  // ── 3. Seed only Packages ───────────────────────────────────────────────────
  /**
   * Usage: seedPackages()
   *        seedPackages([{ name: "Gold 20MB", speedMbps: 20, price: 1800 }])
   */
  window.seedPackages = async (customPackages) => {
    const list = customPackages || SEED_PACKAGES;
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
    console.log(`✅ Added ${list.length} packages.`);
    console.table(list);
  };

  // ── 4. Seed only Inventory ──────────────────────────────────────────────────
  /**
   * Usage: seedInventory()
   *        seedInventory([{ description: "Router", unit: "piece", qty: 50, unitRate: 2500 }])
   */
  window.seedInventory = async (customItems) => {
    const list = customItems || SEED_INVENTORY;
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
    console.log(`✅ Added ${list.length} inventory items.`);
    console.table(list);
  };

  // ── 5. Seed only Subscribers ────────────────────────────────────────────────
  /**
   * Adds N subscribers using existing packages and areas.
   * Usage: seedSubscribers(100)
   */
  window.seedSubscribers = async (count = 100) => {
    const packages = await db.packages.toArray();
    const areas = (await db.settings.get("areas"))?.value || [];

    if (packages.length === 0) {
      return console.error("❌ No packages found. Run seedPackages() first.");
    }
    if (areas.length === 0) {
      return console.error("❌ No areas found. Run seedAreas() first.");
    }

    console.log(`⏳ Adding ${count} subscribers...`);
    let created = 0;

    for (let i = 0; i < count; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const statusType = STATUS_POOL[i % STATUS_POOL.length];
      const pkg = pick(packages);
      const area = pick(areas);
      const isArchived = statusType === "archived";

      const customerId = await db.customers.add({
        fullName: `${firstName} ${lastName}`,
        userName: randomUsername(firstName, lastName, Date.now() + i),
        mobileNo: randomPhone(),
        mainArea: area,
        packageId: pkg.id,
        status: isArchived ? "terminated" : "active",
        isArchived: isArchived,
        archivedAt: isArchived ? addDays(today(), -50) : null,
        archiveReason: isArchived ? "Left area" : "",
        lockedPackagePrice: pkg.price,
        createdAt: new Date().toISOString(),
      });

      await buildCyclesForCustomer(customerId, pkg.price, statusType);
      created++;
    }

    await useCustomerStore.getState().loadCustomers();
    await usePaymentStore.getState().loadCycles();
    console.log(`✅ Added ${created} subscribers.`);
  };

  // ── 6. Legacy: generateTestCycles (kept for backward compatibility) ─────────
  window.generateTestCycles = async (
    customerId,
    packagePrice = 2500,
    numCycles = 10,
  ) => {
    if (!customerId) return console.error("❌ Please provide a customerId.");
    try {
      const allCycles = await db.paymentCycles.toArray();
      for (const c of allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      ))
        await db.paymentCycles.delete(c.id);

      const ranges = [];
      let end = addDays(addDays(today(), -10), CYCLE_LENGTH_DAYS);
      let start = addDays(today(), -10);
      for (let i = 0; i < numCycles; i++) {
        ranges.unshift({ start, end });
        end = addDays(start, -1);
        start = addDays(end, -CYCLE_LENGTH_DAYS);
      }

      let pendingFromPrev = 0;
      for (let i = 0; i < ranges.length; i++) {
        const { start: cycleStart, end: cycleEnd } = ranges[i];
        const isNewest = i === ranges.length - 1;
        const isPaid = isNewest ? false : i % 2 !== 0;
        const totalAmount = packagePrice + pendingFromPrev;
        const previousBalance = pendingFromPrev;

        if (isPaid) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cycleStart,
            cycleEndDate: cycleEnd,
            totalAmount,
            amountPaid: totalAmount,
            amountPending: 0,
            status: "clear",
            shiftedAmount: 0,
            previousBalance,
            installments: [
              {
                id: crypto.randomUUID(),
                amountPaid: totalAmount,
                datePaid: cycleStart,
                note: `Payment (cycle ${i + 1})`,
                createdAt: new Date().toISOString(),
              },
            ],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else if (!isNewest) {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cycleStart,
            cycleEndDate: cycleEnd,
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
        } else {
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cycleStart,
            cycleEndDate: cycleEnd,
            totalAmount,
            amountPaid: 0,
            amountPending: totalAmount,
            status: "pending",
            shiftedAmount: 0,
            previousBalance,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
        }
      }
      await usePaymentStore.getState().loadCycles();
      console.log(`✅ ${numCycles} cycles for customer ${customerId}`);
    } catch (err) {
      console.error("❌", err);
    }
  };

  // ── 7. Legacy: generateStreakTest ───────────────────────────────────────────
  window.generateStreakTest = async (
    customerId,
    packagePrice = 1500,
    unpaidStreak = 4,
    totalCycles = 8,
  ) => {
    if (!customerId) return console.error("❌ Please provide a customerId.");
    if (unpaidStreak >= totalCycles)
      return console.error("❌ unpaidStreak must be less than totalCycles.");
    try {
      const allCycles = await db.paymentCycles.toArray();
      for (const c of allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      ))
        await db.paymentCycles.delete(c.id);

      const ranges = [];
      let end = addDays(addDays(today(), -10), CYCLE_LENGTH_DAYS);
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
        const previousBalance = pendingFromPrev;
        const isInStreak = i < unpaidStreak;
        const isMegaPayment = i === unpaidStreak;
        const isPaidAfterStreak = !isNewest && (i - unpaidStreak) % 2 === 1;

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
            previousBalance,
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
            previousBalance,
            installments: [
              {
                id: crypto.randomUUID(),
                amountPaid: totalAmount,
                datePaid: cs,
                note: `Full clearance — PKR ${totalAmount.toLocaleString()}`,
                createdAt: new Date().toISOString(),
              },
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
            previousBalance,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
        } else if (isPaidAfterStreak) {
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
            installments: [
              {
                id: crypto.randomUUID(),
                amountPaid: totalAmount,
                datePaid: cs,
                note: `Payment (cycle ${i + 1})`,
                createdAt: new Date().toISOString(),
              },
            ],
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
            previousBalance,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = totalAmount;
        }
      }
      await usePaymentStore.getState().loadCycles();
      console.log(
        `✅ Streak test for customer ${customerId}: ${unpaidStreak} unpaid → mega payment → alternating`,
      );
    } catch (err) {
      console.error("❌", err);
    }
  };

  // ── 8. Inspect ──────────────────────────────────────────────────────────────
  window.listCustomers = () => {
    const customers = useCustomerStore.getState().customers;
    console.table(
      customers.map((c, i) => ({
        "#": i + 1,
        ID: c.id,
        Name: c.fullName,
        Username: c.userName,
        Area: c.mainArea,
        Archived: c.isArchived ? "Yes" : "No",
      })),
    );
    console.log(`Total: ${customers.length} (including archived)`);
  };

  window.dbStats = async () => {
    const customers = await db.customers.toArray();
    const cycles = await db.paymentCycles.toArray();
    const packages = await db.packages.toArray();
    const inventory = await db.inventory.toArray();
    const expenses = await db.expenses.toArray();
    const areas = (await db.settings.get("areas"))?.value || [];
    const jobs =
      JSON.parse(localStorage.getItem("isp_db") || "{}").connectionJobs || [];

    console.log("📊 Database Stats:");
    console.table({
      Subscribers: {
        count: customers.length,
        archived: customers.filter((c) => c.isArchived).length,
      },
      PaymentCycles: { count: cycles.length },
      Packages: { count: packages.length },
      InventoryItems: { count: inventory.length },
      Expenses: { count: expenses.length },
      ConnectionJobs: { count: jobs.length },
      CoverageAreas: { count: areas.length },
    });
  };

  // ── 9. Clear All Data ────────────────────────────────────────────────────────
  window.clearAllData = async () => {
    if (
      !confirm(
        "⚠️ DELETE ALL customers, payments, inventory, expenses, and jobs? Packages & areas will be kept.",
      )
    )
      return;
    await _wipeAllData();
    console.log("✨ All data cleared. Packages and areas kept.");
  };

  window.clearEverything = async () => {
    if (
      !confirm("⚠️ DELETE ABSOLUTELY EVERYTHING including packages and areas?")
    )
      return;
    await _wipeAllData();
    // Also wipe packages and areas
    const pkgs = await db.packages.toArray();
    for (const p of pkgs) await db.packages.delete(p.id);
    await db.settings.put({ key: "areas", value: [] });
    await reloadAll();
    console.log("💥 Everything wiped. Fresh slate.");
  };

  // ── Internal wipe helper ────────────────────────────────────────────────────
  async function _wipeAllData() {
    console.log("🧹 Wiping data...");
    const [customers, cycles, expenses, inventory] = await Promise.all([
      db.customers.toArray(),
      db.paymentCycles.toArray(),
      db.expenses.toArray(),
      db.inventory.toArray(),
    ]);
    for (const c of customers) await db.customers.delete(c.id);
    for (const c of cycles) await db.paymentCycles.delete(c.id);
    for (const e of expenses) await db.expenses.delete(e.id);
    for (const i of inventory) await db.inventory.delete(i.id);

    // Wipe connection jobs from localStorage
    try {
      const raw = localStorage.getItem("isp_db");
      const data = raw ? JSON.parse(raw) : {};
      data.connectionJobs = [];
      localStorage.setItem("isp_db", JSON.stringify(data));
    } catch (_) {
      console.log("haha", _);
    }

    await reloadAll();
  }

  // ── Help ────────────────────────────────────────────────────────────────────
  console.log("🛠️  DevTools Ready — available commands:");
  console.log("");
  console.log(
    "── QUICK START ────────────────────────────────────────────────",
  );
  console.log(
    "  seedAll()              → seed everything: areas + packages + inventory + 500 subscribers",
  );
  console.log(
    "  seedAll(50)            → same but only 50 subscribers (faster for quick checks)",
  );
  console.log(
    "  seedAll(500, true)     → wipe first, then seed 500 subscribers",
  );
  console.log("");
  console.log(
    "── SEED INDIVIDUALLY ──────────────────────────────────────────",
  );
  console.log("  seedAreas()            → add 6 coverage areas");
  console.log("  seedAreas(['A','B'])   → add custom areas");
  console.log("  seedPackages()         → add 5 packages (Basic → Pro)");
  console.log("  seedInventory()        → add 6 inventory items");
  console.log(
    "  seedSubscribers(100)   → add 100 subscribers (needs packages+areas first)",
  );
  console.log("");
  console.log(
    "── INSPECT ────────────────────────────────────────────────────",
  );
  console.log("  dbStats()              → count of every table");
  console.log(
    "  listCustomers()        → table of all subscriber IDs and names",
  );
  console.log("");
  console.log(
    "── CYCLE TOOLS ────────────────────────────────────────────────",
  );
  console.log(
    "  generateTestCycles(id, price, count)        → mixed paid/unpaid history",
  );
  console.log(
    "  generateStreakTest(id, price, streak, total) → streak of unpaid then mega payment",
  );
  console.log("");
  console.log(
    "── CLEAR DATA ─────────────────────────────────────────────────",
  );
  console.log(
    "  clearAllData()         → delete subscribers, payments, inventory, expenses",
  );
  console.log(
    "  clearEverything()      → delete EVERYTHING including packages and areas",
  );
};
