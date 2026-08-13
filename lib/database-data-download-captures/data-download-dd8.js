"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd8 = exports.buildDd8 = void 0;
const crypto_1 = require("crypto");
function buildDd8(generatedAt, dd6Text, dd7Text) {
    const decisions = [
        { id: "merge_offline_default_off_infrastructure", status: "GO", reason: "offline, additive, deterministic, fail-closed and no request client", exitCriteria: [] },
        { id: "tracked_synthetic_fixtures", status: "GO", reason: "minimal synthetic shapes only; captured values are forbidden", exitCriteria: [] },
        { id: "official_version_catalog", status: "CONDITIONAL_GO", reason: "one exact official database/assets snapshot is structurally observed, not a sustained catalog", exitCriteria: ["store only sanitized version/root/hash/size metadata", "refresh remains manual and default-off"] },
        { id: "manual_sqlite_acquisition", status: "CONDITIONAL_GO", reason: "descriptor and exact CDN size are proved but signed URL material must stay ephemeral", exitCriteria: ["separate explicit authorization", "exact host/path allowlist", "temporary download then size/upstream-hash/SHA-256 validation", "no full URL in metadata"] },
        { id: "authenticated_refresh", status: "NO_GO", reason: "no approved non-personal ephemeral credential lifecycle, rotation, revocation or read-only contract", exitCriteria: ["independent legal/operational review", "non-personal secret lifecycle", "exact GET/POST read allowlist without account mutation"] },
        { id: "selective_asset_delivery", status: "NO_GO", reason: "the complete snapshot size is proved, but useful CPK families remain candidates without internal file identity or consumer binding", exitCriteria: ["container index and structural ID mapping", "bounded allowlist with per-family projected bytes", "cache/integrity tests"] },
        { id: "replace_fyi_or_dokkaninfo", status: "NO_GO", reason: "DD concerns acquisition/delivery and leaves presentation, schedule and reward coverage unresolved", exitCriteria: ["field-scoped sustained shadow parity", "consumer migration", "coverage closure"] },
        { id: "r2_publication", status: "NO_GO", reason: "no selected asset release, consumer approval or publisher dry-run", exitCriteria: ["separate authorization", "dry-run with object/byte projection", "stable content-addressed keys", "manifest-last promotion"] },
        { id: "android_shadow_mode", status: "NO_GO", reason: "Android unchanged and no optional asset/version sidecar contract is integrated", exitCriteria: ["missing/stale/unknown-schema/old-cache fallback tests", "separate Android authorization"] },
        { id: "full_automation", status: "NO_GO", reason: "authenticated acquisition, longitudinal catalog behavior, selective delivery and publication remain independent blockers", exitCriteria: ["all prior NO-GO exits independently satisfied", "scheduler/secret/rollback/monitoring review"] },
    ];
    return { schemaVersion: 1, contract: "dokkan-data-download-readiness", contractVersion: "0.9.0", generatedAt, dd6ArtifactSha256: (0, crypto_1.createHash)("sha256").update(dd6Text).digest("hex"), dd7ArtifactSha256: (0, crypto_1.createHash)("sha256").update(dd7Text).digest("hex"), defaultEnabled: false, productionMutation: false, decisions, campaignClosure: { currentEvidenceExhausted: true, additionalCaptureRequiredForCampaign: false, zeroConflictMeansComplete: false }, futureCaptureDependencies: [
            { id: "cold_warm_client_assets", requiredFor: "delta versus inventory and cache behavior", passiveUserDrivenOnly: true, retain: ["cold/warm body disposition", "sanitized descriptor identities", "304 validator relation names"], omit: ["validator values", "signed URLs", "credentials"] },
            { id: "later_official_version", requiredFor: "longitudinal version-catalog and descriptor-change semantics", passiveUserDrivenOnly: true, retain: ["sanitized version/root/hash/size relations", "aggregate family deltas"], omit: ["signed URLs", "credentials", "raw bodies in Git"] },
            { id: "natural_non_null_database_patch", requiredFor: "database patch contract", passiveUserDrivenOnly: true, retain: ["schema and sanitized path/hash/size metadata only"], omit: ["forcing old versions", "request replay", "patch bytes in Git", "credentials"] },
        ] };
}
exports.buildDd8 = buildDd8;
function validateDd8(value) { const failures = [], ids = new Set(); for (const decision of value.decisions) {
    if (ids.has(decision.id))
        failures.push("duplicate decision");
    ids.add(decision.id);
} if (!/^[a-f0-9]{64}$/.test(value.dd6ArtifactSha256) || !/^[a-f0-9]{64}$/.test(value.dd7ArtifactSha256) || value.defaultEnabled || value.productionMutation || value.decisions.length !== 10 || !value.campaignClosure.currentEvidenceExhausted || value.campaignClosure.additionalCaptureRequiredForCampaign || value.campaignClosure.zeroConflictMeansComplete || value.decisions.find(item => item.id === "authenticated_refresh")?.status !== "NO_GO" || value.decisions.find(item => item.id === "manual_sqlite_acquisition")?.status !== "CONDITIONAL_GO" || value.futureCaptureDependencies.some(item => !item.passiveUserDrivenOnly))
    failures.push("DD8 readiness policy"); return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], counts: { decisions: value.decisions.length, go: value.decisions.filter(item => item.status === "GO").length, conditionalGo: value.decisions.filter(item => item.status === "CONDITIONAL_GO").length, noGo: value.decisions.filter(item => item.status === "NO_GO").length, futureCaptureDependencies: value.futureCaptureDependencies.length } }; }
exports.validateDd8 = validateDd8;
//# sourceMappingURL=data-download-dd8.js.map