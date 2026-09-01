"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeDokkanFrontierCatalog = exports.buildDokkanFrontierCatalog = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const character_1 = require("./character");
const portrait_asset_contract_1 = require("./game-db/portrait-asset-contract");
const OUTPUT_DIR = "data/dokkan-frontier-catalog/latest";
const PAYLOAD_FILE = "frontier.json";
const MANIFEST_FILE = "frontier-manifest.json";
function buildDokkanFrontierCatalog(inputs) {
    assertCompleteDokkanInfo(inputs.dokkanInfo);
    const infoBattles = flattenDokkanInfoBattles(inputs.dokkanInfo);
    const portraits = portraitLookup(inputs.characters);
    const fyiNodes = inputs.dokkanFyiChapters.chapters.flatMap(chapter => chapter.pages.flatMap(page => page.nodes));
    assertExactIdSet("Frontier nodes", infoBattles.map(value => value.id), fyiNodes.map(value => value.id));
    const infoBattleById = uniqueMap(infoBattles, value => value.id, "DokkanInfo battle");
    const infoEpisodeById = uniqueMap(inputs.dokkanInfo.series.flatMap(series => series.episodes), value => value.id, "DokkanInfo episode");
    const infoSeriesById = uniqueMap(inputs.dokkanInfo.series, value => value.id, "DokkanInfo series");
    const chapterById = uniqueMap(inputs.dokkanFyiChapters.chapters, value => value.id, "dokkan.fyi chapter");
    const series = inputs.dokkanFyiSeries.series.map(fyiSeries => {
        const infoSeries = infoSeriesById.get(fyiSeries.id);
        if (!infoSeries)
            throw new Error(`DokkanInfo series ${fyiSeries.id} is missing.`);
        const chapters = fyiSeries.chapters.map(summary => {
            const chapter = chapterById.get(summary.id);
            if (!chapter)
                throw new Error(`dokkan.fyi chapter ${summary.id} is missing.`);
            const infoEpisode = infoEpisodeById.get(summary.id);
            if (!infoEpisode)
                throw new Error(`DokkanInfo episode ${summary.id} is missing.`);
            return mapChapter(chapter, infoEpisode.title, infoEpisode.bannerPath, infoBattleById, portraits);
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
        },
        fieldAuthority: {
            dokkanInfo: ["node titles", "encounter portraits and types", "enemy stats", "super attacks", "clear rewards", "bonus passive cards"],
            dokkanFyi: ["series topology", "map backgrounds", "unlock conditions", "required characters", "intensity effects", "enemy skills", "missions"],
        },
        counts,
        series,
    };
}
exports.buildDokkanFrontierCatalog = buildDokkanFrontierCatalog;
async function writeDokkanFrontierCatalog(inputs) {
    const resolvedInputs = inputs ?? await readDefaultInputs();
    const dataset = buildDokkanFrontierCatalog(resolvedInputs);
    const outputDir = (0, path_1.resolve)(process.cwd(), OUTPUT_DIR);
    const payloadPath = (0, path_1.resolve)(outputDir, PAYLOAD_FILE);
    const manifestPath = (0, path_1.resolve)(outputDir, MANIFEST_FILE);
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(payloadPath, dataset);
    const payload = await (0, promises_1.readFile)(payloadPath);
    const manifest = {
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
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { payloadPath, manifestPath, dataset, manifest };
}
exports.writeDokkanFrontierCatalog = writeDokkanFrontierCatalog;
function mapChapter(chapter, infoTitle, infoBannerPath, battleById, portraits) {
    return {
        id: chapter.id,
        seriesId: chapter.seriesId,
        name: infoTitle || chapter.name,
        bannerImageUrl: infoBannerPath || chapter.bannerImagePath,
        groupExchange: chapter.groupExchange,
        missions: chapter.chapterMissions,
        pages: chapter.pages.map(page => ({
            id: page.id,
            number: page.pageNumber,
            backgroundImageUrl: page.backgroundImagePath,
            nodes: page.nodes.map(node => {
                const battle = battleById.get(node.id);
                if (!battle)
                    throw new Error(`DokkanInfo battle ${node.id} is missing.`);
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
                    missions: node.missions,
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
function mergeEnemyRounds(battle, fyiRounds, portraits) {
    const availableByCardId = new Map();
    battle.enemies.forEach(enemy => {
        if (!enemy.cardReferenceId)
            return;
        const values = availableByCardId.get(enemy.cardReferenceId) ?? [];
        values.push(enemy);
        availableByCardId.set(enemy.cardReferenceId, values);
    });
    const consumedByCardId = new Map();
    const rounds = fyiRounds.map((round, roundIndex) => ({
        number: round.roundNumber ?? roundIndex + 1,
        enemies: round.enemies.map(fyiEnemy => {
            const cardId = fyiEnemy.character?.id;
            if (!cardId)
                throw new Error(`Frontier node ${battle.id} has an enemy without a card ID.`);
            const occurrence = consumedByCardId.get(cardId) ?? 0;
            const infoEnemy = availableByCardId.get(cardId)?.[occurrence];
            if (!infoEnemy)
                throw new Error(`Frontier node ${battle.id} enemy ${cardId} is missing from DokkanInfo.`);
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
function mapEnemy(enemy, character, skills, portraits) {
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
function enemyPortraitSpec(enemy, character, portraits) {
    if (!enemy.typeCode)
        return undefined;
    if (character?.thumbnailId && character.rarity) {
        return (0, portrait_asset_contract_1.portraitSpecFromElement)(character.thumbnailId, character.rarity, enemy.typeCode);
    }
    const originalPortrait = enemy.cardReferenceId ? portraits.get(enemy.cardReferenceId) : undefined;
    return originalPortrait
        ? (0, portrait_asset_contract_1.portraitSpecFromElement)(originalPortrait.iconId, originalPortrait.rarity, enemy.typeCode)
        : undefined;
}
function portraitLookup(characters) {
    return new Map((characters ?? []).flatMap(character => character.portraitSpec ? [[character.id, character.portraitSpec]] : []));
}
function enrichCharacterRefs(refs, portraits) {
    return refs.map(ref => ({ ...ref, portraitSpec: portraits.get(ref.id) }));
}
function enrichCardRefs(refs, portraits) {
    return refs.map(ref => ({ ...ref, portraitSpec: specialCardPortraitSpec(ref) ?? portraits.get(ref.id) }));
}
function specialCardPortraitSpec(ref) {
    const rarity = ref.rarityRaw === undefined ? undefined : [
        character_1.Rarities.N,
        character_1.Rarities.R,
        character_1.Rarities.SR,
        character_1.Rarities.SSR,
        character_1.Rarities.UR,
        character_1.Rarities.LR,
    ][ref.rarityRaw];
    if (!ref.iconId || !rarity || !ref.elementRaw)
        return undefined;
    return (0, portrait_asset_contract_1.portraitSpecFromElement)(ref.iconId, rarity, ref.elementRaw);
}
function flattenDokkanInfoBattles(dataset) {
    return dataset.series.flatMap(series => series.episodes.flatMap(episode => episode.battles));
}
function assertCompleteDokkanInfo(dataset) {
    const failed = [
        ...(dataset.failedSeriesIds ?? []),
        ...(dataset.failedEpisodeIds ?? []),
        ...(dataset.failedBattleIds ?? []),
    ];
    if (failed.length)
        throw new Error(`DokkanInfo Frontier input is incomplete: ${failed.join(", ")}`);
    const unavailable = flattenDokkanInfoBattles(dataset).filter(value => value.enemyDataStatus !== "available");
    if (unavailable.length)
        throw new Error(`DokkanInfo enemy data is unavailable for nodes: ${unavailable.map(value => value.id).join(", ")}`);
}
function assertExactIdSet(label, left, right) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    if (leftSet.size !== left.length || rightSet.size !== right.length)
        throw new Error(`${label} contain duplicate IDs.`);
    const onlyLeft = left.filter(value => !rightSet.has(value));
    const onlyRight = right.filter(value => !leftSet.has(value));
    if (onlyLeft.length || onlyRight.length) {
        throw new Error(`${label} differ between sources (DokkanInfo only: ${onlyLeft.join(", ") || "none"}; dokkan.fyi only: ${onlyRight.join(", ") || "none"}).`);
    }
}
function uniqueMap(values, id, label) {
    const result = new Map();
    values.forEach(value => {
        const key = id(value);
        if (result.has(key))
            throw new Error(`${label} ${key} is duplicated.`);
        result.set(key, value);
    });
    return result;
}
async function readDefaultInputs() {
    const [dokkanInfo, dokkanFyiSeries, dokkanFyiChapters] = await Promise.all([
        readJson("data/dokkaninfo-frontier/latest/frontier.json"),
        readJson("data/dokkan-frontier/latest/dokkan-frontier-series.json"),
        readJson("data/dokkan-frontier/latest/dokkan-frontier-chapters.json"),
    ]);
    const characters = await readJson("data/characters.json");
    return { dokkanInfo, dokkanFyiSeries, dokkanFyiChapters, characters };
}
async function readJson(path) {
    return JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(process.cwd(), path), "utf8"));
}
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
//# sourceMappingURL=dokkan-frontier-catalog.js.map