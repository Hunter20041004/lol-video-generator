#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "config", "tdd-coverage.json");

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function addDuplicateErrors(values, label, errors) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function main() {
  const errors = [];
  const manifest = readManifest();
  const thresholds = manifest.thresholds || {};
  const slices = Array.isArray(manifest.slices) ? manifest.slices : [];

  for (const key of ["lines", "branches", "functions"]) {
    const value = thresholds[key];
    if (!Number.isFinite(value) || value < 80) {
      errors.push(`thresholds.${key} must be a number >= 80.`);
    }
  }

  if (slices.length === 0) {
    errors.push("At least one TDD vertical slice must be registered.");
  }

  const allProductionFiles = [];
  const allTestFiles = [];

  for (const [index, slice] of slices.entries()) {
    const label = slice.id || `slice[${index}]`;
    if (!slice.id) errors.push(`${label}: missing id.`);
    if (!slice.description) errors.push(`${label}: missing description.`);

    const productionFiles = Array.isArray(slice.productionFiles) ? slice.productionFiles : [];
    const testFiles = Array.isArray(slice.testFiles) ? slice.testFiles : [];

    if (productionFiles.length === 0) errors.push(`${label}: productionFiles cannot be empty.`);
    if (testFiles.length === 0) errors.push(`${label}: testFiles cannot be empty.`);

    for (const file of productionFiles) {
      allProductionFiles.push(file);
      if (!exists(file)) errors.push(`${label}: missing production file ${file}`);
    }

    for (const file of testFiles) {
      allTestFiles.push(file);
      if (!exists(file)) errors.push(`${label}: missing test file ${file}`);
    }
  }

  addDuplicateErrors(allProductionFiles, "production file in TDD manifest", errors);
  addDuplicateErrors(allTestFiles, "test file in TDD manifest", errors);

  if (errors.length > 0) {
    console.error("TDD manifest check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("TDD manifest check passed.");
  for (const slice of slices) {
    console.log(`- ${slice.id}: ${slice.productionFiles.length} production file(s), ${slice.testFiles.length} test file(s)`);
  }
}

main();
