import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { readValidatedCaptureSnapshot } from "../database-server-captures/capture-h0-audit";
import { buildSpecialM0, validateSpecialM0 } from "./special-m0-audit";
import { SpecialM0SourceLock } from "./special-m0-contract";

const root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("M0 requires a Node heap below 1 GiB");
const lock = JSON.parse(readFileSync(resolve(root, "database-special-modes-captures/special-m0-source-lock.json"), "utf8")) as SpecialM0SourceLock;
const captureRoot = "D:\\Dokkan\\har logs\\08-10";
const inputs = lock.captures.map(item => ({ lock: item, text: readValidatedCaptureSnapshot(captureRoot, item.fileName, item.captureId).text }));
const dataset = buildSpecialM0(inputs, lock), validation = validateSpecialM0(dataset, lock), text = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
const manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m0-inventory.json", sizeBytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex") };
const out = resolve(root, "data/database-special-modes-captures/m0"); mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, manifest.fileName), text); writeFileSync(resolve(out, "special-m0-validation.json"), validationText); writeFileSync(resolve(out, "special-m0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
