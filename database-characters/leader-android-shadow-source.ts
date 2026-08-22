import { createHash } from "crypto";
import { constants } from "fs";
import { lstat, mkdir, open, readdir, realpath, stat } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import { gunzipSync } from "zlib";
import {
    CHARACTER_LEADER_ANDROID_SHADOW_FILES,
    CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN,
    CharacterLeaderAndroidShadowArtifactSet,
    CharacterLeaderAndroidShadowDataset,
    CharacterLeaderAndroidShadowManifest,
    CharacterLeaderAndroidShadowProvenancePin,
    CharacterLeaderAndroidShadowValidation,
} from "./leader-android-shadow-contract";
import { assertRealCharacterLeaderAndroidShadowArtifactBytes } from "./leader-android-shadow";
import { readCharacterLeaderSupportedCompatibilityK56 } from "./leader-supported-compatibility-source";
import {
    CharacterLeaderCompatibilityAndroidSourceIdentity,
    verifyCharacterLeaderCompatibilityAndroidSourcePin,
} from "./leader-supported-compatibility-git-source";
import type { CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

function samePath(left: string, right: string): boolean {
    const a = resolve(left), b = resolve(right);
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function pathsOverlap(left: string, right: string): boolean {
    const a = resolve(left), b = resolve(right);
    const leftToRight = relative(a, b), rightToLeft = relative(b, a);
    const inside = (value: string): boolean => value === "" || !value.startsWith("..") && !isAbsolute(value);
    return inside(leftToRight) || inside(rightToLeft);
}

async function canonicalDirectory(value: string, label: string): Promise<string> {
    if (!value || !isAbsolute(value)) throw new Error(`K64 ${label} must be absolute`);
    const path = resolve(value);
    const [metadata, canonical] = await Promise.all([lstat(path), realpath(path)]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(path, canonical)) {
        throw new Error(`K64 ${label} must be a canonical non-link directory`);
    }
    return path;
}

async function readExactFile(path: string, maximumBytesExclusive: number, label: string): Promise<Buffer> {
    const handle = await open(path, constants.O_RDONLY | O_NOFOLLOW);
    try {
        const before = await handle.stat();
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size <= 0
            || before.size >= maximumBytesExclusive) throw new Error(`K64 ${label} file rejected`);
        const bytes = Buffer.alloc(before.size);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (result.bytesRead <= 0) throw new Error(`K64 ${label} short read`);
            offset += result.bytesRead;
        }
        const after = await handle.stat();
        if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
            || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.nlink !== after.nlink) {
            throw new Error(`K64 ${label} changed during read`);
        }
        return bytes;
    } finally {
        await handle.close();
    }
}

function parseCanonical<T>(bytes: Buffer, label: string): T {
    let value: T;
    try { value = JSON.parse(bytes.toString("utf8")) as T; }
    catch { throw new Error(`K64 ${label} JSON rejected`); }
    if (!Buffer.from(JSON.stringify(value), "utf8").equals(bytes)) throw new Error(`K64 ${label} is not canonical JSON`);
    return value;
}

export async function loadCharacterLeaderAndroidShadowSources(
    k56Root: string,
    androidRepository: string,
): Promise<{
    k56: CharacterLeaderSupportedProjectionArtifactSet;
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity;
}> {
    if (pathsOverlap(k56Root, androidRepository)) throw new Error("K64 source roots overlap");
    const [k56, androidSource] = await Promise.all([
        readCharacterLeaderSupportedCompatibilityK56(k56Root),
        verifyCharacterLeaderCompatibilityAndroidSourcePin(
            androidRepository,
            CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.android,
        ),
    ]);
    return { k56, androidSource };
}

