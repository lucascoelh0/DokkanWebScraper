import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { gunzipSync } from "zlib";
import { IntegrationC3Dataset } from "../database-integration/integration-c3-contract";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { resolveCharacterInputFile } from "./artifact-path";
import { buildDatabaseCharacterParityCoverage, buildDatabaseCharacterParityDataset, compactDatabaseCards, compactExternalCharacters } from "./parity-builder";
import { CHARACTER_PARITY_UPSTREAM_PROFILE } from "./parity-contract";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { validateDatabaseCharacterParityDataset } from "./parity-validator";
import { assertPinnedArtifactFile, readCharacterSourceInput, readPinnedGzipJson, sha256File } from "./source";

const C3 = { sha256: "96a5066d8015cb8c4a0bd84895f630a30e84e453f2a30d6e5fef73c354ad29fe", sizeBytes: 89_015, uncompressedSizeBytes: 3_169_633 };

function arg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

async function loadJsonCharacters(path: string) {
    const bytes = await readFile(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const input = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(input)) throw new Error("production characters must be an array");
    return { characters: compactExternalCharacters(input), sha256, sizeBytes: bytes.length, topLevelCount: input.length };
}

async function loadGzipCharacters(path: string, manifestPath: string) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz") throw new Error("FYI character manifest contract changed");
    const gzip = await readFile(path);
    const sha256 = createHash("sha256").update(gzip).digest("hex");
    if (sha256 !== manifest.sha256 || gzip.length !== manifest.sizeBytes) throw new Error("FYI character manifest mismatch");
    const json = gunzipSync(gzip);
    if (json.length !== manifest.uncompressedSizeBytes) throw new Error("FYI character raw size mismatch");
    const input = JSON.parse(json.toString("utf8"));
    if (!Array.isArray(input) || input.length !== manifest.characterCount) throw new Error("FYI character cardinality mismatch");
    if (typeof manifest.generatedAt !== "string") throw new Error("FYI generatedAt is required for release-state selection");
    return { characters: compactExternalCharacters(input), sha256, sizeBytes: gzip.length, topLevelCount: input.length, generatedAt: manifest.generatedAt };
}

type CharacterParityUpstreamGate = "k1" | "k2" | "k3" | "k6";

export function validateUpstreamSidecarManifest(gate: CharacterParityUpstreamGate, manifest: any): void {
    const fileProfile = CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === gate);
    if (!fileProfile) throw new Error(`${gate.toUpperCase()} file profile is missing`);
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
        || manifest.sourceSnapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256) throw new Error(`${gate.toUpperCase()} manifest contract changed`);
}

async function resolveExplicitInputFile(path: string, exactName: string): Promise<string> {
    const absolutePath = resolve(path);
    return resolveCharacterInputFile(dirname(absolutePath), basename(absolutePath), exactName);
}

export async function verifyUpstreamSidecar(gate: CharacterParityUpstreamGate, directory: string): Promise<void> {
    const profile = CHARACTER_PARITY_UPSTREAM_PROFILE[gate];
    const fileProfile = CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === gate);
    if (!fileProfile) throw new Error(`${gate.toUpperCase()} file profile is missing`);
    const manifestPath = await resolveCharacterInputFile(directory, fileProfile.manifest.fileName, fileProfile.manifest.fileName);
    const manifestBytes = await readFile(manifestPath);
    if (manifestBytes.length !== fileProfile.manifest.sizeBytes || sha256Bytes(manifestBytes) !== fileProfile.manifest.sha256) throw new Error(`${gate.toUpperCase()} manifest identity changed`);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    validateUpstreamSidecarManifest(gate, manifest);
    if (manifest.sha256 !== profile.artifactSha256 || manifest.sizeBytes !== profile.artifactSizeBytes || manifest.coverageSha256 !== profile.coverageSha256) throw new Error(`${gate.toUpperCase()} manifest no longer matches the K7 profile`);
    const [artifactPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, manifest.fileName, fileProfile.artifact.fileName),
        resolveCharacterInputFile(directory, manifest.coverageFile, fileProfile.coverage.fileName),
        resolveCharacterInputFile(directory, manifest.validationFile, fileProfile.validation.fileName),
    ]);
    const [coverageBytes, validationBytes] = await Promise.all([readFile(coveragePath), readFile(validationPath)]);
    if (sha256Bytes(coverageBytes) !== fileProfile.coverage.sha256 || coverageBytes.length !== fileProfile.coverage.sizeBytes) throw new Error(`${gate.toUpperCase()} coverage changed`);
    if (sha256Bytes(validationBytes) !== fileProfile.validation.sha256 || validationBytes.length !== fileProfile.validation.sizeBytes) throw new Error(`${gate.toUpperCase()} validation identity changed`);
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error(`${gate.toUpperCase()} validation is not green`);
    await assertPinnedArtifactFile(artifactPath, fileProfile.artifact);
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    if (gate === "k1" && (coverage.stateCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.stateCount || coverage.awakeningTransitionCounts?.z_awaken !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.zAwakenTransitionCount || Object.values(coverage.formTransitionCounts ?? {}).reduce((sum: number, value) => sum + Number(value), 0) !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.formTransitionCount)) throw new Error("K1 audit metrics changed");
    if (gate === "k2" && coverage.cardCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k2.cardCount) throw new Error("K2 audit metrics changed");
    if (gate === "k3" && coverage.attackCounts?.ex !== CHARACTER_PARITY_UPSTREAM_PROFILE.k3.exAttackCount) throw new Error("K3 audit metrics changed");
    if (gate === "k6" && (coverage.roleCounts?.card_resource_bundle !== CHARACTER_PARITY_UPSTREAM_PROFILE.k6.firstPartyResourceIdCount || coverage.missingCardResourceCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k6.missingCardResourceCount)) throw new Error("K6 audit metrics changed");
}

