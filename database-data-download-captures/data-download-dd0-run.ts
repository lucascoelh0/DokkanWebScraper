import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadDdContext } from "./data-download-context";
import { collectDdExternalSensitiveValues, collectDdSensitiveValues, scanVersionableTargets } from "./data-download-core";

const { root, loaded, external, dd0: dataset } = loadDdContext();
const text = `${JSON.stringify(dataset, null, 2)}\n`;
const sensitiveValues = collectDdSensitiveValues(loaded); for (const value of collectDdExternalSensitiveValues(external)) sensitiveValues.add(value);
const secretScan = scanVersionableTargets(sensitiveValues, [{ name: "database-data-download-captures/data-download-dd0-source-audit.json", text }]);
if (!secretScan.valid) throw new Error("DD0 captured-value scan rejected the sanitized artifact");
const output = resolve(root, "data/database-data-download-captures/dd0");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "data-download-dd0-source-audit.json"), text);
writeFileSync(resolve(output, "data-download-dd0-secret-validation.json"), `${JSON.stringify(secretScan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ valid: true, sources: dataset.sources.length, targetCount: secretScan.targetCount })}\n`);
