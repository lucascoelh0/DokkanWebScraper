import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { readValidatedCaptureSnapshot } from "../database-server-captures/capture-h0-audit";
import { FrontierF1Dataset } from "./frontier-f1-contract";
import { buildFrontierF2, validateFrontierF2 } from "./frontier-f2-shapes";
const root = resolve(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("Frontier F2 requires a Node heap below 1 GiB"); const sourceLock = JSON.parse(readFileSync(resolve(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")), harText = readValidatedCaptureSnapshot("D:\\Dokkan\\har logs\\08-10", sourceLock.fileName, sourceLock.captureId).text, f1Text = readFileSync(resolve(root, "data/database-frontier-captures/f1/frontier-f1-zstd-audit.json"), "utf8"), f1 = JSON.parse(f1Text) as FrontierF1Dataset, dataset = buildFrontierF2(harText, f1, f1Text), validation = validateFrontierF2(dataset, f1, f1Text), out = resolve(root, "data/database-frontier-captures/f2"); mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, "frontier-f2-sanitized-shapes.json"), `${JSON.stringify(dataset, null, 2)}\n`); writeFileSync(resolve(out, "frontier-f2-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
