import { createHash } from "crypto";
import { mkdir, readFile, realpath, writeFile } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import sharp = require("sharp");
import type { AwakeningReference, Character, PortraitLayers, PortraitSpec, Transformation } from "../character";
import { buildCharacterDatasetArtifact, type DatasetManifest } from "../dataset-artifacts";
import {
    auditFirstPartyPortraitTransparency,
    composeFirstPartyPortraitBadgeOverlay,
    composeFirstPartyPortraitFromStaticLayers,
    resolveFirstPartyPortraitLayerPaths,
} from "./first-party-portrait-compositor";

export const FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT = resolve(
    "game-db",
    "data",
    "game-db-first-party-portrait-polish-candidate",
);
export const FIRST_PARTY_PORTRAIT_POLISH_CONTRACT = "dokkan-first-party-portrait-polish-candidate";
const STATIC_KEY = /^staging\/v2\/images\/v4\/portrait_(\d+)\.([a-f0-9]{64})\.png$/;
const LAYER_KEY = /^staging\/v2\/images\/v5\/layers\/(background|thumb|overlay)\.([a-f0-9]{64})\.png$/;
const JSON_BYTES = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
type PortraitReference = Character | Transformation | AwakeningReference;

export interface FirstPartyPortraitPolishCandidateOptions {
    baselineManifestPath: string,
    baselinePayloadPath: string,
    baselineObjectRoot: string,
    sharedLayersRoot: string,
    outputDir: string,
    generatedAt: string,
}

interface SourceGroup {
    cardId: string,
    spec: PortraitSpec,
    portraitURL: string,
    layers: PortraitLayers,
    references: PortraitReference[],
}

interface ObjectEntry {
    kind: "portrait" | "background" | "thumb" | "overlay",
    objectKey: string,
    sizeBytes: number,
    sha256: string,
}

function strictlyContained(root: string, target: string): boolean {
    const child = relative(resolve(root), resolve(target));
    return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function containedObjectPath(root: string, objectKey: string): string {
    if (!objectKey || objectKey.startsWith("/") || objectKey.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error("portrait polish candidate object key rejected");
    }
    const target = resolve(root, ...objectKey.split("/"));
    if (!strictlyContained(root, target)) throw new Error("portrait polish candidate object escaped its root");
    return target;
}

function collectReferences(characters: Character[]): PortraitReference[] {
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

async function readBaseline(options: FirstPartyPortraitPolishCandidateOptions): Promise<{
    manifest: DatasetManifest,
    payload: Buffer,
    characters: Character[],
}> {
    const manifest = JSON.parse(await readFile(resolve(options.baselineManifestPath), "utf8")) as DatasetManifest;
    const payload = await readFile(resolve(options.baselinePayloadPath));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.sizeBytes !== payload.length
        || manifest.sha256 !== sha256(payload) || !Number.isSafeInteger(manifest.uncompressedSizeBytes)
        || manifest.uncompressedSizeBytes < 2 || manifest.uncompressedSizeBytes > 40_000_000) {
        throw new Error("portrait polish candidate baseline manifest rejected");
    }
    const raw = gunzipSync(payload, { maxOutputLength: 40_000_000 });
    if (raw.length !== manifest.uncompressedSizeBytes) throw new Error("portrait polish candidate baseline size rejected");
    const characters = JSON.parse(raw.toString("utf8")) as Character[];
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("portrait polish candidate baseline payload rejected");
    }
    return { manifest, payload, characters };
}

function groupReferences(references: PortraitReference[]): SourceGroup[] {
    const groups = new Map<string, SourceGroup>();
    for (const reference of references) {
        const cardId = String(reference.id);
        const spec = reference.portraitSpec;
        const layers = reference.portraitLayers;
        if (!/^\d+$/.test(cardId) || !spec || !layers || !STATIC_KEY.test(reference.portraitURL)
            || !LAYER_KEY.test(layers.backgroundURL) || !LAYER_KEY.test(layers.thumbURL)
            || !LAYER_KEY.test(layers.overlayURL)) {
            throw new Error(`portrait polish candidate ${cardId} lacks a complete typed portrait`);
        }
        const existing = groups.get(cardId);
        const identity = JSON.stringify({ spec, portraitURL: reference.portraitURL, layers });
        if (existing) {
            const existingIdentity = JSON.stringify({
                spec: existing.spec,
                portraitURL: existing.portraitURL,
                layers: existing.layers,
            });
            if (identity !== existingIdentity) throw new Error(`portrait polish candidate ${cardId} has conflicting sources`);
            existing.references.push(reference);
        } else {
            groups.set(cardId, { cardId, spec, portraitURL: reference.portraitURL, layers, references: [reference] });
        }
    }
    return [...groups.values()].sort((left, right) => left.cardId.localeCompare(right.cardId, undefined, { numeric: true }));
}

