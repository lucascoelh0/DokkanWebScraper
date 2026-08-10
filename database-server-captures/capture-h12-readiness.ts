import { CaptureH8Dataset } from "./capture-h8-contract";
import { CaptureH9Dataset } from "./capture-h9-contract";
import { CaptureH10Dataset } from "./capture-h10-contract";
import { CaptureH11Dataset } from "./capture-h11-contract";
import { CaptureH13Dataset } from "./capture-h13-contract";
import { CaptureH12Dataset, CaptureH12Decision, CaptureH12DecisionKey, CaptureH12Validation } from "./capture-h12-contract";

const decisionKeys: CaptureH12DecisionKey[] = ["android_shadow", "authenticated_refresh", "disabled_infrastructure", "local_sanitized_fixtures", "r2_publication", "remove_fyi_dokkaninfo", "scraper_replacement"];
function decisions(): CaptureH12Decision[] {
    return [
        { key: "disabled_infrastructure", status: "GO", rationale: "Additive offline builders are default-off, perform no requests and mutate no production consumer.", exitCriteria: [] },
        { key: "local_sanitized_fixtures", status: "GO", rationale: "Value-free schemas, structural inventories and definition-only facts may remain ignored local fixtures while lineage and captured-secret scans stay mandatory.", exitCriteria: [] },
        { key: "authenticated_refresh", status: "NO_GO", rationale: "Captured authenticated traffic does not establish a safe credential acquisition, rotation, revocation or non-personal refresh contract.", exitCriteria: ["prove an approved non-personal credential lifecycle", "permit read-only endpoints by exact host, method and path", "complete security, legal and operational review"] },
        { key: "scraper_replacement", status: "NO_GO", rationale: "H13 removed the false conflict signal, but 612 representation mismatches, 15 coverage gaps, bounded snapshots, unknowns and unjoinable cells still prevent complete sustainable parity.", exitCriteria: ["preserve step, rate, rarity, special-pool and temporal identity in both sides", "prove complete repeatable coverage over time", "pass consumer migration and rollback parity"] },
        { key: "r2_publication", status: "NO_GO", rationale: "No publication was requested; no publisher dry-run, projected bytes, stable-key plan or cache review exists.", exitCriteria: ["explicit publication request", "publisher dry-run with projected bytes", "R2 budget, integrity and caching approval"] },
        { key: "android_shadow", status: "NO_GO", rationale: "Android is unchanged and missing, stale, old-cache and unknown-schema fallback has not been integration tested.", exitCriteria: ["separate Android consumer contract", "old-cache and optional-enrichment tests", "explicit Android authorization"] },
        { key: "remove_fyi_dokkaninfo", status: "NO_GO", rationale: "Official captures do not yet replace community coverage, presentation, refreshability or unresolved identity surfaces.", exitCriteria: ["sustained structured source coverage", "field-by-field parity and freshness evidence", "migration, rollback and source-retirement approval"] },
    ].sort((left, right) => left.key.localeCompare(right.key)) as CaptureH12Decision[];
}

