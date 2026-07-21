import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Strict CSP plugin — injects a meta Content-Security-Policy tag that
// removes `unsafe-eval` in production builds. Dev builds keep the
// permissive CSP from tauri.conf.json for Vite HMR compatibility.
function strictCspPlugin() {
  return {
    name: "strict-csp-meta",
    apply: "build" as const,
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        "</head>",
        `<meta http-equiv="Content-Security-Policy" content="script-src 'self'">\n</head>`,
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), strictCspPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    hmr: { overlay: false },
  },
  // 抑制 Vite 7 + Tauri 2 已知降级警告（非功能缺陷）
  customLogger: {
    info(msg: string) { console.info(msg); },
    warn(msg: string) {
      if (msg.includes("is deprecated") && msg.includes("config")) return;
      if (msg.includes("enforce: 'pre'")) return;
      console.warn(msg);
    },
    error(msg: string) { console.error(msg); },
    infoOnce(msg: string) { console.info(msg); },
    warnOnce(msg: string) {
      if (msg.includes("is deprecated") && msg.includes("config")) return;
      console.warn(msg);
    },
    errorOnce(msg: string) { console.error(msg); },
    clearScreen() {},
    hasWarned: new Set(),
  } as any,
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
