#!/usr/bin/env node
/**
 * Post-build script: create an unhashed copy of the sqlite3 OPFS async proxy.
 *
 * The sqlite3 WASM runtime resolves its OPFS proxy worker via a hardcoded
 * default URI ("sqlite3-opfs-async-proxy.js"), but Vite content-hashes the
 * filename. This script copies the hashed file to the expected unhashed name
 * so the runtime URL resolves on any hosting platform (Vercel, etc.).
 */
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const candidates = [
  join(process.cwd(), ".vercel", "output", "static", "_nuxt"),
  join(process.cwd(), ".output", "public", "_nuxt"),
];

const nuxtDir = candidates.find((d) => existsSync(d));

if (!nuxtDir) {
  console.error(
    "[copy-opfs-proxy] No _nuxt output directory found at:",
    candidates.join(", ")
  );
  process.exit(1);
}

const files = readdirSync(nuxtDir);
const hashed = files.find(
  (f) =>
    f.startsWith("sqlite3-opfs-async-proxy") &&
    f !== "sqlite3-opfs-async-proxy.js" &&
    f.endsWith(".js")
);

if (!hashed) {
  console.log("[copy-opfs-proxy] No hashed proxy file found — skipping.");
  process.exit(0);
}

if (files.includes("sqlite3-opfs-async-proxy.js")) {
  console.log("[copy-opfs-proxy] Unhashed proxy already exists — skipping.");
  process.exit(0);
}

copyFileSync(
  join(nuxtDir, hashed),
  join(nuxtDir, "sqlite3-opfs-async-proxy.js")
);
console.log(`[copy-opfs-proxy] Copied ${hashed} → sqlite3-opfs-async-proxy.js`);
