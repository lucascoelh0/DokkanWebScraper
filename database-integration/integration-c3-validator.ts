import { Character } from "../character";
import { TeamAnalysisDataset } from "../team-analysis";
import { IntegrationC2Dataset } from "./integration-c2-contract";
import { compareIntegrationC3Rule, INTEGRATION_C3_FIXTURES, validateIntegrationC3Fixtures } from "./integration-c3-builder";
import { IntegrationC3Dataset, IntegrationC3Validation } from "./integration-c3-contract";

const key = (value: { identity: { stateKey: string; effectKey: string } }) => `${value.identity.stateKey}|${value.identity.effectKey}`;
export function validateIntegrationC3Dataset(dataset: IntegrationC3Dataset, source: IntegrationC2Dataset, sourceSha256: string, production: TeamAnalysisDataset, characters: Character[], metadata: { production: IntegrationC3Dataset["sourceProductionTeamAnalysis"]; characters: IntegrationC3Dataset["sourceProductionCharacters"] }): IntegrationC3Validation {
    const failures: string[] = [], states = new Map(production.states.map(value => [value.stateKey, value])), expected = new Map(source.rules.map(rule => [key(rule), compareIntegrationC3Rule(rule, states.get(rule.identity.stateKey))])), seen = new Set<string>(); let exactReconstructionCount = 0, exactComparisonCount = 0;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-database-first-shadow-parity" || dataset.contractVersion !== "1.0.0" || dataset.generatedAt !== source.generatedAt || dataset.comparisonPolicy !== "structural_ids_only_parser_is_non_authoritative" || JSON.stringify(dataset.sourceSupportedSidecar) !== JSON.stringify({ fileName: "team-analysis-database-first-supported-c2.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }) || JSON.stringify(dataset.sourceProductionTeamAnalysis) !== JSON.stringify(metadata.production) || JSON.stringify(dataset.sourceProductionCharacters) !== JSON.stringify(metadata.characters)) failures.push("identity");
    for (const record of dataset.records) {
        const recordKey = key(record); if (seen.has(recordKey)) failures.push(`duplicate ${recordKey}`); seen.add(recordKey); const expectedRecord = expected.get(recordKey);
        if (JSON.stringify(record.databaseFirstRule) === JSON.stringify(source.rules.find(rule => key(rule) === recordKey))) exactReconstructionCount++; else failures.push(`source reconstruction ${recordKey}`);
        if (expectedRecord && JSON.stringify(record) === JSON.stringify(expectedRecord)) exactComparisonCount++; else failures.push(`comparison ${recordKey}`);
        if (record.classification === "confirmed_conflict") failures.push(`unsupported confirmed conflict ${recordKey}`);
    }
    if (dataset.records.length !== source.rules.length || seen.size !== expected.size) failures.push("cardinality");
    if (JSON.stringify(dataset.goldenFixtures) !== JSON.stringify(INTEGRATION_C3_FIXTURES)) failures.push("golden fixture catalog");
    failures.push(...validateIntegrationC3Fixtures(dataset.goldenFixtures, source.rules, characters));
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.records.length, exactReconstructionCount, exactComparisonCount, fixtureCount: dataset.goldenFixtures.length, mutationRejectionCount: 0, failures };
}
