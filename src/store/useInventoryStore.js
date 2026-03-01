import { create } from "zustand";
import db from "../db/database";

const useInventoryStore = create((set) => ({
  items: [],

  loadInventory: async () => {
    const items = await db.inventory.toArray();
    // Migrate legacy field names (received → stockIn, issued → stockOut, balanced → inHand)
    const migrated = items.map((item) => ({
      ...item,
      stockIn: item.stockIn ?? item.received ?? 0,
      stockOut: item.stockOut ?? item.issued ?? 0,
      inHand: item.inHand ?? item.balanced ?? 0,
    }));
    set({ items: migrated });
  },

  addItem: async (data) => {
    const stockIn = Number(data.stockIn) || 0;
    const stockOut = Number(data.stockOut) || 0;
    const inHand = stockIn - stockOut;
    const amount = (Number(data.quantity) || 0) * (Number(data.unitRate) || 0);

    const id = await db.inventory.add({
      ...data,
      stockIn,
      stockOut,
      inHand,
      amount,
      // Keep legacy fields in sync
      received: stockIn,
      issued: stockOut,
      balanced: inHand,
      restockLog: [],
      issueLog: data.issueLog || [],
      createdAt: new Date().toISOString(),
    });
    const item = await db.inventory.get(id);
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem: async (id, data) => {
    const stockIn = Number(data.stockIn) || 0;
    const stockOut = Number(data.stockOut) || 0;
    const inHand = stockIn - stockOut;
    const amount = (Number(data.quantity) || 0) * (Number(data.unitRate) || 0);

    const updates = {
      ...data,
      stockIn,
      stockOut,
      inHand,
      amount,
      // Keep legacy fields in sync
      received: stockIn,
      issued: stockOut,
      balanced: inHand,
    };
    await db.inventory.update(id, updates);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  },

  /**
   * restockItem — adds more stock to an existing item (bulk purchase).
   * Increases stockIn, quantity, and inHand.
   * Appends a structured entry to item.restockLog for full history.
   *
   * @param {number} id        - item id
   * @param {object} restock   - { qty, unitRate, invoiceNo, date, note }
   */
  restockItem: async (id, restock) => {
    const item = await db.inventory.get(id);
    if (!item) throw new Error("Item not found");

    const addedQty = Number(restock.qty) || 0;
    const newRate = Number(restock.unitRate) || item.unitRate || 0;

    const newStockIn = (item.stockIn || 0) + addedQty;
    const newQuantity = (item.quantity || 0) + addedQty;
    const newInHand = newStockIn - (item.stockOut || 0);

    // Weighted average cost per unit (optional but professional)
    const oldValue = (item.inHand || 0) * (item.unitRate || 0);
    const addedValue = addedQty * newRate;
    const newAvgRate =
      newInHand > 0 ? Math.round((oldValue + addedValue) / newInHand) : newRate;

    const newAmount = newQuantity * newAvgRate;

    const logEntry = {
      date: restock.date,
      qty: addedQty,
      unitRate: newRate,
      invoiceNo: restock.invoiceNo?.trim() || null,
      note: restock.note?.trim() || null,
      stockInAfter: newStockIn,
      inHandAfter: newInHand,
      createdAt: new Date().toISOString(),
    };

    const existingRestockLog = Array.isArray(item.restockLog)
      ? item.restockLog
      : [];

    const updates = {
      ...item,
      stockIn: newStockIn,
      quantity: newQuantity,
      inHand: newInHand,
      unitRate: newAvgRate,
      amount: newAmount,
      received: newStockIn,
      balanced: newInHand,
      restockLog: [...existingRestockLog, logEntry],
    };

    await db.inventory.update(id, updates);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  },

  deleteItem: async (id) => {
    await db.inventory.delete(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));

export default useInventoryStore;
