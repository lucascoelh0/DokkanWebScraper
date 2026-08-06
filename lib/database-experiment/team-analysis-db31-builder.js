"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseTeamAnalysisDb31Coverage = exports.buildDatabaseTeamAnalysisDb31Dataset = exports.evaluateDb31Operation = exports.parseDb31CalculationOption = void 0;
const crypto_1 = require("crypto");
const UNKNOWN = ["unit", "target", "execution_timing", "calculation_bucket", "duration", "recurrence", "stacking", "floating_point_rounding_at_consumers"];
const EXPECTED = [
    { raw: 0, operation: "add", symbol: "_ZN15AbilityCalcFunc8calcPlusEff", vma: 64233656, sizeBytes: 8, codeSha256: "0ff3b13eb9addaa652538878e52c6d95b5240550699699245a9e00348bf7eecc", parametersRead: ["lhs", "rhs"], parametersIgnored: [], result: "lhs_plus_rhs", clamp: "none" },
    { raw: 1, operation: "subtract_floor_zero", symbol: "_ZN15AbilityCalcFunc9calcMinusEff", vma: 64233664, sizeBytes: 20, codeSha256: "914cc4771dc459cbd4bd052c80454dddbc88aefc3172beede49f549cea821ce7", parametersRead: ["lhs", "rhs"], parametersIgnored: [], result: "max_lhs_minus_rhs_zero", clamp: "floor_zero" },
    { raw: 2, operation: "add_percent_of_lhs", symbol: "_ZN15AbilityCalcFunc15calcPercentPlusEff", vma: 64233684, sizeBytes: 36, codeSha256: "772083c4511f8df5916bb0f1bbb588d332b57ddeb7cfee6d81eacf136f234f1d", parametersRead: ["lhs", "rhs"], parametersIgnored: [], result: "rhs_zero_returns_lhs_else_lhs_plus_lhs_times_rhs_div_100", clamp: "none" },
    { raw: 3, operation: "subtract_percent_of_lhs_floor_zero", symbol: "_ZN15AbilityCalcFunc16calcPercentMinusEff", vma: 64233720, sizeBytes: 48, codeSha256: "f4bbb65a0a9343a7d0696bac63c431e27047c73c94d7fe0cb23fd8c871a7f4de", parametersRead: ["lhs", "rhs"], parametersIgnored: [], result: "rhs_zero_returns_lhs_else_max_lhs_minus_lhs_times_rhs_div_100_zero", clamp: "floor_zero" },
    { raw: 4, operation: "assign_rhs", symbol: "_ZN15AbilityCalcFunc9calcEqualEff", vma: 64233768, sizeBytes: 8, codeSha256: "47f7a62c547ebead47695e06fba44a2478ec2087d5dab453e8fa156cadf65af6", parametersRead: ["rhs"], parametersIgnored: ["lhs"], result: "rhs", clamp: "none" }
];
const sha = (b) => (0, crypto_1.createHash)("sha256").update(b).digest("hex");
const parseDb31CalculationOption = (v) => typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
exports.parseDb31CalculationOption = parseDb31CalculationOption;
function validateCode(i, symbol, vma, size, hash) { const s = i.symbols.find(v => v.name === symbol); if (!s || s.value !== vma || s.size !== size || sha(i.readVirtualBytes(vma, size)) !== hash)
    throw new Error(`DB31 native code mismatch ${symbol}`); }
