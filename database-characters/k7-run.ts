import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { IntegrationC3Dataset } from "../database-integration/integration-c3-contract";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { buildDatabaseCharacterParityCoverage, buildDatabaseCharacterParityDataset, compactDatabaseCards, compactExternalCharacters } from "./parity-builder";
import { CHARACTER_PARITY_UPSTREAM_PROFILE } from "./parity-contract";
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

async function verifyUpstreamSidecar(gate: "k1" | "k2" | "k3" | "k6", directory: string): Promise<void> {
    const profile = CHARACTER_PARITY_UPSTREAM_PROFILE[gate];
    const manifestPath = resolve(directory, `database-characters-${gate}-manifest.json`);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const coveragePath = resolve(directory, manifest.coverageFile);
    const coverageBytes = await readFile(coveragePath);
    if (manifest.sha256 !== profile.artifactSha256 || manifest.sizeBytes !== profile.artifactSizeBytes || manifest.coverageSha256 !== profile.coverageSha256) throw new Error(`${gate.toUpperCase()} manifest no longer matches the K7 profile`);
    if (sha256Bytes(coverageBytes) !== profile.coverageSha256 || coverageBytes.length !== manifest.coverageSizeBytes) throw new Error(`${gate.toUpperCase()} coverage changed`);
    await assertPinnedArtifactFile(resolve(directory, manifest.fileName), { sha256: profile.artifactSha256, sizeBytes: profile.artifactSizeBytes });
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    if (gate === "k1" && (coverage.stateCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.stateCount || coverage.awakeningTransitionCounts?.z_awaken !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.zAwakenTransitionCount || Object.values(coverage.formTransitionCounts ?? {}).reduce((sum: number, value) => sum + Number(value), 0) !== CHARACTER_PARITY_UPSTREAM_PROFILE.k1.formTransitionCount)) throw new Error("K1 audit metrics changed");
    if (gate === "k2" && coverage.cardCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k2.cardCount) throw new Error("K2 audit metrics changed");
    if (gate === "k3" && coverage.attackCounts?.ex !== CHARACTER_PARITY_UPSTREAM_PROFILE.k3.exAttackCount) throw new Error("K3 audit metrics changed");
    if (gate === "k6" && (coverage.roleCounts?.card_resource_bundle !== CHARACTER_PARITY_UPSTREAM_PROFILE.k6.firstPartyResourceIdCount || coverage.missingCardResourceCount !== CHARACTER_PARITY_UPSTREAM_PROFILE.k6.missingCardResourceCount)) throw new Error("K6 audit metrics changed");
}

async function run() {
    const inputDir = arg("--input-dir");
    if (!inputDir) throw new Error("--input-dir is required");
    const productionPath = resolve(arg("--production-characters") ?? "D:/Dokkan/DokkanWebScraper/data/characters.json");
    const fyiPath = resolve(arg("--fyi-characters") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters.json.gz");
    const fyiManifestPath = resolve(arg("--fyi-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/characters-manifest.json");
    const teamPath = resolve(arg("--team-analysis") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis.json.gz");
    const teamManifestPath = resolve(arg("--team-manifest") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest/team-analysis-manifest.json");
    const c3Path = resolve(arg("--c3") ?? "D:/Dokkan/DokkanWebScraper-db-source/data/database-experiment/team-analysis-database-first-shadow-c3.json.gz");
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
