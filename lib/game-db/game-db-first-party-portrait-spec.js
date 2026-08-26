"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlayFirstPartyPortraitSpecs = exports.normalizeOfficialPortraitElement = void 0;
const character_1 = require("../character");
const game_db_source_1 = require("./game-db-source");
const portrait_asset_contract_1 = require("./portrait-asset-contract");
function rarityFromDb(value, cardId) {
    switch ((0, game_db_source_1.parseDbInt)(value)) {
        case 0: return character_1.Rarities.N;
        case 1: return character_1.Rarities.R;
        case 2: return character_1.Rarities.SR;
        case 3: return character_1.Rarities.SSR;
        case 4: return character_1.Rarities.UR;
        case 5: return character_1.Rarities.LR;
        default: throw new Error(`card ${cardId} has an unsupported official rarity`);
    }
}
function normalizeOfficialPortraitElement(value, cardId) {
    try {
        return (0, portrait_asset_contract_1.normalizePortraitElementCode)(value ?? "", `card ${cardId}`);
    }
    catch {
        throw new Error(`card ${cardId} has an unsupported official element`);
    }
}
exports.normalizeOfficialPortraitElement = normalizeOfficialPortraitElement;
function buildOfficialPortraitCards(rows) {
    const cards = new Map();
    for (const row of rows) {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!id || !/^\d+$/.test(id))
            throw new Error("cards.csv contains an invalid portrait card ID");
        if (cards.has(id))
            throw new Error(`cards.csv contains duplicate portrait card ${id}`);
        const rarity = rarityFromDb(row.rarity, id);
        const elementCode = normalizeOfficialPortraitElement(row.element, id);
        const resourceId = (0, game_db_source_1.normalizeDbId)(row.resource_id);
        cards.set(id, {
            id,
            rarity,
            elementCode,
            resourceId,
            portraitSpec: (0, portrait_asset_contract_1.portraitSpecFromOfficialCard)(id, rarity, elementCode, resourceId),
        });
    }
    return cards;
}
function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
}
function stripPortraitSpecs(value) {
    if (Array.isArray(value))
        return value.map(stripPortraitSpecs);
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        output[key] = key === "portraitSpec" ? "<portrait-spec>" : stripPortraitSpecs(nested);
    }
    return output;
}
function typedRarity(reference) {
    return "rarity" in reference ? reference.rarity : undefined;
}
function overlayFirstPartyPortraitSpecs(input, officialCardRows) {
    const officialCards = buildOfficialPortraitCards(officialCardRows);
    const characters = jsonClone(input);
    const seenCardIds = new Set();
    const changedCardIds = new Set();
    const assetIds = new Set();
    let referenceCount = 0;
    let changedReferenceCount = 0;
    const apply = (reference) => {
        referenceCount += 1;
        const official = officialCards.get(reference.id);
        if (!official)
            throw new Error(`portrait reference ${reference.id} is missing from official cards.csv`);
        const rarity = typedRarity(reference);
        if (rarity !== undefined && rarity !== official.rarity) {
            throw new Error(`portrait reference ${reference.id} rarity ${rarity} diverges from official ${official.rarity}`);
        }
        seenCardIds.add(reference.id);
        assetIds.add(official.portraitSpec.iconId);
        if (JSON.stringify(reference.portraitSpec) !== JSON.stringify(official.portraitSpec)) {
            changedReferenceCount += 1;
            changedCardIds.add(reference.id);
        }
        reference.portraitSpec = jsonClone(official.portraitSpec);
    };
    for (const character of characters) {
        apply(character);
        for (const transformation of character.transformations ?? [])
            apply(transformation);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ])
            apply(awakening);
    }
    if (JSON.stringify(stripPortraitSpecs(input)) !== JSON.stringify(stripPortraitSpecs(characters))) {
        throw new Error("first-party portrait overlay changed non-portrait data");
    }
    const visualClassCounts = { classless: 0, super: 0, extreme: 0 };
    for (const id of seenCardIds) {
        const classDigit = officialCards.get(id)?.elementCode[0];
        if (classDigit === "0")
            visualClassCounts.classless += 1;
        else if (classDigit === "1")
            visualClassCounts.super += 1;
        else if (classDigit === "2")
            visualClassCounts.extreme += 1;
        else
            throw new Error(`portrait reference ${id} has an unsupported visual class`);
    }
    return {
        characters,
        report: {
            referenceCount,
            uniqueCardCount: seenCardIds.size,
            uniqueAssetCount: assetIds.size,
            officialResourceCardCount: [...seenCardIds]
                .filter((id) => officialCards.get(id)?.resourceId !== undefined)
                .length,
            changedReferenceCount,
            changedCardCount: changedCardIds.size,
            changedCardIds: [...changedCardIds].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
            visualClassCounts,
            checks: {
                everyReferenceJoinedByExactCardId: true,
                everyReferenceUsesOfficialElement: true,
                everyReferenceUsesOfficialResourceId: true,
                everyTypedRarityMatchesOfficialDb: true,
                nonPortraitDataUnchanged: true,
            },
        },
    };
}
exports.overlayFirstPartyPortraitSpecs = overlayFirstPartyPortraitSpecs;
//# sourceMappingURL=game-db-first-party-portrait-spec.js.map