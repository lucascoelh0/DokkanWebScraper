export interface StableRewardItemKeyInput {
    itemType?: string,
    itemId?: string,
    cardId?: string,
    step?: number,
    linkTo?: string,
    bgmId?: string,
}

export function resolveStableRewardItemId(input: StableRewardItemKeyInput): string | undefined {
    return input.itemId || input.cardId || input.bgmId;
}

export function buildStableRewardItemKey(input: StableRewardItemKeyInput): string | undefined {
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
