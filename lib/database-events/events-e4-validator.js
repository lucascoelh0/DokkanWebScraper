"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventsE4Dataset = exports.validateEventsE4NativeEvidence = void 0;
const crypto_1 = require("crypto");
const events_e4_builder_1 = require("./events-e4-builder");
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function validateEventsE4NativeEvidence(evidence, evidenceSha256, inspection) {
    if (evidenceSha256 !== "af048e03c860efc435310609c1989d49c6fd140c8f62f1a676dc3e2621b7c842" || evidence.schemaVersion !== 1 || evidence.scope !== "bounded_enemy_skill_efficacy_type_10_sqlite_to_runtime_consumer_audit" || evidence.sourceElfSha256 !== "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a" || evidence.sourceElfSizeBytes !== 95662296 || evidence.affectedReferencedEnemySkillCount !== 697 || evidence.semanticStatus !== "partial" || evidence.promotion !== "none" || evidence.sqliteBoundary.table !== "enemy_skills" || evidence.sqliteBoundary.rowConstructorSymbol !== "_ZN10EnemySkillC1EP12sqlite3_stmt" || evidence.sqliteBoundary.rowConstructorVma !== 46588352 || evidence.sqliteBoundary.rowConstructorSizeBytes !== 2296 || evidence.sqliteBoundary.rowConstructorCodeSha256 !== "e32835d21ae745fd1260e97e2238d5b08628887d7d82f80d040b6b03c0299473" || evidence.sqliteBoundary.fieldOffsetStatus !== "unknown" || evidence.conversion.symbol !== "_ZN14EnemySkillUtil19convertEfficacyTypeE22EnemySkillEfficacyType" || evidence.conversion.vma !== 67092860 || evidence.conversion.sizeBytes !== 924 || evidence.conversion.codeSha256 !== "8f1ae6dd1365ae397e7fc0a95c6daa72ff7ced4558b771ec1de938e23a584ea7" || evidence.conversion.mappingTableVma !== 35184340 || evidence.conversion.mappingTableSizeBytes !== 216 || evidence.conversion.mappingTableSha256 !== "230de2df298e03b0309d91b0a772cc74addd52601fedbcb12863cbeb892525dc" || evidence.conversion.target.enemyRawEfficacyType !== 10 || evidence.conversion.target.genericSkillEfficacyType !== 94 || evidence.genericDispatch.tableVma !== 92049840 || evidence.genericDispatch.entrySizeBytes !== 8 || evidence.genericDispatch.slotVma !== evidence.genericDispatch.tableVma + evidence.conversion.target.genericSkillEfficacyType * evidence.genericDispatch.entrySizeBytes || evidence.genericDispatch.relocationType !== 257 || evidence.genericDispatch.handlerSymbol !== "_ZN31AbilityEfficacyBadConditionFunc28callChangeInvalidateStunFuncEPN19AbilityEfficacyCore15CallChangeParamE" || evidence.genericDispatch.handlerVma !== 64277568 || evidence.callSiteAudit.textBytesScanned !== 42387476 || evidence.callSiteAudit.status !== "consumer_chain_unproven" || evidence.callSiteAudit.directBranchWithLinkCallsToConversionSymbol !== 0 || evidence.callSiteAudit.directBranchWithLinkCallsToConversionPlt !== 0)
        return false;
    const row = inspection.symbols.find(value => value.name === evidence.sqliteBoundary.rowConstructorSymbol), conversion = inspection.symbols.find(value => value.name === evidence.conversion.symbol), relocation = inspection.relocations.filter(value => value.offset === evidence.genericDispatch.slotVma);
    if (!row || row.value !== evidence.sqliteBoundary.rowConstructorVma || row.size !== evidence.sqliteBoundary.rowConstructorSizeBytes || sha(inspection.readVirtualBytes(row.value, row.size)) !== evidence.sqliteBoundary.rowConstructorCodeSha256 || !conversion || conversion.value !== evidence.conversion.vma || conversion.size !== evidence.conversion.sizeBytes || sha(inspection.readVirtualBytes(conversion.value, conversion.size)) !== evidence.conversion.codeSha256 || sha(inspection.readVirtualBytes(evidence.conversion.mappingTableVma, evidence.conversion.mappingTableSizeBytes)) !== evidence.conversion.mappingTableSha256)
        return false;
    const pairs = inspection.readVirtualBytes(evidence.conversion.mappingTableVma, evidence.conversion.mappingTableSizeBytes), matches = [];
    for (let offset = 0; offset < pairs.length; offset += 8)
        matches.push([pairs.readInt32LE(offset), pairs.readInt32LE(offset + 4)]);
    if (!matches.some(value => value[0] === evidence.conversion.target.enemyRawEfficacyType && value[1] === evidence.conversion.target.genericSkillEfficacyType) || relocation.length !== 1 || relocation[0].type !== evidence.genericDispatch.relocationType || relocation[0].symbolName !== evidence.genericDispatch.handlerSymbol || relocation[0].symbolValue !== evidence.genericDispatch.handlerVma)
        return false;
    return true;
}
exports.validateEventsE4NativeEvidence = validateEventsE4NativeEvidence;
function validateEventsE4Dataset(dataset, observation, e3, e2, nativeEvidence, nativeEvidenceSha256, nativeEvidenceValid, expected) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-mechanics" || dataset.contractVersion !== "0.5.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes")
        failures.push("contract identity");
    const rebuilt = (0, events_e4_builder_1.buildEventsE4Dataset)({ observation, e3, e2, nativeEvidence, nativeEvidenceSha256, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE3Sha256: dataset.sourceE3.sha256, sourceE2Sha256: dataset.sourceE2.sha256 }), exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt);
    if (!exactProjection)
        failures.push("exact source projection");
    if (!nativeEvidenceValid || dataset.nativeEvidence.promotion !== "none" || dataset.requestedMechanicCoverage.some(value => value.status === "supported"))
        failures.push("native or semantic promotion boundary");
    if (expected && (dataset.generatedAt !== expected.generatedAt || dataset.sourceSnapshotVersion !== expected.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== expected.sourceDatabaseSha256 || dataset.sourceE3.sha256 !== expected.sourceE3Sha256 || dataset.sourceE2.sha256 !== expected.sourceE2Sha256))
        failures.push("source lineage");
    const finite = (value) => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : true;
    if (!finite(dataset))
        failures.push("non-finite numeric value");
    const coverage = (0, events_e4_builder_1.buildEventsE4Coverage)(dataset, e3, e2, observation);
    if (coverage.danglingIdCount !== 0)
        failures.push(`dangling ids ${coverage.danglingIdCount}`);
    if (coverage.unboundQuestCategoryBonusCount !== 3)
        failures.push("historical unbound quest bonus baseline");
    const sourceRelationCount = observation.relatedCardCategories.length + observation.relatedLinkSkills.length + observation.relatedOptimalAwakenings.length + observation.relatedPassiveSkillSets.length, losslessRelationCount = dataset.relatedCardCategories.length + dataset.relatedLinkSkills.length + dataset.relatedOptimalAwakenings.length + dataset.relatedPassiveSkillSets.length;
    if (losslessRelationCount !== sourceRelationCount)
        failures.push("relation accounting");
    const inventoryEnemyCount = dataset.rawSkillTypeInventory.filter(value => value.sourceKind === "enemy_skill").reduce((sum, value) => sum + value.ruleCount, 0), inventoryRoundCount = dataset.rawSkillTypeInventory.filter(value => value.sourceKind === "enemy_round_skill").reduce((sum, value) => sum + value.ruleCount, 0), losslessRawRuleCount = inventoryEnemyCount + inventoryRoundCount;
    if (inventoryEnemyCount !== e3.enemySkills.length || inventoryRoundCount !== e3.enemyRoundSkills.length)
        failures.push("raw skill accounting");
    const affectedType10Count = e3.enemySkills.filter(value => Number(value.raw.efficacy_type) === 10).length, projectedType10Count = dataset.rawSkillTypeInventory.find(value => value.sourceKind === "enemy_skill" && value.rawEfficacyType === 10)?.ruleCount ?? 0;
    if (affectedType10Count !== nativeEvidence.affectedReferencedEnemySkillCount || projectedType10Count !== affectedType10Count)
        failures.push("native affected rule count");
    if (dataset.subTargetSets.reduce((sum, value) => sum + value.members.length, 0) !== observation.subTargetTypes.length || dataset.questCategoryBonuses.length !== observation.questCategoryBonuses.length || dataset.unboundEnemyAiConditions.length !== observation.enemyAiConditions.length || dataset.originHeatUpMechanics.reduce((sum, value) => sum + value.entries.length, 0) !== observation.heatUpGimmicks.length)
        failures.push("mechanic surface accounting");
    for (const skill of [...e3.enemySkills, ...e3.enemyRoundSkills]) {
        for (const column of ["causality_conditions", "efficacy_values"]) {
            const raw = skill.raw[column];
            if (raw === null || raw === undefined)
                continue;
            try {
                JSON.parse(String(raw));
            }
            catch {
                failures.push(`raw json ${skill.identity.id}/${column}`);
            }
        }
    }
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, losslessRelationCount, losslessRawRuleCount, nativeEvidenceValid, failures };
}
exports.validateEventsE4Dataset = validateEventsE4Dataset;
//# sourceMappingURL=events-e4-validator.js.map