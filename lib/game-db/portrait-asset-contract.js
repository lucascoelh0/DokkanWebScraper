"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOKKAN_INFO_ASSET_BASE_URL = exports.portraitSpecFromTypeAndClass = exports.portraitSpecFromElement = exports.cardArtUrlFromCardId = exports.portraitOutputUrl = exports.assertPortraitFilename = exports.normalizeAssetId = void 0;
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
function cardArtUrlFromCardId(cardId) {
    const assetId = normalizeAssetId(typeof cardId === "string" ? parseInt(cardId, 10) : cardId);
    return `${DOKKAN_INFO_ASSET_BASE_URL}/character/card/${assetId}/${assetId}.png`;
}
exports.cardArtUrlFromCardId = cardArtUrlFromCardId;
function portraitSpecFromElement(cardId, rarity, element) {
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
exports.portraitSpecFromElement = portraitSpecFromElement;
function portraitSpecFromTypeAndClass(cardId, rarity, typeDigit, characterClass) {
    const classDigit = characterClass === character_1.Classes.Extreme ? 2 : characterClass === character_1.Classes.Super ? 1 : 0;
    return portraitSpecFromElement(cardId, rarity, `${classDigit}${typeDigit}`);
}
exports.portraitSpecFromTypeAndClass = portraitSpecFromTypeAndClass;
//# sourceMappingURL=portrait-asset-contract.js.map