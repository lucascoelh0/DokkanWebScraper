import { Character } from "../character";
import { CharacterEvidenceStatus } from "./identity-contract";
import { CharacterComparisonState } from "./parity-contract";

export type CharacterShadowAuthority = "database_candidate" | "external_fallback" | "unsupported";
export type CharacterShadowComparison =
    | "agreement"
    | "representation_gain"
    | "representation_mismatch"
    | "confirmed_conflict"
    | "unjoinable"
    | "unknown"
    | "external_fallback";
export type CharacterShadowJoinStatus = "joined" | "unjoinable";
export type CharacterShadowSidecar = "k0" | "k1" | "k2" | "k7" | "production" | "fyi";

/** A product field or a shadow-only structural dimension related to that field. */
export type CharacterShadowField =
    | keyof Character
    | "characterId"
    | "stateId"
    | "releaseState"
    | "growthRowId"
    | "originalRarity"
    | "categoryIds"
    | "linkIds"
    | "linkLevels"
    | "awakeningGraph"
    | "releaseStateGraph"
    | "formGraph";

export interface CharacterShadowJoin {
    status: CharacterShadowJoinStatus;
    externalId: string | null;
    comparisonState: CharacterComparisonState;
}

export interface CharacterFieldProvenance {
    sidecar: CharacterShadowSidecar;
    sidecarSha256: string;
    sourceSnapshotVersion: string;
    table: string;
    rowId: string;
    column?: string;
    sourceState: {
        stateId: string;
        sourceStateKey: string;
        releaseState: "initial" | "eza" | "seza" | "unknown";
        growthRowId: string | null;
    } | null;
}

export interface CharacterExternalFieldValues {
    production: unknown;
    fyi: unknown;
}

export interface CharacterFieldProjection {
    cardId: string;
    characterId: string;
    stateId: string;
    releaseState: "initial" | "eza" | "seza" | "unknown";
    growthRowId: string | null;
    productionJoin: CharacterShadowJoin;
    fyiJoin: CharacterShadowJoin;
    field: CharacterShadowField;
    /** Null means the dimension is deliberately shadow-only and cannot patch Character. */
    characterField: keyof Character | null;
    databaseValue: unknown;
    externalValue: CharacterExternalFieldValues;
    /** Always the production value unless a supported, conflict-free patch is explicitly applied in memory. */
    effectiveShadowValue: unknown;
    evidenceStatus: CharacterEvidenceStatus;
    authority: CharacterShadowAuthority;
    comparison: CharacterShadowComparison;
    sourceComparisons: { production: CharacterShadowComparison; fyi: CharacterShadowComparison };
    provenance: CharacterFieldProvenance[];
    fallbackReason: string | null;
}

export interface CharacterShadowProjection {
    schemaVersion: 1;
    contract: "dokkan-database-character-field-shadow";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: {
        snapshotVersion: string;
        sidecars: Record<"k0" | "k1" | "k2" | "k7", { sha256: string; sizeBytes: number }>;
        productionCharacters: { sha256: string; sizeBytes: number; characterCount: number };
        fyiCharacters: { sha256: string; sizeBytes: number; characterCount: number; generatedAt: string };
    };
    policy: {
        structuralIdsOnly: true;
        nameTextOrNumericProximityInference: false;
        fieldScopedPatches: true;
        unsupportedDefaults: false;
        k7ValuesConsumed: false;
        productionModified: false;
        publisherEnabled: false;
        androidEnabled: false;
    };
    authorityMatrix: CharacterFieldAuthorityRule[];
    fields: CharacterFieldProjection[];
}

export interface CharacterFieldAuthorityRule {
    field: CharacterShadowField;
    characterField: keyof Character | null;
    owner: "k0" | "k1" | "k2" | "external";
    authority: CharacterShadowAuthority;
    note: string;
}

const candidate = (field: CharacterShadowField, characterField: keyof Character | null, owner: "k0" | "k1" | "k2", note: string): CharacterFieldAuthorityRule =>
    ({ field, characterField, owner, authority: "database_candidate", note });
const external = (field: keyof Character, note: string): CharacterFieldAuthorityRule =>
    ({ field, characterField: field, owner: "external", authority: "external_fallback", note });

