"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF6 = exports.buildFrontierF6 = exports.frontierF6Decisions = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function frontierF6Decisions() {
    return [
        { id: "merge_disabled_infrastructure", status: "GO", reason: "offline-only additive contracts are default-off, fail closed and have no request or replay path" },
        { id: "offline_decoder_real_bodies", status: "NO_GO", reason: "no explicitly pinned dictionary, approved decompression provider or green real-body decode receipt exists" },
        { id: "tracked_sanitized_fixtures", status: "GO", reason: "tracked fixture is synthetic, minimal and contains no captured scalar values" },
        { id: "replace_e0_e9_data", status: "NO_GO", reason: "capture is bounded, two pages and five battles are uncovered, and server/account authority is incomplete" },
        { id: "android_shadow", status: "NO_GO", reason: "Android is out of scope and optional, missing and old-cache compatibility was not integration tested" },
        { id: "publish_r2", status: "NO_GO", reason: "publication is out of scope and no publisher dry-run, projected bytes or stable-key cache plan exists" },
        { id: "automated_refresh", status: "NO_GO", reason: "no approved non-personal credential lifecycle, read allowlist or rotation and revocation design exists" },
        { id: "battle_protocol_consumption", status: "NO_GO", reason: "responses remain compressed_unknown and observed order proves no gameplay semantics, RNG or client authority" },
        { id: "battle_replay_or_automation", status: "NO_GO", reason: "replay, bots, battle clients and command automation are explicitly prohibited" },
    ];
}
exports.frontierF6Decisions = frontierF6Decisions;
function artifact(gate, fileName, text) { return { gate, fileName, sizeBytes: buffer_1.Buffer.byteLength(text), sha256: sha256(text) }; }
function buildFrontierF6(input) {
    if (![input.f0.valid, input.f1Validation.valid, input.f2.valid, input.f3.valid, input.f4.valid, input.f5Validation.valid].every(Boolean))
        throw new Error("F6 requires green F0-F5 validations");
    const fixture = JSON.parse(input.fixtureText);
    if (fixture.schemaVersion !== 1 || fixture.synthetic !== true || fixture.valuePolicy !== "no_real_capture_values")
        throw new Error("F6 fixture contract mismatch");
    const dataset = { schemaVersion: 1, contract: "dokkan-frontier-capture-readiness", contractVersion: "0.7.0", generatedAt: input.generatedAt, generatedAtPolicy: "inherits_f5_capture_timestamp", collectionMode: "offline_local_artifacts_no_requests_no_replay", productionMutation: false, defaultEnabled: false, dictionary: { observedId: input.f1.dictionary.observedDictionaryId, identityStatus: "unknown", realBodyDecodeStatus: "compressed_unknown", decoderReadinessBoundary: "requires_explicit_pinned_dictionary_approved_provider_and_green_decode_receipt" }, coverage: { harEntries: input.f0.entryCount, zstdBodies: input.f1Validation.bodyCount, schemas: input.f2.routeSchemaCount, series: input.f3.seriesCount, episodes: input.f3.episodeCount, detailedPages: input.f3.pageCount, observedBattles: input.f3.battleCount, databaseBattles: input.f5.universe.battles, protocolOperations: input.f4.operationCount, parityFacts: input.f5Validation.factCount, parityByClassification: input.f5.summary }, artifacts: input.artifactTexts.map(value => artifact(value.gate, value.fileName, value.text)).sort((a, b) => a.gate.localeCompare(b.gate)), fixture: { fileName: "frontier-synthetic-shapes.json", sizeBytes: buffer_1.Buffer.byteLength(input.fixtureText), sha256: sha256(input.fixtureText), synthetic: true }, memory: input.memory, decisions: frontierF6Decisions(), risks: [
            { id: "dictionary_identity_unavailable", severity: "high", boundary: "all 20 battle responses remain compressed_unknown; no brute force or name-based candidate accepted" },
            { id: "battle_semantics_unproved", severity: "high", boundary: "request order does not establish causality, RNG, damage rules, replayability or client authority" },
            { id: "enemy_representation_mismatch", severity: "medium", boundary: "43 display enemy card references differ from E3 encounter arrays and are not conflicts" },
            { id: "bounded_temporal_capture", severity: "medium", boundary: "account state and capture-time availability are observations, never universal product facts" },
            { id: "asset_and_reward_coverage", severity: "medium", boundary: "news CDN paths are unjoinable to E6 and finish rewards remain unavailable" },
        ] };
    const validation = validateFrontierF6(dataset);
    if (!validation.valid)
        throw new Error(`F6 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildFrontierF6 = buildFrontierF6;
function validateFrontierF6(dataset) { const failures = [], expected = new Map(frontierF6Decisions().map(value => [value.id, value.status])), ids = new Set(); if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-capture-readiness" || dataset.contractVersion !== "0.7.0" || dataset.generatedAtPolicy !== "inherits_f5_capture_timestamp" || dataset.collectionMode !== "offline_local_artifacts_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || !Number.isFinite(Date.parse(dataset.generatedAt)))
    failures.push("dataset contract"); for (const decision of dataset.decisions) {
    if (ids.has(decision.id) || expected.get(decision.id) !== decision.status)
        failures.push("decision policy");
    ids.add(decision.id);
} if (ids.size !== expected.size)
    failures.push("decision set"); if (dataset.dictionary.identityStatus !== "unknown" || dataset.dictionary.realBodyDecodeStatus !== "compressed_unknown" || dataset.dictionary.decoderReadinessBoundary !== "requires_explicit_pinned_dictionary_approved_provider_and_green_decode_receipt" || expected.get("offline_decoder_real_bodies") !== "NO_GO")
    failures.push("dictionary readiness"); const measuredMaximum = Math.max(...dataset.memory.measurements.map(value => value.peakWorkingSetBytes)); if (dataset.memory.schemaVersion !== 1 || dataset.memory.contract !== "dokkan-frontier-capture-memory-evidence" || dataset.memory.contractVersion !== "0.7.0" || dataset.memory.limitBytes !== 1073741824 || dataset.memory.withinLimit !== true || dataset.memory.maximumPeakWorkingSetBytes !== measuredMaximum || measuredMaximum >= dataset.memory.limitBytes)
    failures.push("memory evidence"); if (dataset.artifacts.length !== 6 || new Set(dataset.artifacts.map(value => value.gate)).size !== 6 || dataset.artifacts.some(value => value.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(value.sha256)) || dataset.fixture.synthetic !== true || !/^[a-f0-9]{64}$/.test(dataset.fixture.sha256))
    failures.push("artifact evidence"); return { schemaVersion: 1, valid: failures.length === 0, decisionCount: dataset.decisions.length, goCount: dataset.decisions.filter(value => value.status === "GO").length, noGoCount: dataset.decisions.filter(value => value.status === "NO_GO").length, artifactCount: dataset.artifacts.length, maximumPeakWorkingSetBytes: dataset.memory.maximumPeakWorkingSetBytes, failures: [...new Set(failures)] }; }
exports.validateFrontierF6 = validateFrontierF6;
//# sourceMappingURL=frontier-f6-readiness.js.map