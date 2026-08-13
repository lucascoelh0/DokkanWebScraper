"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd7 = exports.buildDd7 = void 0;
const crypto_1 = require("crypto");
function buildDd7(generatedAt, dd6Text) {
    const dataset = { schemaVersion: 1, contract: "dokkan-selective-official-refresh-architecture", contractVersion: "0.8.0", generatedAt, dd6ArtifactSha256: (0, crypto_1.createHash)("sha256").update(dd6Text).digest("hex"), designOnly: true, defaultEnabled: false, productionMutation: false, authenticatedClientImplemented: false, stages: [
            [1, "authorized_version_discovery", "manual or separately authorized discovery; signed URLs and credentials stay in memory"], [2, "sqlite_acquisition", "download to ephemeral temporary storage through exact official host/path allowlist"], [3, "size_hash_validation", "require descriptor version/algorithm/hash/size and independently compute SHA-256"], [4, "selective_family_allowlist", "select only proved useful families with projected bytes"], [5, "incremental_cache", "content-addressed local cache keyed by stable descriptor identity; delivery URL is never identity"], [6, "db_first_generation", "readable SQLite to existing first-party export contract"], [7, "shadow_comparison", "compare structural IDs and field-scoped evidence without name joins"], [8, "tests", "focused contracts, old-cache/missing-sidecar compatibility and deterministic reconstruction"], [9, "dry_run", "project object count, bytes, conflicts and R2 upper bound without writes"], [10, "separate_publication", "separately authorized manifest-last publication only"],
        ].map(([order, id, boundary]) => ({ order: order, id: id, boundary: boundary, status: "design_only" })), separations: [
            { concern: "authenticated_acquisition", credentialPolicy: "future non-personal ephemeral secrets only; never HAR credentials, CLI args, URLs, logs or artifacts", authority: "official transport metadata only after independent authorization" },
            { concern: "offline_transformation", credentialPolicy: "no credentials available", authority: "validated SQLite and allowlisted asset bytes only" },
            { concern: "r2_publication", credentialPolicy: "bucket-scoped publisher secrets in separate workflow", authority: "validated project artifacts; never upstream credentials" },
            { concern: "android_consumption", credentialPolicy: "no upstream or publisher credentials", authority: "optional project manifest with missing/stale/old-cache fallback" },
        ], allowlist: ["database", "character_thumbs", "card_art", "event_banner_images", "item_images"], retention: { policy: "retain current validated SQLite plus one prior rollback input; retain only content-addressed project assets referenced by active/previous releases", neverStore: ["complete_22349705433_byte_asset_inventory", "complete_optional_asset_catalog", "bgm", "videos", "battle_sprites", "unused_cpk_packages", "signed_urls"], budget: "project every acquisition/publication; keep R2 comfortably below 10 GB" }, failurePolicy: ["unknown_schema_stops_family", "unknown_encoding_stops_family", "credential_or_account_dependency_stops_automation", "size_hash_version_mismatch_rejects_bytes", "unprojectable_batch_stops_before_download", "publication_requires_independent_authorization"] };
    const validation = validateDd7(dataset);
    if (!validation.valid)
        throw new Error(`DD7 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd7 = buildDd7;
function validateDd7(value) { const failures = []; if (!/^[a-f0-9]{64}$/.test(value.dd6ArtifactSha256) || !value.designOnly || value.defaultEnabled || value.productionMutation || value.authenticatedClientImplemented || value.stages.length !== 10 || value.stages.some((stage, index) => stage.order !== index + 1 || stage.status !== "design_only") || value.separations.length !== 4 || !value.retention.neverStore.includes("complete_optional_asset_catalog") || !value.failurePolicy.includes("publication_requires_independent_authorization"))
    failures.push("DD7 architecture contract"); return { schemaVersion: 1, valid: failures.length === 0, failures, counts: { stages: value.stages.length, separations: value.separations.length, allowlistedFamilies: value.allowlist.length } }; }
exports.validateDd7 = validateDd7;
//# sourceMappingURL=data-download-dd7.js.map