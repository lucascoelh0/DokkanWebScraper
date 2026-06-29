"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStableRewardItemKey = exports.resolveStableRewardItemId = void 0;
function resolveStableRewardItemId(input) {
    return input.itemId || input.cardId || input.bgmId;
}
exports.resolveStableRewardItemId = resolveStableRewardItemId;
function buildStableRewardItemKey(input) {
    const itemType = input.itemType;
    const stableItemId = resolveStableRewardItemId(input);
    if (!itemType || !stableItemId) {
        return undefined;
    }
    if (itemType !== "CardSkinItem") {
        return `${itemType}:${stableItemId}`;
    }
    const parts = [
        itemType,
        stableItemId,
        input.cardId,
        input.step?.toString(),
        input.bgmId,
        input.linkTo,
    ].filter(Boolean);
    return parts.join(":");
}
exports.buildStableRewardItemKey = buildStableRewardItemKey;
//# sourceMappingURL=reward-item-key.js.map