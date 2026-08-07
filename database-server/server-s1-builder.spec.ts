import { deepEqual, equal } from "assert";
import { buildServerS1Coverage, buildServerS1Dataset, calculateAvailability, timeValue, validateServerS1Dataset } from "./server-s1-builder";
import { ServerHttpReceipt } from "./server-readonly-http";

const receipts: ServerHttpReceipt[] = [
    { url: "https://dokkan.fyi/summons?active=true&category=1&page=1", fetchedAt: "2026-08-07T12:00:00.000Z", status: 200, sizeBytes: 100, sha256: "a".repeat(64), responseHeaders: {}, attemptCount: 1 },
    { url: "https://dokkan.fyi/summons/99", fetchedAt: "2026-08-07T12:00:01.000Z", status: 200, sizeBytes: 200, sha256: "b".repeat(64), responseHeaders: {}, attemptCount: 1 },
];

function build() {
    return buildServerS1Dataset({
        receipts, failures: [], minimumIntervalMs: 1000, maximumResponseBytes: 5_000_000, maximumAggregateBytes: 50_000_000,
        sourceS0: { contractVersion: "0.1.0", sha256: "199074a781dd94f64eb425f7965672edd84982041de82ccc8f7ac9211b7603a9", endpointKeys: ["fyi-active-summons", "fyi-summon-detail"] },
        events: [],
        banners: [{ id: "99", title: "Banner", startsAt: "2026-08-06T05:00:00Z", endsAt: "2026-09-01T07:59:59+00:00", fetchedAt: receipts[1].fetchedAt, categoryMemberships: [{ id: "1", label: "Recommended" }], featuredCharacters: [{ entryCharacterId: "1030011", payloadCharacterId: "1030011" }], summaryReceiptSha256s: [receipts[0].sha256], detailReceiptSha256: receipts[1].sha256 }],
    });
}

describe("server S1 schedule and banners", () => {
    it("normalizes only timestamps with explicit timezone evidence", () => {
        const unknown = timeValue("2026-08-08 05:00:00")!, supported = timeValue("2026-08-08T05:00:00Z")!;
        equal(unknown.timezone.status, "unknown");
        equal(unknown.normalizedInstant, undefined);
        equal(supported.timezone.status, "supported");
        equal(supported.normalizedInstant, "2026-08-08T05:00:00.000Z");
    });

    it("separates source listing from calculated availability", () => {
        equal(calculateAvailability({ startsAt: timeValue("2026-08-06T00:00:00Z"), endsAt: timeValue("2026-08-08T00:00:00Z") }, "2026-08-07T00:00:00Z").state, "active");
        equal(calculateAvailability({ startsAt: timeValue("2026-08-08 00:00:00"), endsAt: timeValue("2026-08-09 00:00:00") }, "2026-08-07T00:00:00Z").state, "unknown");
    });

    it("is deterministic, additive and preserves unknown commercial semantics", () => {
        const first = build(), second = build();
        deepEqual(first, second);
        equal(first.authority.officialDynamicAuthorityCount, 0);
        equal(first.banners[0].currency.status, "unknown");
        equal(first.banners[0].featuredCharacters.status, "partial");
        equal(validateServerS1Dataset(first).valid, true);
    });

    it("accounts receipts, timezone evidence and featured IDs", () => {
        const coverage = buildServerS1Coverage(build());
        equal(coverage.attemptedRequestCount, 2);
        equal(coverage.successfulRequestCount, 2);
        equal(coverage.fetchedBytes, 300);
        equal(coverage.featuredCharacterReferenceCount, 1);
        equal(coverage.explicitTimezoneValueCount, 2);
        equal(coverage.unknownTimezoneValueCount, 0);
    });

    it("fails closed on authority, identity and byte-accounting mutations", () => {
        const value = build();
        value.authority.officialDynamicAuthorityCount = 1 as 0;
        value.banners[0].identity.id = "title-key";
        value.collection.fetchedBytes += 1;
        value.banners[0].provenance.summaryReceiptSha256s = ["missing"];
        value.sourceS0.sha256 = "old";
        value.schedules.push({ identity: { sourceFamily: "story", rootId: "133" }, source: "dokkaninfo_community_shadow", status: "partial", period: {}, sourceReportedAvailability: "listed_by_source", calculatedAvailability: { state: "unknown", asOf: receipts[0].fetchedAt, status: "unknown", basis: ["test"] }, staticIdentityJoin: { status: "unknown", boundary: "join_deferred_to_s2" }, provenance: { receiptSha256: receipts[0].sha256 } });
        value.collection.receipts[0].url = "https://dokkaninfo.com/events/story";
        const validation = validateServerS1Dataset(value);
        equal(validation.valid, false);
        equal(validation.failures.includes("authority boundary"), true);
        equal(validation.failures.includes("non-numeric root identity"), true);
        equal(validation.failures.includes("byte accounting"), true);
        equal(validation.failures.includes("record provenance"), true);
        equal(validation.failures.includes("S0 lineage"), true);
        equal(validation.failures.includes("unauthorized schedule source"), true);
        equal(validation.failures.includes("GET-only collection"), true);
    });

    it("rejects a detail receipt belonging to a different banner ID", () => {
        const value = build();
        value.collection.receipts[1].url = "https://dokkan.fyi/summons/100";
        equal(validateServerS1Dataset(value).failures.includes("record provenance"), true);
    });
});
