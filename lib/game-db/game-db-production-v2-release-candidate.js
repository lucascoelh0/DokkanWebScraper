"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProductionV2ReleaseCandidateArgs = exports.buildProductionV2ReleaseCandidate = exports.PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT = exports.PRODUCTION_V2_RELEASE_CANDIDATE_ROOT = void 0;
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("../dataset-artifacts");
const publish_r2_1 = require("../publish-r2");
exports.PRODUCTION_V2_RELEASE_CANDIDATE_ROOT = (0, path_1.resolve)("game-db", "data", "game-db-production-v2-release-candidate");
exports.PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT = "dokkan-production-v2-character-release-candidate";
const SOURCE_PREFIX = "staging/v2/images/";
const TARGET_PREFIX = "v2/images/";
const HASHED_OBJECT_KEY = /^v2\/images\/(?:v4\/portrait_[0-9]+|v5\/layers\/(?:background|thumb|overlay))\.([a-f0-9]{64})\.png$/;
const JSON_BYTES = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function assertStrictlyContained(root, target, context) {
    const child = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    if (!child || (0, path_1.isAbsolute)(child) || child === ".." || child.startsWith(`..${path_1.sep}`)) {
        throw new Error(`${context} must stay inside ${(0, path_1.resolve)(root)}`);
    }
}
function containedObjectPath(root, objectKey) {
    const normalized = objectKey.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error(`Unsafe object key: ${objectKey}`);
    }
    const target = (0, path_1.resolve)(root, ...normalized.split("/"));
    assertStrictlyContained(root, target, "Object path");
    return target;
}
function validateSourceManifest(manifest, payload, characters) {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz") {
        throw new Error("Source Character manifest contract is invalid.");
    }
    if (!manifest.datasetVersion || manifest.generatedAt !== manifest.datasetVersion) {
        throw new Error("Source Character manifest version binding is invalid.");
    }
    if (manifest.sha256 !== sha256(payload) || manifest.sizeBytes !== payload.byteLength) {
        throw new Error("Source Character payload does not match its manifest.");
    }
    const uncompressed = (0, zlib_1.gunzipSync)(payload);
    if (manifest.uncompressedSizeBytes !== uncompressed.byteLength || manifest.characterCount !== characters.length) {
        throw new Error("Source Character payload size or count does not match its manifest.");
    }
}
function rewritePortraitUrl(value, mappings) {
    if (value === undefined)
        return undefined;
    if (!value.startsWith(SOURCE_PREFIX)) {
        throw new Error(`Character portrait reference is not staging/v2 scoped: ${value}`);
    }
    const target = `${TARGET_PREFIX}${value.slice(SOURCE_PREFIX.length)}`;
    if (!HASHED_OBJECT_KEY.test(target)) {
        throw new Error(`Character portrait reference is not a recognized content-addressed object: ${value}`);
    }
    const previous = mappings.get(value);
    if (previous && previous !== target)
        throw new Error(`Conflicting production mapping for ${value}`);
    mappings.set(value, target);
    return target;
}
function rewritePortraitLayers(layers, mappings) {
    if (!layers)
        return undefined;
    return {
        backgroundURL: rewritePortraitUrl(layers.backgroundURL, mappings),
        thumbURL: rewritePortraitUrl(layers.thumbURL, mappings),
        overlayURL: rewritePortraitUrl(layers.overlayURL, mappings),
    };
}
function rewritePortraitReference(reference, mappings) {
    if (reference.portraitURL !== undefined) {
        reference.portraitURL = rewritePortraitUrl(reference.portraitURL, mappings);
    }
    if (reference.portraitLayers !== undefined) {
        reference.portraitLayers = rewritePortraitLayers(reference.portraitLayers, mappings);
    }
}
function rewriteCharacters(source) {
    const characters = structuredClone(source);
    const mappings = new Map();
    for (const character of characters) {
        rewritePortraitReference(character, mappings);
        for (const transformation of character.transformations ?? [])
            rewritePortraitReference(transformation, mappings);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ])
            rewritePortraitReference(awakening, mappings);
    }
    return { characters, mappings };
}
async function copyVerifiedObjects(mappings, sourceDataRoot, outputDir) {
    let totalBytes = 0;
    for (const [sourceKey, targetKey] of [...mappings].sort(([left], [right]) => left.localeCompare(right))) {
        const expectedHash = HASHED_OBJECT_KEY.exec(targetKey)?.[1];
        assert_1.strict.ok(expectedHash, `Missing embedded hash for ${targetKey}`);
        const sourcePath = containedObjectPath(sourceDataRoot, sourceKey);
        const sourceBytes = await (0, promises_1.readFile)(sourcePath);
        if (sha256(sourceBytes) !== expectedHash)
            throw new Error(`Source object hash mismatch: ${sourceKey}`);
        const targetPath = containedObjectPath((0, path_1.resolve)(outputDir, "objects"), targetKey);
        await (0, promises_1.mkdir)((0, path_1.resolve)(targetPath, ".."), { recursive: true });
        await (0, promises_1.writeFile)(targetPath, sourceBytes, { flag: "wx" });
        const targetBytes = await (0, promises_1.readFile)(targetPath);
        if (!targetBytes.equals(sourceBytes))
            throw new Error(`Production object copy mismatch: ${targetKey}`);
        totalBytes += sourceBytes.byteLength;
    }
    return totalBytes;
}
async function buildProductionV2ReleaseCandidate(options) {
    const sourceManifest = JSON.parse(await (0, promises_1.readFile)(options.sourceManifestPath, "utf8"));
    const sourcePayload = await (0, promises_1.readFile)(options.sourceDatasetPath);
    const sourceCharacters = JSON.parse((0, zlib_1.gunzipSync)(sourcePayload).toString("utf8"));
    validateSourceManifest(sourceManifest, sourcePayload, sourceCharacters);
    const sourceKeys = (0, publish_r2_1.collectReferencedPortraitKeys)(sourceCharacters);
    const { characters, mappings } = rewriteCharacters(sourceCharacters);
    const targetKeys = (0, publish_r2_1.collectReferencedPortraitKeys)(characters);
    if (sourceKeys.length !== mappings.size || targetKeys.length !== mappings.size) {
        throw new Error("Production projection did not preserve the complete portrait reference set.");
    }
    sourceKeys.forEach(key => assert_1.strict.equal(mappings.get(key), `${TARGET_PREFIX}${key.slice(SOURCE_PREFIX.length)}`));
    targetKeys.forEach(key => assert_1.strict.ok(key.startsWith(TARGET_PREFIX), `Unscoped production portrait key: ${key}`));
    const roundTrip = structuredClone(characters);
    for (const character of roundTrip) {
        const reverse = new Map([...mappings].map(([source, target]) => [target, source]));
        const restore = (reference) => {
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
        for (const transformation of character.transformations ?? [])
            restore(transformation);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ])
            restore(awakening);
    }
    assert_1.strict.deepEqual(roundTrip, sourceCharacters, "Production projection changed fields other than portrait delivery keys.");
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, {
        datasetVersion: sourceManifest.datasetVersion,
        generatedAt: sourceManifest.generatedAt,
        fileName: "characters.json.gz",
    });
    await (0, promises_1.mkdir)((0, path_1.resolve)(options.outputDir, ".."), { recursive: true });
    await (0, promises_1.mkdir)(options.outputDir);
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "characters.json.gz"), artifact.gzipBuffer, { flag: "wx" });
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "characters-manifest.json"), JSON_BYTES(artifact.manifest), { flag: "wx" });
    const objectBytes = await copyVerifiedObjects(mappings, options.sourceDataRoot, options.outputDir);
    const report = {
        schemaVersion: 1,
        contract: exports.PRODUCTION_V2_RELEASE_CANDIDATE_CONTRACT,
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
    await (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "production-v2-candidate-report.json"), JSON_BYTES(report), { flag: "wx" });
    return report;
}
exports.buildProductionV2ReleaseCandidate = buildProductionV2ReleaseCandidate;
function parseProductionV2ReleaseCandidateArgs(args) {
    const allowed = new Set(["--source-dataset", "--source-manifest", "--source-data-root", "--output-dir"]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!allowed.has(key) || !value || value.startsWith("--") || values.has(key)) {
            throw new Error("production v2 candidate arguments rejected");
        }
        values.set(key, value);
    }
    if (values.size !== allowed.size)
        throw new Error("production v2 candidate requires every explicit input");
    const outputDir = (0, path_1.resolve)(values.get("--output-dir"));
    assertStrictlyContained(exports.PRODUCTION_V2_RELEASE_CANDIDATE_ROOT, outputDir, "Production v2 candidate output");
    return {
        sourceDatasetPath: (0, path_1.resolve)(values.get("--source-dataset")),
        sourceManifestPath: (0, path_1.resolve)(values.get("--source-manifest")),
        sourceDataRoot: (0, path_1.resolve)(values.get("--source-data-root")),
        outputDir,
    };
}
exports.parseProductionV2ReleaseCandidateArgs = parseProductionV2ReleaseCandidateArgs;
async function main() {
    const options = parseProductionV2ReleaseCandidateArgs(process.argv.slice(2));
    await (0, promises_1.realpath)(options.sourceDataRoot);
    const report = await buildProductionV2ReleaseCandidate(options);
    console.log(JSON.stringify(report, null, 2));
}
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=game-db-production-v2-release-candidate.js.map