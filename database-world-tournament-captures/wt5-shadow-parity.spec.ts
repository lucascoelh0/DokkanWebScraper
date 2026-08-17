import * as assert from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Wt5Dataset, Wt5SourceLock } from "./wt5-contract";
import { parentedStructuralMatches, rewardDefinitionBoundary, validateWt5 } from "./wt5-shadow-parity";
import { loadWt5Sources } from "./wt5-sources";

function fixture(): Wt5Dataset { return JSON.parse(readFileSync(resolve(process.cwd(), "database-world-tournament-captures/fixtures/wt5-shadow-parity.json"), "utf8")) as Wt5Dataset; }
const SYNTHETIC_EVENT = 9007190000000007, SYNTHETIC_MISSION = 9007190000007001, SYNTHETIC_BOX = 9007190000000701;
describe("world tournament WT5", () => {
    it("validates sanitized structural shadow parity", () => assert.equal(validateWt5(fixture()).valid, true));
    it("rejects title or text joins", () => { const value = fixture(); value.comparisons[0].joinKey = "event.name"; assert.equal(validateWt5(value).valid, false); });
    it("rejects agreement without a structural match", () => { const value = fixture(); value.comparisons[0].matchedCount = 0; assert.equal(validateWt5(value).valid, false); });
    it("rejects numeric namespace promotion", () => { const value = fixture(); const map = value.comparisons.find(item => item.key === "budokai_maps")!; map.status = "agreement"; map.matchedCount = 1; map.joinKey = "budokai_box_rankings.id"; assert.equal(validateWt5(value).valid, false); });
    it("rejects reward grant promotion", () => { const value = fixture(); value.rewards.granted.observed = true as false; assert.equal(validateWt5(value).valid, false); });
    it("derives observed definitions without promoting a grant", () => { const value = rewardDefinitionBoundary(7001, true, 71, false); assert.equal(value.status, "observed_definition"); assert.equal(value.observedCount, 1); });
    it("validates an integrated observed definition branch", () => { const value = fixture(), mission = value.comparisons.find(item => item.key === "mission_relation")!; mission.status = "unknown"; mission.matchedCount = 1; value.rewards.definitions = rewardDefinitionBoundary(SYNTHETIC_MISSION, true, SYNTHETIC_BOX, false); value.totals.coverage_gap--; value.totals.unknown++; assert.equal(validateWt5(value).valid, true); });
    it("rejects an inter-Budokai structural ID collision", () => { assert.equal(parentedStructuralMatches([{ missionId: SYNTHETIC_MISSION, budokaiId: SYNTHETIC_EVENT - 1 }], "missionId", [SYNTHETIC_MISSION], SYNTHETIC_EVENT), 0); assert.equal(parentedStructuralMatches([{ missionId: SYNTHETIC_MISSION, budokaiId: SYNTHETIC_EVENT }], "missionId", [SYNTHETIC_MISSION], SYNTHETIC_EVENT), 1); });
    it("rejects incomplete source closure", () => { const value = fixture(); value.sourceCoverage.splice(1, 1); assert.equal(validateWt5(value).valid, false); });
    it("rejects a forged source lock before reading sources", () => { const lock = JSON.parse(readFileSync(resolve(process.cwd(), "database-world-tournament-captures/wt5-source-lock.json"), "utf8")) as Wt5SourceLock; lock.files[0].sha256 = "forged"; assert.throws(() => loadWt5Sources({ main: "missing", capture: "missing", database: "missing" }, lock), /identity invalid/); });
});
