import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureH0Dataset, CaptureInputManifest } from "./capture-h0-contract";
import { validateCaptureH4 } from "./capture-h4-gashas";
import { CaptureH4Dataset } from "./capture-h4-contract";
import { validateCaptureH8 } from "./capture-h8-audit";
import { CaptureH8Dataset } from "./capture-h8-contract";
import { validateCaptureH9 } from "./capture-h9-schemas";
import { CaptureH9Dataset } from "./capture-h9-contract";
import { validateCaptureH10 } from "./capture-h10-domains";
import { CaptureH10Dataset } from "./capture-h10-contract";
import { buildCaptureH13, validateCaptureH13 } from "./capture-h13-gasha-audit";
import { collectCaptureSensitiveValues, scanTextsForSecrets } from "./capture-secret-scan";

const root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("H13 requires a Node heap below 1 GiB");
const read = <T>(path: string): { text: string; value: T } => { const text = readFileSync(resolve(root, path), "utf8"); return { text, value: JSON.parse(text) as T }; };
const lock = read<any>("database-server-captures/capture-h13-source-lock.json");
const expectedPaths: Record<string, string> = {
    h0_manifest: "database-server-captures/capture-input-manifest.json",
    h8_manifest: "database-server-captures/capture-h8-input-manifest.json",
    h0: "data/database-server-captures/h0/capture-h0-inventory.json",
    h4: "data/database-server-captures/h4/capture-h4-gashas.json",
    h8: "data/database-server-captures/h8/capture-h8-inventory.json",
    h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json",
    h10: "data/database-server-captures/h10/capture-h10-domains.json",
};
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h13-source-lock" || lock.value.contractVersion !== "0.14.0" || JSON.stringify(lock.value.artifacts.map((value: any) => value.key).sort()) !== JSON.stringify(Object.keys(expectedPaths).sort())) throw new Error("invalid H13 source lock contract");
const files = new Map<string, { text: string; value: any }>();
for (const artifact of lock.value.artifacts) {
    if (artifact.path !== expectedPaths[artifact.key] || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`invalid H13 source lock entry: ${artifact.key}`);
    const file = read<any>(artifact.path);
    if (Buffer.byteLength(file.text) !== artifact.sizeBytes || createHash("sha256").update(file.text).digest("hex") !== artifact.sha256) throw new Error(`H13 source lock mismatch: ${artifact.key}`);
    files.set(artifact.key, file);
}
const h0Manifest = files.get("h0_manifest")!.value as CaptureInputManifest;
const h8Manifest = files.get("h8_manifest")!.value as CaptureInputManifest;
const h0 = files.get("h0")!.value as CaptureH0Dataset;
const h4 = files.get("h4")!.value as CaptureH4Dataset;
const h8 = files.get("h8")!.value as CaptureH8Dataset;
const h9 = files.get("h9")!.value as CaptureH9Dataset;
const h10 = files.get("h10")!.value as CaptureH10Dataset;
const roots = { "dokkan-local-captures": "D:\\Dokkan", "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
if (JSON.stringify(auditCaptureManifest(h0Manifest, roots)) !== JSON.stringify(h0)) throw new Error("H13 H0 validation failed");
if (!validateCaptureH4(h4, h0).valid || !validateCaptureH8(h8, h8Manifest, roots).valid || !validateCaptureH9(h9, h8Manifest, roots, h8, files.get("h8")!.text).valid || !validateCaptureH10(h10, h8Manifest, roots, h9, files.get("h9")!.text).valid) throw new Error("H13 upstream validation failed");
const dataset = buildCaptureH13(lock.text, h0Manifest, h8Manifest, roots, h0, h4, h8, h10);
const validation = validateCaptureH13(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`;
const secrets = collectCaptureSensitiveValues(h0Manifest, roots);
for (const value of collectCaptureSensitiveValues(h8Manifest, roots)) secrets.add(value);
const scan = scanTextsForSecrets(secrets, [{ name: "capture-h13-gasha-audit.json", text }]);
if (!scan.valid) throw new Error("H13 secret scan failed");
const output = resolve(root, "data/database-server-captures/h13"); mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "capture-h13-gasha-audit.json"), text);
writeFileSync(resolve(output, "capture-h13-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
writeFileSync(resolve(output, "capture-h13-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, legacyNonExclusiveConflictCellCount: dataset.legacyNonExclusiveConflictCellCount, secretScanValid: scan.valid })}\n`);
