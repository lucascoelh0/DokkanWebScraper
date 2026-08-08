import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { CaptureH0Dataset, CaptureInputManifest } from "./capture-h0-contract";
import { buildCaptureH6, validateCaptureH6 } from "./capture-h6-assets";
import { collectCaptureSensitiveValues, scanTextsForSecrets } from "./capture-secret-scan";

const repositoryRoot = resolve(process.cwd());
if (JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"))?.name !== "dokkan-web-scraper") throw new Error("H6 must run from the repository root");
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("H6 requires a Node heap below 1 GiB");
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "database-server-captures", "capture-input-manifest.json"), "utf8")) as CaptureInputManifest;
const h0 = JSON.parse(readFileSync(resolve(repositoryRoot, "data", "database-server-captures", "h0", "capture-h0-inventory.json"), "utf8")) as CaptureH0Dataset;
const roots = { "dokkan-local-captures": "D:\\Dokkan" };
const dataset = buildCaptureH6(manifest, roots, h0), validation = validateCaptureH6(dataset, h0), outputText = `${JSON.stringify(dataset, null, 2)}\n`;
const scan = scanTextsForSecrets(collectCaptureSensitiveValues(manifest, roots), [{ name: "capture-h6-assets.json", text: outputText }]);
if (!scan.valid) throw new Error(`H6 secret scan failed for ${scan.failingTargets.length} target(s)`);
const outputDirectory = resolve(repositoryRoot, "data", "database-server-captures", "h6"); mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, "capture-h6-assets.json"), outputText); writeFileSync(resolve(outputDirectory, "capture-h6-validation.json"), `${JSON.stringify(validation, null, 2)}\n`); writeFileSync(resolve(outputDirectory, "capture-h6-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: dataset.contract, contractVersion: dataset.contractVersion, observationCount: validation.observationCount, databaseDescriptorCount: validation.databaseDescriptorCount, referenceCount: validation.referenceCount, capturedCdnRequestCount: validation.capturedCdnRequestCount, exactReferenceWithCaptured2xxPathCount: validation.exactReferenceWithCaptured2xxPathCount, exactReferenceWithCaptured304PathCount: validation.exactReferenceWithCaptured304PathCount, userDerivedAuthorityCount: validation.userDerivedAuthorityCount, secretScanValid: scan.valid })}\n`);
