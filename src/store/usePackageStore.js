import { create } from "zustand";
import db from "../db/database";
import { today } from "../utils/dateUtils";

const usePackageStore = create((set) => ({
  packages: [],

  loadPackages: async () => {
    const packages = await db.packages.toArray();
    set({ packages });
  },

  addPackage: async (data) => {
    const id = await db.packages.add({
      ...data,
      price: Number(data.price), // Ensure stored as Number
      speedMbps: Number(data.speedMbps) || 0,
      priceHistory: [],
      lastUpdated: null, // Null means "Original"
      createdAt: new Date().toISOString(),
    });
    const pkg = await db.packages.get(id);
    set((s) => ({ packages: [...s.packages, pkg] }));
  },

  updatePackage: async (id, newData) => {
    // 1. Fetch latest version directly from DB to avoid stale state
    const currentPkg = await db.packages.get(id);
    if (!currentPkg) return;

    const oldPrice = Number(currentPkg.price);
    const newPrice = Number(newData.price);

    // 2. Prepare update object
    let updates = {
      name: newData.name,
      price: newPrice,
      speedMbps: Number(newData.speedMbps) || 0,
    };

    // 3. Detect Price Change
    if (oldPrice !== newPrice) {
      const historyEntry = {
        id: crypto.randomUUID(),
        oldPrice: oldPrice,
        newPrice: newPrice,
        changedAt: today(), // YYYY-MM-DD
      };

      // Robustly append to history
      const previousHistory = Array.isArray(currentPkg.priceHistory)
        ? currentPkg.priceHistory
        : [];

      updates.priceHistory = [...previousHistory, historyEntry];
      updates.lastUpdated = today();
    }

    // 4. Save to DB
    await db.packages.update(id, updates);

    // 5. Update UI State (Fetch fresh to be safe)
    const freshPkg = await db.packages.get(id);
    set((s) => ({
      packages: s.packages.map((p) => (p.id === id ? freshPkg : p)),
    }));
  },

  deletePackage: async (id) => {
    await db.packages.delete(id);
    set((s) => ({ packages: s.packages.filter((p) => p.id !== id) }));
  },
}));

export default usePackageStore;
