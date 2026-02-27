import { useEffect, useState } from "react";
import Navbar from "./components/layout/Navbar";
import BackupBanner from "./components/ui/BackupBanner";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers/Customers";
import Inventory from "./pages/Inventory/Inventory";
import Expenses from "./pages/Expenses/Expenses";
import Settings from "./pages/Settings";
import useCustomerStore from "./store/useCustomerStore";
import usePaymentStore from "./store/usePaymentStore";
import usePackageStore from "./store/usePackageStore";
import useInventoryStore from "./store/useInventoryStore";
import useExpenseStore from "./store/useExpenseStore";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      useCustomerStore.getState().loadCustomers(),
      usePaymentStore.getState().loadCycles(),
      usePackageStore.getState().loadPackages(),
      useInventoryStore.getState().loadInventory(),
      useExpenseStore.getState().loadExpenses(),
    ]).then(() => setLoading(false));
  }, []);

  const handleNavigate = (targetTab, filterMode = "all") => {
    setTab(targetTab);
    setCustomerFilter(filterMode);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading Galaxy ISP...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar activeTab={tab} onTabChange={(t) => handleNavigate(t, "all")} />
      <BackupBanner />
      <main className="flex-1 overflow-auto">
        <div style={{ display: tab === "dashboard" ? "block" : "none" }}>
          <Dashboard onNavigate={handleNavigate} />
        </div>
        <div style={{ display: tab === "customers" ? "block" : "none" }}>
          <Customers initialFilter={customerFilter} />
        </div>
        <div style={{ display: tab === "inventory" ? "block" : "none" }}>
          <Inventory />
        </div>
        <div style={{ display: tab === "expenses" ? "block" : "none" }}>
          <Expenses />
        </div>
        <div style={{ display: tab === "settings" ? "block" : "none" }}>
          <Settings />
        </div>
      </main>
    </div>
  );
}
