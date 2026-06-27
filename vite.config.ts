import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    open: "/mcp-app.html",
  },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: "mcp-app.html",
    },
    outDir: "dist",
    emptyOutDir: false,
  },
  // The repo carries local git worktrees under .worktrees/ AND harness/agent
  // worktrees under .claude/worktrees/ (both gitignored). Vitest still scans the
  // filesystem, so without this it runs duplicate copies of every test — inflating
  // counts and surfacing cross-copy flakiness. Scope tests to the main tree.
  test: {
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**"],
  },
});
