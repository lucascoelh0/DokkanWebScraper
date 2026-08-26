"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOKKAN_INFO_ASSET_BASE_URL = exports.portraitSpecFromTypeAndClass = exports.portraitSpecFromOfficialCard = exports.portraitSpecFromElement = exports.cardArtUrlFromCardId = exports.normalizePortraitElementCode = exports.portraitOutputUrl = exports.assertPortraitFilename = exports.normalizeAssetId = void 0;
const character_1 = require("../character");
const DOKKAN_INFO_ASSET_BASE_URL = "https://dokkaninfo.com/assets/global/en";
exports.DOKKAN_INFO_ASSET_BASE_URL = DOKKAN_INFO_ASSET_BASE_URL;
function normalizeAssetId(cardId) {
    return Math.floor(cardId / 10) * 10;
}
exports.normalizeAssetId = normalizeAssetId;
function assertPortraitFilename(portraitFilename) {
    if (typeof portraitFilename !== "string"
        || portraitFilename.length > 64
        || !/^portrait_[0-9]+$/.test(portraitFilename)) {
        throw new Error("Portrait filename must use the canonical portrait_<numeric-id> form");
    }
}
exports.assertPortraitFilename = assertPortraitFilename;
function portraitOutputUrl(portraitFilename) {
    assertPortraitFilename(portraitFilename);
    return `images/${portraitFilename}.png`;
}
exports.portraitOutputUrl = portraitOutputUrl;
function normalizePortraitElementCode(element, context = "portrait") {
    const trimmed = element.trim();
    if (!/^\d{1,2}$/.test(trimmed))
        throw new Error(`${context} has an unsupported element code`);
    const parsed = Number.parseInt(trimmed, 10);
    const classDigit = Math.floor(parsed / 10);
    const typeDigit = parsed % 10;
    if (parsed < 0 || parsed > 24 || classDigit > 2 || typeDigit > 4) {
        throw new Error(`${context} has an unsupported element code`);
    }
    return String(parsed).padStart(2, "0");
}
exports.normalizePortraitElementCode = normalizePortraitElementCode;
function cardArtUrlFromCardId(cardId) {
    const assetId = normalizeAssetId(typeof cardId === "string" ? parseInt(cardId, 10) : cardId);
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${assetId}.png`;
}
exports.cardArtUrlFromCardId = cardArtUrlFromCardId;
function portraitSpecFromElement(cardId, rarity, element) {
    return portraitSpecFromOfficialCard(cardId, rarity, element);
}
exports.portraitSpecFromElement = portraitSpecFromElement;
function portraitSpecFromOfficialCard(cardId, rarity, element, resourceId) {
    const rawCardId = typeof cardId === "string" ? cardId.trim() : String(cardId);
    if (!/^\d+$/.test(rawCardId))
        throw new Error("portrait has an invalid card ID");
    const numericCardId = Number.parseInt(rawCardId, 10);
    if (!Number.isSafeInteger(numericCardId))
        throw new Error("portrait has an invalid card ID");
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
exports.portraitSpecFromOfficialCard = portraitSpecFromOfficialCard;
function portraitSpecFromTypeAndClass(cardId, rarity, typeDigit, characterClass) {
    const classDigit = characterClass === character_1.Classes.Extreme ? 2 : characterClass === character_1.Classes.Super ? 1 : 0;
    return portraitSpecFromElement(cardId, rarity, `${classDigit}${typeDigit}`);
}
exports.portraitSpecFromTypeAndClass = portraitSpecFromTypeAndClass;
//# sourceMappingURL=portrait-asset-contract.js.map