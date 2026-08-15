"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterLeaderValueScopeReport = exports.assertPinnedCharacterLeaderValueScope = exports.evaluateCharacterLeaderValueScope = void 0;
const leader_value_scope_contract_1 = require("./leader-value-scope-contract");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const limited = (values) => [...new Set(values)].sort(structuralOrder).slice(0, leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_SAMPLE_LIMIT);
const numericDomain = (values) => [...new Set(values)].sort((left, right) => left - right);
function baseK3Identity(identity) {
    const { valueInputFingerprintSha256: _valueFingerprint, ...base } = identity;
    return base;
}
function partial(row) {
    return row.efficacyType === 82 && row.efficacyVector?.length === 3 && row.execTimingType === 1
        && row.efficacyVector[2] === 0 && row.descriptionCorrelatedToVectorPosition1;
}
function evaluateCharacterLeaderValueScope(k48, k3) {
    if (!k48.policy.structuralIdsOnly || !k48.policy.sourceOrderAndMultiplicityPreserved || k48.policy.semanticAssociationSelected) {
        throw new Error("K49 requires K48 structural-only multiplicity boundary");
    }
    if (JSON.stringify(k48.identity.k3) !== JSON.stringify(baseK3Identity(k3.identity)))
        throw new Error("K49 K48/K3 identity mismatch");
    const effects = new Map(k3.effects.map(row => [row.rowId, row]));
    if (effects.size !== k3.effects.length)
        throw new Error("K49 duplicate raw effect identity");
    const type82Rows = k3.effects.filter(row => row.efficacyType === 82);
    const type82InvalidVectorRows = type82Rows.filter(row => row.efficacyVector?.length !== 3).length;
    const type82NonTiming1Rows = type82Rows.filter(row => row.execTimingType !== 1).length;
    const type82NonzeroPosition2Rows = type82Rows.filter(row => row.efficacyVector?.length === 3 && row.efficacyVector[2] !== 0).length;
    const type82DescriptionMismatchRows = type82Rows.filter(row => !row.descriptionCorrelatedToVectorPosition1).length;
    const typesBySet = new Map();
    for (const row of k3.effects) {
        const types = typesBySet.get(row.leaderSkillSetId) ?? new Set();
        types.add(row.efficacyType);
        typesBySet.set(row.leaderSkillSetId, types);
    }
    let includedEffectReferences = 0, includedType82References = 0, partialReferences = 0, unknownReferences = 0;
    let missingEffectRows = 0, structuralMismatchReferences = 0;
    const mismatchIds = [];
    for (const state of k48.states)
        for (const reference of state.effects) {
            includedEffectReferences++;
            const row = effects.get(reference.effectRowId);
            if (!row) {
                missingEffectRows++;
                mismatchIds.push(reference.effectRowId);
                continue;
            }
            if (row.leaderSkillSetId !== state.leaderSetRowId || row.subTargetTypeSetId !== reference.targetSetId) {
                structuralMismatchReferences++;
                mismatchIds.push(reference.effectRowId);
            }
            if (row.efficacyType === 82)
                includedType82References++;
            if (partial(row))
                partialReferences++;
            else
                unknownReferences++;
        }
    const partialRows = k3.effects.filter(partial), unknownRows = k3.effects.filter(row => !partial(row));
    const timing = new Map();
    for (const row of k3.effects)
        timing.set(row.execTimingType, (timing.get(row.execTimingType) ?? 0) + 1);
    const causalityNonNull = k3.effects.filter(row => row.causalitySerializedShapeSha256 !== null);
    return {
        includedEffectReferences, uniqueEffectRows: k3.effects.length,
        efficacyTypeDomain: numericDomain(k3.effects.map(row => row.efficacyType)),
        uniqueType82Rows: type82Rows.length, includedType82References,
        partialRows: partialRows.length, partialReferences, unknownRows: unknownRows.length, unknownReferences,
        type82InvalidVectorRows, type82NonTiming1Rows, type82NonzeroPosition2Rows, type82DescriptionMismatchRows,
        setsContainingType82: [...typesBySet.values()].filter(types => types.has(82)).length,
        onlyType82Sets: [...typesBySet.values()].filter(types => types.size === 1 && types.has(82)).length,
        calcOptionDomain: numericDomain(k3.effects.map(row => row.calcOption)),
        targetTypeDomain: numericDomain(k3.effects.map(row => row.targetType)),
        timingRows: [...timing].sort(([left], [right]) => left - right).map(([id, rows]) => ({ id, rows })),
        causalityNullRows: k3.effects.length - causalityNonNull.length, causalityNonNullRows: causalityNonNull.length,
        causalitySerializedShapes: new Set(causalityNonNull.map(row => row.causalitySerializedShapeSha256)).size,
        missingEffectRows, structuralMismatchReferences,
        samples: {
            partialEffectRowIds: limited(partialRows.map(row => row.rowId)), unknownEffectRowIds: limited(unknownRows.map(row => row.rowId)),
            mismatchEffectRowIds: limited(mismatchIds), limitPerKind: leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_SAMPLE_LIMIT,
        },
    };
}
exports.evaluateCharacterLeaderValueScope = evaluateCharacterLeaderValueScope;
function assertPinnedCharacterLeaderValueScope(evaluation) {
    const pin = leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_PIN;
    for (const [label, actual, expected] of [
        ["included refs", evaluation.includedEffectReferences, pin.includedEffectReferences], ["unique rows", evaluation.uniqueEffectRows, pin.uniqueEffectRows],
        ["efficacy domain", evaluation.efficacyTypeDomain.length, pin.efficacyTypeDomainSize], ["type82 rows", evaluation.uniqueType82Rows, pin.uniqueType82Rows],
        ["type82 refs", evaluation.includedType82References, pin.includedType82References], ["invalid type82 vectors", evaluation.type82InvalidVectorRows, pin.type82InvalidVectorRows],
        ["type82 timing", evaluation.type82NonTiming1Rows, pin.type82NonTiming1Rows], ["type82 position2", evaluation.type82NonzeroPosition2Rows, pin.type82NonzeroPosition2Rows],
        ["type82 description", evaluation.type82DescriptionMismatchRows, pin.type82DescriptionMismatchRows], ["sets with type82", evaluation.setsContainingType82, pin.setsContainingType82],
        ["only type82 sets", evaluation.onlyType82Sets, pin.onlyType82Sets], ["causality null", evaluation.causalityNullRows, pin.causalityNullRows],
        ["causality non-null", evaluation.causalityNonNullRows, pin.causalityNonNullRows], ["causality shapes", evaluation.causalitySerializedShapes, pin.causalitySerializedShapes],
        ["missing effects", evaluation.missingEffectRows, pin.missingEffectRows], ["structural mismatch", evaluation.structuralMismatchReferences, pin.structuralMismatchReferences],
    ])
        if (actual !== expected)
            throw new Error(`K49 ${label} hypothesis changed`);
    if (evaluation.partialRows !== pin.partialRows || evaluation.partialReferences !== pin.partialReferences
        || evaluation.unknownRows !== pin.unknownRows || evaluation.unknownReferences !== pin.unknownReferences) {
        throw new Error("K49 classification hypothesis changed");
    }
    if (JSON.stringify(evaluation.calcOptionDomain) !== JSON.stringify([0, 2, 3]))
        throw new Error("K49 calc option domain hypothesis changed");
    if (JSON.stringify(evaluation.targetTypeDomain) !== JSON.stringify([0, 2, 4, 12, 13]))
        throw new Error("K49 target type domain hypothesis changed");
    if (JSON.stringify(evaluation.timingRows) !== JSON.stringify([{ id: 0, rows: pin.timing0Rows }, { id: 1, rows: pin.timing1Rows }]))
        throw new Error("K49 timing domain hypothesis changed");
    if (Object.values(evaluation.samples).some(value => Array.isArray(value) && value.length > leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_SAMPLE_LIMIT))
        throw new Error("K49 sample bound exceeded");
}
exports.assertPinnedCharacterLeaderValueScope = assertPinnedCharacterLeaderValueScope;
function buildCharacterLeaderValueScopeReport(k48, k3, scope) {
    assertPinnedCharacterLeaderValueScope(scope);
    const report = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-value-scope-audit",
        contractVersion: leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_CONTRACT_VERSION, mode: "offline_local_explicit_opt_in_stdout_only",
        sources: { k48, k3 },
        policy: {
            rawFieldsRemainOpaque: true, type82PartialClassificationOnly: true, descriptionCorrelationAuditOnly: true,
            descriptionTextIncluded: false, textUsedAsIdentityOrJoin: false, hpAtkDefDerived: false, selectorOrBitmaskDerived: false,
            clauseOrCompositionDerived: false, calculationTargetOrTimingSemanticsDerived: false, payloadWritten: false,
            consumerImplemented: false, applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false,
            publisherImplemented: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        scope,
        inputIntegrity: {
            k48SourceBoundBefore: "NOT_EXECUTED", k48SourceBoundAfter: "NOT_EXECUTED", k48IdentityAndFingerprintStable: false,
            k3ExactPinnedBeforeAndAfter: false, k3ValueFingerprintStable: false, k3DecodeBoundedToPinnedRawSize: false,
            reportTimestampIncluded: false, reportMaximumBytesExclusive: leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES,
            rssMaximumBytesExclusive: leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES,
        },
        readiness: {
            leaderValueScope: "NOT_EXECUTED", nextOpaquePartialProjection: "NO-GO", hpAtkDefSemantics: "NO-GO",
            selectorOrBitmaskSemantics: "NO-GO", clauseOrCompositionSemantics: "NO-GO", calculationTargetOrTimingSemantics: "NO-GO",
            productReplacement: "NO-GO", consumer: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO",
            writer: "NO-GO", publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
    if (Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) >= leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES)
        throw new Error("K49 report byte limit reached");
    return report;
}
exports.buildCharacterLeaderValueScopeReport = buildCharacterLeaderValueScopeReport;
//# sourceMappingURL=leader-value-scope.js.map