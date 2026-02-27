// src/utils/dateUtils.js

// Add N days to a date string, returns YYYY-MM-DD
export const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

// Format date to Pakistani Standard: "27-Feb-2026"
export const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date)) return "-";

  // 'en-PK' usually gives DD/MM/YYYY, but we force "27-Feb-2026" for clarity
  return date
    .toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\//g, "-");
};

// Today's date as YYYY-MM-DD
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Days difference (Midnight to Midnight)
export const daysUntil = (dateStr) => {
  if (!dateStr) return 0;
  const raw = dateStr.split("T")[0];
  const [y, m, d] = raw.split("-").map(Number);

  const target = new Date(y, m - 1, d); // Target Midnight
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Current Midnight

  // Calculate strict day difference
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
};

// Check if a cycle is within grace period (1-7 days overdue)
export const daysSince = (dateStr) => -daysUntil(dateStr);
