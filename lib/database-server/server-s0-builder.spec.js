"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s0_builder_1 = require("./server-s0-builder");
describe("server S0 catalog", () => {
    it("is deterministic and keeps official paths discovery-only", () => {
        const first = (0, server_s0_builder_1.buildServerS0Catalog)(), second = (0, server_s0_builder_1.buildServerS0Catalog)();
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)(first.endpoints.filter(value => value.sourceClass === "official_client" && value.collectionGate === "eligible_get_probe").length, 0);
        (0, assert_1.equal)((0, server_s0_builder_1.validateServerS0Catalog)(first).valid, true);
    });
    it("redacts every secret or pseudonymous header", () => {
        const dataset = (0, server_s0_builder_1.buildServerS0Catalog)();
        (0, assert_1.equal)(dataset.headers.filter(value => value.classification === "secret" || value.classification === "pseudonymous").every(value => value.logPolicy === "redact_value"), true);
        (0, assert_1.equal)((0, server_s0_builder_1.validateServerS0Catalog)(dataset).sensitiveHeadersRedacted, true);
    });
    it("records zero network requests and prohibits action endpoints", () => {
        const dataset = (0, server_s0_builder_1.buildServerS0Catalog)(), coverage = (0, server_s0_builder_1.buildServerS0Coverage)(dataset);
        (0, assert_1.equal)(coverage.networkRequestCount, 0);
        (0, assert_1.equal)(coverage.dynamicOfficialAuthorityCount, 0);
        (0, assert_1.equal)(dataset.endpoints.find(value => value.key === "official-known-mutations")?.collectionGate, "prohibited");
    });
    it("rejects a non-GET endpoint promoted to collection", () => {
        const dataset = (0, server_s0_builder_1.buildServerS0Catalog)();
        dataset.endpoints[0] = { ...dataset.endpoints[0], sourceClass: "community_structured", collectionGate: "eligible_get_probe" };
        (0, assert_1.equal)((0, server_s0_builder_1.validateServerS0Catalog)(dataset).failures.some(value => value.includes("non-GET eligible endpoint")), true);
    });
    it("rejects action-shaped paths outside the prohibited gate", () => {
        const dataset = (0, server_s0_builder_1.buildServerS0Catalog)();
        dataset.endpoints.push({
            ...dataset.endpoints.find(value => value.key === "official-known-mutations"),
            key: "mutation-regression",
            pathPattern: "missions/{accept,finish,put_forward}",
            collectionGate: "discover_only",
        });
        const validation = (0, server_s0_builder_1.validateServerS0Catalog)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.mutableEndpointsProhibited, false);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("action-shaped endpoint not prohibited")), true);
    });
    it("rejects missing endpoint and header provenance locators", () => {
        const dataset = (0, server_s0_builder_1.buildServerS0Catalog)();
        dataset.endpoints[0].evidence[0].locator = "";
        dataset.headers[0].evidenceId = "missing";
        const validation = (0, server_s0_builder_1.validateServerS0Catalog)(dataset);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("invalid evidence claim")), true);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("invalid header evidence")), true);
    });
    it("preserves native parameter literals and declares normalized catalog paths", () => {
        const endpoint = (0, server_s0_builder_1.buildServerS0Catalog)().endpoints.find(value => value.key === "official-gasha-featured");
        (0, assert_1.equal)(endpoint.pathPattern, "gashas/{gasha_id}/featured_cards");
        (0, assert_1.equal)(endpoint.evidence[0].locator, "native_string_literal:gashas/{0}/featured_cards");
        (0, assert_1.equal)(endpoint.evidence[0].observation.includes("normalized as"), true);
    });
});
//# sourceMappingURL=server-s0-builder.spec.js.map