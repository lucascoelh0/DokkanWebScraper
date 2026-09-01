export interface PettanBattleDataset {
    schemaVersion: "1.0.0",
    generatedAt: string,
    sources: {
        catalog: "game-db",
        visuals: "dokkaninfo",
        visualIndexPath: string,
    },
    sourceDatabase: {
        fileName: string,
        sha256: string,
        sizeBytes: number,
        readOnly: true,
    },
    seriesCount: number,
    stickerCount: number,
    visualStickerCount: number,
    joinedStickerCount: number,
    audit: PettanBattleAudit,
    series: PettanBattleSeries[],
}

export interface PettanBattleSeries {
    id: string,
    name: string,
    sourcePath: string,
    binderImagePath?: string,
    stickerCount: number,
    stickers: PettanBattleSticker[],
}

export interface PettanBattleSticker {
    id: string,
    cardId: string,
    series: number,
    number: number,
    attack: number,
    hp: number,
    elementRaw: number,
    cardElementRaw: number,
    rarityRaw: number,
    description: string,
    availableAt: string,
    cardName: string,
    leaderSkillName?: string,
    visualSourcePath?: string,
    visual?: PettanBattleStickerVisual,
}

export interface PettanBattleStickerVisual {
    displayedPower: number,
    printedTypeLabel: string,
    rarityFrameRaw: number,
    front: {
        backgroundPath: string,
        characterPath: string,
        effectPath?: string,
        typeFramePath: string,
        rarityFramePath: string,
    },
    back: {
        backgroundPath: string,
        facePath: string,
        framePath: string,
    },
}

export interface PettanBattleAudit {
    officialOnlyStickerIds: string[],
    visualOnlyStickerIds: string[],
    mismatchCount: number,
    mismatches: Array<{
        stickerId: string,
        field: string,
        official: string | number,
        visual: string | number,
    }>,
    observedPrintedTypeLabels: Array<{
        elementRaw: number,
        cardElementRaw: number,
        printedTypeLabel: string,
    }>,
}

export interface PettanBattleOfficialStickerRow {
    id: number | string,
    card_id: number | string,
    attack: number | string,
    hp: number | string,
    element: number | string,
    rarity: number | string,
    series: number | string,
    number: number | string,
    description: string,
    open_at: string,
    card_name: string,
    card_element: number | string,
    leader_skill_name?: string | null,
}

export interface DokkanInfoPettanSeriesSummary {
    id: string,
    name: string,
    sourcePath: string,
    binderImagePath?: string,
    advertisedStickerCount: number,
}

export interface DokkanInfoPettanStickerVisual {
    cardId: string,
    series: number,
    number: number,
    displayedPower: number,
    printedTypeLabel: string,
    description: string,
    availableDate: string,
    cardName: string,
    leaderSkillName: string,
    rarityFrameRaw: number,
    sourcePath: string,
    front: PettanBattleStickerVisual["front"],
    back: PettanBattleStickerVisual["back"],
}

export interface PettanBattleOfficialPayload {
    stickers: PettanBattleOfficialStickerRow[],
}
