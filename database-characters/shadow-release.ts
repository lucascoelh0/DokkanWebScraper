import { createHash } from "crypto";
import { CharacterShadowManifest, CharacterShadowProjection } from "./shadow-contract";
import { DatabaseCharacterShadowCoverage } from "./shadow-parity-contract";

/** Exact offline K10-K14 release identity. It is not a production authority promotion. */
export const CHARACTER_SHADOW_PINNED_RELEASE = {
    manifestSha256: "c86d7860ff56a97df3b10894ad69554ff01f64cb5455171fcb55e3548251d86f",
    manifestSizeBytes: 1_057,
    artifactSha256: "baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074",
    artifactSizeBytes: 15_906_227,
    uncompressedSha256: "6797869b430bec1cb56315c66839d0db24726603718bb0315763a9d626a7523c",
    uncompressedSizeBytes: 511_791_355,
    coverageSha256: "5018f4e4a9a01e0d9c2ac568e9555f91878cad79c47f07f0cc540e28380febd7",
    coverageSizeBytes: 108_935,
} as const;

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const prettyBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

function projectionRawIdentity(projection: CharacterShadowProjection): { sha256: string; sizeBytes: number } {
    if (!Array.isArray(projection?.fields)) throw new Error("projection fields missing");
    const digest = createHash("sha256");
    let sizeBytes = 0;
    const update = (value: string) => { digest.update(value, "utf8"); sizeBytes += Buffer.byteLength(value); };
    const { fields, ...header } = projection;
    update(`${JSON.stringify(header).slice(0, -1)},\"fields\":[`);
    fields.forEach((field, index) => update(`${index ? "," : ""}${JSON.stringify(field)}`));
    update("]}\n");
    return { sha256: digest.digest("hex"), sizeBytes };
}

export function manifestMatchesPinnedCharacterShadowRelease(manifest: CharacterShadowManifest): boolean {
    try {
        const bytes = prettyBytes(manifest);
        return bytes.length === CHARACTER_SHADOW_PINNED_RELEASE.manifestSizeBytes
            && hash(bytes) === CHARACTER_SHADOW_PINNED_RELEASE.manifestSha256
            && manifest.sha256 === CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256
            && manifest.sizeBytes === CHARACTER_SHADOW_PINNED_RELEASE.artifactSizeBytes
            && manifest.uncompressedSha256 === CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256
            && manifest.uncompressedSizeBytes === CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes
            && manifest.coverageSha256 === CHARACTER_SHADOW_PINNED_RELEASE.coverageSha256
            && manifest.coverageSizeBytes === CHARACTER_SHADOW_PINNED_RELEASE.coverageSizeBytes;
    } catch { return false; }
}

/** Offline identity audit only; successful verification never authorizes K11 delivery or consumption. */
export function verifyPinnedCharacterShadowRelease(projection: CharacterShadowProjection, coverage: DatabaseCharacterShadowCoverage, manifest: CharacterShadowManifest): boolean {
    try {
        if (!manifestMatchesPinnedCharacterShadowRelease(manifest)) return false;
        const raw = projectionRawIdentity(projection);
        const coverageBytes = prettyBytes(coverage);
        const valid = raw.sha256 === manifest.uncompressedSha256 && raw.sizeBytes === manifest.uncompressedSizeBytes
            && coverageBytes.length === manifest.coverageSizeBytes && hash(coverageBytes) === manifest.coverageSha256;
        return valid;
    } catch { return false; }
}
