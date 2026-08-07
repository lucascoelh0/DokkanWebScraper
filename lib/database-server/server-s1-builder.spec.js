"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s1_builder_1 = require("./server-s1-builder");
const receipts = [
    { url: "https://dokkan.fyi/summons?active=true&category=1&page=1", fetchedAt: "2026-08-07T12:00:00.000Z", status: 200, sizeBytes: 100, sha256: "a".repeat(64), responseHeaders: {}, attemptCount: 1 },
    { url: "https://dokkan.fyi/summons/99", fetchedAt: "2026-08-07T12:00:01.000Z", status: 200, sizeBytes: 200, sha256: "b".repeat(64), responseHeaders: {}, attemptCount: 1 },
];
function build() {
    return (0, server_s1_builder_1.buildServerS1Dataset)({
        receipts, failures: [], minimumIntervalMs: 1000, maximumResponseBytes: 5000000, maximumAggregateBytes: 50000000,
        sourceS0: { contractVersion: "0.1.0", sha256: "199074a781dd94f64eb425f7965672edd84982041de82ccc8f7ac9211b7603a9", endpointKeys: ["fyi-active-summons", "fyi-summon-detail"] },
        events: [],
        banners: [{ id: "99", title: "Banner", startsAt: "2026-08-06T05:00:00Z", endsAt: "2026-09-01T07:59:59+00:00", fetchedAt: receipts[1].fetchedAt, categoryMemberships: [{ id: "1", label: "Recommended" }], featuredCharacters: [{ entryCharacterId: "1030011", payloadCharacterId: "1030011" }], summaryReceiptSha256s: [receipts[0].sha256], detailReceiptSha256: receipts[1].sha256 }],
    });
}
describe("server S1 schedule and banners", () => {
    it("normalizes only timestamps with explicit timezone evidence", () => {
        const unknown = (0, server_s1_builder_1.timeValue)("2026-08-08 05:00:00"), supported = (0, server_s1_builder_1.timeValue)("2026-08-08T05:00:00Z");
        (0, assert_1.equal)(unknown.timezone.status, "unknown");
        (0, assert_1.equal)(unknown.normalizedInstant, undefined);
        (0, assert_1.equal)(supported.timezone.status, "supported");
        (0, assert_1.equal)(supported.normalizedInstant, "2026-08-08T05:00:00.000Z");
    });
    it("separates source listing from calculated availability", () => {
        (0, assert_1.equal)((0, server_s1_builder_1.calculateAvailability)({ startsAt: (0, server_s1_builder_1.timeValue)("2026-08-06T00:00:00Z"), endsAt: (0, server_s1_builder_1.timeValue)("2026-08-08T00:00:00Z") }, "2026-08-07T00:00:00Z").state, "active");
        (0, assert_1.equal)((0, server_s1_builder_1.calculateAvailability)({ startsAt: (0, server_s1_builder_1.timeValue)("2026-08-08 00:00:00"), endsAt: (0, server_s1_builder_1.timeValue)("2026-08-09 00:00:00") }, "2026-08-07T00:00:00Z").state, "unknown");
    });
    it("is deterministic, additive and preserves unknown commercial semantics", () => {
        const first = build(), second = build();
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)(first.authority.officialDynamicAuthorityCount, 0);
        (0, assert_1.equal)(first.banners[0].currency.status, "unknown");
        (0, assert_1.equal)(first.banners[0].featuredCharacters.status, "partial");
        (0, assert_1.equal)((0, server_s1_builder_1.validateServerS1Dataset)(first).valid, true);
    });
    it("accounts receipts, timezone evidence and featured IDs", () => {
        const coverage = (0, server_s1_builder_1.buildServerS1Coverage)(build());
        (0, assert_1.equal)(coverage.attemptedRequestCount, 2);
        (0, assert_1.equal)(coverage.successfulRequestCount, 2);
        (0, assert_1.equal)(coverage.fetchedBytes, 300);
        (0, assert_1.equal)(coverage.featuredCharacterReferenceCount, 1);
        (0, assert_1.equal)(coverage.explicitTimezoneValueCount, 2);
        (0, assert_1.equal)(coverage.unknownTimezoneValueCount, 0);
    });
    it("fails closed on authority, identity and byte-accounting mutations", () => {
        const value = build();
        value.authority.officialDynamicAuthorityCount = 1;
        value.banners[0].identity.id = "title-key";
        value.collection.fetchedBytes += 1;
        value.banners[0].provenance.summaryReceiptSha256s = ["missing"];
        value.sourceS0.sha256 = "old";
        value.schedules.push({ identity: { sourceFamily: "story", rootId: "133" }, source: "dokkaninfo_community_shadow", status: "partial", period: {}, sourceReportedAvailability: "listed_by_source", calculatedAvailability: { state: "unknown", asOf: receipts[0].fetchedAt, status: "unknown", basis: ["test"] }, staticIdentityJoin: { status: "unknown", boundary: "join_deferred_to_s2" }, provenance: { receiptSha256: receipts[0].sha256 } });
        value.collection.receipts[0].url = "https://dokkaninfo.com/events/story";
        const validation = (0, server_s1_builder_1.validateServerS1Dataset)(value);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("authority boundary"), true);
        (0, assert_1.equal)(validation.failures.includes("non-numeric root identity"), true);
        (0, assert_1.equal)(validation.failures.includes("byte accounting"), true);
        (0, assert_1.equal)(validation.failures.includes("record provenance"), true);
        (0, assert_1.equal)(validation.failures.includes("S0 lineage"), true);
        (0, assert_1.equal)(validation.failures.includes("unauthorized schedule source"), true);
        (0, assert_1.equal)(validation.failures.includes("GET-only collection"), true);
    });
    it("rejects a detail receipt belonging to a different banner ID", () => {
        const value = build();
        value.collection.receipts[1].url = "https://dokkan.fyi/summons/100";
        (0, assert_1.equal)((0, server_s1_builder_1.validateServerS1Dataset)(value).failures.includes("record provenance"), true);
    });
});
//# sourceMappingURL=server-s1-builder.spec.js.map