"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const capture_h10_domains_1 = require("./capture-h10-domains");
describe("capture H10 domains", () => {
    it("requires all six separated domains", () => {
        const dataset = {
            schemaVersion: 1,
            contract: "dokkan-official-capture-domain-audit",
            contractVersion: "0.11.0",
            generatedAt: "2026-08-10T00:00:00Z",
            generatedAtPolicy: "inherits_h9_capture_timestamp",
            collectionMode: "offline_local_har_no_requests_no_replay",
            productionMutation: false,
            defaultEnabled: false,
            authority: "partial_product_observation_and_account_structure_only",
            accountFixturePolicy: "no_personal_or_account_scalar_values",
            h9ArtifactSha256: "a".repeat(64),
            h9ArtifactSizeBytes: 1,
            domains: [], productFacts: [], relationships: [],
            crashBoundary: { captureId: "event-mission-crash", acceptedMissionMutationStatus200Count: 0, lastObservedOfficialApiStatus: null, causality: "not_established_request_before_crash_only", currentHypothesis: "instrumentation_interception_plus_x86_64_arm64_libhoudini_glthread_incompatibility" },
        };
        assert.equal((0, capture_h10_domains_1.validateCaptureH10)(dataset).valid, false);
    });
    it("rejects any scalar fact outside product domains", () => {
        const invalid = { schemaVersion: 1, contract: "bad", contractVersion: "0.11.0", domains: new Array(6).fill({ domain: "misc", schemaFieldPaths: [], accountValuePolicy: "values_excluded_structure_only" }), productFacts: [{ domain: "profile_account", route: "/user", parentId: null, field: "id", value: 42, confidence: "partial_authenticated_observation", provenance: [{ captureId: "synthetic", entryIndex: 0 }] }], relationships: [], crashBoundary: {} };
        assert.equal((0, capture_h10_domains_1.validateCaptureH10)(invalid).valid, false);
    });
});
//# sourceMappingURL=capture-h10-domains.spec.js.map