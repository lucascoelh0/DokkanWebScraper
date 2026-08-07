import { Character } from "../character";
import { CharacterStateAnalysis, PassiveEffect, TeamAnalysisDataset } from "../team-analysis";
import { IntegrationC2Dataset, IntegrationC2Rule, IntegrationC2Target } from "./integration-c2-contract";
import { IntegrationC3Coverage, IntegrationC3Dataset, IntegrationC3ExpectedRepresentation, IntegrationC3GoldenFixture, IntegrationC3ProductionCandidate, IntegrationC3Record } from "./integration-c3-contract";

export const INTEGRATION_C3_FIXTURES: IntegrationC3GoldenFixture[] = [
    { kind: "transformation", characterId: "1017491", formId: "4017501", stateKey: "1017491:4017501:initial", releaseState: "initial", transformationSource: "active-skill" },
    { kind: "reversible_exchange", characterId: "1030431", formId: "4030441", stateKey: "1030431:4030441:initial", releaseState: "initial", transformationSource: "reversible-exchange" },
    { kind: "standby", characterId: "1026901", formId: "4026911", stateKey: "1026901:4026911:initial", releaseState: "initial", transformationSource: "standby" },
    { kind: "finish", characterId: "1026901", formId: "4026921", stateKey: "1026901:4026921:initial", releaseState: "initial", transformationSource: "finish-skill" },
    { kind: "eza", characterId: "1006521", formId: "1006521", stateKey: "1006521:1006521:eza", releaseState: "eza" },
    { kind: "seza", characterId: "1005301", formId: "1005301", stateKey: "1005301:1005301:seza", releaseState: "seza" },
    { kind: "auxiliary_form", characterId: "1019141", formId: "4019151", stateKey: "1019141:4019151:initial", releaseState: "initial", transformationSource: "active-skill" },
];

function expectedTarget(target: IntegrationC2Target): IntegrationC3ExpectedRepresentation["target"] {
    if ((target.subTarget?.filters.length ?? 0) > 0) return { status: "unknown", missing: ["production_target_uses_localized_names_without_first_party_selector_ids"] };
    const scopes: Partial<Record<IntegrationC2Target["scope"], string>> = { self: "self", team_allies: "team_allies", enemy: "enemy", all_enemies: "all_enemies", super_class_allies: "class_allies", extreme_class_allies: "class_allies" };
    const scope = scopes[target.scope];
    if (!scope || target.scope.endsWith("class_allies")) return { status: "unknown", missing: ["production_target_cannot_be_compared_losslessly_by_structural_ids"] };
    return { status: "supported", scope, ...(scope === "self" ? {} : { selfInclusion: target.selfInclusion }) };
}

export function expectedIntegrationC3Representation(rule: IntegrationC2Rule): IntegrationC3ExpectedRepresentation {
    const target = expectedTarget(rule.supported.target);
    if (rule.supported.operation.kind === "damage_mitigation") {
        if (rule.supported.valueUnit.kind !== "remaining_damage_rate") throw Error(`C3 mitigation value/unit ${rule.identity.effectKey}`);
        return { kind: "damage_reduction", value: rule.supported.valueUnit.reductionContributionPercentPoints, unit: "percent", target };
    }
    if (rule.supported.operation.kind === "force_guard") return { kind: "guard", value: 1, unit: "boolean", target };
    return { kind: "counter_resistance", target };
}

function candidates(state: CharacterStateAnalysis | undefined, expected: IntegrationC3ExpectedRepresentation): IntegrationC3ProductionCandidate[] {
    if (!state || expected.kind === "counter_resistance") return [];
    const result: IntegrationC3ProductionCandidate[] = [];
    for (const rule of state.passive?.rules ?? []) (rule.effects ?? []).forEach((effect: PassiveEffect, effectOrdinal: number) => {
        if (effect.kind !== expected.kind) return;
        result.push({ parserRuleId: rule.id, effectOrdinal, kind: effect.kind, ...(effect.value === undefined ? {} : { value: effect.value }), ...(effect.unit === undefined ? {} : { unit: effect.unit }), target: { scope: effect.target?.scope, ...(effect.target?.selfInclusion === undefined ? {} : { selfInclusion: effect.target.selfInclusion }) } });
    });
    return result;
}

function exact(candidate: IntegrationC3ProductionCandidate, expected: IntegrationC3ExpectedRepresentation): boolean {
    if (expected.target.status !== "supported") return false;
    if (candidate.kind !== expected.kind || candidate.value !== expected.value || candidate.unit !== expected.unit || candidate.target?.scope !== expected.target.scope) return false;
    return expected.target.selfInclusion === undefined || candidate.target?.selfInclusion === expected.target.selfInclusion;
}

