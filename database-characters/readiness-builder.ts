import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { CharacterReadinessDecision, DatabaseCharacterReadinessCoverage, DatabaseCharacterReadinessDataset } from "./readiness-contract";

const K8 = {
    receiptSha256: "f91c894a7ebbd6a48380f73c68282e2f4f12c337367ff3b1de5cf07f01c19798",
    manifestSha256: "e28fd73c929494f78f65b39552601f496dffaf323b909e84244fd5b8f5fcd133",
};

function decisions(): CharacterReadinessDecision[] {
    return [
        { id: "merge_disabled_infrastructure", decision: "GO", rationale: "All K0–K8 contracts are additive, optional, reviewed and leave production disabled.", evidenceGates: ["K0-K8"], prerequisites: [] },
        { id: "pinned_optional_generation", decision: "GO", rationale: "The exact SQLite/DB1/ELF/C1-C3 profile reproduced deterministic optional artifacts below 1 GiB.", evidenceGates: ["K8"], prerequisites: ["Use only the exact reviewed refresh profile."] },
        { id: "replace_identity_state_graph", decision: "NO-GO", rationale: "The structural graph is complete, but product projection and 1,463 production-unjoinable cards have not been shadow-consumed.", evidenceGates: ["K0", "K1", "K7"], prerequisites: ["Implement a production-equivalent projection.", "Run consumer shadow parity and migration tests."] },
        { id: "replace_taxonomy_categories_links", decision: "NO-GO", rationale: "Structural joins are complete, but only the Global snapshot-default presentation locale is proved.", evidenceGates: ["K2", "K7"], prerequisites: ["Define locale fallback/authority.", "Validate UI ordering and presentation parity in a consumer."] },
        { id: "replace_leader_skills", decision: "NO-GO", rationale: "Raw structure is retained, while OR-versus-sum semantics and 59 C3 unknown rules prevent replacement.", evidenceGates: ["K3", "K7"], prerequisites: ["Close leader-clause identity and remaining semantic unknowns.", "Shadow-validate rendered and structured leader behavior."] },
        { id: "replace_passive_sa_text", decision: "NO-GO", rationale: "C2 supports mechanics only; consumer presentation text and unsupported/partial semantics remain externally owned.", evidenceGates: ["K3", "K7"], prerequisites: ["Define first-party locale/text projection.", "Retain external fallback for unsupported mechanics."] },
        { id: "replace_transformations_standby_exchange", decision: "NO-GO", rationale: "K1 gains direction/channel identity, but external transformation sets are not a common comparable contract and 29 C3 rules are unjoinable.", evidenceGates: ["K1", "K3", "K7"], prerequisites: ["Build and shadow-test the product form projection.", "Resolve aliases and unjoinable state rules."] },
        { id: "replace_portraits_asset_references", decision: "NO-GO", rationale: "Only 75 card resource IDs are explicit; 5,684 card gaps and unknown delivery prevent replacement.", evidenceGates: ["K6", "K7"], prerequisites: ["Obtain a proved portrait/card-art role mapping.", "Integrate the server-owned delivery manifest."] },
        { id: "remove_dokkaninfo", decision: "NO-GO", rationale: "The production-shaped catalog and raw portrait/card-art references still depend on DokkanInfo behavior.", evidenceGates: ["K6", "K7"], prerequisites: ["Replace all remaining presentation and asset roles with proved sources.", "Complete production consumer migration."] },
        { id: "remove_dokkan_fyi", decision: "NO-GO", rationale: "FYI still owns current localized presentation, current-state rendering and Team Analysis inputs; 4,134 DB cards are structurally unjoinable to its selected catalog.", evidenceGates: ["K3", "K7"], prerequisites: ["Provide locale-complete first-party presentation.", "Replace FYI-derived Team Analysis inputs and consumer fallbacks."] },
        { id: "publish_r2", decision: "NO-GO", rationale: "No publication was authorized or dry-run; delivery remains outside this campaign.", evidenceGates: ["K8"], prerequisites: ["Obtain explicit publication authorization.", "Run publisher dry-run and report projected bytes.", "Define stable keys and cache policy."] },
        { id: "android_shadow_mode", decision: "NO-GO", rationale: "The Android repository was intentionally untouched and no delivery path exists for the optional sidecars.", evidenceGates: ["K8"], prerequisites: ["Implement old-cache-tolerant Android shadow loading in a separate campaign.", "Provide optional sidecar delivery."] },
        { id: "team_builder_first_party", decision: "NO-GO", rationale: "C2 is supported-only and C3 is shadow evidence; no Team Builder consumer was changed and unknown/unjoinable rules remain.", evidenceGates: ["K3", "K7"], prerequisites: ["Add field-scoped shadow consumption with external fallback.", "Resolve or explicitly tolerate C3 unknown/unjoinable rules."] },
        { id: "combat_calculations", decision: "NO-GO", rationale: "K4 intentionally separates raw player-card stats from displayed/combat/enemy domains and implements no damage formula.", evidenceGates: ["K3", "K4"], prerequisites: ["Specify and separately audit combat formulas, lifecycle, rounding and enemy domains."] },
    ];
}

