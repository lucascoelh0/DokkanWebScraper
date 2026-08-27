import { strict as assert } from "assert";
import { createHash } from "crypto";
import { mkdir, readFile, realpath, writeFile } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import type { AwakeningReference, Character, PortraitLayers, Transformation } from "../character";
import { buildCharacterDatasetArtifact, type DatasetManifest } from "../dataset-artifacts";
import { collectReferencedPortraitKeys } from "../publish-r2";

export const PRODUCTION_V2_RELEASE_CANDIDATE_ROOT = resolve(
    "game-db",
    "data",
    "game-db-production-v2-release-candidate",
);
export const PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT = "dokkan-production-v2-character-release-candidate";
const SOURCE_PREFIX = "staging/v2/images/";
const TARGET_PREFIX = "v2/images/";
const HASHED_OBJECT_KEY = /^v2\/images\/(?:v4\/portrait_[0-9]+|v5\/layers\/(?:background|thumb|overlay))\.([a-f0-9]{64})\.png$/;
const JSON_BYTES = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

export interface ProductionV2ReleaseCandidateOptions {
    sourceDatasetPath: string,
    sourceManifestPath: string,
    sourceDataRoot: string,
    outputDir: string,
}

export interface ProductionV2ReleaseCandidateReport {
    schemaVersion: 1,
    contract: typeof PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT,
    contractVersion: "1.0.0",
    source: {
        datasetVersion: string,
        payloadSha256: string,
        characterCount: number,
        referenceCount: number,
        referencePrefix: typeof SOURCE_PREFIX,
    },
    target: {
        datasetVersion: string,
        payloadSha256: string,
        characterCount: number,
        referenceCount: number,
        referencePrefix: typeof TARGET_PREFIX,
        objectBytes: number,
    },
    changedReferenceCount: number,
    gates: {
        characterProjection: "GO",
        teamAnalysisRebind: "PENDING",
        pairValidation: "PENDING",
        publisherDryRun: "NO-GO",
        publication: "NO-GO",
    },
}

type PortraitReference = Character | Transformation | AwakeningReference;

function assertStrictlyContained(root: string, target: string, context: string): void {
    const child = relative(resolve(root), resolve(target));
    if (!child || isAbsolute(child) || child === ".." || child.startsWith(`..${sep}`)) {
        throw new Error(`${context} must stay inside ${resolve(root)}`);
    }
}

function containedObjectPath(root: string, objectKey: string): string {
    const normalized = objectKey.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error(`Unsafe object key: ${objectKey}`);
    }
    const target = resolve(root, ...normalized.split("/"));
    assertStrictlyContained(root, target, "Object path");
    return target;
}

function validateSourceManifest(manifest: DatasetManifest, payload: Buffer, characters: Character[]): void {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz") {
        throw new Error("Source Character manifest contract is invalid.");
    }
    if (!manifest.datasetVersion || manifest.generatedAt !== manifest.datasetVersion) {
        throw new Error("Source Character manifest version binding is invalid.");
    }
    if (manifest.sha256 !== sha256(payload) || manifest.sizeBytes !== payload.byteLength) {
        throw new Error("Source Character payload does not match its manifest.");
    }
    const uncompressed = gunzipSync(payload);
    if (manifest.uncompressedSizeBytes !== uncompressed.byteLength || manifest.characterCount !== characters.length) {
        throw new Error("Source Character payload size or count does not match its manifest.");
    }
}

function rewritePortraitUrl(
    value: string | undefined,
    mappings: Map<string, string>,
): string | undefined {
    if (value === undefined) return undefined;
    if (!value.startsWith(SOURCE_PREFIX)) {
        throw new Error(`Character portrait reference is not staging/v2 scoped: ${value}`);
    }
    const target = `${TARGET_PREFIX}${value.slice(SOURCE_PREFIX.length)}`;
    if (!HASHED_OBJECT_KEY.test(target)) {
        throw new Error(`Character portrait reference is not a recognized content-addressed object: ${value}`);
    }
    const previous = mappings.get(value);
    if (previous && previous !== target) throw new Error(`Conflicting production mapping for ${value}`);
    mappings.set(value, target);
    return target;
}

