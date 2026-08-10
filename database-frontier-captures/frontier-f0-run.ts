import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { readValidatedCaptureSnapshot } from "../database-server-captures/capture-h0-audit";
import { buildFrontierF0, validateFrontierF0 } from "./frontier-f0-audit";
import { FrontierF0SourceLock } from "./frontier-f0-contract";

const root = resolve(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("Frontier F0 requires a Node heap below 1 GiB");
const lock = JSON.parse(readFileSync(resolve(root, "database-frontier-captures/frontier-f0-source-lock.json"), "utf8")) as FrontierF0SourceLock;
const captureRoot = "D:\\Dokkan\\har logs\\08-10", snapshot = readValidatedCaptureSnapshot(captureRoot, lock.fileName, lock.captureId), dataset = buildFrontierF0(snapshot.text, lock), validation = validateFrontierF0(dataset, lock);
const out = resolve(root, "data/database-frontier-captures/f0"); mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, "frontier-f0-inventory.json"), `${JSON.stringify(dataset, null, 2)}\n`); writeFileSync(resolve(out, "frontier-f0-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
