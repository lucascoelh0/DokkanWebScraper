import { createHash } from "crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import sharp = require("sharp");
import type { AwakeningReference, Character, PortraitLayers, PortraitSpec, Transformation } from "../character";
import { buildCharacterDatasetArtifact, type DatasetManifest } from "../dataset-artifacts";
import {
    composeFirstPartyPortraitArtifacts,
    resolveFirstPartyPortraitLayerPaths,
    type FirstPartyPortraitLayerBytes,
    type FirstPartyPortraitStaticLayers,
} from "./first-party-portrait-compositor";
import { overlayFirstPartyPortraitSpecs } from "./game-db-first-party-portrait-spec";
import { readGameDbTable, resolveGameDbSourceConfig } from "./game-db-source";

export const FIRST_PARTY_PORTRAIT_CANDIDATE_ROOT = resolve(
    "game-db",
    "data",
    "game-db-first-party-portrait-candidate",
);
export const FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT = "dokkan-official-installed-portrait-source";
export const FIRST_PARTY_PORTRAIT_CANDIDATE_CONTRACT = "dokkan-first-party-portrait-staging-candidate";
const PORTRAIT_OBJECT_KEY = /^staging\/v2\/images\/v4\/portrait_(\d+)\.([a-f0-9]{64})\.png$/;
const PORTRAIT_LAYER_OBJECT_KEY = /^staging\/v2\/images\/v5\/layers\/(background|thumb|overlay)\.([a-f0-9]{64})\.png$/;
const JSON_BYTES = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

interface OfficialPortraitSourceProvenance {
    schemaVersion: 1,
    contract: typeof FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT,
    contractVersion: "1.0.0",
    packageName: "com.bandainamcogames.dbzdokkanww",
    packageVersionName: string,
    packageVersionCode: number,
    baseApk: { sizeBytes: number, sha256: string },
    gameDb: {
        region: "global",
        dbVersion: string,
        assetVersion: string,
        apkVersion: string,
        cardsCsv: { sizeBytes: number, sha256: string },
    },
    assetArchive: { sizeBytes: number, sha256: string },
    cpkInventory: { fileCount: number, totalBytes: number, sha256: string },
    extractedLayerInventory: { fileCount: number, totalBytes: number, sha256: string },
    cpkReader: { repository: string, commit: string },
}

export interface FirstPartyPortraitCandidateOptions {
    baselineManifestPath: string,
    baselinePayloadPath: string,
    firstPartyDir: string,
    baseApkPath: string,
    assetArchivePath: string,
    cpkBundleRoot: string,
    sharedLayersRoot: string,
    cardThumbsRoot: string,
    assetProvenancePath: string,
    outputDir: string,
    generatedAt: string,
}

interface FileInventoryEntry {
    path: string,
    sizeBytes: number,
    sha256: string,
}

interface VerifiedFileInventory {
    entries: FileInventoryEntry[],
    totalBytes: number,
    inventorySha256: string,
    bytesByPath: Map<string, Buffer>,
}

interface PortraitCandidateEntry {
    cardId: string,
    objectKey: string,
    localPath: string,
    sizeBytes: number,
    sha256: string,
    portraitSpec: PortraitSpec,
}

type PortraitLayerKind = keyof FirstPartyPortraitStaticLayers;

interface PortraitLayerCandidateEntry {
    kind: PortraitLayerKind,
    objectKey: string,
    localPath: string,
    sizeBytes: number,
    sha256: string,
}

interface PendingPortraitLayerCandidate extends PortraitLayerCandidateEntry {
    bytes: Buffer,
}

type PortraitReference = Character | Transformation | AwakeningReference;

function isStrictlyContained(root: string, target: string): boolean {
    const child = relative(resolve(root), resolve(target));
    return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function assertSafeRelativePath(value: string, context: string): string {
    const normalized = value.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error(`${context} has an unsafe relative path`);
    }
    return normalized;
}

