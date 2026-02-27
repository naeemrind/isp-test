import { create } from "zustand";
import db from "../db/database";
import { addDays } from "../utils/dateUtils";

const usePaymentStore = create((set, get) => ({
  cycles: [],

  loadCycles: async () => {
    const cycles = await db.paymentCycles.toArray();
    set({ cycles });
  },

  // Create the FIRST cycle when a new customer is added
  createInitialCycle: async (customerId, startDate, totalAmount) => {
    const cycleData = {
      customerId,
      cycleStartDate: startDate,
      // FIXED: Changed from 30 to 29.
      // 30 days inclusive = Start Date + 29 days.
      cycleEndDate: addDays(startDate, 29),
      totalAmount,
      amountPaid: 0,
      amountPending: totalAmount,
      status: "pending",
      installments: [],
      createdAt: new Date().toISOString(),
    };
    const id = await db.paymentCycles.add(cycleData);
    const cycle = await db.paymentCycles.get(id);
    set((s) => ({ cycles: [...s.cycles, cycle] }));
    return cycle;
  },

  // Add a payment (full or partial installment) to an existing cycle
  addInstallment: async (cycleId, amountPaid, datePaid, note = "") => {
    const cycle = await db.paymentCycles.get(cycleId);
    if (!cycle) throw new Error("Cycle not found");

    const installment = {
      id: crypto.randomUUID(),
      amountPaid: Number(amountPaid),
      datePaid,
      note,
      createdAt: new Date().toISOString(),
    };

    const updatedInstallments = [...(cycle.installments || []), installment];
    const totalPaid = updatedInstallments.reduce(
      (sum, i) => sum + i.amountPaid,
      0,
    );
    const amountPending = Math.max(0, cycle.totalAmount - totalPaid);
    const status = amountPending === 0 ? "clear" : "pending";

    const updates = {
      installments: updatedInstallments,
      amountPaid: totalPaid,
      amountPending,
      status,
    };

    await db.paymentCycles.update(cycleId, updates);
    set((s) => ({
      cycles: s.cycles.map((c) =>
        c.id === cycleId ? { ...c, ...updates } : c,
      ),
    }));
  },

  // Start a new billing cycle for renewal (after expiry or late payment)
  renewCycle: async (customerId, startDate, totalAmount) => {
    const cycleData = {
      customerId,
      cycleStartDate: startDate,
      // FIXED: Changed from 30 to 29.
      // 30 days inclusive = Start Date + 29 days.
      cycleEndDate: addDays(startDate, 29),
      totalAmount,
      amountPaid: 0,
      amountPending: totalAmount,
      status: "pending",
      installments: [],
      isRenewal: true,
      createdAt: new Date().toISOString(),
    };
    const id = await db.paymentCycles.add(cycleData);
    const cycle = await db.paymentCycles.get(id);
    set((s) => ({ cycles: [...s.cycles, cycle] }));
    return cycle;
  },

  // Get the active/latest cycle for a customer
  getActiveCycle: (customerId) => {
    const all = get()
      .cycles.filter((c) => c.customerId === customerId)
      .sort((a, b) => new Date(b.cycleStartDate) - new Date(a.cycleStartDate));
    return all[0] || null;
  },

  getCyclesForCustomer: (customerId) => {
    return get()
      .cycles.filter((c) => c.customerId === customerId)
      .sort((a, b) => new Date(b.cycleStartDate) - new Date(a.cycleStartDate));
  },

  deleteCycle: async (cycleId) => {
    await db.paymentCycles.delete(cycleId);
    set((s) => ({ cycles: s.cycles.filter((c) => c.id !== cycleId) }));
  },
}));

export default usePaymentStore;
