"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db6_parity_1 = require("./team-analysis-db6-parity");
function database() {
    return { states: [{
                stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial",
                passive: { rules: [{ condition: { op: "predicate", predicate: {
                                    kind: "attacks_received", scope: "self", comparator: "gte", value: 3, eventMode: "accumulated_count",
                                    combatEvent: { eventType: "attack_landed", actor: "enemy", attackKind: "unknown", mode: "accumulated_count", countScope: "battle", relativeTiming: "after_event" },
                                    sourceCausalityId: "44", sourceCausalityType: 44, evidence: "first-party-row-join",
                                } } }] },
            }] };
}
function current(mode, eventOverrides = {}) {
    return { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "predicate", predicate: {
                                    kind: "attacks_received", scope: "self", comparator: "gte", value: 3,
                                    combatEvent: { eventType: "attack_landed", actor: "enemy", attackKind: "unknown", mode, countScope: "battle", relativeTiming: "after_event", ...eventOverrides },
                                } } }] } }] };
}
(0, mocha_1.describe)("database Team Analysis DB6 parity", function () {
    (0, mocha_1.it)("matches only accumulated history with the same structured signature", () => {
        const aliases = { formProjectionAliases: [] };
        const baseline = { exactPredicateSignatures: { matched: 0 } };
        const matched = (0, team_analysis_db6_parity_1.compareDatabaseTeamAnalysisDb6)(database(), current("accumulated_count"), aliases, baseline);
        (0, assert_1.equal)(matched.combatHistorySignatures.database, 1);
        (0, assert_1.equal)(matched.combatHistorySignatures.current, 1);
        (0, assert_1.equal)(matched.combatHistorySignatures.matched, 1);
        (0, assert_1.equal)(matched.exactPredicateMatchDelta, 1);
        const currentEvent = (0, team_analysis_db6_parity_1.compareDatabaseTeamAnalysisDb6)(database(), current("current_event"), aliases, baseline);
        (0, assert_1.equal)(currentEvent.combatHistorySignatures.current, 0);
        (0, assert_1.equal)(currentEvent.combatHistorySignatures.matched, 0);
        for (const changed of [
            { countScope: "turn" },
            { actor: "self" },
            { relativeTiming: "during_event" },
        ]) {
            const divergent = (0, team_analysis_db6_parity_1.compareDatabaseTeamAnalysisDb6)(database(), current("accumulated_count", changed), aliases, baseline);
            (0, assert_1.equal)(divergent.combatHistorySignatures.current, 1);
            (0, assert_1.equal)(divergent.combatHistorySignatures.matched, 0);
        }
    });
});
//# sourceMappingURL=team-analysis-db6-parity.spec.js.map