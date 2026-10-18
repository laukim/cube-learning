import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "fixtures/acubemy/sample-details.json");
const script = join(root, "scripts/import-acubemy-solves.mjs");

const run = spawnSync(process.execPath, [script, fixture], { encoding: "utf8" });
if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  process.exit(run.status || 1);
}
const report = JSON.parse(run.stdout);
if (report.valid !== 2) throw new Error(`expected 2 valid, got ${report.valid}`);
if (!report.sample[0].id.startsWith("acubemy-")) throw new Error("id prefix missing");
if (!report.sample[0].splits?.cross) throw new Error("splits missing");
console.log("acubemy import dry-run ok", report.valid);
