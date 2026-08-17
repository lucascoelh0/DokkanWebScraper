import { createHash } from "crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { relative, resolve } from "path";
import { getHeapStatistics } from "v8";
import { buildWt0, makeExternalSourceLock, validateWt0 } from "./wt0-audit";
import { readWtExternalSource } from "./wt-source-boundary";

function arg(name: string): string { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`WT0 requires ${name}`); return process.argv[index + 1]; }
function hash(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
const root = realpathSync(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("WT0 requires a Node heap below 1 GiB");
const source = readWtExternalSource(root, arg("--source-root"), arg("--source-relative-path")), externalLockPath = resolve(arg("--external-lock"));
const lockRelative = relative(root, externalLockPath).replace(/\\/g, "/"); if (!lockRelative.startsWith(".agent-logs/") && !lockRelative.startsWith("../")) throw new Error("WT0 source lock must remain external or ignored");
const harText = source.text;
const lock = makeExternalSourceLock(harText); mkdirSync(resolve(externalLockPath, ".."), { recursive: true }); writeFileSync(externalLockPath, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" });
if (lock.sourceId !== source.identity.sourceId || lock.sizeBytes !== source.identity.sizeBytes || lock.sha256 !== source.identity.sha256) throw new Error("WT0 sanitized source identity mismatch");
const dataset = buildWt0(harText, lock), validation = validateWt0(dataset, lock), output = resolve(root, "data/database-world-tournament-captures/wt0"), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
mkdirSync(output, { recursive: true }); const payloadPath = resolve(output, "wt0-inventory.json"), validationPath = resolve(output, "wt0-validation.json"); writeFileSync(payloadPath, payload); writeFileSync(validationPath, validationText); if (hash(readFileSync(payloadPath)) !== hash(payload) || hash(readFileSync(validationPath)) !== hash(validationText)) throw new Error("WT0 post-write identity mismatch"); const members = [{ fileName: "wt0-inventory.json", sizeBytes: Buffer.byteLength(payload), sha256: hash(payload) }, { fileName: "wt0-validation.json", sizeBytes: Buffer.byteLength(validationText), sha256: hash(validationText) }]; writeFileSync(resolve(output, "wt0-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members }, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
