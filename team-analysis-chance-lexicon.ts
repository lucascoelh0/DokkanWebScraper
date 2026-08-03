export type QualitativeChanceTerm = "a chance" | "rare" | "medium" | "high" | "great";
export type ValidatedChanceTerm = Exclude<QualitativeChanceTerm, "rare">;
export type ChanceSemantic =
    | "critical_activation"
    | "evade_activation"
    | "additional_super_activation"
    | "additional_to_super"
    | "stun_activation"
    | "seal_activation";

export interface ChanceLexiconEvidence {
    passiveSkillSetId: string,
    passiveSkillId: string,
    efficacyType: number,
    valueField: "probability" | "eff_value1" | "eff_value3",
    semantic: ChanceSemantic,
}

export interface ChanceLexiconEntry {
    term: ValidatedChanceTerm,
    percent: number,
    origin: {
        source: "first-party-game-db",
        region: "global",
        dbVersion: string,
        assetVersion: string,
        exportedAt: string,
        tables: ["passive_skill_sets", "passive_skill_set_relations", "passive_skills"],
        note?: string,
    },
    evidence: ChanceLexiconEvidence[],
}

const FIRST_PARTY_ORIGIN: ChanceLexiconEntry["origin"] = {
    source: "first-party-game-db",
    region: "global",
    dbVersion: "1782367825",
    assetVersion: "1782367204",
    exportedAt: "2026-06-28T17:43:15.341Z",
    tables: ["passive_skill_sets", "passive_skill_set_relations", "passive_skills"],
};

export const TEAM_ANALYSIS_CHANCE_LEXICON: Readonly<Record<ValidatedChanceTerm, ChanceLexiconEntry>> = {
    "a chance": {
        term: "a chance",
        percent: 10,
        origin: {
            ...FIRST_PARTY_ORIGIN,
            note: "All eight audited first-party occurrences are additional-attack-to-Super conversion clauses with eff_value3=10; this entry is valid only for that semantic.",
        },
        evidence: [
            ...["726", "818", "955", "1219", "1342", "1343", "1932", "2017"].map(passiveSkillSetId => ({
                passiveSkillSetId,
                passiveSkillId: ({
                    "726": "726", "818": "1000818", "955": "2000955", "1219": "1001219",
                    "1342": "8001342", "1343": "6001343", "1932": "7001932", "2017": "2002017",
                } as Record<string, string>)[passiveSkillSetId],
                efficacyType: 81,
                valueField: "eff_value3" as const,
                semantic: "additional_to_super" as const,
            })),
        ],
    },
    medium: {
        term: "medium",
        percent: 30,
        origin: FIRST_PARTY_ORIGIN,
        evidence: [
            { passiveSkillSetId: "968", passiveSkillId: "1000968", efficacyType: 90, valueField: "eff_value1", semantic: "critical_activation" },
            { passiveSkillSetId: "874", passiveSkillId: "2000874", efficacyType: 91, valueField: "eff_value1", semantic: "evade_activation" },
            { passiveSkillSetId: "1974", passiveSkillId: "4001974", efficacyType: 81, valueField: "probability", semantic: "additional_super_activation" },
            { passiveSkillSetId: "1024", passiveSkillId: "2001024", efficacyType: 81, valueField: "eff_value3", semantic: "additional_to_super" },
        ],
    },
    high: {
        term: "high",
        percent: 50,
        origin: FIRST_PARTY_ORIGIN,
        evidence: [
            { passiveSkillSetId: "969", passiveSkillId: "1000969", efficacyType: 90, valueField: "eff_value1", semantic: "critical_activation" },
            { passiveSkillSetId: "1019", passiveSkillId: "1019", efficacyType: 91, valueField: "eff_value1", semantic: "evade_activation" },
            { passiveSkillSetId: "2117", passiveSkillId: "2002117", efficacyType: 81, valueField: "probability", semantic: "additional_super_activation" },
            { passiveSkillSetId: "949", passiveSkillId: "1000949", efficacyType: 81, valueField: "eff_value3", semantic: "additional_to_super" },
        ],
    },
    great: {
        term: "great",
        percent: 70,
        origin: FIRST_PARTY_ORIGIN,
        evidence: [
            { passiveSkillSetId: "1603", passiveSkillId: "5001603", efficacyType: 90, valueField: "eff_value1", semantic: "critical_activation" },
            { passiveSkillSetId: "1128", passiveSkillId: "2001128", efficacyType: 91, valueField: "eff_value1", semantic: "evade_activation" },
            { passiveSkillSetId: "2103", passiveSkillId: "3002103", efficacyType: 81, valueField: "probability", semantic: "additional_super_activation" },
            { passiveSkillSetId: "1119", passiveSkillId: "1001119", efficacyType: 81, valueField: "eff_value3", semantic: "additional_to_super" },
        ],
    },
};

export function validatedChancePercent(sourceTerm: string, semantic: ChanceSemantic): number | undefined {
    const term = sourceTerm.trim().toLowerCase() as ValidatedChanceTerm;
    const entry = TEAM_ANALYSIS_CHANCE_LEXICON[term];
    if (!entry) {
        return undefined;
    }
    if (term === "a chance" && !entry.evidence.some(item => item.semantic === semantic)) {
        return undefined;
    }
    return entry.percent;
}
