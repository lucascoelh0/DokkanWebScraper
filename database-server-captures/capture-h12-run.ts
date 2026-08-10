import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { CaptureInputManifest } from "./capture-h0-contract";
import { CaptureH8Dataset } from "./capture-h8-contract";
import { CaptureH9Dataset } from "./capture-h9-contract";
import { CaptureH10Dataset } from "./capture-h10-contract";
import { CaptureH11Dataset } from "./capture-h11-contract";
import { validateCaptureH11 } from "./capture-h11-parity";
import { CaptureH13Dataset } from "./capture-h13-contract";
import { validateCaptureH13 } from "./capture-h13-gasha-audit";
import { buildCaptureH12, validateCaptureH12 } from "./capture-h12-readiness";
import { collectCaptureSensitiveValues, scanTextsForSecrets } from "./capture-secret-scan";

const root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("H12 requires a Node heap below 1 GiB");
const read = <T>(path: string): { text: string; value: T } => { const text = readFileSync(resolve(root, path), "utf8"); return { text, value: JSON.parse(text) as T }; };
const lock = read<any>("database-server-captures/capture-h12-source-lock.json");
const expectedPaths: Record<string, string> = { h8: "data/database-server-captures/h8/capture-h8-inventory.json", h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json", h10: "data/database-server-captures/h10/capture-h10-domains.json", h11: "data/database-server-captures/h11/capture-h11-shadow-parity.json", h13: "data/database-server-captures/h13/capture-h13-gasha-audit.json" };
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h12-source-lock" || lock.value.contractVersion !== "0.13.1" || JSON.stringify(lock.value.artifacts.map((value: any) => value.key).sort()) !== JSON.stringify(Object.keys(expectedPaths).sort())) throw new Error("H12 source lock contract mismatch");
const files = new Map<string, { text: string; value: any; sha256: string; sizeBytes: number }>();
for (const artifact of lock.value.artifacts) {
    const file = read<any>(artifact.path), sha256 = createHash("sha256").update(file.text).digest("hex"), sizeBytes = Buffer.byteLength(file.text);
    if (artifact.path !== expectedPaths[artifact.key] || artifact.sha256 !== sha256 || artifact.sizeBytes !== sizeBytes) throw new Error(`H12 source lock mismatch: ${artifact.key}`);
    files.set(artifact.key, { ...file, sha256, sizeBytes });
}
const h8 = files.get("h8")!.value as CaptureH8Dataset, h9 = files.get("h9")!.value as CaptureH9Dataset, h10 = files.get("h10")!.value as CaptureH10Dataset, h11 = files.get("h11")!.value as CaptureH11Dataset, h13 = files.get("h13")!.value as CaptureH13Dataset;
if (!validateCaptureH11(h11).valid || !validateCaptureH13(h13).valid) throw new Error("H12 requires valid H11 and H13");
const sourceLockSha256 = createHash("sha256").update(lock.text).digest("hex"), h11File = files.get("h11")!, h13File = files.get("h13")!;
const dataset = buildCaptureH12(h8, h9, h10, h11, h13, sourceLockSha256, h11File.sha256, h11File.sizeBytes, h13File.sha256, h13File.sizeBytes), validation = validateCaptureH12(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`;
const manifest = read<CaptureInputManifest>("database-server-captures/capture-h8-input-manifest.json").value, roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const scan = scanTextsForSecrets(collectCaptureSensitiveValues(manifest, roots), [{ name: "capture-h12-readiness.json", text }]);
if (!scan.valid) throw new Error("H12 secret scan failed");
const output = resolve(root, "data/database-server-captures/h12"); mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "capture-h12-readiness.json"), text); writeFileSync(resolve(output, "capture-h12-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); writeFileSync(resolve(output, "capture-h12-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, decisions: Object.fromEntries(dataset.decisions.map(value => [value.key, value.status])), secretScanValid: scan.valid })}\n`);
