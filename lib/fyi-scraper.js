"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentMaxStat = exports.exclusiveSkillOrbsFromFyi = exports.reversibleExchangeDetailsFromFyi = exports.obtainabilityDetailsFromFyi = exports.normalizeTransformationSource = exports.finishSkillsFromFyi = exports.standbyDetailsFromFyi = exports.passiveDetailsFromSkill = exports.mapSuperAttackDetails = exports.preferredSuperAttacks = exports.selectAwakenedState = exports.selectInitialState = exports.selectCurrentState = exports.mapDokkanFyiCharacter = exports.writeDokkanFyiContractReferenceSample = exports.buildDokkanFyiContractReferenceSample = exports.writeDokkanFyiExperiment = exports.runDokkanFyiExperiment = exports.getDokkanFyiDataWithReport = exports.getDokkanFyiData = exports.DEFAULT_DOKKAN_FYI_CONTRACT_SAMPLE_CHARACTER_IDS = exports.DEFAULT_DOKKAN_FYI_EXPERIMENT_CHARACTER_IDS = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const character_1 = require("./character");
const format_json_1 = require("./format-json");
const scraper_1 = require("./scraper");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_URL = "https://cdn.dokkan.fyi";
const DOKKAN_FYI_MAPPED_CHARACTER_CACHE_VERSION = 10;
exports.DEFAULT_DOKKAN_FYI_EXPERIMENT_CHARACTER_IDS = [
    1032521, 1033761, 1032771, 1026251, 1033941,
    1033841, 1024141, 1033061, 1032921, 1032881,
    1013541, 1025731, 1026131, 1032811, 1032361,
    1023421, 1031121, 1025591, 1030941, 1031181,
];
exports.DEFAULT_DOKKAN_FYI_CONTRACT_SAMPLE_CHARACTER_IDS = [
    1029471,
    1030431,
    1025591,
    1032771, // free-to-play obtainability
];
class DokkanFyiClient {
    pageCache = new Map();
    diskCacheDir = (0, path_1.resolve)(__dirname, "data/fyi-characters/cache");
    refresh = process.env.DOKKAN_FYI_CHARACTER_REFRESH === "true";
    cacheTtlMs = cacheTtlMsFromEnvironment();
    get shouldRefresh() {
        return this.refresh;
    }
    get cacheTtlMsValue() {
        return this.cacheTtlMs;
    }
    async fetchCharacterPage(characterId) {
        const cached = this.pageCache.get(characterId);
        if (cached) {
            return cached;
        }
        const pagePromise = this.fetchCharacterPageUncached(characterId);
        this.pageCache.set(characterId, pagePromise);
        return pagePromise;
    }
    async fetchCharacterPageUncached(characterId) {
        const cachePath = (0, path_1.resolve)(this.diskCacheDir, `character-${characterId}.json`);
        if (!this.refresh) {
            const cached = await readCachedFyiPage(cachePath, this.cacheTtlMs);
            if (cached) {
                return cached;
            }
        }
        const url = `${DOKKAN_FYI_BASE_URL}/characters/${characterId}`;
        const response = await fetchDokkanFyiResponse(url, {
            headers: browserHeaders(),
        }, `character page ${characterId}`);
        const html = await response.text();
        const payload = extractPagePayload(html);
        const version = payload.version ?? "";
        if (shouldFetchDeferredTransformationPath(payload)) {
            payload.props.transformationPath = await this.fetchTransformationPath(characterId, version);
        }
        else if (!payload.props.transformationPath) {
            payload.props.transformationPath = [];
        }
        const page = {
            fetchedAt: new Date().toISOString(),
            payload,
            version,
        };
        await (0, promises_1.mkdir)(this.diskCacheDir, { recursive: true });
        await (0, promises_1.writeFile)(cachePath, JSON.stringify(page), "utf8");
        return page;
    }
    async fetchTransformationPath(characterId, version) {
        const response = await fetchDokkanFyiResponse(`${DOKKAN_FYI_BASE_URL}/characters/${characterId}`, {
            headers: {
                ...browserHeaders(),
                "Accept": "application/json",
                "Referer": `${DOKKAN_FYI_BASE_URL}/characters/${characterId}`,
                "X-Inertia": "true",
                "X-Requested-With": "XMLHttpRequest",
                "X-Inertia-Version": version,
                "X-Inertia-Partial-Component": "Character/CharacterShow",
                "X-Inertia-Partial-Data": "transformationPath",
            },
        }, `transformation path ${characterId}`);
        const payload = await response.json();
        return payload.props.transformationPath ?? [];
    }
}
async function getDokkanFyiData(characterIds) {
    const result = await getDokkanFyiDataWithReport(characterIds);
    if (result.failedCharacterIds.length > 0) {
        throw new Error(`Could not map ${result.failedCharacterIds.length} dokkan.fyi characters: ${result.failedCharacterIds.join(", ")}`);
    }
    return result.characters;
}
exports.getDokkanFyiData = getDokkanFyiData;
async function getDokkanFyiDataWithReport(characterIds) {
    const ids = characterIds?.length ? characterIds : defaultDokkanFyiCharacterIds();
    const client = new DokkanFyiClient();
    const results = await mapWithConcurrency(ids, requestedCharacterConcurrency(), async (characterId) => {
        const mappedCachePath = (0, path_1.resolve)(__dirname, "data/fyi-characters/cache", `mapped-character-${characterId}.json`);
        if (!client.shouldRefresh) {
            const cachedCharacter = await readCachedMappedCharacter(mappedCachePath, client.cacheTtlMsValue);
            if (cachedCharacter) {
                return {
                    id: characterId.toString(),
                    character: cachedCharacter,
                };
            }
        }
        console.log(`[FYI] ${characterId}`);
        try {
            const page = await client.fetchCharacterPage(characterId);
            const character = await mapDokkanFyiCharacter(page, client);
            await writeCachedMappedCharacter(mappedCachePath, character);
            return {
                id: characterId.toString(),
                character,
            };
        }
        catch (error) {
            console.error(`[FYI] failed ${characterId}: ${formatErrorMessage(error)}`);
            return {
                id: characterId.toString(),
                error,
            };
        }
    });
    return {
        characters: results
            .filter((result) => "character" in result)
            .map(result => result.character),
        failedCharacterIds: results
            .filter((result) => "error" in result)
            .map(result => result.id),
    };
}
exports.getDokkanFyiDataWithReport = getDokkanFyiDataWithReport;
async function runDokkanFyiExperiment(characterIds) {
    const characters = await getDokkanFyiData(characterIds);
    const coverageReport = buildCoverageReport(characters);
    return { characters, coverageReport };
}
exports.runDokkanFyiExperiment = runDokkanFyiExperiment;
async function writeDokkanFyiExperiment(characterIds) {
    const { characters, coverageReport } = await runDokkanFyiExperiment(characterIds);
    const outputDir = (0, path_1.resolve)(__dirname, "data/fyi-experiment/latest");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const charactersPath = (0, path_1.resolve)(outputDir, "characters.json");
    const coveragePath = (0, path_1.resolve)(outputDir, "coverage-report.json");
    await (0, format_json_1.writeFormattedJson)(charactersPath, characters);
    await (0, format_json_1.writeFormattedJson)(coveragePath, coverageReport);
    return {
        charactersPath,
        coveragePath,
    };
}
exports.writeDokkanFyiExperiment = writeDokkanFyiExperiment;
function buildDokkanFyiContractReferenceSample(characters) {
    return {
        schemaName: "dokkan-fyi-character-contract",
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        specPath: "docs/specs/dokkan-fyi-character-contract.md",
        sampleCharacterIds: characters.map(character => character.id),
        notes: [
            "Reference snapshot for the planned Dokkan.fyi app contract.",
            "This file is intentionally small and curated for human review.",
            "Legacy compatibility fields may still be present while the Android app migrates.",
        ],
        characters,
    };
}
exports.buildDokkanFyiContractReferenceSample = buildDokkanFyiContractReferenceSample;
async function writeDokkanFyiContractReferenceSample(characterIds) {
    const ids = characterIds?.length ? characterIds : exports.DEFAULT_DOKKAN_FYI_CONTRACT_SAMPLE_CHARACTER_IDS;
    const characters = await getDokkanFyiData(ids);
    const sample = buildDokkanFyiContractReferenceSample(characters);
    const outputDir = (0, path_1.resolve)(__dirname, "docs/specs/examples");
    const outputPath = (0, path_1.resolve)(outputDir, "dokkan-fyi-character-sample.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, sample);
    return outputPath;
}
exports.writeDokkanFyiContractReferenceSample = writeDokkanFyiContractReferenceSample;
async function mapDokkanFyiCharacter(page, client) {
    const character = page.payload.props.character;
    const initialState = selectInitialState(character);
    const awakenedState = selectAwakenedState(character);
    const currentState = awakenedState ?? initialState;
    const standby = standbyDetailsFromFyi(character.standby_skill);
    const transformations = await buildTransformations(character, page.payload.props.transformationPath ?? [], client);
    const enrichedTransformations = await attachStandbyMetadataToTransformations(character, standby, transformations, client);
    const obtainability = obtainabilityDetailsFromFyi(character);
    const reversibleExchange = reversibleExchangeDetailsFromFyi(character, enrichedTransformations);
    const exclusiveSkillOrbs = exclusiveSkillOrbsFromFyi(character.skill_orbs);
    const activeSkill = character.active_skills?.[0];
    const activeSkillDetails = activeSkillDetailsFromFyi(character.active_skills, page.version);
    const releaseState = awakenedState
        ? releaseStateFromLatestType(awakenedState.latestType)
        : "initial";
    const passive = passiveDetailsFromSkill(initialState.passiveSkill, {
        characterId: character.id.toString(),
        formId: character.id.toString(),
        releaseState: "initial",
        sourceVersion: page.version,
        payloadField: "props.character.passive_skill.description",
    });
    const awakenedPassive = awakenedState?.passiveSkill ? passiveDetailsFromSkill(awakenedState.passiveSkill, {
        characterId: character.id.toString(),
        formId: character.id.toString(),
        releaseState,
        sourceVersion: page.version,
        payloadField: "props.character.extreme_z_awakening.passive_skill.description",
    }) : undefined;
    const initialSuperAttacks = initialState.currentSuperAttacks;
    const awakenedSuperAttacks = awakenedState?.currentSuperAttacks ?? [];
    const normalSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "normal");
    const ultraSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "ultra");
    const extraSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "extra");
    const ezaNormalSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "normal");
    const ezaUltraSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "ultra");
    const ezaExtraSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "extra");
    const initialLeaderSkill = formatSkillDescription(initialState.leaderSkill);
    const awakenedLeaderSkill = formatSkillDescription(awakenedState?.leaderSkill);
    const initialLeaderSkillDetails = (0, scraper_1.parseLeaderSkillDetails)(initialLeaderSkill);
    const awakenedLeaderSkillDetails = (0, scraper_1.parseLeaderSkillDetails)(awakenedLeaderSkill);
    return {
        name: cleanInlineText(character.name),
        title: cleanInlineText(currentState.leaderSkill?.name),
        maxLevel: currentState.maxLevel,
        maxSALevel: currentState.maxSuperAttackLevel,
        rarity: rarityFromText(character.rarity_text),
        releaseDate: releaseDate(character.release_dates?.initial),
        ezaReleaseDate: releaseDate(character.release_dates?.eza),
        sezaReleaseDate: releaseDate(character.release_dates?.seza),
        summonable: summonableLabel(character),
        isSummonable: isSummonable(character),
        isFreeToPlay: obtainability.isFreeToPlay,
        obtainability,
        characterClass: classFromAwakeningType(character.awakening_type_text),
        type: typeFromText(character.type_text),
        cost: toNumber(character.cost),
        id: character.id.toString(),
        legacyId: character.thumbnail_id?.toString(),
        portraitURL: portraitUrl(character.thumbnail_id),
        portraitFilename: `portrait_${character.id}`,
        portraitSpec: portraitSpecFromCharacter(character),
        leaderSkill: initialLeaderSkill,
        ezaLeaderSkill: awakenedLeaderSkill || undefined,
        leaderSkillBoost: awakenedLeaderSkillDetails?.displayBoost ?? initialLeaderSkillDetails?.displayBoost,
        leaderSkillDetails: initialLeaderSkillDetails,
        ezaLeaderSkillDetails: awakenedLeaderSkillDetails,
        superAttack: formatSuperAttackEffect(normalSuperAttack),
        ezaSuperAttack: formatSuperAttackEffect(ezaNormalSuperAttack) || undefined,
        ultraSuperAttack: formatSuperAttackEffect(ultraSuperAttack),
        ezaUltraSuperAttack: formatSuperAttackEffect(ezaUltraSuperAttack) || undefined,
        exSuperAttack: formatSuperAttackEffect(extraSuperAttack),
        ezaExSuperAttack: formatSuperAttackEffect(ezaExtraSuperAttack) || undefined,
        superAttackDetails: mapSuperAttackDetails(normalSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), "initial", page.version, "normal")),
        ezaSuperAttackDetails: mapSuperAttackDetails(ezaNormalSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), releaseState, page.version, "normal")),
        ultraSuperAttackDetails: mapSuperAttackDetails(ultraSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), "initial", page.version, "ultra")),
        ezaUltraSuperAttackDetails: mapSuperAttackDetails(ezaUltraSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), releaseState, page.version, "ultra")),
        exSuperAttackDetails: mapSuperAttackDetails(extraSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), "initial", page.version, "extra")),
        ezaExSuperAttackDetails: mapSuperAttackDetails(ezaExtraSuperAttack, superAttackEvidenceContext(character.id.toString(), character.id.toString(), releaseState, page.version, "extra")),
        unitSuperAttacks: unitSuperAttacksFromFyi(initialState.currentSuperAttacks, {
            characterId: character.id.toString(),
            formId: character.id.toString(),
            releaseState: "initial",
            sourceVersion: page.version,
        }),
        ezaUnitSuperAttacks: releaseState !== "initial"
            ? unitSuperAttacksFromFyi(awakenedState?.currentSuperAttacks ?? [], {
                characterId: character.id.toString(), formId: character.id.toString(),
                releaseState: "eza", sourceVersion: page.version,
            })
            : undefined,
        passive: passive?.text ?? "",
        passiveDetails: passive,
        ezaPassive: releaseState === "eza" ? awakenedPassive?.text : undefined,
        ezaPassiveDetails: releaseState === "eza" ? awakenedPassive : undefined,
        sezaPassive: releaseState === "seza" ? awakenedPassive?.text : undefined,
        sezaPassiveDetails: releaseState === "seza" ? awakenedPassive : undefined,
        activeSkill: formatActiveSkill(activeSkill),
        activeSkillCondition: cleanMultilineText(activeSkill?.condition),
        activeSkillDetails,
        transformationCondition: "",
        domain: "",
        links: (character.link_skills ?? []).map(linkSkill => cleanInlineText(linkSkill.name)).filter(Boolean),
        categories: (character.categories ?? []).map(category => cleanInlineText(category.name)).filter(Boolean),
        kiMeter: kiMeterText(character.ki_multipliers),
        artURL: cardArtUrl(character.thumbnail_id),
        artFilename: `art_${character.id}`,
        baseHP: currentBaseStat(character.stats.hp),
        maxLevelHP: currentMaxStat(character.stats.hp, currentState.latestType),
        freeDupeHP: currentMaxStat(character.stats.hp, currentState.latestType),
        rainbowHP: currentMaxStat(character.stats.hp, currentState.latestType),
        baseAttack: currentBaseStat(character.stats.atk),
        maxLevelAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        freeDupeAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        rainbowAttack: currentMaxStat(character.stats.atk, currentState.latestType),
        baseDefence: currentBaseStat(character.stats.def),
        maxDefence: currentMaxStat(character.stats.def, currentState.latestType),
        freeDupeDefence: currentMaxStat(character.stats.def, currentState.latestType),
        rainbowDefence: currentMaxStat(character.stats.def, currentState.latestType),
        kiMultiplier: kiMultiplierText(character.ki_multipliers),
        extraInfo: kiMultiplierExtraInfo(character.ki_multipliers),
        standbySkill: standby?.legacyText ?? "",
        finishingMove: standby?.finishSkills.map(finishSkill => finishSkill.legacyText ?? "") ?? [],
        standby,
        finishSkills: standby?.finishSkills ?? [],
        reversibleExchange,
        exclusiveSkillOrbs,
        transformations: enrichedTransformations,
    };
}
exports.mapDokkanFyiCharacter = mapDokkanFyiCharacter;
async function buildTransformations(rootCharacter, initialEntries, client) {
    const visited = new Set();
    const queue = initialEntries.map(entry => ({
        entry,
        sourceCharacterId: rootCharacter.id,
    }));
    const transformations = [];
    while (queue.length > 0) {
        const current = queue.shift();
        const targetCharacterId = current.entry.character.id;
        if (visited.has(targetCharacterId)) {
            continue;
        }
        visited.add(targetCharacterId);
        const targetPage = await client.fetchCharacterPage(targetCharacterId);
        transformations.push(mapDokkanFyiTransformation(rootCharacter.id, targetPage.payload.props.character, current.entry, targetPage.version));
        for (const nestedEntry of targetPage.payload.props.transformationPath ?? []) {
            queue.push({
                entry: nestedEntry,
                sourceCharacterId: current.sourceCharacterId,
            });
        }
    }
    return transformations;
}
async function attachStandbyMetadataToTransformations(rootCharacter, standby, transformations, client) {
    if (!standby) {
        return transformations;
    }
    const nextTransformations = [...transformations];
    if (standby.targetCharacterId) {
        const standbyTransformation = await ensureTransformation(nextTransformations, standby.targetCharacterId, rootCharacter.id, {
            character: {
                id: toNumber(standby.targetCharacterId),
                canonical_id: 0,
                character_id: 0,
                name: "",
                rarity: 0,
                rarity_text: "",
                type: 0,
                type_text: "",
                awakening_type: 0,
                awakening_type_text: "",
                stats: {
                    hp: {},
                    atk: {},
                    def: {},
                },
                max_level: 0,
                cost: 0,
                thumbnail_id: 0,
                has_images: true,
                max_super_attack_level: 0,
                base_character_id: toNumber(standby.targetCharacterId),
            },
            description: standby.condition,
            source: "Standby Skill",
        }, client);
        standbyTransformation.finishSkills = standby.finishSkills;
        standbyTransformation.finishingMove = standby.finishSkills
            .map(finishSkill => finishSkill.legacyText)
            .filter((value) => Boolean(value));
        standbyTransformation.transformationSource = "standby";
        standbyTransformation.transformationSourceLabel = standbyTransformation.transformationSourceLabel || "Standby Skill";
    }
    for (const finishSkill of standby.finishSkills) {
        if (!finishSkill.targetTransformationId) {
            continue;
        }
        const finishTransformation = await ensureTransformation(nextTransformations, finishSkill.targetTransformationId, rootCharacter.id, {
            character: {
                id: toNumber(finishSkill.targetTransformationId),
                canonical_id: 0,
                character_id: 0,
                name: "",
                rarity: 0,
                rarity_text: "",
                type: 0,
                type_text: "",
                awakening_type: 0,
                awakening_type_text: "",
                stats: {
                    hp: {},
                    atk: {},
                    def: {},
                },
                max_level: 0,
                cost: 0,
                thumbnail_id: 0,
                has_images: true,
                max_super_attack_level: 0,
                base_character_id: toNumber(finishSkill.targetTransformationId),
            },
            description: finishSkill.condition,
            source: "Finish Effect",
        }, client);
        finishTransformation.transformationSource = "finish-skill";
        finishTransformation.transformationSourceLabel = finishTransformation.transformationSourceLabel || "Finish Effect";
        if (!finishTransformation.transformationCondition) {
            finishTransformation.transformationCondition = finishSkill.condition;
        }
    }
    return nextTransformations;
}
async function ensureTransformation(transformations, targetCharacterId, baseCharacterId, fallbackEntry, client) {
    const existing = transformations.find(transformation => transformation.id === targetCharacterId);
    if (existing) {
        return existing;
    }
    const targetPage = await client.fetchCharacterPage(toNumber(targetCharacterId));
    const transformation = mapDokkanFyiTransformation(baseCharacterId, targetPage.payload.props.character, fallbackEntry, targetPage.version);
    transformations.push(transformation);
    return transformation;
}
function mapDokkanFyiTransformation(baseCharacterId, character, entry, sourceVersion) {
    const initialState = selectInitialState(character);
    const awakenedState = selectAwakenedState(character);
    const releaseState = awakenedState
        ? releaseStateFromLatestType(awakenedState.latestType)
        : "initial";
    const passive = passiveDetailsFromSkill(initialState.passiveSkill, {
        characterId: baseCharacterId.toString(),
        formId: character.id.toString(),
        releaseState: "initial",
        sourceVersion,
        payloadField: "props.character.passive_skill.description",
    });
    const awakenedPassive = awakenedState?.passiveSkill ? passiveDetailsFromSkill(awakenedState.passiveSkill, {
        characterId: baseCharacterId.toString(),
        formId: character.id.toString(),
        releaseState,
        sourceVersion,
        payloadField: "props.character.extreme_z_awakening.passive_skill.description",
    }) : undefined;
    const initialSuperAttacks = initialState.currentSuperAttacks;
    const awakenedSuperAttacks = awakenedState?.currentSuperAttacks ?? [];
    const normalSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "normal");
    const ultraSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "ultra");
    const extraSuperAttack = matchingFyiSuperAttack(initialSuperAttacks, "extra");
    const ezaNormalSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "normal");
    const ezaUltraSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "ultra");
    const ezaExtraSuperAttack = matchingFyiSuperAttack(awakenedSuperAttacks, "extra");
    const activeSkill = character.active_skills?.[0];
    const activeSkillDetails = activeSkillDetailsFromFyi(character.active_skills, sourceVersion);
    const standby = standbyDetailsFromFyi(character.standby_skill);
    const obtainability = obtainabilityDetailsFromFyi(character);
    return {
        id: character.id.toString(),
        baseCharacterId: baseCharacterId.toString(),
        legacyId: character.thumbnail_id?.toString(),
        name: cleanInlineText(character.name),
        releaseDate: releaseDate(character.release_dates?.initial),
        ezaReleaseDate: releaseDate(character.release_dates?.eza),
        sezaReleaseDate: releaseDate(character.release_dates?.seza),
        summonable: summonableLabel(character),
        isSummonable: isSummonable(character),
        isFreeToPlay: obtainability.isFreeToPlay,
        obtainability,
        characterClass: classFromAwakeningType(character.awakening_type_text),
        type: typeFromText(character.type_text),
        superAttack: formatSuperAttackEffect(normalSuperAttack),
        ezaSuperAttack: formatSuperAttackEffect(ezaNormalSuperAttack) || undefined,
        ultraSuperAttack: formatSuperAttackEffect(ultraSuperAttack),
        ezaUltraSuperAttack: formatSuperAttackEffect(ezaUltraSuperAttack) || undefined,
        exSuperAttack: formatSuperAttackEffect(extraSuperAttack),
        ezaExSuperAttack: formatSuperAttackEffect(ezaExtraSuperAttack) || undefined,
        superAttackDetails: mapSuperAttackDetails(normalSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), "initial", sourceVersion, "normal")),
        ezaSuperAttackDetails: mapSuperAttackDetails(ezaNormalSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), releaseState, sourceVersion, "normal")),
        ultraSuperAttackDetails: mapSuperAttackDetails(ultraSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), "initial", sourceVersion, "ultra")),
        ezaUltraSuperAttackDetails: mapSuperAttackDetails(ezaUltraSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), releaseState, sourceVersion, "ultra")),
        exSuperAttackDetails: mapSuperAttackDetails(extraSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), "initial", sourceVersion, "extra")),
        ezaExSuperAttackDetails: mapSuperAttackDetails(ezaExtraSuperAttack, superAttackEvidenceContext(baseCharacterId.toString(), character.id.toString(), releaseState, sourceVersion, "extra")),
        unitSuperAttacks: unitSuperAttacksFromFyi(initialSuperAttacks, {
            characterId: baseCharacterId.toString(), formId: character.id.toString(),
            releaseState: "initial", sourceVersion,
        }),
        ezaUnitSuperAttacks: releaseState !== "initial"
            ? unitSuperAttacksFromFyi(awakenedSuperAttacks, {
                characterId: baseCharacterId.toString(), formId: character.id.toString(),
                releaseState: "eza", sourceVersion,
            })
            : undefined,
        passive: passive?.text ?? "",
        passiveDetails: passive,
        ezaPassive: releaseState === "eza" ? awakenedPassive?.text : undefined,
        ezaPassiveDetails: releaseState === "eza" ? awakenedPassive : undefined,
        sezaPassive: releaseState === "seza" ? awakenedPassive?.text : undefined,
        sezaPassiveDetails: releaseState === "seza" ? awakenedPassive : undefined,
        activeSkill: formatActiveSkill(activeSkill),
        activeSkillCondition: cleanMultilineText(activeSkill?.condition),
        activeSkillDetails,
        transformationCondition: cleanMultilineText(entry.description),
        domain: "",
        links: (character.link_skills ?? []).map(linkSkill => cleanInlineText(linkSkill.name)).filter(Boolean),
        portraitURL: portraitUrl(character.thumbnail_id),
        portraitFilename: `portrait_${character.id}`,
        portraitSpec: portraitSpecFromCharacter(character),
        artURL: cardArtUrl(character.thumbnail_id),
        artFilename: `art_${character.id}`,
        extraInfo: kiMultiplierExtraInfo(character.ki_multipliers),
        standbySkill: standby?.legacyText ?? "",
        finishingMove: standby?.finishSkills.map(finishSkill => finishSkill.legacyText ?? "").filter(Boolean) ?? [],
        standby,
        finishSkills: standby?.finishSkills ?? [],
        reversibleExchange: reversibleExchangeDetailsFromFyi(character),
        transformationSource: normalizeTransformationSource(entry.source, entry.description),
        transformationSourceLabel: cleanInlineText(entry.source),
    };
}
function selectCurrentState(character) {
    return selectAwakenedState(character) ?? selectInitialState(character);
}
exports.selectCurrentState = selectCurrentState;
function selectInitialState(character) {
    return {
        latestType: "initial",
        maxLevel: toNumber(character.max_level),
        maxSuperAttackLevel: toNumber(character.max_super_attack_level),
        leaderSkill: character.leader_skill,
        passiveSkill: character.passive_skill,
        currentSuperAttacks: preferredSuperAttacks(character.super_attacks ?? [], false),
    };
}
exports.selectInitialState = selectInitialState;
function selectAwakenedState(character) {
    const latestType = character.release_dates?.latest_type;
    if ((latestType !== "eza" && latestType !== "seza") || !character.extreme_z_awakening) {
        return undefined;
    }
    return {
        latestType,
        maxLevel: toNumber(character.extreme_z_awakening.max_level),
        maxSuperAttackLevel: toNumber(character.extreme_z_awakening.max_super_attack_level),
        leaderSkill: character.extreme_z_awakening.leader_skill,
        passiveSkill: character.extreme_z_awakening.passive_skill,
        currentSuperAttacks: preferredSuperAttacks(character.super_attacks ?? [], true),
    };
}
exports.selectAwakenedState = selectAwakenedState;
function releaseStateFromLatestType(value) {
    if (value === "eza" || value === "seza")
        return value;
    return "initial";
}
function preferredSuperAttacks(superAttacks, useExtremeState) {
    const grouped = new Map();
    const unitAttacks = [];
    for (const superAttack of superAttacks) {
        const kind = superAttackKind(superAttack);
        if (kind === "unit") {
            const level = toNumber(superAttack.level);
            if ((useExtremeState && level > 0) || (!useExtremeState && level === 0)) {
                unitAttacks.push(superAttack);
            }
            continue;
        }
        const key = `${kind}:${toNumber(superAttack.ki)}`;
        const current = grouped.get(key);
        if (current) {
            current.push(superAttack);
        }
        else {
            grouped.set(key, [superAttack]);
        }
    }
    const standardAttacks = Array.from(grouped.values())
        .map(group => selectPreferredAttack(group, useExtremeState))
        .filter((superAttack) => Boolean(superAttack));
    return [...standardAttacks, ...unitAttacks];
}
exports.preferredSuperAttacks = preferredSuperAttacks;
function selectPreferredAttack(group, useExtremeState) {
    const sorted = [...group].sort((left, right) => toNumber(right.level) - toNumber(left.level));
    if (!useExtremeState) {
        return sorted.find(superAttack => toNumber(superAttack.level) === 0);
    }
    return sorted.find(superAttack => toNumber(superAttack.level) > 0);
}
function matchingFyiSuperAttack(superAttacks, kind) {
    return superAttacks.find(superAttack => superAttackKind(superAttack) === kind);
}
function superAttackKind(superAttack) {
    const style = cleanInlineText(superAttack.style).toLowerCase();
    const ki = toNumber(superAttack.ki);
    if (style.includes("unit") || style.includes("condition")) {
        return "unit";
    }
    if (style.includes("ex") || style.includes("extra")) {
        return "extra";
    }
    if (style.includes("ultra") || ki >= 18) {
        return "ultra";
    }
    return "normal";
}
function superAttackEvidenceContext(characterId, formId, releaseState, sourceVersion, attackVariant) {
    return {
        characterId,
        formId,
        releaseState,
        sourceVersion,
        attackVariant,
        payloadField: "props.character.super_attacks[].description",
    };
}
function mapSuperAttackDetails(superAttack, evidenceContext) {
    if (!superAttack) {
        return undefined;
    }
    const effect = cleanMultilineText(superAttack.description);
    const structuralSource = evidenceContext
        ? effectStructuralSource(superAttack.description, effect, evidenceContext, superAttack.id)
        : undefined;
    return {
        name: cleanInlineText(superAttack.name),
        effect,
        type: attackType(superAttack.category?.name),
        ki: toNumber(superAttack.ki),
        style: cleanInlineText(superAttack.style),
        condition: cleanMultilineText(superAttack.condition),
        ...(structuralSource ? { structuralSource } : {}),
        ...(structuralSource ? { sourceAttackId: superAttack.id.toString() } : {}),
    };
}
exports.mapSuperAttackDetails = mapSuperAttackDetails;
function unitSuperAttacksFromFyi(superAttacks, evidenceContext) {
    return superAttacks
        .filter(superAttack => superAttackKind(superAttack) === "unit")
        .map(superAttack => {
        const effect = cleanMultilineText(superAttack.description);
        const structuralSource = evidenceContext
            ? effectStructuralSource(superAttack.description, effect, {
                ...evidenceContext,
                attackVariant: "unit",
                payloadField: "props.character.super_attacks[].description",
            }, superAttack.id)
            : undefined;
        return {
            name: cleanInlineText(superAttack.name),
            effect,
            type: attackType(superAttack.category?.name),
            ki: toNumber(superAttack.ki),
            style: cleanInlineText(superAttack.style),
            unitSuperAttack: formatSuperAttack(superAttack),
            unitSuperAttackCondition: cleanMultilineText(superAttack.condition),
            ...(structuralSource ? { structuralSource } : {}),
            ...(structuralSource ? { sourceAttackId: superAttack.id.toString() } : {}),
        };
    });
}
function passiveDetailsFromSkill(skill, evidenceContext) {
    if (!skill) {
        return undefined;
    }
    const text = cleanMultilineText(skill.description);
    const lines = text
        ? text.split("\n").map(line => line.trim()).filter(Boolean)
        : [];
    const conditionEvidence = evidenceContext
        ? enemyStatusConditionEvidence(skill, text, evidenceContext)
        : [];
    const structuralSource = evidenceContext
        ? effectStructuralSource(skill.description, text, evidenceContext, skill.id)
        : undefined;
    return {
        name: cleanInlineText(skill.name),
        text,
        lines,
        sections: lines.length ? (0, scraper_1.splitPassiveSections)(lines) : undefined,
        ...(conditionEvidence.length > 0 ? { conditionEvidence } : {}),
        ...(structuralSource ? { structuralSource } : {}),
        ...(structuralSource && skill.id !== undefined ? { sourceSkillId: skill.id.toString() } : {}),
    };
}
exports.passiveDetailsFromSkill = passiveDetailsFromSkill;
function effectStructuralSource(rawValue, normalizedText, context, sourceEntityId) {
    if (!rawValue) {
        return undefined;
    }
    const lines = structuralSourceLines(rawValue);
    const rawTextSha256 = sha256Text(rawValue);
    const normalizedTextSha256 = sha256Text(normalizedText);
    const stateKey = `${context.characterId}:${context.formId}:${context.releaseState}`;
    const channel = context.payloadField === "props.character.super_attacks[].description"
        ? "super_attack"
        : "passive";
    const evidence = [];
    for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
        const line = lines[lineOffset];
        const markerRuns = channel === "passive"
            ? passiveStructuralMarkerRuns(line.rawText)
            : [...line.rawText.matchAll(/(^|;\s*)((?:\{passiveImg:[^}]+\}\s*)+)/g)].map(markerRun => {
                const markerSource = markerRun[2];
                return {
                    markerStartInLine: (markerRun.index ?? 0) + markerRun[1].length,
                    markerSource,
                    markerMatches: [...markerSource.matchAll(/\{passiveImg:([^}]+)\}/g)],
                };
            });
        for (const { markerStartInLine, markerSource, markerMatches } of markerRuns) {
            let endLineOffset = lineOffset;
            let anchorEnd = line.end;
            const semicolon = line.rawText.indexOf(";", markerStartInLine + markerSource.length);
            if (semicolon >= 0) {
                anchorEnd = line.start + semicolon;
            }
            else if (channel === "passive") {
                while (endLineOffset + 1 < lines.length) {
                    const nextLine = lines[endLineOffset + 1];
                    if (/^\s*(?:-|\*)\s*/.test(nextLine.rawText)) {
                        break;
                    }
                    endLineOffset += 1;
                    anchorEnd = nextLine.end;
                }
            }
            else {
                let continuationText = line.rawText.slice(markerStartInLine + markerSource.length).trim();
                while ((continuationText === "" || /(?:\b(?:and|or)|[,;&])\s*$/i.test(continuationText))
                    && endLineOffset + 1 < lines.length) {
                    const nextLine = lines[endLineOffset + 1];
                    if (/^\s*(?:\{passiveImg:|-|\*)/.test(nextLine.rawText)) {
                        break;
                    }
                    endLineOffset += 1;
                    anchorEnd = nextLine.end;
                    continuationText = nextLine.rawText.trim();
                }
            }
            const anchorStart = line.start + markerStartInLine;
            const structuralText = rawValue.slice(anchorStart, anchorEnd).trimEnd();
            const anchorMarkerMatches = channel === "passive"
                ? [...structuralText.matchAll(/\{passiveImg:([^}]+)\}/g)]
                : markerMatches;
            const normalizedAnchorText = cleanMultilineText(structuralText)
                .replace(/^\s*-\s*/, "")
                .replace(/\s*\n\s*/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const coveredLines = lines.slice(lineOffset, endLineOffset + 1)
                .filter(item => item.normalizedLineIndex !== undefined);
            if (!normalizedAnchorText || coveredLines.length === 0) {
                continue;
            }
            const markers = anchorMarkerMatches.map((match, order) => {
                const sourceToken = match[1];
                const markerKind = effectStructuralMarkerKind(sourceToken);
                const start = anchorStart + (match.index ?? 0);
                return {
                    order,
                    sourceToken,
                    markerKind,
                    resolution: markerKind === "unknown" ? "unresolved" : "supported",
                    sourceSpan: { start, end: start + match[0].length },
                };
            });
            const resolution = markers.every(marker => marker.resolution === "supported")
                ? "supported"
                : markers.every(marker => marker.resolution === "unresolved")
                    ? "unresolved"
                    : "partial";
            const identity = sourceEntityId?.toString() ?? "unknown";
            evidence.push({
                kind: "effect_markers",
                id: `${stateKey}:${channel}:${identity}:${anchorStart}`,
                stateKey,
                characterId: context.characterId,
                formId: context.formId,
                releaseState: context.releaseState,
                channel,
                ...(channel === "passive" && sourceEntityId !== undefined
                    ? { passiveSkillId: sourceEntityId.toString() }
                    : {}),
                ...(channel === "super_attack" && sourceEntityId !== undefined
                    ? { superAttackId: sourceEntityId.toString() }
                    : {}),
                ...(channel === "super_attack"
                    ? { attackVariant: context.attackVariant }
                    : {}),
                rawTextSha256,
                normalizedTextSha256,
                anchor: {
                    lineIndex: coveredLines[0].normalizedLineIndex,
                    ...(coveredLines.length > 1
                        ? { endLineIndex: coveredLines[coveredLines.length - 1].normalizedLineIndex }
                        : {}),
                    normalizedText: normalizedAnchorText,
                    structuralText,
                    sourceSpan: { start: anchorStart, end: anchorEnd },
                },
                markers,
                resolution,
                provenance: {
                    source: "dokkan_fyi_payload",
                    sourceVersion: context.sourceVersion,
                    payloadField: context.payloadField,
                    markerSyntax: "passiveImg",
                },
            });
        }
    }
    return evidence.length > 0 ? { rawText: rawValue, rawTextSha256, normalizedTextSha256, evidence } : undefined;
}
function passiveStructuralMarkerRuns(rawLine) {
    const bullet = rawLine.match(/^(\s*-\s*)(.*)$/);
    if (!bullet) {
        return [];
    }
    const markerSource = bullet[2];
    const markerMatches = [...markerSource.matchAll(/\{passiveImg:([^}]+)\}/g)];
    return markerMatches.length > 0
        ? [{ markerStartInLine: bullet[1].length, markerSource, markerMatches }]
        : [];
}
function effectStructuralMarkerKind(sourceToken) {
    if (sourceToken === "once" || sourceToken === "forever") {
        return sourceToken;
    }
    if (sourceToken === "up_g") {
        return "value_up";
    }
    if (sourceToken === "down_r" || sourceToken === "down_y") {
        return "value_down";
    }
    return "unknown";
}
function structuralSourceLines(rawText) {
    const lines = [];
    let start = 0;
    let normalizedLineIndex = 0;
    while (start <= rawText.length) {
        const newline = rawText.slice(start).search(/\r\n|\n|\r/);
        const end = newline < 0 ? rawText.length : start + newline;
        const rawLine = rawText.slice(start, end);
        const normalizedLine = cleanMultilineText(rawLine);
        lines.push({
            rawText: rawLine,
            start,
            end,
            ...(normalizedLine ? { normalizedLineIndex: normalizedLineIndex++ } : {}),
        });
        if (newline < 0) {
            break;
        }
        const separatorLength = rawText.slice(end, end + 2) === "\r\n" ? 2 : 1;
        start = end + separatorLength;
    }
    return lines;
}
function enemyStatusConditionEvidence(skill, passiveText, context) {
    if (!skill.description) {
        return [];
    }
    const passiveTextSha256 = sha256Text(passiveText);
    const stateKey = `${context.characterId}:${context.formId}:${context.releaseState}`;
    const evidence = [];
    let normalizedLineIndex = 0;
    const sourceLines = skill.description.replace(/\r/g, "").split("\n").flatMap(rawLine => {
        const normalizedText = cleanMultilineText(rawLine);
        if (!normalizedText) {
            return [];
        }
        const sourceLine = {
            rawText: rawLine.trim(),
            structuralText: normalizePassiveStructuralLine(rawLine),
            normalizedText,
            lineIndex: normalizedLineIndex,
        };
        normalizedLineIndex += 1;
        return [sourceLine];
    });
    for (let index = 0; index < sourceLines.length; index += 1) {
        const firstLine = sourceLines[index];
        if (!firstLine.rawText.startsWith("*") || firstLine.rawText.startsWith("*-")) {
            continue;
        }
        const anchorLines = [firstLine];
        while (!anchorLines[anchorLines.length - 1].rawText.endsWith("*")
            && index + 1 < sourceLines.length
            && !sourceLines[index + 1].rawText.startsWith("-")) {
            index += 1;
            anchorLines.push(sourceLines[index]);
        }
        const structuralText = anchorLines.map(line => line.structuralText).join(" ").replace(/\s+/g, " ").trim();
        if (!/following status:/i.test(structuralText)) {
            continue;
        }
        const normalizedText = anchorLines.map(line => line.normalizedText).join(" ").replace(/\s+/g, " ").trim();
        const statusSource = structuralText.slice(structuralText.toLowerCase().indexOf("following status:") + "following status:".length);
        const markerMatches = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)];
        const statuses = markerMatches.map((match, order) => {
            const sourceToken = match[1];
            const status = passiveEnemyStatusFromMarker(sourceToken);
            return {
                order,
                sourceToken,
                ...(status ? { status } : {}),
                resolution: status ? "supported" : "unresolved",
            };
        });
        const connector = passiveEvidenceConnector(statusSource, markerMatches.length);
        const resolution = statuses.length === 0
            ? "unresolved"
            : statuses.some(status => status.resolution === "unresolved")
                || (statuses.length > 1 && !connector)
                ? "partial"
                : "supported";
        evidence.push({
            kind: "enemy_status",
            stateKey,
            characterId: context.characterId,
            formId: context.formId,
            releaseState: context.releaseState,
            ...(skill.id !== undefined ? { passiveSkillId: skill.id.toString() } : {}),
            passiveTextSha256,
            anchor: {
                lineIndex: anchorLines[0].lineIndex,
                ...(anchorLines.length > 1 ? { endLineIndex: anchorLines[anchorLines.length - 1].lineIndex } : {}),
                normalizedText,
                structuralText,
            },
            statuses,
            ...(connector ? { connector } : {}),
            resolution,
            provenance: {
                source: "dokkan_fyi_payload",
                sourceVersion: context.sourceVersion,
                payloadField: context.payloadField,
                markerSyntax: "passiveImg",
            },
        });
    }
    return evidence;
}
function normalizePassiveStructuralLine(value) {
    return value.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim();
}
function passiveEnemyStatusFromMarker(sourceToken) {
    switch (sourceToken) {
        case "atk_down":
            return "atk_down";
        case "def_down":
            return "def_down";
        case "stun":
            return "stunned";
        case "astute":
            return "super_attack_sealed";
        default:
            return undefined;
    }
}
function passiveEvidenceConnector(statusSource, markerCount) {
    if (markerCount < 2) {
        return undefined;
    }
    const firstMarkerIndex = statusSource.search(/\{passiveImg:[^}]+\}/);
    const lastMarkerIndex = statusSource.lastIndexOf("{passiveImg:");
    const lastMarkerEnd = lastMarkerIndex >= 0 ? statusSource.indexOf("}", lastMarkerIndex) + 1 : -1;
    if (firstMarkerIndex < 0 || lastMarkerEnd <= firstMarkerIndex) {
        return undefined;
    }
    const markerList = statusSource.slice(firstMarkerIndex, lastMarkerEnd)
        .replace(/\{passiveImg:[^}]+\}/g, "#");
    const hasAnd = /\band\b/i.test(markerList);
    const hasOr = /\bor\b/i.test(markerList);
    if (hasAnd === hasOr) {
        return undefined;
    }
    return hasAnd ? "and" : "or";
}
function sha256Text(value) {
    return (0, crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
}
function buildCoverageReport(characters) {
    const rows = characters.map(character => {
        const notes = [];
        if (character.standby && character.standby.finishSkills.length === 0) {
            notes.push("Standby path found, but no explicit finish-skill payload was mapped.");
        }
        if ((character.transformations?.length ?? 0) > 0 && character.transformations?.every(transformation => !transformation.transformationCondition)) {
            notes.push("Transformation targets exist, but none exposed an explicit condition.");
        }
        const row = {
            id: character.id,
            name: character.name,
            latestType: character.sezaReleaseDate
                ? "seza"
                : character.ezaReleaseDate
                    ? "eza"
                    : "initial",
            hasActiveSkill: Boolean(character.activeSkill),
            hasStandbySkill: Boolean(character.standbySkill),
            hasReversibleExchange: Boolean(character.transformations?.some(transformation => transformation.transformationCondition?.toLowerCase().includes("reversible exchange"))),
            hasTransformationPath: (character.transformations?.length ?? 0) > 0,
            mappedTransformationCount: character.transformations?.length ?? 0,
            supportsExSuperAttack: Boolean(character.exSuperAttack),
            supportsUnitSuperAttack: (character.unitSuperAttacks?.length ?? 0) > 0,
            supportsFinishMove: Boolean((character.finishSkills?.length ?? 0) > 0
                || character.transformations?.some(transformation => (transformation.finishSkills?.length ?? 0) > 0)),
            notes,
        };
        return row;
    });
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        characterIds: characters.map(character => character.id),
        summary: {
            totalCharacters: rows.length,
            activeSkillCount: rows.filter(row => row.hasActiveSkill).length,
            standbySkillCount: rows.filter(row => row.hasStandbySkill).length,
            reversibleExchangeCount: rows.filter(row => row.hasReversibleExchange).length,
            transformationSourceCount: rows.filter(row => row.hasTransformationPath).length,
            exSuperAttackCount: rows.filter(row => row.supportsExSuperAttack).length,
            unitSuperAttackCount: rows.filter(row => row.supportsUnitSuperAttack).length,
            finishMoveCount: rows.filter(row => row.supportsFinishMove).length,
        },
        rows,
    };
}
function standbyDetailsFromFyi(skill) {
    if (!skill) {
        return undefined;
    }
    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    const condition = cleanMultilineText(skill.condition);
    const finishSkills = finishSkillsFromFyi(skill.finish_skills);
    return {
        id: skill.id?.toString(),
        name,
        description,
        condition,
        targetCharacterId: transformationTargetIdFromEffects(skill.effects),
        finishSkills,
        legacyText: [name, description].filter(Boolean).join(": "),
    };
}
exports.standbyDetailsFromFyi = standbyDetailsFromFyi;
function finishSkillsFromFyi(skills) {
    return (skills ?? []).map(skill => {
        const name = cleanInlineText(skill.name);
        const description = cleanMultilineText(skill.description);
        const condition = cleanMultilineText(skill.condition);
        return {
            id: skill.id?.toString(),
            name,
            description,
            condition,
            targetTransformationId: transformationTargetIdFromEffects(skill.effects),
            effectKind: finishSkillEffectKind(skill),
            legacyText: formatFinishSkillLegacyText(name, description, condition),
        };
    });
}
exports.finishSkillsFromFyi = finishSkillsFromFyi;
function normalizeTransformationSource(rawSource, description) {
    const source = cleanInlineText(rawSource).toLowerCase();
    const detail = cleanInlineText(description).toLowerCase();
    if (source.includes("standby")) {
        return "standby";
    }
    if (source.includes("finish")) {
        return "finish-skill";
    }
    if (source.includes("active")) {
        return "active-skill";
    }
    if (source.includes("reversible exchange")) {
        return "reversible-exchange";
    }
    if (source.includes("passive") && detail.includes("reversible exchange")) {
        return "reversible-exchange";
    }
    if (source.includes("passive")) {
        return "passive-skill";
    }
    if (detail.includes("reversible exchange")) {
        return "reversible-exchange";
    }
    if (source) {
        return "transformation-path";
    }
    return detail ? "transformation-path" : "unknown";
}
exports.normalizeTransformationSource = normalizeTransformationSource;
function transformationTargetIdFromEffects(effects) {
    const targetId = effects
        ?.map(effect => effect.transformation?.character?.id)
        .find((value) => typeof value === "number" && value > 0);
    return targetId?.toString();
}
function obtainabilityDetailsFromFyi(character) {
    const type = obtainabilityType(character);
    return {
        type,
        isFreeToPlay: type !== "summonable" && type !== "unknown",
        hasDirectAcquisitionDetails: false,
    };
}
exports.obtainabilityDetailsFromFyi = obtainabilityDetailsFromFyi;
function reversibleExchangeDetailsFromFyi(character, transformations = []) {
    if (!character.reversible_exchange_character_id) {
        return undefined;
    }
    const targetCharacterId = character.reversible_exchange_character_id.toString();
    const transformation = transformations.find(item => item.id === targetCharacterId);
    const condition = transformation?.transformationCondition
        ?? cleanMultilineText(character.active_skills?.[0]?.condition)
        ?? "";
    return {
        targetCharacterId,
        targetCharacterName: cleanInlineText(character.reversible_exchange_character?.name),
        condition,
        legacyText: condition,
    };
}
exports.reversibleExchangeDetailsFromFyi = reversibleExchangeDetailsFromFyi;
function exclusiveSkillOrbsFromFyi(orbs) {
    return (orbs ?? []).map(orb => ({
        id: orb.id.toString(),
        name: cleanInlineText(orb.name),
        description: cleanMultilineText(orb.description),
        grade: cleanInlineText(orb.grade),
        reusable: Boolean(orb.is_reusable),
        iconImageId: cleanInlineText(orb.img_id),
        iconURL: skillOrbIconUrl(orb.img_id),
        backgroundURL: skillOrbBackgroundUrl(orb.grade),
        skills: (orb.skills ?? []).map(skill => ({
            id: skill.id?.toString(),
            attribute: cleanInlineText(skill.attribute),
            level: skill.level ?? undefined,
            hiddenPotentialSkillId: skill.hidden_potential_skill_id ?? undefined,
        })),
        acquisition: skillOrbAcquisitionFromFyi(orb),
    }));
}
exports.exclusiveSkillOrbsFromFyi = exclusiveSkillOrbsFromFyi;
function finishSkillEffectKind(skill) {
    const hasTransformationTarget = Boolean(transformationTargetIdFromEffects(skill.effects));
    const description = cleanInlineText(skill.description).toLowerCase();
    const mentionsDamage = description.includes("damage");
    const mentionsBuff = /(ki \+\d|atk|def|guards|evad|reduction|effective against)/.test(description);
    if (hasTransformationTarget && (mentionsDamage || mentionsBuff)) {
        return "mixed";
    }
    if (hasTransformationTarget) {
        return "transform";
    }
    if (mentionsDamage && mentionsBuff) {
        return "mixed";
    }
    if (mentionsDamage) {
        return "damage";
    }
    if (mentionsBuff) {
        return "buff";
    }
    return "unknown";
}
function formatFinishSkillLegacyText(name, description, condition) {
    return [name, description, condition ? `Condition: ${condition}` : ""]
        .filter(Boolean)
        .join("\n");
}
function skillOrbAcquisitionFromFyi(orb) {
    const acquisition = [];
    if (orb.mission_reward) {
        acquisition.push({
            sourceType: "mission-reward",
            sourceName: "Mission Reward",
            missionId: orb.mission_reward.mission_id?.toString(),
            missionCategoryId: orb.mission_reward.mission_category_id?.toString(),
            bannerImageUrl: cleanInlineText(orb.mission_reward.mission_category?.img),
            quantity: orb.mission_reward.quantity ?? undefined,
        });
    }
    for (const shopItem of orb.shop_items ?? []) {
        acquisition.push({
            sourceType: "shop-item",
            sourceName: "Shop Item",
            shopItemId: shopItem.id?.toString(),
            price: shopItem.price ?? undefined,
            discountedPrice: shopItem.discounted_price ?? undefined,
            treasureItemId: shopItem.treasure_item_id?.toString(),
            treasureItemName: cleanInlineText(shopItem.treasure_item?.name),
            treasureItemDescription: cleanMultilineText(shopItem.treasure_item?.description),
            treasureItemImageSuffix: shopItem.treasure_item?.image_suffix ?? undefined,
            startsAt: cleanInlineText(shopItem.starts_at),
            endsAt: cleanInlineText(shopItem.ends_at),
            isIndefinite: shopItem.is_indefinite ?? undefined,
        });
    }
    return acquisition;
}
function obtainabilityType(character) {
    if (character.is_stage_drop_reward) {
        return "stage-reward";
    }
    if (character.is_world_tournament_reward) {
        return "world-tournament-reward";
    }
    if (character.is_freely_obtainable) {
        return "freely-obtainable";
    }
    return "summonable";
}
function skillOrbIconUrl(imgId) {
    const normalized = cleanInlineText(imgId);
    if (!normalized) {
        return undefined;
    }
    return `${DOKKAN_FYI_CDN_URL}/assets/en/item/equ_item_${normalized}.png`;
}
function skillOrbBackgroundUrl(grade) {
    const normalized = cleanInlineText(grade).toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (!["bronze", "silver", "gold"].includes(normalized)) {
        return undefined;
    }
    return `${DOKKAN_FYI_CDN_URL}/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_${normalized}.png`;
}
function extractPagePayload(html) {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }
    return JSON.parse(match[1]);
}
function shouldFetchDeferredTransformationPath(payload) {
    return Boolean(payload.deferredProps?.default?.includes("transformationPath"));
}
function browserHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}
async function readCachedFyiPage(path, ttlMs) {
    try {
        const cached = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
        const fetchedAt = Date.parse(cached.fetchedAt ?? "");
        if (!cached.payload?.props?.character || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ttlMs) {
            return undefined;
        }
        return cached;
    }
    catch {
        return undefined;
    }
}
async function readCachedMappedCharacter(path, ttlMs) {
    try {
        const cached = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
        const fetchedAt = Date.parse(cached.fetchedAt ?? "");
        if (!cached.character
            || cached.mappingVersion !== DOKKAN_FYI_MAPPED_CHARACTER_CACHE_VERSION
            || !Number.isFinite(fetchedAt)
            || Date.now() - fetchedAt > ttlMs) {
            return undefined;
        }
        return cached.character;
    }
    catch {
        return undefined;
    }
}
async function writeCachedMappedCharacter(path, character) {
    await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
    await (0, promises_1.writeFile)(path, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        mappingVersion: DOKKAN_FYI_MAPPED_CHARACTER_CACHE_VERSION,
        character,
    }), "utf8");
}
async function fetchDokkanFyiResponse(url, init, label, retries = requestedCharacterRetries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestedCharacterTimeoutMs());
    let response;
    try {
        try {
            response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });
        }
        catch (error) {
            if (retries > 0) {
                await delay(retryDelayMs(retries));
                return fetchDokkanFyiResponse(url, init, label, retries - 1);
            }
            throw error;
        }
        if (!response.ok) {
            if (retries > 0 && isRetryableStatus(response.status)) {
                await delay(retryDelayMs(retries));
                return fetchDokkanFyiResponse(url, init, label, retries - 1);
            }
            throw new Error(`Could not fetch dokkan.fyi ${label}: ${response.status}`);
        }
        return response;
    }
    finally {
        clearTimeout(timeout);
    }
}
function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}
function retryDelayMs(retriesRemaining) {
    return (4 - retriesRemaining) * 1500;
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function requestedCharacterConcurrency() {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CONCURRENCY", 4);
}
function requestedCharacterRetries() {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_RETRIES", 3);
}
function requestedCharacterTimeoutMs() {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_TIMEOUT_MS", 30000);
}
function cacheTtlMsFromEnvironment() {
    return positiveIntegerFromEnvironment("DOKKAN_FYI_CHARACTER_CACHE_TTL_HOURS", 24) * 60 * 60 * 1000;
}
function positiveIntegerFromEnvironment(name, fallback) {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) {
                return;
            }
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function defaultDokkanFyiCharacterIds() {
    const ids = (process.env.DOKKAN_FYI_CHARACTER_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);
    return ids.length ? ids : exports.DEFAULT_DOKKAN_FYI_EXPERIMENT_CHARACTER_IDS;
}
function rarityFromText(value) {
    const normalized = cleanInlineText(value).toUpperCase();
    switch (normalized) {
        case "LR":
            return character_1.Rarities.LR;
        case "UR":
            return character_1.Rarities.UR;
        case "SSR":
            return character_1.Rarities.SSR;
        case "SR":
            return character_1.Rarities.SR;
        case "R":
            return character_1.Rarities.R;
        default:
            return character_1.Rarities.N;
    }
}
function typeFromText(value) {
    const normalized = cleanInlineText(value).toUpperCase();
    switch (normalized) {
        case "PHY":
            return character_1.Types.PHY;
        case "STR":
            return character_1.Types.STR;
        case "INT":
            return character_1.Types.INT;
        case "TEQ":
            return character_1.Types.TEQ;
        default:
            return character_1.Types.AGL;
    }
}
function classFromAwakeningType(value) {
    return cleanInlineText(value).toLowerCase() === "extreme"
        ? character_1.Classes.Extreme
        : character_1.Classes.Super;
}
function portraitUrl(thumbnailId) {
    return `${DOKKAN_FYI_CDN_URL}/assets/en/character/thumb/card_${thumbnailId}_thumb/card_${thumbnailId}_thumb.png`;
}
function cardArtUrl(thumbnailId) {
    return `${DOKKAN_FYI_CDN_URL}/assets/en/character/card/${thumbnailId}/card_${thumbnailId}_cutin.png`;
}
function portraitSpecFromCharacter(character) {
    return {
        iconId: character.thumbnail_id,
        frameColorId: typeFrameColorId(typeFromText(character.type_text)),
        rarity: rarityFromText(character.rarity_text),
        elementCode: typeElementCode(typeFromText(character.type_text)),
    };
}
function typeFrameColorId(type) {
    switch (type) {
        case character_1.Types.AGL:
            return 0;
        case character_1.Types.TEQ:
            return 1;
        case character_1.Types.INT:
            return 2;
        case character_1.Types.STR:
            return 3;
        case character_1.Types.PHY:
            return 4;
        default:
            return 0;
    }
}
function typeElementCode(type) {
    switch (type) {
        case character_1.Types.AGL:
            return "10";
        case character_1.Types.TEQ:
            return "11";
        case character_1.Types.INT:
            return "12";
        case character_1.Types.STR:
            return "13";
        case character_1.Types.PHY:
            return "14";
        default:
            return "10";
    }
}
function attackType(value) {
    const normalized = cleanInlineText(value).toLowerCase();
    if (normalized.includes("ki blast")) {
        return character_1.AttackTypes.KiBlast;
    }
    if (normalized.includes("unarmed")) {
        return character_1.AttackTypes.Unarmed;
    }
    if (normalized.includes("physical") || normalized.includes("armed")) {
        return character_1.AttackTypes.Armed;
    }
    return character_1.AttackTypes.Other;
}
function summonableLabel(character) {
    if (character.is_stage_drop_reward) {
        return "Stage Reward";
    }
    if (character.is_world_tournament_reward) {
        return "World Tournament Reward";
    }
    if (character.is_freely_obtainable) {
        return "Freely Obtainable";
    }
    return "Summonable";
}
function isSummonable(character) {
    return !character.is_freely_obtainable && !character.is_stage_drop_reward && !character.is_world_tournament_reward;
}
function currentBaseStat(value) {
    return toNumber(value?.base);
}
function currentMaxStat(value, latestType) {
    if (!value) {
        return 0;
    }
    if (latestType !== "initial") {
        return toNumber(value.eza);
    }
    return toNumber(value.max);
}
exports.currentMaxStat = currentMaxStat;
function kiMeterText(kiMultipliers) {
    if (!kiMultipliers) {
        return [];
    }
    return Object.entries(kiMultipliers)
        .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
        .map(([ki, percent]) => `${ki} Ki: ${percent}%`);
}
function kiMultiplierText(kiMultipliers) {
    if (!kiMultipliers) {
        return "";
    }
    return Object.entries(kiMultipliers)
        .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
        .map(([ki, percent]) => `${ki} Ki ${percent}%`)
        .join("; ");
}
function kiMultiplierExtraInfo(kiMultipliers) {
    if (!kiMultipliers) {
        return undefined;
    }
    return {
        kiMultiplierText: kiMultiplierText(kiMultipliers),
        kiMultiplierSteps: Object.entries(kiMultipliers)
            .sort((left, right) => parseInt(left[0], 10) - parseInt(right[0], 10))
            .map(([ki, percent]) => ({
            ki: parseInt(ki, 10),
            percent: toNumber(percent),
        })),
    };
}
function formatSkillDescription(skill) {
    if (!skill) {
        return "";
    }
    return cleanMultilineText(skill.description);
}
function formatActiveSkill(skill) {
    if (!skill) {
        return "";
    }
    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    return [name, description].filter(Boolean).join(": ");
}
function activeSkillDetailsFromFyi(skills, sourceVersion) {
    const seenIds = new Set();
    const details = (skills ?? []).flatMap(skill => {
        const id = skill.id?.toString();
        if (!id)
            return [];
        if (seenIds.has(id))
            return [];
        seenIds.add(id);
        const seenEffectIds = new Set();
        return [{
                id,
                name: cleanInlineText(skill.name),
                description: cleanMultilineText(skill.description),
                condition: cleanMultilineText(skill.condition) || undefined,
                effects: (skill.effects ?? []).flatMap(effect => {
                    const effectId = effect.id?.toString();
                    if (!effectId)
                        return [];
                    if (seenEffectIds.has(effectId))
                        return [];
                    seenEffectIds.add(effectId);
                    return [{
                            id: effectId,
                            efficacyType: effect.type,
                            targetType: effect.target,
                            calculationOption: effect.calculation ?? undefined,
                            turns: effect.turns ?? undefined,
                            chance: effect.chance ?? undefined,
                            valuesJson: effect.values === undefined ? undefined : JSON.stringify(effect.values),
                        }];
                }),
                source: {
                    kind: "dokkan_fyi_payload",
                    sourceVersion,
                    payloadField: "props.character.active_skills",
                },
            }];
    });
    return details.length > 0 ? details : undefined;
}
function formatStandbySkill(skill) {
    if (!skill) {
        return "";
    }
    const name = cleanInlineText(skill.name);
    const description = cleanMultilineText(skill.description);
    return [name, description].filter(Boolean).join(": ");
}
function formatSuperAttack(superAttack) {
    if (!superAttack) {
        return "";
    }
    const name = cleanInlineText(superAttack.name);
    const description = cleanMultilineText(superAttack.description);
    return [name, description].filter(Boolean).join(": ");
}
function formatSuperAttackEffect(superAttack) {
    return cleanMultilineText(superAttack?.description);
}
function releaseDate(value) {
    if (!value) {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString();
}
function cleanMultilineText(value) {
    if (!value) {
        return "";
    }
    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
function cleanInlineText(value) {
    return cleanMultilineText(value).replace(/\s*\n\s*/g, " ").trim();
}
function toNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
//# sourceMappingURL=fyi-scraper.js.map