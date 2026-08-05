import { equal } from "assert";
import { describe, it } from "mocha";
import { compareDatabaseTeamAnalysisDb7 } from "./team-analysis-db7-parity";

function database(status: "supported" | "partial", selector: any) {
    return { states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [{ selectorConditions: [{ causalityType: status === "partial" ? 41 : 46, scope: "team", minimumCount: 2, selector, status }] }] } }] } as any;
}

function current() {
    return { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "predicate", predicate: { kind: "ally_class_present", scope: "team", comparator: "gte", count: 2, classes: ["Super"] } } }] } }] } as any;
}

describe("database Team Analysis DB7 parity", function () {
    it("matches supported structured selectors and excludes partial name tokens", () => {
        const aliases = { formProjectionAliases: [] } as any;
        const supported = compareDatabaseTeamAnalysisDb7(database("supported", { kind: "class", classes: ["Super"], rawMask: 32 }), current(), aliases);
        equal(supported.supportedSelectorSignatures.database, 1); equal(supported.supportedSelectorSignatures.matched, 1);
        const partial = compareDatabaseTeamAnalysisDb7(database("partial", { kind: "name_token", token: 13, localizedName: null }), current(), aliases);
        equal(partial.supportedSelectorSignatures.database, 0); equal(partial.partialNameTokenOccurrenceCount, 1); equal(partial.partialNameTokenComparableCount, 0);
    });
});
