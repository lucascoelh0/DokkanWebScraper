import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { readValidatedCaptureSnapshot } from "../database-server-captures/capture-h0-audit";
import { FrontierF2Dataset } from "./frontier-f2-contract";
import { buildFrontierF3, validateFrontierF3 } from "./frontier-f3-catalog";
const root = resolve(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("Frontier F3 requires a Node heap below 1 GiB"); const sourceLock = JSON.parse(readFileSync(resolve(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")), harText = readValidatedCaptureSnapshot("D:\\Dokkan\\har logs\\08-10", sourceLock.fileName, sourceLock.captureId).text, f2Text = readFileSync(resolve(root, "data/database-frontier-captures/f2/frontier-f2-sanitized-shapes.json"), "utf8"), f2 = JSON.parse(f2Text) as FrontierF2Dataset, dataset = buildFrontierF3(harText, f2, f2Text), validation = validateFrontierF3(dataset, f2, f2Text), out = resolve(root, "data/database-frontier-captures/f3"); mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, "frontier-f3-catalog.json"), `${JSON.stringify(dataset, null, 2)}\n`); writeFileSync(resolve(out, "frontier-f3-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
