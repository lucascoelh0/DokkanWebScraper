"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt_campaign_scanner_1 = require("./wt-campaign-scanner");
const wt6_contract_1 = require("./wt6-contract");
const wt6_readiness_1 = require("./wt6-readiness");
const wt_source_boundary_1 = require("./wt-source-boundary");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), root = (0, fs_1.realpathSync)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT6 heap boundary");
function arg(name) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1])
    throw new Error(`WT6 requires ${name}`); return process.argv[index + 1]; }
const sourceRootArgument = arg("--source-root"), sourceRelativePath = arg("--source-relative-path"), auditBase = arg("--audit-base"), auditTip = arg("--audit-tip"), initialSource = (0, wt_source_boundary_1.readWtExternalSource)(root, sourceRootArgument, sourceRelativePath);
const expected = new Map([[0, ["wt0-inventory.json", "wt0-manifest.json", "wt0-validation.json"]], [1, ["wt1-manifest.json", "wt1-route-catalog.json", "wt1-validation.json"]], [2, ["wt2-event-entry-ranks.json", "wt2-manifest.json", "wt2-validation.json"]], [3, ["wt3-manifest.json", "wt3-rankings-box-schedules.json", "wt3-validation.json"]], [4, ["wt4-briefing-missions-start.json", "wt4-manifest.json", "wt4-validation.json"]], [5, ["wt5-manifest.json", "wt5-shadow-parity.json", "wt5-validation.json"]]]);
function runGate(gate) {
    const args = ["--max-old-space-size=576", (0, path_1.resolve)(root, `lib/database-world-tournament-captures/wt${gate}-run.js`)];
    if (gate === 0) {
        const lockDirectory = (0, path_1.resolve)(root, ".agent-logs/world-tournament");
        (0, fs_1.mkdirSync)(lockDirectory, { recursive: true });
        args.push("--source-root", sourceRootArgument, "--source-relative-path", sourceRelativePath, "--external-lock", (0, path_1.resolve)(lockDirectory, `wt6-double-${(0, crypto_1.randomUUID)()}.json`));
    }
    (0, child_process_1.execFileSync)(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 30000, windowsHide: true });
}
function artifacts() {
    const rows = [];
    for (let gate = 0; gate <= 5; gate++) {
        const directory = (0, path_1.resolve)(root, `data/database-world-tournament-captures/wt${gate}`), names = (0, fs_1.readdirSync)(directory).filter(name => (0, fs_1.statSync)((0, path_1.resolve)(directory, name)).isFile()).sort();
        if (JSON.stringify(names) !== JSON.stringify(expected.get(gate)))
            throw new Error(`WT6 unexpected WT${gate} artifact set`);
        const manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(directory, `wt${gate}-manifest.json`), "utf8")), validation = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(directory, `wt${gate}-validation.json`), "utf8"));
        if (validation.valid !== true)
            throw new Error(`WT6 WT${gate} not green`);
        for (const name of names) {
            const bytes = (0, fs_1.readFileSync)((0, path_1.resolve)(directory, name)), member = manifest.members?.find((value) => value.fileName === name);
            if (name !== `wt${gate}-manifest.json` && (!member || member.sizeBytes !== bytes.length || member.sha256 !== sha256(bytes)))
                throw new Error(`WT6 WT${gate} manifest mismatch`);
            rows.push({ gate: `WT${gate}`, fileName: name, sizeBytes: bytes.length, sha256: sha256(bytes) });
        }
    }
    return rows;
}
let first = [];
for (let pass = 0; pass < 2; pass++) {
    for (let gate = 0; gate <= 5; gate++)
        runGate(gate);
    const current = artifacts();
    if (pass === 0)
        first = current;
    else if (JSON.stringify(first) !== JSON.stringify(current))
        throw new Error("WT6 double generation mismatch");
}
const lineage = first, aggregateSha256 = sha256(lineage.map(value => `${value.gate}/${value.fileName}\0${value.sizeBytes}\0${value.sha256}\n`).join("")), finalSource = (0, wt_source_boundary_1.readWtExternalSource)(root, sourceRootArgument, sourceRelativePath), harText = finalSource.text;
if (JSON.stringify(initialSource.identity) !== JSON.stringify(finalSource.identity))
    throw new Error("WT6 source changed during campaign");
const wt0 = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-world-tournament-captures/wt0/wt0-inventory.json"), "utf8"));
if (wt0.source.sha256 !== sha256(harText) || wt0.source.sizeBytes !== Buffer.byteLength(harText))
    throw new Error("WT6 source lineage mismatch");