function rewritePortraitLayers(
    layers: PortraitLayers | undefined,
    mappings: Map<string, string>,
): PortraitLayers | undefined {
    if (!layers) return undefined;
    return {
        backgroundURL: rewritePortraitUrl(layers.backgroundURL, mappings)!,
        thumbURL: rewritePortraitUrl(layers.thumbURL, mappings)!,
        overlayURL: rewritePortraitUrl(layers.overlayURL, mappings)!,
    };
}

function rewritePortraitReference(reference: PortraitReference, mappings: Map<string, string>): void {
    if (reference.portraitURL !== undefined) {
        reference.portraitURL = rewritePortraitUrl(reference.portraitURL, mappings)!;
    }
    if (reference.portraitLayers !== undefined) {
        reference.portraitLayers = rewritePortraitLayers(reference.portraitLayers, mappings);
    }
}

function rewriteCharacters(source: Character[]): { characters: Character[], mappings: Map<string, string> } {
    const characters = structuredClone(source);
    const mappings = new Map<string, string>();
    for (const character of characters) {
        rewritePortraitReference(character, mappings);
        for (const transformation of character.transformations ?? []) rewritePortraitReference(transformation, mappings);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) rewritePortraitReference(awakening, mappings);
    }
    return { characters, mappings };
}

async function copyVerifiedObjects(
    mappings: Map<string, string>,
    sourceDataRoot: string,
    outputDir: string,
): Promise<number> {
    let totalBytes = 0;
    for (const [sourceKey, targetKey] of [...mappings].sort(([left], [right]) => left.localeCompare(right))) {
        const expectedHash = HASHED_OBJECT_KEY.exec(targetKey)?.[1];
        assert.ok(expectedHash, `Missing embedded hash for ${targetKey}`);
        const sourcePath = containedObjectPath(sourceDataRoot, sourceKey);
        const sourceBytes = await readFile(sourcePath);
        if (sha256(sourceBytes) !== expectedHash) throw new Error(`Source object hash mismatch: ${sourceKey}`);
        const targetPath = containedObjectPath(resolve(outputDir, "objects"), targetKey);
        await mkdir(resolve(targetPath, ".."), { recursive: true });
        await writeFile(targetPath, sourceBytes, { flag: "wx" });
        const targetBytes = await readFile(targetPath);
        if (!targetBytes.equals(sourceBytes)) throw new Error(`Production object copy mismatch: ${targetKey}`);
        totalBytes += sourceBytes.byteLength;
    }
    return totalBytes;
}

