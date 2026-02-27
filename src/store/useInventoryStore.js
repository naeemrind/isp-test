import { create } from "zustand";
import db from "../db/database";

const useInventoryStore = create((set) => ({
  items: [],

  loadInventory: async () => {
    const items = await db.inventory.toArray();
    set({ items });
  },

  addItem: async (data) => {
    // Auto-calculate amount and balanced
    const amount = (Number(data.quantity) || 0) * (Number(data.unitRate) || 0);
    const balanced = (Number(data.received) || 0) - (Number(data.issued) || 0);
    const id = await db.inventory.add({
      ...data,
      amount,
      balanced,
      createdAt: new Date().toISOString(),
    });
    const item = await db.inventory.get(id);
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem: async (id, data) => {
    const amount = (Number(data.quantity) || 0) * (Number(data.unitRate) || 0);
    const balanced = (Number(data.received) || 0) - (Number(data.issued) || 0);
    const updates = { ...data, amount, balanced };
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
