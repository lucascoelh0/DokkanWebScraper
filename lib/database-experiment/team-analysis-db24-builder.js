"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb24Coverage = exports.buildDatabaseTeamAnalysisDb24Dataset = void 0;
const crypto_1 = require("crypto");
const DATABASE_COLUMNS = ["efficacy_type", "exec_timing_type", "exec_game_type", "target_type", "calc_option", "turn", "is_once", "probability", "causality_conditions", "eff_value1", "eff_value2", "eff_value3"];
const EXPECTED_BINDINGS = [
    { column: "eff_value1", passiveSkillOffset: 128, nativeField: "resistDamageRate" },
    { column: "eff_value2", passiveSkillOffset: 132, nativeField: "increaseDamagePercent" },
    { column: "eff_value3", passiveSkillOffset: 136, nativeField: "battleScriptNo" },
];
const EXPECTED_OBSERVATIONS = new Map([
    ["passive_skill_row_constructor", "sqlite_eff_value_columns_stored_at_offsets_128_132_136"],
    ["create_passive_skill", "passive_offsets_128_132_136_copied_in_order_to_runtime_values"],
    ["ability_status_efficacy_constructor", "three_runtime_values_materialized_in_index_order"],
    ["ability_status_value_reader", "indexed_runtime_value_read"],
    ["call_change_param_initializer", "runtime_values_copied_to_call_param_offsets_40_48_56"],
    ["counter_behavior_handler", "values_truncated_and_reordered_into_counter_behavior"],
    ["counter_increase_getter", "field_offset_8"],
    ["counter_resist_getter", "field_offset_12"],
    ["counter_script_getter", "field_offset_16"],
]);
const EXPECTED_CONCLUSIONS = ["efficacy_120_registers_counter_behavior", "eff_value1_maps_to_resist_damage_rate", "eff_value2_maps_to_increase_damage_percent", "eff_value3_maps_to_battle_script_no"];
const EXPECTED_UNKNOWNS = ["handler_gate_at_call_change_param_offset_4", "execution_timing_type_6_semantics", "condition_semantics", "probability_semantics", "calculation_bucket", "duration", "recurrence", "battle_script_behavior"];
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function type(value) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; }
function int32(value) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) && Math.trunc(parsed) >= -2147483648 && Math.trunc(parsed) <= 2147483647 ? Math.trunc(parsed) : undefined; }
function field(column, nativeField, raw) { const runtimeInteger = int32(raw); return { sqliteColumn: column, nativeField, raw, ...(runtimeInteger === undefined ? {} : { runtimeInteger }), status: runtimeInteger === undefined ? "unknown" : "supported" }; }
function count(values) { const result = {}; for (const value of values) {
    const key = value === null ? "null" : String(value);
    result[key] = (result[key] ?? 0) + 1;
} return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))); }
function statusCounts(values) { return { supported: values.filter(value => value === "supported").length, partial: values.filter(value => value === "partial").length, unknown: values.filter(value => value === "unknown").length }; }
function validateEvidence(inspection, evidence, nativeSha256) {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.efficacyType !== 120 || evidence.auditScope !== "passive-skill-sqlite-values-to-native-counter-behavior-payload")
        throw new Error("DB24 native evidence identity mismatch");
    if (evidence.codeRegions.length !== EXPECTED_OBSERVATIONS.size || evidence.sqliteColumnBindings.length !== EXPECTED_BINDINGS.length || JSON.stringify(evidence.conclusions) !== JSON.stringify(EXPECTED_CONCLUSIONS) || JSON.stringify(evidence.unknowns) !== JSON.stringify(EXPECTED_UNKNOWNS))
        throw new Error("DB24 native evidence shape mismatch");
    const seenRoles = new Set();
    for (const region of evidence.codeRegions) {
        if (seenRoles.has(region.role) || EXPECTED_OBSERVATIONS.get(region.role) !== region.observation || region.sizeBytes <= 0 || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256)
            throw new Error(`DB24 invalid native code region ${region.role}`);
        seenRoles.add(region.role);
        if (!region.symbol.startsWith("local@")) {
            const symbol = inspection.symbols.find(value => value.name === region.symbol);
            if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes)
                throw new Error(`DB24 native symbol mismatch ${region.role}`);
        }
    }
    for (let index = 0; index < EXPECTED_BINDINGS.length; index += 1) {
        const actual = evidence.sqliteColumnBindings[index], expected = EXPECTED_BINDINGS[index];
        if (actual.column !== expected.column || actual.passiveSkillOffset !== expected.passiveSkillOffset || actual.nativeField !== expected.nativeField || !inspection.readVirtualBytes(actual.literalVma, actual.column.length + 1).equals(Buffer.from(`${actual.column}\0`, "utf8")))
            throw new Error(`DB24 SQLite column binding mismatch ${expected.column}`);
    }
}
function buildDatabaseTeamAnalysisDb24Dataset(options) {
    if (options.db8.contractVersion !== "0.7.0" || options.db9.contractVersion !== "0.8.0" || options.db11.contractVersion !== "0.10.0" || options.db8.semanticPromotionCount !== 0 || options.db9.semanticPromotionCount !== 0 || options.db8.sourceSha256 !== options.db9.sourceDatabaseSha256 || options.db8.sourceSha256 !== options.db11.sourceSha256 || options.db8.sourceSnapshotVersion !== options.db9.sourceSnapshotVersion || options.db8.sourceSnapshotVersion !== options.db11.sourceSnapshotVersion || options.db9.sourceDb8.sha256 !== options.db8Sha256 || options.db9.nativeRuntime.sha256 !== options.nativeSha256 || options.db9.nativeRuntime.sizeBytes !== options.nativeSizeBytes)
        throw new Error("DB24 source lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const gaps = options.db8.efficacyGaps.filter(value => type(value.efficacyType) === 120), runtimes = options.db9.efficacyGapEvidence.filter(value => value.enumValue === 120), dispatches = options.db9.efficacyDispatchSlots.filter(value => value.enumValue === 120);
    if (gaps.length !== 1 || runtimes.length !== 1 || dispatches.length !== 1)
        throw new Error("DB24 efficacy 120 evidence cardinality mismatch");
    const gap = gaps[0], runtime = runtimes[0], dispatch = dispatches[0];
    const handler = options.evidence.codeRegions.find(value => value.role === "counter_behavior_handler");
    if (gap.statusCounts.unknown !== gap.ruleCount || runtime.identityStatus !== "runtime_identified" || runtime.occurrenceCount !== gap.ruleCount || runtime.affectedStateCount !== gap.affectedStateCount || runtime.symbol !== handler.symbol || runtime.symbolAddress !== handler.vma || dispatch.status !== "identified" || dispatch.symbol !== handler.symbol || dispatch.symbolAddress !== handler.vma)
        throw new Error("DB24 efficacy 120 evidence lineage mismatch");
    const rows = new Map();
    for (const row of options.tables.passive_skills ?? []) {
        const id = String(row.id);
        if (rows.has(id))
            throw new Error(`DB24 duplicate passive_skills row ${id}`);
        rows.set(id, row);
    }
    const resolutions = [];
    const keys = new Set();
    for (const state of options.db11.states)
        for (const rule of state.passive?.rules ?? []) {
            if (type(rule.source.efficacyType) !== 120)
                continue;
            const key = `${state.stateKey}|${rule.ruleKey}`;
            if (keys.has(key))
                throw new Error(`DB24 duplicate state/rule ${key}`);
            keys.add(key);
            const row = rows.get(rule.source.passiveSkillId);
            if (!row || !["id", ...DATABASE_COLUMNS].every(column => Object.prototype.hasOwnProperty.call(row, column)))
                throw new Error(`DB24 passive row missing or incomplete ${rule.source.passiveSkillId}`);
            if (type(row.efficacy_type) !== 120 || type(row.target_type) !== 1 || String(row.id) !== rule.source.passiveSkillId)
                throw new Error(`DB24 passive row outside audited target ${rule.source.passiveSkillId}`);
            resolutions.push({
                stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, efficacyType: 120,
                operation: "counter_behavior_registration", semanticStatus: "partial",
                payload: {
                    resistDamageRate: field("eff_value1", "resistDamageRate", row.eff_value1),
                    increaseDamagePercent: field("eff_value2", "increaseDamagePercent", row.eff_value2),
                    battleScriptNo: field("eff_value3", "battleScriptNo", row.eff_value3),
                },
                activation: {
                    executionTimingType: row.exec_timing_type, executionGameType: row.exec_game_type, targetType: row.target_type,
                    calculationOption: row.calc_option, turn: row.turn, isOnce: row.is_once, probability: row.probability,
                    causalityConditions: row.causality_conditions, conditionStatus: rule.conditionStatus, timingStatus: "unknown",
                    calculationBucket: "unknown", duration: "unknown", recurrence: "unknown",
                },
                provenance: {
                    database: { table: "passive_skills", rowId: rule.source.passiveSkillId, columns: [...DATABASE_COLUMNS] },
                    runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-counter-behavior-semantics.json", evidenceSha256: options.evidenceSha256, codeRegions: options.evidence.codeRegions },
                },
            });
        }
    resolutions.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true }));
    if (resolutions.length !== gap.ruleCount || new Set(resolutions.map(value => value.stateKey)).size !== gap.affectedStateCount)
        throw new Error("DB24 source gap accounting mismatch");
    return {
        schemaVersion: 1, contract: "dokkan-team-analysis-counter-behavior-native-semantics-experiment", contractVersion: "0.23.0", generatedAt: options.db11.generatedAt,
        sourceSnapshotVersion: options.db8.sourceSnapshotVersion, sourceDatabaseSha256: options.db8.sourceSha256,
        sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" },
        sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" },
        sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" },
        nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes },
        nativeEvidence: { fileName: "native-counter-behavior-semantics.json", sha256: options.evidenceSha256 },
        inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, counterBehaviorResolutions: resolutions,
    };
}
exports.buildDatabaseTeamAnalysisDb24Dataset = buildDatabaseTeamAnalysisDb24Dataset;
function buildDatabaseTeamAnalysisDb24Coverage(dataset, sourceGapRuleCount) {
    const fields = dataset.counterBehaviorResolutions.flatMap(value => Object.values(value.payload));
    return {
        schemaVersion: 1, sourceGapRuleCount, resolutionCount: dataset.counterBehaviorResolutions.length,
        affectedStateCount: new Set(dataset.counterBehaviorResolutions.map(value => value.stateKey)).size,
        supportedPayloadFieldCount: fields.filter(value => value.status === "supported").length,
        unknownPayloadFieldCount: fields.filter(value => value.status === "unknown").length,
        partialActivationCount: dataset.counterBehaviorResolutions.length,
        conditionStatusCounts: statusCounts(dataset.counterBehaviorResolutions.map(value => value.activation.conditionStatus)),
        executionTimingTypeCounts: count(dataset.counterBehaviorResolutions.map(value => value.activation.executionTimingType)),
        probabilityCounts: count(dataset.counterBehaviorResolutions.map(value => value.activation.probability)),
        inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1,
    };
}
exports.buildDatabaseTeamAnalysisDb24Coverage = buildDatabaseTeamAnalysisDb24Coverage;
//# sourceMappingURL=team-analysis-db24-builder.js.map