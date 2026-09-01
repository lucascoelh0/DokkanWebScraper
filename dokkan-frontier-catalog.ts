import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import {
    DokkanFrontierChapter,
    DokkanFrontierCharacterRef,
    DokkanFrontierChaptersDataset,
    DokkanFrontierGroupExchangeStep,
    DokkanFrontierIntensityEffect,
    DokkanFrontierMission,
    DokkanFrontierReward,
    DokkanFrontierSeriesDataset,
    DokkanFrontierSkill,
    DokkanFrontierUnlockMission,
} from "./dokkan-frontier";
import { DokkanInfoQuestEnemy, DokkanInfoQuestEnemyStats, DokkanInfoQuestEnemySuperAttack } from "./dokkaninfo-db-story";
import {
    DokkanInfoFrontierBattle,
    DokkanInfoFrontierDataset,
    DokkanInfoSpecialCardReference,
    DokkanInfoSpecialReward,
} from "./dokkaninfo-special-event";
import { writeFormattedJson } from "./format-json";
import { Character, Classes, PortraitSpec, Rarities, Types } from "./character";
import { portraitSpecFromElement, portraitSpecFromTypeAndClass } from "./game-db/portrait-asset-contract";
import { DokkanStatsCardSkin, DokkanStatsFrontierDataset } from "./dokkanstats-frontier";

const OUTPUT_DIR = "data/dokkan-frontier-catalog/latest";
const PAYLOAD_FILE = "frontier.json";
const MANIFEST_FILE = "frontier-manifest.json";

export interface DokkanFrontierCatalogDataset {
    schemaVersion: 1,
    contract: "dokkan-frontier-catalog",
    contractVersion: "1.0.0",
    datasetVersion: string,
    generatedAt: string,
    sources: {
        dokkanInfoGeneratedAt: string,
        dokkanFyiGeneratedAt: string,
        dokkanStatsGeneratedAt?: string,
    },
    fieldAuthority: {
        dokkanInfo: string[],
        dokkanFyi: string[],
        dokkanStats?: string[],
    },
    counts: {
        series: number,
        chapters: number,
        pages: number,
        nodes: number,
        enemies: number,
        missions: number,
        cardSkinRewardsEnriched: number,
    },
    series: DokkanFrontierCatalogSeries[],
}

export interface DokkanFrontierCatalogManifest {
    schemaVersion: 1,
    contract: "dokkan-frontier-catalog-manifest",
    contractVersion: "1.0.0",
    datasetVersion: string,
    generatedAt: string,
    fileName: string,
    sha256: string,
    sizeBytes: number,
    seriesCount: number,
    chapterCount: number,
    nodeCount: number,
    enemyCount: number,
}

export interface DokkanFrontierCatalogSeries {
    id: string,
    name: string,
    bannerImageUrl?: string,
    chapters: DokkanFrontierCatalogChapter[],
}

export interface DokkanFrontierCatalogChapter {
    id: string,
    seriesId: string,
    name: string,
    bannerImageUrl?: string,
    groupExchange: DokkanFrontierGroupExchangeStep[],
    missions: DokkanFrontierMission[],
    pages: DokkanFrontierCatalogPage[],
}

export interface DokkanFrontierCatalogPage {
    id: string,
    number?: number,
    backgroundImageUrl?: string,
    nodes: DokkanFrontierCatalogNode[],
}

export interface DokkanFrontierCatalogNode {
    id: string,
    pageId: string,
    number: string,
    title: string,
    stamina?: number,
    userExp?: number,
    zeni?: number,
    linkLevelRate?: number,
    autoEnabled?: boolean,
    isSpecialNode?: boolean,
    displayEnemyPortraitUrl?: string,
    unlockMissions: DokkanFrontierUnlockMission[],
    requiredCharacters: DokkanFrontierCatalogCharacterRef[],
    bonusPassiveCards: DokkanFrontierCatalogCardReference[],
    intensityEffects: DokkanFrontierIntensityEffect[],
    rounds: DokkanFrontierCatalogRound[],
    missions: DokkanFrontierMission[],
    clearRewards: DokkanInfoSpecialReward[],
    sourceUrls: {
        dokkanInfo: string,
        dokkanFyi: string,
    },
}