function validateEvidence(i, e, native) { if (e.schemaVersion !== 1 || e.sourceSha256 !== native || e.auditScope !== "skill-calc-option-dispatch-and-float-implementations" || JSON.stringify(e.unknowns) !== JSON.stringify(UNKNOWN))
    throw new Error("DB31 evidence identity mismatch"); const f = e.sqliteField; if (f.table !== "passive_skills" || f.column !== "calc_option" || f.literalVma !== 33024419 || f.passiveSkillOffset !== 72 || f.rowConstructorSymbol !== "_ZN12PassiveSkillC1EPN7SQLite33RowE" || !i.readVirtualBytes(f.literalVma, 12).equals(Buffer.from("calc_option\0")))
    throw new Error("DB31 SQLite field binding mismatch"); validateCode(i, f.rowConstructorSymbol, f.rowConstructorVma, f.rowConstructorSizeBytes, f.rowConstructorCodeSha256); const d = e.dispatcher; if (d.symbol !== "_ZN15AbilityCalcFunc18getAbilityCalcFuncE15SkillCalcOption" || d.vma !== 64233620 || d.sizeBytes !== 36 || d.codeSha256 !== "143f8b94bd885d8ba2229cf4ff457c53db2d70ec457e204912397157f4afa6d2" || d.tableVma !== 92049800 || d.entrySizeBytes !== 8 || d.entryCount !== 5 || d.zeroBytesSha256 !== "2c34ce1df23b838c5abf2a7f6437cca3d3067ed509ff25f11df6b11b582b51eb" || d.negativeIndexBehavior !== "unsafe_table_index" || d.positiveOutOfRangeFallbackSymbol !== "_ZN15AbilityCalcFunc8calcPlusEff" || sha(i.readVirtualBytes(d.tableVma, 40)) !== d.zeroBytesSha256)
    throw new Error("DB31 dispatch metadata mismatch"); validateCode(i, d.symbol, d.vma, d.sizeBytes, d.codeSha256); if (e.operations.length !== 5 || new Set(e.operations.map(v => v.raw)).size !== 5)
    throw new Error("DB31 operation cardinality mismatch"); for (let n = 0; n < 5; n++) {
    const o = e.operations.find(v => v.raw === n), x = EXPECTED[n];
    if (!o || JSON.stringify(o) !== JSON.stringify(x))
        throw new Error(`DB31 operation mismatch ${n}`);
    validateCode(i, o.symbol, o.vma, o.sizeBytes, o.codeSha256);
    const r = i.relocations.filter(v => v.offset === d.tableVma + n * 8);
    if (r.length !== 1 || r[0].symbolName !== o.symbol || r[0].symbolValue !== o.vma)
        throw new Error(`DB31 dispatch relocation mismatch ${n}`);
} }
function evaluateDb31Operation(op, lhs, rhs) { if (!Number.isFinite(lhs) || !Number.isFinite(rhs))
    throw new Error("DB31 invalid numeric payload"); const a = Math.fround(lhs), b = Math.fround(rhs), zero = 0; switch (op) {
    case "add": return Math.fround(a + b);
    case "subtract_floor_zero": {
        const v = Math.fround(a - b);
        return v < 0 ? zero : v;
    }
    case "add_percent_of_lhs": {
        if (b === 0)
            return a;
        const scaled = Math.fround(Math.fround(a * b) / Math.fround(100));
        return Math.fround(scaled + a);
    }
    case "subtract_percent_of_lhs_floor_zero": {
        if (b === 0)
            return a;
        const scaled = Math.fround(Math.fround(a * b) / Math.fround(-100));
        const v = Math.fround(a + scaled);
        return v < 0 ? zero : v;
    }
    case "assign_rhs": return b;
} }
exports.evaluateDb31Operation = evaluateDb31Operation;
function buildDatabaseTeamAnalysisDb31Dataset(o) { if (o.db11.contractVersion !== "0.10.0")
    throw new Error("DB31 source contract mismatch"); validateEvidence(o.inspection, o.evidence, o.nativeSha256); const map = new Map(o.evidence.operations.map(v => [v.raw, v])), keys = new Set(), ruleProjections = []; for (const state of o.db11.states)
    for (const rule of state.passive?.rules ?? []) {
        const key = `${state.stateKey}|${rule.ruleKey}`;
        if (keys.has(key))
            throw new Error(`DB31 duplicate rule ${key}`);
        keys.add(key);
        const raw = rule.source.calculationOption, n = (0, exports.parseDb31CalculationOption)(raw), operation = Number.isSafeInteger(n) ? map.get(n) : undefined;
        ruleProjections.push({ stateKey: state.stateKey, ruleKey: rule.ruleKey, passiveSkillId: rule.source.passiveSkillId, rawCalculationOption: raw, effectCount: rule.effects.length, operation: operation ? { status: "supported", value: operation.operation, formula: operation.result, parametersRead: [...operation.parametersRead], parametersIgnored: [...operation.parametersIgnored], clamp: operation.clamp } : { status: "unknown", value: "unknown" }, independentDimensions: { unit: "unknown", target: "unknown", executionTiming: "unknown", calculationBucket: "unknown", duration: "unknown", recurrence: "unknown", stacking: "unknown" }, provenance: { database: { table: "passive_skills", rowId: rule.source.passiveSkillId, column: "calc_option" }, ...(operation ? { runtime: { fileName: "libcocos2dcpp.so", sha256: o.nativeSha256, evidenceFile: "native-skill-calc-option-semantics.json", evidenceSha256: o.evidenceSha256, dispatcherSymbol: o.evidence.dispatcher.symbol, handlerSymbol: operation.symbol } } : {}) } });
    } ruleProjections.sort((a, b) => a.stateKey.localeCompare(b.stateKey, "en", { numeric: true }) || a.ruleKey.localeCompare(b.ruleKey, "en", { numeric: true })); const explicit = o.current.states.flatMap(s => s.passive?.rules ?? []).flatMap(r => r.effects ?? []).filter(e => Object.prototype.hasOwnProperty.call(e, "operation")).length; if (explicit !== 0)
    throw new Error("DB31 legacy comparison requires explicit operation correlation"); return { schemaVersion: 1, contract: "dokkan-team-analysis-skill-calc-option-native-semantics-experiment", contractVersion: "0.30.0", generatedAt: o.db11.generatedAt, sourceSnapshotVersion: o.db11.sourceSnapshotVersion, sourceDatabaseSha256: o.db11.sourceSha256, sourceDb11: { fileName: "team-analysis-db11-experiment.json.gz", sha256: o.db11Sha256, contractVersion: "0.10.0" }, currentTeamAnalysis: { fileName: "team-analysis.json.gz", sha256: o.currentSha256 }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: o.nativeSha256, sizeBytes: o.nativeSizeBytes }, nativeEvidence: { fileName: "native-skill-calc-option-semantics.json", sha256: o.evidenceSha256 }, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 5, enumValues: o.evidence.operations, ruleProjections, legacyComparison: { explicitOperationEffectCount: explicit, confirmedOperationConflictCount: 0, representationGap: "legacy_contract_has_no_explicit_calculation_operation" } }; }
