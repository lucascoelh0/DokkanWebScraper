"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const team_analysis_db46_builder_1 = require("./team-analysis-db46-builder");
const evidence = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-enemy-attack-timing-semantics.json"), "utf8"));
describe("database Team Analysis DB46 enemy attack timing", () => { it("maps only timings 6 and 7", () => { (0, assert_1.equal)((0, team_analysis_db46_builder_1.projectDb46Timing)(6)?.event, "enemy_attack_pre_damage_calculation_setup"); (0, assert_1.equal)((0, team_analysis_db46_builder_1.projectDb46Timing)(7)?.event, "enemy_attack_post_damage_calculation_setup"); for (const x of [1, 4, 5, 8, -1, "bad"])
    (0, assert_1.equal)((0, team_analysis_db46_builder_1.projectDb46Timing)(x), null); }); it("rejects semantic promotion by evidence mutation", () => { for (const mutate of [(x) => x.events[0].event = "before_hit", (x) => x.doesNotImply = [], (x) => x.events[1].calls[0].skillTypeRaw = 99, (x) => x.owner.vma += 4, (x) => x.events[0].calls[0].callVma += 4]) {
    const x = JSON.parse(JSON.stringify(evidence));
    mutate(x);
    (0, assert_1.throws)(() => (0, team_analysis_db46_builder_1.validateDb46Evidence)({}, x, evidence.sourceSha256), /identity|calls/);
} }); });
//# sourceMappingURL=team-analysis-db46-builder.spec.js.map