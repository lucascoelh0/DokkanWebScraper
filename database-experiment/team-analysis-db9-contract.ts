import { NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { SqliteScalar } from "./contract";

export interface Db9NativeLayout {
    schemaVersion: 1,
    sourceSha256: string,
    sourceSizeBytes: number,
    architecture: "elf64-little-aarch64",
    tables: {
        efficacy: { enumName: "SkillEfficacyType", baseVma: number, slotCount: number, dispatchSymbol: string },
        causality: { enumName: "SkillCausalityType", baseVma: number, slotCount: number, tableSymbol: string, dispatchSymbol: string },
    },
}

export interface Db9DispatchSlot { enumValue: number, slotVma: number, status: "identified" | "null", symbol?: string, symbolAddress?: number, minimumOperationLabel?: string }
export interface Db9GapRuntimeEvidence {
    sourceEnumValue: SqliteScalar,
    enumValue?: number,
    occurrenceCount: number,
    affectedStateCount: number,
    identityStatus: "runtime_identified" | "unsupported_null" | "out_of_range" | "invalid_value",
    slotVma?: number,
    symbol?: string,
    symbolAddress?: number,
    minimumOperationLabel?: string,
    unresolvedFields: string[],
}

export interface DatabaseTeamAnalysisDb9Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-native-runtime-evidence-experiment",
    contractVersion: "0.8.0",
    generatedAt: string,
    sourceDb8ContractVersion: "0.7.0",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: string },
    nativeRuntimeLayout: { fileName: "native-runtime-layout.json", sha256: string },
    nativeRuntime: { fileName: string, sizeBytes: number, sha256: string, elfClass: NativeRuntimeElfInspection["elfClass"], endian: NativeRuntimeElfInspection["endian"], machine: NativeRuntimeElfInspection["machine"] },
    semanticPromotionCount: 0,
    runtimeIdentityResolutionCount: number,
    efficacyDispatchSlots: Db9DispatchSlot[],
    causalityDispatchSlots: Db9DispatchSlot[],
    efficacyGapEvidence: Db9GapRuntimeEvidence[],
    causalityGapEvidence: Db9GapRuntimeEvidence[],
}

export interface DatabaseTeamAnalysisDb9Coverage {
    schemaVersion: 1,
    semanticPromotionCount: 0,
    efficacyGapTypes: { total: number, identified: number, null: number, outOfRange: number, invalid: number },
    efficacyGapRules: { total: number, identified: number, unresolved: number },
    causalityGapTypes: { total: number, identified: number, null: number, outOfRange: number, invalid: number },
    causalityGapOccurrences: { total: number, identified: number, unresolved: number },
}

export interface DatabaseTeamAnalysisDb9ArtifactManifest {
    schemaVersion: 1, contractVersion: "0.8.0", generatedAt: string,
    fileName: "team-analysis-db9-runtime-evidence.json.gz", compression: "gzip", sha256: string, sizeBytes: number, uncompressedSizeBytes: number,
    semanticPromotionCount: 0, runtimeIdentityResolutionCount: number, sourceDatabaseSha256: string, sourceDb8Sha256: string, nativeRuntimeSha256: string, nativeRuntimeLayoutSha256: string,
    coverageFile: "team-analysis-db9-coverage.json", reportFile: "team-analysis-db9-report.md", goldenValidationFile: "team-analysis-db9-golden-validation.json",
}
