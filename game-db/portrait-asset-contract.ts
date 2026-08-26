import { Classes, PortraitSpec, Rarities } from "../character";

const DOKKAN_INFO_ASSET_BASE_URL = "https://dokkaninfo.com/assets/global/en";

export function normalizeAssetId(cardId: number): number {
    return Math.floor(cardId / 10) * 10;
}

export function assertPortraitFilename(portraitFilename: unknown): asserts portraitFilename is string {
    if (typeof portraitFilename !== "string"
        || portraitFilename.length > 64
        || !/^portrait_[0-9]+$/.test(portraitFilename)) {
        throw new Error("Portrait filename must use the canonical portrait_<numeric-id> form");
    }
}

export function portraitOutputUrl(portraitFilename: string): string {
    assertPortraitFilename(portraitFilename);
    return `images/${portraitFilename}.png`;
}

export function normalizePortraitElementCode(element: string, context = "portrait"): string {
    const trimmed = element.trim();
    if (!/^\d{1,2}$/.test(trimmed)) throw new Error(`${context} has an unsupported element code`);
    const parsed = Number.parseInt(trimmed, 10);
    const classDigit = Math.floor(parsed / 10);
    const typeDigit = parsed % 10;
    if (parsed < 0 || parsed > 24 || classDigit > 2 || typeDigit > 4) {
        throw new Error(`${context} has an unsupported element code`);
    }
    return String(parsed).padStart(2, "0");
}

export function cardArtUrlFromCardId(cardId: string | number): string {
    const assetId = normalizeAssetId(typeof cardId === "string" ? parseInt(cardId, 10) : cardId);
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${assetId}.png`;
}

export function portraitSpecFromElement(
    cardId: string | number,
    rarity: Rarities,
    element: string,
): PortraitSpec {
    return portraitSpecFromOfficialCard(cardId, rarity, element);
}

export function portraitSpecFromOfficialCard(
    cardId: string | number,
    rarity: Rarities,
    element: string,
    resourceId?: string | number,
): PortraitSpec {
    const rawCardId = typeof cardId === "string" ? cardId.trim() : String(cardId);
    if (!/^\d+$/.test(rawCardId)) throw new Error("portrait has an invalid card ID");
    const numericCardId = Number.parseInt(rawCardId, 10);
    if (!Number.isSafeInteger(numericCardId)) throw new Error("portrait has an invalid card ID");
    const rawResourceId = resourceId === undefined
        ? undefined
        : typeof resourceId === "string" ? resourceId.trim() : String(resourceId);
    if (rawResourceId !== undefined && !/^\d+$/.test(rawResourceId)) {
        throw new Error("portrait has an invalid official resource ID");
    }
    const numericResourceId = rawResourceId === undefined
        ? numericCardId
        : Number.parseInt(rawResourceId, 10);
    if (!Number.isSafeInteger(numericResourceId) || numericResourceId <= 0) {
        throw new Error("portrait has an invalid official resource ID");
    }
    const iconId = normalizeAssetId(numericResourceId);
    const normalizedElement = normalizePortraitElementCode(element);
    const typeDigit = parseInt(normalizedElement[normalizedElement.length - 1] ?? "0", 10);

    return {
        iconId,
        frameColorId: typeDigit,
        rarity,
        elementCode: normalizedElement,
    };
}

export function portraitSpecFromTypeAndClass(
    cardId: string | number,
    rarity: Rarities,
    typeDigit: number,
    characterClass: Classes | "None",
): PortraitSpec {
    const classDigit = characterClass === Classes.Extreme ? 2 : characterClass === Classes.Super ? 1 : 0;
    return portraitSpecFromElement(cardId, rarity, `${classDigit}${typeDigit}`);
}

export { DOKKAN_INFO_ASSET_BASE_URL };
