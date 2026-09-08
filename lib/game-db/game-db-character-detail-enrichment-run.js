"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterDetailEnrichmentCandidate = exports.parseCharacterDetailEnrichmentArgs = exports.CHARACTER_DETAIL_ENRICHMENT_CANDIDATE_ROOT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_character_detail_enrichment_1 = require("./game-db-character-detail-enrichment");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_source_1 = require("./game-db-source");
exports.CHARACTER_DETAIL_ENRICHMENT_CANDIDATE_ROOT = (0, path_1.resolve)("game-db", "data", "character-detail-enrichment");
function parseCharacterDetailEnrichmentArgs(args) {
    const supported = new Set([
        "--first-party-dir",
        "--primary-manifest",
        "--primary-payload",
        "--stage-manifest",
        "--stage-catalog",
        "--awakening-manifest",
        "--awakening-payload",
        "--output-dir",
        "--generated-at",
        "--shard-max-expanded-bytes",
    ]);
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key))
            throw new Error(`Unexpected Character detail enrichment argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key))
            throw new Error(`Missing or duplicate Character detail enrichment argument: ${key}`);
        values.set(key, value);
    }
    const required = [
        "--first-party-dir",
        "--primary-manifest",
        "--primary-payload",
        "--stage-manifest",
        "--stage-catalog",
        "--awakening-manifest",
        "--awakening-payload",
        "--output-dir",
        "--generated-at",
    ];
    for (const key of required) {
        if (!values.has(key))
            throw new Error(`Missing Character detail enrichment argument: ${key}`);
    }
    const generatedAt = values.get("--generated-at");
    if (Number.isNaN(Date.parse(generatedAt)) || new Date(generatedAt).toISOString() !== generatedAt) {
        throw new Error("Invalid --generated-at; use canonical ISO-8601");
    }
    const shardRaw = values.get("--shard-max-expanded-bytes");
    const shardMaxExpandedBytes = shardRaw === undefined ? undefined : Number(shardRaw);
    if (shardRaw !== undefined && (!Number.isSafeInteger(shardMaxExpandedBytes) || shardMaxExpandedBytes <= 0)) {
        throw new Error("Invalid --shard-max-expanded-bytes");
    }
    return {
        firstPartyDir: (0, path_1.resolve)(values.get("--first-party-dir")),
        primaryManifestPath: (0, path_1.resolve)(values.get("--primary-manifest")),
        primaryPayloadPath: (0, path_1.resolve)(values.get("--primary-payload")),
        stageManifestPath: (0, path_1.resolve)(values.get("--stage-manifest")),
        stageCatalogPath: (0, path_1.resolve)(values.get("--stage-catalog")),
        awakeningManifestPath: (0, path_1.resolve)(values.get("--awakening-manifest")),
        awakeningPayloadPath: (0, path_1.resolve)(values.get("--awakening-payload")),
        outputDir: (0, path_1.resolve)(values.get("--output-dir")),
        generatedAt,
        ...(shardMaxExpandedBytes !== undefined ? { shardMaxExpandedBytes } : {}),
    };
}
exports.parseCharacterDetailEnrichmentArgs = parseCharacterDetailEnrichmentArgs;
async function buildCharacterDetailEnrichmentCandidate(options) {
    await assertFreshOutput(options.outputDir);
    const metadataBytes = await (0, promises_1.readFile)((0, path_1.resolve)(options.firstPartyDir, "metadata.json"));
    const metadata = JSON.parse(metadataBytes.toString("utf8"));
    if (metadata.source !== "first-party-export" || metadata.region !== "global"
        || !metadata.dbVersion || !/^\d+$/.test(metadata.dbVersion)
        || !metadata.assetVersion || !/^\d+$/.test(metadata.assetVersion)
        || !metadata.apkVersion || !metadata.exportedAt || Number.isNaN(Date.parse(metadata.exportedAt))) {
        throw new Error("Character detail enrichment requires a versioned first-party Global export");
    }
    const tableInventory = await inventoryFirstPartyTables(options.firstPartyDir);
    const firstPartyTableInventorySha256 = sha(Buffer.from(JSON.stringify(tableInventory), "utf8"));
    const tables = await (0, game_db_experiment_1.loadRequiredGameDbTables)((0, game_db_source_1.resolveGameDbSourceConfig)(options.firstPartyDir));
    const primary = await readPrimaryDataset(options.primaryManifestPath, options.primaryPayloadPath);
    const stage = await readStageCatalog(options.stageManifestPath, options.stageCatalogPath);
    const awakening = await readAwakeningCatalog(options.awakeningManifestPath, options.awakeningPayloadPath);
    if (metadata.dbVersion !== stage.manifest.sourceSnapshotVersion
        || metadata.dbVersion !== awakening.manifest.sourceSnapshotVersion) {
        throw new Error("Character detail first-party export does not match the Stage/Awakening snapshot");
    }
    const build = (0, game_db_character_detail_enrichment_1.buildCharacterDetailEnrichment)({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: stage.manifest.sourceSnapshotVersion,
        sourceDatabaseSha256: stage.manifest.sourceDatabaseSha256,
        firstPartyTableInventorySha256,
        tables,
        primaryCharacters: primary.characters,
        primaryManifest: primary.manifest,
        stageCatalog: stage.catalog,
        stageManifest: stage.manifest,
        stagePayloadSha256: stage.payloadSha256,
        awakeningCatalog: awakening.catalog,
        awakeningManifest: awakening.manifest,
        awakeningPayloadSha256: awakening.payloadSha256,
        ...(options.shardMaxExpandedBytes !== undefined
            ? { shardMaxExpandedBytes: options.shardMaxExpandedBytes }
            : {}),
    });
    await (0, promises_1.mkdir)(options.outputDir);
    await writeObject(options.outputDir, build.manifest.catalog.objectKey, build.catalogGzip);
    for (const shard of build.shards)
        await writeObject(options.outputDir, shard.manifest.objectKey, shard.gzip);
    const manifestPath = (0, path_1.resolve)(options.outputDir, "character-details-manifest.json");
    await (0, promises_1.writeFile)(manifestPath, (0, game_db_character_detail_enrichment_1.serializeCharacterDetailManifest)(build.manifest), { flag: "wx" });
    const reportPath = (0, path_1.resolve)(options.outputDir, "character-detail-enrichment-report.json");
    await (0, format_json_1.writeFormattedJson)(reportPath, {
        schemaVersion: 1,
        contract: "dokkan-character-detail-enrichment-candidate-report",
        contractVersion: "1.0.0",
        generatedAt: options.generatedAt,
        source: {
            kind: "first-party-game-db-over-approved-awakening-graph",
            noWebsiteScraping: true,
            firstPartyExport: {
                directory: options.firstPartyDir,
                dbVersion: metadata.dbVersion,
                assetVersion: metadata.assetVersion,
                apkVersion: metadata.apkVersion,
                exportedAt: metadata.exportedAt,
                metadata: {
                    sizeBytes: metadataBytes.byteLength,
                    sha256: sha(metadataBytes),
                },
                tableInventorySha256: firstPartyTableInventorySha256,
                tableCount: tableInventory.length,
                tables: tableInventory,
            },
            bindings: build.manifest.sourceBindings,
        },
        selection: {
            rule: "every approved Awakening Route graph card absent from the primary Character catalog",
            excluded: [
                "cards outside the delivered awakening graph",
                "cards already present in the primary Character catalog",
                "EZA/SEZA self-edges as form navigation",
            ],
            ...build.manifest.coverage,
            acquisitionEvidence: {
                role: "diagnostic-only; Stage/Event Mission rewards never filter graph-only selection",
                rewardCardCount: build.manifest.coverage.rewardCardCount,
                graphRewardCardCount: build.manifest.coverage.graphRewardCardCount,
                rewardCardsOutsideGraphCount: build.manifest.coverage.rewardCardsOutsideGraphCount,
                pathCardCount: build.manifest.coverage.acquisitionPathCardCount,
                primaryPathCardCount: build.manifest.coverage.acquisitionPrimaryPathCardCount,
                graphOnlyPathCardCount: build.manifest.coverage.acquisitionGraphOnlyPathCardCount,
                directStageDropDetailCount: build.manifest.coverage.directStageDropDetailCount,
                directEventMissionDetailCount: build.manifest.coverage.directEventMissionDetailCount,
                intermediateOnlyDetailCount: build.manifest.coverage.intermediateOnlyDetailCount,
                graphOnlyWithoutAcquisitionPathCount: build.manifest.coverage.graphOnlyWithoutAcquisitionPathCount,
            },
            materialization: {
                selectedDetailCardCount: build.manifest.coverage.selectedDetailCardCount,
                materializedDetailCardCount: build.manifest.coverage.materializedDetailCardCount,
                gapCount: build.manifest.coverage.materializationGapCount,
                gaps: build.audit.materializationGaps,
            },
            primaryCardIdsOutsideGraph: build.audit.primaryCardIdsOutsideGraph,
            rewardCardIdsOutsideGraph: build.audit.rewardCardIdsOutsideGraph,
            graphPortraitSpecOverrideCount: build.audit.projectionPortraitSpecOverrideIds.length,
            graphPortraitSpecOverrideIds: build.audit.projectionPortraitSpecOverrideIds,
        },
        semantics: {
            identity: "identity.cardId is exact cards.id and is the only detail lookup key",
            form: "form previous/next IDs are only z-awaken/dokkan-awaken edges; they are not in-battle transformations",
            releaseState: "availableReleaseStates is independent from card form and starts with base",
            canonicalNavigation: "canonicalNavigation always opens the exact cardId at base state",
            unknownValues: "absent; legacy synthetic empty/zero fields and third-party art URLs are not exported",
            acquisitionEvidence: "Stage/Mission evidence annotates exact cards but is not a detail-selection dependency",
        },
        output: {
            manifest: build.manifest,
            shardMaxExpandedBytes: build.audit.shardMaxExpandedBytes,
            totalCompressedBytes: build.audit.totalCompressedBytes,
            totalExpandedBytes: build.audit.totalExpandedBytes,
            minimumShardExpandedBytes: build.audit.minimumShardExpandedBytes,
            maximumShardExpandedBytes: build.audit.maximumShardExpandedBytes,
            manifestSizeBytes: build.audit.manifestSizeBytes,
        },
        compatibility: {
            primaryCharacterRosterUnchanged: true,
            searchAndTeamInputsUnchanged: true,
            additiveOptionalManifest: true,
            bootstrapRequired: false,
            allShardsRequired: false,
            androidLegacyCachesRemainValid: true,
            appConsumerIntegrated: false,
        },
        readiness: {
            localCandidate: "GO",
            sourceBindings: "GO",
            deterministicReplay: "NOT-YET-RUN",
            androidConsumer: "NO-GO",
            remoteDryRun: "NO-GO",
            publication: "NO-GO",
        },
    });
    await validateWrittenCandidate(options.outputDir, build);
    return { manifestPath, reportPath, build };
}
exports.buildCharacterDetailEnrichmentCandidate = buildCharacterDetailEnrichmentCandidate;
async function readPrimaryDataset(manifestPath, payloadPath) {
    const manifest = JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
    const payload = await (0, promises_1.readFile)(payloadPath);
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip"
        || manifest.sizeBytes !== payload.byteLength || manifest.sha256 !== sha(payload)) {
        throw new Error("Character detail primary payload does not match its manifest");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.byteLength !== manifest.uncompressedSizeBytes)
        throw new Error("Character detail primary raw size mismatch");
    const characters = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("Character detail primary character count mismatch");
    }
    return { manifest, characters };
}
async function readStageCatalog(manifestPath, payloadPath) {
    const manifest = JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
    const payload = await (0, promises_1.readFile)(payloadPath);
    const payloadSha256 = sha(payload);
    if (manifest.catalog.sizeBytes !== payload.byteLength || manifest.catalog.sha256 !== payloadSha256
        || manifest.catalog.contentEncoding !== "gzip" || manifest.catalog.contentType !== "application/json") {
        throw new Error("Character detail Stage catalog does not match its manifest");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.byteLength !== manifest.catalog.expandedSizeBytes)
        throw new Error("Character detail Stage catalog raw size mismatch");
    return { manifest, catalog: JSON.parse(raw.toString("utf8")), payloadSha256 };
}
async function readAwakeningCatalog(manifestPath, payloadPath) {
    const manifest = JSON.parse(await (0, promises_1.readFile)(manifestPath, "utf8"));
    const payload = await (0, promises_1.readFile)(payloadPath);
    const payloadSha256 = sha(payload);
    if (manifest.payload.sizeBytes !== payload.byteLength || manifest.payload.sha256 !== payloadSha256
        || manifest.payload.contentEncoding !== "gzip" || manifest.payload.contentType !== "application/json") {
        throw new Error("Character detail Awakening catalog does not match its manifest");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.byteLength !== manifest.payload.expandedSizeBytes)
        throw new Error("Character detail Awakening catalog raw size mismatch");
    return { manifest, catalog: JSON.parse(raw.toString("utf8")), payloadSha256 };
}
async function inventoryFirstPartyTables(firstPartyDir) {
    const dataDir = (0, path_1.resolve)(firstPartyDir, "data");
    return Promise.all([...game_db_experiment_1.REQUIRED_GAME_DB_TABLES].sort().map(async (table) => {
        const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(dataDir, `${table}.csv`));
        return { path: `data/${table}.csv`, sizeBytes: bytes.byteLength, sha256: sha(bytes) };
    }));
}
async function assertFreshOutput(outputDir) {
    await (0, promises_1.mkdir)(exports.CHARACTER_DETAIL_ENRICHMENT_CANDIDATE_ROOT, { recursive: true });
    const root = await (0, promises_1.realpath)(exports.CHARACTER_DETAIL_ENRICHMENT_CANDIDATE_ROOT);
    const target = (0, path_1.resolve)(outputDir);
    const parent = await (0, promises_1.realpath)((0, path_1.dirname)(target));
    if (!isStrictlyContained(root, target)
        || (parent !== root && !isStrictlyContained(root, parent))) {
        throw new Error("Character detail enrichment output must stay inside its dedicated candidate root");
    }
    if (await (0, promises_1.lstat)(target).catch(() => undefined)) {
        throw new Error("Character detail enrichment output must be a fresh directory");
    }
}
async function writeObject(outputDir, objectKey, bytes) {
    if (!/^character-details\/objects\/[a-f0-9]{64}\.json\.gz$/.test(objectKey)) {
        throw new Error("Character detail candidate object key is invalid");
    }
    const path = (0, path_1.resolve)(outputDir, ...objectKey.split("/"));
    if (!isStrictlyContained(outputDir, path))
        throw new Error("Character detail candidate object escaped output root");
    await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
    await (0, promises_1.writeFile)(path, bytes, { flag: "wx" });
}
async function validateWrittenCandidate(outputDir, build) {
    const objects = [
        { descriptor: build.manifest.catalog, bytes: build.catalogGzip },
        ...build.shards.map(shard => ({ descriptor: shard.manifest, bytes: shard.gzip })),
    ];
    for (const object of objects) {
        const path = (0, path_1.resolve)(outputDir, ...object.descriptor.objectKey.split("/"));
        const written = await (0, promises_1.readFile)(path);
        if (!written.equals(object.bytes) || written.byteLength !== object.descriptor.sizeBytes
            || sha(written) !== object.descriptor.sha256
            || (0, zlib_1.gunzipSync)(written).byteLength !== object.descriptor.expandedSizeBytes) {
            throw new Error(`Character detail candidate object verification failed: ${object.descriptor.objectKey}`);
        }
    }
}
function isStrictlyContained(root, target) {
    const path = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    return path.length > 0 && path !== ".." && !path.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(path);
}
function sha(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
async function main() {
    const result = await buildCharacterDetailEnrichmentCandidate(parseCharacterDetailEnrichmentArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
        manifestPath: result.manifestPath,
        reportPath: result.reportPath,
        datasetVersion: result.build.manifest.datasetVersion,
        coverage: result.build.manifest.coverage,
        shards: result.build.manifest.shardCount,
        totalCompressedBytes: result.build.audit.totalCompressedBytes,
        totalExpandedBytes: result.build.audit.totalExpandedBytes,
        manifestSizeBytes: result.build.audit.manifestSizeBytes,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-character-detail-enrichment-run.js.map