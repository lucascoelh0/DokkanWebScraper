import { createHash } from "crypto";
import { validateKiMultipliers } from "./game-db-ki-multipliers";
import { gzipSync } from "zlib";
import type { Character, PortraitSpec } from "../character";
import type { DatasetManifest } from "../dataset-artifacts";
import {
    AWAKENING_MEDAL_CONTRACT,
    AWAKENING_MEDAL_CONTRACT_VERSION,
    AwakeningMedalCatalog,
    AwakeningMedalManifest,
    AwakeningRoute,
    validateAwakeningMedalCatalog,
} from "./game-db-awakening-medal-catalog";
import { projectGameDbCharactersToDokkanpanion } from "./game-db-app-projection";
import {
    MaterializedGameDbCharacterDetail,
    materializeGameDbCharacterDetail,
} from "./game-db-character-materializer";
import { buildGameDbCharacterSnapshots } from "./game-db-experiment";
import type { GameDbCharacterSnapshot } from "./game-db-contract";
import type { GameDbRow } from "./game-db-source";
import {
    StageCatalogPayload,
    StageDeliveryManifest,
    validateStageDeliveryRoutes,
} from "./game-db-stage-delivery";

export const CHARACTER_DETAIL_ENRICHMENT_CONTRACT = "dokkan-character-detail-enrichment";
export const CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION = "1.0.0";
export const DEFAULT_CHARACTER_DETAIL_SHARD_MAX_EXPANDED_BYTES = 512 * 1024;
export const CHARACTER_DETAIL_MANIFEST_MAX_BYTES = 64 * 1024;

export type CharacterDetailSourceRole = "stage-drop" | "event-mission" | "awakening-path";
export type CharacterDetailReleaseState = "base" | "eza" | "seza";

export interface CharacterDetailIdentity {
    /** Exact card row identity. This is the only detail lookup/navigation key. */
    cardId: string,
    /** First-party cards.character_id; descriptive identity, never a route alias. */
    characterId: string,
}

export interface CharacterDetailForm {
    kind: "awakening-card",
    previousCardIds: string[],
    nextCardIds: string[],
}

export interface CharacterDetailCanonicalNavigation {
    routeKind: "character-detail",
    cardId: string,
    releaseState: "base",
}

export interface CharacterDetailCatalogEntry {
    identity: CharacterDetailIdentity,
    form: CharacterDetailForm,
    availableReleaseStates: CharacterDetailReleaseState[],
    canonicalNavigation: CharacterDetailCanonicalNavigation,
    sourceRoles: CharacterDetailSourceRole[],
    portraitSpec: PortraitSpec,
    detailShardId: string,
}

export interface CharacterDetailRecord extends Omit<CharacterDetailCatalogEntry, "detailShardId"> {
    detail: MaterializedGameDbCharacterDetail,
}

export interface CharacterDetailSourceBinding {
    datasetVersion: string,
    payloadSha256: string,
}

export interface CharacterDetailPrimarySourceBinding extends CharacterDetailSourceBinding {
    characterCount: number,
}

export interface CharacterDetailStageSourceBinding extends CharacterDetailSourceBinding {
    characterDropCount: number,
    eventMissionCount: number,
}

export interface CharacterDetailAwakeningSourceBinding extends CharacterDetailSourceBinding {
    routeCardCount: number,
    routeCount: number,
}

export interface CharacterDetailSourceBindings {
    primaryCharacters: CharacterDetailPrimarySourceBinding,
    stages: CharacterDetailStageSourceBinding,
    awakeningGraph: CharacterDetailAwakeningSourceBinding,
    firstPartyTableInventorySha256: string,
}

export interface CharacterDetailCoverage {
    /** Complete approved Awakening Route graph, independent from acquisition evidence. */
    graphCardCount: number,
    primaryGraphCardCount: number,
    primaryOutsideGraphCount: number,
    graphOnlyCardCount: number,
    /** Stage/Mission evidence is diagnostic only and never limits graph-only selection. */
    acquisitionPathCardCount: number,
    acquisitionPrimaryPathCardCount: number,
    acquisitionGraphOnlyPathCardCount: number,
    graphOnlyWithoutAcquisitionPathCount: number,
    /** Exact result of materializing the graph-only selection. */
    selectedDetailCardCount: number,
    materializedDetailCardCount: number,
    materializationGapCount: number,
    rewardCardCount: number,
    graphRewardCardCount: number,
    rewardCardsOutsideGraphCount: number,
    relevantPathCardCount: number,
    primaryPathCardCount: number,
    detailCardCount: number,
    missingDetailCardCount: number,
    neutralClassDetailCount: number,
    detailsByReleaseState: Record<CharacterDetailReleaseState, number>,
    directStageDropDetailCount: number,
    directEventMissionDetailCount: number,
    intermediateOnlyDetailCount: number,
}

export interface CharacterDetailDeliveryObject {
    objectKey: string,
    sha256: string,
    sizeBytes: number,
    expandedSizeBytes: number,
    contentType: "application/json",
    contentEncoding: "gzip",
}

export interface CharacterDetailShardManifest extends CharacterDetailDeliveryObject {
    id: string,
    cardIds: string[],
}

