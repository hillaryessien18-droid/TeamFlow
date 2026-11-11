/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  // On Vercel, fail the build instead of shipping a site that calls http://localhost:8000.
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (command === "build" && process.env.VERCEL && !env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL is not set. Add it in Vercel → Project → Settings → Environment Variables " +
        "(for example https://teamflow-api.onrender.com) and redeploy.",
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      css: false,
    },
  };
});