function containedPath(root: string, relativePath: string): string {
    const canonicalRoot = resolve(root);
    const target = resolve(canonicalRoot, ...assertSafeRelativePath(relativePath, "candidate object").split("/"));
    if (!isStrictlyContained(canonicalRoot, target)) throw new Error("candidate object escaped its root");
    return target;
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function fileIdentity(path: string): Promise<{ sizeBytes: number, sha256: string }> {
    const bytes = await readFile(resolve(path));
    return { sizeBytes: bytes.length, sha256: sha256(bytes) };
}

function assertSha256(value: unknown, context: string): asserts value is string {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${context} has an invalid SHA-256`);
}

function parseSourceProvenance(value: unknown): OfficialPortraitSourceProvenance {
    const source = value as Partial<OfficialPortraitSourceProvenance> | null;
    if (!source || source.schemaVersion !== 1 || source.contract !== FIRST_PARTY_PORTRAIT_SOURCE_CONTRACT
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
    return source as OfficialPortraitSourceProvenance;
}

async function readBaseline(manifestPath: string, payloadPath: string): Promise<{
    manifest: DatasetManifest,
    payload: Buffer,
    characters: Character[],
}> {
    const manifest = await readJson(manifestPath) as DatasetManifest;
    const payload = await readFile(resolve(payloadPath));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.sizeBytes !== payload.length
        || manifest.sha256 !== sha256(payload) || !Number.isSafeInteger(manifest.uncompressedSizeBytes)
        || manifest.uncompressedSizeBytes < 2 || manifest.uncompressedSizeBytes > 32_000_000) {
        throw new Error("portrait candidate baseline manifest rejected");
    }
    const raw = gunzipSync(payload, { maxOutputLength: 32_000_000 });
    if (raw.length !== manifest.uncompressedSizeBytes) throw new Error("portrait candidate baseline raw size rejected");
    const characters = JSON.parse(raw.toString("utf8")) as Character[];
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount || !raw.equals(JSON_BYTES(characters))) {
        throw new Error("portrait candidate baseline payload rejected");
    }
    return { manifest, payload, characters };
}

function collectPortraitReferences(characters: Character[]): PortraitReference[] {
    const references: PortraitReference[] = [];
    for (const character of characters) {
        references.push(character);
        references.push(...(character.transformations ?? []));
        references.push(...(character.awakeningCards ?? []));
        references.push(...(character.previousAwakenings ?? []));
        references.push(...(character.nextAwakenings ?? []));
    }
    return references;
}

function stripPortraitDelivery(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripPortraitDelivery);
    if (!value || typeof value !== "object") return value;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key === "portraitLayers") continue;
        output[key] = key === "portraitSpec" || key === "portraitURL" ? `<${key}>` : stripPortraitDelivery(nested);
    }
    return output;
}

async function assertPng150(bytes: Buffer, context: string, requireAlpha: boolean): Promise<void> {
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== 150 || metadata.height !== 150 || metadata.format !== "png"
        || (requireAlpha && (metadata.channels !== 4 || metadata.hasAlpha !== true))) {
        throw new Error(`${context} has invalid PNG geometry or alpha contract`);
    }
}

async function writeVerifiedPngObject(
    outputDir: string,
    entry: { localPath: string, sizeBytes: number, sha256: string },
    bytes: Buffer,
    context: string,
    requireAlpha: boolean,
): Promise<void> {
    if (bytes.length !== entry.sizeBytes || sha256(bytes) !== entry.sha256) {
        throw new Error(`${context} in-memory identity rejected`);
    }
    await assertPng150(bytes, context, requireAlpha);
    const absolutePath = containedPath(outputDir, entry.localPath);
    await mkdir(resolve(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, bytes, { flag: "wx" });
    const reread = await readFile(absolutePath);
    if (reread.length !== entry.sizeBytes || sha256(reread) !== entry.sha256) {
        throw new Error(`${context} write rejected`);
    }
    await assertPng150(reread, `${context} reread`, requireAlpha);
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
    const output = new Array<R>(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= values.length) return;
            output[index] = await mapper(values[index]);
        }
    }));
    return output;
}

async function inventoryFiles(entries: Array<{ path: string, absolutePath: string, root: string }>): Promise<VerifiedFileInventory> {
    const unique = new Map<string, { absolutePath: string, root: string }>();
    for (const entry of entries) {
        const path = assertSafeRelativePath(entry.path, "asset inventory");
        const identity = { absolutePath: resolve(entry.absolutePath), root: resolve(entry.root) };
        const existing = unique.get(path);
        if (existing && (existing.absolutePath !== identity.absolutePath || existing.root !== identity.root)) {
            throw new Error(`asset inventory path collision: ${path}`);
        }
        unique.set(path, identity);
    }
    const paths = [...unique].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
    const identities = await mapConcurrent(paths, 16, async ([path, source]) => {
        const [canonicalRoot, canonicalFile] = await Promise.all([realpath(source.root), realpath(source.absolutePath)]);
        if (!isStrictlyContained(canonicalRoot, canonicalFile)) throw new Error(`asset inventory symlink escaped its root: ${path}`);
        const bytes = await readFile(canonicalFile);
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

function inventoryEvidence(inventory: VerifiedFileInventory): Omit<VerifiedFileInventory, "bytesByPath"> {
    return {
        entries: inventory.entries,
        totalBytes: inventory.totalBytes,
        inventorySha256: inventory.inventorySha256,
    };
}

function verifiedPortraitLayers(
    spec: PortraitSpec,
    roots: { sharedLayersRoot: string, cardThumbsRoot: string },
    inventory: VerifiedFileInventory,
): FirstPartyPortraitLayerBytes {
    const paths = resolveFirstPartyPortraitLayerPaths(spec, {
        sharedLayers: roots.sharedLayersRoot,
        cardThumbs: roots.cardThumbsRoot,
    });
    const layers: Partial<FirstPartyPortraitLayerBytes> = {};
    for (const [kind, path] of Object.entries(paths) as Array<[keyof FirstPartyPortraitLayerBytes, string]>) {
        const root = kind === "thumb" ? roots.cardThumbsRoot : roots.sharedLayersRoot;
        const child = relative(resolve(root), resolve(path)).replace(/\\/g, "/");
        const bytes = inventory.bytesByPath.get(`${kind}/${child}`);
        if (!bytes) throw new Error(`verified portrait layer is missing: ${kind}/${child}`);
        layers[kind] = bytes;
    }
    return layers as FirstPartyPortraitLayerBytes;
}

function datasetVersionSlug(value: string): string {
    const slug = value.trim().replace(/:/g, "-").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!slug || slug === "." || slug === ".." || slug.includes("..")) throw new Error("portrait candidate dataset version rejected");
    return slug;
}

export async function buildFirstPartyPortraitCandidate(options: FirstPartyPortraitCandidateOptions): Promise<{
    manifestPath: string,
    payloadPath: string,
    reportPath: string,
    portraitCount: number,
    portraitLayerObjectCount: number,
    portraitLayerProjectedBytes: number,
}> {
    const outputDir = resolve(options.outputDir);
    if (await lstat(outputDir).catch(() => undefined)) throw new Error("portrait candidate output must be a fresh directory");
    const generatedAt = new Date(options.generatedAt).toISOString();
    if (generatedAt !== options.generatedAt) throw new Error("portrait candidate generatedAt must be canonical ISO-8601");

    const sourceConfig = resolveGameDbSourceConfig(options.firstPartyDir);
    const cardsCsvPath = resolve(sourceConfig.dataDir, "cards.csv");
    const [baseline, metadata, sourceProvenance, officialCardRows, cardsCsvIdentity] = await Promise.all([
        readBaseline(options.baselineManifestPath, options.baselinePayloadPath),
        readJson(resolve(options.firstPartyDir, "metadata.json")),
        readJson(options.assetProvenancePath).then(parseSourceProvenance),
        readGameDbTable(sourceConfig, "cards"),
        fileIdentity(cardsCsvPath),
    ]);
    const gameDbMetadata = metadata as Record<string, unknown>;
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

    const overlay = overlayFirstPartyPortraitSpecs(baseline.characters, officialCardRows);
    const references = collectPortraitReferences(overlay.characters);
    if (references.length !== overlay.report.referenceCount) throw new Error("portrait candidate reference count drifted");
    const referencesByCardId = new Map<string, PortraitReference[]>();
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

    const assetIds = [...new Set(references.map(reference => reference.portraitSpec?.iconId as number))]
        .sort((left, right) => left - right);
    if (assetIds.length !== overlay.report.uniqueAssetCount) throw new Error("portrait candidate asset count drifted");
    const cpkEntries = [
        { path: "character.cpk", absolutePath: containedPath(options.cpkBundleRoot, "character.cpk"), root: options.cpkBundleRoot },
        ...assetIds.map(id => ({
            path: `thumbs/card_${id}_thumb.cpk`,
            absolutePath: containedPath(options.cpkBundleRoot, `thumbs/card_${id}_thumb.cpk`),
            root: options.cpkBundleRoot,
        })),
    ];
    const extractedEntries: Array<{ path: string, absolutePath: string, root: string }> = [];
    for (const reference of referencesByCardId.values()) {
        const spec = reference[0].portraitSpec as PortraitSpec;
        const paths = resolveFirstPartyPortraitLayerPaths(spec, {
            sharedLayers: options.sharedLayersRoot,
            cardThumbs: options.cardThumbsRoot,
        });
        for (const [kind, path] of Object.entries(paths)) {
            const root = kind === "thumb" ? options.cardThumbsRoot : options.sharedLayersRoot;
            const child = relative(resolve(root), resolve(path)).replace(/\\/g, "/");
            if (!isStrictlyContained(root, path)) throw new Error("extracted portrait layer escaped its root");
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

    await mkdir(resolve(outputDir, "objects"), { recursive: true });
    const pendingLayerEntries = new Map<string, PendingPortraitLayerCandidate>();
    const candidateEntries = await mapConcurrent(
        [...referencesByCardId].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })),
        8,
        async ([cardId, cardReferences]): Promise<PortraitCandidateEntry> => {
            const spec = cardReferences[0].portraitSpec as PortraitSpec;
            const artifacts = await composeFirstPartyPortraitArtifacts(verifiedPortraitLayers(spec, {
                sharedLayersRoot: options.sharedLayersRoot,
                cardThumbsRoot: options.cardThumbsRoot,
            }, extractedInventory));
            const bytes = artifacts.portrait;
            await assertPng150(bytes, `portrait candidate ${cardId}`, false);
            const hash = sha256(bytes);
            const objectKey = `staging/v2/images/v4/portrait_${cardId}.${hash}.png`;
            if (!PORTRAIT_OBJECT_KEY.test(objectKey)) throw new Error(`portrait candidate ${cardId} object key rejected`);
            const localPath = `objects/${objectKey}`;
            await writeVerifiedPngObject(
                outputDir,
                { localPath, sizeBytes: bytes.length, sha256: hash },
                bytes,
                `portrait candidate ${cardId}`,
                false,
            );

            const portraitLayers = {} as PortraitLayers;
            for (const kind of ["background", "thumb", "overlay"] as const) {
                const layerBytes = artifacts.portraitLayers[kind];
                await assertPng150(layerBytes, `portrait candidate ${cardId} ${kind} layer`, true);
                const layerHash = sha256(layerBytes);
                const layerObjectKey = `staging/v2/images/v5/layers/${kind}.${layerHash}.png`;
                if (!PORTRAIT_LAYER_OBJECT_KEY.test(layerObjectKey)) {
                    throw new Error(`portrait candidate ${cardId} ${kind} layer object key rejected`);
                }
                const pending: PendingPortraitLayerCandidate = {
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
                if (!existing) pendingLayerEntries.set(layerObjectKey, pending);
                if (kind === "background") portraitLayers.backgroundURL = layerObjectKey;
                else if (kind === "thumb") portraitLayers.thumbURL = layerObjectKey;
                else portraitLayers.overlayURL = layerObjectKey;
            }
            for (const reference of cardReferences) {
                reference.portraitURL = objectKey;
                reference.portraitLayers = portraitLayers;
            }
            return { cardId, objectKey, localPath, sizeBytes: bytes.length, sha256: hash, portraitSpec: spec };
        },
    );

    const pendingLayers = [...pendingLayerEntries.values()]
        .sort((left, right) => left.objectKey.localeCompare(right.objectKey));
    await mapConcurrent(pendingLayers, 8, async entry => {
        await writeVerifiedPngObject(outputDir, entry, entry.bytes, `portrait ${entry.kind} layer ${entry.sha256}`, true);
    });
    const layerEntries: PortraitLayerCandidateEntry[] = pendingLayers.map(({ bytes: _bytes, ...entry }) => entry);
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
    const artifact = buildCharacterDatasetArtifact(overlay.characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    const payloadKey = `staging/v2/releases/${datasetVersionSlug(generatedAt)}/${artifact.manifest.sha256}/characters.json.gz`;
    const manifest: DatasetManifest = { ...artifact.manifest, fileName: payloadKey };
    const payloadPath = containedPath(outputDir, `objects/${payloadKey}`);
    await mkdir(resolve(payloadPath, ".."), { recursive: true });
    await writeFile(payloadPath, artifact.gzipBuffer, { flag: "wx" });
    const payloadReread = await readFile(payloadPath);
    if (payloadReread.length !== manifest.sizeBytes || sha256(payloadReread) !== manifest.sha256
        || !gunzipSync(payloadReread, { maxOutputLength: 32_000_000 }).equals(Buffer.from(artifact.jsonText, "utf8"))) {
        throw new Error("portrait candidate payload write rejected");
    }
    const manifestPath = resolve(outputDir, "characters-manifest.json");
    await writeFile(manifestPath, JSON_BYTES(manifest), { flag: "wx" });

    const report = {
        schemaVersion: 1,
        contract: FIRST_PARTY_PORTRAIT_CANDIDATE_CONTRACT,
        contractVersion: "1.1.0",
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
    const reportPath = resolve(outputDir, "first-party-portrait-candidate-report.json");
    await writeFile(reportPath, JSON_BYTES(report), { flag: "wx" });
    return {
        manifestPath,
        payloadPath,
        reportPath,
        portraitCount: candidateEntries.length,
        portraitLayerObjectCount: layerEntries.length,
        portraitLayerProjectedBytes,
    };
}

export function parseFirstPartyPortraitCandidateArgs(args: string[]): FirstPartyPortraitCandidateOptions {
    const allowed = new Set([
        "--baseline-manifest", "--baseline-payload", "--first-party-dir", "--base-apk", "--asset-archive",
        "--cpk-bundle-root", "--shared-layers", "--card-thumbs", "--asset-provenance",
        "--output-dir", "--generated-at",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!allowed.has(key) || !value || value.startsWith("--") || values.has(key)) {
            throw new Error("first-party portrait candidate arguments rejected");
        }
        values.set(key, value);
    }
    if (values.size !== allowed.size) throw new Error("first-party portrait candidate requires every explicit input");
    const outputDir = resolve(values.get("--output-dir") as string);
    if (!isStrictlyContained(FIRST_PARTY_PORTRAIT_CANDIDATE_ROOT, outputDir)) {
        throw new Error("portrait candidate output must stay inside its dedicated root");
    }
    return {
        baselineManifestPath: resolve(values.get("--baseline-manifest") as string),
        baselinePayloadPath: resolve(values.get("--baseline-payload") as string),
        firstPartyDir: resolve(values.get("--first-party-dir") as string),
        baseApkPath: resolve(values.get("--base-apk") as string),
        assetArchivePath: resolve(values.get("--asset-archive") as string),
        cpkBundleRoot: resolve(values.get("--cpk-bundle-root") as string),
        sharedLayersRoot: resolve(values.get("--shared-layers") as string),
        cardThumbsRoot: resolve(values.get("--card-thumbs") as string),
        assetProvenancePath: resolve(values.get("--asset-provenance") as string),
        outputDir,
        generatedAt: values.get("--generated-at") as string,
    };
}

async function main(): Promise<void> {
    const result = await buildFirstPartyPortraitCandidate(parseFirstPartyPortraitCandidateArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
