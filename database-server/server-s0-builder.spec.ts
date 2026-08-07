import { deepEqual, equal } from "assert";
import { buildServerS0Catalog, buildServerS0Coverage, validateServerS0Catalog } from "./server-s0-builder";

describe("server S0 catalog", () => {
    it("is deterministic and keeps official paths discovery-only", () => {
        const first = buildServerS0Catalog(), second = buildServerS0Catalog();
        deepEqual(first, second);
        equal(first.endpoints.filter(value => value.sourceClass === "official_client" && value.collectionGate === "eligible_get_probe").length, 0);
        equal(validateServerS0Catalog(first).valid, true);
    });

    it("redacts every secret or pseudonymous header", () => {
        const dataset = buildServerS0Catalog();
        equal(dataset.headers.filter(value => value.classification === "secret" || value.classification === "pseudonymous").every(value => value.logPolicy === "redact_value"), true);
        equal(validateServerS0Catalog(dataset).sensitiveHeadersRedacted, true);
    });

    it("records zero network requests and prohibits action endpoints", () => {
        const dataset = buildServerS0Catalog(), coverage = buildServerS0Coverage(dataset);
        equal(coverage.networkRequestCount, 0);
        equal(coverage.dynamicOfficialAuthorityCount, 0);
        equal(dataset.endpoints.find(value => value.key === "official-known-mutations")?.collectionGate, "prohibited");
    });

    it("rejects a non-GET endpoint promoted to collection", () => {
        const dataset = buildServerS0Catalog();
        dataset.endpoints[0] = { ...dataset.endpoints[0], sourceClass: "community_structured", collectionGate: "eligible_get_probe" };
        equal(validateServerS0Catalog(dataset).failures.some(value => value.includes("non-GET eligible endpoint")), true);
    });

    it("rejects action-shaped paths outside the prohibited gate", () => {
        const dataset = buildServerS0Catalog();
        dataset.endpoints.push({
            ...dataset.endpoints.find(value => value.key === "official-known-mutations")!,
            key: "mutation-regression",
            pathPattern: "missions/{accept,finish,put_forward}",
            collectionGate: "discover_only",
        });
        const validation = validateServerS0Catalog(dataset);
        equal(validation.valid, false);
        equal(validation.mutableEndpointsProhibited, false);
        equal(validation.failures.some(value => value.includes("action-shaped endpoint not prohibited")), true);
    });

    it("rejects missing endpoint and header provenance locators", () => {
        const dataset = buildServerS0Catalog();
        dataset.endpoints[0].evidence[0].locator = "";
        dataset.headers[0].evidenceId = "missing";
        const validation = validateServerS0Catalog(dataset);
        equal(validation.failures.some(value => value.includes("invalid evidence claim")), true);
        equal(validation.failures.some(value => value.includes("invalid header evidence")), true);
    });

    it("preserves native parameter literals and declares normalized catalog paths", () => {
        const endpoint = buildServerS0Catalog().endpoints.find(value => value.key === "official-gasha-featured")!;
        equal(endpoint.pathPattern, "gashas/{gasha_id}/featured_cards");
        equal(endpoint.evidence[0].locator, "native_string_literal:gashas/{0}/featured_cards");
        equal(endpoint.evidence[0].observation.includes("normalized as"), true);
    });
});
