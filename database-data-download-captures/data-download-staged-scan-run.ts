import { getHeapStatistics } from "v8";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Dd0SourceLock } from "./data-download-contract";
import { collectDdExternalSensitiveValues, collectDdSensitiveValues, loadDdCaptures, loadDdExternalSources, scanVersionableTargets, stagedDdVersionableTargets } from "./data-download-core";

if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("DD staged scan requires a Node heap below 1 GiB");
const root = resolve(process.cwd());
const lock = JSON.parse(readFileSync(resolve(root, "database-data-download-captures/data-download-source-lock.json"), "utf8")) as Dd0SourceLock;
const loaded = loadDdCaptures("D:\\Dokkan\\har logs\\08-10", lock);
const external = loadDdExternalSources("D:\\Dokkan\\har logs\\08-10", lock);
const sensitive = collectDdSensitiveValues(loaded);
for (const value of collectDdExternalSensitiveValues(external)) sensitive.add(value);
const result = scanVersionableTargets(sensitive, stagedDdVersionableTargets());
if (!result.valid) throw new Error(`DD staged secret scan rejected ${result.failingTargetCount} target(s)`);
process.stdout.write(`${JSON.stringify(result)}\n`);