export function buildDatabaseCharacterReadinessDataset(): DatabaseCharacterReadinessDataset {
    const sidecars = CHARACTER_REFRESH_PROFILE.sidecars.map(sidecar => ({ gate: sidecar.gate, sha256: sidecar.artifact.sha256, sizeBytes: sidecar.artifact.sizeBytes, uncompressedSizeBytes: sidecar.artifact.uncompressedSizeBytes, consumerEligible: sidecar.consumerScopes.length > 0 }));
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-readiness",
        contractVersion: "1.0.0",
        generatedAt: CHARACTER_REFRESH_PROFILE.generatedAt,
        source: { k8ReceiptSha256: K8.receiptSha256, k8ManifestSha256: K8.manifestSha256, profileId: CHARACTER_REFRESH_PROFILE.profileId, snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion },
        status: "infrastructure_ready_consumers_disabled",
        decisions: decisions(),
        fieldAuthority: [
            { domain: "card_identity_and_state_graph", currentAuthority: "production", databaseFirstStatus: "shadow_candidate", evidence: "K0/K1 structural IDs; K7 production join 4296/5759", promotionRequirement: "Product projection plus consumer shadow parity" },
            { domain: "taxonomy_categories_links", currentAuthority: "FYI/DokkanInfo", databaseFirstStatus: "shadow_candidate", evidence: "K2 zero dangling assignments", promotionRequirement: "Locale and presentation fallback contract" },
            { domain: "supported_mechanics", currentAuthority: "FYI/DokkanInfo", databaseFirstStatus: "shadow_candidate", evidence: "K3 exact C2 projection; C3 1108 agreements and 154 gains", promotionRequirement: "Field-scoped consumer shadow with fallback" },
            { domain: "raw_skill_presentation", currentAuthority: "FYI/DokkanInfo", databaseFirstStatus: "audit_only", evidence: "K3 raw rows; no locale-complete consumer text", promotionRequirement: "Locale-complete text projection and semantic rendering parity" },
            { domain: "base_card_stats_and_caps", currentAuthority: "FYI/DokkanInfo", databaseFirstStatus: "shadow_candidate", evidence: "K4 raw card stats and 10654 state caps", promotionRequirement: "Displayed-stat consumer parity; keep EZA overrides unknown" },
            { domain: "dynamic_acquisition_and_availability", currentAuthority: "server", databaseFirstStatus: "unsupported", evidence: "K5 static evidence only", promotionRequirement: "Join the separate server-owned catalog" },
            { domain: "portraits_card_art_and_delivery", currentAuthority: "FYI/DokkanInfo", databaseFirstStatus: "audit_only", evidence: "K6 75 resource IDs and 5684 gaps; delivery unknown", promotionRequirement: "Proved role mapping plus server-owned delivery manifest" },
            { domain: "combat_results", currentAuthority: "none", databaseFirstStatus: "unsupported", evidence: "K3/K4 explicitly exclude combat calculation", promotionRequirement: "Separate audited combat contract" },
        ],
        remainingDependencies: {
            server: ["schedules and availability", "banners/summons", "dynamic acquisition and rewards", "asset manifest/CDN/delivery", "authentication and server-only roots"],
            fyi: ["current localized character presentation", "latest-state presentation and conditions", "Team Analysis production inputs", "fallback for unsupported mechanics"],
            dokkanInfo: ["legacy production catalog shape", "portrait/card-art URLs and role conventions", "production fallback for fields outside the FYI subset"],
        },
        confirmedConflicts: [
            { source: "fyi", cardId: "1027621", stateKey: "1027621:growth-7", availableAt: "2026-07-29 05:00:00", fields: [{ field: "maxLevel", databaseValue: 140, externalValue: 120 }, { field: "maxSALevel", databaseValue: 15, externalValue: 10 }] },
            { source: "fyi", cardId: "1028161", stateKey: "1028161:growth-7", availableAt: "2026-07-29 05:00:00", fields: [{ field: "maxLevel", databaseValue: 140, externalValue: 120 }, { field: "maxSALevel", databaseValue: 15, externalValue: 10 }] },
        ],
        updateStrategy: [
            "Decrypt the new SQLite/ELF outside the repository and preserve read-only inputs.",
            "Create a new explicit refresh profile; never relabel the pinned profile.",
            "If SQLite, ELF or semantic evidence changes, perform the required bounded contract revalidation before reuse; do not replay DB0-DB50 implicitly.",
            "Generate DB1 and K0-K7 sequentially with per-gate validation, deterministic bytes and the 1 GiB working-set gate.",
            "Run K8 compatibility finalization and K7 shadow parity before considering any field-authority promotion.",
            "Review, commit and publish optional artifacts separately; production and Android activation require distinct authorization.",
        ],
        projectedSidecars: sidecars,
        projectedTotals: { sidecarCount: sidecars.length, compressedBytes: sidecars.reduce((sum, sidecar) => sum + sidecar.sizeBytes, 0), uncompressedBytes: sidecars.reduce((sum, sidecar) => sum + sidecar.uncompressedSizeBytes, 0) },
        policy: { productionModified: false, authorityPromoted: false, r2Published: false, androidModified: false, teamBuilderModified: false, combatImplemented: false },
    };
}

export function buildDatabaseCharacterReadinessCoverage(dataset: DatabaseCharacterReadinessDataset): DatabaseCharacterReadinessCoverage {
    const decisionIds = dataset.decisions.map(decision => decision.id);
    return {
        schemaVersion: 1,
        decisionCount: dataset.decisions.length,
        goCount: dataset.decisions.filter(decision => decision.decision === "GO").length,
        noGoCount: dataset.decisions.filter(decision => decision.decision === "NO-GO").length,
        fieldAuthorityCount: dataset.fieldAuthority.length,
        confirmedConflictCardCount: dataset.confirmedConflicts.length,
        confirmedConflictFieldCount: dataset.confirmedConflicts.reduce((sum, conflict) => sum + conflict.fields.length, 0),
        projectedSidecarCount: dataset.projectedSidecars.length,
        projectedCompressedBytes: dataset.projectedTotals.compressedBytes,
        duplicateDecisionCount: decisionIds.length - new Set(decisionIds).size,
    };
}