const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(harText), gitTargets = (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, auditBase, auditTip), auditScan = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, gitTargets, { allowedHistoricalHarTargetFingerprints: wt6_contract_1.WT6_ALLOWED_HISTORICAL_HAR_TARGET_FINGERPRINTS });
if (!auditScan.valid)
    throw new Error(`WT6 historical scanner failed: matches=${auditScan.sensitiveMatchCount}, rawHar=${auditScan.rawHarTargetCount}, targets=${auditScan.targetCount}`);
function implementationFiles(directory, include) { const rows = []; for (const name of (0, fs_1.readdirSync)(directory).sort()) {
    const path = (0, path_1.resolve)(directory, name), info = (0, fs_1.statSync)(path);
    if (info.isDirectory())
        rows.push(...implementationFiles(path, include));
    else if (include(name))
        rows.push({ name: (0, path_1.relative)(root, path).replace(/\\/g, "/"), text: (0, fs_1.readFileSync)(path, "utf8") });
} return rows; }
const implementationInputs = [...implementationFiles((0, path_1.resolve)(root, "lib/database-world-tournament-captures"), name => name.endsWith(".js") && !name.endsWith(".spec.js")), ...implementationFiles((0, path_1.resolve)(root, "database-world-tournament-captures"), name => name === "wt5-sqlite-readonly-bridge.py")].sort((left, right) => left.name.localeCompare(right.name)), implementationAggregateSha256 = sha256(implementationInputs.map(value => `${value.name}\0${Buffer.byteLength(value.text)}\0${sha256(value.text)}\n`).join(""));
const memory = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-world-tournament-captures/wt6-memory-evidence.json"), "utf8"));
if (memory.sourceSha256 !== wt0.source.sha256 || memory.artifactAggregateSha256 !== aggregateSha256 || memory.implementationAggregateSha256 !== implementationAggregateSha256)
    throw new Error("WT6 memory evidence lineage mismatch");
const source = { sourceId: wt0.source.sourceId, sizeBytes: wt0.source.sizeBytes, sha256: wt0.source.sha256, entryCount: wt0.source.entryCount }, security = { commitCount: gitTargets.commitCount, targetCount: auditScan.targetCount, uniqueBlobCount: auditScan.uniqueBlobCount, categoryTargetCounts: { tip: auditScan.categoryTargetCounts.tip, history_old: auditScan.categoryTargetCounts.history_old, history_new: auditScan.categoryTargetCounts.history_new }, sensitiveValueCount: catalog.sensitiveValueCount, sourceCategoryValueCounts: catalog.categoryValueCounts, sensitiveMatchCount: 0, harStructureTargetCount: 2, tipHarStructureTargetCount: 0, rawHarTargetCount: 0, historicalHarAllowlistCount: 2, historicalHarAllowlistSatisfied: true, historicalHarTargetFingerprints: [...auditScan.harStructureTargets.map(value => value.fingerprint).sort()], allTrackedTipBlobsExamined: true, allChangedHistoricalBlobsExamined: true, noPathOrDocumentTypeExclusions: true, valid: true, requestReplayImplemented: false, credentialFlowImplemented: false }, member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: sha256(text) });
function generateWt6() {
    const dataset = (0, wt6_readiness_1.buildWt6)(source, lineage, aggregateSha256, implementationAggregateSha256, security, memory), validation = (0, wt6_readiness_1.validateWt6)(dataset), payloadText = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, manifestText = `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt6-readiness.json", payloadText), member("wt6-validation.json", validationText)] }, null, 2)}\n`;
    return { validation, outputs: [["wt6-manifest.json", manifestText], ["wt6-readiness.json", payloadText], ["wt6-validation.json", validationText]] };
}
const out = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt6");
(0, fs_1.mkdirSync)(out, { recursive: true });
function writeGeneration(outputs) { for (const [fileName, text] of outputs)
    (0, fs_1.writeFileSync)((0, path_1.resolve)(out, fileName), text); return outputs.map(([fileName, text]) => { const bytes = (0, fs_1.readFileSync)((0, path_1.resolve)(out, fileName)); if (bytes.length !== Buffer.byteLength(text) || sha256(bytes) !== sha256(text))
    throw new Error("WT6 post-write mismatch"); return `${fileName}\0${bytes.length}\0${sha256(bytes)}`; }); }
const firstGeneration = generateWt6(), firstOutputPass = writeGeneration(firstGeneration.outputs), secondGeneration = generateWt6(), secondOutputPass = writeGeneration(secondGeneration.outputs);
if (JSON.stringify(firstGeneration.outputs) !== JSON.stringify(secondGeneration.outputs) || JSON.stringify(firstOutputPass) !== JSON.stringify(secondOutputPass))
    throw new Error("WT6 own-output double generation mismatch");
process.stdout.write(`${JSON.stringify(secondGeneration.validation)}\n`);
//# sourceMappingURL=wt6-run.js.map