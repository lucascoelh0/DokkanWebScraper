import { DatabaseSkillState, SourcedRow } from "../database-experiment/contract";
import { IntegrationC2Rule } from "../database-integration/integration-c2-contract";

export interface CharacterSkillRowRef { table: string; rowId: string }
export interface CharacterStateSkills {
    stateId: string;
    sourceStateKey: string;
    cardId: string;
    releaseState: DatabaseSkillState["releaseState"];
    release: { availableAt: string | null; availableAtSnapshot: boolean | null; routes: CharacterSkillRowRef[] };
    growthStep?: CharacterSkillRowRef;
    growthStepNumber?: number;
    maxLevel: number | null;
    maxSuperAttackLevel: number | null;
    leaderSkill?: { set: CharacterSkillRowRef; effects: CharacterSkillRowRef[]; targetRows: CharacterSkillRowRef[]; structuredPercentValues: number[] };
    passiveSkill?: { set: CharacterSkillRowRef; relations: Array<{ relation: CharacterSkillRowRef; skill?: CharacterSkillRowRef; effect?: CharacterSkillRowRef; causalities: CharacterSkillRowRef[] }> };
    attacks: Array<{ cardSpecial: CharacterSkillRowRef; specialSet?: CharacterSkillRowRef; effects: CharacterSkillRowRef[]; extraOption?: CharacterSkillRowRef; variant: DatabaseSkillState["attacks"][number]["variant"]; availableFromSuperAttackLevel: number | null }>;
}

export interface CharacterActionSkills {
    cardId: string;
    activeSkills: Array<{ relation: CharacterSkillRowRef; set?: CharacterSkillRowRef; effects: CharacterSkillRowRef[] }>;
    standbySkills: Array<{ relation: CharacterSkillRowRef; set?: CharacterSkillRowRef; effects: CharacterSkillRowRef[]; finishSkillSetIds: string[] }>;
    finishSkills: Array<{ relation?: CharacterSkillRowRef; set?: CharacterSkillRowRef; effects: CharacterSkillRowRef[]; standbySkillSetIds: string[] }>;
}

export interface CharacterSupportedMechanic extends IntegrationC2Rule {
    stateId: string;
    sourceTeamAnalysisStateKey: string;
    sourceReleaseState: DatabaseSkillState["releaseState"];
}

export interface DatabaseCharacterSkillsDataset {
    schemaVersion: 1;
    contract: "dokkan-database-characters-skills";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: {
        snapshotVersion: string;
        databaseSha256: string;
        db1ArtifactSha256: string;
        c1AuditArtifact: { fileName: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number };
        c2SupportedArtifact: { fileName: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number };
    };
    policy: {
        rawSkillRowsAreAuditOnly: true;
        rawRowsNormalizedByTableAndRowId: true;
        supportedMechanicsAreC2ExactProjection: true;
        partialOrUnknownMechanicsInConsumerChannel: false;
        textUsedAsIdentity: false;
    };
    rawRows: SourcedRow[];
    stateSkills: CharacterStateSkills[];
    actionSkills: CharacterActionSkills[];
    supportedMechanics: CharacterSupportedMechanic[];
}

export interface DatabaseCharacterSkillsCoverage {
    schemaVersion: 1;
    rawRowCount: number;
    stateCount: number;
    leaderSkillStateCount: number;
    passiveSkillStateCount: number;
    attackCounts: Record<"super" | "ultra" | "unit" | "ex" | "unknown", number>;
    activeSkillCardCount: number;
    standbySkillCardCount: number;
    finishSkillCardCount: number;
    supportedMechanicRuleCount: number;
    supportedMechanicStateCount: number;
    supportedMechanicPassiveSkillCount: number;
    supportedTimingCount: number;
    unjoinedSupportedRuleCount: number;
    forbiddenConsumerFieldCount: number;
    duplicateStateIdentityCount: number;
    duplicateSupportedRuleIdentityCount: number;
}

export interface DatabaseCharacterSkillsValidation { schemaVersion: 1; valid: boolean; failures: string[] }
