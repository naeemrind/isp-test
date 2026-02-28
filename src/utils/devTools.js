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
  window.generateTestCycles = async (
    customerId,
    packagePrice = 2500,
    numCycles = 10,
  ) => {
    if (!customerId) return console.error("❌ Please provide a customerId.");
    try {
      const allCycles = await db.paymentCycles.toArray();
      const customerCycles = allCycles.filter(
        (c) => Number(c.customerId) === Number(customerId),
      );
      for (const c of customerCycles) await db.paymentCycles.delete(c.id);

      // Start 10 days ago, each cycle is exactly 30 days inclusive (offset = 29)
      let currentStart = addDays(today(), -10);
      let currentEnd = addDays(currentStart, CYCLE_LENGTH_DAYS);

      for (let i = 0; i < numCycles; i++) {
        const isCurrent = i === 0;
        await db.paymentCycles.add({
          customerId: Number(customerId),
          cycleStartDate: currentStart,
          cycleEndDate: currentEnd,
          totalAmount: packagePrice,
          amountPaid: isCurrent ? 0 : packagePrice,
          amountPending: isCurrent ? packagePrice : 0,
          status: isCurrent ? "pending" : "clear",
          installments: isCurrent
            ? []
            : [
                {
                  id: crypto.randomUUID(),
                  amountPaid: packagePrice,
                  datePaid: currentStart,
                  note: `Auto-payment (Test Data - Month ${i})`,
                  createdAt: new Date().toISOString(),
                },
              ],
          isRenewal: i > 0,
          createdAt: new Date().toISOString(),
        });
        // Walk backwards: previous cycle ends the day before this one starts
        currentEnd = addDays(currentStart, -1);
        currentStart = addDays(currentEnd, -CYCLE_LENGTH_DAYS);
      }
      await usePaymentStore.getState().loadCycles();
      console.log(
        `✅ Added ${numCycles} historical cycles for customer ID: ${customerId}`,
      );
    } catch (error) {
      console.error("❌ Failed:", error);
    }
  };

  // 3. Generate Bulk Dummy Data
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
        // startDate is exactly 30 days inclusive before endDate
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
  console.log("👉 window.generateNeedsAttentionData(15) -> Add Dummy Data");
  console.log("👉 window.clearAllData() -> DELETE ALL DATA");
};
