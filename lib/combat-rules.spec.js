"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const combat_rules_1 = require("./combat-rules");
const combat_rules_artifacts_1 = require("./combat-rules-artifacts");
const fixture = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)("fixtures/combat-rules/gate-a8-golden.json"), "utf8"));
(0, mocha_1.describe)("Combat Rules Gate A8", () => {
    (0, mocha_1.it)("builds a source-neutral versioned dataset accepted by the schema validator", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.deepEqual)((0, combat_rules_1.validateCombatRulesDataset)(dataset), []);
        (0, assert_1.equal)(dataset.schemaVersion, 1);
        (0, assert_1.equal)(dataset.combatRulesVersion, "1.0.0");
        (0, assert_1.equal)(dataset.compatibleTeamAnalysisSchemaVersion, 1);
        (0, assert_1.deepEqual)(dataset.compatibleTeamAnalysisRulesVersionRange, { minInclusive: "1", maxInclusive: "1" });
        (0, assert_1.equal)(dataset.minimumTeamAnalysisParserVersion, "1.7.1");
        (0, assert_1.deepEqual)(dataset.requiredTeamAnalysisCapabilities, ["sa-stat-raise-lifecycle-v1"]);
        (0, assert_1.equal)(dataset.rules.some(rule => rule.structuralReferences.some(reference => /characterId|stateKey/.test(reference))), false);
    });
    (0, mocha_1.it)("keeps verified, corroborated, candidate, and unresolved rules distinguishable", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        const coverage = (0, combat_rules_1.buildCombatRulesCoverageReport)(dataset);
        (0, assert_1.equal)(coverage.verifiedRuleCount, 2);
        (0, assert_1.equal)(coverage.corroboratedRuleCount, 5);
        (0, assert_1.equal)(coverage.candidateRuleCount, 10);
        (0, assert_1.equal)(coverage.unresolvedRuleCount, 12);
        (0, assert_1.equal)(coverage.normativeRuleCount, 2);
        (0, assert_1.ok)(dataset.rules.filter(rule => rule.status !== "verified").every(rule => !rule.normative));
        (0, assert_1.ok)(dataset.unresolvedRules.every(rule => !rule.normative));
    });
    (0, mocha_1.it)("loads fixture examples for verified, candidate, and unresolved statuses", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.equal)(dataset.rules.find(rule => rule.id === fixture.statusExamples.verified)?.status, "verified");
        (0, assert_1.equal)(dataset.rules.find(rule => rule.id === fixture.statusExamples.candidate)?.status, "candidate");
        (0, assert_1.equal)(dataset.unresolvedRules.find(rule => rule.id === fixture.statusExamples.unresolved)?.status, "unresolved");
    });
    (0, mocha_1.it)("reproduces documented workbook structures without promoting them to a calculator", () => {
        const guard = fixture.documentedMathematicalExamples[0];
        const g = guard.inputs;
        const guardStages = [
            g.enemyAtk * g.variance,
            g.enemyAtk * g.variance * g.alignment,
            g.enemyAtk * g.variance * g.alignment - g.defense,
            (g.enemyAtk * g.variance * g.alignment - g.defense) * g.guardCoefficient,
        ];
        (0, assert_1.deepEqual)(normalizeFloatingPoint(guardStages), guard.expectedStages);
        (0, assert_1.equal)(normalizeFloatingPoint(guardStages)[guardStages.length - 1], guard.expectedResult);
        (0, assert_1.equal)(guard.productionCalculatorEvidence, false);
        const tdb = fixture.documentedMathematicalExamples[1];
        const t = tdb.inputs;
        const tdbStages = [
            t.enemyAtk * t.saMultiplier,
            t.enemyAtk * t.saMultiplier * t.variance,
            t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel),
            t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel) - t.defense,
            (t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel) - t.defense) * t.guardCoefficient,
        ];
        (0, assert_1.deepEqual)(normalizeFloatingPoint(tdbStages), tdb.expectedStages);
        (0, assert_1.equal)(normalizeFloatingPoint(tdbStages)[tdbStages.length - 1], tdb.expectedResult);
        (0, assert_1.equal)(tdb.productionCalculatorEvidence, false);
    });
    (0, mocha_1.it)("rejects unknown enums and malformed provenance", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        broken.rules[0].channel = "passive_magic";
        broken.rules[0].provenance[0].source = "wiki_guess";
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("rule-channel"));
        (0, assert_1.ok)(codes.includes("provenance-source"));
    });
    (0, mocha_1.it)("rejects a normative rule without sufficient evidence", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        broken.rules[0].provenance = [{
                id: "community-only",
                source: "community_guide",
                evidenceLevel: "corroborating",
                reference: "https://example.test/guide",
                supports: ["value"],
            }];
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("normative-evidence"));
    });
    (0, mocha_1.it)("does not let structural joins promote a numeric community rule", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        const critical = broken.rules.find((rule) => rule.id === "hidden-potential.critical-rate");
        critical.status = "verified";
        critical.normative = true;
        critical.provenance = [{
                id: "structural-only",
                source: "first_party_structural_join",
                evidenceLevel: "structural",
                reference: "game-db/export",
                supports: ["structure"],
            }];
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("normative-evidence"));
    });
    (0, mocha_1.it)("rejects pre-A7.1 compatibility and missing lifecycle capability", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        broken.minimumTeamAnalysisParserVersion = "1.7.0";
        broken.requiredTeamAnalysisCapabilities = [];
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("team-parser-compatibility"));
        (0, assert_1.ok)(codes.includes("team-capability-compatibility"));
    });
    (0, mocha_1.it)("rejects per-character, runtime-state, and calculated-result fields", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        broken.rules[0].value.characterId = "1001";
        broken.rules[0].value.runtimeState = { turn: 3 };
        broken.rules[0].calculatedDamage = 123;
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("source-neutrality"));
    });
    (0, mocha_1.it)("rejects invalid percentages, ranges, and compatibility", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        broken.rules.find((rule) => rule.id === "hidden-potential.critical-rate").value.amountPerLevel = 1.2;
        const variance = broken.rules.find((rule) => rule.id === "variance.observed-range");
        variance.value.min = 2;
        variance.value.max = 1;
        broken.compatibleTeamAnalysisRulesVersionRange.minInclusive = "2";
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("percentage-range"));
        (0, assert_1.ok)(codes.includes("range-order"));
        (0, assert_1.ok)(codes.includes("version-range-order"));
        (0, assert_1.ok)(codes.includes("team-rules-compatibility"));
    });
    (0, mocha_1.it)("rejects contradictory order and rounding claims", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        const guard = broken.rules.find((rule) => rule.id === "guard.coefficient-after-defense");
        guard.applicationOrder.before = ["damage_received.subtract_resolved_def"];
        guard.rounding = { status: "unresolved", mode: "floor", boundaries: ["after_guard"] };
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("order-contradiction"));
        (0, assert_1.ok)(codes.includes("rounding-contradiction"));
    });
    (0, mocha_1.it)("produces byte-identical payloads with an exact size and SHA-256 manifest", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        const first = (0, combat_rules_artifacts_1.buildCombatRulesArtifact)(dataset);
        const second = (0, combat_rules_artifacts_1.buildCombatRulesArtifact)(dataset);
        (0, assert_1.equal)(first.jsonText, second.jsonText);
        (0, assert_1.equal)(first.payloadBuffer.equals(second.payloadBuffer), true);
        (0, assert_1.equal)(first.manifest.sha256, second.manifest.sha256);
        (0, assert_1.equal)(first.manifest.sizeBytes, first.payloadBuffer.byteLength);
        (0, assert_1.deepEqual)((0, combat_rules_artifacts_1.validateCombatRulesArtifact)(first, dataset), []);
        (0, assert_1.deepEqual)(JSON.parse(first.jsonText), dataset);
        (0, assert_1.match)(first.manifest.datasetVersion, /^combat-rules-1\.0\.0$/);
    });
    (0, mocha_1.it)("detects payload, size, hash, and compatibility manifest tampering", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        const artifact = (0, combat_rules_artifacts_1.buildCombatRulesArtifact)(dataset);
        const broken = {
            ...artifact,
            payloadBuffer: Buffer.from(`${artifact.jsonText} `),
            manifest: {
                ...artifact.manifest,
                sizeBytes: artifact.manifest.sizeBytes + 1,
                compatibleTeamAnalysisSchemaVersion: 2,
                datasetVersion: "combat-rules-wrong",
                requiredTeamAnalysisCapabilities: [],
            },
        };
        const issues = (0, combat_rules_artifacts_1.validateCombatRulesArtifact)(broken, dataset);
        (0, assert_1.ok)(issues.some(issue => issue.includes("payload bytes")));
        (0, assert_1.ok)(issues.some(issue => issue.includes("SHA-256")));
        (0, assert_1.ok)(issues.some(issue => issue.includes("Team Analysis compatibility")));
        (0, assert_1.ok)(issues.some(issue => issue.includes("dataset identity")));
    });
});
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function normalizeFloatingPoint(values) {
    return values.map(value => Math.round(value * 1000000) / 1000000);
}
//# sourceMappingURL=combat-rules.spec.js.map