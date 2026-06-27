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
    // Determinism for the supertest suites. Many test files drive Express apps via
    // `request(app)`, which binds a fresh ephemeral HTTP server per call. Vitest's
    // forks pool defaults to one fork per CPU, so a full-parallel run oversubscribes
    // the machine: the loopback HTTP requests contend for the event loop and for
    // ephemeral ports, and a few intermittently stall to the 5s timeout or race a
    // reused port — the long-standing "app.test.ts flake," which actually surfaces in
    // whichever supertest file loses the race on a given run. Capping the pool to a
    // few forks removes that oversubscription (and mirrors a typical 2-core CI runner),
    // and the wider timeout absorbs residual scheduling jitter. Neither weakens any
    // assertion. minForks is pinned to 1 because vitest defaults it to the CPU count,
    // which would otherwise exceed maxForks and throw.
    testTimeout: 15000,
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
  },
});
