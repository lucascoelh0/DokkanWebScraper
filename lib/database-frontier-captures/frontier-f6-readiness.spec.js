"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const frontier_f6_readiness_1 = require("./frontier-f6-readiness");
describe("Frontier F6 readiness policy", () => { it("allows only disabled infrastructure and synthetic fixtures", () => { const rows = (0, frontier_f6_readiness_1.frontierF6Decisions)(), decisions = new Map(rows.map(value => [value.id, value.status])); assert_1.strict.equal(decisions.get("merge_disabled_infrastructure"), "GO"); assert_1.strict.equal(decisions.get("tracked_sanitized_fixtures"), "GO"); for (const [id, status] of decisions)
    if (!new Set(["merge_disabled_infrastructure", "tracked_sanitized_fixtures"]).has(id))
        assert_1.strict.equal(status, "NO_GO"); assert_1.strict.match(rows.find(value => value.id === "offline_decoder_real_bodies").reason, /pinned dictionary.*approved decompression provider.*green real-body decode receipt/); }); });
//# sourceMappingURL=frontier-f6-readiness.spec.js.map