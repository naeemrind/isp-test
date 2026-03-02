import { create } from "zustand";
import db from "../db/database";

export const EXPENSE_CATEGORIES = [
  "Internet Uplink",
  "Monthly Salary",
  "Rent",
  "Electricity Bill",
  "Petrol / Travel",
  "Food & Labour",
  "Marketing & Ads",
  "Software & Hosting",
  "Maintenance & Tools",
  "Taxes & Fees",
  "Misc",
];

const useExpenseStore = create((set) => ({
  expenses: [],

  loadExpenses: async () => {
    const expenses = await db.expenses.toArray();
    set({ expenses });
  },

  addExpense: async (data) => {
    const id = await db.expenses.add({
      ...data,
      createdAt: new Date().toISOString(),
    });
    const expense = await db.expenses.get(id);
    set((s) => ({ expenses: [...s.expenses, expense] }));
  },

  updateExpense: async (id, data) => {
    await db.expenses.update(id, data);
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)),
    }));
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
  },

  getTotalExpenses: () => {
    return 0; // computed dynamically in components
  },
}));

export default useExpenseStore;
