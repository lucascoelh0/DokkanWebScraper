"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const capture_h2_provenance_1 = require("./capture-h2-provenance");
function h1() {
    return {
        schemaVersion: 1, contract: "dokkan-official-capture-schema-only-sanitizer", contractVersion: "0.2.0", generatedAt: "2026-08-07T20:00:00.000Z", generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_local_har_no_requests", productionMutation: false, valueFixtureCount: 0, authority: "schema_only_no_user_derived_authority",
        sanitization: { headers: "omitted", cookies: "omitted", queryValues: "omitted_key_names_only", sensitiveAndUnknownBodyKeys: "collapsed_before_output", authMutationUserRequestBodies: "omitted", valueFixtures: "deny_by_default_explicit_public_product_allowlist_required" },
        captures: [{ captureId: "one", structuralFingerprint: "a".repeat(64), schemaFingerprint: "b".repeat(64), observations: [
                    { hostClass: "official_api", method: "GET", normalizedEndpoint: "/bonus_schedules", classification: "product_catalog", status: 200, count: 1, capturedAtStart: "2026-08-07T20:00:00.000Z", capturedAtEnd: "2026-08-07T20:00:00.000Z", queryKeys: [], requestBodyDisposition: "absent", responseBodyDisposition: "schema_only", requestSchema: [], responseSchema: ["$:object", "$.bonus_schedules:array", "$.bonus_schedules[]<object>.id:number"] },
                    { hostClass: "official_api", method: "GET", normalizedEndpoint: "/events", classification: "mixed_product_and_user_state", status: 200, count: 1, capturedAtStart: "2026-08-07T20:00:01.000Z", capturedAtEnd: "2026-08-07T20:00:01.000Z", queryKeys: [], requestBodyDisposition: "absent", responseBodyDisposition: "schema_only", requestSchema: [], responseSchema: ["$:object", "$.events:array"] },
                    { hostClass: "official_api", method: "GET", normalizedEndpoint: "/user", classification: "user_state", status: 200, count: 1, capturedAtStart: "2026-08-07T20:00:02.000Z", capturedAtEnd: "2026-08-07T20:00:02.000Z", queryKeys: [], requestBodyDisposition: "absent", responseBodyDisposition: "schema_only", requestSchema: [], responseSchema: ["$:object"] },
                ] }],
    };
}
describe("capture H2 provenance", () => {
    it("builds deterministic per-fact provenance without supported or user authority", () => {
        const first = (0, capture_h2_provenance_1.buildCaptureH2)(h1()), second = (0, capture_h2_provenance_1.buildCaptureH2)(h1());
        (0, assert_1.deepEqual)(first, second);
        const validation = (0, capture_h2_provenance_1.validateCaptureH2)(first, h1());
        (0, assert_1.equal)(validation.valid, true);
        (0, assert_1.equal)(validation.supportedCount, 0);
        (0, assert_1.equal)(validation.userDerivedAuthorityCount, 0);
        (0, assert_1.equal)(first.facts.some(value => value.provenance.endpointClassification === "user_state"), false);
        (0, assert_1.equal)(first.facts.find(value => value.provenance.endpointClassification === "mixed_product_and_user_state").provenance.confidence, "unknown");
    });
    it("rejects promotion, user authority and stale capture lineage", () => {
        const value = (0, capture_h2_provenance_1.buildCaptureH2)(h1());
        value.facts[0].provenance.confidence = "supported";
        value.facts[0].provenance.userDerivedAuthority = true;
        value.facts[0].factId = "f".repeat(64);
        const lineage = h1();
        lineage.captures[0].schemaFingerprint = "c".repeat(64);
        const validation = (0, capture_h2_provenance_1.validateCaptureH2)(value, lineage);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("capture lineage"), true);
        (0, assert_1.equal)(validation.failures.includes("unsupported promotion"), true);
        (0, assert_1.equal)(validation.failures.includes("user-derived authority"), true);
        (0, assert_1.equal)(validation.failures.includes("fact identity"), true);
    });
});
//# sourceMappingURL=capture-h2-provenance.spec.js.map