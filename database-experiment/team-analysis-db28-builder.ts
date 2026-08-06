import { createHash } from "crypto";
import { DatabaseExperimentTables } from "./builder";
import { SqliteScalar } from "./contract";
import { NativeRuntimeElfInspection } from "./native-runtime-elf-adapter";
import { Db11ConditionExpression, DatabaseTeamAnalysisDb11Dataset } from "./team-analysis-db11-contract";
import { DatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-contract";
import { DatabaseTeamAnalysisDb9Dataset } from "./team-analysis-db9-contract";
import { DatabaseTeamAnalysisDb28Coverage, DatabaseTeamAnalysisDb28Dataset, Db28NativeCodeRegion, Db28NativeRevivalEvidence, Db28RevivalCounterPredicate, Db28RevivalCounterResolution } from "./team-analysis-db28-contract";

const TYPES = [47, 54] as const;
const CONCLUSIONS = ["counter_is_incremented_after_available_revival_skill_view_callback", "counter_is_consulted_by_revival_availability_and_reset_by_named_runtime_writer", "type_47_tests_ability_owner_pure_current_record_counter_gt_zero", "type_54_tests_party_pure_and_back_current_records_with_cau_val1_polarity"];
const UNKNOWNS = ["reset_trigger_and_history_window", "activation_timing", "recurrence", "calculation_bucket", "counter_overflow_behavior"];
const COUNTER_OBSERVATIONS = ["available_revival_efficacy_setup_callback_increments_pure_current_record_counter", "revival_availability_rejects_positive_counters_across_party_records", "zeros_same_counter_across_in_game_character_records"];

function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function integer(value: unknown): number | undefined { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isSafeInteger(parsed) ? parsed : undefined; }
function validateCode(inspection: NativeRuntimeElfInspection, region: Db28NativeCodeRegion, label: string): void { const symbol = inspection.symbols.find(value => value.name === region.symbol); if (!symbol || symbol.value !== region.vma || symbol.size !== region.sizeBytes || sha256(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) throw new Error(`DB28 ${label} native code mismatch`); }
function relocation(inspection: NativeRuntimeElfInspection, offset: number, symbol: string): boolean { const matches = inspection.relocations.filter(value => value.offset === offset); return matches.length === 1 && matches[0].symbolName === symbol; }

function validateEvidence(inspection: NativeRuntimeElfInspection, evidence: Db28NativeRevivalEvidence, nativeSha256: string): void {
    if (evidence.schemaVersion !== 1 || evidence.sourceSha256 !== nativeSha256 || evidence.auditScope !== "causality-types-47-54-revival-activation-counter" || JSON.stringify(evidence.conclusions) !== JSON.stringify(CONCLUSIONS) || JSON.stringify(evidence.unknowns) !== JSON.stringify(UNKNOWNS)) throw new Error("DB28 native evidence identity mismatch");
    const payload = evidence.skillCausalityPayload;
    if (payload.containerOffset !== 8 || payload.elementSizeBytes !== 4 || JSON.stringify(payload.indexColumns) !== JSON.stringify(["cau_val1", "cau_val2", "cau_val3"])) throw new Error("DB28 SkillCausality payload layout mismatch");
    validateCode(inspection, { symbol: payload.constructorSymbol, vma: payload.constructorVma, sizeBytes: payload.constructorSizeBytes, codeSha256: payload.constructorCodeSha256 }, "SkillCausality constructor");
    validateCode(inspection, { symbol: payload.rowConstructorSymbol, vma: payload.rowConstructorVma, sizeBytes: payload.rowConstructorSizeBytes, codeSha256: payload.rowConstructorCodeSha256 }, "SkillCausality row constructor");
    const ability = evidence.abilityStatusVtable, abilitySymbol = inspection.symbols.find(value => value.name === ability.symbol);
    if (!abilitySymbol || abilitySymbol.value !== ability.vma || abilitySymbol.size !== ability.sizeBytes || ability.sizeBytes !== 360 || ability.deckIndexSlotOffset !== 88 || !relocation(inspection, ability.vma + ability.deckIndexSlotOffset, ability.deckIndexSymbol)) throw new Error("DB28 AbilityStatus vtable evidence mismatch");
    const inGame = evidence.inGameDataVtable, inGameSymbol = inspection.symbols.find(value => value.name === inGame.symbol);
    if (!inGameSymbol || inGameSymbol.value !== inGame.vma || inGameSymbol.size !== inGame.sizeBytes || inGame.sizeBytes !== 472 || inGame.pureCurrentSlotOffset !== 40 || inGame.backCurrentSlotOffset !== 88 || !relocation(inspection, inGame.vma + inGame.pureCurrentSlotOffset, inGame.pureCurrentSymbol) || !relocation(inspection, inGame.vma + inGame.backCurrentSlotOffset, inGame.backCurrentSymbol)) throw new Error("DB28 InGameData vtable evidence mismatch");
    const counter = evidence.counter;
    if (counter.inGameCharaDataOffset !== 616 || counter.widthBits !== 32 || JSON.stringify([counter.incrementWriter.observation, counter.availabilityReader.observation, counter.resetWriter.observation]) !== JSON.stringify(COUNTER_OBSERVATIONS)) throw new Error("DB28 revival counter evidence mismatch");
    validateCode(inspection, counter.incrementWriter, "revival increment writer"); validateCode(inspection, counter.availabilityReader, "revival availability reader"); validateCode(inspection, counter.resetWriter, "revival reset writer");
    if (evidence.handlers.length !== 2 || new Set(evidence.handlers.map(value => value.causalityType)).size !== 2) throw new Error("DB28 handler cardinality mismatch");
    for (const handler of evidence.handlers) {
        validateCode(inspection, handler, `handler ${handler.causalityType}`);
        const expected = handler.causalityType === 47
            ? ["ability_owner_deck_index_pure_current_record", "revival_skill_activation_count_gt_zero", "", "cau_val1,cau_val2,cau_val3", ""]
            : ["deck_indices_0_through_6_pure_and_back_current_records", "any_revival_skill_activation_count_gt_zero", "cau_val1", "cau_val2,cau_val3", "zero_requires_any_nonzero_requires_none"];
        if ([handler.scope, handler.predicate, handler.parameterReads.join(","), handler.ignoredParameters.join(","), handler.cauVal1Polarity ?? ""].join("|") !== expected.join("|")) throw new Error(`DB28 handler semantics mismatch ${handler.causalityType}`);
    }
}

function collect(expression: Db11ConditionExpression): Array<{ id: string, type: 47 | 54 }> {
    const rawType = integer(expression.op === "unknown" ? expression.causalityType ?? (typeof expression.raw === "object" && expression.raw !== null ? (expression.raw as Record<string, unknown>).causality_type : undefined) : undefined);
    if (expression.op === "unknown" && TYPES.includes(rawType as 47 | 54)) return [{ id: String(expression.causalityId), type: rawType as 47 | 54 }];
    if (expression.op === "not") return collect(expression.child);
    if (expression.op === "all" || expression.op === "any") return expression.children.flatMap(collect);
    return [];
}

export function buildDatabaseTeamAnalysisDb28Dataset(options: { db8: DatabaseTeamAnalysisDb8Dataset, db8Sha256: string, db9: DatabaseTeamAnalysisDb9Dataset, db9Sha256: string, db11: DatabaseTeamAnalysisDb11Dataset, db11Sha256: string, tables: DatabaseExperimentTables, inspection: NativeRuntimeElfInspection, nativeSha256: string, nativeSizeBytes: number, evidence: Db28NativeRevivalEvidence, evidenceSha256: string }): DatabaseTeamAnalysisDb28Dataset {
    if (options.db8.contractVersion !== "0.7.0" || options.db9.contractVersion !== "0.8.0" || options.db11.contractVersion !== "0.10.0" || options.db8.semanticPromotionCount !== 0 || options.db9.semanticPromotionCount !== 0 || options.db8.sourceSha256 !== options.db9.sourceDatabaseSha256 || options.db8.sourceSha256 !== options.db11.sourceSha256 || options.db8.sourceSnapshotVersion !== options.db9.sourceSnapshotVersion || options.db8.sourceSnapshotVersion !== options.db11.sourceSnapshotVersion || options.db9.sourceDb8.sha256 !== options.db8Sha256 || options.db9.nativeRuntime.sha256 !== options.nativeSha256 || options.db9.nativeRuntime.sizeBytes !== options.nativeSizeBytes) throw new Error("DB28 source lineage mismatch");
    validateEvidence(options.inspection, options.evidence, options.nativeSha256);
    const handlers = new Map(options.evidence.handlers.map(value => [value.causalityType, value]));
    for (const type of TYPES) {
        const gaps = options.db8.causalityGaps.filter(value => integer(value.causalityType) === type), runtimes = options.db9.causalityGapEvidence.filter(value => value.enumValue === type), dispatches = options.db9.causalityDispatchSlots.filter(value => value.enumValue === type), handler = handlers.get(type)!;
        if (gaps.length !== 1 || runtimes.length !== 1 || dispatches.length !== 1) throw new Error(`DB28 evidence cardinality mismatch ${type}`);
        if (runtimes[0].identityStatus !== "runtime_identified" || runtimes[0].occurrenceCount !== gaps[0].occurrenceCount || runtimes[0].affectedStateCount !== gaps[0].affectedStateCount || runtimes[0].symbol !== handler.symbol || runtimes[0].symbolAddress !== handler.vma || dispatches[0].status !== "identified" || dispatches[0].symbol !== handler.symbol || dispatches[0].symbolAddress !== handler.vma) throw new Error(`DB28 runtime lineage mismatch ${type}`);
    }
    const rows = new Map<string, Record<string, SqliteScalar>>();
    for (const row of options.tables.skill_causalities ?? []) { if (row.id === null || row.id === "") throw new Error("DB28 causality row has no id"); const id = String(row.id); if (rows.has(id)) throw new Error(`DB28 duplicate causality row ${id}`); rows.set(id, row); }
    const resolutions: Db28RevivalCounterResolution[] = [], keys = new Set<string>();
    for (const state of options.db11.states) for (const rule of state.passive?.rules ?? []) for (const found of collect(rule.condition)) {
        const key = `${state.stateKey}|${rule.ruleKey}|${found.id}`; if (keys.has(key)) throw new Error(`DB28 duplicate occurrence ${key}`); keys.add(key);
        const row = rows.get(found.id), handler = handlers.get(found.type)!;
        if (!row || !["causality_type", "cau_val1", "cau_val2", "cau_val3"].every(column => Object.prototype.hasOwnProperty.call(row, column)) || integer(row.causality_type) !== found.type) throw new Error(`DB28 causality row missing or incomplete ${found.id}`);
        let predicate: Db28RevivalCounterPredicate;
        if (found.type === 47) predicate = { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "ability_owner_pure_current_record", deckIndexSource: "ability_status", comparator: "gt", value: 0 };
        else { const polarity = integer(row.cau_val1); if (polarity === undefined) throw new Error(`DB28 invalid polarity ${found.id}`); predicate = { status: "supported", event: "revival_skill_activated", metric: "activation_count", scope: "party_pure_and_back_current_records", deckIndices: { from: 0, to: 6, inclusive: true }, aggregate: "any_gt_zero", expected: polarity === 0, rawPolarity: row.cau_val1 }; }
        resolutions.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, causalityId: found.id, causalityType: found.type, semanticStatus: "partial", predicate, history: { resetFunction: "InGameData::resetActivateRevivalSkillCount", resetTrigger: "unknown", window: "unknown" }, raw: { cauVal1: row.cau_val1, cauVal2: row.cau_val2, cauVal3: row.cau_val3 }, activation: { timing: "unknown", recurrence: "unknown", calculationBucket: "unknown" }, provenance: { database: { table: "skill_causalities", rowId: found.id, columns: ["causality_type", "cau_val1", "cau_val2", "cau_val3"] }, runtime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, evidenceFile: "native-revival-counter-semantics.json", evidenceSha256: options.evidenceSha256, handlerSymbol: handler.symbol, handlerVma: handler.vma, handlerSizeBytes: handler.sizeBytes, handlerCodeSha256: handler.codeSha256, counterOffset: options.evidence.counter.inGameCharaDataOffset } } });
    }
    resolutions.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true }) || a.causalityType - b.causalityType);
    for (const type of TYPES) { const gap = options.db8.causalityGaps.find(value => integer(value.causalityType) === type)!; const values = resolutions.filter(value => value.causalityType === type); if (values.length !== gap.occurrenceCount || new Set(values.map(value => value.stateKey)).size !== gap.affectedStateCount || new Set(values.map(value => value.causalityId)).size !== gap.uniqueCausalityCount) throw new Error(`DB28 source gap accounting mismatch ${type}`); }
    return { schemaVersion: 1, contract: "dokkan-team-analysis-revival-counter-native-semantics-experiment", contractVersion: "0.27.0", generatedAt: options.db11.generatedAt, sourceSnapshotVersion: options.db8.sourceSnapshotVersion, sourceDatabaseSha256: options.db8.sourceSha256, sourceDb8: { fileName: "team-analysis-db8-evidence-experiment.json.gz", sha256: options.db8Sha256, contractVersion: "0.7.0" }, sourceDb9: { fileName: "team-analysis-db9-runtime-evidence.json.gz", sha256: options.db9Sha256, contractVersion: "0.8.0" }, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: options.db11Sha256, contractVersion: "0.10.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: options.nativeSha256, sizeBytes: options.nativeSizeBytes }, nativeEvidence: { fileName: "native-revival-counter-semantics.json", sha256: options.evidenceSha256 }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2, resolutions };
}

