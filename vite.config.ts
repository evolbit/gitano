import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: process.env.TAURI_DEV_PORT
      ? Number(process.env.TAURI_DEV_PORT)
      : 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST ?? "0.0.0.0",
    hmr:
      process.env.TAURI_DEV_HOST && process.env.TAURI_DEV_PORT
        ? {
            protocol: "ws",
            host: process.env.TAURI_DEV_HOST,
            port: Number(process.env.TAURI_DEV_WDS_PORT),
          }
        : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
