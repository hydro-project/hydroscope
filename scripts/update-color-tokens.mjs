#!/usr/bin/env node
/* eslint-env node */
/*
  Update sample JSONs to use semantic color tokens for CollectionGroup edges.
  Replaces legacy hex color fields with `color-token` in hydroscope/test-data/*.json.

  Mappings:
    "color": "#6b7280" -> "color-token": "muted"
    "color": "#000000" -> "color-token": "default"
    "color": "#2563eb" -> "color-token": "highlight-1"

  Usage:
    node scripts/update-color-tokens.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TEST_DATA_DIR = path.join(ROOT, "test-data");

const REPLACEMENTS = [
  { from: '"color": "#6b7280"', to: '"color-token": "muted"' },
  { from: '"color": "#000000"', to: '"color-token": "default"' },
  { from: '"color": "#2563eb"', to: '"color-token": "highlight-1"' },
];

function updateFile(filePath) {
  const orig = fs.readFileSync(filePath, "utf8");
  let updated = orig;
  for (const { from, to } of REPLACEMENTS) {
    updated = updated.split(from).join(to);
  }
  if (updated !== orig) {
    fs.writeFileSync(filePath, updated, "utf8");
    return true;
  }
  return false;
}

function run() {
  const entries = fs.readdirSync(TEST_DATA_DIR);
  let changed = 0;
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const p = path.join(TEST_DATA_DIR, name);
    const did = updateFile(p);
    if (did) {
      process.stdout.write(`Updated: ${name}\n`);
      changed++;
    }
  }
  if (changed === 0) {
    process.stdout.write(
      "No changes made. Files may already be using color-token.\n",
    );
  } else {
    process.stdout.write(`Done. Updated ${changed} file(s).\n`);
  }
}

run();
