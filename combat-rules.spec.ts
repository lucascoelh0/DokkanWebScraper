import { deepEqual, equal, match, ok } from "assert";
import { readFileSync } from "fs";
import { describe, it } from "mocha";
import { resolve } from "path";
import {
    buildCombatRulesCoverageReport,
    buildCombatRulesDataset,
    CombatRulesDataset,
    validateCombatRulesDataset,
} from "./combat-rules";
import {
    buildCombatRulesArtifact,
    validateCombatRulesArtifact,
} from "./combat-rules-artifacts";

interface GateA8Fixture {
    fixtureVersion: number;
    statusExamples: {
        verified: string;
        candidate: string;
        unresolved: string;
    };
    documentedMathematicalExamples: Array<{
        id: string;
        status: "corroborated" | "candidate";
        inputs: Record<string, number>;
        expectedStages: number[];
        expectedResult: number;
        productionCalculatorEvidence: boolean;
    }>;
}

interface GateA81Fixture {
    fixtureVersion: number;
    sourceEvidence: {
        relativePath: string;
        sha256: string;
        queries: Array<{ id: string; sql: string }>;
    };
    coefficientFieldSamples: Array<{ tier: string; specialSetId: number; increaseRate: number; levelBonus: number; status: "candidate" | "unresolved" }>;
    skillLevelSamples: Array<{ phase: string; skillLevel: number }>;
    attackStyleSamples: Array<{ cardSpecialId: number; style: string; kiThreshold: number; requestedVariantAudit: string; variantMappingStatus: "unresolved" }>;
    releaseCapSamples: Array<{ source: string; skillLevelCap: number; releaseLabel: string }>;
    raiseSamples: Array<{ specialId: number; stats: string; turns: number; atkPercent: number; defPercent: number; kind: string }>;
    hiddenPotentialSuperAttackBoostSamples: Array<{ skillLevel: number; firstPartyValue: number }>;
    stackingPenaltyExamples: Array<{ id: string; superAttackOrdinal?: number; specialSetIds?: number[]; status: "candidate"; productionCalculatorEvidence: false }>;
    evidenceBoundaries: {
        conflictingFirstPartyRows: unknown[];
        partialTableRuleId: string;
        communityOnlyRuleId: string;
        missingDimensionRuleId: string;
    };
}

const fixture = JSON.parse(readFileSync(resolve("fixtures/combat-rules/gate-a8-golden.json"), "utf8")) as GateA8Fixture;
const gateA81Fixture = JSON.parse(readFileSync(resolve("fixtures/combat-rules/gate-a81-golden.json"), "utf8")) as GateA81Fixture;

