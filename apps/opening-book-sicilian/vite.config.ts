import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/openings-sicilian/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    strictPort: true,
    proxy: {
      "/openings": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    strictPort: true,
    proxy: {
      "/openings": {
        target: "http://localhost:4173",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