export function compareIntegrationC3Rule(rule: IntegrationC2Rule, state: CharacterStateAnalysis | undefined): IntegrationC3Record {
    const expectedRepresentation = expectedIntegrationC3Representation(rule), productionCandidates = candidates(state, expectedRepresentation);
    const common = { identity: rule.identity, databaseFirstRule: rule, ruleJoin: { status: "unavailable" as const, reason: "production_contract_has_no_first_party_passive_rule_or_effect_identity" as const }, expectedRepresentation, productionCandidates };
    if (!state) return { ...common, stateJoin: { status: "unjoinable", key: "stateKey" }, classification: "unjoinable", basis: "no_state_join", reason: "state_key_absent_from_production_snapshot" };
    const stateJoin = { status: "joined" as const, key: "stateKey" as const, productionStateKey: state.stateKey };
    if (expectedRepresentation.kind === "counter_resistance" || productionCandidates.length === 0) return { ...common, stateJoin, classification: "representation_gain", basis: "state_key_only", reason: "no_comparable_production_effect_kind" };
    if (productionCandidates.some(value => exact(value, expectedRepresentation))) return { ...common, stateJoin, classification: "agreement", basis: "state_key_then_exact_effect_representation", reason: "at_least_one_exact_representation_in_joined_state_rule_identity_unavailable" };
    return { ...common, stateJoin, classification: "unknown", basis: "state_key_only", reason: expectedRepresentation.target.status === "unknown" ? "target_not_comparable_by_structural_ids" : "different_representation_without_common_first_party_rule_identity" };
}

export function validateIntegrationC3Fixtures(fixtures: IntegrationC3GoldenFixture[], rules: IntegrationC2Rule[], characters: Character[]): string[] {
    const failures: string[] = [], stateKeys = new Set(rules.map(value => value.identity.stateKey)), characterMap = new Map(characters.map(value => [value.id, value]));
    for (const fixture of fixtures) {
        if (!stateKeys.has(fixture.stateKey)) failures.push(`fixture sidecar state ${fixture.stateKey}`);
        const fixtureRule = rules.find(value => value.identity.stateKey === fixture.stateKey);
        if (fixtureRule && (fixtureRule.identity.cardId !== fixture.characterId || fixtureRule.identity.formId !== fixture.formId || fixtureRule.identity.releaseState !== fixture.releaseState)) failures.push(`fixture structural identity ${fixture.stateKey}`);
        const character = characterMap.get(fixture.characterId); if (!character) { failures.push(`fixture character ${fixture.characterId}`); continue; }
        if (fixture.transformationSource) {
            const transformation = character.transformations?.find(value => value.id === fixture.formId && value.transformationSource === fixture.transformationSource);
            if (!transformation) failures.push(`fixture transformation ${fixture.stateKey}`);
        } else if (fixture.formId !== fixture.characterId) failures.push(`fixture release form ${fixture.stateKey}`);
    }
    return failures;
}

export function buildIntegrationC3Dataset(source: IntegrationC2Dataset, sourceSha256: string, production: TeamAnalysisDataset, productionMeta: { fileName: string; sha256: string; datasetVersion: string; parserVersion: string }, charactersMeta: { fileName: string; sha256: string; datasetVersion: string }): IntegrationC3Dataset {
    const states = new Map(production.states.map(value => [value.stateKey, value]));
    return { schemaVersion: 1, contract: "dokkan-team-analysis-database-first-shadow-parity", contractVersion: "1.0.0", generatedAt: source.generatedAt, comparisonPolicy: "structural_ids_only_parser_is_non_authoritative", sourceSupportedSidecar: { fileName: "team-analysis-database-first-supported-c2.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }, sourceProductionTeamAnalysis: productionMeta, sourceProductionCharacters: charactersMeta, records: source.rules.map(rule => compareIntegrationC3Rule(rule, states.get(rule.identity.stateKey))), goldenFixtures: INTEGRATION_C3_FIXTURES };
}

export function buildIntegrationC3Coverage(dataset: IntegrationC3Dataset): IntegrationC3Coverage {
    const counts = { agreement: 0, representation_gain: 0, confirmed_conflict: 0, unjoinable: 0, unknown: 0 }; for (const record of dataset.records) counts[record.classification]++;
    const states = new Set(dataset.records.map(value => value.identity.stateKey)), joined = new Set(dataset.records.filter(value => value.stateJoin.status === "joined").map(value => value.identity.stateKey));
    const fixtureCounts = { transformation: 0, reversible_exchange: 0, standby: 0, finish: 0, eza: 0, seza: 0, auxiliary_form: 0 }; for (const fixture of dataset.goldenFixtures) fixtureCounts[fixture.kind]++;
    return { schemaVersion: 1, ruleCount: dataset.records.length, sidecarStateCount: states.size, joinedStateCount: joined.size, unjoinableStateCount: states.size - joined.size, joinedRuleCount: dataset.records.filter(value => value.stateJoin.status === "joined").length, classificationCounts: counts, operationCounts: { damageMitigation: dataset.records.filter(value => value.expectedRepresentation.kind === "damage_reduction").length, forceGuard: dataset.records.filter(value => value.expectedRepresentation.kind === "guard").length, counterResistance: dataset.records.filter(value => value.expectedRepresentation.kind === "counter_resistance").length }, fixtureCounts, commonFirstPartyRuleIdentityCount: 0 };
}
