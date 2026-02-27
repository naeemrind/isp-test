import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { setupDevTools } from "./utils/devTools.js";

setupDevTools(); // <-- Add this

createRoot(document.getElementById("root")).render(<App />);
