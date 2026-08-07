export type IntegrationC5Stage = "merge_infrastructure" | "optional_production_generation" | "r2_publication" | "android_shadow_consumption" | "partial_combat_calculation" | "full_simulation";
export interface IntegrationC5Decision { stage: IntegrationC5Stage; decision: "GO" | "NO_GO"; scope: string; reasons: string[]; prerequisites: string[] }
export interface IntegrationC5Evidence {
    sourceSnapshotVersion: string;
    artifacts: { c1: { sha256: string; sizeBytes: number }; c2: { sha256: string; sizeBytes: number }; c3: { sha256: string; sizeBytes: number }; c4Receipt: { sha256: string; sizeBytes: number } };
    coverage: { auditRuleCount: number; supportedRuleCount: number; sidecarStateCount: number; supportedTimingCount: number; unknownTimingCount: number; shadowAgreementCount: number; representationGainCount: number; shadowUnknownCount: number; unjoinableRuleCount: number; confirmedConflictCount: number; commonFirstPartyRuleIdentityCount: number; unknownConditionCount: number; unknownProbabilityCount: number; unknownFinalHpCount: number };
    refresh: { status: "compatible"; exactEvidenceIdentity: true; readOnlySourceGuarantee: true };
}
export interface IntegrationC5Readiness {
    schemaVersion: 1; contract: "dokkan-database-first-adoption-readiness"; contractVersion: "1.0.0"; generatedAt: string;
    evidence: IntegrationC5Evidence; decisions: IntegrationC5Decision[];
    integrationStrategy: { preferred: "merge_experimental_infrastructure_as_reviewed_unit"; isolatedCherryPickPolicy: "prohibited_without_source_contract_and_evidence_dependencies"; productionContractsChanged: false; androidChanged: false };
    versioning: { sidecarContract: "semantic_version_independent_from_production"; schemaVersionRequired: true; sourceSnapshotPinned: true; unknownCompatibility: "reject_or_ignore_sidecar_never_default" };
    cacheAndRollback: { contentKey: string; manifestPolicy: "short_lived_or_revalidated"; payloadPolicy: "immutable_content_addressed"; rollback: "restore_previous_validated_manifest_pointer"; retention: "current_plus_two_previous_compatible_snapshots_and_all_pinned_evidence" };
    adoptionPhases: Array<{ order: number; name: string; entryCriteria: string[]; exitCriteria: string[] }>;
    publicationChecklist: Array<{ item: string; status: "ready" | "blocked"; reason?: string }>;
}
export interface IntegrationC5Validation { schemaVersion: 1; valid: boolean; exactReadiness: boolean; decisionCount: number; mutationRejectionCount: number; failures: string[] }
export interface IntegrationC5Manifest { schemaVersion: 1; contractVersion: "1.0.0"; generatedAt: string; fileName: "database-first-readiness-c5.json"; sha256: string; sizeBytes: number; reportFile: "database-first-readiness-c5-report.md"; validationFile: "database-first-readiness-c5-validation.json" }
