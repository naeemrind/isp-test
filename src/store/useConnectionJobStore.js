import { create } from "zustand";
import { readAll, writeAll } from "../db/database";

// Connection Jobs are stored in the "connectionJobs" table in localStorage.
// Each job looks like:
// {
//   id: number,
//   date: "2026-03-01",
//   technicianName: "Ali",
//   subscriberName: "Ahmed Ali",
//   subscriberUsername: "ahmed.ali",
//   subscriberId: number | null,
//   note: "New connection Gulshan B5",
//   items: [
//     { inventoryItemId: 3, description: "fiber", unit: "meter", qty: 50, unitRate: 25, totalValue: 1250 },
//   ],
//   totalValue: 1400,
//   amountPaid: 1000,       // ← NEW: how much subscriber paid for inventory at time of issue
//   amountPending: 400,     // ← NEW: totalValue - amountPaid (inventory dues)
//   createdAt: "ISO string",
// }

const TABLE = "connectionJobs";

async function getJobs() {
  const data = await readAll();
  return data[TABLE] || [];
}

async function saveJobs(jobs) {
  const data = await readAll();
  data[TABLE] = jobs;
  await writeAll(data);
}

const useConnectionJobStore = create((set) => ({
  jobs: [],

  loadJobs: async () => {
    const jobs = await getJobs();
    set({ jobs });
  },

  addJob: async (jobData) => {
    const existing = await getJobs();
    const maxId = existing.reduce((m, j) => Math.max(m, Number(j.id) || 0), 0);
    const totalValue = Number(jobData.totalValue) || 0;
    const amountPaid = Number(jobData.amountPaid) || 0;
    const amountPending = Math.max(0, totalValue - amountPaid);
    const newJob = {
      ...jobData,
      id: maxId + 1,
      amountPaid,
      amountPending,
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing, newJob];
    await saveJobs(updated);
    set({ jobs: updated });
    return newJob;
  },

  /**
   * recordInventoryPayment — add a payment toward a job's pending inventory balance.
   */
  recordInventoryPayment: async (jobId, amount) => {
    const existing = await getJobs();
    const job = existing.find((j) => j.id === jobId);
    if (!job) return;
    const paid = Math.min(
      Number(job.totalValue) || 0,
      (Number(job.amountPaid) || 0) + (Number(amount) || 0),
    );
    const pending = Math.max(0, (Number(job.totalValue) || 0) - paid);
    const updated = existing.map((j) =>
      j.id === jobId ? { ...j, amountPaid: paid, amountPending: pending } : j,
    );
    await saveJobs(updated);
    set({ jobs: updated });
  },

  deleteJob: async (id) => {
    const existing = await getJobs();
    const updated = existing.filter((j) => j.id !== id);
    await saveJobs(updated);
    set({ jobs: updated });
  },
}));

export default useConnectionJobStore;
