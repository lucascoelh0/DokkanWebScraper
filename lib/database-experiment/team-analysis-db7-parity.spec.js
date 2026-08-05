"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db7_parity_1 = require("./team-analysis-db7-parity");
function database(status, selector) {
    return { states: [{ stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [{ selectorConditions: [{ causalityType: status === "partial" ? 41 : 46, scope: "team", minimumCount: 2, selector, status }] }] } }] };
}
function current() {
    return { states: [{ stateKey: "1:1:initial", passive: { rules: [{ condition: { op: "predicate", predicate: { kind: "ally_class_present", scope: "team", comparator: "gte", count: 2, classes: ["Super"] } } }] } }] };
}
(0, mocha_1.describe)("database Team Analysis DB7 parity", function () {
    (0, mocha_1.it)("matches supported structured selectors and excludes partial name tokens", () => {
        const aliases = { formProjectionAliases: [] };
        const supported = (0, team_analysis_db7_parity_1.compareDatabaseTeamAnalysisDb7)(database("supported", { kind: "class", classes: ["Super"], rawMask: 32 }), current(), aliases);
        (0, assert_1.equal)(supported.supportedSelectorSignatures.database, 1);
        (0, assert_1.equal)(supported.supportedSelectorSignatures.matched, 1);
        const partial = (0, team_analysis_db7_parity_1.compareDatabaseTeamAnalysisDb7)(database("partial", { kind: "name_token", token: 13, localizedName: null }), current(), aliases);
        (0, assert_1.equal)(partial.supportedSelectorSignatures.database, 0);
        (0, assert_1.equal)(partial.partialNameTokenOccurrenceCount, 1);
        (0, assert_1.equal)(partial.partialNameTokenComparableCount, 0);
    });
});
//# sourceMappingURL=team-analysis-db7-parity.spec.js.map