import { Classes, Rarities, Types } from "./character";
import { TeamContextCharacterRef, TeamContextSupportMemoryRef } from "./team-context";

export interface CategoryRosterDataset {
    generatedAt: string,
    source: "dokkan.fyi",
    categoryCount: number,
    memberCharacterCount: number,
    categories: CategoryRosterEntry[],
}

export interface CategoryRosterEntry {
    id: string,
    name: string,
    memberCount: number,
    leaderCount: number,
    supportUnitCount: number,
    supportMemoryCount: number,
    leaders: TeamContextCharacterRef[],
    supportUnits: TeamContextCharacterRef[],
    supportMemories: TeamContextSupportMemoryRef[],
    members: CategoryRosterMemberEntry[],
}

export interface CategoryRosterMemberEntry {
    id: string,
    name: string,
    title?: string,
    rarity?: Rarities,
    type?: Types,
    characterClass?: Classes,
    portraitUrl?: string,
    portraitFilename?: string,
    latestReleaseType: string,
    hasEza: boolean,
    hasSeza: boolean,
    isLeader: boolean,
    isSupportUnit: boolean,
    isReversiblyExchanged: boolean,
    isFreelyObtainable: boolean,
}
