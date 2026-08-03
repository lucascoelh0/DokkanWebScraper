"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = exports.writeTeamAnalysisBundle = exports.validateTeamAnalysisArtifact = exports.buildTeamAnalysisArtifact = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
function buildTeamAnalysisArtifact(dataset, options) {
    const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = (0, zlib_1.gzipSync)(utf8Buffer, { level: 9 });
    const datasetVersion = options?.datasetVersion
        ?? `${dataset.sourceCharacterDatasetVersion}:parser-${dataset.parserVersion}`;
    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: dataset.schemaVersion,
            datasetVersion,
            generatedAt: dataset.generatedAt,
            fileName: options?.fileName ?? "team-analysis.json.gz",
            compression: "gzip",
            sha256: sha256(gzipBuffer),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            stateCount: dataset.stateCount,
            rulesVersion: dataset.rulesVersion,
            parserVersion: dataset.parserVersion,
            sourceCharacterDatasetVersion: dataset.sourceCharacterDatasetVersion,
            sourceCharacterPayloadSha256: dataset.sourceCharacterPayloadSha256,
        },
    };
}
exports.buildTeamAnalysisArtifact = buildTeamAnalysisArtifact;
function validateTeamAnalysisArtifact(artifact, dataset) {
    const issues = [];
    const uncompressedSize = Buffer.byteLength(artifact.jsonText, "utf8");
    if (artifact.manifest.sha256 !== sha256(artifact.gzipBuffer)) {
        issues.push("Manifest SHA-256 does not match the gzip payload.");
    }
    if (artifact.manifest.sizeBytes !== artifact.gzipBuffer.byteLength) {
        issues.push("Manifest compressed size does not match the gzip payload.");
    }
    if (artifact.manifest.uncompressedSizeBytes !== uncompressedSize) {
        issues.push("Manifest uncompressed size does not match the JSON payload.");
    }
    if (artifact.manifest.stateCount !== dataset.states.length) {
        issues.push("Manifest state count does not match the dataset.");
    }
    if (artifact.manifest.sourceCharacterDatasetVersion !== dataset.sourceCharacterDatasetVersion) {
        issues.push("Manifest character dataset version does not match the dataset.");
    }
    if (artifact.manifest.sourceCharacterPayloadSha256 !== dataset.sourceCharacterPayloadSha256) {
        issues.push("Manifest character payload SHA-256 does not match the dataset.");
    }
    return issues;
}
exports.validateTeamAnalysisArtifact = validateTeamAnalysisArtifact;
async function writeTeamAnalysisBundle(outputDir, artifact, coverage, options) {
    const resolvedOutputDir = (0, path_1.resolve)(outputDir);
    const datasetPath = (0, path_1.resolve)(resolvedOutputDir, artifact.manifest.fileName);
    const manifestPath = (0, path_1.resolve)(resolvedOutputDir, options?.manifestFileName ?? "team-analysis-manifest.json");
    const coveragePath = (0, path_1.resolve)(resolvedOutputDir, options?.coverageFileName ?? "team-analysis-coverage.json");
    await (0, promises_1.mkdir)((0, path_1.dirname)(datasetPath), { recursive: true });
    await (0, promises_1.writeFile)(datasetPath, artifact.gzipBuffer);
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
    await (0, promises_1.writeFile)(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
}
exports.writeTeamAnalysisBundle = writeTeamAnalysisBundle;
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
exports.sha256 = sha256;
//# sourceMappingURL=team-analysis-artifacts.js.map