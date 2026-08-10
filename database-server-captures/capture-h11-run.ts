import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { CaptureInputManifest } from "./capture-h0-contract";
import { CaptureH3Dataset } from "./capture-h3-contract";
import { CaptureH4Dataset } from "./capture-h4-contract";
import { CaptureH5Dataset } from "./capture-h5-contract";
import { CaptureH6Dataset } from "./capture-h6-contract";
import { CaptureH7Dataset } from "./capture-h7-contract";
import { validateCaptureH7 } from "./capture-h7-shadow-readiness";
import { CaptureH8Dataset } from "./capture-h8-contract";
import { CaptureH10Dataset } from "./capture-h10-contract";
import { buildCaptureH11, validateCaptureH11 } from "./capture-h11-parity";
import { collectCaptureSensitiveValues, scanTextsForSecrets } from "./capture-secret-scan";

const root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("H11 requires a Node heap below 1 GiB");
const read = <T>(path: string): { text: string; value: T } => { const text = readFileSync(resolve(root, path), "utf8"); return { text, value: JSON.parse(text) as T }; };
const lock = read<any>("database-server-captures/capture-h11-source-lock.json");
const expectedLockPaths: Record<string, string> = { h7: "data/database-server-captures/h7/capture-h7-shadow-readiness.json", h8: "data/database-server-captures/h8/capture-h8-inventory.json", h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json", h10: "data/database-server-captures/h10/capture-h10-domains.json" };
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h11-source-lock" || lock.value.contractVersion !== "0.12.0" || JSON.stringify(lock.value.artifacts.map((value: any) => value.key).sort()) !== JSON.stringify(Object.keys(expectedLockPaths).sort())) throw new Error("invalid H11 source lock contract");
for (const artifact of lock.value.artifacts) {
    if (artifact.path !== expectedLockPaths[artifact.key] || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`invalid H11 source lock entry: ${artifact.key}`);
    const file = read<any>(artifact.path);
    if (Buffer.byteLength(file.text) !== artifact.sizeBytes || createHash("sha256").update(file.text).digest("hex") !== artifact.sha256) throw new Error(`H11 source lock mismatch: ${artifact.key}`);
}
const h7 = read<CaptureH7Dataset>("data/database-server-captures/h7/capture-h7-shadow-readiness.json").value;
const h8 = read<CaptureH8Dataset>("data/database-server-captures/h8/capture-h8-inventory.json").value;
const h10 = read<CaptureH10Dataset>("data/database-server-captures/h10/capture-h10-domains.json").value;
const h3 = read<CaptureH3Dataset>("data/database-server-captures/h3/capture-h3-schedules.json").value;
const h4 = read<CaptureH4Dataset>("data/database-server-captures/h4/capture-h4-gashas.json").value;
const h5 = read<CaptureH5Dataset>("data/database-server-captures/h5/capture-h5-mission-boards.json").value;
const h6 = read<CaptureH6Dataset>("data/database-server-captures/h6/capture-h6-assets.json").value;
if (!validateCaptureH7(h7).valid) throw new Error("H11 requires a valid H7 checkpoint");
for (const [key, path] of [["h3", "data/database-server-captures/h3/capture-h3-schedules.json"], ["h4", "data/database-server-captures/h4/capture-h4-gashas.json"], ["h5", "data/database-server-captures/h5/capture-h5-mission-boards.json"], ["h6", "data/database-server-captures/h6/capture-h6-assets.json"]] as const) {
    const file = read<any>(path), lineage = h7.sourceLineage.find(value => value.key === key);
    if (!lineage || lineage.artifactPath !== path || lineage.artifactSizeBytes !== Buffer.byteLength(file.text) || lineage.artifactSha256 !== createHash("sha256").update(file.text).digest("hex")) throw new Error(`H11 H7 lineage mismatch: ${key}`);
}
const dataset = buildCaptureH11(lock.text, h7, h10, h3, h4, h5, h6, h8.captures.map(value => value.captureId));
const validation = validateCaptureH11(dataset);
const text = `${JSON.stringify(dataset, null, 2)}\n`;
const manifest = read<CaptureInputManifest>("database-server-captures/capture-h8-input-manifest.json").value;
const roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const scan = scanTextsForSecrets(collectCaptureSensitiveValues(manifest, roots), [{ name: "capture-h11-shadow-parity.json", text }]);
if (!scan.valid) throw new Error("H11 secret scan failed");
const output = resolve(root, "data/database-server-captures/h11");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "capture-h11-shadow-parity.json"), text);
writeFileSync(resolve(output, "capture-h11-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
writeFileSync(resolve(output, "capture-h11-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, secretScanValid: scan.valid })}\n`);
