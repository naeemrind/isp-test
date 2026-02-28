// src/utils/devTools.js
import db from "../db/database";
import usePaymentStore from "../store/usePaymentStore";
import useCustomerStore from "../store/useCustomerStore";
import useExpenseStore from "../store/useExpenseStore";
import useInventoryStore from "../store/useInventoryStore";
import { addDays, today, CYCLE_LENGTH_DAYS } from "./dateUtils";

export const setupDevTools = () => {
  // 1. List Customers
  window.listCustomers = () => {
    const customers = useCustomerStore.getState().customers;
    console.table(
      customers.map((c) => ({
        ID: c.id,
        Name: c.fullName,
        Username: c.userName,
        Status: c.status,
      })),
    );
  };

  // 2. Generate History for ONE customer
  //    Every even index (0, 2, 4...) = unpaid → carried forward
  //    Every odd index  (1, 3, 5...) = fully paid
  //    Unpaid cycles set shiftedAmount on themselves and previousBalance on
  //    the following cycle — identical to what renewCycle() does in production.
  window.generateTestCycles = async (
    customerId,
    packagePrice = 2500,
    numCycles = 10,
  ) => {
    if (!customerId) return console.error("❌ Please provide a customerId.");
    try {
      // ── 1. Wipe existing cycles for this customer ──────────────────────────
      const allCycles = await db.paymentCycles.toArray();
      const customerCycles = allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      );
      for (const c of customerCycles) await db.paymentCycles.delete(c.id);

      // ── 2. Build date ranges oldest → newest ──────────────────────────────
      // Newest cycle (i=0) starts 10 days ago. Walk backwards from there.
      const ranges = [];
      let end = addDays(addDays(today(), -10), CYCLE_LENGTH_DAYS);
      let start = addDays(today(), -10);
      for (let i = 0; i < numCycles; i++) {
        ranges.unshift({ start, end }); // prepend so index 0 = oldest
        end = addDays(start, -1);
        start = addDays(end, -CYCLE_LENGTH_DAYS);
      }
      // ranges[0] = oldest cycle, ranges[numCycles-1] = newest (current) cycle

      // ── 3. Insert cycles oldest → newest so carry-forward links are correct ─
      // "pendingFromPrev" carries unpaid amount into the next cycle's totalAmount
      let pendingFromPrev = 0;

      for (let i = 0; i < ranges.length; i++) {
        const { start: cycleStart, end: cycleEnd } = ranges[i];
        const isNewest = i === ranges.length - 1;
        // Alternate: even index = unpaid, odd index = paid
        // The newest cycle is always left as-is (pending, no shiftedAmount yet)
        const isPaid = isNewest ? false : i % 2 !== 0;

        const totalAmount = packagePrice + pendingFromPrev;
        const previousBalance = pendingFromPrev;

        if (isPaid) {
          // Fully paid cycle — normal clear cycle
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
                note: `Payment (Test Data - cycle ${i + 1})`,
                createdAt: new Date().toISOString(),
              },
            ],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0; // debt cleared, nothing to carry forward
        } else if (!isNewest) {
          // Unpaid historical cycle — debt carried forward to next cycle
          await db.paymentCycles.add({
            customerId: Number(customerId),
            cycleStartDate: cycleStart,
            cycleEndDate: cycleEnd,
            totalAmount,
            amountPaid: 0,
            amountPending: 0, // cleared by system (shifted, not paid)
            status: "clear",
            shiftedAmount: totalAmount, // ← what makes it show "Carried Forward"
            previousBalance,
            installments: [],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = totalAmount; // full amount moves to next cycle
        } else {
          // Newest (current) cycle — always pending
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
      console.log(
        `✅ Added ${numCycles} realistic cycles for customer ID: ${customerId}`,
      );
      console.log(`   Even cycles (1,3,5…) = Paid ✅`);
      console.log(`   Odd cycles  (2,4,6…) = Carried Forward ↪️`);
      console.log(`   Newest cycle         = Pending 🔴`);
    } catch (error) {
      console.error("❌ Failed:", error);
    }
  };

  // 3. Consecutive unpaid streak then one big clearance payment
  //    Usage: generateStreakTest(customerId, packagePrice, unpaidStreak, totalCycles)
  //    Example: generateStreakTest(3, 1500, 4, 8)
  //    → cycles 1-4 unpaid (carried forward), cycle 5 pays ALL accumulated dues,
  //      cycles 6+ back to normal alternating paid/unpaid
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
      // Wipe existing cycles for this customer
      const allCycles = await db.paymentCycles.toArray();
      for (const c of allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      ))
        await db.paymentCycles.delete(c.id);

      // Build date ranges oldest → newest
      const ranges = [];
      let end = addDays(addDays(today(), -10), CYCLE_LENGTH_DAYS);
      let start = addDays(today(), -10);
      for (let i = 0; i < totalCycles; i++) {
        ranges.unshift({ start, end });
        end = addDays(start, -1);
        start = addDays(end, -CYCLE_LENGTH_DAYS);
      }

      // Pattern (oldest = index 0):
      // 0 .. unpaidStreak-1  → unpaid (carried forward)
      // unpaidStreak         → MEGA PAYMENT clears all accumulated debt
      // unpaidStreak+1 ..    → alternating paid/unpaid (normal)
      // last (newest)        → always pending
      let pendingFromPrev = 0;

      for (let i = 0; i < ranges.length; i++) {
        const { start: cycleStart, end: cycleEnd } = ranges[i];
        const isNewest = i === ranges.length - 1;
        const totalAmount = packagePrice + pendingFromPrev;
        const previousBalance = pendingFromPrev;

        const isInStreak = i < unpaidStreak;
        const isMegaPayment = i === unpaidStreak;
        const isPaidAfterStreak = !isNewest && (i - unpaidStreak) % 2 === 1;

        if (isInStreak) {
          // Unpaid — debt carried forward to next cycle
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
        } else if (isMegaPayment) {
          // Customer pays everything at once — clears all accumulated dues
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
                note: `Full clearance — PKR ${totalAmount.toLocaleString()} (${unpaidStreak} cycles cleared at once)`,
                createdAt: new Date().toISOString(),
              },
            ],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else if (isNewest) {
          // Current cycle — always pending
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
        } else if (isPaidAfterStreak) {
          // Normal paid cycle after the streak
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
                note: `Payment (Test Data - cycle ${i + 1})`,
                createdAt: new Date().toISOString(),
              },
            ],
            isRenewal: i > 0,
            createdAt: new Date().toISOString(),
          });
          pendingFromPrev = 0;
        } else {
          // Normal unpaid cycle after the streak (also carried forward)
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
        }
      }

      await usePaymentStore.getState().loadCycles();
      console.log(`✅ Streak test generated for customer ID: ${customerId}`);
      console.log(`   Cycles 1–${unpaidStreak}   → ↪️  Carried Forward`);
      console.log(
        `   Cycle  ${unpaidStreak + 1}       → 💰 MEGA PAYMENT (all dues cleared at once)`,
      );
      console.log(
        `   Cycles ${unpaidStreak + 2}+      → alternating paid / carried forward`,
      );
      console.log(`   Newest cycle    → 🔴 Pending`);
    } catch (error) {
      console.error("❌ Failed:", error);
    }
  };

  // 4. Generate Bulk Dummy Data
  window.generateNeedsAttentionData = async (count = 15) => {
    console.log(`⏳ Generating ${count} dummy customers...`);
    try {
      for (let i = 1; i <= count; i++) {
        const customerId = await db.customers.add({
          fullName: `Urgent Tester ${i}`,
          userName: `urg_${Date.now()}_${i}`,
          mobileNo: `0300${String(i).padStart(7, "0")}`,
          mainArea: "Test Area",
          packageId: null,
          status: "active",
          createdAt: new Date().toISOString(),
        });

        const daysLeft = Math.floor(Math.random() * 10) - 5;
        const endDate = addDays(today(), daysLeft);
        const startDate = addDays(endDate, -CYCLE_LENGTH_DAYS);
        const isPaid = Math.random() > 0.5;
        const packagePrice = 2000 + Math.floor(Math.random() * 3) * 500;

        await db.paymentCycles.add({
          customerId: Number(customerId),
          cycleStartDate: startDate,
          cycleEndDate: endDate,
          totalAmount: packagePrice,
          amountPaid: isPaid ? packagePrice : 0,
          amountPending: isPaid ? 0 : packagePrice,
          status: isPaid ? "clear" : "pending",
          installments: isPaid
            ? [
                {
                  id: crypto.randomUUID(),
                  amountPaid: packagePrice,
                  datePaid: startDate,
                  note: "Paid dummy",
                  createdAt: new Date().toISOString(),
                },
              ]
            : [],
          isRenewal: false,
          createdAt: new Date().toISOString(),
        });
      }
      await useCustomerStore.getState().loadCustomers();
      await usePaymentStore.getState().loadCycles();
      console.log(`✅ Success! Generated ${count} customers.`);
    } catch (error) {
      console.error("❌ Failed:", error);
    }
  };

  // 4. Clear All Data
  window.clearAllData = async () => {
    if (
      !confirm(
        "⚠️ ARE YOU SURE? This will delete ALL customers, payments, inventory, and expenses. Settings (Packages/Areas) will be kept.",
      )
    )
      return;

    console.log("🧹 Wiping database...");

    try {
      const customers = await db.customers.toArray();
      const cycles = await db.paymentCycles.toArray();
      const expenses = await db.expenses.toArray();
      const inventory = await db.inventory.toArray();

      for (const c of customers) await db.customers.delete(c.id);
      for (const c of cycles) await db.paymentCycles.delete(c.id);
      for (const e of expenses) await db.expenses.delete(e.id);
      for (const i of inventory) await db.inventory.delete(i.id);

      await Promise.all([
        useCustomerStore.getState().loadCustomers(),
        usePaymentStore.getState().loadCycles(),
        useExpenseStore.getState().loadExpenses(),
        useInventoryStore.getState().loadInventory(),
      ]);

      console.log("✨ All data cleared. App is fresh.");
    } catch (err) {
      console.error("Error clearing data:", err);
    }
  };

  console.log("🛠️ DevTools Ready:");
  console.log("👉 listCustomers() -> See all customer IDs");
  console.log(
    "👉 generateTestCycles(id, price, count) -> Realistic mixed history",
  );
  console.log(
    "👉 generateStreakTest(id, price, streak, total) -> e.g. generateStreakTest(3, 1500, 4, 10)",
  );
  console.log("👉 generateNeedsAttentionData(15) -> Add Dummy Customers");
  console.log("👉 clearAllData() -> DELETE ALL DATA");
};
