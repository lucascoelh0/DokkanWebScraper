import { equal } from "assert";
import { describe, it } from "mocha";
import { SiteAuditFixtures } from "./parity";
import { compareDatabaseTeamAnalysis } from "./team-analysis-parity";

describe("database Team Analysis parity", function () {
    it("keeps raw form IDs while applying only an audited comparison alias", () => {
        const database = {
            states: [{
                stateKey: "1:4005130:initial", characterId: "1", formId: "4005130", releaseState: "initial", sourceReleaseState: "eza",
                passive: { rules: [{ effects: [{ kind: { value: "atk" } }] }] },
            }],
        } as any;
        const current = {
            stateCount: 1,
            states: [{
                stateKey: "1:4005131:initial", characterId: "1", formId: "4005131", releaseState: "initial",
                passive: { rules: [{ effects: [{ kind: "atk" }] }] },
            }],
        } as any;
        const siteAudit: SiteAuditFixtures = {
            schemaVersion: 1, auditedAt: "2026-08-05", entries: [],
            formProjectionAliases: [{ databaseCardId: "4005130", projectedCardId: "4005131", url: "https://example.invalid", evidence: "fixture" }],
        };
        const parity = compareDatabaseTeamAnalysis(database, current, siteAudit);
        equal(parity.exactMatchedStateCount, 0);
        equal(parity.auditedAliasMatchedStateCount, 1);
        equal(parity.currentStateKeysMissingInDatabase.length, 0);
        equal(parity.databaseStateKeysMissingInCurrent.length, 0);
        equal(parity.effectKindParity.atk.matchedStateCount, 1);
    });
});
