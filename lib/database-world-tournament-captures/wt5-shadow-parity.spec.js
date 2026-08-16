"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const wt5_shadow_parity_1 = require("./wt5-shadow-parity");
const wt5_sources_1 = require("./wt5-sources");
function fixture() { return JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(process.cwd(), "database-world-tournament-captures/fixtures/wt5-shadow-parity.json"), "utf8")); }
describe("world tournament WT5", () => {
    it("validates sanitized structural shadow parity", () => assert.equal((0, wt5_shadow_parity_1.validateWt5)(fixture()).valid, true));
    it("rejects title or text joins", () => { const value = fixture(); value.comparisons[0].joinKey = "event.name"; assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, false); });
    it("rejects agreement without a structural match", () => { const value = fixture(); value.comparisons[0].matchedCount = 0; assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, false); });
    it("rejects numeric namespace promotion", () => { const value = fixture(); const map = value.comparisons.find(item => item.key === "budokai_maps"); map.status = "agreement"; map.matchedCount = 1; map.joinKey = "budokai_box_rankings.id"; assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, false); });
    it("rejects reward grant promotion", () => { const value = fixture(); value.rewards.granted.observed = true; assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, false); });
    it("derives observed definitions without promoting a grant", () => { const value = (0, wt5_shadow_parity_1.rewardDefinitionBoundary)(7001, true, 71, false); assert.equal(value.status, "observed_definition"); assert.equal(value.observedCount, 1); });
    it("validates an integrated observed definition branch", () => { const value = fixture(), mission = value.comparisons.find(item => item.key === "mission_relation"); mission.status = "unknown"; mission.matchedCount = 1; value.rewards.definitions = (0, wt5_shadow_parity_1.rewardDefinitionBoundary)(63001, true, 631, false); value.totals.coverage_gap--; value.totals.unknown++; assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, true); });
    it("rejects an inter-Budokai structural ID collision", () => { assert.equal((0, wt5_shadow_parity_1.parentedStructuralMatches)([{ missionId: 63001, budokaiId: 62 }], "missionId", [63001], 63), 0); assert.equal((0, wt5_shadow_parity_1.parentedStructuralMatches)([{ missionId: 63001, budokaiId: 63 }], "missionId", [63001], 63), 1); });
    it("rejects incomplete source closure", () => { const value = fixture(); value.sourceCoverage.splice(1, 1); assert.equal((0, wt5_shadow_parity_1.validateWt5)(value).valid, false); });
    it("rejects a forged source lock before reading sources", () => { const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(process.cwd(), "database-world-tournament-captures/wt5-source-lock.json"), "utf8")); lock.files[0].sha256 = "forged"; assert.throws(() => (0, wt5_sources_1.loadWt5Sources)({ main: "missing", capture: "missing", database: "missing" }, lock), /identity invalid/); });
});
//# sourceMappingURL=wt5-shadow-parity.spec.js.map