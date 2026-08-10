"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUpstreamSidecar = exports.validateUpstreamSidecarManifest = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_1 = require("./artifact");
const artifact_path_1 = require("./artifact-path");
const parity_builder_1 = require("./parity-builder");
const parity_contract_1 = require("./parity-contract");
const refresh_contract_1 = require("./refresh-contract");
const parity_validator_1 = require("./parity-validator");
const source_1 = require("./source");
const C3 = { sha256: "96a5066d8015cb8c4a0bd84895f630a30e84e453f2a30d6e5fef73c354ad29fe", sizeBytes: 89015, uncompressedSizeBytes: 3169633 };
function arg(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}
async function loadJsonCharacters(path) {
    const bytes = await (0, promises_1.readFile)(path);
    const sha256 = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
    const input = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(input))
        throw new Error("production characters must be an array");
    return { characters: (0, parity_builder_1.compactExternalCharacters)(input), sha256, sizeBytes: bytes.length, topLevelCount: input.length };
}
async function loadGzipCharacters(path, manifestPath) {
    const manifest = JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz")
        throw new Error("FYI character manifest contract changed");
    const gzip = await (0, promises_1.readFile)(path);
    const sha256 = (0, crypto_1.createHash)("sha256").update(gzip).digest("hex");
    if (sha256 !== manifest.sha256 || gzip.length !== manifest.sizeBytes)
        throw new Error("FYI character manifest mismatch");
    const json = (0, zlib_1.gunzipSync)(gzip);
    if (json.length !== manifest.uncompressedSizeBytes)
        throw new Error("FYI character raw size mismatch");
    const input = JSON.parse(json.toString("utf8"));
    if (!Array.isArray(input) || input.length !== manifest.characterCount)
        throw new Error("FYI character cardinality mismatch");
    if (typeof manifest.generatedAt !== "string")
        throw new Error("FYI generatedAt is required for release-state selection");
    return { characters: (0, parity_builder_1.compactExternalCharacters)(input), sha256, sizeBytes: gzip.length, topLevelCount: input.length, generatedAt: manifest.generatedAt };
}
function validateUpstreamSidecarManifest(gate, manifest) {
    const fileProfile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === gate);
    if (!fileProfile)
        throw new Error(`${gate.toUpperCase()} file profile is missing`);
    if (manifest?.schemaVersion !== 1
        || manifest.contractVersion !== fileProfile.contractVersion
        || manifest.compression !== "gzip"
        || manifest.fileName !== fileProfile.artifact.fileName
        || manifest.sha256 !== fileProfile.artifact.sha256
        || manifest.sizeBytes !== fileProfile.artifact.sizeBytes
        || manifest.uncompressedSizeBytes !== fileProfile.artifact.uncompressedSizeBytes
        || manifest.coverageFile !== fileProfile.coverage.fileName
        || manifest.coverageSha256 !== fileProfile.coverage.sha256
        || manifest.coverageSizeBytes !== fileProfile.coverage.sizeBytes
        || manifest.validationFile !== fileProfile.validation.fileName
        || manifest.validationSha256 !== fileProfile.validation.sha256
        || manifest.validationSizeBytes !== fileProfile.validation.sizeBytes
        || manifest.sourceSnapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion
        || manifest.sourceDb1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256)
        throw new Error(`${gate.toUpperCase()} manifest contract changed`);
}
exports.validateUpstreamSidecarManifest = validateUpstreamSidecarManifest;
async function resolveExplicitInputFile(path, exactName) {
    const absolutePath = (0, path_1.resolve)(path);
    return (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.dirname)(absolutePath), (0, path_1.basename)(absolutePath), exactName);
}
async function verifyUpstreamSidecar(gate, directory) {
    const profile = parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE[gate];
    const fileProfile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === gate);
    if (!fileProfile)
        throw new Error(`${gate.toUpperCase()} file profile is missing`);
    const manifestPath = await (0, artifact_path_1.resolveCharacterInputFile)(directory, fileProfile.manifest.fileName, fileProfile.manifest.fileName);
    const manifestBytes = await (0, promises_1.readFile)(manifestPath);
    if (manifestBytes.length !== fileProfile.manifest.sizeBytes || (0, artifact_1.sha256Bytes)(manifestBytes) !== fileProfile.manifest.sha256)
        throw new Error(`${gate.toUpperCase()} manifest identity changed`);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    validateUpstreamSidecarManifest(gate, manifest);
    if (manifest.sha256 !== profile.artifactSha256 || manifest.sizeBytes !== profile.artifactSizeBytes || manifest.coverageSha256 !== profile.coverageSha256)
        throw new Error(`${gate.toUpperCase()} manifest no longer matches the K7 profile`);
    const [artifactPath, coveragePath, validationPath] = await Promise.all([
        (0, artifact_path_1.resolveCharacterInputFile)(directory, manifest.fileName, fileProfile.artifact.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, manifest.coverageFile, fileProfile.coverage.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, manifest.validationFile, fileProfile.validation.fileName),
    ]);
    const [coverageBytes, validationBytes] = await Promise.all([(0, promises_1.readFile)(coveragePath), (0, promises_1.readFile)(validationPath)]);
    if ((0, artifact_1.sha256Bytes)(coverageBytes) !== fileProfile.coverage.sha256 || coverageBytes.length !== fileProfile.coverage.sizeBytes)
        throw new Error(`${gate.toUpperCase()} coverage changed`);
    if ((0, artifact_1.sha256Bytes)(validationBytes) !== fileProfile.validation.sha256 || validationBytes.length !== fileProfile.validation.sizeBytes)
        throw new Error(`${gate.toUpperCase()} validation identity changed`);
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0)
        throw new Error(`${gate.toUpperCase()} validation is not green`);
    await (0, source_1.assertPinnedArtifactFile)(artifactPath, fileProfile.artifact);
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    if (gate === "k1" && (coverage.stateCount !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.stateCount || coverage.awakeningTransitionCounts?.z_awaken !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.zAwakenTransitionCount || Object.values(coverage.formTransitionCounts ?? {}).reduce((sum, value) => sum + Number(value), 0) !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.formTransitionCount))
        throw new Error("K1 audit metrics changed");
    if (gate === "k2" && coverage.cardCount !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2.cardCount)
        throw new Error("K2 audit metrics changed");
    if (gate === "k3" && coverage.attackCounts?.ex !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3.exAttackCount)
        throw new Error("K3 audit metrics changed");
    if (gate === "k6" && (coverage.roleCounts?.card_resource_bundle !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.firstPartyResourceIdCount || coverage.missingCardResourceCount !== parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.missingCardResourceCount))
        throw new Error("K6 audit metrics changed");
}
exports.verifyUpstreamSidecar = verifyUpstreamSidecar;
async function run() {
    const inputDir = arg("--input-dir");
    if (!inputDir)
        throw new Error("--input-dir is required");
    const [productionPath, fyiPath, fyiManifestPath, teamPath, teamManifestPath, c3Path] = await Promise.all([
        resolveExplicitInputFile(arg("--production-characters") ?? "D:/Dokkan/DokkanWebScraper/data/characters.json", "characters.json"),
        resolveExplicitInputFile(arg("--fyi-characters") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters.json.gz", "characters.json.gz"),
        resolveExplicitInputFile(arg("--fyi-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters-manifest.json", "characters-manifest.json"),
        resolveExplicitInputFile(arg("--team-analysis") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis.json.gz", "team-analysis.json.gz"),
        resolveExplicitInputFile(arg("--team-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis-manifest.json", "team-analysis-manifest.json"),
        resolveExplicitInputFile(arg("--c3") ?? "D:/Dokkan/DokkanWebScraper-db-source/data/database-experiment/team-analysis-database-first-shadow-c3.json.gz", "team-analysis-database-first-shadow-c3.json.gz"),
    ]);
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k7");
    const upstreamDirs = {
        k1: (0, path_1.resolve)(arg("--k1-dir") ?? "data/database-characters/k1"),
        k2: (0, path_1.resolve)(arg("--k2-dir") ?? "data/database-characters/k2"),
        k3: (0, path_1.resolve)(arg("--k3-dir") ?? "data/database-characters/k3"),
        k6: (0, path_1.resolve)(arg("--k6-dir") ?? "data/database-characters/k6"),
    };
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        await Promise.all(Object.keys(upstreamDirs).map(gate => verifyUpstreamSidecar(gate, upstreamDirs[gate])));
        const source = await (0, source_1.readCharacterSourceInput)(inputDir);
        const production = await loadJsonCharacters(productionPath);
        const fyi = await loadGzipCharacters(fyiPath, fyiManifestPath);
        const teamManifest = JSON.parse(await (0, promises_1.readFile)(teamManifestPath, "utf8"));
        if (teamManifest.schemaVersion !== 1 || teamManifest.compression !== "gzip" || teamManifest.fileName !== "team-analysis.json.gz")
            throw new Error("Team Analysis manifest contract changed");
        const c3 = await (0, source_1.readPinnedGzipJson)(c3Path, C3);
        await (0, source_1.assertPinnedArtifactFile)(teamPath, { sha256: teamManifest.sha256, sizeBytes: teamManifest.sizeBytes });
        if (c3.sourceProductionTeamAnalysis.sha256 !== teamManifest.sha256 || c3.sourceProductionCharacters.sha256 !== fyi.sha256)
            throw new Error("C3 no longer matches current FYI/Team artifacts");
        const cards = await (0, parity_builder_1.compactDatabaseCards)(source);
        const build = () => (0, parity_builder_1.buildDatabaseCharacterParityDataset)({
            source,
            cards,
            production: production.characters,
            productionSha256: production.sha256,
            productionSizeBytes: production.sizeBytes,
            productionTopLevelCount: production.topLevelCount,
            fyi: fyi.characters,
            fyiSha256: fyi.sha256,
            fyiSizeBytes: fyi.sizeBytes,
            fyiTopLevelCount: fyi.topLevelCount,
            fyiGeneratedAt: fyi.generatedAt,
            teamSha256: teamManifest.sha256,
            teamStateCount: teamManifest.stateCount,
            c3,
            c3Sha256: C3.sha256,
        });
        const firstDataset = build();
        const firstCoverage = (0, parity_builder_1.buildDatabaseCharacterParityCoverage)(firstDataset);
        const validation = (0, parity_validator_1.validateDatabaseCharacterParityDataset)(firstDataset, firstCoverage);
        if (!validation.valid)
            throw new Error(validation.failures.join("; "));
        const first = (0, artifact_1.buildDeterministicJsonGzipArtifact)(firstDataset);
        const second = (0, artifact_1.buildDeterministicJsonGzipArtifact)(build());
        if (!first.gzip.equals(second.gzip))
            throw new Error("K7 two-generation byte identity failed");
        if (await (0, source_1.sha256File)(productionPath) !== production.sha256 || await (0, source_1.sha256File)(fyiPath) !== fyi.sha256)
            throw new Error("K7 external input changed during generation");
        await (0, source_1.assertPinnedArtifactFile)(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await (0, source_1.assertPinnedArtifactFile)(teamPath, { sha256: teamManifest.sha256, sizeBytes: teamManifest.sizeBytes });
        await Promise.all(Object.keys(upstreamDirs).map(gate => verifyUpstreamSidecar(gate, upstreamDirs[gate])));
        const coverageBytes = `${JSON.stringify(firstCoverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1,
            contractVersion: "1.1.0",
            generatedAt: source.generatedAt,
            fileName: "database-characters-k7-parity.json.gz",
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSizeBytes: first.json.length,
            sourceDb1ArtifactSha256: source.artifactSha256,
            sourceProductionCharactersSha256: production.sha256,
            sourceFyiCharactersSha256: fyi.sha256,
            sourceTeamAnalysisSha256: teamManifest.sha256,
            sourceC3Sha256: C3.sha256,
            sourceUpstreamSidecars: firstDataset.source.upstreamSidecars,
            coverageFile: "database-characters-k7-coverage.json",
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k7-validation.json",
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K7 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.gzip),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k7-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes),
        ]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: firstCoverage, historicalAudits: firstDataset.historicalAudits, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    }
    finally {
        clearInterval(timer);
    }
}
if (require.main === module)
    run().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
//# sourceMappingURL=k7-run.js.map