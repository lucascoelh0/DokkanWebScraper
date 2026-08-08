import { deepEqual, equal } from "assert";
import { CaptureH1Dataset } from "./capture-h1-contract";
import { buildCaptureH2, validateCaptureH2 } from "./capture-h2-provenance";

function h1(): CaptureH1Dataset {
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
        const first = buildCaptureH2(h1()), second = buildCaptureH2(h1());
        deepEqual(first, second);
        const validation = validateCaptureH2(first, h1());
        equal(validation.valid, true);
        equal(validation.supportedCount, 0);
        equal(validation.userDerivedAuthorityCount, 0);
        equal(first.facts.some(value => value.provenance.endpointClassification === "user_state"), false);
        equal(first.facts.find(value => value.provenance.endpointClassification === "mixed_product_and_user_state")!.provenance.confidence, "unknown");
    });

    it("rejects promotion, user authority and stale capture lineage", () => {
        const value = buildCaptureH2(h1());
        value.facts[0].provenance.confidence = "supported";
        (value.facts[0].provenance as any).userDerivedAuthority = true;
        value.facts[0].factId = "f".repeat(64);
        const lineage = h1();
        lineage.captures[0].schemaFingerprint = "c".repeat(64);
        const validation = validateCaptureH2(value, lineage);
        equal(validation.valid, false);
        equal(validation.failures.includes("capture lineage"), true);
        equal(validation.failures.includes("unsupported promotion"), true);
        equal(validation.failures.includes("user-derived authority"), true);
        equal(validation.failures.includes("fact identity"), true);
    });
});
