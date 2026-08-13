import { loadDdContext } from "./data-download-context";
import { collectDdExternalSensitiveValues, collectDdSensitiveValues, scanVersionableTargets, stagedDdVersionableTargets } from "./data-download-core";

const { loaded, external } = loadDdContext();
const sensitive = collectDdSensitiveValues(loaded);
for (const value of collectDdExternalSensitiveValues(external)) sensitive.add(value);
const result = scanVersionableTargets(sensitive, stagedDdVersionableTargets());
if (!result.valid) throw new Error(`DD staged secret scan rejected ${result.failingTargetCount} target(s)`);
process.stdout.write(`${JSON.stringify(result)}\n`);
