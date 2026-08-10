import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { FrontierF3Dataset } from "./frontier-f3-contract";
import { FrontierF4Dataset } from "./frontier-f4-contract";
import { FrontierF5SourceLock } from "./frontier-f5-contract";
import { loadFrontierF5Inputs } from "./frontier-f5-inputs";
import { buildFrontierF5, validateFrontierF5 } from "./frontier-f5-parity";
const root = resolve(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("Frontier F5 requires a Node heap below 1 GiB"); const f3Text = readFileSync(resolve(root, "data/database-frontier-captures/f3/frontier-f3-catalog.json"), "utf8"), f3 = JSON.parse(f3Text) as FrontierF3Dataset, f4Text = readFileSync(resolve(root, "data/database-frontier-captures/f4/frontier-f4-observational-protocol.json"), "utf8"), f4 = JSON.parse(f4Text) as FrontierF4Dataset, lock = JSON.parse(readFileSync(resolve(root, "database-frontier-captures/frontier-f5-source-lock.json"), "utf8")) as FrontierF5SourceLock, external = loadFrontierF5Inputs("D:\\Dokkan\\DokkanWebScraper\\data", lock), dataset = buildFrontierF5(f3, f3Text, f4, f4Text, external.inputs, external.lineage), validation = validateFrontierF5(dataset, f3, f3Text, f4, f4Text), out = resolve(root, "data/database-frontier-captures/f5"); mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, "frontier-f5-shadow-parity.json"), `${JSON.stringify(dataset, null, 2)}\n`); writeFileSync(resolve(out, "frontier-f5-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
