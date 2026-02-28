import { create } from "zustand";
import db from "../db/database";
// CYCLE_LENGTH_DAYS = 29  →  endDate = startDate + 29 = the 30th inclusive day
import { addDays, CYCLE_LENGTH_DAYS } from "../utils/dateUtils";

const usePaymentStore = create((set, get) => ({
  cycles: [],

  loadCycles: async () => {
    const cycles = await db.paymentCycles.toArray();
    set({ cycles });
  },

  createInitialCycle: async (customerId, startDate, totalAmount) => {
    const cycleData = {
      customerId,
      cycleStartDate: startDate,
      // Day 1 = startDate, Day 30 = startDate + 29
      cycleEndDate: addDays(startDate, CYCLE_LENGTH_DAYS),
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

  renewCycle: async (customerId, startDate, packagePrice) => {
    const allCycles = get().cycles.filter((c) => c.customerId === customerId);
    const activeCycle = allCycles.sort(
      (a, b) => new Date(b.cycleStartDate) - new Date(a.cycleStartDate),
    )[0];

    // Prevent accidental double renewal on the exact same date
    if (
      activeCycle &&
      activeCycle.cycleStartDate === startDate &&
      activeCycle.isRenewal
    ) {
      return activeCycle;
    }

    let broughtForward = 0;

    if (activeCycle && activeCycle.amountPending > 0) {
      broughtForward = activeCycle.amountPending;

      const updates = {
        amountPending: 0,
        status: "clear",
        shiftedAmount: broughtForward,
      };

      await db.paymentCycles.update(activeCycle.id, updates);

      set((s) => ({
        cycles: s.cycles.map((c) =>
          c.id === activeCycle.id ? { ...c, ...updates } : c,
        ),
      }));
    }

    const totalAmount = packagePrice + broughtForward;

    const cycleData = {
      customerId,
      cycleStartDate: startDate,
      // Day 1 = startDate, Day 30 = startDate + 29
      cycleEndDate: addDays(startDate, CYCLE_LENGTH_DAYS),
      totalAmount,
      amountPaid: 0,
      amountPending: totalAmount,
      status: "pending",
      installments: [],
      isRenewal: true,
      previousBalance: broughtForward,
      createdAt: new Date().toISOString(),
    };

    const id = await db.paymentCycles.add(cycleData);
    const cycle = await db.paymentCycles.get(id);
    set((s) => ({ cycles: [...s.cycles, cycle] }));
    return cycle;
  },

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