export interface DokkanFrontierCatalogRound {
    number: number,
    enemies: DokkanFrontierCatalogEnemy[],
}

export interface DokkanFrontierCatalogEnemy {
    sequence: number,
    name?: string,
    cardReferenceId?: string,
    portraitUrl?: string,
    typeCode?: string,
    typeIconUrl?: string,
    portraitSpec?: PortraitSpec,
    stats: DokkanInfoQuestEnemyStats,
    superAttack?: DokkanInfoQuestEnemySuperAttack,
    skills: DokkanFrontierSkill[],
}

export type DokkanFrontierCatalogCharacterRef = DokkanFrontierCharacterRef & { portraitSpec?: PortraitSpec };
export type DokkanFrontierCatalogCardReference = DokkanInfoSpecialCardReference & { portraitSpec?: PortraitSpec };

interface FrontierCatalogInputs {
    dokkanInfo: DokkanInfoFrontierDataset,
    dokkanFyiSeries: DokkanFrontierSeriesDataset,
    dokkanFyiChapters: DokkanFrontierChaptersDataset,
    generatedAt?: string,
    characters?: Character[],
    dokkanStats?: DokkanStatsFrontierDataset,
}

export function buildDokkanFrontierCatalog(inputs: FrontierCatalogInputs): DokkanFrontierCatalogDataset {
    assertCompleteDokkanInfo(inputs.dokkanInfo);
    const infoBattles = flattenDokkanInfoBattles(inputs.dokkanInfo);
    const portraits = portraitLookup(inputs.characters);
    const cardSkins = inputs.dokkanStats ? cardSkinLookup(inputs.dokkanStats.cardSkins) : undefined;
    const fyiNodes = inputs.dokkanFyiChapters.chapters.flatMap(chapter => chapter.pages.flatMap(page => page.nodes));
    assertExactIdSet("Frontier nodes", infoBattles.map(value => value.id), fyiNodes.map(value => value.id));
    const cardSkinRewardsEnriched = cardSkins
        ? validateCardSkinCoverage(inputs.dokkanFyiChapters, cardSkins)
        : 0;

    const infoBattleById = uniqueMap(infoBattles, value => value.id, "DokkanInfo battle");
    const infoEpisodeById = uniqueMap(
        inputs.dokkanInfo.series.flatMap(series => series.episodes),
        value => value.id,
        "DokkanInfo episode",
    );
    const infoSeriesById = uniqueMap(inputs.dokkanInfo.series, value => value.id, "DokkanInfo series");
    const chapterById = uniqueMap(inputs.dokkanFyiChapters.chapters, value => value.id, "dokkan.fyi chapter");

    const series = inputs.dokkanFyiSeries.series.map(fyiSeries => {
        const infoSeries = infoSeriesById.get(fyiSeries.id);
        if (!infoSeries) throw new Error(`DokkanInfo series ${fyiSeries.id} is missing.`);
        const chapters = fyiSeries.chapters.map(summary => {
            const chapter = chapterById.get(summary.id);
            if (!chapter) throw new Error(`dokkan.fyi chapter ${summary.id} is missing.`);
            const infoEpisode = infoEpisodeById.get(summary.id);
            if (!infoEpisode) throw new Error(`DokkanInfo episode ${summary.id} is missing.`);
            return mapChapter(chapter, infoEpisode.title, infoEpisode.bannerPath, infoBattleById, portraits, cardSkins);
        });
        return {
            id: fyiSeries.id,
            name: infoSeries.name || fyiSeries.name,
            bannerImageUrl: infoSeries.bannerPath || fyiSeries.bannerImagePath,
            chapters,
        };
    });

    const versionMaterial = JSON.stringify(series);
    const datasetVersion = `frontier-${sha256(Buffer.from(versionMaterial)).slice(0, 16)}`;
    const catalogChapters = series.flatMap(value => value.chapters);
    const catalogPages = catalogChapters.flatMap(value => value.pages);
    const catalogNodes = catalogPages.flatMap(value => value.nodes);
    const counts = {
        series: series.length,
        chapters: catalogChapters.length,
        pages: catalogPages.length,
        nodes: catalogNodes.length,
        enemies: catalogNodes.flatMap(value => value.rounds).flatMap(value => value.enemies).length,
        missions: catalogChapters.flatMap(value => value.missions).length + catalogNodes.flatMap(value => value.missions).length,
        cardSkinRewardsEnriched,
    };

    return {
        schemaVersion: 1,
        contract: "dokkan-frontier-catalog",
        contractVersion: "1.0.0",
        datasetVersion,
        generatedAt: inputs.generatedAt ?? new Date().toISOString(),
        sources: {
            dokkanInfoGeneratedAt: inputs.dokkanInfo.generatedAt,
            dokkanFyiGeneratedAt: inputs.dokkanFyiChapters.generatedAt,
            ...(inputs.dokkanStats ? { dokkanStatsGeneratedAt: inputs.dokkanStats.generatedAt } : {}),
        },
        fieldAuthority: {
            dokkanInfo: ["node titles", "encounter portraits and types", "enemy stats", "super attacks", "clear rewards", "bonus passive cards"],
            dokkanFyi: ["series topology", "map backgrounds", "unlock conditions", "required characters", "intensity effects", "enemy skills", "missions except enriched card-skin display names"],
            ...(inputs.dokkanStats ? { dokkanStats: ["English card-skin reward names and portrait metadata joined by item ID, card ID and step"] } : {}),
        },
        counts,
        series,
    };
}

