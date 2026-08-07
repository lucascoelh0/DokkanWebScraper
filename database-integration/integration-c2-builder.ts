import { IntegrationC1Dataset, IntegrationC1Rule, IntegrationDimension } from "./integration-c1-contract";
import { IntegrationC2Coverage, IntegrationC2Dataset, IntegrationC2Rule, IntegrationC2Target, IntegrationC2Timing } from "./integration-c2-contract";

export const projectSupportedIntegrationDimension = <T>(dimension: IntegrationDimension<T>): T | undefined => dimension.status === "supported" ? dimension.value : undefined;
export function projectIntegrationC2Target(source: ReturnType<typeof projectSupportedIntegrationDimension<IntegrationC1Rule["dimensions"]["target"] extends IntegrationDimension<infer T> ? T : never>>): IntegrationC2Target | undefined {
    if (!source) return undefined;
    const filters: NonNullable<IntegrationC2Target["subTarget"]>["filters"] = [];
    for (const filter of source.subTarget?.filters ?? []) {
        if (filter.status !== "supported" || (filter.selector !== "card_category_id" && filter.selector !== "card_unique_info_set_id") || (filter.inclusion !== "include" && filter.inclusion !== "exclude") || filter.selectorId === null) return undefined;
        filters.push({ selector: filter.selector, inclusion: filter.inclusion, selectorId: filter.selectorId, ...(filter.memberCardUniqueInfoIds ? { memberCardUniqueInfoIds: filter.memberCardUniqueInfoIds } : {}) });
    }
    return { scope: source.scope, selfInclusion: source.selfInclusion, ...(source.subTarget ? { subTarget: { composition: source.subTarget.composition, emptySetBehavior: source.subTarget.emptySetBehavior, filters } } : {}) };
}
const projectTiming = (source: ReturnType<typeof projectSupportedIntegrationDimension<IntegrationC1Rule["dimensions"]["timing"] extends IntegrationDimension<infer T> ? T : never>>): IntegrationC2Timing | undefined => source ? { event: source.event, sequence: source.sequence } : undefined;
export function projectIntegrationC2Rule(source: IntegrationC1Rule): IntegrationC2Rule | undefined {
    const target = projectIntegrationC2Target(projectSupportedIntegrationDimension(source.dimensions.target)), operation = projectSupportedIntegrationDimension(source.dimensions.operation), valueUnit = projectSupportedIntegrationDimension(source.dimensions.valueUnit), calculationBucket = projectSupportedIntegrationDimension(source.dimensions.calculationBucket), timing = projectTiming(projectSupportedIntegrationDimension(source.dimensions.timing));
    if (!target || !operation || !valueUnit || !calculationBucket) return undefined;
    return { identity: source.identity, supported: { target, operation, valueUnit, calculationBucket, ...(timing ? { timing } : {}) } };
}
export function buildIntegrationC2Dataset(source: IntegrationC1Dataset, sourceSha256: string): IntegrationC2Dataset {
    if (source.schemaVersion !== 1 || source.contract !== "dokkan-team-analysis-database-first-sidecar-audit" || source.contractVersion !== "1.0.0" || !/^[a-f0-9]{64}$/.test(sourceSha256)) throw Error("C2 source identity");
    const rules = source.rules.map(projectIntegrationC2Rule).filter((value): value is IntegrationC2Rule => value !== undefined);
    return { schemaVersion: 1, contract: "dokkan-team-analysis-database-first-supported-sidecar", contractVersion: "1.0.0", generatedAt: source.generatedAt, sourceSnapshotVersion: source.sourceSnapshotVersion, sourceDatabaseSha256: source.sourceDatabaseSha256, nativeRuntimeSha256: source.nativeRuntimeSha256, projectionPolicy: "status_exactly_supported", auditSidecar: { fileName: "team-analysis-database-first-sidecar-c1.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }, rules };
}
export function countForbiddenConsumerFields(value: unknown): number {
    const forbidden = new Set(["status", "missing", "raw", "audit", "provenance", "sourceText", "displayName", "name"]); let count = 0;
    const visit = (current: unknown): void => { if (Array.isArray(current)) { for (const item of current) visit(item); return; } if (!current || typeof current !== "object") return; for (const [key, child] of Object.entries(current as Record<string, unknown>)) { if (forbidden.has(key)) count++; visit(child); } };
    visit(value); return count;
}
export function buildIntegrationC2Coverage(dataset: IntegrationC2Dataset, source: IntegrationC1Dataset): IntegrationC2Coverage {
    return { schemaVersion: 1, sourceRuleCount: source.rules.length, projectedRuleCount: dataset.rules.length, omittedRuleCount: source.rules.length - dataset.rules.length, stateCount: new Set(dataset.rules.map(value => value.identity.stateKey)).size, passiveSkillCount: new Set(dataset.rules.map(value => value.identity.passiveSkillId)).size, includedDimensionCounts: { target: dataset.rules.length, operation: dataset.rules.length, valueUnit: dataset.rules.length, calculationBucket: dataset.rules.length, timing: dataset.rules.filter(value => value.supported.timing !== undefined).length }, omittedDimensionCounts: { condition: source.rules.filter(value => value.dimensions.condition.status !== "supported").length, timing: source.rules.filter(value => value.dimensions.timing.status !== "supported").length, lifecycle: source.rules.filter(value => value.dimensions.lifecycle.status !== "supported").length, probability: source.rules.filter(value => value.dimensions.probability.status !== "supported").length, attackKind: source.rules.filter(value => value.dimensions.attackKind.status !== "supported").length, finalHpApplication: source.rules.filter(value => value.dimensions.finalHpApplication.status !== "supported").length }, forbiddenFieldCount: countForbiddenConsumerFields(dataset) };
}
