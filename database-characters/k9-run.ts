import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { buildDeterministicJsonGzipArtifact, sha256Bytes } from "./artifact";
import { buildDatabaseCharacterReadinessCoverage, buildDatabaseCharacterReadinessDataset } from "./readiness-builder";
import { validateDatabaseCharacterReadinessDataset } from "./readiness-validator";
import { assertPinnedArtifactFile } from "./source";

const K8_FILES = [
    { fileName: "database-characters-k8-refresh-receipt.json.gz", sha256: "f91c894a7ebbd6a48380f73c68282e2f4f12c337367ff3b1de5cf07f01c19798", sizeBytes: 3_158 },
    { fileName: "database-characters-k8-manifest.json", sha256: "e28fd73c929494f78f65b39552601f496dffaf323b909e84244fd5b8f5fcd133", sizeBytes: 1_096 },
    { fileName: "database-characters-k8-coverage.json", sha256: "f3e09d86a47959af641c17f3aeb793f79ebcce56d1e695c05cd4edab2d1b1e1c", sizeBytes: 251 },
    { fileName: "database-characters-k8-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 },
] as const;

function arg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

async function verifyK8(directory: string): Promise<void> {
    for (const file of K8_FILES) await assertPinnedArtifactFile(resolve(directory, file.fileName), file);
    const [manifest, validation] = await Promise.all([
        readFile(resolve(directory, "database-characters-k8-manifest.json"), "utf8").then(JSON.parse),
        readFile(resolve(directory, "database-characters-k8-validation.json"), "utf8").then(JSON.parse),
    ]);
    if (manifest.sha256 !== K8_FILES[0].sha256 || manifest.sidecarCount !== 8 || manifest.projectedSidecarBytes !== 10_166_877 || validation.valid !== true || validation.failures.length !== 0) throw new Error("K8 readiness source is not green");
}

async function run() {
    const k8Dir = resolve(arg("--k8-dir") ?? "data/database-characters/k8");
    const outputDir = resolve(arg("--output-dir") ?? "data/database-characters/k9");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        await verifyK8(k8Dir);
        const firstDataset = buildDatabaseCharacterReadinessDataset();
        const coverage = buildDatabaseCharacterReadinessCoverage(firstDataset);
        const validation = validateDatabaseCharacterReadinessDataset(firstDataset, coverage);
        if (!validation.valid) throw new Error(validation.failures.join("; "));
        const first = buildDeterministicJsonGzipArtifact(firstDataset);
        const second = buildDeterministicJsonGzipArtifact(buildDatabaseCharacterReadinessDataset());
        if (!first.gzip.equals(second.gzip)) throw new Error("K9 two-generation byte identity failed");
        await verifyK8(k8Dir);

        const coverageBytes = `${JSON.stringify(coverage, null, 2)}\n`;
        const validationBytes = `${JSON.stringify(validation, null, 2)}\n`;
        const manifest = {
            schemaVersion: 1,
            contractVersion: "1.0.0",
            generatedAt: firstDataset.generatedAt,
            fileName: "database-characters-k9-readiness.json.gz",
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSizeBytes: first.json.length,
            sourceK8ReceiptSha256: firstDataset.source.k8ReceiptSha256,
            decisionCount: coverage.decisionCount,
            goCount: coverage.goCount,
            noGoCount: coverage.noGoCount,
            coverageFile: "database-characters-k9-coverage.json",
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k9-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K9 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await mkdir(outputDir, { recursive: true });
        await Promise.all([
            writeFile(resolve(outputDir, manifest.fileName), first.gzip),
            writeFile(resolve(outputDir, "database-characters-k9-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            writeFile(resolve(outputDir, manifest.coverageFile), coverageBytes),
            writeFile(resolve(outputDir, manifest.validationFile), validationBytes),
        ]);
        console.log(JSON.stringify({ outputDir, manifest, coverage, decisions: firstDataset.decisions, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
    } finally {
        clearInterval(timer);
    }
}

if (require.main === module) run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
