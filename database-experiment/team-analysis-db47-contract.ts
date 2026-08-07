import { Db46RuleTiming } from "./team-analysis-db46-contract";

interface Db47RelocationEvidence { offset: number; type: number; symbol: string; symbolValue: number; addend: number }
export interface Db47NativeEvidence {
    schemaVersion: 1;
    sourceSha256: string;
    auditScope: string;
    regions: Array<{ role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }>;
    event: { raw: 15; name: "puzzle_attack_move_end_after_controller_callback"; sequence: string; categoryRaw: 0; skillTypeRaw: 2; deckIndexSource: string; instructions: Array<{ role: string; vma: number; hex: string }> };
    directCalls: Array<{ role: string; callVma: number; callHex: string; pltVma: number; pltHex: string; relocation: Db47RelocationEvidence }>;
    virtualCall: { callVma: number; callHex: string; vptrSlotOffset: number; vtable: { symbol: string; vma: number; sizeBytes: number; rawSha256: string }; relocation: Db47RelocationEvidence };
    doesNotImply: string[];
    unknowns: string[];
}
export interface Db47RuleTiming extends Omit<Db46RuleTiming, "executionTiming" | "provenance"> {
    executionTiming: Db46RuleTiming["executionTiming"] | { status: "supported"; event: "puzzle_attack_move_end_after_controller_callback"; sequence: string };
    provenance: Db46RuleTiming["provenance"];
}
export interface DatabaseTeamAnalysisDb47Dataset { schemaVersion: 1; contract: "dokkan-team-analysis-puzzle-move-end-timing-native-semantics-experiment"; contractVersion: "0.46.0"; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceDb46: { fileName: "team-analysis-db46-enemy-attack-timing.json.gz"; sha256: string; contractVersion: "0.45.0" }; nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number }; nativeEvidence: { fileName: "native-puzzle-move-end-timing-semantics.json"; sha256: string }; inheritedSemanticPromotionCount: 60; semanticPromotionCount: 1; ruleTimings: Db47RuleTiming[] }
export interface DatabaseTeamAnalysisDb47Coverage { schemaVersion: 1; ruleCount: number; effectCount: number; supportedBefore: number; supportedAfter: number; newlySupportedRuleCount: number; newlySupportedEffectCount: number; newlySupportedPassiveSkillCount: number; newlySupportedStateCount: number; remainingUnknownRuleCount: number; inheritedSemanticPromotionCount: 60; semanticPromotionCount: 1 }
export interface DatabaseTeamAnalysisDb47Manifest { schemaVersion: 1; contractVersion: "0.46.0"; generatedAt: string; fileName: "team-analysis-db47-puzzle-move-end-timing.json.gz"; compression: "gzip"; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; ruleCount: number; newlySupportedRuleCount: number; sourceDatabaseSha256: string; sourceDb46Sha256: string; nativeRuntimeSha256: string; nativeEvidenceSha256: string; coverageFile: "team-analysis-db47-coverage.json"; reportFile: "team-analysis-db47-report.md"; validationFile: "team-analysis-db47-validation.json"; goldenValidationFile: "team-analysis-db47-golden-validation.json" }
