export type Db12ComparableCausalityType = 43 | 51 | 55;
export type Db12AttributionSide = "database" | "current";
export type Db12AttributionReason =
    | "logical_context_mismatch"
    | "polarity_mismatch"
    | "exact_turn_encoding_candidate"
    | "threshold_mismatch"
    | "comparator_mismatch"
    | "absent_in_current"
    | "absent_in_database";

export interface Db12ComparableAtom {
    kind: "attacks_evaded" | "turn_from_entry",
    scope: "self",
    causalityType?: Db12ComparableCausalityType,
    comparator?: "lte" | "gte" | "eq",
    value?: number,
    eventMode?: "current_event",
    logicalContext: string,
    negated: boolean,
    structuralSignature: string,
}

export interface Db12DivergenceAttribution {
    side: Db12AttributionSide,
    stateKey: string,
    atom: Db12ComparableAtom,
    sourceRuleKeys: string[],
    reason: Db12AttributionReason,
    candidateSignatureCount: number,
    candidateSignatures: string[],
}

export interface Db12ExactTurnEncodingCandidate {
    stateKey: string,
    value: number,
    negated: boolean,
    databaseRuleKey: string,
    databaseConjunctionGroup: string,
    databaseLowerSignature: string,
    databaseUpperSignature: string,
    currentExactSignatures: string[],
    status: "candidate_not_rule_aligned",
}

export interface DatabaseTeamAnalysisDb12Dataset {
    schemaVersion: 1,
    contract: "dokkan-team-analysis-divergence-attribution-experiment",
    contractVersion: "0.11.0",
    generatedAt: string,
    sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: string, contractVersion: "0.10.0" },
    sourceDb11Parity: { fileName: "team-analysis-db11-parity.json", sha256: string, schemaVersion: 1 },
    sourceCurrentTeamAnalysis: { sha256: string, parserVersion: string },
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    semanticPromotionCount: 0,
    matchedStateCount: number,
    databaseOnlyStateKeys: string[],
    currentOnlyStateKeys: string[],
    databaseOnlyAttributions: Db12DivergenceAttribution[],
    currentOnlyAttributions: Db12DivergenceAttribution[],
    diagnosticCurrentExactTurnAtoms: Array<{ stateKey: string, atom: Db12ComparableAtom, sourceRuleKeys: string[] }>,
    exactTurnEncodingCandidates: Db12ExactTurnEncodingCandidate[],
}

export interface DatabaseTeamAnalysisDb12Coverage {
    schemaVersion: 1,
    matchedStateCount: number,
    databaseOnlyStateCount: number,
    currentOnlyStateCount: number,
    exactStructuralMatchCount: number,
    databaseOnlySignatureCount: number,
    currentOnlySignatureCount: number,
    databaseOnlyCountsByReason: Record<Db12AttributionReason, number>,
    currentOnlyCountsByReason: Record<Db12AttributionReason, number>,
    databaseOnlyCountsByType: Record<string, number>,
    currentOnlyCountsByType: Record<string, number>,
    exactTurnEncodingCandidateCount: number,
    exactTurnEncodingCandidateStateCount: number,
    diagnosticCurrentExactTurnAtomCount: number,
    candidateCurrentExactTurnAtomCount: number,
    semanticPromotionCount: 0,
}

export interface DatabaseTeamAnalysisDb12ArtifactManifest {
    schemaVersion: 1,
    contractVersion: "0.11.0",
    generatedAt: string,
    fileName: "team-analysis-db12-divergence-attribution.json.gz",
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    matchedStateCount: number,
    divergenceAttributionCount: number,
    exactTurnEncodingCandidateCount: number,
    semanticPromotionCount: 0,
    sourceDatabaseSha256: string,
    sourceDb11Sha256: string,
    sourceDb11ParitySha256: string,
    currentTeamAnalysisSha256: string,
    coverageFile: "team-analysis-db12-coverage.json",
    reportFile: "team-analysis-db12-report.md",
    goldenValidationFile: "team-analysis-db12-golden-validation.json",
}
