"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseCharacterSkillsDataset = void 0;
const key = (value) => `${value.identity.stateKey}|${value.identity.ruleKey}|${value.identity.efficacyType}|${value.identity.effectOrdinal}`;
function validateDatabaseCharacterSkillsDataset(dataset, coverage, c1, c2) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-characters-skills" || dataset.contractVersion !== "1.0.0")
        failures.push("contract identity");
    if (!dataset.policy.rawSkillRowsAreAuditOnly || !dataset.policy.rawRowsNormalizedByTableAndRowId || !dataset.policy.supportedMechanicsAreC2ExactProjection || dataset.policy.partialOrUnknownMechanicsInConsumerChannel || dataset.policy.textUsedAsIdentity)
        failures.push("policy");
    if (coverage.stateCount !== 10654 || coverage.leaderSkillStateCount !== 10654 || coverage.passiveSkillStateCount !== 10434)
        failures.push("DB1 state skill cardinality");
    if (JSON.stringify(coverage.attackCounts) !== JSON.stringify({ super: 12429, ultra: 1255, unit: 186, ex: 20, unknown: 0 }))
        failures.push("attack variant cardinality");
    if (coverage.activeSkillCardCount !== 494 || coverage.standbySkillCardCount !== 28 || coverage.finishSkillCardCount !== 56)
        failures.push("action skill cardinality");
    if (coverage.supportedMechanicRuleCount !== 1350 || coverage.supportedMechanicStateCount !== 575 || coverage.supportedMechanicPassiveSkillCount !== 1296 || coverage.supportedTimingCount !== 1277)
        failures.push("C2 cardinality");
    if (coverage.unjoinedSupportedRuleCount || coverage.forbiddenConsumerFieldCount || coverage.duplicateStateIdentityCount || coverage.duplicateSupportedRuleIdentityCount)
        failures.push("join/identity/consumer purity");
    const rawRowKeys = new Set(dataset.rawRows.map(row => `${row.provenance.table}:${row.provenance.rowId}`));
    const refs = [];
    for (const state of dataset.stateSkills) {
        refs.push(...state.release.routes);
        if (state.growthStep)
            refs.push(state.growthStep);
        if (state.leaderSkill)
            refs.push(state.leaderSkill.set, ...state.leaderSkill.effects, ...state.leaderSkill.targetRows);
        if (state.passiveSkill)
            for (const relation of state.passiveSkill.relations)
                refs.push(relation.relation, ...(relation.skill ? [relation.skill] : []), ...(relation.effect ? [relation.effect] : []), ...relation.causalities);
        for (const attack of state.attacks)
            refs.push(attack.cardSpecial, ...(attack.specialSet ? [attack.specialSet] : []), ...attack.effects, ...(attack.extraOption ? [attack.extraOption] : []));
    }
    for (const card of dataset.actionSkills)
        for (const item of [...card.activeSkills, ...card.standbySkills, ...card.finishSkills])
            refs.push(...(item.relation ? [item.relation] : []), ...(item.set ? [item.set] : []), ...item.effects);
    if (rawRowKeys.size !== dataset.rawRows.length || refs.some(ref => !rawRowKeys.has(`${ref.table}:${ref.rowId}`)))
        failures.push("raw row normalization");
    const expected = new Map(c2.rules.map(rule => [key(rule), rule]));
    for (const projected of dataset.supportedMechanics) {
        const source = expected.get(key(projected));
        if (!source || projected.sourceTeamAnalysisStateKey !== source.identity.stateKey || JSON.stringify(projected.identity) !== JSON.stringify(source.identity) || JSON.stringify(projected.supported) !== JSON.stringify(source.supported))
            failures.push(`C2 projection ${key(projected)}`);
        const state = dataset.stateSkills.find(item => item.stateId === projected.stateId);
        const expectedRelease = projected.identity.formId === projected.identity.cardId ? projected.sourceReleaseState : "initial";
        if (!state || state.cardId !== projected.identity.formId || state.releaseState !== projected.sourceReleaseState || projected.identity.releaseState !== expectedRelease)
            failures.push(`state binding ${key(projected)}`);
    }
    if (dataset.supportedMechanics.length !== expected.size || c1.rules.length !== c2.rules.length || c2.auditSidecar.sha256 !== dataset.source.c1AuditArtifact.sha256)
        failures.push("source lineage");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)] };
}
exports.validateDatabaseCharacterSkillsDataset = validateDatabaseCharacterSkillsDataset;
//# sourceMappingURL=skills-validator.js.map