"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWt6 = exports.buildWt6 = exports.validateWt6Memory = void 0;
const crypto_1 = require("crypto");
const wt6_contract_1 = require("./wt6-contract");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const decisionPolicy = [
    ["authenticated_automation", "NO_GO"], ["finish_and_battle_results", "NO_GO"], ["android", "NO_GO"],
    ["reviewed_offline_default_off_integration", "GO"], ["production", "NO_GO"], ["publisher", "NO_GO"],
    ["r2", "NO_GO"], ["replace_current_sources", "NO_GO"], ["request_replay", "NO_GO"],
    ["sanitized_fixtures", "GO"], ["sign_decode_or_reproduction", "NO_GO"],
].sort((left, right) => left[0].localeCompare(right[0]));
function validateWt6Memory(memory) {
    const failures = [], gates = ["WT0", "WT1", "WT2", "WT3", "WT4", "WT5", "WT6"];
    if (memory.schemaVersion !== 1 || memory.contract !== "dokkan-world-tournament-memory-evidence" || memory.contractVersion !== "0.9.0" || memory.method !== "windows_process_tree_working_set_poll_15ms" || memory.limitBytes !== 1073741824 || !/^[a-f0-9]{64}$/.test(memory.sourceSha256) || !/^[a-f0-9]{64}$/.test(memory.artifactAggregateSha256) || !/^[a-f0-9]{64}$/.test(memory.implementationAggregateSha256) || JSON.stringify(memory.measurements.map(value => value.gate)) !== JSON.stringify(gates))
        failures.push("memory contract");
    if (memory.measurements.some(value => !Number.isSafeInteger(value.peakProcessTreeWorkingSetBytes) || value.peakProcessTreeWorkingSetBytes <= 0 || value.peakProcessTreeWorkingSetBytes >= memory.limitBytes || value.exitCode !== 0) || memory.observedMaxPeakBytes !== Math.max(...memory.measurements.map(value => value.peakProcessTreeWorkingSetBytes)))
        failures.push("memory boundary");
    return failures;
}
exports.validateWt6Memory = validateWt6Memory;
function buildWt6(source, lineage, aggregateSha256, implementationAggregateSha256, scan, memory) {
    const decisions = [
        { key: "authenticated_automation", status: "NO_GO", scope: "Credential acquisition or authenticated refresh automation.", rationale: "The capture proves no approved non-personal credential lifecycle.", exitCriteria: ["separate authorization and credential lifecycle review"] },
        { key: "finish_and_battle_results", status: "NO_GO", scope: "Finish endpoint, battle result or post-battle semantics.", rationale: "No finish request or battle result was observed.", exitCriteria: ["separate first-party capture with explicit scope"] },
        { key: "android", status: "NO_GO", scope: "Android consumer changes.", rationale: "Android was out of scope and unchanged.", exitCriteria: ["separate Android authorization and compatibility tests"] },
        { key: "reviewed_offline_default_off_integration", status: "GO", scope: "Reviewed additive TypeScript contracts, default-off runners and synthetic fixtures.", rationale: "The infrastructure is offline, fail-closed, deterministic and does not authorize a consumer or productive operation.", exitCriteria: [] },
        { key: "production", status: "NO_GO", scope: "Any production activation.", rationale: "Shadow evidence is partial and account/opaque surfaces remain non-authoritative.", exitCriteria: ["separate product and authority decision"] },
        { key: "publisher", status: "NO_GO", scope: "Any publisher integration or execution.", rationale: "No delivery contract or publication dry-run exists.", exitCriteria: ["explicit publication scope and dry-run"] },
        { key: "r2", status: "NO_GO", scope: "R2 reads or writes.", rationale: "R2 was excluded and untouched.", exitCriteria: ["explicit R2 authorization and projected-byte review"] },
        { key: "replace_current_sources", status: "NO_GO", scope: "Replace current database, server, FYI or DokkanInfo sources.", rationale: "The observed event has four coverage gaps and seven unjoinable parity cells.", exitCriteria: ["repeatable complete coverage and consumer migration parity"] },
        { key: "request_replay", status: "NO_GO", scope: "Replay any captured GET or POST.", rationale: "POST structure is evidence only and no request values are retained.", exitCriteria: ["new separately authorized safe protocol"] },
        { key: "sanitized_fixtures", status: "GO", scope: "Minimal schema-only and structural-ID fixtures.", rationale: "Captured sensitive values, raw bodies and personal scalars are absent.", exitCriteria: [] },
        { key: "sign_decode_or_reproduction", status: "NO_GO", scope: "Decode, reproduce or attribute internal meaning to sign.", rationale: "HTTP 200 proves acceptance and temporal order only.", exitCriteria: ["separate first-party semantic evidence"] },
    ].sort((left, right) => left.key.localeCompare(right.key));
    const dataset = {
        schemaVersion: 1, contract: "dokkan-world-tournament-readiness", contractVersion: "0.9.0", collectionMode: "offline_double_generation_no_requests", productionMutation: false, defaultEnabled: false, source, lineage, determinism: { passCount: 2, upstreamArtifactCount: 18, wt6OutputFileCount: 3, totalArtifactCount: 21, upstreamAggregateSha256: aggregateSha256, implementationAggregateSha256, upstreamByteIdentical: true, wt6OutputByteIdentical: true }, security: scan, memory, decisions,
        futureRefresh: { currentCampaignNeedsAdditionalHar: false, mode: "manual_offline_external_source_only", steps: ["place a future HAR outside the repository", "create a new external ignored source lock", "run WT0 through WT6 offline and serially", "require captured-value scan and contract review", "require two byte-identical generations and a sub-1-GiB peak"], authenticatedAutomation: false, requestsAllowed: false },
        stop: { gate: "WT6", executionIntegrationPerformed: false, integrationPolicy: "reviewed_offline_default_off_infrastructure_only" },
    };
    const validation = validateWt6(dataset);
    if (!validation.valid)
        throw new Error(`WT6 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildWt6 = buildWt6;
function validateWt6(dataset) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-world-tournament-readiness" || dataset.contractVersion !== "0.9.0" || dataset.collectionMode !== "offline_double_generation_no_requests" || dataset.productionMutation || dataset.defaultEnabled)
        failures.push("contract");
    if (dataset.source.sourceId !== "world-tournament-until-start-crash-2026-08-16" || !Number.isSafeInteger(dataset.source.sizeBytes) || dataset.source.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(dataset.source.sha256) || !Number.isSafeInteger(dataset.source.entryCount) || dataset.source.entryCount <= 0)
        failures.push("source");
    const expectedFiles = new Map([["WT0", ["wt0-inventory.json", "wt0-manifest.json", "wt0-validation.json"]], ["WT1", ["wt1-manifest.json", "wt1-route-catalog.json", "wt1-validation.json"]], ["WT2", ["wt2-event-entry-ranks.json", "wt2-manifest.json", "wt2-validation.json"]], ["WT3", ["wt3-manifest.json", "wt3-rankings-box-schedules.json", "wt3-validation.json"]], ["WT4", ["wt4-briefing-missions-start.json", "wt4-manifest.json", "wt4-validation.json"]], ["WT5", ["wt5-manifest.json", "wt5-shadow-parity.json", "wt5-validation.json"]]]);
    for (const [gate, names] of expectedFiles)
        if (JSON.stringify(dataset.lineage.filter(value => value.gate === gate).map(value => value.fileName)) !== JSON.stringify(names))
            failures.push("lineage members");
    if (dataset.lineage.length !== 18 || dataset.lineage.some(value => !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(value.sha256)) || new Set(dataset.lineage.map(value => `${value.gate}:${value.fileName}`)).size !== dataset.lineage.length)
        failures.push("lineage identity");
    const aggregate = hash(dataset.lineage.map(value => `${value.gate}/${value.fileName}\0${value.sizeBytes}\0${value.sha256}\n`).join(""));
    if (dataset.determinism.passCount !== 2 || dataset.determinism.upstreamArtifactCount !== 18 || dataset.determinism.wt6OutputFileCount !== 3 || dataset.determinism.totalArtifactCount !== 21 || !dataset.determinism.upstreamByteIdentical || !dataset.determinism.wt6OutputByteIdentical || dataset.determinism.upstreamAggregateSha256 !== aggregate || !/^[a-f0-9]{64}$/.test(dataset.determinism.implementationAggregateSha256))
        failures.push("determinism");
    const securityCategories = dataset.security.categoryTargetCounts, sourceCategories = dataset.security.sourceCategoryValueCounts;
    if (!dataset.security.valid || dataset.security.sensitiveMatchCount !== 0 || dataset.security.rawHarTargetCount !== 0 || dataset.security.harStructureTargetCount !== 2 || dataset.security.tipHarStructureTargetCount !== 0 || dataset.security.historicalHarAllowlistCount !== 2 || !dataset.security.historicalHarAllowlistSatisfied || JSON.stringify([...dataset.security.historicalHarTargetFingerprints].sort()) !== JSON.stringify([...wt6_contract_1.WT6_ALLOWED_HISTORICAL_HAR_TARGET_FINGERPRINTS].sort()) || dataset.security.commitCount !== 9 || dataset.security.targetCount <= 0 || dataset.security.uniqueBlobCount <= 0 || dataset.security.uniqueBlobCount > dataset.security.targetCount || securityCategories.tip <= 0 || securityCategories.history_old <= 0 || securityCategories.history_new <= 0 || dataset.security.sensitiveValueCount <= 0 || Object.keys(sourceCategories).sort().join(",") !== "cookies,headers,query,request_body,response_body,url_credentials,url_path" || Object.values(sourceCategories).some(value => !Number.isSafeInteger(value) || value < 0) || !dataset.security.allTrackedTipBlobsExamined || !dataset.security.allChangedHistoricalBlobsExamined || !dataset.security.noPathOrDocumentTypeExclusions || dataset.security.requestReplayImplemented || dataset.security.credentialFlowImplemented)
        failures.push("security");
    failures.push(...validateWt6Memory(dataset.memory));
    if (dataset.memory.sourceSha256 !== dataset.source.sha256 || dataset.memory.artifactAggregateSha256 !== dataset.determinism.upstreamAggregateSha256 || dataset.memory.implementationAggregateSha256 !== dataset.determinism.implementationAggregateSha256)
        failures.push("memory lineage");
    if (JSON.stringify(dataset.decisions.map(value => [value.key, value.status])) !== JSON.stringify(decisionPolicy) || dataset.decisions.some(value => !value.scope || !value.rationale))
        failures.push("readiness decisions");
    if (dataset.futureRefresh.currentCampaignNeedsAdditionalHar || dataset.futureRefresh.mode !== "manual_offline_external_source_only" || dataset.futureRefresh.authenticatedAutomation || dataset.futureRefresh.requestsAllowed || dataset.futureRefresh.steps.length !== 5)
        failures.push("future refresh");
    if (dataset.stop.gate !== "WT6" || dataset.stop.executionIntegrationPerformed || dataset.stop.integrationPolicy !== "reviewed_offline_default_off_infrastructure_only")
        failures.push("stop boundary");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], decisionCount: dataset.decisions.length, lineageCount: dataset.lineage.length, observedMaxPeakBytes: dataset.memory.observedMaxPeakBytes };
}
exports.validateWt6 = validateWt6;
//# sourceMappingURL=wt6-readiness.js.map