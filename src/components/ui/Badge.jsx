// Badge.jsx — Unified status badge component
// Computed statuses (derived from cycle data):
//   clear     → paid up, cycle active
//   pending   → unpaid, cycle still active
//   expired   → cycle ended + unpaid (replaces "overdue" in status column)
//   renewal   → cycle ended + fully paid (needs new cycle, not suspended)
// Stored statuses (on customer record):
//   suspended → manually suspended by operator
//   terminated → archived/terminated

export default function Badge({ status }) {
  const map = {
    clear: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    expired: "bg-red-100 text-red-800",
    renewal: "bg-blue-100 text-blue-700",
    suspended: "bg-red-200 text-red-900",
    terminated: "bg-gray-200 text-gray-600",
    // Legacy / fallback
    overdue: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    grace: "bg-orange-100 text-orange-800",
  };

  const label = {
    clear: "Clear",
    pending: "Pending",
    expired: "Expired",
    renewal: "Renewal Due",
    suspended: "Suspended",
    terminated: "Terminated",
    // Legacy / fallback
    overdue: "Expired",
    active: "Active",
    grace: "Grace Period",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        map[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {label[status] || status}
    </span>
  );
}
