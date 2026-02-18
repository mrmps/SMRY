#!/usr/bin/env bun
/**
 * Verify all locale JSON files match the key structure of messages/en.json.
 * Run with: bun run check-i18n
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

type ShapeType = "object" | "array" | "leaf";

type ShapeMap = Map<string, ShapeType>;

function readJson(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function collectShape(value: unknown, prefix: string, shape: ShapeMap): void {
  if (Array.isArray(value)) {
    if (prefix) shape.set(prefix, "array");
    return;
  }

  if (value && typeof value === "object") {
    if (prefix) shape.set(prefix, "object");
    for (const [key, child] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${key}` : key;
      collectShape(child, next, shape);
    }
    return;
  }

  if (prefix) shape.set(prefix, "leaf");
}

function compareShapes(base: ShapeMap, target: ShapeMap) {
  const missing: string[] = [];
  const extra: string[] = [];
  const typeMismatches: string[] = [];

  for (const [key, baseType] of base.entries()) {
    const targetType = target.get(key);
    if (!targetType) {
      missing.push(key);
      continue;
    }
    if (baseType !== targetType) {
      typeMismatches.push(`${key} (${baseType} -> ${targetType})`);
    }
  }

  for (const key of target.keys()) {
    if (!base.has(key)) extra.push(key);
  }

  return { missing, extra, typeMismatches };
}

const projectRoot = process.cwd();
const messagesDir = join(projectRoot, "messages");
const baseFile = join(messagesDir, "en.json");

if (!existsSync(baseFile)) {
  console.error(`Base locale file not found: ${baseFile}`);
  process.exit(1);
}

const baseJson = readJson(baseFile);
const baseShape: ShapeMap = new Map();
collectShape(baseJson, "", baseShape);

const localeFiles = readdirSync(messagesDir)
  .filter((file) => file.endsWith(".json"))
  .filter((file) => file !== "en.json")
  .sort();

let hasIssues = false;

for (const file of localeFiles) {
  const fullPath = join(messagesDir, file);
  const localeJson = readJson(fullPath);
  const localeShape: ShapeMap = new Map();
  collectShape(localeJson, "", localeShape);

  const { missing, extra, typeMismatches } = compareShapes(baseShape, localeShape);

  if (missing.length || extra.length || typeMismatches.length) {
    hasIssues = true;
    console.log(`\n${file}:`);
    if (missing.length) {
      console.log(`  Missing (${missing.length})`);
      missing.forEach((key) => {
        console.log(`    - ${key}`);
      });
    }
    if (extra.length) {
      console.log(`  Extra (${extra.length})`);
      extra.forEach((key) => {
        console.log(`    - ${key}`);
      });
    }
    if (typeMismatches.length) {
      console.log(`  Type mismatches (${typeMismatches.length})`);
      typeMismatches.forEach((key) => {
        console.log(`    - ${key}`);
      });
    }
  }
}

if (hasIssues) {
  console.error("\nI18n check failed. Align locale keys with messages/en.json.");
  process.exit(1);
}

console.log("I18n check passed. All locale keys match messages/en.json.");
