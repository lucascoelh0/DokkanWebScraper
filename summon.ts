import { Classes, Rarities, Types } from "./character";

export interface SummonIndexDataset {
    generatedAt: string,
    source: string,
    activeOnly: boolean,
    categories: SummonCategoryFilter[],
    count: number,
    summons: SummonBannerSummary[],
}

export interface SummonDetailsDataset {
    generatedAt: string,
    source: string,
    activeOnly: boolean,
    count: number,
    summons: SummonBannerDetail[],
}

export interface SummonCategoryFilter {
    id: number,
    label: string,
}

export interface SummonBannerSummary {
    id: string,
    name: string,
    description: string,
    descriptionHtml?: string,
    category: string,
    startsAt?: string,
    endsAt?: string,
    bannerUrl?: string,
    isCurrentlyActive: boolean,
}

export interface SummonBannerDetail extends SummonBannerSummary {
    featuredCharacters: SummonFeaturedCharacter[],
    steps: SummonStep[],
}

export interface SummonFeaturedCharacter {
    id: string,
    canonicalId?: string,
    baseCharacterId?: string,
    name: string,
    rarity: Rarities,
    type: Types,
    characterClass: Classes,
    portraitUrl?: string,
    isNew: boolean,
    isDokkanFestFeatured: boolean,
    isCarnivalFeatured: boolean,
    entryType?: string,
}

export interface SummonStep {
    id: string,
    step: number,
    name: string,
    rates: SummonRate[],
}

export interface SummonRate {
    type: string,
    name: string,
    position?: number,
    amount?: number,
    rarities: SummonRateRarity[],
}

export interface SummonRateRarity {
    rarity: Rarities,
    totalAmount?: number,
    totalRate?: number,
    featuredAmount?: number,
    featuredRate?: number,
    normalAmount?: number,
    normalRate?: number,
}
