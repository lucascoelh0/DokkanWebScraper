import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { lstat, open, realpath } from "fs/promises";
import { join, resolve } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import { resolveCharacterInputFile } from "./artifact-path";
import type { CharacterStructuralIdentitySidecar } from "./structural-sidecar-contract";
import { CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN } from "./structural-sidecar-contract";
import type { CharacterStructuralShadowEvaluation } from "./structural-shadow-contract";
import { evaluateCharacterStructuralRepresentation } from "./structural-shadow-evaluator";

interface ProductiveManifest {
    schemaVersion: 1;
    datasetVersion: string;
    generatedAt: string;
    fileName: string;
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    characterCount: number;
}

interface FileSnapshot {
    path: string;
    bytes: Buffer;
    metadata: Stats;
}

export interface CharacterStructuralShadowProductiveSource {
    evaluate(sidecar: CharacterStructuralIdentitySidecar): CharacterStructuralShadowEvaluation;
    revalidate(): Promise<void>;
    dispose(): void;
}

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

async function regularRoot(value: string): Promise<string> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("K33 productive root must be a regular non-link directory");
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error("K33 productive root symlink or junction rejected");
    return canonical;
}

async function readSnapshot(root: string, fileName: string): Promise<FileSnapshot> {
    const path = await resolveCharacterInputFile(root, fileName, fileName);
    const direct = join(root, fileName);
    if (!samePath(path, direct)) throw new Error(`K33 productive ${fileName} escaped its literal contained path`);
    const before = await lstat(direct);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
        throw new Error(`K33 productive ${fileName} must be a single-link regular non-link file`);
    }
    const handle = await open(direct, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened)) {
            throw new Error(`K33 productive ${fileName} identity changed while opening`);
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const afterPath = await lstat(direct);
        if (!afterPath.isFile() || afterPath.isSymbolicLink() || afterPath.nlink !== 1
            || !sameFile(opened, after) || !sameFile(opened, afterPath)
            || after.size !== bytes.length || afterPath.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
            || afterPath.mtimeMs !== opened.mtimeMs || afterPath.ctimeMs !== opened.ctimeMs) {
            throw new Error(`K33 productive ${fileName} changed while reading`);
        }
        return { path: direct, bytes, metadata: after };
    } finally {
        await handle.close();
    }
}

function exact(snapshot: FileSnapshot, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (snapshot.bytes.length !== expected.sizeBytes || hash(snapshot.bytes) !== expected.sha256) {
        throw new Error(`K33 ${label} identity changed`);
    }
}

function unchanged(before: FileSnapshot, after: FileSnapshot, label: string): void {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata)
        || before.metadata.size !== after.metadata.size || before.metadata.mtimeMs !== after.metadata.mtimeMs
        || before.metadata.ctimeMs !== after.metadata.ctimeMs || !before.bytes.equals(after.bytes)) {
        throw new Error(`K33 ${label} changed during shadow evaluation`);
    }
}

async function gunzipExactlyBounded(bytes: Buffer, exactSizeBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = Readable.from([bytes]).pipe(createGunzip());
    for await (const value of stream) {
        const chunk = Buffer.from(value as Buffer);
        size += chunk.length;
        if (size > exactSizeBytes) {
            stream.destroy();
            throw new Error("K33 productive decompression exceeded pinned size");
        }
        chunks.push(chunk);
    }
    if (size !== exactSizeBytes) throw new Error("K33 productive uncompressed size changed");
    return Buffer.concat(chunks, size);
}

function validateManifest(value: ProductiveManifest): void {
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    if (value?.schemaVersion !== 1 || value.datasetVersion !== pin.datasetVersion || value.generatedAt !== pin.datasetVersion
        || value.fileName !== pin.manifestPayloadFile || value.compression !== "gzip" || value.sha256 !== pin.payloadSha256
        || value.sizeBytes !== pin.payloadSizeBytes || value.uncompressedSizeBytes !== pin.uncompressedSizeBytes
        || value.characterCount !== pin.topLevelCount) throw new Error("K33 productive Character manifest lineage changed");
}

export async function loadCharacterStructuralShadowProductiveSource(
    productiveRootValue: string,
): Promise<CharacterStructuralShadowProductiveSource> {
    const root = await regularRoot(productiveRootValue);
    const pin = CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters;
    const [manifestSnapshot, payloadSnapshot] = await Promise.all([
        readSnapshot(root, pin.manifestFile),
        readSnapshot(root, pin.localPayloadFile),
    ]);
    exact(manifestSnapshot, { sha256: pin.manifestSha256, sizeBytes: pin.manifestSizeBytes }, "productive manifest");
    exact(payloadSnapshot, { sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes }, "productive payload");
    validateManifest(JSON.parse(manifestSnapshot.bytes.toString("utf8")) as ProductiveManifest);
    let raw: Buffer | null = await gunzipExactlyBounded(payloadSnapshot.bytes, pin.uncompressedSizeBytes);
    const parsedCharacters = JSON.parse(raw.toString("utf8")) as unknown;
    if (!Array.isArray(parsedCharacters) || parsedCharacters.length !== pin.topLevelCount) throw new Error("K33 productive Character[] cardinality changed");
    let characters: unknown[] | null = parsedCharacters;
    const characterSnapshotSha256 = hash(Buffer.from(JSON.stringify(characters), "utf8"));
    raw = null;

    return {
        evaluate(sidecar: CharacterStructuralIdentitySidecar): CharacterStructuralShadowEvaluation {
            if (!characters) throw new Error("K33 productive source already disposed");
            const sidecarSnapshotSha256 = hash(Buffer.from(JSON.stringify(sidecar), "utf8"));
            const result = evaluateCharacterStructuralRepresentation(sidecar, characters);
            if (hash(Buffer.from(JSON.stringify(sidecar), "utf8")) !== sidecarSnapshotSha256
                || hash(Buffer.from(JSON.stringify(characters), "utf8")) !== characterSnapshotSha256) {
                throw new Error("K33 input object mutation detected");
            }
            return result;
        },
        async revalidate(): Promise<void> {
            const [manifestAfter, payloadAfter] = await Promise.all([
                readSnapshot(root, pin.manifestFile),
                readSnapshot(root, pin.localPayloadFile),
            ]);
            exact(manifestAfter, { sha256: pin.manifestSha256, sizeBytes: pin.manifestSizeBytes }, "productive manifest revalidation");
            exact(payloadAfter, { sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes }, "productive payload revalidation");
            unchanged(manifestSnapshot, manifestAfter, "productive manifest");
            unchanged(payloadSnapshot, payloadAfter, "productive payload");
        },
        dispose(): void {
            characters = null;
            manifestSnapshot.bytes = Buffer.alloc(0);
            payloadSnapshot.bytes = Buffer.alloc(0);
        },
    };
}
