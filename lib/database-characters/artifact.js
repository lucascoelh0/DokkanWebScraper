"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeterministicJsonGzipArtifact = exports.sha256Bytes = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
function sha256Bytes(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
exports.sha256Bytes = sha256Bytes;
function buildDeterministicJsonGzipArtifact(value) {
    const json = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
    const gzip = (0, zlib_1.gzipSync)(json, { level: 9 });
    return { json, gzip, sha256: sha256Bytes(gzip) };
}
exports.buildDeterministicJsonGzipArtifact = buildDeterministicJsonGzipArtifact;
//# sourceMappingURL=artifact.js.map