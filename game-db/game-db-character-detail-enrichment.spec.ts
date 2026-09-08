import { deepStrictEqual, strictEqual, throws } from "assert";
import { describe, it } from "mocha";
import { Rarities, Types } from "../character";
import type { AwakeningRouteGraph } from "./game-db-awakening-medal-catalog";
import {
    CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
    CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
    CharacterDetailCatalogPayload,
    CharacterDetailEnrichmentManifest,
    CharacterDetailShardPayload,
    selectCharacterDetailCardIds,
    serializeCharacterDetailManifest,
    validateCharacterDetailDelivery,
} from "./game-db-character-detail-enrichment";
import type { StageCatalogPayload } from "./game-db-stage-delivery";

function graph(): AwakeningRouteGraph {
    const card = (id: string) => ({
        id,
        characterId: id,
        name: `Card ${id}`,
        rarity: Rarities.UR,
        rarityRaw: 4,
        elementRaw: 11,
        portraitSpec: { iconId: Number(id), frameColorId: 1, rarity: Rarities.UR, elementCode: "11" },
    });
    const route = (id: string, kind: "z-awaken" | "dokkan-awaken" | "eza", source: string, target: string) => ({
        id,
        kind,
        routeTypeRaw: kind === "z-awaken" ? "CardAwakeningRoute::Zet"
            : kind === "dokkan-awaken" ? "CardAwakeningRoute::Dokkan"
                : "CardAwakeningRoute::Optimal",
        sourceCardId: source,
        targetCardId: target,
        setId: id,
        requirements: [{ rowId: id, ordinalRaw: 1, itemId: "1", quantity: 1 }],
    });
    return {
        cards: ["10", "11", "12", "20", "21"].map(card),
        routes: [
            route("1", "z-awaken", "10", "11"),
            route("2", "dokkan-awaken", "11", "12"),
            route("3", "z-awaken", "20", "21"),
            route("4", "eza", "11", "11"),
        ],
    };
}

function stageCatalog(): StageCatalogPayload {
    return {
        schemaVersion: 1,
        contract: "dokkan-stage-delivery",
        contractVersion: "1.1.0",
        datasetVersion: "stage",
        generatedAt: "2026-09-07T12:00:00.000Z",
        source: "dokkan-game-db",
        sourceSnapshotVersion: "1",
        sourceDatabaseSha256: "a".repeat(64),
        assetBaseUrl: "https://assets.example.test/game",
        count: 0,
        questLevelCount: 0,
        zBattleCount: 0,
        entries: [],
        supportMemoryRelations: [],
        eventMissionsComplete: true,
        eventMissions: [{
            id: "1",
            areaId: "1",
            categoryId: "1",
            type: "Mission",
            name: "Mission",
            description: "Mission",
            priority: 1,
            ordererId: 1,
            stageIds: [],
            rewards: [{ itemId: "10", itemType: "Card", quantity: 1 }],
        }],
        awakeningMedalSources: [],
        characterDrops: ["10", "20", "30"].map((itemId, index) => ({
            stageId: String(index + 1),
            reward: { itemId, itemType: "Card", name: `Card ${itemId}` },
        })),
    } as StageCatalogPayload;
}

