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

export function cardArtUrlFromCardId(cardId: string | number): string {
    const assetId = normalizeAssetId(typeof cardId === "string" ? parseInt(cardId, 10) : cardId);
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${assetId}.png`;
}

export function portraitSpecFromElement(
    cardId: string | number,
    rarity: Rarities,
    element: string,
): PortraitSpec {
    const numericCardId = typeof cardId === "string" ? parseInt(cardId, 10) : cardId;
    const normalizedElement = element.padStart(2, "0");
    const typeDigit = parseInt(normalizedElement[normalizedElement.length - 1] ?? "0", 10);

    return {
        iconId: normalizeAssetId(numericCardId),
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
