"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderNativeSemanticsReport = exports.assertPinnedCharacterLeaderNativeSemantics = exports.evaluateCharacterLeaderNativeSemantics = void 0;
const leader_native_semantics_contract_1 = require("./leader-native-semantics-contract");
const domain = (values) => [...new Set(values)].sort((left, right) => left - right);
function evaluateCharacterLeaderNativeSemantics(k48, k3) {
    if (!k48.policy.structuralIdsOnly || !k48.policy.sourceOrderAndMultiplicityPreserved || k48.policy.semanticAssociationSelected) {
        throw new Error("K50 requires the K48 structural association boundary");
    }
    const byId = new Map(k3.effects.map(row => [row.rowId, row]));
    const type82 = k3.effects.filter(row => row.efficacyType === 82);
    const type82Ids = new Set(type82.map(row => row.rowId));
    const references = k48.states.flatMap(state => state.effects).filter(ref => type82Ids.has(ref.effectRowId));
    const flatRows = type82.filter(row => row.calcOption === 0);
    const proportionalRows = type82.filter(row => row.calcOption === 2);
    const invalidRows = type82.filter(row => !Array.isArray(row.efficacyVector) || row.efficacyVector.length !== 3
        || !row.efficacyVector.every(Number.isFinite) || ![0, 2].includes(row.calcOption) || row.execTimingType !== 1
        || ![2, 12, 13].includes(row.targetType));
    const mismatchedReferences = references.filter(ref => byId.get(ref.effectRowId)?.efficacyType !== 82);
    if (mismatchedReferences.length)
        throw new Error("K50 K48/K3 type82 join changed");
    return {
        type82Rows: type82.length,
        type82References: references.length,
        flatRows: flatRows.length,
        proportionalRows: proportionalRows.length,
        invalidRows: invalidRows.length,
        nonzeroIgnoredPositionRows: type82.filter(row => row.efficacyVector?.[2] !== 0).length,
        maskDomain: domain(type82.flatMap(row => row.efficacyVector ? [row.efficacyVector[0]] : [])),
        modifierDomain: domain(type82.flatMap(row => row.efficacyVector ? [row.efficacyVector[1]] : [])),
        targetTypeDomain: domain(type82.map(row => row.targetType)),
        nonNullCausalityRows: type82.filter(row => row.causalitySerializedShapeSha256 !== null).length,
    };
}
exports.evaluateCharacterLeaderNativeSemantics = evaluateCharacterLeaderNativeSemantics;
function assertPinnedCharacterLeaderNativeSemantics(scope, native) {
    const pin = leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN;
    const checks = [
        ["type82 rows", scope.type82Rows, pin.type82Rows], ["type82 references", scope.type82References, pin.type82References],
        ["flat rows", scope.flatRows, pin.flatRows], ["proportional rows", scope.proportionalRows, pin.proportionalRows],
        ["invalid rows", scope.invalidRows, pin.invalidRows], ["ignored-position rows", scope.nonzeroIgnoredPositionRows, pin.nonzeroIgnoredPositionRows],
        ["mask domain", scope.maskDomain.length, pin.maskDomainSize], ["modifier domain", scope.modifierDomain.length, pin.modifierDomainSize],
        ["causality rows", scope.nonNullCausalityRows, pin.nonNullCausalityRows], ["dispatch entries", native.dispatchEntryCount, pin.dispatchEntries],
    ];
    for (const [label, actual, expected] of checks)
        if (actual !== expected)
            throw new Error(`K50 ${label} hypothesis changed`);
    if (JSON.stringify(scope.targetTypeDomain) !== JSON.stringify(pin.targetTypeDomain))
        throw new Error("K50 target type domain hypothesis changed");
    if (native.nativeSha256 !== pin.elfSha256 || native.nativeSizeBytes !== pin.elfSizeBytes || native.evidenceSha256 !== pin.evidenceSha256
        || native.codeRegionCount !== 8 || native.constructorColumnCount !== 7 || !native.type82DispatchBound || !native.battleFactoryFieldTransferBound) {
        throw new Error("K50 native proof hypothesis changed");
    }
}
exports.assertPinnedCharacterLeaderNativeSemantics = assertPinnedCharacterLeaderNativeSemantics;
function buildCharacterLeaderNativeSemanticsReport(k48, k3, native, scope) {
    assertPinnedCharacterLeaderNativeSemantics(scope, native);
    const report = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-native-semantics-audit",
        contractVersion: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_SEMANTICS_CONTRACT_VERSION, mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k48, k3, native },
        semantics: {
            efficacyType82: "supported_native_structural", selector: "element_or_awakening_type_bitmask",
            modifier: "efficacy_values_position_1", position2: "not_read_by_type82_handler", affectedStats: ["hp", "atk", "def"],
            calcOption0: "flat_points", calcOption2: "proportional_percent_divided_by_100", candidateTargetTypes: [2, 12, 13],
            subTargetSetFiltersCandidates: true, matchingRowsAccumulateAdditivelyInTeamingPower: true,
            battleFactoryTransfersRuntimeFields: true,
        },
        scope,
        policy: {
            nativeEvidenceOnly: true, targetTypeNamesDerived: false, subTargetDomainMeaningsDerived: false,
            causalityBehaviorDerived: false, battleLifecycleDerived: false, battleStackingOrCompositionDerived: false,
            productAuthoritySelected: false, payloadWritten: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        inputIntegrity: {
            k48SourceBoundBefore: "NOT_EXECUTED", k48SourceBoundAfter: "NOT_EXECUTED", k48AndK3Stable: false,
            nativeExactPinnedBeforeAndAfter: false, evidenceAndCodeRegionsExactPinned: true, reportTimestampIncluded: false,
            reportMaximumBytesExclusive: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_SEMANTICS_RSS_LIMIT_BYTES,
        },
        readiness: {
            nativeLeaderSemantics: "NOT_EXECUTED", type82FieldSemantics: "NOT_EXECUTED", targetTypeNames: "NO-GO",
            subTargetDomainMeanings: "NO-GO", causalityBehavior: "NO-GO", battleLifecycle: "NO-GO",
            battleStackingOrComposition: "NO-GO", productProjection: "NO-GO", authority: "NO-GO", production: "NO-GO",
            writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) >= leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES)
        throw new Error("K50 report byte limit reached");
    return report;
}
exports.buildCharacterLeaderNativeSemanticsReport = buildCharacterLeaderNativeSemanticsReport;
//# sourceMappingURL=leader-native-semantics.js.map