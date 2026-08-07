"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegrationC3 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const integration_c3_builder_1 = require("./integration-c3-builder");
const integration_c3_validator_1 = require("./integration-c3-validator");
const DEFAULT_EXPERIMENT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment");
const DEFAULT_PRODUCTION = (0, path_1.resolve)("D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function readVerifiedGzip(directory, manifest) {
    const gzip = await (0, promises_1.readFile)((0, path_1.resolve)(directory, manifest.fileName));
    if (sha256(gzip) !== manifest.sha256 || gzip.byteLength !== manifest.sizeBytes)
        throw Error(`C3 artifact identity ${manifest.fileName}`);
    const json = (0, zlib_1.gunzipSync)(gzip);
    if (json.byteLength !== manifest.uncompressedSizeBytes)
        throw Error(`C3 artifact size ${manifest.fileName}`);
    return { value: JSON.parse(json.toString("utf8")), gzip };
}
function report(dataset, coverage) {
    const examples = (classification) => dataset.records.filter(value => value.classification === classification).slice(0, 5).map(value => `- \`${value.identity.effectKey}\` — ${value.reason}`).join("\n") || "- none";
    return `# Integration C3 — structural shadow parity\n\n## Boundary\n\nThe join is exclusively by first-party structural \`stateKey\`. The production parser has no first-party passive-skill, rule, or effect identity, so an effect representation can agree but cannot establish rule identity. The parser is comparison input, never authority.\n\n## Coverage\n\n- rules: ${coverage.ruleCount}\n- sidecar states: ${coverage.sidecarStateCount}\n- joined states: ${coverage.joinedStateCount}\n- unjoinable states: ${coverage.unjoinableStateCount}\n- agreement: ${coverage.classificationCounts.agreement}\n- representation gain: ${coverage.classificationCounts.representation_gain}\n- unknown: ${coverage.classificationCounts.unknown}\n- confirmed conflict: ${coverage.classificationCounts.confirmed_conflict}\n\n## Classification rules\n\n- \`agreement\`: at least one exact kind/value/unit/structurally comparable target representation in the joined state.\n- \`representation_gain\`: joined state, but the production contract has no comparable effect kind.\n- \`unknown\`: comparable kind exists, but structural target or common rule identity is insufficient to prove a conflict.\n- \`unjoinable\`: the production snapshot has no identical state key.\n- \`confirmed_conflict\`: deliberately unavailable until both sources share a first-party rule/effect identity.\n\n## Representative gains\n\n${examples("representation_gain")}\n\n## Unknown comparisons\n\n${examples("unknown")}\n\n## Unjoinable records\n\n${examples("unjoinable")}\n\n## Real structural fixtures\n\n${dataset.goldenFixtures.map(value => `- ${value.kind}: \`${value.stateKey}\`${value.transformationSource ? ` via \`${value.transformationSource}\`` : ""}`).join("\n")}\n`;
}
async function runIntegrationC3(options = {}) {
    const inputDir = options.inputDir ?? DEFAULT_EXPERIMENT, productionDir = options.productionDir ?? DEFAULT_PRODUCTION, outputDir = options.outputDir ?? DEFAULT_EXPERIMENT;
    const c2Manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(inputDir, "team-analysis-database-first-supported-c2-manifest.json"), "utf8"));
    const teamManifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(productionDir, "team-analysis-manifest.json"), "utf8"));
    const characterManifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(productionDir, "characters-manifest.json"), "utf8"));
    const c2Artifact = await readVerifiedGzip(inputDir, c2Manifest), teamArtifact = await readVerifiedGzip(productionDir, teamManifest), characterArtifact = await readVerifiedGzip(productionDir, characterManifest);
    if (c2Manifest.schemaVersion !== 1 || c2Manifest.contractVersion !== "1.0.0" || c2Artifact.value.contract !== "dokkan-team-analysis-database-first-supported-sidecar" || c2Artifact.value.contractVersion !== "1.0.0" || c2Artifact.value.rules.length !== c2Manifest.ruleCount)
        throw Error("C3 C2 contract identity");
    if (teamArtifact.value.schemaVersion !== teamManifest.schemaVersion || teamArtifact.value.parserVersion !== teamManifest.parserVersion || teamArtifact.value.rulesVersion !== teamManifest.rulesVersion || teamArtifact.value.states.length !== teamManifest.stateCount || characterArtifact.value.length !== characterManifest.characterCount)
        throw Error("C3 production contract identity");
    if (teamManifest.sourceCharacterPayloadSha256 !== characterManifest.sha256 || teamArtifact.value.sourceCharacterPayloadSha256 !== characterManifest.sha256)
        throw Error("C3 production Team Analysis/character join identity");
    const meta = { fileName: teamManifest.fileName, sha256: teamManifest.sha256, datasetVersion: teamManifest.datasetVersion, parserVersion: teamManifest.parserVersion }, characterMeta = { fileName: characterManifest.fileName, sha256: characterManifest.sha256, datasetVersion: characterManifest.datasetVersion };
    const build = () => (0, integration_c3_builder_1.buildIntegrationC3Dataset)(c2Artifact.value, c2Manifest.sha256, teamArtifact.value, meta, characterMeta), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = (0, zlib_1.gzipSync)(Buffer.from(firstJson), { level: 9 }), secondGzip = (0, zlib_1.gzipSync)(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip))
        throw Error("C3 deterministic rebuild failed");
    const metadata = { production: meta, characters: characterMeta };
    const validation = (0, integration_c3_validator_1.validateIntegrationC3Dataset)(dataset, c2Artifact.value, c2Manifest.sha256, teamArtifact.value, characterArtifact.value, metadata);
    if (!validation.valid)
        throw Error(`C3 validation failed ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const mutate = () => JSON.parse(JSON.stringify(dataset));
    const mutations = [mutate(), mutate(), mutate(), mutate(), mutate()];
    mutations[0].records[0].classification = "confirmed_conflict";
    mutations[1].records[0].databaseFirstRule.supported.valueUnit.mutation = true;
    mutations[2].goldenFixtures[0].formId = "0";
    mutations[3].sourceProductionTeamAnalysis.sha256 = "0".repeat(64);
    mutations[4].goldenFixtures.pop();
    validation.mutationRejectionCount = mutations.filter(value => !(0, integration_c3_validator_1.validateIntegrationC3Dataset)(value, c2Artifact.value, c2Manifest.sha256, teamArtifact.value, characterArtifact.value, metadata).valid).length;
    if (validation.mutationRejectionCount !== mutations.length)
        throw Error("C3 mutation evidence validation failed");
    const coverage = (0, integration_c3_builder_1.buildIntegrationC3Coverage)(dataset);
    if (coverage.classificationCounts.confirmed_conflict !== 0 || coverage.joinedStateCount + coverage.unjoinableStateCount !== coverage.sidecarStateCount)
        throw Error("C3 conservative coverage invariant");
    const manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-shadow-c3.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: dataset.records.length, stateCount: coverage.sidecarStateCount, sourceSupportedSidecarSha256: c2Manifest.sha256, sourceProductionTeamAnalysisSha256: teamManifest.sha256, coverageFile: "team-analysis-database-first-shadow-c3-coverage.json", validationFile: "team-analysis-database-first-shadow-c3-validation.json", reportFile: "team-analysis-database-first-shadow-c3-report.md" };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), firstGzip), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "team-analysis-database-first-shadow-c3-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.reportFile), report(dataset, coverage))]);
    return { manifest, coverage, validation, deterministicJsonSha256: sha256(secondJson), peakWorkingSetBytes: process.resourceUsage().maxRSS * 1024 };
}
exports.runIntegrationC3 = runIntegrationC3;
if (require.main === module)
    runIntegrationC3().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=integration-c3-run.js.map