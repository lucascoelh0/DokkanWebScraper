"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFirstPartyPortraitCandidateArgs = exports.buildFirstPartyPortraitCandidate = exports.FIRST_PARTY_PORTRAIT_CANDIDATE_CONTRACT = exports.FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT = exports.FIRST_PARTY_PORTRAIT_CANDIDATE_ROOT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const sharp = require("sharp");
const dataset_artifacts_1 = require("../dataset-artifacts");
const first_party_portrait_compositor_1 = require("./first-party-portrait-compositor");
const game_db_first_party_portrait_spec_1 = require("./game-db-first-party-portrait-spec");
const game_db_source_1 = require("./game-db-source");
exports.FIRST_PARTY_PORTRAIT_CANDIDATE_ROOT = (0, path_1.resolve)("game-db", "data", "game-db-first-party-portrait-candidate");
exports.FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT = "dokkan-official-installed-portrait-source";
exports.FIRST_PARTY_PORTRAIT_CANDIDATE_CONTRACT = "dokkan-first-party-portrait-staging-candidate";
const PORTRAIT_OBJECT_KEY = /^staging\/v2\/images\/v4\/portrait_(\d+)\.([a-f0-9]{64})\.png$/;
const PORTRAIT_LAYER_OBJECT_KEY = /^staging\/v2\/images\/v5\/layers\/(background|thumb|overlay)\.([a-f0-9]{64})\.png$/;
const JSON_BYTES = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function isStrictlyContained(root, target) {
    const child = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    return child.length > 0 && child !== ".." && !child.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(child);
}
function assertSafeRelativePath(value, context) {
    const normalized = value.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error(`${context} has an unsafe relative path`);
    }
    return normalized;
}
function containedPath(root, relativePath) {
    const canonicalRoot = (0, path_1.resolve)(root);
    const target = (0, path_1.resolve)(canonicalRoot, ...assertSafeRelativePath(relativePath, "candidate object").split("/"));
    if (!isStrictlyContained(canonicalRoot, target))
        throw new Error("candidate object escaped its root");
    return target;
}
async function readJson(path) {
    return JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(path), "utf8"));
}
async function fileIdentity(path) {
    const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(path));
    return { sizeBytes: bytes.length, sha256: sha256(bytes) };
}
function assertSha256(value, context) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
        throw new Error(`${context} has an invalid SHA-256`);
}
function parseSourceProvenance(value) {
    const source = value;
    if (!source || source.schemaVersion !== 1 || source.contract !== exports.FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT
        || source.contractVersion !== "1.0.0" || source.packageName !== "com.bandainamcogames.dbzdokkanww"
        || typeof source.packageVersionName !== "string" || !/^\d+\.\d+\.\d+$/.test(source.packageVersionName)
        || !Number.isSafeInteger(source.packageVersionCode) || (source.packageVersionCode ?? 0) <= 0
        || !source.baseApk || !Number.isSafeInteger(source.baseApk.sizeBytes) || source.baseApk.sizeBytes <= 0
        || !source.gameDb || source.gameDb.region !== "global" || typeof source.gameDb.dbVersion !== "string"
        || !/^\d+$/.test(source.gameDb.dbVersion) || typeof source.gameDb.assetVersion !== "string"
        || !/^\d+$/.test(source.gameDb.assetVersion) || typeof source.gameDb.apkVersion !== "string"
        || !/^\d+\.\d+\.\d+$/.test(source.gameDb.apkVersion) || !source.gameDb.cardsCsv
        || !Number.isSafeInteger(source.gameDb.cardsCsv.sizeBytes) || source.gameDb.cardsCsv.sizeBytes <= 0
        || !source.assetArchive || !Number.isSafeInteger(source.assetArchive.sizeBytes) || source.assetArchive.sizeBytes <= 0
        || !source.cpkInventory || !Number.isSafeInteger(source.cpkInventory.fileCount) || source.cpkInventory.fileCount <= 0
        || !Number.isSafeInteger(source.cpkInventory.totalBytes) || source.cpkInventory.totalBytes <= 0
        || !source.extractedLayerInventory || !Number.isSafeInteger(source.extractedLayerInventory.fileCount)
        || source.extractedLayerInventory.fileCount <= 0 || !Number.isSafeInteger(source.extractedLayerInventory.totalBytes)
        || source.extractedLayerInventory.totalBytes <= 0
        || !source.cpkReader || typeof source.cpkReader.repository !== "string" || !source.cpkReader.repository
        || typeof source.cpkReader.commit !== "string" || !/^[a-f0-9]{40}$/.test(source.cpkReader.commit)) {
        throw new Error("official portrait source provenance rejected");
    }
    assertSha256(source.baseApk.sha256, "official base APK");
    assertSha256(source.gameDb.cardsCsv.sha256, "official cards.csv");
    assertSha256(source.assetArchive.sha256, "official asset archive");
    assertSha256(source.cpkInventory.sha256, "official CPK inventory");
    assertSha256(source.extractedLayerInventory.sha256, "official extracted-layer inventory");
    if (source.packageVersionName !== source.gameDb.apkVersion) {
        throw new Error("official portrait source APK version lineage rejected");
    }
    return source;
}
async function readBaseline(manifestPath, payloadPath) {
    const manifest = await readJson(manifestPath);
    const payload = await (0, promises_1.readFile)((0, path_1.resolve)(payloadPath));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.sizeBytes !== payload.length
        || manifest.sha256 !== sha256(payload) || !Number.isSafeInteger(manifest.uncompressedSizeBytes)
        || manifest.uncompressedSizeBytes < 2 || manifest.uncompressedSizeBytes > 32000000) {
        throw new Error("portrait candidate baseline manifest rejected");
    }
    const raw = (0, zlib_1.gunzipSync)(payload, { maxOutputLength: 32000000 });
    if (raw.length !== manifest.uncompressedSizeBytes)
        throw new Error("portrait candidate baseline raw size rejected");
    const characters = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount || !raw.equals(JSON_BYTES(characters))) {
        throw new Error("portrait candidate baseline payload rejected");
    }
    return { manifest, payload, characters };
}
function collectPortraitReferences(characters) {
    const references = [];
    for (const character of characters) {
        references.push(character);
        references.push(...(character.transformations ?? []));
        references.push(...(character.awakeningCards ?? []));
        references.push(...(character.previousAwakenings ?? []));
        references.push(...(character.nextAwakenings ?? []));
    }
    return references;
}
function stripPortraitDelivery(value) {
    if (Array.isArray(value))
        return value.map(stripPortraitDelivery);
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        if (key === "portraitLayers")
            continue;
        output[key] = key === "portraitSpec" || key === "portraitURL" ? `<${key}>` : stripPortraitDelivery(nested);
    }
    return output;
}
async function assertPng150(bytes, context, requireAlpha) {
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== 150 || metadata.height !== 150 || metadata.format !== "png"
        || (requireAlpha && (metadata.channels !== 4 || metadata.hasAlpha !== true))) {
        throw new Error(`${context} has invalid PNG geometry or alpha contract`);
    }
}
async function writeVerifiedPngObject(outputDir, entry, bytes, context, requireAlpha) {
    if (bytes.length !== entry.sizeBytes || sha256(bytes) !== entry.sha256) {
        throw new Error(`${context} in-memory identity rejected`);
    }
    await assertPng150(bytes, context, requireAlpha);
    const absolutePath = containedPath(outputDir, entry.localPath);
    await (0, promises_1.mkdir)((0, path_1.resolve)(absolutePath, ".."), { recursive: true });
    await (0, promises_1.writeFile)(absolutePath, bytes, { flag: "wx" });
    const reread = await (0, promises_1.readFile)(absolutePath);
    if (reread.length !== entry.sizeBytes || sha256(reread) !== entry.sha256) {
        throw new Error(`${context} write rejected`);
    }
    await assertPng150(reread, `${context} reread`, requireAlpha);
}
async function mapConcurrent(values, concurrency, mapper) {
    const output = new Array(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= values.length)
                return;
            output[index] = await mapper(values[index]);
        }
    }));
    return output;
}
async function inventoryFiles(entries) {
    const unique = new Map();
    for (const entry of entries) {
        const path = assertSafeRelativePath(entry.path, "asset inventory");
        const identity = { absolutePath: (0, path_1.resolve)(entry.absolutePath), root: (0, path_1.resolve)(entry.root) };
        const existing = unique.get(path);
        if (existing && (existing.absolutePath !== identity.absolutePath || existing.root !== identity.root)) {
            throw new Error(`asset inventory path collision: ${path}`);
        }
        unique.set(path, identity);
    }
    const paths = [...unique].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
    const identities = await mapConcurrent(paths, 16, async ([path, source]) => {
        const [canonicalRoot, canonicalFile] = await Promise.all([(0, promises_1.realpath)(source.root), (0, promises_1.realpath)(source.absolutePath)]);
        if (!isStrictlyContained(canonicalRoot, canonicalFile))
            throw new Error(`asset inventory symlink escaped its root: ${path}`);
        const bytes = await (0, promises_1.readFile)(canonicalFile);
        return { path, sizeBytes: bytes.length, sha256: sha256(bytes), bytes };
    });
    const reportEntries = identities.map(({ bytes: _bytes, ...identity }) => identity);
    return {
        entries: reportEntries,
        totalBytes: identities.reduce((total, entry) => total + entry.sizeBytes, 0),
        inventorySha256: sha256(JSON_BYTES(reportEntries)),
        bytesByPath: new Map(identities.map(entry => [entry.path, entry.bytes])),
    };
}
function inventoryEvidence(inventory) {
    return {
        entries: inventory.entries,
        totalBytes: inventory.totalBytes,
        inventorySha256: inventory.inventorySha256,
    };
}
function verifiedPortraitLayers(spec, roots, inventory) {
    const paths = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)(spec, {
        sharedLayers: roots.sharedLayersRoot,
        cardThumbs: roots.cardThumbsRoot,
    });
    const layers = {};
    for (const [kind, path] of Object.entries(paths)) {
        const root = kind === "thumb" ? roots.cardThumbsRoot : roots.sharedLayersRoot;
        const child = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(path)).replace(/\\/g, "/");
        const bytes = inventory.bytesByPath.get(`${kind}/${child}`);
        if (!bytes)
            throw new Error(`verified portrait layer is missing: ${kind}/${child}`);
        layers[kind] = bytes;
    }
    return layers;
}
function datasetVersionSlug(value) {
    const slug = value.trim().replace(/:/g, "-").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!slug || slug === "." || slug === ".." || slug.includes(".."))
        throw new Error("portrait candidate dataset version rejected");
    return slug;
}
async function buildFirstPartyPortraitCandidate(options) {
    const outputDir = (0, path_1.resolve)(options.outputDir);
    if (await (0, promises_1.lstat)(outputDir).catch(() => undefined))
        throw new Error("portrait candidate output must be a fresh directory");
    const generatedAt = new Date(options.generatedAt).toISOString();
    if (generatedAt !== options.generatedAt)
        throw new Error("portrait candidate generatedAt must be canonical ISO-8601");
    const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(options.firstPartyDir);
    const cardsCsvPath = (0, path_1.resolve)(sourceConfig.dataDir, "cards.csv");
    const [baseline, metadata, sourceProvenance, officialCardRows, cardsCsvIdentity] = await Promise.all([
        readBaseline(options.baselineManifestPath, options.baselinePayloadPath),
        readJson((0, path_1.resolve)(options.firstPartyDir, "metadata.json")),
        readJson(options.assetProvenancePath).then(parseSourceProvenance),
        (0, game_db_source_1.readGameDbTable)(sourceConfig, "cards"),
        fileIdentity(cardsCsvPath),
    ]);
    const gameDbMetadata = metadata;
    if (gameDbMetadata.source !== "first-party-export" || gameDbMetadata.region !== sourceProvenance.gameDb.region
        || gameDbMetadata.dbVersion !== sourceProvenance.gameDb.dbVersion
        || gameDbMetadata.assetVersion !== sourceProvenance.gameDb.assetVersion
        || gameDbMetadata.apkVersion !== sourceProvenance.gameDb.apkVersion
        || cardsCsvIdentity.sizeBytes !== sourceProvenance.gameDb.cardsCsv.sizeBytes
        || cardsCsvIdentity.sha256 !== sourceProvenance.gameDb.cardsCsv.sha256) {
        throw new Error("portrait candidate DB source identity rejected");
    }
    const [provenanceDocumentIdentity, baseApkIdentity, archiveIdentity] = await Promise.all([
        fileIdentity(options.assetProvenancePath),
        fileIdentity(options.baseApkPath),
        fileIdentity(options.assetArchivePath),
    ]);
    if (baseApkIdentity.sizeBytes !== sourceProvenance.baseApk.sizeBytes
        || baseApkIdentity.sha256 !== sourceProvenance.baseApk.sha256) {
        throw new Error("official base APK identity rejected");
    }
    if (archiveIdentity.sizeBytes !== sourceProvenance.assetArchive.sizeBytes
        || archiveIdentity.sha256 !== sourceProvenance.assetArchive.sha256) {
        throw new Error("official portrait asset archive identity rejected");
    }
    const overlay = (0, game_db_first_party_portrait_spec_1.overlayFirstPartyPortraitSpecs)(baseline.characters, officialCardRows);
    const references = collectPortraitReferences(overlay.characters);
    if (references.length !== overlay.report.referenceCount)
        throw new Error("portrait candidate reference count drifted");
    const referencesByCardId = new Map();
    for (const reference of references) {
        if (!/^\d+$/.test(reference.id)
            || ("portraitFilename" in reference && reference.portraitFilename !== `portrait_${reference.id}`)
            || !reference.portraitSpec) {
            throw new Error(`portrait candidate reference ${reference.id} rejected`);
        }
        const group = referencesByCardId.get(reference.id) ?? [];
        if (group.length > 0 && JSON.stringify(group[0].portraitSpec) !== JSON.stringify(reference.portraitSpec)) {
            throw new Error(`portrait candidate card ${reference.id} has divergent specs`);
        }
        group.push(reference);
        referencesByCardId.set(reference.id, group);
    }
    const assetIds = [...new Set(references.map(reference => reference.portraitSpec?.iconId))]
        .sort((left, right) => left - right);
    if (assetIds.length !== overlay.report.uniqueAssetCount)
        throw new Error("portrait candidate asset count drifted");
    const cpkEntries = [
        { path: "character.cpk", absolutePath: containedPath(options.cpkBundleRoot, "character.cpk"), root: options.cpkBundleRoot },
        ...assetIds.map(id => ({
            path: `thumbs/card_${id}_thumb.cpk`,
            absolutePath: containedPath(options.cpkBundleRoot, `thumbs/card_${id}_thumb.cpk`),
            root: options.cpkBundleRoot,
        })),
    ];
    const extractedEntries = [];
    for (const reference of referencesByCardId.values()) {
        const spec = reference[0].portraitSpec;
        const paths = (0, first_party_portrait_compositor_1.resolveFirstPartyPortraitLayerPaths)(spec, {
            sharedLayers: options.sharedLayersRoot,
            cardThumbs: options.cardThumbsRoot,
        });
        for (const [kind, path] of Object.entries(paths)) {
            const root = kind === "thumb" ? options.cardThumbsRoot : options.sharedLayersRoot;
            const child = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(path)).replace(/\\/g, "/");
            if (!isStrictlyContained(root, path))
                throw new Error("extracted portrait layer escaped its root");
            extractedEntries.push({ path: `${kind}/${child}`, absolutePath: path, root });
        }
    }
    const [cpkInventory, extractedInventory] = await Promise.all([
        inventoryFiles(cpkEntries),
        inventoryFiles(extractedEntries),
    ]);
    if (cpkInventory.entries.length !== sourceProvenance.cpkInventory.fileCount
        || cpkInventory.totalBytes !== sourceProvenance.cpkInventory.totalBytes
        || cpkInventory.inventorySha256 !== sourceProvenance.cpkInventory.sha256) {
        throw new Error("official CPK inventory provenance rejected");
    }
    if (extractedInventory.entries.length !== sourceProvenance.extractedLayerInventory.fileCount
        || extractedInventory.totalBytes !== sourceProvenance.extractedLayerInventory.totalBytes
        || extractedInventory.inventorySha256 !== sourceProvenance.extractedLayerInventory.sha256) {
        throw new Error("official extracted-layer inventory provenance rejected");
    }
    await (0, promises_1.mkdir)((0, path_1.resolve)(outputDir, "objects"), { recursive: true });
    const pendingLayerEntries = new Map();
    const candidateEntries = await mapConcurrent([...referencesByCardId].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })), 8, async ([cardId, cardReferences]) => {
        const spec = cardReferences[0].portraitSpec;
        const artifacts = await (0, first_party_portrait_compositor_1.composeFirstPartyPortraitArtifacts)(verifiedPortraitLayers(spec, {
            sharedLayersRoot: options.sharedLayersRoot,
            cardThumbsRoot: options.cardThumbsRoot,
        }, extractedInventory));
        const bytes = artifacts.portrait;
        await assertPng150(bytes, `portrait candidate ${cardId}`, true);
        const hash = sha256(bytes);
        const objectKey = `staging/v2/images/v4/portrait_${cardId}.${hash}.png`;
        if (!PORTRAIT_OBJECT_KEY.test(objectKey))
            throw new Error(`portrait candidate ${cardId} object key rejected`);
        const localPath = `objects/${objectKey}`;
        await writeVerifiedPngObject(outputDir, { localPath, sizeBytes: bytes.length, sha256: hash }, bytes, `portrait candidate ${cardId}`, true);
        const portraitLayers = {};
        for (const kind of ["background", "thumb", "overlay"]) {
            const layerBytes = artifacts.portraitLayers[kind];
            await assertPng150(layerBytes, `portrait candidate ${cardId} ${kind} layer`, true);
            const layerHash = sha256(layerBytes);
            const layerObjectKey = `staging/v2/images/v5/layers/${kind}.${layerHash}.png`;
            if (!PORTRAIT_LAYER_OBJECT_KEY.test(layerObjectKey)) {
                throw new Error(`portrait candidate ${cardId} ${kind} layer object key rejected`);
            }
            const pending = {
                kind,
                objectKey: layerObjectKey,
                localPath: `objects/${layerObjectKey}`,
                sizeBytes: layerBytes.length,
                sha256: layerHash,
                bytes: layerBytes,
            };
            const existing = pendingLayerEntries.get(layerObjectKey);
            if (existing && (existing.kind !== kind || existing.sizeBytes !== pending.sizeBytes
                || existing.sha256 !== pending.sha256 || !existing.bytes.equals(layerBytes))) {
                throw new Error(`portrait candidate ${cardId} ${kind} layer hash collision`);
            }
            if (!existing)
                pendingLayerEntries.set(layerObjectKey, pending);
            if (kind === "background")
                portraitLayers.backgroundURL = layerObjectKey;
            else if (kind === "thumb")
                portraitLayers.thumbURL = layerObjectKey;
            else
                portraitLayers.overlayURL = layerObjectKey;
        }
        for (const reference of cardReferences) {
            reference.portraitURL = objectKey;
            reference.portraitLayers = portraitLayers;
        }
        return { cardId, objectKey, localPath, sizeBytes: bytes.length, sha256: hash, portraitSpec: spec };
    });
    const pendingLayers = [...pendingLayerEntries.values()]
        .sort((left, right) => left.objectKey.localeCompare(right.objectKey));
    await mapConcurrent(pendingLayers, 8, async (entry) => {
        await writeVerifiedPngObject(outputDir, entry, entry.bytes, `portrait ${entry.kind} layer ${entry.sha256}`, true);
    });
    const layerEntries = pendingLayers.map(({ bytes: _bytes, ...entry }) => entry);
    const portraitLayerProjectedBytes = layerEntries.reduce((total, entry) => total + entry.sizeBytes, 0);
    const portraitLayerProjectedBytesByKind = {
        background: layerEntries.filter(entry => entry.kind === "background")
            .reduce((total, entry) => total + entry.sizeBytes, 0),
        thumb: layerEntries.filter(entry => entry.kind === "thumb")
            .reduce((total, entry) => total + entry.sizeBytes, 0),
        overlay: layerEntries.filter(entry => entry.kind === "overlay")
            .reduce((total, entry) => total + entry.sizeBytes, 0),
    };
    if (JSON.stringify(stripPortraitDelivery(baseline.characters)) !== JSON.stringify(stripPortraitDelivery(overlay.characters))) {
        throw new Error("portrait candidate changed non-portrait data");
    }
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(overlay.characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    const payloadKey = `staging/v2/releases/${datasetVersionSlug(generatedAt)}/${artifact.manifest.sha256}/characters.json.gz`;
    const manifest = { ...artifact.manifest, fileName: payloadKey };
    const payloadPath = containedPath(outputDir, `objects/${payloadKey}`);
    await (0, promises_1.mkdir)((0, path_1.resolve)(payloadPath, ".."), { recursive: true });
    await (0, promises_1.writeFile)(payloadPath, artifact.gzipBuffer, { flag: "wx" });
    const payloadReread = await (0, promises_1.readFile)(payloadPath);
    if (payloadReread.length !== manifest.sizeBytes || sha256(payloadReread) !== manifest.sha256
        || !(0, zlib_1.gunzipSync)(payloadReread, { maxOutputLength: 32000000 }).equals(Buffer.from(artifact.jsonText, "utf8"))) {
        throw new Error("portrait candidate payload write rejected");
    }
    const manifestPath = (0, path_1.resolve)(outputDir, "characters-manifest.json");
    await (0, promises_1.writeFile)(manifestPath, JSON_BYTES(manifest), { flag: "wx" });
    const report = {
        schemaVersion: 1,
        contract: exports.FIRST_PARTY_PORTRAIT_CANDIDATE_CONTRACT,
        contractVersion: "1.2.0",
        generatedAt,
        source: {
            baseline: {
                datasetVersion: baseline.manifest.datasetVersion,
                payloadSha256: baseline.manifest.sha256,
                payloadSizeBytes: baseline.payload.length,
                characterCount: baseline.manifest.characterCount,
            },
            gameDb: metadata,
            gameDbCardsCsv: cardsCsvIdentity,
            installedGame: sourceProvenance,
            provenanceDocument: provenanceDocumentIdentity,
            baseApk: baseApkIdentity,
            assetArchive: archiveIdentity,
            cpkInventory: inventoryEvidence(cpkInventory),
            extractedLayerInventory: inventoryEvidence(extractedInventory),
        },
        overlay: overlay.report,
        portraits: {
            referenceCount: references.length,
            cardCount: candidateEntries.length,
            uniqueThumbAssetCount: assetIds.length,
            totalBytes: candidateEntries.reduce((total, entry) => total + entry.sizeBytes, 0),
            inventorySha256: sha256(JSON_BYTES(candidateEntries)),
            entries: candidateEntries,
        },
        portraitLayers: {
            referenceCount: references.length,
            uniqueObjectCount: layerEntries.length,
            backgroundObjectCount: layerEntries.filter(entry => entry.kind === "background").length,
            thumbObjectCount: layerEntries.filter(entry => entry.kind === "thumb").length,
            overlayObjectCount: layerEntries.filter(entry => entry.kind === "overlay").length,
            projectedBytes: portraitLayerProjectedBytes,
            projectedBytesByKind: portraitLayerProjectedBytesByKind,
            inventorySha256: sha256(JSON_BYTES(layerEntries)),
            entries: layerEntries,
        },
        dataset: manifest,
        checks: {
            everyReferenceJoinedByExactOfficialCardId: true,
            baseApkIdentityMatchesProvenance: true,
            gameDbMetadataAndCardsCsvMatchProvenance: true,
            assetArchiveIdentityMatchesProvenance: true,
            cpkAndExtractedInventoriesMatchProvenance: true,
            officialResourceIdsPreserved: true,
            sharedThumbAssetsDeduplicated: true,
            everyRequiredCpkPresentAndHashed: true,
            everyRequiredExtractedLayerPresentAndHashed: true,
            everyPortraitIsDeterministicPng150: true,
            everyPortraitPreservesTransparency: true,
            everyPortraitUrlIsChannelScopedAndContentAddressed: true,
            everyPortraitLayerIsDeterministicTransparentPng150: true,
            everyPortraitLayerUrlIsChannelScopedAndContentAddressed: true,
            portraitLayersDeduplicatedByContentHash: true,
            portraitSpecAndUrlUpdatedTogether: true,
            nonPortraitDataUnchanged: true,
            payloadManifestSizeAndShaMatch: true,
            noWebsiteAssetBytes: true,
            noRemoteRead: true,
            noRemoteMutation: true,
        },
        readiness: {
            localPortraitCandidate: "GO",
            teamAnalysisRebind: "NO-GO",
            androidStagingValidation: "NO-GO",
            publisherDryRun: "NO-GO",
            publication: "NO-GO",
            production: "NO-GO",
            r2Mutation: "NO-GO",
        },
    };
    const reportPath = (0, path_1.resolve)(outputDir, "first-party-portrait-candidate-report.json");
    await (0, promises_1.writeFile)(reportPath, JSON_BYTES(report), { flag: "wx" });
    return {
        manifestPath,
        payloadPath,
        reportPath,
        portraitCount: candidateEntries.length,
        portraitLayerObjectCount: layerEntries.length,
        portraitLayerProjectedBytes,
    };
}
exports.buildFirstPartyPortraitCandidate = buildFirstPartyPortraitCandidate;
function parseFirstPartyPortraitCandidateArgs(args) {
    const allowed = new Set([
        "--baseline-manifest", "--baseline-payload", "--first-party-dir", "--base-apk", "--asset-archive",
        "--cpk-bundle-root", "--shared-layers", "--card-thumbs", "--asset-provenance",
        "--output-dir", "--generated-at",
    ]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!allowed.has(key) || !value || value.startsWith("--") || values.has(key)) {
            throw new Error("first-party portrait candidate arguments rejected");
        }
        values.set(key, value);
    }
    if (values.size !== allowed.size)
        throw new Error("first-party portrait candidate requires every explicit input");
    const outputDir = (0, path_1.resolve)(values.get("--output-dir"));
    if (!isStrictlyContained(exports.FIRST_PARTY_PORTRAIT_CANDIDATE_ROOT, outputDir)) {
        throw new Error("portrait candidate output must stay inside its dedicated root");
    }
    return {
        baselineManifestPath: (0, path_1.resolve)(values.get("--baseline-manifest")),
        baselinePayloadPath: (0, path_1.resolve)(values.get("--baseline-payload")),
        firstPartyDir: (0, path_1.resolve)(values.get("--first-party-dir")),
        baseApkPath: (0, path_1.resolve)(values.get("--base-apk")),
        assetArchivePath: (0, path_1.resolve)(values.get("--asset-archive")),
        cpkBundleRoot: (0, path_1.resolve)(values.get("--cpk-bundle-root")),
        sharedLayersRoot: (0, path_1.resolve)(values.get("--shared-layers")),
        cardThumbsRoot: (0, path_1.resolve)(values.get("--card-thumbs")),
        assetProvenancePath: (0, path_1.resolve)(values.get("--asset-provenance")),
        outputDir,
        generatedAt: values.get("--generated-at"),
    };
}
exports.parseFirstPartyPortraitCandidateArgs = parseFirstPartyPortraitCandidateArgs;
async function main() {
    const result = await buildFirstPartyPortraitCandidate(parseFirstPartyPortraitCandidateArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=game-db-first-party-portrait-candidate.js.map