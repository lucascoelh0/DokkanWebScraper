import { IntegrationC2Rule } from "./integration-c2-contract";

export type IntegrationC3Classification = "agreement" | "representation_gain" | "confirmed_conflict" | "unjoinable" | "unknown";
export type IntegrationC3FixtureKind = "transformation" | "reversible_exchange" | "standby" | "finish" | "eza" | "seza" | "auxiliary_form";

export interface IntegrationC3ExpectedRepresentation {
    kind: "damage_reduction" | "guard" | "counter_resistance";
    value?: number;
    unit?: "percent" | "boolean";
    target: { status: "supported"; scope: string; selfInclusion?: string } | { status: "unknown"; missing: string[] };
}

export interface IntegrationC3ProductionCandidate {
    parserRuleId: string;
    effectOrdinal: number;
    kind: string;
    value?: number;
    unit?: string;
    target?: { scope?: string; selfInclusion?: string };
}

export interface IntegrationC3Record {
    identity: IntegrationC2Rule["identity"];
    databaseFirstRule: IntegrationC2Rule;
    stateJoin: { status: "joined" | "unjoinable"; key: "stateKey"; productionStateKey?: string };
    ruleJoin: { status: "unavailable"; reason: "production_contract_has_no_first_party_passive_rule_or_effect_identity" };
    expectedRepresentation: IntegrationC3ExpectedRepresentation;
    productionCandidates: IntegrationC3ProductionCandidate[];
    classification: IntegrationC3Classification;
    basis: "state_key_then_exact_effect_representation" | "state_key_only" | "no_state_join";
    reason: string;
}

export interface IntegrationC3GoldenFixture {
    kind: IntegrationC3FixtureKind;
    characterId: string;
    formId: string;
    stateKey: string;
    releaseState: "initial" | "eza" | "seza";
    transformationSource?: "active-skill" | "reversible-exchange" | "standby" | "finish-skill";
}

export interface IntegrationC3Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-database-first-shadow-parity";
    contractVersion: "1.0.0";
    generatedAt: string;
    comparisonPolicy: "structural_ids_only_parser_is_non_authoritative";
    sourceSupportedSidecar: { fileName: string; sha256: string; contractVersion: "1.0.0" };
    sourceProductionTeamAnalysis: { fileName: string; sha256: string; datasetVersion: string; parserVersion: string };
    sourceProductionCharacters: { fileName: string; sha256: string; datasetVersion: string };
    records: IntegrationC3Record[];
    goldenFixtures: IntegrationC3GoldenFixture[];
}

export interface IntegrationC3Coverage {
    schemaVersion: 1;
    ruleCount: number;
    sidecarStateCount: number;
    joinedStateCount: number;
    unjoinableStateCount: number;
    joinedRuleCount: number;
    classificationCounts: Record<IntegrationC3Classification, number>;
    operationCounts: { damageMitigation: number; forceGuard: number; counterResistance: number };
    fixtureCounts: Record<IntegrationC3FixtureKind, number>;
    commonFirstPartyRuleIdentityCount: 0;
}

export interface IntegrationC3Validation {
    schemaVersion: 1;
    valid: boolean;
    ruleCount: number;
    exactReconstructionCount: number;
    exactComparisonCount: number;
    fixtureCount: number;
    mutationRejectionCount: number;
    failures: string[];
}

export interface IntegrationC3Manifest {
    schemaVersion: 1;
    contractVersion: "1.0.0";
    generatedAt: string;
    fileName: "team-analysis-database-first-shadow-c3.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    stateCount: number;
    sourceSupportedSidecarSha256: string;
    sourceProductionTeamAnalysisSha256: string;
    coverageFile: "team-analysis-database-first-shadow-c3-coverage.json";
    validationFile: "team-analysis-database-first-shadow-c3-validation.json";
    reportFile: "team-analysis-database-first-shadow-c3-report.md";
}