export async function validateCharacterLeaderAndroidShadowRootSeparation(
    k56Root: string,
    androidRepository: string,
    outputRoot: string,
): Promise<void> {
    const [k56, android, outputParent] = await Promise.all([
        canonicalDirectory(k56Root, "K56 root"),
        canonicalDirectory(androidRepository, "Android repository"),
        canonicalDirectory(dirname(resolve(outputRoot)), "output parent"),
    ]);
    const output = resolve(outputRoot);
    if (!isAbsolute(outputRoot) || !samePath(dirname(output), outputParent)
        || pathsOverlap(k56, android) || pathsOverlap(k56, output) || pathsOverlap(android, output)) {
        throw new Error("K64 source/output roots overlap or output parent changed");
    }
    try {
        await lstat(output);
        throw new Error("K64 output root already exists");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

async function writeExclusive(path: string, bytes: Buffer): Promise<void> {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW, 0o600);
    try {
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.write(bytes, offset, bytes.length - offset, offset);
            if (result.bytesWritten <= 0) throw new Error("K64 output short write");
            offset += result.bytesWritten;
        }
        await handle.sync();
    } finally {
        await handle.close();
    }
}

export async function writeCharacterLeaderAndroidShadowArtifacts(
    outputRoot: string,
    artifacts: CharacterLeaderAndroidShadowArtifactSet,
): Promise<void> {
    assertRealCharacterLeaderAndroidShadowArtifactBytes(artifacts);
    await mkdir(outputRoot, { recursive: false, mode: 0o700 });
    await writeExclusive(resolve(outputRoot, artifacts.manifest.fileName), artifacts.gzip);
    await writeExclusive(resolve(outputRoot, CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin), artifacts.provenancePinBytes);
    await writeExclusive(resolve(outputRoot, CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation), artifacts.validationBytes);
    await writeExclusive(resolve(outputRoot, CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest), artifacts.manifestBytes);
}

export async function readCharacterLeaderAndroidShadowArtifacts(
    rootValue: string,
    expectedProvenancePinSha256: string,
): Promise<CharacterLeaderAndroidShadowArtifactSet> {
    const root = await canonicalDirectory(rootValue, "artifact root");
    const entries = await readdir(root, { withFileTypes: true });
    if (entries.length !== 4 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) {
        throw new Error("K64 artifact inventory rejected");
    }
    const manifestBytes = await readExactFile(
        resolve(root, CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest),
        CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
        "manifest",
    );
    const manifest = parseCanonical<CharacterLeaderAndroidShadowManifest>(manifestBytes, "manifest");
    const expected = [
        manifest.fileName,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation,
    ].sort();
    if (JSON.stringify(entries.map(entry => entry.name).sort()) !== JSON.stringify(expected)) {
        throw new Error("K64 artifact member names rejected");
    }
    const [gzip, provenancePinBytes, validationBytes] = await Promise.all([
        readExactFile(resolve(root, manifest.fileName), CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES, "payload"),
        readExactFile(
            resolve(root, CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin),
            CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
            "provenance pin",
        ),
        readExactFile(
            resolve(root, CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation),
            CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
            "validation",
        ),
    ]);
    const raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES });
    const dataset = parseCanonical<CharacterLeaderAndroidShadowDataset>(raw, "payload");
    const provenancePin = parseCanonical<CharacterLeaderAndroidShadowProvenancePin>(provenancePinBytes, "provenance pin");
    const validation = parseCanonical<CharacterLeaderAndroidShadowValidation>(validationBytes, "validation");
    const artifacts = {
        dataset, manifest, provenancePin, validation, raw, gzip, manifestBytes, provenancePinBytes, validationBytes,
    };
    if (!/^[a-f0-9]{64}$/.test(expectedProvenancePinSha256)
        || createHash("sha256").update(provenancePinBytes).digest("hex") !== expectedProvenancePinSha256) {
        throw new Error("K64 externally supplied provenance pin identity rejected");
    }
    assertRealCharacterLeaderAndroidShadowArtifactBytes(artifacts);
    const rootAfter = await stat(root);
    if (!rootAfter.isDirectory()) throw new Error("K64 artifact root changed");
    return artifacts;
}
