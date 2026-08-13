import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { Dd0SourceLock } from "./data-download-contract";
import { buildDd0, collectDdExternalSensitiveValues, collectDdSensitiveValues, loadDdCaptures, loadDdExternalSources, scanVersionableTargets } from "./data-download-core";
import { buildDd1, validateDd1 } from "./data-download-dd1";

if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("DD1 requires a Node heap below 1 GiB");
const root = resolve(process.cwd());
const lock = JSON.parse(readFileSync(resolve(root, "database-data-download-captures/data-download-source-lock.json"), "utf8")) as Dd0SourceLock;
const loaded = loadDdCaptures("D:\\Dokkan\\har logs\\08-10", lock);
const external = loadDdExternalSources("D:\\Dokkan\\har logs\\08-10", lock);
const dataset = buildDd1(loaded, lock, buildDd0(lock, loaded, external));
const validation = validateDd1(dataset, lock);
const targets = [
    { name: "database-data-download-captures/data-download-dd1-inventory.json", text: `${JSON.stringify(dataset, null, 2)}\n` },
    { name: "database-data-download-captures/data-download-dd1-validation.json", text: `${JSON.stringify(validation, null, 2)}\n` },
];
const sensitiveValues = collectDdSensitiveValues(loaded); for (const value of collectDdExternalSensitiveValues(external)) sensitiveValues.add(value);
const secretScan = scanVersionableTargets(sensitiveValues, targets);
if (!validation.valid || !secretScan.valid) throw new Error("DD1 validation rejected the sanitized artifact");
const output = resolve(root, "data/database-data-download-captures/dd1");
mkdirSync(output, { recursive: true });
for (const target of targets) writeFileSync(resolve(output, target.name.split("/").at(-1)!), target.text);
writeFileSync(resolve(output, "data-download-dd1-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
