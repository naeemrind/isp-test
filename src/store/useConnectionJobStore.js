import { create } from "zustand";
import { readAll, writeAll } from "../db/database";

// Connection Jobs are stored in the "connectionJobs" table in localStorage.
// Each job looks like:
// {
//   id: number,
//   date: "2026-03-01",
//   technicianName: "Ali",
//   subscriberName: "Ahmed Ali",         // free-text name OR username
//   subscriberUsername: "ahmed.ali",     // optional - typed username for tracking
//   note: "New connection Gulshan B5",
//   items: [
//     { inventoryItemId: 3, description: "fiber", unit: "meter", qty: 50, unitRate: 25, totalValue: 1250 },
//     { inventoryItemId: 1, description: "ONU",   unit: "piece", qty: 1,  unitRate: 150, totalValue: 150 },
//   ],
//   totalValue: 1400,
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
    const newJob = {
      ...jobData,
      id: maxId + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing, newJob];
    await saveJobs(updated);
    set({ jobs: updated });
    return newJob;
  },

  deleteJob: async (id) => {
    const existing = await getJobs();
    const updated = existing.filter((j) => j.id !== id);
    await saveJobs(updated);
    set({ jobs: updated });
  },
}));

export default useConnectionJobStore;
