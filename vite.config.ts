import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// NOTE: vite-plugin-pwa was removed intentionally. The previous Workbox SW
// kept caching stale hashed chunks and forced users to fully close the
// browser to recover. A kill-switch worker now lives at `public/sw.js`.
export default defineConfig(({ mode }) => ({
  // Relative base so built assets resolve under capacitor://localhost,
  // file://, and the web preview alike.
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/jspdf") || id.includes("/html2canvas")) return "pdf-vendor";
          if (id.includes("/@radix-ui/") || id.includes("/cmdk/") || id.includes("/lucide-react/")) return "ui-vendor";
          if (id.includes("/@tanstack/") || id.includes("/@supabase/")) return "data-vendor";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) return "react-vendor";
          return undefined;
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
}));
