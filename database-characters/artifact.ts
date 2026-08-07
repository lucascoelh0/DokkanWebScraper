import { createHash } from "crypto";
import { gzipSync } from "zlib";

export interface DeterministicJsonGzipArtifact {
    json: Buffer;
    gzip: Buffer;
    sha256: string;
}

export function sha256Bytes(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
}

export function buildDeterministicJsonGzipArtifact(value: unknown): DeterministicJsonGzipArtifact {
    const json = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
    const gzip = gzipSync(json, { level: 9 });
    return { json, gzip, sha256: sha256Bytes(gzip) };
}
