"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd3 = exports.buildDd3 = void 0;
const relevant = new Set(["/auth/nonce", "/auth/sign_in", "/user", "/user/succeeds", "/user/succeed/google/validate", "/user/succeed/google", "/cards", "/resources/login", "/client_assets/database", "/client_assets", "/ondemand_assets"]);
function buildDd3(dd1, dd2) {
    const ui = new Map([["incremental", null], ["clean_install", 4868], ["download_all", 25233]]);
    const states = {
        incremental: { status: "partial", value: "authenticated_existing_install_with_incremental_manifest_response_observed" },
        clean_install: { status: "partial", value: "user_driven_clean_install_with_account_transfer_and_ondemand_request_observed" },
        download_all: { status: "partial", value: "user_driven_download_all_with_client_and_ondemand_requests_observed" },
    };
    const modes = ["incremental", "clean_install", "download_all"].map(captureId => {
        const entries = dd1.entries.filter(value => value.captureId === captureId);
        return { captureId, uiFileCount: ui.get(captureId), sequence: entries.filter(value => relevant.has(value.pathname)).map(value => ({ entryIndex: value.entryIndex, method: value.method, pathname: value.pathname, status: value.status, responseState: value.response.disposition })), cdnRequestCount: entries.filter(value => value.scope === "cdn").length, observedMutationCount: entries.filter(value => value.mutationObservedOnly).length, apparentClientState: states[captureId], selectionEvidence: captureId === "incremental" ? ["client_assets_body_with_25_descriptors", "database_descriptor", "version_header_names"] : captureId === "clean_install" ? ["ui_file_count_4868", "external_ondemand_body_with_4868_descriptors", "captured_cdn_prefix_only"] : ["ui_file_count_25233", "external_client_assets_body_with_25233_descriptors", "external_ondemand_body_identity_matches_clean_install", "mandatory_set_is_exact_subset_of_full_inventory", "audio_cdn_prefix_observed"] };
    });
    const relevantEntries = dd1.entries.filter(value => ["/client_assets", "/client_assets/database", "/ondemand_assets"].includes(value.pathname));
    const versionHeaders = ["x-assetversion", "x-databaseversion", "x-clientversion", "x-requestversion"].map(name => ({ name, observedOnRelevantRequestCount: relevantEntries.filter(value => value.safeRequestHeaderNames.includes(name)).length, semantics: "partial" }));
    const proof = dd2.clientAssets.deviceAssetSizeBytesQuery.captureSpecificProof;
    if (!proof || !dd2.clientAssets.externalFullManifest || !dd2.ondemand.externalBodyEvidence)
        throw new Error("DD3 requires pinned external manifest summaries");
    const dataset = { schemaVersion: 1, contract: "dokkan-data-download-acquisition-modes", contractVersion: "0.4.0", generatedAt: dd2.generatedAt, collectionMode: "offline_sanitized_dd1_dd2_no_requests_no_replay", defaultEnabled: false, productionMutation: false, modes, deviceAssetSizeBytes: { status: "supported", observedType: dd2.clientAssets.deviceAssetSizeBytesQuery.observedType, relation: dd2.clientAssets.deviceAssetSizeBytesQuery.crossObservationRelation, captureSpecificRelation: "mandatory_assets_plus_database_equals_observed_query", mandatoryAssetSizeBytes: proof.mandatoryAssetSizeBytes, databaseSizeBytes: proof.databaseSizeBytes, queryValuePersisted: false, universalRule: "unknown" }, versionHeaders, endpointRoles: [
            { endpoint: "/client_assets", status: "partial", proved: ["GET transport", "incremental response contains 25 size/hash/path descriptors", "download_all external body contains 25233 unique descriptors", "latest_version agrees across observed bodies", "mandatory set is an exact subset in this snapshot"], unknown: ["delta versus inventory semantics across versions", "selection algorithm", "longitudinal catalog behavior"] },
            { endpoint: "/client_assets/database", status: "supported", proved: ["GET transport", "two agreeing descriptors", "versioned CDN database path", "full database response observed"], unknown: ["credential lifecycle", "patch behavior beyond observed null fields"] },
            { endpoint: "/ondemand_assets", status: "partial", proved: ["POST transport observed", "request body presence only", "two external bodies each contain the same 4868 structural descriptors", "all delivery URLs differ and are not identity", "three observed mandatory categories"], unknown: ["request selector semantics", "universality outside these captures", "context and future-version behavior"] },
        ] };
    const validation = validateDd3(dataset);
    if (!validation.valid)
        throw new Error(`DD3 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd3 = buildDd3;
function validateDd3(value) { const failures = []; if (value.schemaVersion !== 1 || value.contractVersion !== "0.4.0" || value.defaultEnabled || value.productionMutation || value.modes.length !== 3 || value.modes.some(mode => mode.sequence.some((item, index, all) => index > 0 && item.entryIndex <= all[index - 1].entryIndex)) || value.endpointRoles.find(item => item.endpoint === "/ondemand_assets")?.status !== "partial" || value.deviceAssetSizeBytes.queryValuePersisted !== false || value.deviceAssetSizeBytes.universalRule !== "unknown" || value.deviceAssetSizeBytes.mandatoryAssetSizeBytes + value.deviceAssetSizeBytes.databaseSizeBytes <= 0)
    failures.push("DD3 conservative contract"); return { schemaVersion: 1, valid: failures.length === 0, failures, counts: { modes: value.modes.length, milestones: value.modes.reduce((sum, mode) => sum + mode.sequence.length, 0), versionHeaders: value.versionHeaders.length } }; }
exports.validateDd3 = validateDd3;
//# sourceMappingURL=data-download-dd3.js.map