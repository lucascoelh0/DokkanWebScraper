import {
    CHARACTER_LEADER_TARGET_PIN,
    CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION,
    CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderTargetEvaluation,
    CharacterLeaderTargetK3Source,
    CharacterLeaderTargetK48Source,
    CharacterLeaderTargetNativeProof,
    CharacterLeaderTargetSemanticsReport,
} from "./leader-target-semantics-contract";
import type { CharacterLeaderValueK3Source } from "./leader-value-scope-contract";

const emptySet = (value: string | null): boolean => value === null || value === "0";
export function evaluateCharacterLeaderTargetSemantics(k48: CharacterLeaderTargetK48Source, k3: CharacterLeaderValueK3Source, targets: CharacterLeaderTargetK3Source): CharacterLeaderTargetEvaluation {
    const type82 = k3.effects.filter(row => row.efficacyType === 82), effects = new Map(type82.map(row => [row.rowId, row]));
    const references = k48.effects.filter(ref => effects.has(ref.effectRowId));
    const nonzeroSets = new Set(type82.map(row => row.subTargetTypeSetId).filter(value => !emptySet(value)) as string[]);
    const relevantRows = targets.rows.filter(row => nonzeroSets.has(row.targetSetId)), rowsById = new Map(relevantRows.map(row => [row.rowId, row]));
    let targetOccurrences = 0;
    for (const ref of references) {
        const effect = effects.get(ref.effectRowId)!;
        if (ref.targetSetId !== effect.subTargetTypeSetId) throw new Error(`K51 target-set join changed for ${ref.effectRowId}`);
        if (emptySet(ref.targetSetId)) { if (ref.targetRowIds.length) throw new Error(`K51 empty target set expanded for ${ref.effectRowId}`); continue; }
        for (const rowId of ref.targetRowIds) { const row = rowsById.get(rowId); if (!row || row.targetSetId !== ref.targetSetId) throw new Error(`K51 target row join changed for ${rowId}`); targetOccurrences++; }
    }
    const targetTypeRows = ([
        [2, "team_allies"], [12, "super_class_allies"], [13, "extreme_class_allies"],
    ] as const).map(([raw, scope]) => ({ raw, rows: type82.filter(row => row.targetType === raw).length, scope }));
    return {
        type82Rows: type82.length, type82References: references.length,
        referencesWithSet: references.filter(ref => !emptySet(ref.targetSetId)).length,
        referencesWithoutSet: references.filter(ref => emptySet(ref.targetSetId)).length,
        distinctNonzeroSets: nonzeroSets.size, targetRows: relevantRows.length, targetOccurrences,
        includeCategoryRows: relevantRows.filter(row => row.valueType === 1).length,
        excludeCategoryRows: relevantRows.filter(row => row.valueType === 2).length,
        unsupportedTargetRows: relevantRows.filter(row => row.valueType !== 1 && row.valueType !== 2).length,
        targetTypeRows,
    };
}
export function assertPinnedCharacterLeaderTargetSemantics(scope: CharacterLeaderTargetEvaluation, native: CharacterLeaderTargetNativeProof): void {
    const pin = CHARACTER_LEADER_TARGET_PIN;
    const checks: Array<[string, number, number]> = [
        ["type82 rows", scope.type82Rows, pin.type82Rows], ["type82 refs", scope.type82References, pin.type82References],
        ["refs with set", scope.referencesWithSet, pin.referencesWithSet], ["refs without set", scope.referencesWithoutSet, pin.referencesWithoutSet],
        ["sets", scope.distinctNonzeroSets, pin.distinctNonzeroSets], ["target rows", scope.targetRows, pin.targetRows],
        ["target occurrences", scope.targetOccurrences, pin.targetOccurrences], ["include rows", scope.includeCategoryRows, pin.includeCategoryRows],
        ["exclude rows", scope.excludeCategoryRows, pin.excludeCategoryRows], ["unsupported rows", scope.unsupportedTargetRows, pin.unsupportedTargetRows],
    ];
    for (const [label, actual, expected] of checks) if (actual !== expected) throw new Error(`K51 ${label} hypothesis changed`);
    const expectedTargets = [
        { raw: 2, rows: pin.teamAlliesRows, scope: "team_allies" }, { raw: 12, rows: pin.superClassAlliesRows, scope: "super_class_allies" },
        { raw: 13, rows: pin.extremeClassAlliesRows, scope: "extreme_class_allies" },
    ];
    if (JSON.stringify(scope.targetTypeRows) !== JSON.stringify(expectedTargets)) throw new Error("K51 target type corpus changed");
    if (native.targetDispatchEvidenceSha256 !== pin.targetDispatchEvidenceSha256 || native.subTargetEvidenceSha256 !== pin.subTargetEvidenceSha256
        || native.targetCodeRegionCount !== 20 || native.subTargetCodeRegionCount !== 19 || native.leaderRuntimeBridgeCodeRegionCount !== 5
        || native.leaderRuntimeBridgeVtableBindingCount !== 4 || native.leaderRuntimeBridgeCallSiteCount !== 4
        || !native.targetTypesBound || !native.subTargetTypesBound || !native.leaderRuntimeBridgeBound) throw new Error("K51 native target proof changed");
}
export function buildCharacterLeaderTargetSemanticsReport(
    k48: CharacterLeaderTargetK48Source["identity"], k3: CharacterLeaderValueK3Source["identity"], targetFingerprint: string,
    native: CharacterLeaderTargetNativeProof, scope: CharacterLeaderTargetEvaluation,
): CharacterLeaderTargetSemanticsReport {
    assertPinnedCharacterLeaderTargetSemantics(scope, native);
    const report: CharacterLeaderTargetSemanticsReport = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-target-native-semantics-audit",
        contractVersion: CHARACTER_LEADER_TARGET_SEMANTICS_CONTRACT_VERSION, mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k48, k3, targetK3FingerprintSha256: targetFingerprint, native },
        semantics: { targetType2: "team_allies", targetType12: "super_class_allies", targetType13: "extreme_class_allies", subTargetType1: "include_card_category_id", subTargetType2: "exclude_card_category_id", subTargetComposition: "and_sequential_filter_chain", emptySetBehavior: "identity", duplicateBehavior: "reapplied_filter" },
        scope,
        policy: { nativeEvidenceOnly: true, localizedCategoryTextIncluded: false, categoryIdsAreStructuralOnly: true, causalityBehaviorDerived: false, battleLifecycleDerived: false, battleStackingOrCompositionDerived: false, productAuthoritySelected: false, payloadWritten: false, networkEnabled: false, r2Enabled: false, androidImplemented: false },
        inputIntegrity: { k48SourceBoundBefore: "NOT_EXECUTED", k48SourceBoundAfter: "NOT_EXECUTED", k48K3NativeAndTargetRowsStable: false, nativeEvidenceExactPinned: true, reportTimestampIncluded: false, reportMaximumBytesExclusive: CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES, rssMaximumBytesExclusive: CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES },
        readiness: { leaderTargetSemantics: "NOT_EXECUTED", type82TargetAndCategoryFilters: "NOT_EXECUTED", causalityBehavior: "NO-GO", battleLifecycle: "NO-GO", battleStackingOrComposition: "NO-GO", productProjection: "NO-GO", authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO" },
    };
    if (Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) >= CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES) throw new Error("K51 report byte limit reached"); return report;
}
