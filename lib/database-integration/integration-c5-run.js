"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegrationC5 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const integration_c1_builder_1 = require("./integration-c1-builder");
const integration_c5_builder_1 = require("./integration-c5-builder");
const integration_c2_builder_1 = require("./integration-c2-builder");
const integration_c3_builder_1 = require("./integration-c3-builder");
const integration_c5_evidence_1 = require("./integration-c5-evidence");
const integration_c5_validator_1 = require("./integration-c5-validator");
const DEFAULT_ROOT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment"), sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function json(path) { return JSON.parse(await (0, promises_1.readFile)(path, "utf8")); }
async function verify(root, manifest) { const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(root, manifest.fileName)); if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256)
    throw Error(`C5 artifact identity ${manifest.fileName}`); }
async function verifiedGzip(root, manifest) { const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(root, manifest.fileName)); if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256)
    throw Error(`C5 artifact identity ${manifest.fileName}`); const payload = (0, zlib_1.gunzipSync)(bytes); if (payload.byteLength !== manifest.uncompressedSizeBytes)
    throw Error(`C5 artifact size ${manifest.fileName}`); return JSON.parse(payload.toString("utf8")); }
function render(readiness) {
    const coverage = readiness.evidence.coverage;
    return `# Integration C5 — adoption readiness\n\n## Decision\n\n${readiness.decisions.map(value => `- **${value.stage}: ${value.decision}** — ${value.scope}`).join("\n")}\n\n## Evidence\n\n- audit/supported rules: ${coverage.auditRuleCount}/${coverage.supportedRuleCount}\n- sidecar states: ${coverage.sidecarStateCount}\n- supported/unknown timing: ${coverage.supportedTimingCount}/${coverage.unknownTimingCount}\n- shadow agreement/gain/unknown/unjoinable: ${coverage.shadowAgreementCount}/${coverage.representationGainCount}/${coverage.shadowUnknownCount}/${coverage.unjoinableRuleCount}\n- confirmed conflicts: ${coverage.confirmedConflictCount}\n- common first-party production rule identities: ${coverage.commonFirstPartyRuleIdentityCount}\n- unknown condition/probability/final HP: ${coverage.unknownConditionCount}/${coverage.unknownProbabilityCount}/${coverage.unknownFinalHpCount}\n\n## Integration strategy\n\nMerge the reviewed experimental infrastructure as one dependency-complete unit. Do not cherry-pick C1–C5 alone without the DB48–DB50 source contracts, semantic evidence, and their inherited structural dependencies. All code remains disabled and additive; production contracts and Android are unchanged.\n\n## Versioning, cache and rollback\n\n- independent sidecar semantic version plus required schema version and snapshot identity;\n- immutable content-addressed payloads, short-lived or revalidated manifest;\n- reject or ignore unknown contracts instead of defaulting uncertain fields;\n- rollback by restoring the previous validated manifest pointer;\n- retain current plus two previous compatible snapshots and all pinned evidence.\n\n## Publication checklist\n\n${readiness.publicationChecklist.map(value => `- ${value.status === "ready" ? "[x]" : "[ ]"} ${value.item}${value.reason ? ` — ${value.reason}` : ""}`).join("\n")}\n`;
}
async function runIntegrationC5(options = {}) {
    const inputDir = options.inputDir ?? DEFAULT_ROOT, outputDir = options.outputDir ?? DEFAULT_ROOT;
    const [c1Manifest, c1Coverage, c1Validation, c2Manifest, c2Coverage, c2Validation, c3Manifest, c3Coverage, c3Validation, c4Manifest, c4Validation] = await Promise.all([
        json((0, path_1.resolve)(inputDir, "team-analysis-database-first-sidecar-c1-manifest.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-sidecar-c1-coverage.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-sidecar-c1-validation.json")),
        json((0, path_1.resolve)(inputDir, "team-analysis-database-first-supported-c2-manifest.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-supported-c2-coverage.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-supported-c2-validation.json")),
        json((0, path_1.resolve)(inputDir, "team-analysis-database-first-shadow-c3-manifest.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-shadow-c3-coverage.json")), json((0, path_1.resolve)(inputDir, "team-analysis-database-first-shadow-c3-validation.json")),
        json((0, path_1.resolve)(inputDir, "database-first-update-c4-manifest.json")), json((0, path_1.resolve)(inputDir, "database-first-update-c4-validation.json")),
    ]);
    const [c1Dataset, c2Dataset, c3Dataset] = await Promise.all([verifiedGzip(inputDir, c1Manifest), verifiedGzip(inputDir, c2Manifest), verifiedGzip(inputDir, c3Manifest)]);
    await verify(inputDir, c4Manifest);
    const c4Receipt = await json((0, path_1.resolve)(inputDir, c4Manifest.fileName)), compatibilityBytes = await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, c4Manifest.compatibilityFile)), c4Compatibility = JSON.parse(compatibilityBytes.toString("utf8"));
    if (JSON.stringify((0, integration_c1_builder_1.buildIntegrationC1Coverage)(c1Dataset)) !== JSON.stringify(c1Coverage) || JSON.stringify((0, integration_c2_builder_1.buildIntegrationC2Coverage)(c2Dataset, c1Dataset)) !== JSON.stringify(c2Coverage) || JSON.stringify((0, integration_c3_builder_1.buildIntegrationC3Coverage)(c3Dataset)) !== JSON.stringify(c3Coverage))
        throw Error("C5 recomputed coverage chain");
    const fileChainFailures = (0, integration_c5_evidence_1.validateIntegrationC5FileChain)({ c1Manifest, c1Dataset, c2Manifest, c2Dataset, c3Manifest, c3Dataset, c4Manifest, c4Receipt, c4Compatibility, compatibilityFileSha256: sha256(compatibilityBytes) });
    if (fileChainFailures.length || ![c1Validation.valid, c2Validation.valid, c3Validation.valid, c4Validation.valid].every(Boolean) || c1Validation.sourceProjectionHashMatchCount !== c1Manifest.ruleCount || c1Validation.losslessRawTupleCount !== c1Manifest.ruleCount || c2Validation.exactProjectionCount !== c2Manifest.ruleCount || c3Validation.exactReconstructionCount !== c3Manifest.ruleCount || c3Validation.exactComparisonCount !== c3Manifest.ruleCount || !c4Validation.compatibilityExact || !c4Validation.receiptExact || c4Receipt.readOnlySourceGuarantee !== true)
        throw Error(`C5 evidence chain ${JSON.stringify(fileChainFailures)}`);
    const evidence = { sourceSnapshotVersion: c1Dataset.sourceSnapshotVersion, artifacts: { c1: { sha256: c1Manifest.sha256, sizeBytes: c1Manifest.sizeBytes }, c2: { sha256: c2Manifest.sha256, sizeBytes: c2Manifest.sizeBytes }, c3: { sha256: c3Manifest.sha256, sizeBytes: c3Manifest.sizeBytes }, c4Receipt: { sha256: c4Manifest.sha256, sizeBytes: c4Manifest.sizeBytes } }, coverage: { auditRuleCount: c1Coverage.ruleCount, supportedRuleCount: c2Coverage.projectedRuleCount, sidecarStateCount: c2Coverage.stateCount, supportedTimingCount: c2Coverage.includedDimensionCounts.timing, unknownTimingCount: c2Coverage.omittedDimensionCounts.timing, shadowAgreementCount: c3Coverage.classificationCounts.agreement, representationGainCount: c3Coverage.classificationCounts.representation_gain, shadowUnknownCount: c3Coverage.classificationCounts.unknown, unjoinableRuleCount: c3Coverage.classificationCounts.unjoinable, confirmedConflictCount: c3Coverage.classificationCounts.confirmed_conflict, commonFirstPartyRuleIdentityCount: c3Coverage.commonFirstPartyRuleIdentityCount, unknownConditionCount: c1Coverage.dimensionStatusCounts.condition.unknown, unknownProbabilityCount: c1Coverage.dimensionStatusCounts.probability.unknown, unknownFinalHpCount: c1Coverage.dimensionStatusCounts.finalHpApplication.unknown }, refresh: { status: "compatible", exactEvidenceIdentity: true, readOnlySourceGuarantee: true } };
    const build = () => (0, integration_c5_builder_1.buildIntegrationC5Readiness)(c4Manifest.generatedAt, evidence), readiness = build(), firstText = `${JSON.stringify(readiness, null, 2)}\n`, secondText = `${JSON.stringify(build(), null, 2)}\n`;
    if (sha256(firstText) !== sha256(secondText))
        throw Error("C5 deterministic rebuild");
    const validation = (0, integration_c5_validator_1.validateIntegrationC5Readiness)(readiness, c4Manifest.generatedAt, evidence), mutate = () => JSON.parse(JSON.stringify(readiness)), mutations = [mutate(), mutate(), mutate(), mutate()];
    mutations[0].decisions.find(value => value.stage === "r2_publication").decision = "GO";
    mutations[1].evidence.coverage.confirmedConflictCount = 1;
    mutations[2].evidence.artifacts.c3.sha256 = "0".repeat(64);
    mutations[3].decisions.pop();
    validation.mutationRejectionCount = mutations.filter(value => !(0, integration_c5_validator_1.validateIntegrationC5Readiness)(value, c4Manifest.generatedAt, evidence).valid).length;
    if (!validation.valid || validation.mutationRejectionCount !== 4)
        throw Error(`C5 validation ${JSON.stringify(validation.failures)}`);
    const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: readiness.generatedAt, fileName: "database-first-readiness-c5.json", sha256: sha256(firstText), sizeBytes: Buffer.byteLength(firstText), reportFile: "database-first-readiness-c5-report.md", validationFile: "database-first-readiness-c5-validation.json" };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), firstText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-first-readiness-c5-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.reportFile), render(readiness)), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`)]);
    return { manifest, evidence, decisions: readiness.decisions, validation, deterministicSha256: sha256(secondText), peakWorkingSetBytes: process.resourceUsage().maxRSS * 1024 };
}
exports.runIntegrationC5 = runIntegrationC5;
if (require.main === module)
    runIntegrationC5().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=integration-c5-run.js.map