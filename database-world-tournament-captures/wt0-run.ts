import { createHash } from "crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "fs";
import { isAbsolute, relative, resolve } from "path";
import { getHeapStatistics } from "v8";
import { assertExternalHarPath, buildWt0, makeExternalSourceLock, validateWt0 } from "./wt0-audit";

function arg(name: string): string { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`WT0 requires ${name}`); return process.argv[index + 1]; }
function hash(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
const root = realpathSync(process.cwd()); if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("WT0 requires a Node heap below 1 GiB");
const sourceArgument = resolve(arg("--source")); if (lstatSync(sourceArgument).isSymbolicLink()) throw new Error("WT0 source boundary"); const sourcePath = realpathSync(sourceArgument), externalLockPath = resolve(arg("--external-lock"));
assertExternalHarPath(root, sourcePath); if (!isAbsolute(sourcePath) || statSync(sourcePath).size > 64 * 1024 * 1024) throw new Error("WT0 source boundary");
const lockRelative = relative(root, externalLockPath).replace(/\\/g, "/"); if (!lockRelative.startsWith(".agent-logs/") && !lockRelative.startsWith("../")) throw new Error("WT0 source lock must remain external or ignored");
const before = statSync(sourcePath), harText = readFileSync(sourcePath, "utf8"), after = statSync(sourcePath); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("WT0 source changed during read");
const lock = makeExternalSourceLock(harText); mkdirSync(resolve(externalLockPath, ".."), { recursive: true }); writeFileSync(externalLockPath, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" });
const dataset = buildWt0(harText, lock), validation = validateWt0(dataset, lock), output = resolve(root, "data/database-world-tournament-captures/wt0"), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
mkdirSync(output, { recursive: true }); const payloadPath = resolve(output, "wt0-inventory.json"), validationPath = resolve(output, "wt0-validation.json"); writeFileSync(payloadPath, payload); writeFileSync(validationPath, validationText); if (hash(readFileSync(payloadPath)) !== hash(payload) || hash(readFileSync(validationPath)) !== hash(validationText)) throw new Error("WT0 post-write identity mismatch"); const members = [{ fileName: "wt0-inventory.json", sizeBytes: Buffer.byteLength(payload), sha256: hash(payload) }, { fileName: "wt0-validation.json", sizeBytes: Buffer.byteLength(validationText), sha256: hash(validationText) }]; writeFileSync(resolve(output, "wt0-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members }, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