describe("Character detail enrichment", () => {
    it("selects every graph-only card while preserving acquisition-path evidence", () => {
        const result = selectCharacterDetailCardIds(stageCatalog(), graph(), new Set(["12"]));
        deepStrictEqual({
            rewards: result.rewardCardIds,
            graphRewards: result.graphRewardCardIds,
            outside: result.rewardCardIdsOutsideGraph,
            relevant: result.relevantPathCardIds,
            primaryGraph: result.primaryGraphCardIds,
            primaryOutsideGraph: result.primaryCardIdsOutsideGraph,
            details: result.detailCardIds,
            roles: result.sourceRolesById.get("10"),
        }, {
            rewards: ["10", "20", "30"],
            graphRewards: ["10", "20"],
            outside: ["30"],
            relevant: ["10", "11", "12"],
            primaryGraph: ["12"],
            primaryOutsideGraph: [],
            details: ["10", "11", "20", "21"],
            roles: ["stage-drop", "event-mission"],
        });
    });

    it("selects the Piccolo TEQ predecessor without a Stage or Mission reward", () => {
        const piccoloGraph = graph();
        piccoloGraph.cards.push(
            {
                id: "1029760",
                characterId: "893",
                name: "Piccolo",
                rarity: Rarities.UR,
                rarityRaw: 3,
                elementRaw: 2,
                portraitSpec: { iconId: 1029760, frameColorId: 3, rarity: Rarities.UR, elementCode: "02" },
            },
            {
                id: "1029761",
                characterId: "893",
                name: "Piccolo",
                rarity: Rarities.UR,
                rarityRaw: 4,
                elementRaw: 12,
                portraitSpec: { iconId: 1029761, frameColorId: 3, rarity: Rarities.UR, elementCode: "12" },
            },
        );
        piccoloGraph.routes.push({
            id: "5",
            kind: "z-awaken",
            routeTypeRaw: "CardAwakeningRoute::Zet",
            sourceCardId: "1029760",
            targetCardId: "1029761",
            setId: "5",
            requirements: [{ rowId: "5", ordinalRaw: 1, itemId: "1", quantity: 1 }],
        });

        const result = selectCharacterDetailCardIds(stageCatalog(), piccoloGraph, new Set(["12", "1029761"]));

        deepStrictEqual(result.sourceRolesById.get("1029760"), undefined);
        deepStrictEqual(result.relevantPathCardIds.includes("1029760"), false);
        deepStrictEqual(result.detailCardIds.includes("1029760"), true);
        deepStrictEqual(result.outgoing.get("1029760"), ["1029761"]);
    });

    it("keeps full-graph selection deterministic across source ordering", () => {
        const first = graph();
        const second = graph();
        second.cards.reverse();
        second.routes.reverse();
        const stages = stageCatalog();
        stages.characterDrops?.reverse();
        stages.eventMissions[0].rewards.reverse();

        const left = selectCharacterDetailCardIds(stageCatalog(), first, new Set(["12"]));
        const right = selectCharacterDetailCardIds(stages, second, new Set(["12"]));

        deepStrictEqual({
            rewards: right.rewardCardIds,
            graphRewards: right.graphRewardCardIds,
            paths: right.relevantPathCardIds,
            primary: right.primaryGraphCardIds,
            details: right.detailCardIds,
            incoming11: right.incoming.get("11"),
            outgoing11: right.outgoing.get("11"),
        }, {
            rewards: left.rewardCardIds,
            graphRewards: left.graphRewardCardIds,
            paths: left.relevantPathCardIds,
            primary: left.primaryGraphCardIds,
            details: left.detailCardIds,
            incoming11: left.incoming.get("11"),
            outgoing11: left.outgoing.get("11"),
        });
    });

    it("validates exact-card identity, optional shards and absent invented fields", () => {
        const digest = "a".repeat(64);
        const sources = {
            primaryCharacters: { datasetVersion: "primary", payloadSha256: digest, characterCount: 1 },
            stages: { datasetVersion: "stage", payloadSha256: digest, characterDropCount: 1, eventMissionCount: 1 },
            awakeningGraph: { datasetVersion: "awakening", payloadSha256: digest, routeCardCount: 2, routeCount: 1 },
            firstPartyTableInventorySha256: digest,
        };
        const coverage = {
            graphCardCount: 2,
            primaryGraphCardCount: 1,
            primaryOutsideGraphCount: 0,
            graphOnlyCardCount: 1,
            acquisitionPathCardCount: 2,
            acquisitionPrimaryPathCardCount: 1,
            acquisitionGraphOnlyPathCardCount: 1,
            graphOnlyWithoutAcquisitionPathCount: 0,
            selectedDetailCardCount: 1,
            materializedDetailCardCount: 1,
            materializationGapCount: 0,
            rewardCardCount: 1,
            graphRewardCardCount: 1,
            rewardCardsOutsideGraphCount: 0,
            relevantPathCardCount: 2,
            primaryPathCardCount: 1,
            detailCardCount: 1,
            missingDetailCardCount: 0,
            neutralClassDetailCount: 1,
            detailsByReleaseState: { base: 1, eza: 0, seza: 0 },
            directStageDropDetailCount: 1,
            directEventMissionDetailCount: 0,
            intermediateOnlyDetailCount: 0,
        };
        const entry = {
            identity: { cardId: "10", characterId: "1" },
            form: { kind: "awakening-card" as const, previousCardIds: [], nextCardIds: ["11"] },
            availableReleaseStates: ["base" as const],
            canonicalNavigation: { routeKind: "character-detail" as const, cardId: "10", releaseState: "base" as const },
            sourceRoles: ["stage-drop" as const, "awakening-path" as const],
            portraitSpec: { iconId: 10, frameColorId: 1, rarity: Rarities.SSR, elementCode: "01" },
        };
        const catalog: CharacterDetailCatalogPayload = {
            schemaVersion: 1,
            contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
            contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
            datasetVersion: "1-detail",
            generatedAt: "2026-09-07T12:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1",
            sourceDatabaseSha256: digest,
            assetBaseUrl: "https://assets.example.test/game",
            sourceBindings: sources,
            coverage,
            count: 1,
            entries: [{ ...entry, detailShardId: "0001" }],
        };
        const descriptor = {
            objectKey: `character-details/objects/${digest}.json.gz`,
            sha256: digest,
            sizeBytes: 1,
            expandedSizeBytes: 1,
            contentType: "application/json" as const,
            contentEncoding: "gzip" as const,
        };
        const manifest: CharacterDetailEnrichmentManifest = {
            schemaVersion: 1,
            contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
            contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
            datasetVersion: catalog.datasetVersion,
            generatedAt: catalog.generatedAt,
            source: "dokkan-game-db",
            sourceSnapshotVersion: catalog.sourceSnapshotVersion,
            sourceDatabaseSha256: digest,
            assetBaseUrl: catalog.assetBaseUrl,
            sourceBindings: sources,
            coverage,
            cardCount: 1,
            shardCount: 1,
            catalog: descriptor,
            shards: [{ id: "0001", cardIds: ["10"], ...descriptor }],
        };
        const shard: CharacterDetailShardPayload = {
            schemaVersion: 1,
            contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
            contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
            datasetVersion: catalog.datasetVersion,
            shardId: "0001",
            records: [{
                ...entry,
                detail: {
                    id: "10",
                    name: "Card 10",
                    rarity: Rarities.SSR,
                    type: Types.TEQ,
                    cost: 10,
                    maxLevel: 80,
                    maxSALevel: 10,
                    links: [],
                    categories: [],
                    baseHP: 1,
                    maxLevelHP: 2,
                    baseAttack: 3,
                    maxLevelAttack: 4,
                    baseDefence: 5,
                    maxDefence: 6,
                    portraitSpec: entry.portraitSpec,
                },
            }],
        };

        validateCharacterDetailDelivery(catalog, manifest, [shard]);
        const serialized = serializeCharacterDetailManifest(manifest);
        strictEqual(serialized.equals(serializeCharacterDetailManifest(manifest)), true);
        strictEqual(serialized.toString("utf8").includes("\n  \"schemaVersion\""), false);
        shard.records[0].canonicalNavigation.cardId = "11";
        throws(() => validateCharacterDetailDelivery(catalog, manifest, [shard]), /semantic identity|mismatched fields/);
    });

    it("rejects duplicate, missing and cross-semantic detail identities", () => {
        const digest = "b".repeat(64);
        const coverage = {
            graphCardCount: 3,
            primaryGraphCardCount: 1,
            primaryOutsideGraphCount: 0,
            graphOnlyCardCount: 2,
            acquisitionPathCardCount: 2,
            acquisitionPrimaryPathCardCount: 1,
            acquisitionGraphOnlyPathCardCount: 1,
            graphOnlyWithoutAcquisitionPathCount: 1,
            selectedDetailCardCount: 2,
            materializedDetailCardCount: 2,
            materializationGapCount: 0,
            rewardCardCount: 1,
            graphRewardCardCount: 1,
            rewardCardsOutsideGraphCount: 0,
            relevantPathCardCount: 3,
            primaryPathCardCount: 1,
            detailCardCount: 2,
            missingDetailCardCount: 0,
            neutralClassDetailCount: 0,
            detailsByReleaseState: { base: 2, eza: 1, seza: 1 },
            directStageDropDetailCount: 1,
            directEventMissionDetailCount: 0,
            intermediateOnlyDetailCount: 0,
        };
        const sources = {
            primaryCharacters: { datasetVersion: "primary", payloadSha256: digest, characterCount: 1 },
            stages: { datasetVersion: "stage", payloadSha256: digest, characterDropCount: 1, eventMissionCount: 0 },
            awakeningGraph: { datasetVersion: "awakening", payloadSha256: digest, routeCardCount: 3, routeCount: 2 },
            firstPartyTableInventorySha256: digest,
        };
        const baseEntry = (cardId: string, detailShardId: string) => ({
            identity: { cardId, characterId: cardId },
            form: cardId === "10"
                ? { kind: "awakening-card" as const, previousCardIds: [], nextCardIds: ["11"] }
                : { kind: "awakening-card" as const, previousCardIds: ["10"], nextCardIds: [] },
            availableReleaseStates: cardId === "11"
                ? ["base" as const, "eza" as const, "seza" as const]
                : ["base" as const],
            canonicalNavigation: { routeKind: "character-detail" as const, cardId, releaseState: "base" as const },
            sourceRoles: ["awakening-path" as const],
            portraitSpec: {
                iconId: Number(cardId),
                frameColorId: 1,
                rarity: cardId === "10" ? Rarities.SSR : Rarities.LR,
                elementCode: "11",
            },
            detailShardId,
        });
        const descriptor = {
            objectKey: `character-details/objects/${digest}.json.gz`,
            sha256: digest,
            sizeBytes: 1,
            expandedSizeBytes: 1,
            contentType: "application/json" as const,
            contentEncoding: "gzip" as const,
        };
        const entries = [baseEntry("10", "0001"), baseEntry("11", "0002")];
        const catalog: CharacterDetailCatalogPayload = {
            schemaVersion: 1,
            contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
            contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
            datasetVersion: "1-detail",
            generatedAt: "2026-09-07T12:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1",
            sourceDatabaseSha256: digest,
            assetBaseUrl: "https://assets.example.test/game",
            sourceBindings: sources,
            coverage,
            count: 2,
            entries,
        };
        const manifest: CharacterDetailEnrichmentManifest = {
            schemaVersion: 1,
            contract: CHARACTER_DETAIL_ENRICHMENT_CONTRACT,
            contractVersion: CHARACTER_DETAIL_ENRICHMENT_CONTRACT_VERSION,
            datasetVersion: catalog.datasetVersion,
            generatedAt: catalog.generatedAt,
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1",
            sourceDatabaseSha256: digest,
            assetBaseUrl: catalog.assetBaseUrl,
            sourceBindings: sources,
            coverage,
            cardCount: 2,
            shardCount: 2,
            catalog: descriptor,
            shards: [
                { id: "0001", cardIds: ["10"], ...descriptor },
                { id: "0002", cardIds: ["11"], ...descriptor },
            ],
        };

        const duplicateCatalog = { ...catalog, entries: [entries[0], entries[0]] };
        throws(() => validateCharacterDetailDelivery(duplicateCatalog, manifest), /unique numeric ordering/);

        const missingManifest = { ...manifest, shards: [manifest.shards[0]], shardCount: 1 };
        throws(() => validateCharacterDetailDelivery(catalog, missingManifest), /no matching shard|coverage is invalid/);

        const invalidReleaseCatalog = {
            ...catalog,
            entries: [{ ...entries[0], availableReleaseStates: ["base" as const, "seza" as const] }, entries[1]],
        };
        throws(() => validateCharacterDetailDelivery(invalidReleaseCatalog, manifest), /semantic identity/);
    });
});
