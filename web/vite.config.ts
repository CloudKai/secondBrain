import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  // Vercel Services share project settings. Expose only these two public values;
  // never broaden envPrefix to include server credentials.
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || "";
  if (publicKey.startsWith("sb_secret_")) {
    throw new Error("The browser requires a Supabase publishable key, not a secret key.");
  }
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicKey),
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: process.env.WEB_API_URL || "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
