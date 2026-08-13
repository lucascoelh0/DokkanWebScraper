import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadDdContext } from "./data-download-context";
import { collectDdExternalSensitiveValues, collectDdSensitiveValues, scanVersionableTargets } from "./data-download-core";
import { validateDd1 } from "./data-download-dd1";

const { root, lock, loaded, external, dd1: dataset } = loadDdContext();
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