exports.buildDatabaseTeamAnalysisDb31Dataset = buildDatabaseTeamAnalysisDb31Dataset;
function counts(xs, key) { const r = {}; for (const x of xs) {
    const k = key(x);
    r[k] = (r[k] ?? 0) + 1;
} return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))); }
function buildDatabaseTeamAnalysisDb31Coverage(d) { const known = d.ruleProjections.filter(v => v.operation.status === "supported"); return { schemaVersion: 1, ruleCount: d.ruleProjections.length, effectCount: d.ruleProjections.reduce((n, v) => n + v.effectCount, 0), passiveSkillCount: new Set(d.ruleProjections.map(v => v.passiveSkillId)).size, affectedStateCount: new Set(d.ruleProjections.map(v => v.stateKey)).size, supportedRuleCount: known.length, unknownRuleCount: d.ruleProjections.length - known.length, supportedEffectCount: known.reduce((n, v) => n + v.effectCount, 0), ruleCountsByOperation: counts(known, v => v.operation.value), effectCountsByOperation: Object.fromEntries(Object.entries(counts(known.flatMap(v => Array(v.effectCount).fill(v)), v => v.operation.value))), rawOptionCounts: counts(d.ruleProjections, v => String(v.rawCalculationOption)), explicitLegacyOperationEffectCount: d.legacyComparison.explicitOperationEffectCount, confirmedLegacyConflictCount: 0, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 5 }; }
exports.buildDatabaseTeamAnalysisDb31Coverage = buildDatabaseTeamAnalysisDb31Coverage;
//# sourceMappingURL=team-analysis-db31-builder.js.map