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

  deleteItem: async (id) => {
    await db.inventory.delete(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));

export default useInventoryStore;
