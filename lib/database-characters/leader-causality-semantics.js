"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderCausalitySemanticsReport = exports.assertPinnedCharacterLeaderCausalitySemantics = exports.evaluateCharacterLeaderCausalitySemantics = void 0;
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
function sortedRecord(values) {
    return Object.fromEntries([...values].sort((left, right) => Number(left[0]) - Number(right[0])));
}
function evaluateCharacterLeaderCausalitySemantics(k48, k3, database) {
    const effectIds = new Set(k3.effects.map(effect => effect.rowId));
    const referencedEffectIds = new Set();
    let k48References = 0;
    for (const state of k48.states)
        for (const effect of state.effects)
            if (effectIds.has(effect.effectRowId)) {
                k48References++;
                referencedEffectIds.add(effect.effectRowId);
            }
    const occurrences = new Map();
    let scalarExpressions = 0, conjunctionExpressions = 0, leafOccurrences = 0;
    for (const effect of k3.effects) {
        const ids = typeof effect.expression === "number"
            ? (scalarExpressions++, [effect.expression])
            : (conjunctionExpressions++, [effect.expression[1], effect.expression[2]]);
        leafOccurrences += ids.length;
        for (const id of ids)
            occurrences.set(String(id), (occurrences.get(String(id)) ?? 0) + 1);
    }
    const rows = new Map(database.rows.map(row => [row.id, row]));
    const masks = new Map();
    let missingDatabaseRows = 0, causalityTypeMismatches = 0, unusedValueMismatches = 0;
    for (const id of [...occurrences.keys()].sort((left, right) => Number(left) - Number(right))) {
        const row = rows.get(id);
        if (!row) {
            missingDatabaseRows++;
            continue;
        }
        if (row.causalityType !== 35)
            causalityTypeMismatches++;
        if (row.cauVal2 !== 0 || row.cauVal3 !== 0)
            unusedValueMismatches++;
        if (row.causalityType === 35 && row.cauVal2 === 0 && row.cauVal3 === 0)
            masks.set(id, row.cauVal1);
    }
    return {
        type82NonNullRows: k3.effects.length,
        k48References,
        scalarExpressions,
        conjunctionExpressions,
        leafOccurrences,
        referencedIds: [...occurrences.keys()].sort((left, right) => Number(left) - Number(right)),
        idOccurrences: sortedRecord(occurrences),
        masks: sortedRecord(masks),
        k3MissingReferencedRows: [...k3.missingReferencedRowIds],
        separatelyBoundDatabaseRows: database.rows.length,
        missingK48EffectRows: k3.effects.length - referencedEffectIds.size,
        missingDatabaseRows,
        unsupportedExpressions: 0,
        causalityTypeMismatches,
        unusedValueMismatches,
    };
}
exports.evaluateCharacterLeaderCausalitySemantics = evaluateCharacterLeaderCausalitySemantics;
function assertPinnedCharacterLeaderCausalitySemantics(scope, k3, database, native) {
    const pin = leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN;
    if (scope.type82NonNullRows !== pin.type82NonNullRows || scope.k48References !== pin.k48References
        || scope.scalarExpressions !== pin.scalarExpressions || scope.conjunctionExpressions !== pin.conjunctionExpressions
        || scope.leafOccurrences !== pin.leafOccurrences || scope.separatelyBoundDatabaseRows !== pin.referencedIds.length
        || scope.missingK48EffectRows !== 0 || scope.missingDatabaseRows !== 0 || scope.unsupportedExpressions !== 0
        || scope.causalityTypeMismatches !== 0 || scope.unusedValueMismatches !== 0)
        throw new Error("K52 corpus counts changed");
    if (JSON.stringify(scope.referencedIds) !== JSON.stringify(pin.referencedIds)
        || JSON.stringify(scope.k3MissingReferencedRows) !== JSON.stringify(pin.referencedIds)
        || JSON.stringify(scope.idOccurrences) !== JSON.stringify(pin.idOccurrences)
        || JSON.stringify(scope.masks) !== JSON.stringify(pin.masks))
        throw new Error("K52 causality pins changed");
    if (k3.identity.causalityInputFingerprintSha256 !== pin.k3CausalityInputFingerprintSha256
        || database.identity.sha256 !== pin.databaseSha256 || database.identity.sizeBytes !== pin.databaseSizeBytes
        || database.identity.rowsFingerprintSha256 !== pin.databaseRowsFingerprintSha256 || !database.identity.descriptorBoundReadOnly)
        throw new Error("K52 source pins changed");
    if (native.elfSha256 !== pin.nativeSha256 || native.elfSizeBytes !== pin.nativeSizeBytes
        || native.evidenceSha256 !== pin.nativeEvidenceSha256 || native.evidenceSizeBytes !== pin.nativeEvidenceSizeBytes
        || native.codeRegionCount !== pin.nativeCodeRegions || native.exactCallCount !== pin.nativeExactCalls
        || !native.executionChainBound || !native.type35DispatchBound || !native.onlyCauVal1Read
        || native.humanBitNamesBound || native.partySelectionContextBound || native.lifecycleBound || native.stackingBound)
        throw new Error("K52 native proof changed");
}
exports.assertPinnedCharacterLeaderCausalitySemantics = assertPinnedCharacterLeaderCausalitySemantics;
function buildCharacterLeaderCausalitySemanticsReport(k48, k3, database, native, scope) {
    const report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-semantics-audit",
        contractVersion: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k48, k3, database, native },
        scope,
        semantics: {
            compiledScalar: "single_predicate",
            compiledAmpersand: "both_predicates_required",
            type35: "each_requested_bit_witnessed_by_an_eligible_card",
        },
        policy: {
            structuralConditionEvidenceOnly: true, k3OmissionDisclosed: true, sqliteSeparatelyBoundToExactFirstPartySnapshot: true,
            sourceTextReadForIdentityOrJoin: false, sourceTextIncluded: false, humanBitNamesDerived: false,
            partySelectionContextDerived: false, lifecycleDerived: false, stackingDerived: false, payloadWritten: false,
            authoritySelected: false, productionModified: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        inputIntegrity: {
            k48SourceBoundBefore: "NOT_EXECUTED", k48SourceBoundAfter: "NOT_EXECUTED", k48K3DatabaseAndNativeStable: false,
            databaseDescriptorBoundReadOnly: database.descriptorBoundReadOnly, reportTimestampIncluded: false,
            reportMaximumBytesExclusive: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES, rssStayedBelowExclusiveLimit: false,
        },
        readiness: {
            leaderCausalityStructuralSemantics: "NOT_EXECUTED", type35StructuralCondition: "NOT_EXECUTED",
            humanBitNames: "NO-GO", partySelectionContext: "NO-GO", lifecycle: "NO-GO", stacking: "NO-GO",
            productProjection: "NO-GO", authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report)}\n`) >= leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES)
        throw new Error("K52 report byte limit reached");
    return report;
}
exports.buildCharacterLeaderCausalitySemanticsReport = buildCharacterLeaderCausalitySemanticsReport;
//# sourceMappingURL=leader-causality-semantics.js.map