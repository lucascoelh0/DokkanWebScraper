import { equal } from "assert";
import { describe, it } from "mocha";
import { compareDatabaseTeamAnalysisDb6 } from "./team-analysis-db6-parity";

function database() {
    return { states: [{
        stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial",
        passive: { rules: [{ condition: { op: "predicate", predicate: {
            kind: "attacks_received", scope: "self", comparator: "gte", value: 3, eventMode: "accumulated_count",
            combatEvent: { eventType: "attack_landed", actor: "enemy", attackKind: "unknown", mode: "accumulated_count", countScope: "battle", relativeTiming: "after_event" },
            sourceCausalityId: "44", sourceCausalityType: 44, evidence: "first-party-row-join",
        } } }] },
    }] } as any;
}

function current(mode: string, eventOverrides: Record<string, unknown> = {}) {
    return { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "predicate", predicate: {
        kind: "attacks_received", scope: "self", comparator: "gte", value: 3,
        combatEvent: { eventType: "attack_landed", actor: "enemy", attackKind: "unknown", mode, countScope: "battle", relativeTiming: "after_event", ...eventOverrides },
    } } }] } }] } as any;
}

describe("database Team Analysis DB6 parity", function () {
    it("matches only accumulated history with the same structured signature", () => {
        const aliases = { formProjectionAliases: [] } as any;
        const baseline = { exactPredicateSignatures: { matched: 0 } } as any;
        const matched = compareDatabaseTeamAnalysisDb6(database(), current("accumulated_count"), aliases, baseline);
        equal(matched.combatHistorySignatures.database, 1);
        equal(matched.combatHistorySignatures.current, 1);
        equal(matched.combatHistorySignatures.matched, 1);
        equal(matched.exactPredicateMatchDelta, 1);
        const currentEvent = compareDatabaseTeamAnalysisDb6(database(), current("current_event"), aliases, baseline);
        equal(currentEvent.combatHistorySignatures.current, 0);
        equal(currentEvent.combatHistorySignatures.matched, 0);
        for (const changed of [
            { countScope: "turn" },
            { actor: "self" },
            { relativeTiming: "during_event" },
        ]) {
            const divergent = compareDatabaseTeamAnalysisDb6(database(), current("accumulated_count", changed), aliases, baseline);
            equal(divergent.combatHistorySignatures.current, 1);
            equal(divergent.combatHistorySignatures.matched, 0);
        }
    });
});
