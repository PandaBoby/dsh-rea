#!/usr/bin/env node
// Validates everything this package ships: the manifest, the bundle patch, the
// locale cards and the docs. There is no runtime code to test, so the manifest
// contract is the thing that can silently rot.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checked = 0;

function check(condition, message) {
  checked += 1;
  if (!condition) failures.push(message);
}

function read(relative) {
  return readFileSync(join(root, relative), "utf8");
}

function readJson(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    check(false, relative + ": invalid JSON (" + error.message + ")");
    return null;
  }
}

const SEMVER = /^\d+\.\d+\.\d+$/;
const ENGINE_SPEC = /^rea-agents@(latest|\d+\.\d+\.\d+)$/;

const pkg = readJson("package.json");

if (pkg) {
  const required = ["name", "version", "description", "license", "repository", "homepage", "bugs", "author", "engines", "files", "exports"];
  for (const field of required) check(Boolean(pkg[field]), "package.json: missing " + field);
  check(pkg.name === "dsh-rea", "package.json: name must be dsh-rea");
  check(SEMVER.test(pkg.version || ""), "package.json: version must be x.y.z");
  check(pkg.license === "MIT", "package.json: license must be MIT");
  check(pkg.type === "module", "package.json: type must be module");

  // Every declared artifact must exist; a typo here only surfaces when a user installs.
  for (const entry of pkg.files || []) {
    const target = entry.includes("*") ? dirname(entry) : entry;
    check(existsSync(join(root, target)), "package.json: files entry " + entry + " does not exist");
  }
  for (const [key, target] of Object.entries(pkg.exports || {})) {
    const resolved = String(target).replace(/\*/g, "en");
    check(existsSync(join(root, resolved)), "package.json: exports " + key + " => " + target + " does not exist");
  }

  const patchPath = pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch;
  check(typeof patchPath === "string", "package.json: dsh.bundle.patch is required");

  if (typeof patchPath === "string" && existsSync(join(root, patchPath))) {
    let patch = null;
    try {
      patch = parseYaml(read(patchPath));
    } catch (error) {
      check(false, patchPath + ": invalid YAML (" + error.message + ")");
    }
    if (patch) {
      check(Array.isArray(patch), "patch: top level must be a list of patch operations");
      check((patch || []).length === 1, "patch: expected exactly one operation, found " + (patch || []).length);
      const insert = patch && patch[0] && patch[0].insert;
      check(Array.isArray(insert), "patch: the single operation must be an insert");
      check((insert || []).length === 1, "patch: the insert must add exactly one row");
      const row = (insert && insert[0]) || {};
      const config = row.config || {};
      check(row.id === "rea-mcp", "patch: row id must be rea-mcp");
      check(row.name === "@deepseek-ai/dsh-mcp-client", "patch: row must use the generic mcp client");
      check(config.serverName === "rea", "patch: config.serverName must be rea");
      check(config.transport === "stdio", "patch: config.transport must be stdio");
      check(config.command === "npx", "patch: config.command must be npx");
      check(Array.isArray(config.args), "patch: config.args must be a list");
      const args = config.args || [];
      check(args[0] === "-y", "patch: config.args must start with -y");
      check(args[args.length - 1] === "mcp", "patch: config.args must end with the mcp subcommand");
      check(ENGINE_SPEC.test(args[1] || ""), "patch: engine spec must be rea-agents@latest or a pinned x.y.z, got " + JSON.stringify(args[1]));
    }
  }
}

// Locale cards are what the Plugins page renders; a missing key renders a blank card.
const locales = {};
for (const locale of ["en", "zh"]) {
  const data = readJson("locale/" + locale + ".json");
  locales[locale] = data || {};
  const meta = (data && data.meta) || {};
  check(typeof meta.title === "string" && meta.title.length > 0, "locale/" + locale + ".json: meta.title is required");
  check(typeof meta.description === "string" && meta.description.length > 0, "locale/" + locale + ".json: meta.description is required");
  check((meta.description || "").length <= 1024, "locale/" + locale + ".json: meta.description exceeds 1024 characters");
}

function keyPaths(value, prefix) {
  return Object.entries(value || {}).flatMap(function (entry) {
    const key = entry[0];
    const child = entry[1];
    return child && typeof child === "object" ? keyPaths(child, prefix + key + ".") : [prefix + key];
  });
}

