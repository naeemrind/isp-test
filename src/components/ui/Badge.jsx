export default function Badge({ status }) {
  const map = {
    clear: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    terminated: "bg-gray-200 text-gray-600",
    grace: "bg-orange-100 text-orange-800",
  };

  const label = {
    clear: "Clear",
    pending: "Pending",
    overdue: "Overdue",
    active: "Active",
    suspended: "Suspended",
    terminated: "Terminated",
    grace: "Grace Period",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}
    >
      {label[status] || status}
    </span>
  );
}
