"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCaptureH1 = void 0;
const capture_h0_audit_1 = require("./capture-h0-audit");
function disposition(entry, side) {
    const present = side === "request" ? entry.requestBodyPresent : entry.responseBodyPresent;
    const schema = side === "request" ? entry.requestBodySchema : entry.responseBodySchema;
    if (!present)
        return "absent";
    if (side === "request" && ["auth", "mutation", "user_state"].includes(entry.classification))
        return "omitted_by_classification";
    return schema.length > 0 ? "schema_only" : "non_json_or_unavailable_omitted";
}
function observation(entry) {
    return {
        hostClass: entry.hostClass,
        method: entry.method,
        normalizedEndpoint: entry.normalizedEndpoint,
        classification: entry.classification,
        status: entry.status,
        count: 1,
        capturedAtStart: entry.capturedAt,
        capturedAtEnd: entry.capturedAt,
        queryKeys: entry.queryKeys,
        requestBodyDisposition: disposition(entry, "request"),
        responseBodyDisposition: disposition(entry, "response"),
        requestSchema: ["auth", "mutation", "user_state"].includes(entry.classification) ? [] : entry.requestBodySchema,
        responseSchema: entry.responseBodySchema,
    };
}
function aggregate(entries) {
    const groups = new Map();
    for (const entry of entries) {
        const next = observation(entry);
        const identity = JSON.stringify({ ...next, count: 0, capturedAtStart: null, capturedAtEnd: null });
        const current = groups.get(identity);
        if (!current) {
            groups.set(identity, next);
        }
        else {
            current.count += 1;
            const timestamps = [current.capturedAtStart, current.capturedAtEnd, next.capturedAtStart, next.capturedAtEnd].filter((value) => value !== null).sort((a, b) => a.localeCompare(b));
            current.capturedAtStart = timestamps.at(0) ?? null;
            current.capturedAtEnd = timestamps.at(-1) ?? null;
        }
    }
    return [...groups.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function buildCaptureH1(manifest, roots, h0) {
    if (h0.contract !== "dokkan-official-capture-structural-inventory" || h0.contractVersion !== "0.1.1" || h0.productionMutation !== false || h0.captures.length !== manifest.captures.length)
        throw new Error("H1 requires a validated H0 inventory");
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("H1 input root is not allowlisted");
    const captures = manifest.captures.map(input => {
        const lineage = h0.captures.find(value => value.captureId === input.captureId);
        if (!lineage)
            throw new Error(`H1 missing H0 lineage for ${input.captureId}`);
        const loaded = (0, capture_h0_audit_1.loadSanitizedCaptureEntries)(root, input.path, input.captureId);
        const current = (0, capture_h0_audit_1.auditSanitizedCaptureEntries)(input.captureId, loaded.sizeBytes, loaded.entryCount, loaded.entries, loaded.sourceIdentityFingerprint);
        if (current.entryCount !== lineage.entryCount || current.sizeBytes !== lineage.sizeBytes || current.structuralFingerprint !== lineage.structuralFingerprint || current.schemaFingerprint !== lineage.schemaFingerprint || current.sourceIdentityFingerprint !== lineage.sourceIdentityFingerprint)
            throw new Error(`H1 capture drift for ${input.captureId}`);
        return { captureId: input.captureId, structuralFingerprint: lineage.structuralFingerprint, schemaFingerprint: lineage.schemaFingerprint, observations: aggregate(loaded.entries) };
    }).sort((a, b) => a.captureId.localeCompare(b.captureId));
    return {
        schemaVersion: 1,
        contract: "dokkan-official-capture-schema-only-sanitizer",
        contractVersion: "0.2.0",
        generatedAt: h0.generatedAt,
        generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes",
        collectionMode: "offline_local_har_no_requests",
        productionMutation: false,
        valueFixtureCount: 0,
        authority: "schema_only_no_user_derived_authority",
        sanitization: {
            headers: "omitted",
            cookies: "omitted",
            queryValues: "omitted_key_names_only",
            sensitiveAndUnknownBodyKeys: "collapsed_before_output",
            authMutationUserRequestBodies: "omitted",
            valueFixtures: "deny_by_default_explicit_public_product_allowlist_required",
        },
        captures,
    };
}
exports.buildCaptureH1 = buildCaptureH1;
//# sourceMappingURL=capture-h1-sanitizer.js.map