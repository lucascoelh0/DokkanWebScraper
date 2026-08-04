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

const fixture = JSON.parse(readFileSync(resolve("fixtures/combat-rules/gate-a8-golden.json"), "utf8")) as GateA8Fixture;

describe("Combat Rules Gate A8", () => {
    it("builds a source-neutral versioned dataset accepted by the schema validator", () => {
        const dataset = buildCombatRulesDataset();
        deepEqual(validateCombatRulesDataset(dataset), []);
        equal(dataset.schemaVersion, 1);
        equal(dataset.combatRulesVersion, "1.0.0");
        equal(dataset.compatibleTeamAnalysisSchemaVersion, 1);
        deepEqual(dataset.compatibleTeamAnalysisRulesVersionRange, { minInclusive: "1", maxInclusive: "1" });
        equal(dataset.minimumTeamAnalysisParserVersion, "1.7.1");
        deepEqual(dataset.requiredTeamAnalysisCapabilities, ["sa-stat-raise-lifecycle-v1"]);
        equal(dataset.rules.some(rule => rule.structuralReferences.some(reference => /characterId|stateKey/.test(reference))), false);
    });

    it("keeps verified, corroborated, candidate, and unresolved rules distinguishable", () => {
        const dataset = buildCombatRulesDataset();
        const coverage = buildCombatRulesCoverageReport(dataset);
        equal(coverage.verifiedRuleCount, 2);
        equal(coverage.corroboratedRuleCount, 5);
        equal(coverage.candidateRuleCount, 10);
        equal(coverage.unresolvedRuleCount, 12);
        equal(coverage.normativeRuleCount, 2);
        ok(dataset.rules.filter(rule => rule.status !== "verified").every(rule => !rule.normative));
        ok(dataset.unresolvedRules.every(rule => !rule.normative));
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
        broken.rules.find((rule: any) => rule.id === "hidden-potential.critical-rate").value.amountPerLevel = 1.2;
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
        match(first.manifest.datasetVersion, /^combat-rules-1\.0\.0$/);
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
