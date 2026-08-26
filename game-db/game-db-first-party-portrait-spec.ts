import type { AwakeningReference, Character, PortraitSpec, Transformation } from "../character";
import { Rarities } from "../character";
import type { GameDbRow } from "./game-db-source";
import { normalizeDbId, parseDbInt } from "./game-db-source";
import { normalizePortraitElementCode, portraitSpecFromOfficialCard } from "./portrait-asset-contract";

interface OfficialPortraitCard {
    id: string,
    rarity: Rarities,
    elementCode: string,
    resourceId?: string,
    portraitSpec: PortraitSpec,
}

export interface FirstPartyPortraitSpecOverlayReport {
    referenceCount: number,
    uniqueCardCount: number,
    uniqueAssetCount: number,
    officialResourceCardCount: number,
    changedReferenceCount: number,
    changedCardCount: number,
    changedCardIds: string[],
    visualClassCounts: {
        classless: number,
        super: number,
        extreme: number,
    },
    checks: {
        everyReferenceJoinedByExactCardId: true,
        everyReferenceUsesOfficialElement: true,
        everyReferenceUsesOfficialResourceId: true,
        everyTypedRarityMatchesOfficialDb: true,
        nonPortraitDataUnchanged: true,
    },
}

export interface FirstPartyPortraitSpecOverlayResult {
    characters: Character[],
    report: FirstPartyPortraitSpecOverlayReport,
}

function rarityFromDb(value: string | undefined, cardId: string): Rarities {
    switch (parseDbInt(value)) {
        case 0: return Rarities.N;
        case 1: return Rarities.R;
        case 2: return Rarities.SR;
        case 3: return Rarities.SSR;
        case 4: return Rarities.UR;
        case 5: return Rarities.LR;
        default: throw new Error(`card ${cardId} has an unsupported official rarity`);
    }
}

export function normalizeOfficialPortraitElement(value: string | undefined, cardId: string): string {
    try {
        return normalizePortraitElementCode(value ?? "", `card ${cardId}`);
    } catch {
        throw new Error(`card ${cardId} has an unsupported official element`);
    }
}

function buildOfficialPortraitCards(rows: GameDbRow[]): Map<string, OfficialPortraitCard> {
    const cards = new Map<string, OfficialPortraitCard>();
    for (const row of rows) {
        const id = normalizeDbId(row.id);
        if (!id || !/^\d+$/.test(id)) throw new Error("cards.csv contains an invalid portrait card ID");
        if (cards.has(id)) throw new Error(`cards.csv contains duplicate portrait card ${id}`);
        const rarity = rarityFromDb(row.rarity, id);
        const elementCode = normalizeOfficialPortraitElement(row.element, id);
        const resourceId = normalizeDbId(row.resource_id);
        cards.set(id, {
            id,
            rarity,
            elementCode,
            resourceId,
            portraitSpec: portraitSpecFromOfficialCard(id, rarity, elementCode, resourceId),
        });
    }
    return cards;
}

function jsonClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function stripPortraitSpecs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripPortraitSpecs);
    if (!value || typeof value !== "object") return value;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        output[key] = key === "portraitSpec" ? "<portrait-spec>" : stripPortraitSpecs(nested);
    }
    return output;
}

type PortraitReference = Character | Transformation | AwakeningReference;

function typedRarity(reference: PortraitReference): Rarities | undefined {
    return "rarity" in reference ? reference.rarity : undefined;
}

export function overlayFirstPartyPortraitSpecs(
    input: Character[],
    officialCardRows: GameDbRow[],
): FirstPartyPortraitSpecOverlayResult {
    const officialCards = buildOfficialPortraitCards(officialCardRows);
    const characters = jsonClone(input);
    const seenCardIds = new Set<string>();
    const changedCardIds = new Set<string>();
    const assetIds = new Set<number>();
    let referenceCount = 0;
    let changedReferenceCount = 0;

    const apply = (reference: PortraitReference) => {
        referenceCount += 1;
        const official = officialCards.get(reference.id);
        if (!official) throw new Error(`portrait reference ${reference.id} is missing from official cards.csv`);
        const rarity = typedRarity(reference);
        if (rarity !== undefined && rarity !== official.rarity) {
            throw new Error(
                `portrait reference ${reference.id} rarity ${rarity} diverges from official ${official.rarity}`,
            );
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
        for (const transformation of character.transformations ?? []) apply(transformation);
        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) apply(awakening);
    }

    if (JSON.stringify(stripPortraitSpecs(input)) !== JSON.stringify(stripPortraitSpecs(characters))) {
        throw new Error("first-party portrait overlay changed non-portrait data");
    }

    const visualClassCounts = { classless: 0, super: 0, extreme: 0 };
    for (const id of seenCardIds) {
        const classDigit = officialCards.get(id)?.elementCode[0];
        if (classDigit === "0") visualClassCounts.classless += 1;
        else if (classDigit === "1") visualClassCounts.super += 1;
        else if (classDigit === "2") visualClassCounts.extreme += 1;
        else throw new Error(`portrait reference ${id} has an unsupported visual class`);
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
