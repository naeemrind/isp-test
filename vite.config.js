import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "galaxy-data.json");

const DEFAULT_DATA = {
  customers: [],
  paymentCycles: [],
  packages: [],
  inventory: [],
  expenses: [],
  settings: {},
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
    console.log("[galaxy-isp] Created galaxy-data.json");
  }
}

function localDataPlugin() {
  return {
    name: "local-data-api",
    configureServer(server) {
      server.middlewares.use("/api/data", (req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === "GET") {
          try {
            ensureDataFile();
            const data = fs.readFileSync(DATA_FILE, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(data);
          } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(parsed, null, 2),
                "utf-8",
              );
              res.setHeader("Content-Type", "application/json");
              res.writeHead(200);
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: "./", // Add this line!
  plugins: [react(), tailwindcss(), localDataPlugin()],
  server: {
    watch: {
      // Tell Vite to ignore galaxy-data.json — every save to this file
      // was triggering HMR which reset all React state (tab → "dashboard")
      ignored: ["**/galaxy-data.json"],
    },
  },
});
