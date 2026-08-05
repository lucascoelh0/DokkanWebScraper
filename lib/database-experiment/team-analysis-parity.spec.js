"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_parity_1 = require("./team-analysis-parity");
(0, mocha_1.describe)("database Team Analysis parity", function () {
    (0, mocha_1.it)("keeps raw form IDs while applying only an audited comparison alias", () => {
        const database = {
            states: [{
                    stateKey: "1:4005130:initial", characterId: "1", formId: "4005130", releaseState: "initial", sourceReleaseState: "eza",
                    passive: { rules: [{ effects: [{ kind: { value: "atk" } }] }] },
                }],
        };
        const current = {
            stateCount: 1,
            states: [{
                    stateKey: "1:4005131:initial", characterId: "1", formId: "4005131", releaseState: "initial",
                    passive: { rules: [{ effects: [{ kind: "atk" }] }] },
                }],
        };
        const siteAudit = {
            schemaVersion: 1, auditedAt: "2026-08-05", entries: [],
            formProjectionAliases: [{ databaseCardId: "4005130", projectedCardId: "4005131", url: "https://example.invalid", evidence: "fixture" }],
        };
        const parity = (0, team_analysis_parity_1.compareDatabaseTeamAnalysis)(database, current, siteAudit);
        (0, assert_1.equal)(parity.exactMatchedStateCount, 0);
        (0, assert_1.equal)(parity.auditedAliasMatchedStateCount, 1);
        (0, assert_1.equal)(parity.currentStateKeysMissingInDatabase.length, 0);
        (0, assert_1.equal)(parity.databaseStateKeysMissingInCurrent.length, 0);
        (0, assert_1.equal)(parity.effectKindParity.atk.matchedStateCount, 1);
    });
});
//# sourceMappingURL=team-analysis-parity.spec.js.map