export interface CharacterDetailCatalogPayload {
    schemaVersion: 1,
    contract: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
    contractVersion: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    sourceBindings: CharacterDetailSourceBindings,
    coverage: CharacterDetailCoverage,
    count: number,
    entries: CharacterDetailCatalogEntry[],
}

export interface CharacterDetailShardPayload {
    schemaVersion: 1,
    contract: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
    contractVersion: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
    datasetVersion: string,
    shardId: string,
    records: CharacterDetailRecord[],
}

export interface CharacterDetailEnrichmentManifest {
    schemaVersion: 1,
    contract: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
    contractVersion: typeof CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    sourceBindings: CharacterDetailSourceBindings,
    coverage: CharacterDetailCoverage,
    cardCount: number,
    shardCount: number,
    catalog: CharacterDetailDeliveryObject,
    shards: CharacterDetailShardManifest[],
}

export interface CharacterDetailEnrichmentBuild {
    catalog: CharacterDetailCatalogPayload,
    catalogBytes: Buffer,
    catalogGzip: Buffer,
    shards: Array<{
        payload: CharacterDetailShardPayload,
        bytes: Buffer,
        gzip: Buffer,
        manifest: CharacterDetailShardManifest,
    }>,
    manifest: CharacterDetailEnrichmentManifest,
    audit: {
        shardMaxExpandedBytes: number,
        totalCompressedBytes: number,
        totalExpandedBytes: number,
        minimumShardExpandedBytes: number,
        maximumShardExpandedBytes: number,
        manifestSizeBytes: number,
        rewardCardIdsOutsideGraph: string[],
        primaryCardIdsOutsideGraph: string[],
        detailCardIds: string[],
        projectionPortraitSpecOverrideIds: string[],
        materializationGaps: CharacterDetailMaterializationGap[],
    },
}

export type CharacterDetailMaterializationGapReason =
    | "missing-source-card"
    | "materialization-unsupported";

export interface CharacterDetailMaterializationGap {
    cardId: string,
    reason: CharacterDetailMaterializationGapReason,
    detail: string,
}

export interface CharacterDetailEnrichmentBuildOptions {
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    firstPartyTableInventorySha256: string,
    tables: Record<string, GameDbRow[]>,
    primaryCharacters: Character[],
    primaryManifest: DatasetManifest,
    stageCatalog: StageCatalogPayload,
    stageManifest: StageDeliveryManifest,
    stagePayloadSha256: string,
    awakeningCatalog: AwakeningMedalCatalog,
    awakeningManifest: AwakeningMedalManifest,
    awakeningPayloadSha256: string,
    shardMaxExpandedBytes?: number,
    compressionLevel?: number,
}

export interface CharacterDetailSelection {
    rewardCardIds: string[],
    graphRewardCardIds: string[],
    rewardCardIdsOutsideGraph: string[],
    relevantPathCardIds: string[],
    primaryGraphCardIds: string[],
    primaryCardIdsOutsideGraph: string[],
    detailCardIds: string[],
    sourceRolesById: ReadonlyMap<string, CharacterDetailSourceRole[]>,
    incoming: ReadonlyMap<string, string[]>,
    outgoing: ReadonlyMap<string, string[]>,
}

interface PendingShard {
    id: string,
    records: CharacterDetailRecord[],
}

