import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH8, validateCaptureH8 } from "./capture-h8-audit";
import { collectCaptureSensitiveValues, scanTextsForSecrets } from "./capture-secret-scan";

const root = resolve(process.cwd());
if (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))?.name !== "dokkan-web-scraper") throw new Error("H8 must run from repository root");
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("H8 requires a Node heap below 1 GiB");
const manifest = JSON.parse(readFileSync(resolve(root, "database-server-captures", "capture-h8-input-manifest.json"), "utf8")) as CaptureInputManifest;
const roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const dataset = buildCaptureH8(manifest, roots), validation = validateCaptureH8(dataset, manifest, roots), text = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = scanTextsForSecrets(collectCaptureSensitiveValues(manifest, roots), [{ name: "capture-h8-inventory.json", text }]); if (!scan.valid) throw new Error("H8 secret scan failed");
const out = resolve(root, "data", "database-server-captures", "h8"); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "capture-h8-inventory.json"), text); writeFileSync(resolve(out, "capture-h8-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); writeFileSync(resolve(out, "capture-h8-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, captureCount: validation.captureCount, entryCount: validation.entryCount, trafficClassCounts: validation.trafficClassCounts, exactDuplicateGroupCount: validation.exactDuplicateGroupCount, secretScanValid: scan.valid })}\n`);
