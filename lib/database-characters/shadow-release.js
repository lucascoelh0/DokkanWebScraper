"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPinnedCharacterShadowRelease = exports.manifestMatchesPinnedCharacterShadowRelease = exports.CHARACTER_SHADOW_PINNED_RELEASE = void 0;
const crypto_1 = require("crypto");
/** Exact offline K10-K14 release identity. It is not a production authority promotion. */
exports.CHARACTER_SHADOW_PINNED_RELEASE = {
    manifestSha256: "c86d7860ff56a97df3b10894ad69554ff01f64cb5455171fcb55e3548251d86f",
    manifestSizeBytes: 1057,
    artifactSha256: "baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074",
    artifactSizeBytes: 15906227,
    uncompressedSha256: "6797869b430bec1cb56315c66839d0db24726603718bb0315763a9d626a7523c",
    uncompressedSizeBytes: 511791355,
    coverageSha256: "5018f4e4a9a01e0d9c2ac568e9555f91878cad79c47f07f0cc540e28380febd7",
    coverageSizeBytes: 108935,
};
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const prettyBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
function projectionRawIdentity(projection) {
    if (!Array.isArray(projection?.fields))
        throw new Error("projection fields missing");
    const digest = (0, crypto_1.createHash)("sha256");
    let sizeBytes = 0;
    const update = (value) => { digest.update(value, "utf8"); sizeBytes += Buffer.byteLength(value); };
    const { fields, ...header } = projection;
    update(`${JSON.stringify(header).slice(0, -1)},\"fields\":[`);
    fields.forEach((field, index) => update(`${index ? "," : ""}${JSON.stringify(field)}`));
    update("]}\n");
    return { sha256: digest.digest("hex"), sizeBytes };
}
function manifestMatchesPinnedCharacterShadowRelease(manifest) {
    try {
        const bytes = prettyBytes(manifest);
        return bytes.length === exports.CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes
            && hash(bytes) === exports.CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256
            && manifest.sha256 === exports.CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256
            && manifest.sizeBytes === exports.CHARACTER_SHADOW_PINNED_RELEASE.artifactSizeBytes
            && manifest.uncompressedSha256 === exports.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256
            && manifest.uncompressedSizeBytes === exports.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes
            && manifest.coverageSha256 === exports.CHARACTER_SHADOW_PINNED_RELEASE.coverageSha256
            && manifest.coverageSizeBytes === exports.CHARACTER_SHADOW_PINNED_RELEASE.coverageSizeBytes;
    }
    catch {
        return false;
    }
}
exports.manifestMatchesPinnedCharacterShadowRelease = manifestMatchesPinnedCharacterShadowRelease;
/** Offline identity audit only; successful verification never authorizes K11 delivery or consumption. */
function verifyPinnedCharacterShadowRelease(projection, coverage, manifest) {
    try {
        if (!manifestMatchesPinnedCharacterShadowRelease(manifest))
            return false;
        const raw = projectionRawIdentity(projection);
        const coverageBytes = prettyBytes(coverage);
        const valid = raw.sha256 === manifest.uncompressedSha256 && raw.sizeBytes === manifest.uncompressedSizeBytes
            && coverageBytes.length === manifest.coverageSizeBytes && hash(coverageBytes) === manifest.coverageSha256;
        return valid;
    }
    catch {
        return false;
    }
}
exports.verifyPinnedCharacterShadowRelease = verifyPinnedCharacterShadowRelease;
//# sourceMappingURL=shadow-release.js.map