describe("Combat Rules Gates A8 and A8.1", () => {
    it("builds a source-neutral versioned dataset accepted by the schema validator", () => {
        const dataset = buildCombatRulesDataset();
        deepEqual(validateCombatRulesDataset(dataset), []);
        equal(dataset.schemaVersion, 2);
        equal(dataset.combatRulesVersion, "1.1.0");
        equal(dataset.compatibleTeamAnalysisSchemaVersion, 1);
        deepEqual(dataset.compatibleTeamAnalysisRulesVersionRange, { minInclusive: "1", maxInclusive: "1" });
        equal(dataset.minimumTeamAnalysisParserVersion, "1.7.1");
        deepEqual(dataset.requiredTeamAnalysisCapabilities, ["sa-stat-raise-lifecycle-v1"]);
        equal(dataset.rules.some(rule => rule.structuralReferences.some(reference => /characterId|stateKey/.test(reference))), false);
        ok([...dataset.rules, ...dataset.unresolvedRules].every(rule => Array.isArray(rule.dimensions)));
        ok([...dataset.rules, ...dataset.unresolvedRules].every(rule => rule.applicationOrder && rule.rounding));
        ok([...dataset.rules, ...dataset.unresolvedRules].every(rule => Array.isArray(rule.structuralExceptions) && Array.isArray(rule.requiredRuntimeInputs)));
    });

    it("keeps verified, corroborated, candidate, and unresolved rules distinguishable", () => {
        const dataset = buildCombatRulesDataset();
        const coverage = buildCombatRulesCoverageReport(dataset);
        equal(coverage.verifiedRuleCount, 7);
        equal(coverage.corroboratedRuleCount, 5);
        equal(coverage.candidateRuleCount, 13);
        equal(coverage.unresolvedRuleCount, 15);
        equal(coverage.normativeRuleCount, 7);
        ok(dataset.rules.filter(rule => rule.status !== "verified").every(rule => !rule.normative));
        ok(dataset.unresolvedRules.every(rule => !rule.normative));
        ok(dataset.rules.filter(rule => rule.status !== "verified").every(rule => rule.consumptionPolicy === "explicit_assumption_required"));
        ok(dataset.unresolvedRules.every(rule => rule.consumptionPolicy === "return_unknown"));
    });

    it("promotes only first-party Super Attack facts with claim-specific direct evidence", () => {
        const dataset = buildCombatRulesDataset();
        const promotedIds = [
            "hidden-potential.super-attack-boost-rate",
            "super-attack.first-party-coefficient-fields",
            "super-attack.skill-level-cap-source",
            "super-attack.first-party-effect-row-selection",
            "super-attack.first-party-stat-raise-values",
        ];
        for (const id of promotedIds) {
            const rule = dataset.rules.find(item => item.id === id);
            equal(rule?.status, "verified");
            equal(rule?.normative, true);
            ok(rule?.provenance.some(item => item.source === "first_party_game_db_table" && item.evidenceLevel === "direct"));
        }
        const boost = dataset.rules.find(rule => rule.id === "hidden-potential.super-attack-boost-rate");
        deepEqual(boost?.value, { kind: "rate_per_level", amountPerLevel: 5, levelUnit: "hidden_potential_skill_level" });
        equal(boost?.applicationOrder.status, "unresolved");
    });

    it("pins reproducible first-party fixture queries to the audited snapshot hash", () => {
        match(gateA81Fixture.sourceEvidence.sha256, /^[a-f0-9]{64}$/);
        equal(gateA81Fixture.sourceEvidence.relativePath.endsWith("database.decrypted.sqlite"), true);
        deepEqual(gateA81Fixture.sourceEvidence.queries.map(query => query.id), [
            "coefficient-fields",
            "attack-styles",
            "release-caps",
            "raise-values",
            "sa-boost-values",
            "stacking-exception-source-values",
        ]);
        ok(gateA81Fixture.sourceEvidence.queries.every(query => /^SELECT /.test(query.sql)));
    });

    it("covers tier fields and initial, intermediate, and observed maximum levels without executing the candidate formula", () => {
        const dataset = buildCombatRulesDataset();
        deepEqual(gateA81Fixture.coefficientFieldSamples.map(sample => sample.tier), ["huge", "extreme", "supreme", "immense", "colossal", "mega_colossal", "destructive", "ultimate"]);
        deepEqual(gateA81Fixture.skillLevelSamples.map(sample => sample.skillLevel), [1, 5, 10, 15, 20, 25]);
        const formula = dataset.rules.find(rule => rule.id === "super-attack.level-progression-formula");
        equal(formula?.status, "candidate");
        equal(formula?.normative, false);
        equal(formula?.rounding.status, "unresolved");
    });

    it("keeps Super, Ultra, Unit, EX, EZA, and SEZA selection unresolved when source dimensions are insufficient", () => {
        const dataset = buildCombatRulesDataset();
        deepEqual(gateA81Fixture.attackStyleSamples.map(sample => sample.style), ["Normal", "Hyper", "Condition", "Extra", "FullPower"]);
        deepEqual(gateA81Fixture.attackStyleSamples.slice(0, 4).map(sample => sample.requestedVariantAudit), ["super", "ultra", "unit", "ex"]);
        ok(gateA81Fixture.attackStyleSamples.every(sample => sample.variantMappingStatus === "unresolved"));
        ok(gateA81Fixture.releaseCapSamples.some(sample => sample.releaseLabel.includes("eza_unresolved")));
        ok(gateA81Fixture.releaseCapSamples.some(sample => sample.releaseLabel.includes("seza")));
        equal(dataset.unresolvedRules.find(rule => rule.id === "super-attack.variant-selection")?.status, "unresolved");
        equal(dataset.unresolvedRules.find(rule => rule.id === "super-attack.release-state-eza-seza")?.status, "unresolved");
    });

    it("covers finite and persistent ATK/DEF raises through exact first-party effect rows", () => {
        const samples = gateA81Fixture.raiseSamples;
        ok(samples.some(sample => sample.stats === "atk" && sample.turns === 1 && sample.atkPercent === 30));
        ok(samples.some(sample => sample.stats === "def" && sample.turns === 1 && sample.defPercent === 100));
        ok(samples.some(sample => sample.stats === "atk_def" && sample.turns === 99));
        const rule = buildCombatRulesDataset().rules.find(item => item.id === "super-attack.first-party-stat-raise-values");
        equal(rule?.status, "verified");
        ok((rule?.structuralExceptions.length ?? 0) > 0);
    });

    it("keeps multiple-Super stacking penalty, known exceptions, conflicts, and partial mappings non-normative", () => {
        const dataset = buildCombatRulesDataset();
        deepEqual(gateA81Fixture.stackingPenaltyExamples.filter(item => item.superAttackOrdinal).map(item => item.superAttackOrdinal), [1, 2]);
        ok(gateA81Fixture.stackingPenaltyExamples.every(item => !item.productionCalculatorEvidence));
        ok(gateA81Fixture.evidenceBoundaries.conflictingFirstPartyRows.length >= 2);
        equal(dataset.rules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.partialTableRuleId)?.normative, false);
        equal(dataset.rules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.communityOnlyRuleId)?.status, "candidate");
        equal(dataset.unresolvedRules.find(rule => rule.id === gateA81Fixture.evidenceBoundaries.missingDimensionRuleId)?.status, "unresolved");
    });

    it("loads fixture examples for verified, candidate, and unresolved statuses", () => {
        const dataset = buildCombatRulesDataset();
        equal(dataset.rules.find(rule => rule.id === fixture.statusExamples.verified)?.status, "verified");
        equal(dataset.rules.find(rule => rule.id === fixture.statusExamples.candidate)?.status, "candidate");
        equal(dataset.unresolvedRules.find(rule => rule.id === fixture.statusExamples.unresolved)?.status, "unresolved");
    });

    it("reproduces documented workbook structures without promoting them to a calculator", () => {
        const guard = fixture.documentedMathematicalExamples[0];
        const g = guard.inputs;
        const guardStages = [
            g.enemyAtk * g.variance,
            g.enemyAtk * g.variance * g.alignment,
            g.enemyAtk * g.variance * g.alignment - g.defense,
            (g.enemyAtk * g.variance * g.alignment - g.defense) * g.guardCoefficient,
        ];
        deepEqual(normalizeFloatingPoint(guardStages), guard.expectedStages);
        equal(normalizeFloatingPoint(guardStages)[guardStages.length - 1], guard.expectedResult);
        equal(guard.productionCalculatorEvidence, false);

        const tdb = fixture.documentedMathematicalExamples[1];
        const t = tdb.inputs;
        const tdbStages = [
            t.enemyAtk * t.saMultiplier,
            t.enemyAtk * t.saMultiplier * t.variance,
            t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel),
            t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel) - t.defense,
            (t.enemyAtk * t.saMultiplier * t.variance * (t.alignment - t.tdbPerLevel * t.tdbLevel) - t.defense) * t.guardCoefficient,
        ];
        deepEqual(normalizeFloatingPoint(tdbStages), tdb.expectedStages);
        equal(normalizeFloatingPoint(tdbStages)[tdbStages.length - 1], tdb.expectedResult);
        equal(tdb.productionCalculatorEvidence, false);
    });

    it("rejects unknown enums and malformed provenance", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        broken.rules[0].channel = "passive_magic";
        broken.rules[0].provenance[0].source = "wiki_guess";
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("rule-channel"));
        ok(codes.includes("provenance-source"));
    });

    it("rejects a normative rule without sufficient evidence", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        broken.rules[0].provenance = [{
            id: "community-only",
            source: "community_guide",
            evidenceLevel: "corroborating",
            reference: "https://example.test/guide",
            supports: ["value"],
        }];
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("normative-evidence"));
    });

    it("does not let structural joins promote a numeric community rule", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        const critical = broken.rules.find((rule: any) => rule.id === "hidden-potential.critical-rate");
        critical.status = "verified";
        critical.normative = true;
        critical.provenance = [{
            id: "structural-only",
            source: "first_party_structural_join",
            evidenceLevel: "structural",
            reference: "game-db/export",
            supports: ["structure"],
        }];
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("normative-evidence"));
    });

    it("does not let first-party input values promote an unproved formula", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        const formula = broken.rules.find((rule: any) => rule.id === "super-attack.level-progression-formula");
        formula.status = "verified";
        formula.normative = true;
        formula.provenance = [{
            id: "first-party-inputs-only",
            source: "first_party_game_db_table",
            evidenceLevel: "direct",
            reference: "game-db/tables",
            supports: ["structure", "value"],
        }];
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("normative-evidence"));
    });

    it("requires direct value support plus snapshot and locator for normative first-party table structures", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        const selection = broken.rules.find((rule: any) => rule.id === "super-attack.first-party-effect-row-selection");
        selection.provenance = [{
            id: "structure-only",
            source: "first_party_game_db_table",
            evidenceLevel: "direct",
            reference: "game-db/tables",
            supports: ["structure"],
        }];
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("normative-evidence"));
        ok(codes.includes("provenance-snapshot"));
        ok(codes.includes("provenance-locator"));
    });

    it("rejects missing contract dimensions and malformed structural exceptions/runtime inputs", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        delete broken.rules[0].dimensions;
        broken.rules[1].structuralExceptions = [{ id: "bad", kind: "guess", structuralKeys: [], notes: "" }];
        broken.rules[2].requiredRuntimeInputs = [7];
        broken.rules[3].consumptionPolicy = "normative";
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("rule-dimensions"));
        ok(codes.includes("structural-exception-schema"));
        ok(codes.includes("runtime-inputs"));
        ok(codes.includes("consumption-policy"));
    });

    it("rejects pre-A7.1 compatibility and missing lifecycle capability", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        broken.minimumTeamAnalysisParserVersion = "1.7.0";
        broken.requiredTeamAnalysisCapabilities = [];
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("team-parser-compatibility"));
        ok(codes.includes("team-capability-compatibility"));
    });

    it("rejects per-character, runtime-state, and calculated-result fields", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        broken.rules[0].value.characterId = "1001";
        broken.rules[0].value.runtimeState = { turn: 3 };
        broken.rules[0].calculatedDamage = 123;
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("source-neutrality"));
    });

    it("rejects invalid percentages, ranges, and compatibility", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        broken.rules.find((rule: any) => rule.id === "hidden-potential.super-attack-boost-rate").value.amountPerLevel = 101;
        const variance = broken.rules.find((rule: any) => rule.id === "variance.observed-range");
        variance.value.min = 2;
        variance.value.max = 1;
        broken.compatibleTeamAnalysisRulesVersionRange.minInclusive = "2";
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("percentage-range"));
        ok(codes.includes("range-order"));
        ok(codes.includes("version-range-order"));
        ok(codes.includes("team-rules-compatibility"));
    });

    it("rejects contradictory order and rounding claims", () => {
        const broken = clone(buildCombatRulesDataset()) as any;
        const guard = broken.rules.find((rule: any) => rule.id === "guard.coefficient-after-defense");
        guard.applicationOrder.before = ["damage_received.subtract_resolved_def"];
        guard.rounding = { status: "unresolved", mode: "floor", boundaries: ["after_guard"] };
        const codes = validateCombatRulesDataset(broken).map(issue => issue.code);
        ok(codes.includes("order-contradiction"));
        ok(codes.includes("rounding-contradiction"));
    });

    it("produces byte-identical payloads with an exact size and SHA-256 manifest", () => {
        const dataset = buildCombatRulesDataset();
        const first = buildCombatRulesArtifact(dataset);
        const second = buildCombatRulesArtifact(dataset);
        equal(first.jsonText, second.jsonText);
        equal(first.payloadBuffer.equals(second.payloadBuffer), true);
        equal(first.manifest.sha256, second.manifest.sha256);
        equal(first.manifest.sizeBytes, first.payloadBuffer.byteLength);
        deepEqual(validateCombatRulesArtifact(first, dataset), []);
        deepEqual(JSON.parse(first.jsonText), dataset);
        match(first.manifest.datasetVersion, /^combat-rules-1\.1\.0$/);
    });

    it("detects payload, size, hash, and compatibility manifest tampering", () => {
        const dataset = buildCombatRulesDataset();
        const artifact = buildCombatRulesArtifact(dataset);
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
        const issues = validateCombatRulesArtifact(broken, dataset);
        ok(issues.some(issue => issue.includes("payload bytes")));
        ok(issues.some(issue => issue.includes("SHA-256")));
        ok(issues.some(issue => issue.includes("Team Analysis compatibility")));
        ok(issues.some(issue => issue.includes("dataset identity")));
    });
});

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFloatingPoint(values: number[]): number[] {
    return values.map(value => Math.round(value * 1_000_000) / 1_000_000);
}
