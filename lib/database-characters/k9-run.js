"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_1 = require("./artifact");
const artifact_path_1 = require("./artifact-path");
const readiness_builder_1 = require("./readiness-builder");
const readiness_validator_1 = require("./readiness-validator");
const source_1 = require("./source");
const K8_FILES = [
    { fileName: "database-characters-k8-refresh-receipt.json.gz", sha256: "f91c894a7ebbd6a48380f73c68282e2f4f12c337367ff3b1de5cf07f01c19798", sizeBytes: 3158 },
    { fileName: "database-characters-k8-manifest.json", sha256: "e28fd73c929494f78f65b39552601f496dffaf323b909e84244fd5b8f5fcd133", sizeBytes: 1096 },
    { fileName: "database-characters-k8-coverage.json", sha256: "f3e09d86a47959af641c17f3aeb793f79ebcce56d1e695c05cd4edab2d1b1e1c", sizeBytes: 251 },
    { fileName: "database-characters-k8-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 },
];
function arg(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}
async function verifyK8(directory) {
    const paths = new Map();
    for (const file of K8_FILES) {
        const path = await (0, artifact_path_1.resolveCharacterInputFile)(directory, file.fileName, file.fileName);
        paths.set(file.fileName, path);
        await (0, source_1.assertPinnedArtifactFile)(path, file);
    }
    const [manifest, validation] = await Promise.all([
        (0, promises_1.readFile)(paths.get("database-characters-k8-manifest.json"), "utf8").then(JSON.parse),
        (0, promises_1.readFile)(paths.get("database-characters-k8-validation.json"), "utf8").then(JSON.parse),
    ]);
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== "1.0.0" || manifest.compression !== "gzip" || manifest.fileName !== K8_FILES[0].fileName || manifest.coverageFile !== K8_FILES[2].fileName || manifest.validationFile !== K8_FILES[3].fileName || manifest.sha256 !== K8_FILES[0].sha256 || manifest.sidecarCount !== 8 || manifest.projectedSidecarBytes !== 10166877 || validation.valid !== true || validation.failures.length !== 0)
        throw new Error("K8 readiness source is not green");
}
async function run() {
    const k8Dir = (0, path_1.resolve)(arg("--k8-dir") ?? "data/database-characters/k8");
    const outputDir = (0, path_1.resolve)(arg("--output-dir") ?? "data/database-characters/k9");
    let peakRssBytes = process.memoryUsage().rss;
    const timer = setInterval(() => peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss), 25);
    try {
        await verifyK8(k8Dir);
        const firstDataset = (0, readiness_builder_1.buildDatabaseCharacterReadinessDataset)();
        const coverage = (0, readiness_builder_1.buildDatabaseCharacterReadinessCoverage)(firstDataset);
        const validation = (0, readiness_validator_1.validateDatabaseCharacterReadinessDataset)(firstDataset, coverage);
        if (!validation.valid)
            throw new Error(validation.failures.join("; "));
        const first = (0, artifact_1.buildDeterministicJsonGzipArtifact)(firstDataset);
        const second = (0, artifact_1.buildDeterministicJsonGzipArtifact)((0, readiness_builder_1.buildDatabaseCharacterReadinessDataset)());
        if (!first.gzip.equals(second.gzip))
            throw new Error("K9 two-generation byte identity failed");
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
            coverageSha256: (0, artifact_1.sha256Bytes)(coverageBytes),
            coverageSizeBytes: Buffer.byteLength(coverageBytes),
            validationFile: "database-characters-k9-validation.json",
            validationSha256: (0, artifact_1.sha256Bytes)(validationBytes),
            validationSizeBytes: Buffer.byteLength(validationBytes),
        };
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= 1073741824)
            throw new Error(`K9 exceeded 1 GiB RSS ceiling: ${peakRssBytes}`);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), first.gzip),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "database-characters-k9-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverageFile), coverageBytes),
            (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validationFile), validationBytes),
        ]);
        console.log(JSON.stringify({ outputDir, manifest, coverage, decisions: firstDataset.decisions, twoGenerationByteIdentical: true, peakRssBytes }, null, 2));
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
//# sourceMappingURL=k9-run.js.map