export async function writeDokkanFrontierCatalog(
    inputs?: FrontierCatalogInputs,
): Promise<{ payloadPath: string, manifestPath: string, dataset: DokkanFrontierCatalogDataset, manifest: DokkanFrontierCatalogManifest }> {
    const resolvedInputs = inputs ?? await readDefaultInputs();
    const dataset = buildDokkanFrontierCatalog(resolvedInputs);
    const outputDir = resolve(process.cwd(), OUTPUT_DIR);
    const payloadPath = resolve(outputDir, PAYLOAD_FILE);
    const manifestPath = resolve(outputDir, MANIFEST_FILE);
    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(payloadPath, dataset);
    const payload = await readFile(payloadPath);
    const manifest: DokkanFrontierCatalogManifest = {
        schemaVersion: 1,
        contract: "dokkan-frontier-catalog-manifest",
        contractVersion: "1.0.0",
        datasetVersion: dataset.datasetVersion,
        generatedAt: dataset.generatedAt,
        fileName: PAYLOAD_FILE,
        sha256: sha256(payload),
        sizeBytes: payload.byteLength,
        seriesCount: dataset.counts.series,
        chapterCount: dataset.counts.chapters,
        nodeCount: dataset.counts.nodes,
        enemyCount: dataset.counts.enemies,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { payloadPath, manifestPath, dataset, manifest };
}

function mapChapter(
    chapter: DokkanFrontierChapter,
    infoTitle: string,
    infoBannerPath: string | undefined,
    battleById: Map<string, DokkanInfoFrontierBattle>,
    portraits: Map<string, PortraitSpec>,
    cardSkins?: Map<string, DokkanStatsCardSkin>,
): DokkanFrontierCatalogChapter {
    return {
        id: chapter.id,
        seriesId: chapter.seriesId,
        name: infoTitle || chapter.name,
        bannerImageUrl: infoBannerPath || chapter.bannerImagePath,
        groupExchange: chapter.groupExchange,
        missions: enrichMissions(chapter.chapterMissions, cardSkins),
        pages: chapter.pages.map(page => ({
            id: page.id,
            number: page.pageNumber,
            backgroundImageUrl: page.backgroundImagePath,
            nodes: page.nodes.map(node => {
                const battle = battleById.get(node.id);
                if (!battle) throw new Error(`DokkanInfo battle ${node.id} is missing.`);
                return {
                    id: node.id,
                    pageId: battle.pageId,
                    number: battle.number,
                    title: battle.title,
                    stamina: battle.stamina ?? node.stamina,
                    userExp: battle.userExp ?? node.userExp,
                    zeni: battle.zeni ?? node.zeni,
                    linkLevelRate: battle.linkLevelRate ?? node.linkSkillLevelUpRate,
                    autoEnabled: node.autoEnabled,
                    isSpecialNode: node.isSpecialNode,
                    displayEnemyPortraitUrl: battle.displayEnemyPortraitPath,
                    unlockMissions: node.unlockMissions,
                    requiredCharacters: enrichCharacterRefs(node.requiredCharacters, portraits),
                    bonusPassiveCards: enrichCardRefs(battle.bonusPassiveCards, portraits),
                    intensityEffects: node.intensityEffects,
                    rounds: mergeEnemyRounds(battle, node.rounds, portraits),
                    missions: enrichMissions(node.missions, cardSkins),
                    clearRewards: battle.clearRewards,
                    sourceUrls: {
                        dokkanInfo: battle.sourcePath,
                        dokkanFyi: `https://dokkan.fyi/dokkan-frontier/${chapter.seriesId}/chapters/${chapter.id}`,
                    },
                };
            }),
        })),
    };
}

function mergeEnemyRounds(
    battle: DokkanInfoFrontierBattle,
    fyiRounds: DokkanFrontierChapter["pages"][number]["nodes"][number]["rounds"],
    portraits: Map<string, PortraitSpec>,
): DokkanFrontierCatalogRound[] {
    const availableByCardId = new Map<string, DokkanInfoQuestEnemy[]>();
    battle.enemies.forEach(enemy => {
        if (!enemy.cardReferenceId) return;
        const values = availableByCardId.get(enemy.cardReferenceId) ?? [];
        values.push(enemy);
        availableByCardId.set(enemy.cardReferenceId, values);
    });
    const consumedByCardId = new Map<string, number>();
    const rounds = fyiRounds.map((round, roundIndex) => ({
        number: round.roundNumber ?? roundIndex + 1,
        enemies: round.enemies.map(fyiEnemy => {
            const cardId = fyiEnemy.character?.id;
            if (!cardId) throw new Error(`Frontier node ${battle.id} has an enemy without a card ID.`);
            const occurrence = consumedByCardId.get(cardId) ?? 0;
            const infoEnemy = availableByCardId.get(cardId)?.[occurrence];
            if (!infoEnemy) throw new Error(`Frontier node ${battle.id} enemy ${cardId} is missing from DokkanInfo.`);
            consumedByCardId.set(cardId, occurrence + 1);
            return mapEnemy(infoEnemy, fyiEnemy.character, fyiEnemy.skills, portraits);
        }),
    }));
    const consumed = [...consumedByCardId.values()].reduce((sum, value) => sum + value, 0);
    if (consumed !== battle.enemies.length) {
        throw new Error(`Frontier node ${battle.id} merged ${consumed} of ${battle.enemies.length} DokkanInfo enemies.`);
    }
    return rounds;
}

function mapEnemy(
    enemy: DokkanInfoQuestEnemy,
    character: DokkanFrontierCharacterRef | undefined,
    skills: DokkanFrontierSkill[],
    portraits: Map<string, PortraitSpec>,
): DokkanFrontierCatalogEnemy {
    return {
        sequence: enemy.sequence,
        name: enemy.name,
        cardReferenceId: enemy.cardReferenceId,
        portraitUrl: enemy.portraitPath,
        typeCode: enemy.typeCode,
        typeIconUrl: enemy.typeIconPath,
        portraitSpec: enemyPortraitSpec(enemy, character, portraits),
        stats: enemy.stats,
        superAttack: enemy.superAttack,
        skills,
    };
}

function enemyPortraitSpec(
    enemy: DokkanInfoQuestEnemy,
    character: DokkanFrontierCharacterRef | undefined,
    portraits: Map<string, PortraitSpec>,
): PortraitSpec | undefined {
    if (!enemy.typeCode) return undefined;
    if (character?.thumbnailId && character.rarity) {
        return portraitSpecFromElement(character.thumbnailId, character.rarity, enemy.typeCode);
    }
    const originalPortrait = enemy.cardReferenceId ? portraits.get(enemy.cardReferenceId) : undefined;
    return originalPortrait
        ? portraitSpecFromElement(originalPortrait.iconId, originalPortrait.rarity, enemy.typeCode)
        : undefined;
}

function portraitLookup(characters: Character[] | undefined): Map<string, PortraitSpec> {
    return new Map((characters ?? []).flatMap(character => character.portraitSpec ? [[character.id, character.portraitSpec] as const] : []));
}

function enrichCharacterRefs(refs: DokkanFrontierCharacterRef[], portraits: Map<string, PortraitSpec>): DokkanFrontierCatalogCharacterRef[] {
    return refs.map(ref => ({ ...ref, portraitSpec: portraits.get(ref.id) }));
}

function enrichCardRefs(refs: DokkanInfoSpecialCardReference[], portraits: Map<string, PortraitSpec>): DokkanFrontierCatalogCardReference[] {
    return refs.map(ref => ({ ...ref, portraitSpec: specialCardPortraitSpec(ref) ?? portraits.get(ref.id) }));
}

function enrichMissions(
    missions: DokkanFrontierMission[],
    cardSkins: Map<string, DokkanStatsCardSkin> | undefined,
): DokkanFrontierMission[] {
    if (!cardSkins) return missions;
    return missions.map(mission => ({
        ...mission,
        rewards: mission.rewards.map(reward => enrichCardSkinReward(reward, cardSkins)),
    }));
}

function enrichCardSkinReward(
    reward: DokkanFrontierReward,
    cardSkins: Map<string, DokkanStatsCardSkin>,
): DokkanFrontierReward {
    if (reward.itemType !== "CardSkinItem") return reward;
    const itemId = requiredRewardId(reward.itemId, "item ID");
    const cardId = requiredRewardId(reward.cardId, "card ID");
    if (!Number.isInteger(reward.step) || (reward.step ?? 0) <= 0) {
        throw new Error(`Frontier card-skin reward ${itemId} has no valid step.`);
    }
    const skin = cardSkins.get(itemId);
    if (!skin) throw new Error(`Frontier card-skin reward ${itemId} is missing from DokkanStats.`);
    if (skin.cardId !== cardId || skin.step !== reward.step) {
        throw new Error(`Frontier card-skin reward ${itemId} differs from DokkanStats card ID or step.`);
    }
    return {
        ...reward,
        name: skin.displayName,
        cardSkinTitle: skin.cardTitle,
        cardSkinCharacterName: skin.characterName,
        portraitSpec: cardSkinPortraitSpec(skin),
    };
}

function cardSkinPortraitSpec(skin: DokkanStatsCardSkin): PortraitSpec {
    const type = skin.type?.trim().toUpperCase() as Types | undefined;
    const characterClass = skin.characterClass?.trim() as Classes | undefined;
    const rarity = skin.rarity?.trim().toUpperCase() as Rarities | undefined;
    const typeDigit = type === Types.AGL ? 0
        : type === Types.TEQ ? 1
            : type === Types.INT ? 2
                : type === Types.STR ? 3
                    : type === Types.PHY ? 4
                        : undefined;
    if (typeDigit === undefined || !Object.values(Classes).includes(characterClass as Classes)
        || !Object.values(Rarities).includes(rarity as Rarities)) {
        throw new Error(`DokkanStats card skin ${skin.id} has incomplete portrait metadata.`);
    }
    return portraitSpecFromTypeAndClass(skin.cardId, rarity as Rarities, typeDigit, characterClass as Classes);
}

function cardSkinLookup(cardSkins: DokkanStatsCardSkin[]): Map<string, DokkanStatsCardSkin> {
    return uniqueMap(cardSkins, value => value.id, "DokkanStats card skin");
}

function validateCardSkinCoverage(
    chapters: DokkanFrontierChaptersDataset,
    cardSkins: Map<string, DokkanStatsCardSkin>,
): number {
    const missions = [
        ...chapters.chapters.flatMap(value => value.chapterMissions),
        ...chapters.chapters.flatMap(value => value.pages).flatMap(value => value.nodes).flatMap(value => value.missions),
    ];
    const rewards = missions.flatMap(value => value.rewards).filter(value => value.itemType === "CardSkinItem");
    rewards.forEach(reward => enrichCardSkinReward(reward, cardSkins));
    return rewards.length;
}

function requiredRewardId(value: string | undefined, label: string): string {
    const normalized = value?.trim() ?? "";
    if (!/^\d+$/.test(normalized)) throw new Error(`Frontier card-skin reward ${label} is missing or invalid.`);
    return normalized;
}

function specialCardPortraitSpec(ref: DokkanInfoSpecialCardReference): PortraitSpec | undefined {
    const rarity = ref.rarityRaw === undefined ? undefined : [
        Rarities.N,
        Rarities.R,
        Rarities.SR,
        Rarities.SSR,
        Rarities.UR,
        Rarities.LR,
    ][ref.rarityRaw];
    if (!ref.iconId || !rarity || !ref.elementRaw) return undefined;
    return portraitSpecFromElement(ref.iconId, rarity, ref.elementRaw);
}

function flattenDokkanInfoBattles(dataset: DokkanInfoFrontierDataset): DokkanInfoFrontierBattle[] {
    return dataset.series.flatMap(series => series.episodes.flatMap(episode => episode.battles));
}

function assertCompleteDokkanInfo(dataset: DokkanInfoFrontierDataset): void {
    const failed = [
        ...(dataset.failedSeriesIds ?? []),
        ...(dataset.failedEpisodeIds ?? []),
        ...(dataset.failedBattleIds ?? []),
    ];
    if (failed.length) throw new Error(`DokkanInfo Frontier input is incomplete: ${failed.join(", ")}`);
    const unavailable = flattenDokkanInfoBattles(dataset).filter(value => value.enemyDataStatus !== "available");
    if (unavailable.length) throw new Error(`DokkanInfo enemy data is unavailable for nodes: ${unavailable.map(value => value.id).join(", ")}`);
}

function assertExactIdSet(label: string, left: string[], right: string[]): void {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    if (leftSet.size !== left.length || rightSet.size !== right.length) throw new Error(`${label} contain duplicate IDs.`);
    const onlyLeft = left.filter(value => !rightSet.has(value));
    const onlyRight = right.filter(value => !leftSet.has(value));
    if (onlyLeft.length || onlyRight.length) {
        throw new Error(`${label} differ between sources (DokkanInfo only: ${onlyLeft.join(", ") || "none"}; dokkan.fyi only: ${onlyRight.join(", ") || "none"}).`);
    }
}

function uniqueMap<T>(values: T[], id: (value: T) => string, label: string): Map<string, T> {
    const result = new Map<string, T>();
    values.forEach(value => {
        const key = id(value);
        if (result.has(key)) throw new Error(`${label} ${key} is duplicated.`);
        result.set(key, value);
    });
    return result;
}

async function readDefaultInputs(): Promise<FrontierCatalogInputs> {
    const [dokkanInfo, dokkanFyiSeries, dokkanFyiChapters, dokkanStats] = await Promise.all([
        readJson<DokkanInfoFrontierDataset>("data/dokkaninfo-frontier/latest/frontier.json"),
        readJson<DokkanFrontierSeriesDataset>("data/dokkan-frontier/latest/dokkan-frontier-series.json"),
        readJson<DokkanFrontierChaptersDataset>("data/dokkan-frontier/latest/dokkan-frontier-chapters.json"),
        readOptionalJson<DokkanStatsFrontierDataset>("data/dokkanstats-frontier/latest/frontier.json"),
    ]);
    const characters = await readJson<Character[]>("data/characters.json");
    return { dokkanInfo, dokkanFyiSeries, dokkanFyiChapters, characters, dokkanStats };
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as T;
}

async function readOptionalJson<T>(path: string): Promise<T | undefined> {
    try {
        return await readJson<T>(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}
