import { useEffect, useState } from "react";
import Navbar from "./components/layout/Navbar";
import BackupBanner from "./components/ui/BackupBanner";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers/Customers";
import Inventory from "./pages/Inventory/Inventory";
import Expenses from "./pages/Expenses/Expenses";
import Settings from "./pages/Settings";
import Login from "./pages/Login"; // Import the new Login page

// Stores
import useCustomerStore from "./store/useCustomerStore";
import usePaymentStore from "./store/usePaymentStore";
import usePackageStore from "./store/usePackageStore";
import useInventoryStore from "./store/useInventoryStore";
import useExpenseStore from "./store/useExpenseStore";

// Developer Tools
import { setupDevTools } from "./utils/devTools.js";
setupDevTools();

export default function App() {
  // Check if previously logged in during this session
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem("galaxy_auth") === "true",
  );

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Function to load data only AFTER login
  const loadApplicationData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        useCustomerStore.getState().loadCustomers(),
        usePaymentStore.getState().loadCycles(),
        usePackageStore.getState().loadPackages(),
        useInventoryStore.getState().loadInventory(),
        useExpenseStore.getState().loadExpenses(),
      ]);
      setDataLoaded(true);
    } catch (error) {
      console.error("Failed to load data", error);
    }
    setLoading(false);
  };

  // Effect: Trigger data load if authenticated but data not yet loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && !dataLoaded) {
        loadApplicationData();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, dataLoaded]);

  const handleLogin = () => {
    sessionStorage.setItem("galaxy_auth", "true");
    setIsAuthenticated(true);
  };

  // 1. Show Login Screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // 2. Show Loading Screen while fetching data
  if (loading || !dataLoaded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-gray-500 text-sm font-medium">
          Loading Galaxy ISP...
        </div>
      </div>
    );
  }

  // 3. Show Main App
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar activeTab={tab} onTabChange={setTab} />
      <BackupBanner />
      <main className="flex-1 overflow-auto">
        <div style={{ display: tab === "dashboard" ? "block" : "none" }}>
          <Dashboard />
        </div>
        <div style={{ display: tab === "customers" ? "block" : "none" }}>
          <Customers />
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
