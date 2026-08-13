import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadDdContext } from "./data-download-context";
import { collectDdExternalSensitiveValues, collectDdSensitiveValues, scanVersionableTargets } from "./data-download-core";
import { validateDd2 } from "./data-download-dd2";

const { root, loaded, external, dd2: dataset } = loadDdContext();
const validation = validateDd2(dataset);
const targets = [
    { name: "database-data-download-captures/data-download-dd2-contracts.json", text: `${JSON.stringify(dataset, null, 2)}\n` },
    { name: "database-data-download-captures/data-download-dd2-validation.json", text: `${JSON.stringify(validation, null, 2)}\n` },
];
const sensitiveValues = collectDdSensitiveValues(loaded); for (const value of collectDdExternalSensitiveValues(external)) sensitiveValues.add(value);
const secretScan = scanVersionableTargets(sensitiveValues, targets);
if (!validation.valid || !secretScan.valid) throw new Error("DD2 validation rejected the sanitized artifact");
const output = resolve(root, "data/database-data-download-captures/dd2");
mkdirSync(output, { recursive: true });
for (const target of targets) writeFileSync(resolve(output, target.name.split("/").at(-1)!), target.text);
writeFileSync(resolve(output, "data-download-dd2-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