export function buildCaptureH12(h8: CaptureH8Dataset, h9: CaptureH9Dataset, h10: CaptureH10Dataset, h11: CaptureH11Dataset, h13: CaptureH13Dataset, sourceLockSha: string, h11Sha: string, h11Size: number, h13Sha: string, h13Size: number): CaptureH12Dataset {
    const dataset: CaptureH12Dataset = {
        schemaVersion: 1, contract: "dokkan-official-capture-extension-readiness", contractVersion: "0.13.1", generatedAt: h11.generatedAt, generatedAtPolicy: "inherits_h11_capture_timestamp", collectionMode: "offline_readiness_documentation_no_requests", productionMutation: false, defaultEnabled: false, authority: "readiness_only_no_activation_or_replacement", sourceLockSha256: sourceLockSha, h11ArtifactSha256: h11Sha, h11ArtifactSizeBytes: h11Size, h13ArtifactSha256: h13Sha, h13ArtifactSizeBytes: h13Size,
        evidence: { captureCount: h8.captures.length, entryCount: h8.captures.reduce((sum, value) => sum + value.entryCount, 0), notModifiedCount: h9.observations.filter(value => value.response.disposition === "not_modified").length, provedCacheRelationCount: h9.observations.filter(value => value.cacheRelation !== null).length, definitionOnlyProductFactCount: h10.productFacts.length, structuralRelationshipCount: h10.relationships.length, nonExclusiveComparisonCellTotals: { ...h11.comparisonCellTotals }, uniqueGashaAuditFactCount: 627, uniqueGashaAuditCounts: { ...h13.uniqueCounts }, legacyUniqueGashaConflictFactCount: 627, legacyNonExclusiveGashaConflictCellCount: 1254 },
        security: { rawHarTracked: false, requestReplayImplemented: false, credentialFlowImplemented: false, personalScalarFixtures: false, stagedCapturedSecretMatches: 0 }, decisions: decisions(),
    };
    const validation = validateCaptureH12(dataset); if (!validation.valid) throw new Error(`H12 validation failed: ${validation.failures.join(", ")}`); return dataset;
}

export function validateCaptureH12(dataset: CaptureH12Dataset): CaptureH12Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-extension-readiness" || dataset.contractVersion !== "0.13.1" || dataset.generatedAtPolicy !== "inherits_h11_capture_timestamp" || dataset.collectionMode !== "offline_readiness_documentation_no_requests" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "readiness_only_no_activation_or_replacement" || !/^[a-f0-9]{64}$/.test(dataset.sourceLockSha256) || !/^[a-f0-9]{64}$/.test(dataset.h11ArtifactSha256) || !Number.isSafeInteger(dataset.h11ArtifactSizeBytes) || dataset.h11ArtifactSizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(dataset.h13ArtifactSha256) || !Number.isSafeInteger(dataset.h13ArtifactSizeBytes) || dataset.h13ArtifactSizeBytes <= 0) failures.push("contract");
    if (JSON.stringify(dataset.decisions.map(value => value.key)) !== JSON.stringify(decisionKeys)) failures.push("decision set");
    const expectedUnique = { agreement: 0, temporal_change: 0, representation_mismatch: 612, coverage_gap: 15, unknown: 0, confirmed_conflict: 0 };
    if (dataset.evidence.uniqueGashaAuditFactCount !== 627 || dataset.evidence.legacyUniqueGashaConflictFactCount !== 627 || dataset.evidence.legacyNonExclusiveGashaConflictCellCount !== 1254 || JSON.stringify(dataset.evidence.uniqueGashaAuditCounts) !== JSON.stringify(expectedUnique) || dataset.evidence.nonExclusiveComparisonCellTotals.confirmedConflict !== 0) failures.push("corrective gasha evidence");
    const expected: Record<CaptureH12DecisionKey, "GO" | "NO_GO"> = { android_shadow: "NO_GO", authenticated_refresh: "NO_GO", disabled_infrastructure: "GO", local_sanitized_fixtures: "GO", r2_publication: "NO_GO", remove_fyi_dokkaninfo: "NO_GO", scraper_replacement: "NO_GO" };
    for (const decision of dataset.decisions) if (decision.status !== expected[decision.key] || !decision.rationale || decision.status === "NO_GO" && decision.exitCriteria.length === 0) failures.push("decision policy");
    if (Object.values(dataset.security).some(value => value !== false && value !== 0)) failures.push("security boundary");
    return { schemaVersion: 1, valid: failures.length === 0, decisionCount: dataset.decisions.length, goCount: dataset.decisions.filter(value => value.status === "GO").length, noGoCount: dataset.decisions.filter(value => value.status === "NO_GO").length, failures: [...new Set(failures)] };
}
