import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dashboard dev server proxies API calls to the Express backend on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/media": "http://localhost:3000",
    },
  },
});
