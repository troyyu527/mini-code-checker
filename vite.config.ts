// Vite config: the browser app lives in client/ and is built for GitHub Pages under /mini-code-checker/.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const shared = fileURLToPath(new URL("./shared", import.meta.url));

export default defineConfig({
  root: "client",
  base: "/mini-code-checker/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@shared": shared } },
  build: { outDir: "../dist", emptyOutDir: true },
});
