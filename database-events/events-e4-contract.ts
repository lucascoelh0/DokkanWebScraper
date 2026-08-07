import { EventsE3RawRow } from "./events-e3-contract";

export interface EventsE4Observation {
    relatedCardCategories: EventsE3RawRow[];
    relatedLinkSkills: EventsE3RawRow[];
    relatedOptimalAwakenings: EventsE3RawRow[];
    relatedPassiveSkillSets: EventsE3RawRow[];
    subTargetTypeSets: EventsE3RawRow[];
    subTargetTypes: EventsE3RawRow[];
    cardCategoryTargets: EventsE3RawRow[];
    linkSkillTargets: EventsE3RawRow[];
    passiveSkillSetTargets: EventsE3RawRow[];
    questCategoryBonuses: EventsE3RawRow[];
    questCategoryBonusRarityTables: EventsE3RawRow[];
    originBattleHeatUpReferences: EventsE3RawRow[];
    heatUpGimmicks: EventsE3RawRow[];
    heatUpGimmickSkills: EventsE3RawRow[];
    enemyAiConditions: EventsE3RawRow[];
    unboundMechanicSurfaces: Array<{ table: string; rowCount: number }>;
}

export interface EventsE4NativeEvidence {
    schemaVersion: 1;
    sourceElfSha256: string;
    sourceElfSizeBytes: number;
    scope: string;
    affectedReferencedEnemySkillCount: number;
    sqliteBoundary: { table: "enemy_skills"; rowConstructorSymbol: string; rowConstructorVma: number; rowConstructorSizeBytes: number; rowConstructorCodeSha256: string; fieldOffsetStatus: "unknown" };
    conversion: { symbol: string; vma: number; sizeBytes: number; codeSha256: string; mappingTableVma: number; mappingTableSizeBytes: number; mappingTableSha256: string; target: { enemyRawEfficacyType: 10; genericSkillEfficacyType: 94 } };
    genericDispatch: { tableVma: number; entrySizeBytes: 8; slotVma: number; relocationType: 257; handlerSymbol: string; handlerVma: number };
    callSiteAudit: { textBytesScanned: number; directBranchWithLinkCallsToConversionSymbol: 0; directBranchWithLinkCallsToConversionPlt: 0; status: "consumer_chain_unproven" };
    semanticStatus: "partial";
    promotion: "none";
    abandonReason: string;
}

export interface EventsE4Relation {
    sourceRowId: string;
    enemySkillId: string;
    targetId: string;
    structuralStatus: "supported";
    semanticStatus: "partial";
    semanticBoundary: "relation_membership_proven_effect_direction_and_magnitude_unknown";
}

export interface EventsE4Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-mechanics";
    contractVersion: "0.5.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE3: { contractVersion: "0.4.0"; sha256: string };
    sourceE2: { contractVersion: "0.3.0"; sha256: string };
    nativeEvidence: { fileName: "events-e4-native-enemy-efficacy-map.json"; sha256: string; sourceElfSha256: string; status: "partial"; promotion: "none" };
    rawSkillTypeInventory: Array<{ sourceKind: "enemy_skill" | "enemy_round_skill"; rawEfficacyType: number; ruleCount: number; structuralStatus: "supported"; semanticStatus: "unknown" }>;
    relatedCardCategories: EventsE4Relation[];
    relatedLinkSkills: EventsE4Relation[];
    relatedOptimalAwakenings: EventsE4Relation[];
    relatedPassiveSkillSets: EventsE4Relation[];
    subTargetSets: Array<{ setId: string; structuralStatus: "supported"; semanticStatus: "partial"; members: Array<{ sourceRowId: string; rawTargetValueType: number; rawTargetValue: number }> }>;
    questCategoryBonuses: Array<{ sourceRowId: string; questId: string; bindingStatus: "supported" | "unknown"; rawType: string; cardCategoryId: string; rarityTableId: string; semanticStatus: "partial" }>;
    questCategoryBonusRarityTables: Array<{ identity: { kind: "quest_category_bonus_rarity_table"; id: string }; rawByRarity: { n: number; r: number; sr: number; ssr: number; ur: number; lr: number }; semanticStatus: "partial"; unknowns: ["unit", "application_formula", "stacking"] }>;
    originHeatUpMechanics: Array<{ heatUpGimmickSetId: string; originBattleIds: string[]; status: "partial"; entries: Array<{ sourceRowId: string; rawGaugeStart: number; heatUpGimmickSkillId: string; overrideId: string | null }>; semanticBoundary: "grouping_and_threshold_order_structural_runtime_effect_unknown" }>;
    heatUpGimmickSkills: Array<{ identity: { kind: "heat_up_gimmick_skill"; id: string }; rawEfficacyType: number; rawEffectValue1: number; semanticStatus: "unknown" }>;
    unboundEnemyAiConditions: Array<{ sourceRowId: string; bindingStatus: "unknown"; raw: EventsE3RawRow }>;
    unboundMechanicSurfaces: Array<{ table: string; rowCount: number; status: "unknown"; missing: ["event_or_stage_consumer"] }>;
    requestedMechanicCoverage: Array<{ family: "damage_reduction" | "guard_type_class" | "status_immunities" | "dodge_nullification_attack_break" | "super_attack_behavior" | "category_link_advantages" | "phase_transitions" | "locks_sealing_rotations_fields" | "countdowns_limits_special_rules"; status: "supported" | "partial" | "unknown"; boundary: string }>;
}

export interface EventsE4Coverage { schemaVersion: 1; enemySkillRuleCount: number; enemyRoundSkillRuleCount: number; rawEnemyEfficacyTypeCount: number; rawRoundEfficacyTypeCount: number; cardCategoryRelationCount: number; linkSkillRelationCount: number; optimalAwakeningRelationCount: number; passiveSkillSetRelationCount: number; subTargetSetCount: number; subTargetMemberCount: number; questCategoryBonusCount: number; unboundQuestCategoryBonusCount: number; originHeatUpBattleCount: number; heatUpEntryCount: number; unboundEnemyAiConditionCount: number; danglingIdCount: number; requestedSupportedCount: number; requestedPartialCount: number; requestedUnknownCount: number }
export interface EventsE4Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; losslessRelationCount: number; losslessRawRuleCount: number; nativeEvidenceValid: boolean; failures: string[] }
export interface EventsE4Manifest { schemaVersion: 1; contractVersion: "0.5.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e4-mechanics.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE3Sha256: string; sourceE2Sha256: string; sourceElfSha256: string; nativeEvidenceSha256: string; coverage: { fileName: "events-e4-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e4-validation.json"; sha256: string; sizeBytes: number } }
