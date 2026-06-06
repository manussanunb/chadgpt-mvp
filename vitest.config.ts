import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@/engine": resolve(__dirname, "./src/engine"),
      "@/data": resolve(__dirname, "./src/data"),
      "@/adapters": resolve(__dirname, "./src/adapters"),
      "@/components": resolve(__dirname, "./components"),
    },
  },
});