async function assertPng150Alpha(bytes: Buffer, context: string): Promise<void> {
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== "png" || metadata.width !== 150 || metadata.height !== 150
        || metadata.channels !== 4 || metadata.hasAlpha !== true) {
        throw new Error(`${context} violates the transparent PNG150 contract`);
    }
}

async function readHashedObject(root: string, objectKey: string, pattern: RegExp, context: string): Promise<Buffer> {
    const match = pattern.exec(objectKey);
    if (!match) throw new Error(`${context} key rejected`);
    const canonicalRoot = await realpath(resolve(root));
    const target = containedObjectPath(canonicalRoot, objectKey);
    const canonicalTarget = await realpath(target);
    if (!strictlyContained(canonicalRoot, canonicalTarget)) throw new Error(`${context} escaped its source root`);
    const bytes = await readFile(canonicalTarget);
    const expectedHash = match[match.length - 1];
    if (sha256(bytes) !== expectedHash) throw new Error(`${context} hash rejected`);
    await assertPng150Alpha(bytes, context);
    return bytes;
}

async function writeObject(outputDir: string, objectKey: string, bytes: Buffer): Promise<ObjectEntry> {
    const staticMatch = STATIC_KEY.exec(objectKey);
    const layerMatch = LAYER_KEY.exec(objectKey);
    const match = staticMatch ?? layerMatch;
    if (!match || sha256(bytes) !== match[match.length - 1]) throw new Error("portrait polish output identity rejected");
    await assertPng150Alpha(bytes, `portrait polish output ${objectKey}`);
    const path = containedObjectPath(resolve(outputDir, "objects"), objectKey);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
    const reread = await readFile(path);
    if (!reread.equals(bytes)) throw new Error("portrait polish output reread rejected");
    return {
        kind: staticMatch ? "portrait" : layerMatch?.[1] as ObjectEntry["kind"],
        objectKey,
        sizeBytes: bytes.length,
        sha256: sha256(bytes),
    };
}

function versionSlug(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
        throw new Error("portrait polish generated-at must be canonical ISO-8601");
    }
    return value.replace(/[:.]/g, "-");
}

