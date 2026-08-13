"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd5 = exports.buildDd5 = void 0;
function headers(value) { const out = new Map(); if (Array.isArray(value))
    for (const item of value)
        if (typeof item?.name === "string" && typeof item?.value === "string")
            out.set(item.name.toLowerCase(), item.value); return out; }
function root(pathname) { const match = pathname.match(/^\/(assets|sqlite)\/current\/en\/([0-9]{8}-[0-9]{6})(?:\/|$)/); return match ? { kind: match[1], pathnameRoot: `/${match[1]}/current/en/${match[2]}/` } : null; }
function buildDd5(loaded, dd1, dd2) {
    let etagResponseCount = 0, lastModifiedResponseCount = 0, ifNoneMatchRequestCount = 0, ifModifiedSinceRequestCount = 0, notModifiedCount = 0, sameEntryIfNoneMatchEtagAgreementCount = 0;
    for (const source of loaded)
        for (const entry of source.har.log.entries) {
            const request = headers(entry?.request?.headers), response = headers(entry?.response?.headers);
            if (response.has("etag"))
                etagResponseCount++;
            if (response.has("last-modified"))
                lastModifiedResponseCount++;
            if (request.has("if-none-match"))
                ifNoneMatchRequestCount++;
            if (request.has("if-modified-since"))
                ifModifiedSinceRequestCount++;
            if (entry?.response?.status === 304) {
                notModifiedCount++;
                if (request.has("if-none-match") && response.has("etag") && request.get("if-none-match") === response.get("etag"))
                    sameEntryIfNoneMatchEtagAgreementCount++;
            }
        }
    const roots = new Map();
    for (const entry of dd1.entries.filter(value => value.scope === "cdn")) {
        const parsed = root(entry.pathname);
        if (!parsed)
            continue;
        const key = `${parsed.kind}:${parsed.pathnameRoot}`, current = roots.get(key) ?? { ...parsed, observationCount: 0, cachePolicy: "content_stable_candidate_requires_byte_hash_validation" };
        current.observationCount++;
        roots.set(key, current);
    }
    const clientAlgorithms = [...new Set(dd2.clientAssets.assets.map(value => value.algorithm))], databaseAlgorithms = [...new Set(dd2.database.descriptors.map(value => value.algorithm))], databaseVersions = [...new Set(dd2.database.descriptors.map(value => value.version))], databaseHashes = [...new Set(dd2.database.descriptors.map(value => value.upstreamHashOpaque))], full = dd2.clientAssets.externalFullManifest, ondemand = dd2.ondemand.externalBodyEvidence;
    if (clientAlgorithms.length !== 1 || databaseAlgorithms.length !== 1 || databaseVersions.length !== 1 || databaseHashes.length !== 1 || !full || !ondemand)
        throw new Error("DD5 incompatible manifest integrity observations");
    const relation = full.mandatoryOndemandRelation;
    const dataset = { schemaVersion: 1, contract: "dokkan-data-download-cache-integrity", contractVersion: "0.6.0", generatedAt: dd2.generatedAt, collectionMode: "offline_in_memory_validator_comparison_no_requests", defaultEnabled: false, productionMutation: false, validatorObservations: { etagResponseCount, lastModifiedResponseCount, ifNoneMatchRequestCount, ifModifiedSinceRequestCount, notModifiedCount, sameEntryIfNoneMatchEtagAgreementCount, valuesPersisted: false }, versionedRoots: [...roots.values()].sort((a, b) => a.pathnameRoot.localeCompare(b.pathnameRoot)), manifestIdentity: { stableAssetIdentity: "file_path_algorithm_hash_size", deliveryUrlPolicy: "ephemeral_non_identity_not_persisted", mandatoryIdentityAcrossBodies: ondemand.identityAcrossObservations, fullManifestRelation: relation.relation, fullDescriptorCount: full.descriptorCount, mandatoryDescriptorCount: relation.mandatoryCount, deltaDescriptorCount: relation.deltaCount, fullSizeBytes: full.totalSizeBytes, mandatorySizeBytes: relation.mandatorySizeBytes, deltaSizeBytes: relation.deltaSizeBytes }, integrity: { clientAssetAlgorithm: clientAlgorithms[0], databaseAlgorithm: databaseAlgorithms[0], databaseVersion: databaseVersions[0], databaseHashEqualsVersionString: databaseHashes[0] === String(databaseVersions[0]), localSourceIdentity: "sha256", upstreamHashAuthority: "opaque_algorithm_scoped_only", patch: "descriptor_and_hash_observed_null_no_patch_support_claim" }, failClosedRules: ["reject_unknown_manifest_schema_or_encoding", "reject_non_allowlisted_or_escaping_path", "reject_size_hash_or_version_mismatch", "reject_duplicate_path_with_incompatible_metadata", "retain_304_as_not_modified_not_empty_body", "treat_delivery_url_change_as_non_identity_when_descriptor_identity_agrees", "download_to_temporary_file_validate_then_atomically_promote", "never_log_or_persist_signed_query_values"] };
    const validation = validateDd5(dataset);
    if (!validation.valid)
        throw new Error(`DD5 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd5 = buildDd5;
function validateDd5(value) { const failures = []; if (value.defaultEnabled || value.productionMutation || value.validatorObservations.valuesPersisted || value.validatorObservations.notModifiedCount !== 9 || value.validatorObservations.sameEntryIfNoneMatchEtagAgreementCount > value.validatorObservations.notModifiedCount || value.versionedRoots.length !== 2 || value.manifestIdentity.deliveryUrlPolicy !== "ephemeral_non_identity_not_persisted" || value.manifestIdentity.fullDescriptorCount - value.manifestIdentity.mandatoryDescriptorCount !== value.manifestIdentity.deltaDescriptorCount || value.manifestIdentity.fullSizeBytes - value.manifestIdentity.mandatorySizeBytes !== value.manifestIdentity.deltaSizeBytes || value.integrity.patch !== "descriptor_and_hash_observed_null_no_patch_support_claim" || value.failClosedRules.length < 7)
    failures.push("DD5 cache contract"); return { schemaVersion: 1, valid: failures.length === 0, failures, counts: { validatorObservations: value.validatorObservations.etagResponseCount + value.validatorObservations.lastModifiedResponseCount + value.validatorObservations.ifNoneMatchRequestCount + value.validatorObservations.ifModifiedSinceRequestCount, notModified: value.validatorObservations.notModifiedCount, roots: value.versionedRoots.length, fullManifestDescriptors: value.manifestIdentity.fullDescriptorCount } }; }
exports.validateDd5 = validateDd5;
//# sourceMappingURL=data-download-dd5.js.map