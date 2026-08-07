"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIntegrationC2Coverage = exports.countForbiddenConsumerFields = exports.buildIntegrationC2Dataset = exports.projectIntegrationC2Rule = exports.projectIntegrationC2Target = exports.projectSupportedIntegrationDimension = void 0;
const projectSupportedIntegrationDimension = (dimension) => dimension.status === "supported" ? dimension.value : undefined;
exports.projectSupportedIntegrationDimension = projectSupportedIntegrationDimension;
function projectIntegrationC2Target(source) {
    if (!source)
        return undefined;
    const filters = [];
    for (const filter of source.subTarget?.filters ?? []) {
        if (filter.status !== "supported" || (filter.selector !== "card_category_id" && filter.selector !== "card_unique_info_set_id") || (filter.inclusion !== "include" && filter.inclusion !== "exclude") || filter.selectorId === null)
            return undefined;
        filters.push({ selector: filter.selector, inclusion: filter.inclusion, selectorId: filter.selectorId, ...(filter.memberCardUniqueInfoIds ? { memberCardUniqueInfoIds: filter.memberCardUniqueInfoIds } : {}) });
    }
    return { scope: source.scope, selfInclusion: source.selfInclusion, ...(source.subTarget ? { subTarget: { composition: source.subTarget.composition, emptySetBehavior: source.subTarget.emptySetBehavior, filters } } : {}) };
}
exports.projectIntegrationC2Target = projectIntegrationC2Target;
const projectTiming = (source) => source ? { event: source.event, sequence: source.sequence } : undefined;
function projectIntegrationC2Rule(source) {
    const target = projectIntegrationC2Target((0, exports.projectSupportedIntegrationDimension)(source.dimensions.target)), operation = (0, exports.projectSupportedIntegrationDimension)(source.dimensions.operation), valueUnit = (0, exports.projectSupportedIntegrationDimension)(source.dimensions.valueUnit), calculationBucket = (0, exports.projectSupportedIntegrationDimension)(source.dimensions.calculationBucket), timing = projectTiming((0, exports.projectSupportedIntegrationDimension)(source.dimensions.timing));
    if (!target || !operation || !valueUnit || !calculationBucket)
        return undefined;
    return { identity: source.identity, supported: { target, operation, valueUnit, calculationBucket, ...(timing ? { timing } : {}) } };
}
exports.projectIntegrationC2Rule = projectIntegrationC2Rule;
function buildIntegrationC2Dataset(source, sourceSha256) {
    if (source.schemaVersion !== 1 || source.contract !== "dokkan-team-analysis-database-first-sidecar-audit" || source.contractVersion !== "1.0.0" || !/^[a-f0-9]{64}$/.test(sourceSha256))
        throw Error("C2 source identity");
    const rules = source.rules.map(projectIntegrationC2Rule).filter((value) => value !== undefined);
    return { schemaVersion: 1, contract: "dokkan-team-analysis-database-first-supported-sidecar", contractVersion: "1.0.0", generatedAt: source.generatedAt, sourceSnapshotVersion: source.sourceSnapshotVersion, sourceDatabaseSha256: source.sourceDatabaseSha256, nativeRuntimeSha256: source.nativeRuntimeSha256, projectionPolicy: "status_exactly_supported", auditSidecar: { fileName: "team-analysis-database-first-sidecar-c1.json.gz", sha256: sourceSha256, contractVersion: "1.0.0" }, rules };
}
exports.buildIntegrationC2Dataset = buildIntegrationC2Dataset;
function countForbiddenConsumerFields(value) {
    const forbidden = new Set(["status", "missing", "raw", "audit", "provenance", "sourceText", "displayName", "name"]);
    let count = 0;
    const visit = (current) => { if (Array.isArray(current)) {
        for (const item of current)
            visit(item);
        return;
    } if (!current || typeof current !== "object")
        return; for (const [key, child] of Object.entries(current)) {
        if (forbidden.has(key))
            count++;
        visit(child);
    } };
    visit(value);
    return count;
}
exports.countForbiddenConsumerFields = countForbiddenConsumerFields;
function buildIntegrationC2Coverage(dataset, source) {
    return { schemaVersion: 1, sourceRuleCount: source.rules.length, projectedRuleCount: dataset.rules.length, omittedRuleCount: source.rules.length - dataset.rules.length, stateCount: new Set(dataset.rules.map(value => value.identity.stateKey)).size, passiveSkillCount: new Set(dataset.rules.map(value => value.identity.passiveSkillId)).size, includedDimensionCounts: { target: dataset.rules.length, operation: dataset.rules.length, valueUnit: dataset.rules.length, calculationBucket: dataset.rules.length, timing: dataset.rules.filter(value => value.supported.timing !== undefined).length }, omittedDimensionCounts: { condition: source.rules.filter(value => value.dimensions.condition.status !== "supported").length, timing: source.rules.filter(value => value.dimensions.timing.status !== "supported").length, lifecycle: source.rules.filter(value => value.dimensions.lifecycle.status !== "supported").length, probability: source.rules.filter(value => value.dimensions.probability.status !== "supported").length, attackKind: source.rules.filter(value => value.dimensions.attackKind.status !== "supported").length, finalHpApplication: source.rules.filter(value => value.dimensions.finalHpApplication.status !== "supported").length }, forbiddenFieldCount: countForbiddenConsumerFields(dataset) };
}
exports.buildIntegrationC2Coverage = buildIntegrationC2Coverage;
//# sourceMappingURL=integration-c2-builder.js.map