export async function buildFirstPartyPortraitPolishCandidate(
    options: FirstPartyPortraitPolishCandidateOptions,
): Promise<{ manifestPath: string, payloadPath: string, reportPath: string, portraitCount: number }> {
    const outputDir = resolve(options.outputDir);
    if (!strictlyContained(FIRST_PARTY_PORTRAIT_POLISH_CANDIDATE_ROOT, outputDir)) {
        throw new Error("portrait polish output must stay inside its dedicated root");
    }
    const baseline = await readBaseline(options);
    const originalNonPortrait = JSON.stringify(stripPortraitDelivery(baseline.characters));
    const references = collectReferences(baseline.characters);
    const groups = groupReferences(references);
    await mkdir(resolve(outputDir, "objects"), { recursive: true });

    const written = new Map<string, ObjectEntry>();
    const thumbAudits = new Map<string, Awaited<ReturnType<typeof auditFirstPartyPortraitTransparency>>>();
    const sharedAssetEntries = new Map<string, { path: string, sizeBytes: number, sha256: string }>();
    for (const group of groups) {
        const [sourcePortrait, background, thumb, sourceOverlay] = await Promise.all([
            readHashedObject(options.baselineObjectRoot, group.portraitURL, STATIC_KEY, `${group.cardId} portrait`),
            readHashedObject(options.baselineObjectRoot, group.layers.backgroundURL, LAYER_KEY, `${group.cardId} background`),
            readHashedObject(options.baselineObjectRoot, group.layers.thumbURL, LAYER_KEY, `${group.cardId} thumb`),
            readHashedObject(options.baselineObjectRoot, group.layers.overlayURL, LAYER_KEY, `${group.cardId} overlay`),
        ]);
        if (!sourcePortrait.length || !sourceOverlay.length) throw new Error(`${group.cardId} source portrait rejected`);
        if (!thumbAudits.has(group.layers.thumbURL)) {
            thumbAudits.set(group.layers.thumbURL, await auditFirstPartyPortraitTransparency(thumb));
        }

        const paths = resolveFirstPartyPortraitLayerPaths(group.spec, {
            sharedLayers: options.sharedLayersRoot,
            cardThumbs: options.sharedLayersRoot,
        });
        const [rarityPath, typePath, canonicalSharedRoot] = await Promise.all([
            realpath(paths.rarity),
            realpath(paths.type),
            realpath(resolve(options.sharedLayersRoot)),
        ]);
        if (!strictlyContained(canonicalSharedRoot, rarityPath) || !strictlyContained(canonicalSharedRoot, typePath)) {
            throw new Error(`${group.cardId} badge source escaped its root`);
        }
        const [rarity, type] = await Promise.all([readFile(rarityPath), readFile(typePath)]);
        for (const [path, bytes] of [[rarityPath, rarity], [typePath, type]] as const) {
            const relativePath = relative(canonicalSharedRoot, path).replace(/\\/g, "/");
            sharedAssetEntries.set(relativePath, { path: relativePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
        }

        const overlay = await composeFirstPartyPortraitBadgeOverlay({ rarity, type });
        const portrait = await composeFirstPartyPortraitFromStaticLayers({ background, thumb, overlay });
        const portraitKey = `staging/v2/images/v4/portrait_${group.cardId}.${sha256(portrait)}.png`;
        const layerKeys: PortraitLayers = {
            backgroundURL: group.layers.backgroundURL,
            thumbURL: group.layers.thumbURL,
            overlayURL: `staging/v2/images/v5/layers/overlay.${sha256(overlay)}.png`,
        };
        for (const [key, bytes] of [
            [portraitKey, portrait],
            [layerKeys.backgroundURL, background],
            [layerKeys.thumbURL, thumb],
            [layerKeys.overlayURL, overlay],
        ] as const) {
            if (!written.has(key)) written.set(key, await writeObject(outputDir, key, bytes));
        }
        for (const reference of group.references) {
            reference.portraitURL = portraitKey;
            reference.portraitLayers = layerKeys;
        }
    }

    if (originalNonPortrait !== JSON.stringify(stripPortraitDelivery(baseline.characters))) {
        throw new Error("portrait polish candidate changed non-portrait data");
    }
    const artifact = buildCharacterDatasetArtifact(baseline.characters, {
        datasetVersion: options.generatedAt,
        generatedAt: options.generatedAt,
        fileName: "characters.json.gz",
    });
    const payloadKey = `staging/v2/releases/${versionSlug(options.generatedAt)}/${artifact.manifest.sha256}/characters.json.gz`;
    const manifest: DatasetManifest = { ...artifact.manifest, fileName: payloadKey };
    const payloadPath = containedObjectPath(resolve(outputDir, "objects"), payloadKey);
    await mkdir(resolve(payloadPath, ".."), { recursive: true });
    await writeFile(payloadPath, artifact.gzipBuffer, { flag: "wx" });
    if (!(await readFile(payloadPath)).equals(artifact.gzipBuffer)) throw new Error("portrait polish payload reread rejected");
    const manifestPath = resolve(outputDir, "characters-manifest.json");
    await writeFile(manifestPath, JSON_BYTES(manifest), { flag: "wx" });

    const audits = [...thumbAudits.values()];
    const objects = [...written.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
    const sharedAssets = [...sharedAssetEntries.values()].sort((left, right) => left.path.localeCompare(right.path));
    const report = {
        schemaVersion: 1,
        contract: FIRST_PARTY_PORTRAIT_POLISH_CONTRACT,
        contractVersion: "1.0.0",
        generatedAt: options.generatedAt,
        source: {
            datasetVersion: baseline.manifest.datasetVersion,
            payloadSizeBytes: baseline.payload.length,
            payloadSha256: baseline.manifest.sha256,
            characterCount: baseline.manifest.characterCount,
            sharedBadgeAssets: { entries: sharedAssets, inventorySha256: sha256(JSON_BYTES(sharedAssets)) },
        },
        geometry: {
            badgeScale: 0.9,
            rarity: { height: 65, anchor: "bottom-left" },
            classType: { height: 51, anchor: "top-right" },
        },
        transparency: {
            uniqueThumbCount: audits.length,
            thumbsMissingAlpha: audits.filter(audit => !audit.hasAlpha).length,
            thumbsWithoutTransparentPixels: audits.filter(audit => audit.transparentPixelCount === 0).length,
            thumbsWithOpaqueCorners: audits.filter(audit => audit.opaqueCornerCount > 0).length,
            thumbsWithOpaqueNearBlackBorderPixels: audits.filter(audit => audit.opaqueNearBlackBorderPixelCount > 0).length,
            totalOpaqueNearBlackBorderPixels: audits.reduce((total, audit) => total + audit.opaqueNearBlackBorderPixelCount, 0),
            maximumOpaqueNearBlackBorderPixelsInOneThumb: Math.max(0, ...audits.map(audit => audit.opaqueNearBlackBorderPixelCount)),
            colorKeyRemovalApplied: false,
        },
        portraits: {
            referenceCount: references.length,
            cardCount: groups.length,
            objectCount: objects.length,
            totalBytes: objects.reduce((total, entry) => total + entry.sizeBytes, 0),
            inventorySha256: sha256(JSON_BYTES(objects)),
            entries: objects,
        },
        dataset: manifest,
        checks: {
            everyInputObjectIsContentAddressedAndLocallyVerified: true,
            everyOutputIsTransparentPng150: true,
            everyThumbRetainsTransparentBackground: audits.every(audit => audit.hasAlpha && audit.transparentPixelCount > 0),
            noThumbHasAnOpaqueCorner: audits.every(audit => audit.opaqueCornerCount === 0),
            nearBlackArtworkPixelsWereMeasuredButNotRemoved: true,
            badgeGeometryReducedWithoutChangingAnchors: true,
            nonPortraitDataUnchanged: true,
            payloadManifestSizeAndShaMatch: true,
            noRemoteRead: true,
            noRemoteMutation: true,
        },
        readiness: {
            localPortraitPolishCandidate: "GO",
            androidStagingValidation: "NO-GO",
            publisherDryRun: "NO-GO",
            publication: "NO-GO",
            production: "NO-GO",
            r2Mutation: "NO-GO",
        },
    };
    if (!report.checks.everyThumbRetainsTransparentBackground || !report.checks.noThumbHasAnOpaqueCorner) {
        throw new Error("portrait polish transparency gate rejected the corpus");
    }
    const reportPath = resolve(outputDir, "first-party-portrait-polish-candidate-report.json");
    await writeFile(reportPath, JSON_BYTES(report), { flag: "wx" });
    return { manifestPath, payloadPath, reportPath, portraitCount: groups.length };
}

export function parseFirstPartyPortraitPolishCandidateArgs(args: string[]): FirstPartyPortraitPolishCandidateOptions {
    const allowed = new Set([
        "--baseline-manifest", "--baseline-payload", "--baseline-object-root", "--shared-layers",
        "--output-dir", "--generated-at",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!allowed.has(key) || !value || value.startsWith("--") || values.has(key)) {
            throw new Error("portrait polish candidate arguments rejected");
        }
        values.set(key, value);
    }
    if (values.size !== allowed.size) throw new Error("portrait polish candidate requires every explicit input");
    return {
        baselineManifestPath: resolve(values.get("--baseline-manifest") as string),
        baselinePayloadPath: resolve(values.get("--baseline-payload") as string),
        baselineObjectRoot: resolve(values.get("--baseline-object-root") as string),
        sharedLayersRoot: resolve(values.get("--shared-layers") as string),
        outputDir: resolve(values.get("--output-dir") as string),
        generatedAt: values.get("--generated-at") as string,
    };
}

async function main(): Promise<void> {
    console.log(JSON.stringify(await buildFirstPartyPortraitPolishCandidate(
        parseFirstPartyPortraitPolishCandidateArgs(process.argv.slice(2)),
    ), null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
