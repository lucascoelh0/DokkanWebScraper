import { createWriteStream } from "fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "fs/promises";
import { once } from "events";
import { resolve } from "path";
import { createGzip } from "zlib";
import { buildCharacterShadowProjection } from "./shadow-builder";
import { sha256Bytes } from "./artifact";
import { CharacterShadowManifest, CharacterShadowProjection } from "./shadow-contract";
import { buildCharacterShadowCoverage } from "./shadow-parity-builder";
import { buildCharacterShadowReadiness } from "./shadow-readiness-builder";
import { loadCharacterShadowInputs } from "./shadow-source";
import { sha256File } from "./source";
import { validateCharacterShadowProjection } from "./shadow-validator";

const value = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const jsonBytes = (input: unknown) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");

async function writeChunk(stream: NodeJS.WritableStream, chunk: string): Promise<void> {
    if (!stream.write(chunk, "utf8")) await once(stream, "drain");
}

async function writeProjection(path: string, projection: CharacterShadowProjection): Promise<{ sha256: string; sizeBytes: number; uncompressedSizeBytes: number }> {
    const gzip = createGzip({ level: 9 });
    const output = createWriteStream(path, { flags: "w" });
    gzip.pipe(output);
    let rawBytes = 0;
    const write = async (chunk: string) => { rawBytes += Buffer.byteLength(chunk); await writeChunk(gzip, chunk); };
    const { fields, ...header } = projection;
    const prefix = `${JSON.stringify(header).slice(0, -1)},\"fields\":[`;
    await write(prefix);
    for (let index = 0; index < fields.length; index++) await write(`${index ? "," : ""}${JSON.stringify(fields[index])}`);
    await write("]}\n");
    gzip.end();
    await once(output, "close");
    const metadata = await stat(path);
    return { sha256: await sha256File(path), sizeBytes: metadata.size, uncompressedSizeBytes: rawBytes };
}

async function generate(options: { sidecarRoot: string; productionRoot: string; fyiRoot: string; artifactPath: string }) {
    const inputs = await loadCharacterShadowInputs(options);
    const projection = buildCharacterShadowProjection(inputs);
    const coverage = buildCharacterShadowCoverage(projection, inputs.k7);
    const validation = validateCharacterShadowProjection(projection, coverage);
    if (!validation.valid) throw new Error(`K13 validation failed: ${validation.failures.join("; ")}`);
    const readiness = buildCharacterShadowReadiness(projection, coverage, validation);
    const artifact = await writeProjection(options.artifactPath, projection);
    return { artifact, coverageBytes: jsonBytes(coverage), validationBytes: jsonBytes(validation), readinessBytes: jsonBytes(readiness), fieldProjectionCount: projection.fields.length, productionPatchableCardCount: new Set(projection.fields.filter(item => item.characterField && item.authority === "database_candidate").map(item => item.cardId)).size };
}

async function run(): Promise<void> {
    const sidecarRoot = resolve(value("--sidecar-root") ?? "D:/Dokkan/DokkanWebScraper-character-current/data/database-characters");
    const productionRoot = resolve(value("--production-root") ?? "D:/Dokkan/DokkanWebScraper/data");
    const fyiRoot = resolve(value("--fyi-root") ?? "D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest");
    const outputDir = resolve(value("--output-dir") ?? "data/database-characters/shadow");
    await mkdir(outputDir, { recursive: true });
    const firstPath = resolve(outputDir, "database-characters-k11-shadow-projection.first.tmp.gz");
    const secondPath = resolve(outputDir, "database-characters-k11-shadow-projection.second.tmp.gz");
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const first = await generate({ sidecarRoot, productionRoot, fyiRoot, artifactPath: firstPath });
        (global as any).gc?.();
        const second = await generate({ sidecarRoot, productionRoot, fyiRoot, artifactPath: secondPath });
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (JSON.stringify(first.artifact) !== JSON.stringify(second.artifact)
            || !first.coverageBytes.equals(second.coverageBytes) || !first.validationBytes.equals(second.validationBytes) || !first.readinessBytes.equals(second.readinessBytes)
            || first.fieldProjectionCount !== second.fieldProjectionCount || first.productionPatchableCardCount !== second.productionPatchableCardCount) throw new Error("K10-K14 two-generation byte identity failed");
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K10-K14 memory limit exceeded: ${peakRssBytes}`);
        const finalPath = resolve(outputDir, "database-characters-k11-shadow-projection.json.gz");
        await copyFile(firstPath, finalPath);
        const manifest: CharacterShadowManifest = {
            schemaVersion: 1, contractVersion: "1.0.0", generatedAt: "2026-08-05T00:00:00.000Z", fileName: "database-characters-k11-shadow-projection.json.gz", compression: "gzip",
            sha256: first.artifact.sha256, sizeBytes: first.artifact.sizeBytes, uncompressedSizeBytes: first.artifact.uncompressedSizeBytes,
            fieldProjectionCount: first.fieldProjectionCount, productionPatchableCardCount: first.productionPatchableCardCount,
            coverageFile: "database-characters-k12-shadow-coverage.json", coverageSha256: sha256Bytes(first.coverageBytes), coverageSizeBytes: first.coverageBytes.length,
            validationFile: "database-characters-k13-shadow-validation.json", validationSha256: sha256Bytes(first.validationBytes), validationSizeBytes: first.validationBytes.length,
            readinessFile: "database-characters-k14-readiness.json", readinessSha256: sha256Bytes(first.readinessBytes), readinessSizeBytes: first.readinessBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        await Promise.all([
            writeFile(resolve(outputDir, "database-characters-k10-k14-manifest.json"), manifestBytes),
            writeFile(resolve(outputDir, manifest.coverageFile), first.coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), first.validationBytes),
            writeFile(resolve(outputDir, manifest.readinessFile), first.readinessBytes),
        ]);
        const [finalMetadata, finalHash] = await Promise.all([stat(finalPath), sha256File(finalPath)]);
        if (finalMetadata.size !== manifest.sizeBytes || finalHash !== manifest.sha256) throw new Error("final shadow payload does not match its manifest");
        for (const [file, expectedHash, expectedSize] of [[manifest.coverageFile, manifest.coverageSha256, manifest.coverageSizeBytes], [manifest.validationFile, manifest.validationSha256, manifest.validationSizeBytes], [manifest.readinessFile, manifest.readinessSha256, manifest.readinessSizeBytes]] as const) {
            const bytes = await readFile(resolve(outputDir, file));
            if (bytes.length !== expectedSize || sha256Bytes(bytes) !== expectedHash) throw new Error(`${file} does not match its manifest`);
        }
        const report = { outputDir, manifest, manifestSha256: sha256Bytes(manifestBytes), manifestSizeBytes: manifestBytes.length, twoGenerationByteIdentical: true, peakRssBytes, productionModified: false, publisherEnabled: false, r2Enabled: false, androidEnabled: false };
        await writeFile(resolve(outputDir, "database-characters-k10-k14-run-report.json"), jsonBytes(report));
        console.log(JSON.stringify(report, null, 2));
    } finally {
        clearInterval(monitor);
    }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