export function buildDatabaseTeamAnalysisDb28Coverage(dataset: DatabaseTeamAnalysisDb28Dataset, sourceGapOccurrenceCount: number): DatabaseTeamAnalysisDb28Coverage {
    const counts: Record<string, number> = {}, states: Record<string, number> = {}, causalities: Record<string, number> = {};
    for (const type of TYPES) { const values = dataset.resolutions.filter(value => value.causalityType === type); counts[String(type)] = values.length; states[String(type)] = new Set(values.map(value => value.stateKey)).size; causalities[String(type)] = new Set(values.map(value => value.causalityId)).size; }
    return { schemaVersion: 1, sourceGapOccurrenceCount, resolutionCount: dataset.resolutions.length, affectedStateCount: new Set(dataset.resolutions.map(value => value.stateKey)).size, occurrenceCountsByType: counts, affectedStateCountsByType: states, uniqueCausalityCountsByType: causalities, supportedPredicateCount: dataset.resolutions.filter(value => value.predicate.status === "supported").length, partialResolutionCount: dataset.resolutions.filter(value => value.semanticStatus === "partial").length, nonzeroPolarityCount: dataset.resolutions.filter(value => value.causalityType === 54 && value.predicate.scope === "party_pure_and_back_current_records" && integer(value.predicate.rawPolarity) !== 0).length, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2 };
}