export function buildCharacterDetailEnrichment(
    options: CharacterDetailEnrichmentBuildOptions,
): CharacterDetailEnrichmentBuild {
    validateInputs(options);
    const shardMaxExpandedBytes = options.shardMaxExpandedBytes
        ?? DEFAULT_CHARACTER_DETAIL_SHARD_MAX_EXPANDED_BYTES;
    const compressionLevel = options.compressionLevel ?? 9;
    if (!Number.isSafeInteger(shardMaxExpandedBytes) || shardMaxExpandedBytes < 64 * 1024
        || shardMaxExpandedBytes > 2 * 1024 * 1024) {
        throw new Error("Character detail shard maximum must be between 65536 and 2097152 expanded bytes");
    }
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Character detail compression level must be an integer from 1 to 9");
    }

    const graph = options.awakeningCatalog.routeGraph;
    const primaryIds = new Set(options.primaryCharacters.map(character => character.id));
    const selection = selectCharacterDetailCardIds(options.stageCatalog, graph, primaryIds);
    const {
        sourceRolesById,
        rewardCardIds,
        graphRewardCardIds: graphRewardIds,
        rewardCardIdsOutsideGraph,
        relevantPathCardIds: relevantPathIds,
        detailCardIds,
        incoming,
        outgoing,
    } = selection;
    const graphCardById = new Map(graph.cards.map(card => [card.id, card]));
    if (detailCardIds.length === 0) throw new Error("Character detail enrichment selected no missing cards");

    const sourceCardIds = new Set((options.tables.cards ?? [])
        .map(row => row.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0));
    const missingSourceCards: CharacterDetailMaterializationGap[] = detailCardIds
        .filter(id => !sourceCardIds.has(id))
        .map(cardId => ({
            cardId,
            reason: "missing-source-card" as const,
            detail: "approved Awakening Route card has no exact cards.csv row",
        }));
    if (missingSourceCards.length > 0) throwMaterializationGaps(missingSourceCards);

    const snapshots = buildGameDbCharacterSnapshots(detailCardIds, options.tables);
    const projectionGaps: CharacterDetailMaterializationGap[] = [];
    const projections = snapshots.flatMap(snapshot => {
        try {
            return projectGameDbCharactersToDokkanpanion(
                [snapshot],
                { sourceVersion: options.sourceSnapshotVersion },
            );
        } catch (error) {
            projectionGaps.push({
                cardId: snapshot.id,
                reason: "materialization-unsupported",
                detail: `exact-card projection failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            return [];
        }
    });
    if (projectionGaps.length > 0) throwMaterializationGaps(projectionGaps);
    const relatedFormIds = [...new Set(projections.flatMap(projection =>
        projection.transformations
            .filter(relation => relation.source !== "unknown")
            .map(relation => relation.id),
    ))].filter(id => !detailCardIds.includes(id)).sort(numericCompare);
    const relatedProjections = relatedFormIds.length > 0
        ? projectGameDbCharactersToDokkanpanion(
            buildGameDbCharacterSnapshots(relatedFormIds, options.tables),
            { sourceVersion: options.sourceSnapshotVersion },
        )
        : [];
    // The already approved awakening graph derives icon identity from
    // cards.resource_id. The general app projection still keys its fallback
    // portrait spec from cards.id, so bind exact-card details back to the graph
    // spec instead of changing the incumbent roster materializer.
    const projectionPortraitSpecOverrideIds = projections
        .filter(projection => JSON.stringify(projection.portraitSpec)
            !== JSON.stringify(requireValue(graphCardById, projection.id, "awakening graph card").portraitSpec))
        .map(projection => projection.id);
    const detailProjections = projections.map(projection => ({
        ...projection,
        portraitSpec: requireValue(graphCardById, projection.id, "awakening graph card").portraitSpec,
    }));
    const projectionById = new Map([...detailProjections, ...relatedProjections].map(projection => [projection.id, projection]));
    if (projectionById.size !== detailProjections.length + relatedProjections.length) {
        throw new Error("Character detail projection contains duplicate IDs");
    }
    const snapshotById = new Map<string, GameDbCharacterSnapshot>(snapshots.map(snapshot => [snapshot.id, snapshot]));
    const materializationGaps: CharacterDetailMaterializationGap[] = [];
    const records = detailProjections.flatMap(projection => {
        try {
            const snapshot = requireValue(snapshotById, projection.id, "detail snapshot");
            const graphCard = requireValue(graphCardById, projection.id, "awakening graph card");
            if (snapshot.characterId !== graphCard.characterId) {
                throw new Error(`identity diverges from the awakening graph (${snapshot.characterId} != ${graphCard.characterId})`);
            }
            const previousCardIds = [...new Set((incoming.get(projection.id) ?? []))].sort(numericCompare);
            const nextCardIds = [...new Set((outgoing.get(projection.id) ?? []))].sort(numericCompare);
            const directRoles = sourceRolesById.get(projection.id) ?? [];
            const availableReleaseStates: CharacterDetailReleaseState[] = [
                "base",
                ...(projection.hasEza ? ["eza" as const] : []),
                ...(projection.hasSeza ? ["seza" as const] : []),
            ];
            return [{
                identity: { cardId: projection.id, characterId: snapshot.characterId },
                form: { kind: "awakening-card" as const, previousCardIds, nextCardIds },
                availableReleaseStates,
                canonicalNavigation: {
                    routeKind: "character-detail" as const,
                    cardId: projection.id,
                    releaseState: "base" as const,
                },
                sourceRoles: [...new Set<CharacterDetailSourceRole>([...directRoles, "awakening-path"])],
                portraitSpec: projection.portraitSpec,
                detail: materializeGameDbCharacterDetail(projection, projectionById),
            } as CharacterDetailRecord];
        } catch (error) {
            materializationGaps.push({
                cardId: projection.id,
                reason: "materialization-unsupported",
                detail: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }).sort((left, right) => numericCompare(left.identity.cardId, right.identity.cardId));
    if (materializationGaps.length > 0) throwMaterializationGaps(materializationGaps);
    if (new Set(records.map(record => record.identity.cardId)).size !== records.length) {
        throw new Error("Character detail records contain duplicate card IDs");
    }

    const sourceBindings: CharacterDetailSourceBindings = {
        primaryCharacters: {
            datasetVersion: options.primaryManifest.datasetVersion,
            payloadSha256: options.primaryManifest.sha256,
            characterCount: options.primaryManifest.characterCount,
        },
        stages: {
            datasetVersion: options.stageManifest.datasetVersion,
            payloadSha256: options.stagePayloadSha256,
            characterDropCount: options.stageManifest.characterDropCount ?? 0,
            eventMissionCount: options.stageManifest.eventMissionCount,
        },
        awakeningGraph: {
            datasetVersion: options.awakeningManifest.datasetVersion,
            payloadSha256: options.awakeningPayloadSha256,
            routeCardCount: options.awakeningManifest.routeCardCount,
            routeCount: options.awakeningManifest.routeCount,
        },
        firstPartyTableInventorySha256: options.firstPartyTableInventorySha256,
    };
    const acquisitionPathDetailIds = new Set(relevantPathIds.filter(id => !primaryIds.has(id)));
    const primaryGraphCardIds = selection.primaryGraphCardIds;
    const primaryCardIdsOutsideGraph = selection.primaryCardIdsOutsideGraph;
    const coverage: CharacterDetailCoverage = {
        graphCardCount: graph.cards.length,
        primaryGraphCardCount: primaryGraphCardIds.length,
        primaryOutsideGraphCount: primaryCardIdsOutsideGraph.length,
        graphOnlyCardCount: detailCardIds.length,
        acquisitionPathCardCount: relevantPathIds.length,
        acquisitionPrimaryPathCardCount: relevantPathIds.filter(id => primaryIds.has(id)).length,
        acquisitionGraphOnlyPathCardCount: acquisitionPathDetailIds.size,
        graphOnlyWithoutAcquisitionPathCount: detailCardIds.length - acquisitionPathDetailIds.size,
        selectedDetailCardCount: detailCardIds.length,
        materializedDetailCardCount: records.length,
        materializationGapCount: materializationGaps.length,
        rewardCardCount: rewardCardIds.length,
        graphRewardCardCount: graphRewardIds.length,
        rewardCardsOutsideGraphCount: rewardCardIdsOutsideGraph.length,
        // Compatibility aggregate required by the 1.0 Android parser. The
        // additive acquisition fields above retain the narrower path metrics.
        relevantPathCardCount: primaryGraphCardIds.length + records.length,
        primaryPathCardCount: primaryGraphCardIds.length,
        detailCardCount: records.length,
        missingDetailCardCount: detailCardIds.length - records.length,
        neutralClassDetailCount: detailProjections.filter(projection => projection.characterClass === "None").length,
        detailsByReleaseState: {
            base: records.length,
            eza: detailProjections.filter(projection => projection.hasEza).length,
            seza: detailProjections.filter(projection => projection.hasSeza).length,
        },
        directStageDropDetailCount: records.filter(record => record.sourceRoles.includes("stage-drop")).length,
        directEventMissionDetailCount: records.filter(record => record.sourceRoles.includes("event-mission")).length,
        intermediateOnlyDetailCount: records.filter(record =>
            acquisitionPathDetailIds.has(record.identity.cardId)
            && !record.sourceRoles.includes("stage-drop") && !record.sourceRoles.includes("event-mission"),
        ).length,
    };
    const datasetIdentity = {
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.awakeningCatalog.assetBaseUrl,
        sourceBindings,
        records,
    };
    const datasetVersion = `${options.sourceSnapshotVersion}-${sha(Buffer.from(JSON.stringify(datasetIdentity))).slice(0, 16)}`;
    const pendingShards = partitionRecords(records, datasetVersion, shardMaxExpandedBytes);
    const shardIdByCardId = new Map<string, string>();
    const shards = pendingShards.map(shard => {
        const payload = shardPayload(datasetVersion, shard);
        const bytes = Buffer.from(JSON.stringify(payload), "utf8");
        if (bytes.byteLength > shardMaxExpandedBytes) {
            throw new Error(`Character detail shard ${shard.id} exceeds its expanded-byte limit`);
        }
        const gzip = gzipSync(bytes, { level: compressionLevel });
        const digest = sha(gzip);
        const cardIds = shard.records.map(record => record.identity.cardId);
        for (const cardId of cardIds) {
            if (shardIdByCardId.has(cardId)) throw new Error(`Character detail ${cardId} was partitioned twice`);
            shardIdByCardId.set(cardId, shard.id);
        }
        return {
            payload,
            bytes,
            gzip,
            manifest: {
                id: shard.id,
                objectKey: `character-details/objects/${digest}.json.gz`,
                sha256: digest,
                sizeBytes: gzip.byteLength,
                expandedSizeBytes: bytes.byteLength,
                contentType: "application/json" as const,
                contentEncoding: "gzip" as const,
                cardIds,
            },
        };
    });
    const entries = records.map(record => ({
        identity: record.identity,
        form: record.form,
        availableReleaseStates: record.availableReleaseStates,
        canonicalNavigation: record.canonicalNavigation,
        sourceRoles: record.sourceRoles,
        portraitSpec: record.portraitSpec,
        detailShardId: requireValue(shardIdByCardId, record.identity.cardId, "detail shard"),
    }));
    const catalog: CharacterDetailCatalogPayload = {
        schemaVersion: 1,
        contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
        contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: options.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.awakeningCatalog.assetBaseUrl,
        sourceBindings,
        coverage,
        count: entries.length,
        entries,
    };
    const catalogBytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const catalogGzip = gzipSync(catalogBytes, { level: compressionLevel });
    const catalogDigest = sha(catalogGzip);
    const catalogObject: CharacterDetailDeliveryObject = {
        objectKey: `character-details/objects/${catalogDigest}.json.gz`,
        sha256: catalogDigest,
        sizeBytes: catalogGzip.byteLength,
        expandedSizeBytes: catalogBytes.byteLength,
        contentType: "application/json",
        contentEncoding: "gzip",
    };
    const manifest: CharacterDetailEnrichmentManifest = {
        schemaVersion: 1,
        contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
        contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: options.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.awakeningCatalog.assetBaseUrl,
        sourceBindings,
        coverage,
        cardCount: entries.length,
        shardCount: shards.length,
        catalog: catalogObject,
        shards: shards.map(shard => shard.manifest),
    };
    // The manifest repeats exact card IDs per shard for fail-closed coverage.
    // Keep its wire representation compact so a full graph remains under the
    // Android 64 KiB manifest ceiling without weakening shard validation.
    const manifestSizeBytes = serializeCharacterDetailManifest(manifest).byteLength;
    if (manifestSizeBytes > CHARACTER_DETAIL_MANIFEST_MAX_BYTES) {
        throw new Error(`Character detail manifest exceeds Android's ${CHARACTER_DETAIL_MANIFEST_MAX_BYTES}-byte limit`);
    }
    validateCharacterDetailDelivery(catalog, manifest, shards.map(shard => shard.payload));
    const expandedSizes = shards.map(shard => shard.bytes.byteLength);
    return {
        catalog,
        catalogBytes,
        catalogGzip,
        shards,
        manifest,
        audit: {
            shardMaxExpandedBytes,
            totalCompressedBytes: catalogGzip.byteLength + shards.reduce((total, shard) => total + shard.gzip.byteLength, 0),
            totalExpandedBytes: catalogBytes.byteLength + shards.reduce((total, shard) => total + shard.bytes.byteLength, 0),
            minimumShardExpandedBytes: Math.min(...expandedSizes),
            maximumShardExpandedBytes: Math.max(...expandedSizes),
            manifestSizeBytes,
            rewardCardIdsOutsideGraph,
            primaryCardIdsOutsideGraph,
            detailCardIds,
            projectionPortraitSpecOverrideIds,
            materializationGaps,
        },
    };
}

export function selectCharacterDetailCardIds(
    stageCatalog: StageCatalogPayload,
    graph: AwakeningMedalCatalog["routeGraph"],
    primaryIds: ReadonlySet<string>,
): CharacterDetailSelection {
    const graphCardIds = new Set(graph.cards.map(card => card.id));
    const sourceRolesById = rewardSourceRoles(stageCatalog);
    const rewardCardIds = [...sourceRolesById.keys()].sort(numericCompare);
    const graphRewardCardIds = rewardCardIds.filter(id => graphCardIds.has(id));
    const rewardCardIdsOutsideGraph = rewardCardIds.filter(id => !graphCardIds.has(id));
    const normalRoutes = graph.routes.filter(isNormalAwakeningRoute);
    const outgoing = adjacency(normalRoutes, "sourceCardId", "targetCardId");
    const incoming = adjacency(normalRoutes, "targetCardId", "sourceCardId");
    const forwardFromRewards = reachable(graphRewardCardIds, outgoing);
    const backwardFromPrimary = reachable(
        [...primaryIds].filter(id => graphCardIds.has(id)),
        incoming,
    );
    const relevantPathCardIds = graph.cards
        .map(card => card.id)
        .filter(id => forwardFromRewards.has(id) && backwardFromPrimary.has(id))
        .sort(numericCompare);
    const primaryGraphCardIds = graph.cards
        .map(card => card.id)
        .filter(id => primaryIds.has(id))
        .sort(numericCompare);
    const primaryCardIdsOutsideGraph = [...primaryIds]
        .filter(id => !graphCardIds.has(id))
        .sort(numericCompare);
    const detailCardIds = graph.cards
        .map(card => card.id)
        .filter(id => !primaryIds.has(id))
        .sort(numericCompare);
    return {
        rewardCardIds,
        graphRewardCardIds,
        rewardCardIdsOutsideGraph,
        relevantPathCardIds,
        primaryGraphCardIds,
        primaryCardIdsOutsideGraph,
        detailCardIds,
        sourceRolesById,
        incoming,
        outgoing,
    };
}

export function serializeCharacterDetailManifest(manifest: CharacterDetailEnrichmentManifest): Buffer {
    return Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
}

export function validateCharacterDetailDelivery(
    catalog: CharacterDetailCatalogPayload,
    manifest: CharacterDetailEnrichmentManifest,
    shardPayloads?: CharacterDetailShardPayload[],
): void {
    if (manifest.schemaVersion !== 1 || manifest.contract !== CHARACTER_DETAIL_ENRICHMENT_CONTRACT
        || manifest.contractVersion !== CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION
        || catalog.schemaVersion !== 1 || catalog.contract !== manifest.contract
        || catalog.contractVersion !== manifest.contractVersion || catalog.datasetVersion !== manifest.datasetVersion
        || catalog.generatedAt !== manifest.generatedAt || catalog.source !== "dokkan-game-db"
        || manifest.source !== "dokkan-game-db") {
        throw new Error("Character detail enrichment contract is invalid");
    }
    if (catalog.sourceSnapshotVersion !== manifest.sourceSnapshotVersion
        || catalog.sourceDatabaseSha256 !== manifest.sourceDatabaseSha256
        || catalog.assetBaseUrl !== manifest.assetBaseUrl
        || JSON.stringify(catalog.sourceBindings) !== JSON.stringify(manifest.sourceBindings)
        || JSON.stringify(catalog.coverage) !== JSON.stringify(manifest.coverage)) {
        throw new Error("Character detail enrichment source binding is inconsistent");
    }
    if (catalog.count !== catalog.entries.length || manifest.cardCount !== catalog.count
        || manifest.coverage.detailCardCount !== catalog.count
        || manifest.coverage.missingDetailCardCount !== 0
        || manifest.coverage.relevantPathCardCount !== manifest.coverage.primaryPathCardCount + catalog.count
        || manifest.shardCount !== manifest.shards.length || manifest.shards.length === 0) {
        throw new Error("Character detail enrichment counts are invalid");
    }
    const fullGraphCoverageValues = [
        manifest.coverage.graphCardCount,
        manifest.coverage.primaryGraphCardCount,
        manifest.coverage.primaryOutsideGraphCount,
        manifest.coverage.graphOnlyCardCount,
        manifest.coverage.acquisitionPathCardCount,
        manifest.coverage.acquisitionPrimaryPathCardCount,
        manifest.coverage.acquisitionGraphOnlyPathCardCount,
        manifest.coverage.graphOnlyWithoutAcquisitionPathCount,
        manifest.coverage.selectedDetailCardCount,
        manifest.coverage.materializedDetailCardCount,
        manifest.coverage.materializationGapCount,
    ];
    if (fullGraphCoverageValues.some(value => value !== undefined)
        && (fullGraphCoverageValues.some(value => !Number.isSafeInteger(value) || value! < 0)
            || manifest.coverage.materializationGapCount !== 0
            || manifest.coverage.selectedDetailCardCount !== catalog.count
            || manifest.coverage.materializedDetailCardCount !== catalog.count
            || manifest.coverage.graphOnlyCardCount !== catalog.count
            || manifest.coverage.graphCardCount !== manifest.sourceBindings.awakeningGraph.routeCardCount
            || manifest.coverage.graphCardCount !== manifest.coverage.primaryGraphCardCount + catalog.count
            || manifest.coverage.primaryGraphCardCount + manifest.coverage.primaryOutsideGraphCount
                !== manifest.sourceBindings.primaryCharacters.characterCount
            || manifest.coverage.acquisitionPathCardCount
                !== manifest.coverage.acquisitionPrimaryPathCardCount + manifest.coverage.acquisitionGraphOnlyPathCardCount
            || manifest.coverage.graphOnlyCardCount
                !== manifest.coverage.acquisitionGraphOnlyPathCardCount
                    + manifest.coverage.graphOnlyWithoutAcquisitionPathCount)) {
        throw new Error("Character detail enrichment full-graph coverage is invalid");
    }
    const shardById = new Map(manifest.shards.map(shard => [shard.id, shard]));
    if (shardById.size !== manifest.shards.length) throw new Error("Character detail enrichment has duplicate shards");
    const seen = new Set<string>();
    const catalogEntryById = new Map<string, CharacterDetailCatalogEntry>();
    let previous = -1;
    for (const entry of catalog.entries) {
        requireNumericId(entry.identity.cardId, "detail card ID");
        requireNumericId(entry.identity.characterId, "detail character identity ID");
        const numericId = Number(entry.identity.cardId);
        if (numericId <= previous || seen.has(entry.identity.cardId)) {
            throw new Error("Character detail entries must have unique numeric ordering");
        }
        previous = numericId;
        seen.add(entry.identity.cardId);
        catalogEntryById.set(entry.identity.cardId, entry);
        const expectedReleaseStates = entry.availableReleaseStates.includes("seza")
            ? ["base", "eza", "seza"]
            : entry.availableReleaseStates.includes("eza") ? ["base", "eza"] : ["base"];
        const formIds = [...entry.form.previousCardIds, ...entry.form.nextCardIds];
        if (entry.form.kind !== "awakening-card"
            || entry.canonicalNavigation.routeKind !== "character-detail"
            || entry.canonicalNavigation.cardId !== entry.identity.cardId
            || entry.canonicalNavigation.releaseState !== "base"
            || JSON.stringify(entry.availableReleaseStates) !== JSON.stringify(expectedReleaseStates)
            || entry.sourceRoles.length === 0 || !entry.sourceRoles.includes("awakening-path")
            || new Set(entry.sourceRoles).size !== entry.sourceRoles.length
            || entry.sourceRoles.some(role => role !== "stage-drop" && role !== "event-mission" && role !== "awakening-path")
            || formIds.some(id => !/^[1-9]\d*$/.test(id) || id === entry.identity.cardId)
            || new Set(entry.form.previousCardIds).size !== entry.form.previousCardIds.length
            || new Set(entry.form.nextCardIds).size !== entry.form.nextCardIds.length
            || entry.form.previousCardIds.some(id => entry.form.nextCardIds.includes(id))) {
            throw new Error(`Character detail ${entry.identity.cardId} semantic identity is invalid`);
        }
        const shard = shardById.get(entry.detailShardId);
        if (!shard?.cardIds.includes(entry.identity.cardId)) {
            throw new Error(`Character detail ${entry.identity.cardId} has no matching shard`);
        }
    }
    const manifestCardIds = manifest.shards.flatMap(shard => shard.cardIds);
    if (manifestCardIds.length !== catalog.count || new Set(manifestCardIds).size !== manifestCardIds.length
        || manifestCardIds.some(id => !seen.has(id))) {
        throw new Error("Character detail shard manifest coverage is invalid");
    }
    if (shardPayloads) {
        const payloadById = new Map(shardPayloads.map(payload => [payload.shardId, payload]));
        if (payloadById.size !== shardPayloads.length || payloadById.size !== manifest.shards.length) {
            throw new Error("Character detail shard payload count is invalid");
        }
        for (const shard of manifest.shards) {
            const payload = payloadById.get(shard.id);
            if (!payload || payload.schemaVersion !== 1 || payload.contract !== manifest.contract
                || payload.contractVersion !== manifest.contractVersion || payload.datasetVersion !== manifest.datasetVersion
                || JSON.stringify(payload.records.map(record => record.identity.cardId)) !== JSON.stringify(shard.cardIds)) {
                throw new Error(`Character detail shard payload ${shard.id} is invalid`);
            }
            for (const record of payload.records) {
                const catalogEntry = catalogEntryById.get(record.identity.cardId);
                const recordCatalogFields = {
                    identity: record.identity,
                    form: record.form,
                    availableReleaseStates: record.availableReleaseStates,
                    canonicalNavigation: record.canonicalNavigation,
                    sourceRoles: record.sourceRoles,
                    portraitSpec: record.portraitSpec,
                    detailShardId: shard.id,
                };
                const awakeningFormIds = new Set([
                    ...record.form.previousCardIds,
                    ...record.form.nextCardIds,
                ]);
                const transformationIds = (record.detail.transformations ?? []).map(transformation => transformation.id);
                if (record.detail.kiMultipliers !== undefined) validateKiMultipliers(record.detail.kiMultipliers);
                for (const transformation of record.detail.transformations ?? []) {
                    if (transformation.kiMultipliers !== undefined) validateKiMultipliers(transformation.kiMultipliers);
                }
                if (record.identity.cardId !== record.detail.id
                    || record.canonicalNavigation.cardId !== record.identity.cardId
                    || !catalogEntry
                    || JSON.stringify(recordCatalogFields) !== JSON.stringify(catalogEntry)
                    || transformationIds.some(id => awakeningFormIds.has(id))
                    || record.detail.portraitURL !== undefined || record.detail.portraitFilename !== undefined
                    || record.detail.artURL !== undefined || record.detail.artFilename !== undefined
                    || record.detail.freeDupeHP !== undefined || record.detail.freeDupeAttack !== undefined
                    || record.detail.freeDupeDefence !== undefined || record.detail.rainbowHP !== undefined
                    || record.detail.rainbowAttack !== undefined || record.detail.rainbowDefence !== undefined
                    || record.detail.kiMeter !== undefined || record.detail.kiMultiplier !== undefined) {
                    throw new Error(`Character detail record ${record.identity.cardId} contains invented or mismatched fields`);
                }
            }
        }
    }
}

function validateInputs(options: CharacterDetailEnrichmentBuildOptions): void {
    requireIsoTimestamp(options.generatedAt);
    requireNumericId(options.sourceSnapshotVersion, "source snapshot version");
    requireSha(options.sourceDatabaseSha256, "source database SHA-256");
    requireSha(options.firstPartyTableInventorySha256, "first-party table inventory SHA-256");
    if (options.primaryManifest.schemaVersion !== 1 || options.primaryManifest.compression !== "gzip"
        || options.primaryManifest.characterCount !== options.primaryCharacters.length
        || options.primaryManifest.sha256.length !== 64) {
        throw new Error("Character detail primary catalog binding is invalid");
    }
    const primaryIds = options.primaryCharacters.map(character => character.id);
    if (primaryIds.some(id => !/^[1-9]\d*$/.test(id)) || new Set(primaryIds).size !== primaryIds.length) {
        throw new Error("Character detail primary catalog IDs are invalid");
    }
    validateStageDeliveryRoutes(options.stageCatalog, options.stageManifest);
    validateAwakeningMedalCatalog(options.awakeningCatalog);
    if (options.awakeningManifest.contract !== AWAKENING_MEDAL_CONTRACT
        || options.awakeningManifest.contractVersion !== AWAKENING_MEDAL_CONTRACT_VERSION
        || options.awakeningManifest.routeCardCount !== options.awakeningCatalog.routeGraph.cards.length
        || options.awakeningManifest.routeCount !== options.awakeningCatalog.routeGraph.routes.length) {
        throw new Error("Character detail awakening manifest binding is invalid");
    }
    requireSha(options.stagePayloadSha256, "Stage payload SHA-256");
    requireSha(options.awakeningPayloadSha256, "awakening payload SHA-256");
    if (options.stagePayloadSha256 !== options.stageManifest.catalog.sha256
        || options.awakeningPayloadSha256 !== options.awakeningManifest.payload.sha256) {
        throw new Error("Character detail source payload hash does not match its manifest");
    }
    if (options.stageCatalog.datasetVersion !== options.stageManifest.datasetVersion
        || options.awakeningCatalog.datasetVersion !== options.awakeningManifest.datasetVersion) {
        throw new Error("Character detail source catalog version does not match its manifest");
    }
    const sourcePairs = [
        [options.stageManifest.sourceSnapshotVersion, options.stageManifest.sourceDatabaseSha256],
        [options.stageCatalog.sourceSnapshotVersion, options.stageCatalog.sourceDatabaseSha256],
        [options.awakeningManifest.sourceSnapshotVersion, options.awakeningManifest.sourceDatabaseSha256],
        [options.awakeningCatalog.sourceSnapshotVersion, options.awakeningCatalog.sourceDatabaseSha256],
    ];
    if (sourcePairs.some(([version, digest]) => version !== options.sourceSnapshotVersion
        || digest !== options.sourceDatabaseSha256)) {
        throw new Error("Character detail source catalogs do not share one database snapshot");
    }
    if (options.stageCatalog.assetBaseUrl !== options.awakeningCatalog.assetBaseUrl
        || !/^https:\/\/[^\s/]+\/.+[^/]$/.test(options.awakeningCatalog.assetBaseUrl)) {
        throw new Error("Character detail source catalogs do not share one valid asset base URL");
    }
}

function rewardSourceRoles(catalog: StageCatalogPayload): Map<string, CharacterDetailSourceRole[]> {
    const roles = new Map<string, CharacterDetailSourceRole[]>();
    const add = (id: string, role: CharacterDetailSourceRole) => {
        requireNumericId(id, "reward card ID");
        const values = roles.get(id) ?? [];
        if (!values.includes(role)) values.push(role);
        roles.set(id, values);
    };
    for (const drop of catalog.characterDrops ?? []) add(drop.reward.itemId, "stage-drop");
    for (const mission of catalog.eventMissions) {
        for (const reward of mission.rewards) {
            if (reward.itemType === "Card") add(reward.itemId, "event-mission");
        }
    }
    return roles;
}

function isNormalAwakeningRoute(route: AwakeningRoute): boolean {
    return route.kind === "z-awaken" || route.kind === "dokkan-awaken";
}

function adjacency(
    routes: AwakeningRoute[],
    from: "sourceCardId" | "targetCardId",
    to: "sourceCardId" | "targetCardId",
): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const route of routes) result.set(route[from], [...(result.get(route[from]) ?? []), route[to]]);
    for (const [id, values] of result) result.set(id, [...new Set(values)].sort(numericCompare));
    return result;
}

function reachable(seeds: string[], edges: ReadonlyMap<string, string[]>): Set<string> {
    const visited = new Set<string>();
    const pending = [...seeds];
    while (pending.length > 0) {
        const id = pending.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        pending.push(...(edges.get(id) ?? []));
    }
    return visited;
}

function partitionRecords(
    records: CharacterDetailRecord[],
    datasetVersion: string,
    maximumBytes: number,
): PendingShard[] {
    const result: PendingShard[] = [];
    let pending: CharacterDetailRecord[] = [];
    const flush = () => {
        if (pending.length === 0) return;
        result.push({ id: String(result.length + 1).padStart(4, "0"), records: pending });
        pending = [];
    };
    for (const record of records) {
        const candidateId = String(result.length + 1).padStart(4, "0");
        const candidate = [...pending, record];
        if (Buffer.byteLength(JSON.stringify(shardPayload(datasetVersion, { id: candidateId, records: candidate })), "utf8")
            <= maximumBytes) {
            pending = candidate;
            continue;
        }
        if (pending.length === 0) {
            throw new Error(`Character detail ${record.identity.cardId} exceeds the shard maximum by itself`);
        }
        flush();
        const singleId = String(result.length + 1).padStart(4, "0");
        if (Buffer.byteLength(JSON.stringify(shardPayload(datasetVersion, { id: singleId, records: [record] })), "utf8")
            > maximumBytes) {
            throw new Error(`Character detail ${record.identity.cardId} exceeds the shard maximum by itself`);
        }
        pending = [record];
    }
    flush();
    return result;
}

function shardPayload(datasetVersion: string, shard: PendingShard): CharacterDetailShardPayload {
    return {
        schemaVersion: 1,
        contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
        contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
        datasetVersion,
        shardId: shard.id,
        records: shard.records,
    };
}

function sha(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function numericCompare(left: string, right: string): number {
    return Number(left) - Number(right) || left.localeCompare(right);
}

function requireNumericId(value: string, label: string): void {
    if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} must be a positive numeric ID`);
}

function requireSha(value: string, label: string): void {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is invalid`);
}

function requireIsoTimestamp(value: string): void {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
        throw new Error("Character detail generatedAt must be canonical ISO-8601");
    }
}

function requireValue<K, V>(map: ReadonlyMap<K, V>, key: K, label: string): V {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Missing ${label} ${String(key)}`);
    return value;
}

function throwMaterializationGaps(gaps: CharacterDetailMaterializationGap[]): never {
    const ordered = [...gaps].sort((left, right) => numericCompare(left.cardId, right.cardId));
    throw new Error(`Character detail materialization gaps: ${JSON.stringify(ordered)}`);
}
