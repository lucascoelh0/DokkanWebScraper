"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const combat_rules_1 = require("./combat-rules");
const combat_rules_artifacts_1 = require("./combat-rules-artifacts");
const fixture = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)("fixtures/combat-rules/gate-a8-golden.json"), "utf8"));
const gateA81Fixture = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)("fixtures/combat-rules/gate-a81-golden.json"), "utf8"));
(0, mocha_1.describe)("Combat Rules Gates A8 and A8.1", () => {
    (0, mocha_1.it)("builds a source-neutral versioned dataset accepted by the schema validator", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.deepEqual)((0, combat_rules_1.validateCombatRulesDataset)(dataset), []);
        (0, assert_1.equal)(dataset.schemaVersion, 2);
        (0, assert_1.equal)(dataset.combatRulesVersion, "1.1.0");
        (0, assert_1.equal)(dataset.compatibleTeamAnalysisSchemaVersion, 1);
        (0, assert_1.deepEqual)(dataset.compatibleTeamAnalysisRulesVersionRange, { minInclusive: "1", maxInclusive: "1" });
        (0, assert_1.equal)(dataset.minimumTeamAnalysisParserVersion, "1.7.1");
        (0, assert_1.deepEqual)(dataset.requiredTeamAnalysisCapabilities, ["sa-stat-raise-lifecycle-v1"]);
        (0, assert_1.equal)(dataset.rules.some(rule => rule.structuralReferences.some(reference => /characterId|stateKey/.test(reference))), false);
        (0, assert_1.ok)([...dataset.rules, ...dataset.unresolvedRules].every(rule => Array.isArray(rule.dimensions)));
        (0, assert_1.ok)([...dataset.rules, ...dataset.unresolvedRules].every(rule => rule.applicationOrder && rule.rounding));
        (0, assert_1.ok)([...dataset.rules, ...dataset.unresolvedRules].every(rule => Array.isArray(rule.structuralExceptions) && Array.isArray(rule.requiredRuntimeInputs)));
    });
    (0, mocha_1.it)("keeps verified, corroborated, candidate, and unresolved rules distinguishable", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        const coverage = (0, combat_rules_1.buildCombatRulesCoverageReport)(dataset);
        (0, assert_1.equal)(coverage.verifiedRuleCount, 7);
        (0, assert_1.equal)(coverage.corroboratedRuleCount, 5);
        (0, assert_1.equal)(coverage.candidateRuleCount, 13);
        (0, assert_1.equal)(coverage.unresolvedRuleCount, 15);
        (0, assert_1.equal)(coverage.normativeRuleCount, 7);
        (0, assert_1.ok)(dataset.rules.filter(rule => rule.status !== "verified").every(rule => !rule.normative));
        (0, assert_1.ok)(dataset.unresolvedRules.every(rule => !rule.normative));
        (0, assert_1.ok)(dataset.rules.filter(rule => rule.status !== "verified").every(rule => rule.consumptionPolicy === "explicit_assumption_required"));
        (0, assert_1.ok)(dataset.unresolvedRules.every(rule => rule.consumptionPolicy === "return_unknown"));
    });
    (0, mocha_1.it)("promotes only first-party Super Attack facts with claim-specific direct evidence", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        const promotedIds = [
            "hidden-potential.super-attack-boost-rate",
            "super-attack.first-party-coefficient-fields",
            "super-attack.skill-level-cap-source",
            "super-attack.first-party-effect-row-selection",
            "super-attack.first-party-stat-raise-values",
        ];
        for (const id of promotedIds) {
            const rule = dataset.rules.find(item => item.id === id);
            (0, assert_1.equal)(rule?.status, "verified");
            (0, assert_1.equal)(rule?.normative, true);
            (0, assert_1.ok)(rule?.provenance.some(item => item.source === "first_party_game_db_table" && item.evidenceLevel === "direct"));
        }
        const boost = dataset.rules.find(rule => rule.id === "hidden-potential.super-attack-boost-rate");
        (0, assert_1.deepEqual)(boost?.value, { kind: "rate_per_level", amountPerLevel: 5, levelUnit: "hidden_potential_skill_level" });
        (0, assert_1.equal)(boost?.applicationOrder.status, "unresolved");
    });
    (0, mocha_1.it)("pins reproducible first-party fixture queries to the audited snapshot hash", () => {
        (0, assert_1.match)(gateA81Fixture.sourceEvidence.sha256, /^[a-f0-9]{64}$/);
        (0, assert_1.equal)(gateA81Fixture.sourceEvidence.relativePath.endsWith("database.decrypted.sqlite"), true);
        (0, assert_1.deepEqual)(gateA81Fixture.sourceEvidence.queries.map(query => query.id), [
            "coefficient-fields",
            "attack-styles",
            "release-caps",
            "raise-values",
            "sa-boost-values",
            "stacking-exception-source-values",
        ]);
        (0, assert_1.ok)(gateA81Fixture.sourceEvidence.queries.every(query => /^SELECT /.test(query.sql)));
    });
    (0, mocha_1.it)("covers tier fields and initial, intermediate, and observed maximum levels without executing the candidate formula", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.deepEqual)(gateA81Fixture.coefficientFieldSamples.map(sample => sample.tier), ["huge", "extreme", "supreme", "immense", "colossal", "mega_colossal", "destructive", "ultimate"]);
        (0, assert_1.deepEqual)(gateA81Fixture.skillLevelSamples.map(sample => sample.skillLevel), [1, 5, 10, 15, 20, 25]);
        const formula = dataset.rules.find(rule => rule.id === "super-attack.level-progression-formula");
        (0, assert_1.equal)(formula?.status, "candidate");
        (0, assert_1.equal)(formula?.normative, false);
        (0, assert_1.equal)(formula?.rounding.status, "unresolved");
    });
    (0, mocha_1.it)("keeps Super, Ultra, Unit, EX, EZA, and SEZA selection unresolved when source dimensions are insufficient", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.deepEqual)(gateA81Fixture.attackStyleSamples.map(sample => sample.style), ["Normal", "Hyper", "Condition", "Extra", "FullPower"]);
        (0, assert_1.deepEqual)(gateA81Fixture.attackStyleSamples.slice(0, 4).map(sample => sample.requestedVariantAudit), ["super", "ultra", "unit", "ex"]);
        (0, assert_1.ok)(gateA81Fixture.attackStyleSamples.every(sample => sample.variantMappingStatus === "unresolved"));
        (0, assert_1.ok)(gateA81Fixture.releaseCapSamples.some(sample => sample.releaseLabel.includes("eza_unresolved")));
        (0, assert_1.ok)(gateA81Fixture.releaseCapSamples.some(sample => sample.releaseLabel.includes("seza")));
        (0, assert_1.equal)(dataset.unresolvedRules.find(rule => rule.id === "super-attack.variant-selection")?.status, "unresolved");
        (0, assert_1.equal)(dataset.unresolvedRules.find(rule => rule.id === "super-attack.release-state-eza-seza")?.status, "unresolved");
    });
    (0, mocha_1.it)("covers finite and persistent ATK/DEF raises through exact first-party effect rows", () => {
        const samples = gateA81Fixture.raiseSamples;
        (0, assert_1.ok)(samples.some(sample => sample.stats === "atk" && sample.turns === 1 && sample.atkPercent === 30));
        (0, assert_1.ok)(samples.some(sample => sample.stats === "def" && sample.turns === 1 && sample.defPercent === 100));
        (0, assert_1.ok)(samples.some(sample => sample.stats === "atk_def" && sample.turns === 99));
        const rule = (0, combat_rules_1.buildCombatRulesDataset)().rules.find(item => item.id === "super-attack.first-party-stat-raise-values");
        (0, assert_1.equal)(rule?.status, "verified");
        (0, assert_1.ok)((rule?.structuralExceptions.length ?? 0) > 0);
    });
    (0, mocha_1.it)("keeps multiple-Super stacking penalty, known exceptions, conflicts, and partial mappings non-normative", () => {
        const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
        (0, assert_1.deepEqual)(gateA81Fixture.stackingPenaltyExamples.filter(item => item.superAttackOrdinal).map(item => item.superAttackOrdinal), [1, 2]);
        (0, assert_1.ok)(gateA81Fixture.stackingPenaltyExamples.every(item => !item.productionCalculatorEvidence));
        (0, assert_1.ok)(gateA81Fixture.evidenceBoundaries.conflictingFirstPartyRows.length >= 2);
        (0, assert_1.equal)(dataset.rules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.partialTableRuleId)?.normative, false);
        (0, assert_1.equal)(dataset.rules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.communityOnlyRuleId)?.status, "candidate");
        (0, assert_1.equal)(dataset.unresolvedRules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.missingDimensionRuleId)?.status, "unresolved");
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
    (0, mocha_1.it)("does not let first-party input values promote an unproved formula", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        const formula = broken.rules.find((rule) => rule.id === "super-attack.level-progression-formula");
        formula.status = "verified";
        formula.normative = true;
        formula.provenance = [{
                id: "first-party-inputs-only",
                source: "first_party_game_db_table",
                evidenceLevel: "direct",
                reference: "game-db/tables",
                supports: ["structure", "value"],
            }];
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("normative-evidence"));
    });
    (0, mocha_1.it)("requires direct value support plus snapshot and locator for normative first-party table structures", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        const selection = broken.rules.find((rule) => rule.id === "super-attack.first-party-effect-row-selection");
        selection.provenance = [{
                id: "structure-only",
                source: "first_party_game_db_table",
                evidenceLevel: "direct",
                reference: "game-db/tables",
                supports: ["structure"],
            }];
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("normative-evidence"));
        (0, assert_1.ok)(codes.includes("provenance-snapshot"));
        (0, assert_1.ok)(codes.includes("provenance-locator"));
    });
    (0, mocha_1.it)("rejects missing contract dimensions and malformed structural exceptions/runtime inputs", () => {
        const broken = clone((0, combat_rules_1.buildCombatRulesDataset)());
        delete broken.rules[0].dimensions;
        broken.rules[1].structuralExceptions = [{ id: "bad", kind: "guess", structuralKeys: [], notes: "" }];
        broken.rules[2].requiredRuntimeInputs = [7];
        broken.rules[3].consumptionPolicy = "normative";
        const codes = (0, combat_rules_1.validateCombatRulesDataset)(broken).map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("rule-dimensions"));
        (0, assert_1.ok)(codes.includes("structural-exception-schema"));
        (0, assert_1.ok)(codes.includes("runtime-inputs"));
        (0, assert_1.ok)(codes.includes("consumption-policy"));
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
        broken.rules.find((rule) => rule.id === "hidden-potential.super-attack-boost-rate").value.amountPerLevel = 101;
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
        (0, assert_1.match)(first.manifest.datasetVersion, /^combat-rules-1\.1\.0$/);
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