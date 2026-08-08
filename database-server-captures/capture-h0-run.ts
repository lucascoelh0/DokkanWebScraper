import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { auditCaptureManifest } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";

const repositoryRoot = resolve(process.cwd());
const packageMetadata = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
if (packageMetadata?.name !== "dokkan-web-scraper") throw new Error("capture audit must run from the repository root");
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("capture audit requires a Node heap limit below 1 GiB");
const manifestPath = resolve(repositoryRoot, "database-server-captures", "capture-input-manifest.json");
const outputDirectory = resolve(repositoryRoot, "data", "database-server-captures", "h0");
const outputPath = resolve(outputDirectory, "capture-h0-inventory.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CaptureInputManifest;
const dataset = auditCaptureManifest(manifest, { "dokkan-local-captures": "D:\\Dokkan" });
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: "utf8", flag: "w" });
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, captureCount: dataset.captures.length, targetEntryCount: dataset.captures.reduce((sum, value) => sum + value.targetEntryCount, 0), duplicateGroupCount: dataset.duplicateGroups.length })}\n`);