const enKeys = keyPaths(locales.en, "").sort().join(",");
const zhKeys = keyPaths(locales.zh, "").sort().join(",");
check(enKeys === zhKeys, "locale: en and zh expose different keys (" + enKeys + " vs " + zhKeys + ")");

const icon = read("icon.svg");
check(icon.trimStart().startsWith("<svg"), "icon.svg: must be an SVG document");
check(/viewBox="[\d\s.]+"/.test(icon), "icon.svg: must declare a viewBox");

const license = read("LICENSE");
check(license.includes("MIT License"), "LICENSE: must be the MIT license");
check(license.includes("Permission is hereby granted"), "LICENSE: license body looks truncated");

// The two READMEs are the public entry point; they must point at each other.
const readme = read("README.md");
const readmeZh = read("README.zh.md");
check(readme.includes("README.zh.md"), "README.md: must link to README.zh.md");
check(readmeZh.includes("README.md"), "README.zh.md: must link to README.md");
check(/^##\s+License/m.test(readme), "README.md: must document the license");
check(/^##\s*许可/m.test(readmeZh), "README.zh.md: must document the license");
check(readme.length > 1500, "README.md: looks like a stub");
check(readmeZh.length > 1200, "README.zh.md: looks like a stub");

// Keep the changelog and the manifest from drifting apart.
check(existsSync(join(root, "CHANGELOG.md")), "CHANGELOG.md: missing");
if (existsSync(join(root, "CHANGELOG.md")) && pkg) {
  const changelog = read("CHANGELOG.md");
  const latest = changelog.match(/^##\s*\[?v?(\d+\.\d+\.\d+)\]?/m);
  check(latest && latest[1] === pkg.version, "CHANGELOG.md: newest entry (" + (latest ? latest[1] : "none") + ") must match package.json version (" + pkg.version + ")");
}

// Markdown that renders wrong is a documentation bug nobody sees in review.
for (const [name, text] of [["README.md", readme], ["README.zh.md", readmeZh]]) {
  const fences = text.split("\n").filter(function (line) { return line.trimStart().startsWith("```"); }).length;
  check(fences % 2 === 0, name + ": unbalanced code fences (" + fences + ")");
  const links = text.match(/\]\(\.\/([^)#\s]+)\)/g) || [];
  for (const link of links) {
    const target = link.slice(4, -1);
    check(existsSync(join(root, target)), name + ": relative link ./" + target + " does not exist");
  }
}


// Table-of-contents links are the first thing a reader clicks; a broken one is invisible in review.
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

for (const [name, text] of [["README.md", readme], ["README.zh.md", readmeZh]]) {
  const headings = (text.match(/^#{2,3}\s+.+$/gm) || []).map(function (line) { return slugify(line.replace(/^#+\s+/, "")); });
  const anchors = (text.match(/\]\(#[^)]+\)/g) || []).map(function (link) { return link.slice(3, -1); });
  for (const anchor of anchors) {
    check(headings.includes(anchor), name + ": in-page link #" + anchor + " matches no heading");
  }
}

// A workflow that cannot parse fails silently until the next push.
const workflowsDir = join(root, ".github", "workflows");
if (existsSync(workflowsDir)) {
  const { readdirSync } = await import("node:fs");
  const workflowFiles = readdirSync(workflowsDir).filter(function (file) { return file.endsWith(".yml") || file.endsWith(".yaml"); });
  check(workflowFiles.length > 0, ".github/workflows: no workflow files");
  for (const workflowFile of workflowFiles) {
    try {
      const parsedWorkflow = parseYaml(read(".github/workflows/" + workflowFile));
      check(Boolean(parsedWorkflow && parsedWorkflow.jobs), ".github/workflows/" + workflowFile + ": must define jobs");
    } catch (error) {
      check(false, ".github/workflows/" + workflowFile + ": invalid YAML (" + error.message + ")");
    }
  }
}

if (failures.length === 0) {
  console.log("dsh-rea: " + checked + " checks passed");
  process.exit(0);
}
console.error("dsh-rea: " + failures.length + " of " + checked + " checks failed");
for (const failure of failures) console.error("  - " + failure);
process.exit(1);