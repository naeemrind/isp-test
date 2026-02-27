import { create } from "zustand";
import db from "../db/database";

const useCustomerStore = create((set) => ({
  customers: [],

  loadCustomers: async () => {
    const customers = await db.customers.toArray();
    set({ customers });
  },

  addCustomer: async (data) => {
    const id = await db.customers.add({
      ...data,
      createdAt: new Date().toISOString(),
    });
    const customer = await db.customers.get(id);
    set((s) => ({ customers: [...s.customers, customer] }));
    return customer;
  },

  updateCustomer: async (id, data) => {
    await db.customers.update(id, data);
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
  },

  // SOFT DELETE — marks as terminated + archived, preserves all data
  archiveCustomer: async (id, reason = "") => {
    const updates = {
      status: "terminated",
      isArchived: true,
      archivedAt: new Date().toISOString(),
      archiveReason: reason,
    };
    await db.customers.update(id, updates);
    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    }));
  },

  // HARD DELETE — only called from Archive view, truly removes everything
  permanentlyDeleteCustomer: async (id) => {
    await db.paymentCycles.where("customerId").equals(id).delete();
    await db.customers.delete(id);
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
  },

  // Restore an archived customer back to active
  restoreCustomer: async (id) => {
    const updates = {
      status: "active",
      isArchived: false,
      archivedAt: null,
      archiveReason: "",
    };
    await db.customers.update(id, updates);
    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    }));
  },
}));

export default useCustomerStore;