/** K10 authority is explicit and does not itself promote any field. */
export const CHARACTER_FIELD_AUTHORITY_MATRIX: CharacterFieldAuthorityRule[] = [
    candidate("id", "id", "k0", "cards.id is the structural product join"),
    candidate("characterId", null, "k0", "characters.id remains distinct from card identity"),
    candidate("stateId", null, "k0", "state identity is card plus initial or growth row"),
    candidate("releaseState", null, "k0", "release state is selected only through K7 comparisonState"),
    candidate("growthRowId", null, "k0", "growth provenance is never inferred"),
    candidate("rarity", "rarity", "k2", "current rarity and original rarity are distinct dimensions"),
    candidate("originalRarity", null, "k2", "shadow-only structural Z-route roots"),
    candidate("type", "type", "k2", "first-party card type"),
    candidate("characterClass", "characterClass", "k2", "unawakened is not coerced to a product class"),
    candidate("name", "name", "k2", "Global snapshot default presentation only"),
    candidate("title", "title", "k2", "Global snapshot default card presentation only"),
    candidate("categoryIds", "categories", "k2", "stable first-party IDs; labels remain separately comparable"),
    candidate("categories", "categories", "k2", "Global snapshot default labels with external locale fallback"),
    candidate("linkIds", "links", "k2", "stable first-party IDs in first-party slot order"),
    candidate("links", "links", "k2", "Global snapshot default labels; ordering is measured, not chosen"),
    candidate("linkLevels", "links", "k2", "level rows are retained as structural enrichment"),
    candidate("awakeningGraph", "awakeningCards", "k1", "structural graph only; no aliases or UI grouping inference"),
    candidate("releaseStateGraph", null, "k1", "release progression remains separate from Character"),
    candidate("formGraph", "transformations", "k1", "structural graph only; conditions and text remain external"),
    external("releaseDate", "release schedules remain external/server-owned"),
    external("ezaReleaseDate", "release schedules remain external/server-owned"),
    external("sezaReleaseDate", "release schedules remain external/server-owned"),
    external("summonable", "dynamic acquisition is outside K0-K2"),
    external("isSummonable", "dynamic acquisition is outside K0-K2"),
    external("isFreeToPlay", "F2P classification is outside K0-K2"),
    external("obtainability", "obtainability is outside K0-K2"),
    external("maxLevel", "caps are outside K0-K2 and K7 conflicts remain evidence only"),
    external("maxSALevel", "caps are outside K0-K2 and K7 conflicts remain evidence only"),
    external("cost", "stats and costs are outside K0-K2"),
    external("legacyId", "legacy aliases are not first-party structural identity"),
    external("portraitURL", "asset roles and delivery are unproved"),
    external("portraitFilename", "asset roles and delivery are unproved"),
    external("portraitSpec", "asset roles and delivery are unproved"),
    external("leaderSkill", "skill presentation and semantics are outside K0-K2"),
    external("ezaLeaderSkill", "skill presentation and semantics are outside K0-K2"),
    external("leaderSkillBoost", "skill presentation and semantics are outside K0-K2"),
    external("leaderSkillDetails", "skill presentation and semantics are outside K0-K2"),
    external("ezaLeaderSkillDetails", "skill presentation and semantics are outside K0-K2"),
    external("superAttack", "skill presentation and semantics are outside K0-K2"),
    external("ezaSuperAttack", "skill presentation and semantics are outside K0-K2"),
    external("ultraSuperAttack", "skill presentation and semantics are outside K0-K2"),
    external("ezaUltraSuperAttack", "skill presentation and semantics are outside K0-K2"),
    external("exSuperAttack", "skill presentation and semantics are outside K0-K2"),
    external("ezaExSuperAttack", "skill presentation and semantics are outside K0-K2"),
    external("unitSuperAttacks", "skill presentation and semantics are outside K0-K2"),
    external("passive", "skill presentation and semantics are outside K0-K2"),
    external("passiveDetails", "skill presentation and semantics are outside K0-K2"),
    external("ezaPassive", "skill presentation and semantics are outside K0-K2"),
    external("ezaPassiveDetails", "skill presentation and semantics are outside K0-K2"),
    external("sezaPassive", "skill presentation and semantics are outside K0-K2"),
    external("activeSkill", "skill presentation and semantics are outside K0-K2"),
    external("activeSkillCondition", "conditions and localized text remain external"),
    external("ezaActiveSkill", "skill presentation and semantics are outside K0-K2"),
    external("ezaActiveSkillCondition", "conditions and localized text remain external"),
    external("transformationCondition", "conditions and localized text remain external"),
    external("domain", "skill presentation and semantics are outside K0-K2"),
    external("kiMeter", "stats and presentation are outside K0-K2"),
    external("artURL", "asset roles and delivery are unproved"),
    external("artFilename", "asset roles and delivery are unproved"),
    external("baseHP", "stats are outside K0-K2"),
    external("maxLevelHP", "stats are outside K0-K2"),
    external("freeDupeHP", "stats are outside K0-K2"),
    external("rainbowHP", "stats are outside K0-K2"),
    external("baseAttack", "stats are outside K0-K2"),
    external("maxLevelAttack", "stats are outside K0-K2"),
    external("freeDupeAttack", "stats are outside K0-K2"),
    external("rainbowAttack", "stats are outside K0-K2"),
    external("baseDefence", "stats are outside K0-K2"),
    external("maxDefence", "stats are outside K0-K2"),
    external("freeDupeDefence", "stats are outside K0-K2"),
    external("rainbowDefence", "stats are outside K0-K2"),
    external("kiMultiplier", "stats and presentation are outside K0-K2"),
    external("extraInfo", "stats and presentation are outside K0-K2"),
    external("superAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("ezaSuperAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("ultraSuperAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("ezaUltraSuperAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("exSuperAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("ezaExSuperAttackDetails", "skill presentation and semantics are outside K0-K2"),
    external("standbySkill", "standby details and text are outside K0-K2"),
    external("finishingMove", "finish details and text are outside K0-K2"),
    external("standby", "standby details and text are outside K0-K2"),
    external("finishSkills", "finish details and text are outside K0-K2"),
    external("reversibleExchange", "conditions and presentation remain external"),
    external("exclusiveSkillOrbs", "equipment is outside K0-K2"),
    external("equipment", "equipment is outside K0-K2"),
    external("dokkanFrontierPassives", "external enrichment remains external"),
    external("dokkanFrontierGroupPassive", "external enrichment remains external"),
    external("dokkanFrontierCharacterPassive", "external enrichment remains external"),
];

export interface CharacterShadowManifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    generatedAt: string;
    fileName: "database-characters-k11-shadow-projection.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    fieldProjectionCount: number;
    productionPatchableCardCount: number;
    coverageFile: "database-characters-k12-shadow-coverage.json";
    coverageSha256: string;
    coverageSizeBytes: number;
    validationFile: "database-characters-k13-shadow-validation.json";
    validationSha256: string;
    validationSizeBytes: number;
    readinessFile: "database-characters-k14-readiness.json";
    readinessSha256: string;
    readinessSizeBytes: number;
}
