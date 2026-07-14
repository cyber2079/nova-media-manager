import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync, existsSync } from "fs";

const root = path.resolve(__dirname);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "serve-secondary-html",
      configureServer(server) {
        // Intercept before Vite's SPA fallback — serve secondary.html directly
        server.middlewares.use((req, res, next) => {
          if (req.url === "/secondary.html" || req.url?.startsWith("/secondary.html")) {
            const filePath = path.resolve(root, "secondary.html");
            if (existsSync(filePath)) {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(readFileSync(filePath, "utf-8"));
              return;
            }
          }
          next();
        });
      },
    },
  ],
  resolve: { alias: { "@": path.resolve(root, "src") } },
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, "index.html"),
        secondary: path.resolve(root, "secondary.html"),
      },
    },
  },
});