async function run() {
    const inputDir = arg("--input-dir");
    if (!inputDir) throw new Error("--input-dir is required");
    const [productionPath, fyiPath, fyiManifestPath, teamPath, teamManifestPath, c3Path] = await Promise.all([
        resolveExplicitInputFile(arg("--production-characters") ?? "D:/Dokkan/DokkanWebScraper/data/characters.json", "characters.json"),
        resolveExplicitInputFile(arg("--fyi-characters") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters.json.gz", "characters.json.gz"),
        resolveExplicitInputFile(arg("--fyi-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters-manifest.json", "characters-manifest.json"),
        resolveExplicitInputFile(arg("--team-analysis") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis.json.gz", "team-analysis.json.gz"),
        resolveExplicitInputFile(arg("--team-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis-manifest.json", "team-analysis-manifest.json"),
        resolveExplicitInputFile(arg("--c3") ?? "D:/Dokkan/DokkanWebScraper-db-source/data/database-experiment/team-analysis-database-first-shadow-c3.json.gz", "team-analysis-database-first-shadow-c3.json.gz"),
    ]);
    const outputDir = resolve(arg("--output-dir") ?? "data/database-characters/k7");
    const upstreamDirs = {
        k1: resolve(arg("--k1-dir") ?? "data/database-characters/k1"),
        k2: resolve(arg("--k2-dir") ?? "data/database-characters/k2"),
        k3: resolve(arg("--k3-dir") ?? "data/database-characters/k3"),
        k6: resolve(arg("--k6-dir") ?? "data/database-characters/k6"),
    };
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        await Promise.all((Object.keys(upstreamDirs) as Array<keyof typeof upstreamDirs>).map(gate => verifyUpstreamSidecar(gate, upstreamDirs[gate])));
        const source = await readCharacterSourceInput(inputDir);
        const production = await loadJsonCharacters(productionPath);
        const fyi = await loadGzipCharacters(fyiPath, fyiManifestPath);
        const teamManifest = JSON.parse(await readFile(teamManifestPath, "utf8"));
        if (teamManifest.schemaVersion !== 1 || teamManifest.compression !== "gzip" || teamManifest.fileName !== "team-analysis.json.gz") throw new Error("Team Analysis manifest contract changed");
        const c3 = await readPinnedGzipJson<IntegrationC3Dataset>(c3Path, C3);
        await assertPinnedArtifactFile(teamPath, { sha256: teamManifest.sha256, sizeBytes: teamManifest.sizeBytes });
        if (c3.sourceProductionTeamAnalysis.sha256 !== teamManifest.sha256 || c3.sourceProductionCharacters.sha256 !== fyi.sha256) throw new Error("C3 no longer matches current FYI/Team artifacts");
        const cards = await compactDatabaseCards(source);
        const build = () => buildDatabaseCharacterParityDataset({
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
        const firstCoverage = buildDatabaseCharacterParityCoverage(firstDataset);
        const validation = validateDatabaseCharacterParityDataset(firstDataset, firstCoverage);
        if (!validation.valid) throw new Error(validation.failures.join("; "));
        const first = buildDeterministicJsonGzipArtifact(firstDataset);
        const second = buildDeterministicJsonGzipArtifact(build());
        if (!first.gzip.equals(second.gzip)) throw new Error("K7 two-generation byte identity failed");

        if (await sha256File(productionPath) !== production.sha256 || await sha256File(fyiPath) !== fyi.sha256) throw new Error("K7 external input changed during generation");
        await assertPinnedArtifactFile(source.artifactPath, { sha256: source.artifactSha256, sizeBytes: source.artifactSizeBytes });
        await assertPinnedArtifactFile(teamPath, { sha256: teamManifest.sha256, sizeBytes: teamManifest.sizeBytes });
        await Promise.all((Object.keys(upstreamDirs) as Array<keyof typeof upstreamDirs>).map(gate => verifyUpstreamSidecar(gate, upstreamDirs[gate])));

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
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k7-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K7 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await mkdir(outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(outputDir, manifest.fileName), first.gzip),
            writeFile(resolve(outputDir, "database-characters-k7-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), validationBytes),
        ]);
        console.log(JSON.stringify({ outputDir, manifest, coverage: firstCoverage, historicalAudits: firstDataset.historicalAudits, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    } finally {
        clearInterval(timer);
    }
}

if (require.main === module) run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
