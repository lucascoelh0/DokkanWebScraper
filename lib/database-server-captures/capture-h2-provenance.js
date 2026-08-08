"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH2 = exports.buildCaptureH2 = void 0;
const crypto_1 = require("crypto");
function parseSchemaPath(value) {
    const separator = value.lastIndexOf(":");
    if (separator <= 0)
        return null;
    const jsonPath = value.slice(0, separator);
    const schemaType = value.slice(separator + 1);
    if (!jsonPath.startsWith("$") || !/^(?:array|boolean|number|null|object|string|redacted|undefined)$/.test(schemaType))
        return null;
    return { jsonPath, schemaType };
}
function captureTimestamp(observations) {
    const timestamps = observations.flatMap(value => [value.capturedAtStart, value.capturedAtEnd]).filter((value) => value !== null).sort((a, b) => a.localeCompare(b));
    if (timestamps.length === 0)
        throw new Error("H2 capture has no timestamp");
    return timestamps[0];
}
function factId(value) {
    const p = value.provenance;
    const identity = [p.captureId, p.captureFingerprint, p.captureSchemaFingerprint, p.method, p.normalizedEndpoint, p.httpStatus, p.jsonPath, value.schemaType, p.endpointClassification, p.observedAtStart, p.observedAtEnd].join("\n");
    return (0, crypto_1.createHash)("sha256").update(identity).digest("hex");
}
function buildCaptureH2(h1) {
    if (h1.contract !== "dokkan-official-capture-schema-only-sanitizer" || h1.contractVersion !== "0.2.0" || h1.productionMutation !== false || h1.valueFixtureCount !== 0)
        throw new Error("H2 requires validated schema-only H1");
    const facts = [];
    for (const capture of h1.captures) {
        const timestamp = captureTimestamp(capture.observations);
        for (const observation of capture.observations) {
            if (!["product_catalog", "mixed_product_and_user_state"].includes(observation.classification) || observation.responseBodyDisposition !== "schema_only" || !observation.capturedAtStart || !observation.capturedAtEnd)
                continue;
            for (const encoded of observation.responseSchema) {
                const schema = parseSchemaPath(encoded);
                if (!schema)
                    continue;
                const withoutId = {
                    factKind: "response_schema_presence",
                    schemaType: schema.schemaType,
                    provenance: {
                        captureId: capture.captureId,
                        captureFingerprint: capture.structuralFingerprint,
                        captureSchemaFingerprint: capture.schemaFingerprint,
                        normalizedEndpoint: observation.normalizedEndpoint,
                        method: observation.method,
                        captureTimestamp: timestamp,
                        observedAtStart: observation.capturedAtStart,
                        observedAtEnd: observation.capturedAtEnd,
                        httpStatus: observation.status,
                        jsonPath: schema.jsonPath,
                        endpointClassification: observation.classification,
                        confidence: observation.classification === "product_catalog" ? "partial" : "unknown",
                        userDerivedAuthority: false,
                        evidenceOrigin: "official_capture_sanitized_schema",
                    },
                };
                facts.push({ factId: factId(withoutId), ...withoutId });
            }
        }
    }
    const deduplicated = [...new Map(facts.map(value => [value.factId, value])).values()].sort((a, b) => a.factId.localeCompare(b.factId));
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-fact-provenance", contractVersion: "0.3.0", generatedAt: h1.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_sanitized_h1_no_requests", productionMutation: false, authority: "observed_schema_only_no_product_or_user_authority", identityPolicy: "fact_hash_uses_capture_schema_and_structural_endpoint_status_json_path_no_names_or_text", facts: deduplicated };
    const validation = validateCaptureH2(dataset, h1);
    if (!validation.valid)
        throw new Error(`H2 provenance validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildCaptureH2 = buildCaptureH2;
function expectedEvidence(h1) {
    const expected = new Map();
    for (const capture of h1.captures) {
        const timestamp = captureTimestamp(capture.observations);
        for (const observation of capture.observations) {
            if (!["product_catalog", "mixed_product_and_user_state"].includes(observation.classification) || observation.responseBodyDisposition !== "schema_only" || !observation.capturedAtStart || !observation.capturedAtEnd)
                continue;
            for (const encodedSchema of observation.responseSchema) {
                const schema = parseSchemaPath(encodedSchema);
                if (!schema)
                    continue;
                const key = [capture.captureId, capture.structuralFingerprint, capture.schemaFingerprint, observation.method, observation.normalizedEndpoint, observation.status, schema.jsonPath, schema.schemaType, observation.classification, observation.capturedAtStart, observation.capturedAtEnd].join("\n");
                expected.set(key, { captureTimestamp: timestamp, encodedSchema });
            }
        }
    }
    return expected;
}
function validateCaptureH2(dataset, h1) {
    const failures = [];
    const ids = new Set();
    const expected = expectedEvidence(h1);
    const matchedEvidence = new Set();
    let supportedCount = 0, partialCount = 0, unknownCount = 0, userDerivedAuthorityCount = 0;
    for (const fact of dataset.facts) {
        const p = fact.provenance;
        const { factId: _factId, ...withoutId } = fact;
        if (ids.has(fact.factId) || !/^[a-f0-9]{64}$/.test(fact.factId) || fact.factId !== factId(withoutId))
            failures.push("fact identity");
        ids.add(fact.factId);
        const evidenceKey = [p.captureId, p.captureFingerprint, p.captureSchemaFingerprint, p.method, p.normalizedEndpoint, p.httpStatus, p.jsonPath, fact.schemaType, p.endpointClassification, p.observedAtStart, p.observedAtEnd].join("\n");
        const evidence = expected.get(evidenceKey);
        if (!evidence || evidence.captureTimestamp !== p.captureTimestamp)
            failures.push("capture lineage");
        else
            matchedEvidence.add(evidenceKey);
        if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(p.captureId) || !/^[a-f0-9]{64}$/.test(p.captureFingerprint) || !/^[a-f0-9]{64}$/.test(p.captureSchemaFingerprint) || p.method !== "GET" || !/^\/(?:[a-z_]+|:id|:opaque)(?:\/(?:[a-z_]+|:id|:opaque))*$/.test(p.normalizedEndpoint) || !/^\$(?:(?:\[\]<(?:array|boolean|number|null|object|string)>|\.(?:[A-Za-z_][A-Za-z0-9_]*|\[(?:sensitive-key|unallowlisted-key)\])(?:\[\]<(?:array|boolean|number|null|object|string)>)?))*$/.test(p.jsonPath) || !Number.isSafeInteger(p.httpStatus) || p.httpStatus < 100 || p.httpStatus > 599 || Number.isNaN(Date.parse(p.captureTimestamp)) || Number.isNaN(Date.parse(p.observedAtStart)) || Number.isNaN(Date.parse(p.observedAtEnd)) || p.observedAtStart > p.observedAtEnd)
            failures.push("provenance shape");
        if (fact.factKind !== "response_schema_presence" || !/^(?:array|boolean|number|null|object|string|redacted|undefined)$/.test(fact.schemaType))
            failures.push("fact shape");
        if (!["product_catalog", "mixed_product_and_user_state"].includes(p.endpointClassification))
            failures.push("classification boundary");
        if (p.endpointClassification === "product_catalog" && p.confidence !== "partial")
            failures.push("product confidence boundary");
        if (p.endpointClassification === "mixed_product_and_user_state" && p.confidence !== "unknown")
            failures.push("mixed confidence boundary");
        if (p.userDerivedAuthority !== false)
            userDerivedAuthorityCount += 1;
        if (p.evidenceOrigin !== "official_capture_sanitized_schema")
            failures.push("value evidence prohibited");
        if (p.confidence === "supported")
            supportedCount += 1;
        else if (p.confidence === "partial")
            partialCount += 1;
        else
            unknownCount += 1;
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-fact-provenance" || dataset.contractVersion !== "0.3.0" || dataset.productionMutation !== false || dataset.authority !== "observed_schema_only_no_product_or_user_authority" || dataset.identityPolicy !== "fact_hash_uses_capture_schema_and_structural_endpoint_status_json_path_no_names_or_text")
        failures.push("dataset contract");
    if (dataset.facts.length === 0)
        failures.push("empty facts");
    if (matchedEvidence.size !== expected.size || dataset.facts.length !== expected.size)
        failures.push("evidence completeness");
    if (supportedCount !== 0)
        failures.push("unsupported promotion");
    if (userDerivedAuthorityCount !== 0)
        failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, factCount: dataset.facts.length, supportedCount, partialCount, unknownCount, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
exports.validateCaptureH2 = validateCaptureH2;
//# sourceMappingURL=capture-h2-provenance.js.map