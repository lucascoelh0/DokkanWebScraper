"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupProductFacts = exports.makeProductFact = exports.productFactId = exports.capturePublicValueFingerprints = exports.productValueEvidenceSha256 = exports.forEachCaptureProductResponse = void 0;
const crypto_1 = require("crypto");
const capture_h0_audit_1 = require("./capture-h0-audit");
function exactH0Lineage(expected, current) {
    if (expected.contract !== current.contract || expected.contractVersion !== current.contractVersion || expected.captures.length !== current.captures.length)
        throw new Error("product projection H0 contract drift");
    for (const capture of current.captures) {
        const prior = expected.captures.find(value => value.captureId === capture.captureId);
        if (!prior || prior.sizeBytes !== capture.sizeBytes || prior.entryCount !== capture.entryCount || prior.structuralFingerprint !== capture.structuralFingerprint || prior.schemaFingerprint !== capture.schemaFingerprint || prior.sourceIdentityFingerprint !== capture.sourceIdentityFingerprint)
            throw new Error(`product projection capture drift for ${capture.captureId}`);
    }
}
function forEachCaptureProductResponse(manifest, roots, h0, handler) {
    const current = (0, capture_h0_audit_1.auditCaptureManifest)(manifest, roots);
    exactH0Lineage(h0, current);
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("product projection root is not allowlisted");
    for (const input of manifest.captures) {
        const lineage = current.captures.find(value => value.captureId === input.captureId);
        if (!lineage.capturedAtStart)
            throw new Error(`capture ${input.captureId} has no timestamp`);
        const snapshot = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)(root, input.path, input.captureId);
        if (snapshot.sourceIdentityFingerprint !== lineage.sourceIdentityFingerprint)
            throw new Error(`product projection source identity drift for ${input.captureId}`);
        const har = JSON.parse(snapshot.text);
        if (!Array.isArray(har?.log?.entries))
            throw new Error(`capture ${input.captureId} is invalid`);
        for (const rawEntry of har.log.entries) {
            const safe = (0, capture_h0_audit_1.sanitizeHarEntryStructure)(rawEntry);
            if (!safe || safe.method !== "GET" || safe.status < 200 || safe.status > 299 || !safe.capturedAt || !["product_catalog", "mixed_product_and_user_state", "asset_delivery"].includes(safe.classification))
                continue;
            let url;
            try {
                url = new URL(rawEntry?.request?.url);
            }
            catch {
                continue;
            }
            let body = null;
            const text = rawEntry?.response?.content?.text;
            const mimeType = rawEntry?.response?.content?.mimeType;
            if (url.hostname === "ishin-global.aktsk.com" && typeof text === "string" && text.length <= 32 * 1024 * 1024 && typeof mimeType === "string" && mimeType.toLowerCase().startsWith("application/json")) {
                try {
                    body = JSON.parse(text);
                }
                catch {
                    continue;
                }
            }
            handler({ captureId: input.captureId, captureFingerprint: lineage.structuralFingerprint, captureSchemaFingerprint: lineage.schemaFingerprint, captureSourceIdentityFingerprint: lineage.sourceIdentityFingerprint, captureTimestamp: lineage.capturedAtStart, normalizedEndpoint: safe.normalizedEndpoint, method: "GET", observedAt: safe.capturedAt, httpStatus: safe.status, endpointClassification: safe.classification, hostname: url.hostname, pathname: url.pathname, body });
        }
    }
}
exports.forEachCaptureProductResponse = forEachCaptureProductResponse;
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function productValueEvidenceSha256(field, value, jsonPath) {
    return sha256([field, jsonPath, JSON.stringify(value)].join("\n"));
}
exports.productValueEvidenceSha256 = productValueEvidenceSha256;
function projectionRow(entityType, entityId, fact) {
    const p = fact.provenance;
    return [entityType, entityId, fact.field, JSON.stringify(fact.value), p.captureId, p.captureFingerprint, p.captureSchemaFingerprint, p.captureSourceIdentityFingerprint, p.normalizedEndpoint, p.observedAt, p.httpStatus, p.jsonPath, p.valueEvidenceSha256].join("\n");
}
function capturePublicValueFingerprints(entities) {
    const rows = new Map();
    for (const entity of entities)
        for (const fact of entity.facts)
            rows.set(fact.provenance.captureId, [...(rows.get(fact.provenance.captureId) ?? []), projectionRow(entity.entityType, entity.entityId, fact)]);
    return new Map([...rows].map(([captureId, values]) => [captureId, sha256(values.sort((a, b) => a.localeCompare(b)).join("\n"))]));
}
exports.capturePublicValueFingerprints = capturePublicValueFingerprints;
function productFactId(entityType, entityId, fact) {
    const p = fact.provenance;
    return sha256([projectionRow(entityType, entityId, { factId: "", ...fact }), p.capturePublicValueFingerprint, p.captureTimestamp, p.endpointClassification, p.confidence].join("\n"));
}
exports.productFactId = productFactId;
function makeProductFact(entityType, entityId, field, value, context, jsonPath) {
    if (!Number.isSafeInteger(entityId) || entityId <= 0 || !field || !jsonPath.startsWith("$") || context.method !== "GET" || !["product_catalog", "mixed_product_and_user_state"].includes(context.endpointClassification))
        throw new Error("invalid allowlisted product fact coordinates");
    const endpointClassification = context.endpointClassification;
    if (typeof value === "string" && (value.length > 128 || /(?:token|authorization|cookie|signature|session)/i.test(value)))
        throw new Error("unsafe product fact string");
    if (Array.isArray(value) && (value.length > 4096 || value.some(item => typeof item === "string" ? item.length > 32 : !Number.isSafeInteger(item))))
        throw new Error("unsafe product fact array");
    const provenance = { captureId: context.captureId, captureFingerprint: context.captureFingerprint, captureSchemaFingerprint: context.captureSchemaFingerprint, captureSourceIdentityFingerprint: context.captureSourceIdentityFingerprint, capturePublicValueFingerprint: "", normalizedEndpoint: context.normalizedEndpoint, method: "GET", captureTimestamp: context.captureTimestamp, observedAt: context.observedAt, httpStatus: context.httpStatus, jsonPath, endpointClassification, confidence: "partial", userDerivedAuthority: false, evidenceOrigin: "official_capture_allowlisted_product_value", valueEvidenceSha256: productValueEvidenceSha256(field, value, jsonPath) };
    return { factId: "", field, value, provenance };
}
exports.makeProductFact = makeProductFact;
function groupProductFacts(values) {
    const entities = new Map();
    for (const value of values) {
        const key = `${value.entityType}:${value.entityId}`;
        const entity = entities.get(key) ?? { entityType: value.entityType, entityId: value.entityId, facts: [] };
        const duplicate = entity.facts.some(fact => fact.field === value.fact.field && JSON.stringify(fact.value) === JSON.stringify(value.fact.value) && fact.provenance.captureId === value.fact.provenance.captureId && fact.provenance.normalizedEndpoint === value.fact.provenance.normalizedEndpoint && fact.provenance.observedAt === value.fact.provenance.observedAt && fact.provenance.jsonPath === value.fact.provenance.jsonPath);
        if (!duplicate)
            entity.facts.push(value.fact);
        entities.set(key, entity);
    }
    const grouped = [...entities.values()];
    const fingerprints = capturePublicValueFingerprints(grouped);
    for (const entity of grouped)
        for (const fact of entity.facts) {
            fact.provenance.capturePublicValueFingerprint = fingerprints.get(fact.provenance.captureId);
            const { factId: _factId, ...withoutId } = fact;
            fact.factId = productFactId(entity.entityType, entity.entityId, withoutId);
        }
    return grouped.map(entity => ({ ...entity, facts: entity.facts.sort((a, b) => a.factId.localeCompare(b.factId)) })).sort((a, b) => `${a.entityType}:${String(a.entityId).padStart(12, "0")}`.localeCompare(`${b.entityType}:${String(b.entityId).padStart(12, "0")}`));
}
exports.groupProductFacts = groupProductFacts;
//# sourceMappingURL=capture-product-core.js.map