export async function buildProductionV2ReleaseCandidate(
    options: ProductionV2ReleaseCandidateOptions,
): Promise<ProductionV2ReleaseCandidateReport> {
    const sourceManifest = JSON.parse(await readFile(options.sourceManifestPath, "utf8")) as DatasetManifest;
    const sourcePayload = await readFile(options.sourceDatasetPath);
    const sourceCharacters = JSON.parse(gunzipSync(sourcePayload).toString("utf8")) as Character[];
    validateSourceManifest(sourceManifest, sourcePayload, sourceCharacters);

    const sourceKeys = collectReferencedPortraitKeys(sourceCharacters);
    const { characters, mappings } = rewriteCharacters(sourceCharacters);
    const targetKeys = collectReferencedPortraitKeys(characters);
    if (sourceKeys.length !== mappings.size || targetKeys.length !== mappings.size) {
        throw new Error("Production projection did not preserve the complete portrait reference set.");
    }
    sourceKeys.forEach(key => assert.equal(mappings.get(key), `${TARGET_PREFIX}${key.slice(SOURCE_PREFIX.length)}`));
    targetKeys.forEach(key => assert.ok(key.startsWith(TARGET_PREFIX), `Unscoped production portrait key: ${key}`));

    const roundTrip = structuredClone(characters);
    for (const character of roundTrip) {
        const reverse = new Map([...mappings].map(([source, target]) => [target, source]));
        const restore = (reference: PortraitReference) => {
            reference.portraitURL = reverse.get(reference.portraitURL) ?? reference.portraitURL;
            if (reference.portraitLayers) {
                reference.portraitLayers = {
                    backgroundURL: reverse.get(reference.portraitLayers.backgroundURL) ?? reference.portraitLayers.backgroundURL,
                    thumbURL: reverse.get(reference.portraitLayers.thumbURL) ?? reference.portraitLayers.thumbURL,
                    overlayURL: reverse.get(reference.portraitLayers.overlayURL) ?? reference.portraitLayers.overlayURL,
                };
            }
        };
        restore(character);
        for (const transformation of character.transformations ?? []) restore(transformation);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) restore(awakening);
    }
    assert.deepEqual(roundTrip, sourceCharacters, "Production projection changed fields other than portrait delivery keys.");

    const artifact = buildCharacterDatasetArtifact(characters, {
        datasetVersion: sourceManifest.datasetVersion,
        generatedAt: sourceManifest.generatedAt,
        fileName: "characters.json.gz",
    });
    await mkdir(resolve(options.outputDir, ".."), { recursive: true });
    await mkdir(options.outputDir);
    await writeFile(resolve(options.outputDir, "characters.json.gz"), artifact.gzipBuffer, { flag: "wx" });
    await writeFile(resolve(options.outputDir, "characters-manifest.json"), JSON_BYTES(artifact.manifest), { flag: "wx" });
    const objectBytes = await copyVerifiedObjects(mappings, options.sourceDataRoot, options.outputDir);

    const report: ProductionV2ReleaseCandidateReport = {
        schemaVersion: 1,
        contract: PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT,
        contractVersion: "1.0.0",
        source: {
            datasetVersion: sourceManifest.datasetVersion,
            payloadSha256: sourceManifest.sha256,
            characterCount: sourceCharacters.length,
            referenceCount: sourceKeys.length,
            referencePrefix: SOURCE_PREFIX,
        },
        target: {
            datasetVersion: artifact.manifest.datasetVersion,
            payloadSha256: artifact.manifest.sha256,
            characterCount: characters.length,
            referenceCount: targetKeys.length,
            referencePrefix: TARGET_PREFIX,
            objectBytes,
        },
        changedReferenceCount: mappings.size,
        gates: {
            characterProjection: "GO",
            teamAnalysisRebind: "PENDING",
            pairValidation: "PENDING",
            publisherDryRun: "NO-GO",
            publication: "NO-GO",
        },
    };
    await writeFile(resolve(options.outputDir, "production-v2-candidate-report.json"), JSON_BYTES(report), { flag: "wx" });
    return report;
}

export function parseProductionV2ReleaseCandidateArgs(args: string[]): ProductionV2ReleaseCandidateOptions {
    const allowed = new Set(["--source-dataset", "--source-manifest", "--source-data-root", "--output-dir"]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!allowed.has(key) || !value || value.startsWith("--") || values.has(key)) {
            throw new Error("production v2 candidate arguments rejected");
        }
        values.set(key, value);
    }
    if (values.size !== allowed.size) throw new Error("production v2 candidate requires every explicit input");
    const outputDir = resolve(values.get("--output-dir") as string);
    assertStrictlyContained(PRODUCTION_V2_RELEASE_CANDIDATE_ROOT, outputDir, "Production v2 candidate output");
    return {
        sourceDatasetPath: resolve(values.get("--source-dataset") as string),
        sourceManifestPath: resolve(values.get("--source-manifest") as string),
        sourceDataRoot: resolve(values.get("--source-data-root") as string),
        outputDir,
    };
}

async function main(): Promise<void> {
    const options = parseProductionV2ReleaseCandidateArgs(process.argv.slice(2));
    await realpath(options.sourceDataRoot);
    const report = await buildProductionV2ReleaseCandidate(options);
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
