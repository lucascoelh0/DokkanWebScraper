"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeCharacterDatasetBundle = exports.buildCharacterDatasetArtifact = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
function buildCharacterDatasetArtifact(characters, options) {
    const jsonText = `${JSON.stringify(characters, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = (0, zlib_1.gzipSync)(utf8Buffer, { level: 9 });
    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: 1,
            datasetVersion: options.datasetVersion,
            generatedAt: options.generatedAt,
            fileName: options.fileName ?? "characters.json.gz",
            compression: "gzip",
            sha256: (0, crypto_1.createHash)("sha256").update(gzipBuffer).digest("hex"),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            characterCount: characters.length,
        },
    };
}
exports.buildCharacterDatasetArtifact = buildCharacterDatasetArtifact;
async function writeCharacterDatasetBundle(outputDir, artifact, options) {
    const resolvedOutputDir = (0, path_1.resolve)(outputDir);
    const manifestFileName = options?.manifestFileName ?? "characters-manifest.json";
    const datasetPath = (0, path_1.resolve)(resolvedOutputDir, artifact.manifest.fileName);
    const manifestPath = (0, path_1.resolve)(resolvedOutputDir, manifestFileName);
    await (0, promises_1.mkdir)((0, path_1.dirname)(datasetPath), { recursive: true });
    await (0, promises_1.mkdir)((0, path_1.dirname)(manifestPath), { recursive: true });
    await (0, promises_1.writeFile)(datasetPath, artifact.gzipBuffer);
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, { encoding: "utf8" });
}
exports.writeCharacterDatasetBundle = writeCharacterDatasetBundle;
//# sourceMappingURL=dataset-artifacts.js.map