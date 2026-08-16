"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
const leader_causality_collection_contract_1 = require("./leader-causality-collection-contract");
const leader_causality_deck_index_contract_1 = require("./leader-causality-deck-index-contract");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
const leader_supported_projection_run_1 = require("./leader-supported-projection-run");
const leader_supported_projection_source_1 = require("./leader-supported-projection-source");
const args = [
    "--opt-in-k56", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--output-root", "o", "--native-runtime", "elf", "--database", "db",
];
function k55() {
    const noGos = {
        conditionalType82RuntimeBranch: "NO-GO", singleEvaluationOrReevaluation: "NO-GO", duration: "NO-GO",
        resetOrRemovalOutcome: "NO-GO", enterExitLifecycle: "NO-GO", leaderFriendComposition: "NO-GO",
        finalStackingOrComposition: "NO-GO", finalOperationOrderingOutsideHandler: "NO-GO",
        transformationDeathReviveExchangeStandby: "NO-GO", finalRounding: "NO-GO", productProjection: "NO-GO",
        authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO", network: "NO-GO",
        r2: "NO-GO", android: "NO-GO",
    };
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-lifecycle-semantics-audit", contractVersion: "1.0.0",
        mode: "offline_local_explicit_opt_in_stdout_only", upstreamK54: {}, sources: { native: {} },
        scope: {
            unconditional: { effects: 3836, references: 12265, status: "supported" },
            conditional: { effects: 17, references: 45, status: "excluded", reason: "runtime_deck_index_unresolved" },
        },
        supported: {}, partial: {}, unknown: {},
        policy: {
            nativeStructuralEvidenceOnly: true, postConditionIndependentOfType35Only: true, runtimeDeckIndexReopened: false,
            db37PassiveTurnOrIsOnceUsedAsLeaderBinding: false, lifecycleDerived: false, removalOutcomeDerived: false,
            leaderFriendCompositionDerived: false, finalStackingDerived: false, finalRoundingDerived: false,
            sourceTextIncluded: false, payloadWritten: false, authoritySelected: false, productionModified: false,
            networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        inputIntegrity: {
            k54RealAudit: "GO", k54StructuralGosAndAllNoGosPreserved: true, nativeProofBefore: "GO", nativeProofAfter: "GO",
            nativeProofStableAcrossK54: true, reportTimestampIncluded: false, reportMaximumBytesExclusive: 65536,
            rssMaximumBytesExclusive: 1073741824, rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            oneStatusPerSourceRow: "GO", startTurnSharedExecutionInvocation: "GO", type82MatchingRowsAdditiveInCalculator: "GO",
            calcOption0IntegerConversionAtHandler: "GO", calcOption2DivideBy100FloatAtHandler: "GO",
            postConditionIndependentOfType35: "GO", ...noGos,
        },
    };
}
function inputs() {
    const conditionalIds = [...leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds];
    const projectedIds = Array.from({ length: 3836 }, (_, index) => String(index + 1));
    const effectIds = [...conditionalIds, ...projectedIds];
    const rawEffects = effectIds.map((rowId, index) => ({
        rowId, leaderSkillSetId: "set", efficacyType: 82,
        efficacyVector: [index + 1, index % 7 + 1, 0], calcOption: index === 17 ? 0 : 2,
        targetType: index % 3 === 0 ? 2 : index % 3 === 1 ? 12 : 13,
        subTargetTypeSetId: rowId === "2" ? "targets" : null, causalitySerializedShapeSha256: index < 17 ? `c${index}` : null,
        execTimingType: 1, descriptionCorrelatedToVectorPosition1: true,
    }));
    const associations = [];
    for (const rowId of conditionalIds)
        associations.push({ effect: { table: "leader_skills", rowId }, targetSetId: null, targets: [] });
    for (let index = 0; index < 28; index++)
        associations.push({ effect: { table: "leader_skills", rowId: conditionalIds[index % 17] }, targetSetId: null, targets: [] });
    for (const rowId of projectedIds)
        associations.push({
            effect: { table: "leader_skills", rowId },
            targetSetId: rowId === "2" ? "targets" : null,
            targets: rowId === "2" ? [{ table: "sub_target_types", rowId: "target" }, { table: "sub_target_types", rowId: "target" }] : [],
        });
    while (associations.length < 12310)
        associations.push({ effect: { table: "leader_skills", rowId: "1" }, targetSetId: null, targets: [] });
    const dataset = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: { k46: { k3: {} }, k3: {} },
        policy: { structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, semanticAssociationSelected: false },
        states: [{
                stateId: "1", sourceStateKey: "card:initial", cardId: "100", releaseState: "initial",
                leader: { set: { table: "leader_skill_sets", rowId: "set" }, effects: associations },
            }],
    };
    const k48 = {
        dataset, coverage: {},
        validation: { valid: true, readiness: { sourceBoundValidation: "NOT_EXECUTED" } },
        manifest: { sha256: "payload", uncompressedSha256: "raw" },
        raw: Buffer.from("raw"), gzip: Buffer.from("gzip"), coverageBytes: Buffer.from("coverage"),
        validationBytes: Buffer.from("validation"), manifestBytes: Buffer.from("manifest"),
    };
    const identity = {
        profileId: "p", snapshotVersion: "s", manifest: {}, artifact: {}, coverage: {}, validation: {},
        associationInputFingerprintSha256: "a", valueInputFingerprintSha256: "v",
    };
    return {
        k48,
        k3Value: { identity, effects: rawEffects },
        k3Target: { identity: { artifactSha256: "k3", targetInputFingerprintSha256: "target" }, rows: [{ rowId: "target", targetSetId: "targets", valueType: 1, valueId: "42" }] },
        k3Causality: {
            identity: { ...identity, causalityInputFingerprintSha256: "causality" },
            effects: conditionalIds.map((rowId, index) => ({ rowId, expression: index % 2 ? ["&", 196, 197] : 196 })),
            missingReferencedRowIds: [...leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.referencedIds],
        },
        causalityDatabase: {
            identity: {
                sha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.databaseSha256,
                sizeBytes: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.databaseSizeBytes,
                rowsFingerprintSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.databaseRowsFingerprintSha256,
                descriptorBoundReadOnly: true,
            },
            rows: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.referencedIds.map(id => ({
                id,
                causalityType: 35,
                cauVal1: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.masks[id],
                cauVal2: 0,
                cauVal3: 0,
            })),
        },
        productive: {
            identity: { fileName: "characters.json", sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc", sizeBytes: 121390313, topLevelCount: 4090 },
            cardIds: new Set(["100"]),
        },
        upstreamK55: k55(),
    };
}
describe("K56 supported-only leader projection", function () {
    this.timeout(30000);
    let artifacts;
    before(() => {
        const built = (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)(inputs());
        artifacts = (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(built.dataset, built.coverage);
    });
    it("parses exactly one opt-in and all nine explicit values", () => {
        const parsed = (0, leader_supported_projection_run_1.parseCharacterLeaderSupportedProjectionCli)(args);
        (0, assert_1.equal)(parsed.outputRoot, "o");
        (0, assert_1.throws)(() => (0, leader_supported_projection_run_1.parseCharacterLeaderSupportedProjectionCli)(args.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_supported_projection_run_1.parseCharacterLeaderSupportedProjectionCli)([...args, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_supported_projection_run_1.parseCharacterLeaderSupportedProjectionCli)([...args, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_supported_projection_run_1.parseCharacterLeaderSupportedProjectionCli)(args.slice(0, -1)), /missing value/);
    });
    it("requires six K55 GOs and preserves every conservative NO-GO", () => {
        (0, leader_supported_projection_1.assertConservativeK55ForSupportedProjection)(k55());
        const promoted = k55();
        promoted.readiness.leaderFriendComposition = "GO";
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.assertConservativeK55ForSupportedProjection)(promoted), /conservative K55 leaderFriendComposition NO-GO/);
        const weakened = k55();
        weakened.readiness.oneStatusPerSourceRow = "NOT_EXECUTED";
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.assertConservativeK55ForSupportedProjection)(weakened), /requires K55 oneStatusPerSourceRow GO/);
    });
    it("pins 3853/12310, excludes exactly 17/45 and prevents conditional leakage", () => {
        (0, assert_1.equal)(artifacts.dataset.records.length, 12265);
        (0, assert_1.equal)(new Set(artifacts.dataset.records.map(record => record.effectRowId)).size, 3836);
        (0, assert_1.equal)(artifacts.coverage.excluded.length, 17);
        (0, assert_1.deepStrictEqual)(artifacts.coverage.excluded.map(item => item.effectRowId), leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds);
        (0, assert_1.equal)(artifacts.coverage.excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0), 45);
        const expectedProvenance = {
            k52NativeEvidenceSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53NativeEvidenceSha256: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54NativeEvidenceSha256: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
        };
        (0, assert_1.equal)(artifacts.coverage.excluded.every(item => JSON.stringify(item.provenance) === JSON.stringify(expectedProvenance)), true);
        const excluded = new Set(artifacts.coverage.excluded.map(item => item.effectRowId));
        (0, assert_1.equal)(artifacts.dataset.records.some(record => excluded.has(record.effectRowId)), false);
        const leaked = JSON.parse(JSON.stringify(artifacts.dataset));
        leaked.records[0].effectRowId = leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds[0];
        const validation = (0, leader_supported_projection_1.validateCharacterLeaderSupportedProjection)(leaked, artifacts.coverage);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("conditional effect leaked into payload"), true);
    });
    it("requires the exact six K3-missing IDs and exact SQLite type-35 mask tuples", () => {
        const zeroMissing = inputs();
        zeroMissing.k3Causality.missingReferencedRowIds = [];
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)(zeroMissing), /type82 or causality corpus pin changed/);
        const idDrift = inputs();
        idDrift.k3Causality.missingReferencedRowIds[5] = "3593";
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)(idDrift), /type82 or causality corpus pin changed/);
        const databaseDrift = inputs();
        databaseDrift.causalityDatabase.rows[0].cauVal1++;
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)(databaseDrift), /type82 or causality corpus pin changed/);
        const conditionalIdDrift = inputs();
        conditionalIdDrift.k3Causality.effects[0].rowId = "5267";
        (0, assert_1.throws)(() => (0, leader_supported_projection_1.buildCharacterLeaderSupportedProjection)(conditionalIdDrift), /type82 or causality corpus pin changed/);
    });
    it("preserves source occurrence and duplicate target order without materializing unknowns", () => {
        const record = artifacts.dataset.records.find(item => item.effectRowId === "2");
        (0, assert_1.deepStrictEqual)(record.targetFilters.map(item => [item.sourceTargetOccurrenceIndex, item.operation, item.categoryId]), [[0, "include", "42"], [1, "include", "42"]]);
        (0, assert_1.equal)(record.targetFilterComposition.duplicateBehavior, "preserved_and_reapplied");
        const serialized = JSON.stringify(artifacts.dataset.records);
        for (const forbidden of ["execTimingType", "causality", "position2", "deckIndex", "fallback", "description", "finalValue", "primary", "secondary", "hybrid"]) {
            (0, assert_1.equal)(serialized.includes(forbidden), false);
        }
        (0, assert_1.equal)(artifacts.coverage.unknown.finalRounding, "unknown");
        (0, assert_1.equal)(artifacts.coverage.partial.deactivation, "apis_invoked_outcome_unbound");
    });
    it("keeps user-confirmed domain rules corroborative, coverage-only and structurally separated", () => {
        const rule = artifacts.coverage.corroborativeDomainRules[0];
        (0, assert_1.equal)(rule.ruleId, "k56-conditional-domain-rule-v1");
        (0, assert_1.equal)(rule.provenance, "user_confirmed_domain_rule");
        (0, assert_1.equal)(rule.communityCorroboration, "user_reported_not_independently_source_bound");
        (0, assert_1.equal)(rule.firstPartyRuntimeDeckIndexEvidence, false);
        (0, assert_1.equal)(rule.usedToAuthorizeSupportedProjection, false);
        (0, assert_1.equal)(rule.appliesToExcludedConditionalEffectsOnly, true);
        (0, assert_1.deepStrictEqual)(rule.elementTypeDomain, ["agl", "teq", "int", "str", "phy"]);
        (0, assert_1.deepStrictEqual)(rule.battleClassDomain, ["super", "extreme", "none"]);
        (0, assert_1.deepStrictEqual)(rule.awakeningState, {
            source: "selected_card_state", preZBattleClass: "none", postZBattleClass: "acquired_after_z_awakening",
        });
        (0, assert_1.deepStrictEqual)(rule.condition, {
            scope: "team_including_friend", ownUnitSlots: 6, friendUnitSlots: 1, effectTarget: "eligible_matching_units",
            currentElementTypeRequired: true, currentBattleClassRequired: true,
        });
        (0, assert_1.deepStrictEqual)(rule.friend, { conditionParticipation: "may_satisfy_condition", effectReceipt: "only_if_effect_target_matches" });
        (0, assert_1.deepStrictEqual)(rule.passiveCrossScope, { allFiveElementTypesScope: "team_including_friend", authority: "corroborative_only" });
        (0, assert_1.deepStrictEqual)(rule.dualSuperExtremeClause, {
            proofComposition: "separate_required_proofs",
            requiredProofs: ["super_class_presence", "extreme_class_presence", "all_five_element_types"],
        });
        (0, assert_1.equal)(artifacts.coverage.excluded.every(item => item.corroborativeRule.ruleId === rule.ruleId
            && item.corroborativeRule.provenance === "user_confirmed_domain_rule"
            && item.corroborativeRule.usedToAuthorizeSupportedProjection === false), true);
        (0, assert_1.equal)(JSON.stringify(artifacts.dataset).includes(rule.ruleId), false);
        const authorizationDrift = JSON.parse(JSON.stringify(artifacts.coverage));
        authorizationDrift.corroborativeDomainRules[0].usedToAuthorizeSupportedProjection = true;
        const validation = (0, leader_supported_projection_1.validateCharacterLeaderSupportedProjection)(artifacts.dataset, authorizationDrift);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("coverage pin changed"), true);
        const exclusionIdDrift = JSON.parse(JSON.stringify(artifacts.coverage));
        exclusionIdDrift.excluded[0].effectRowId = "5267";
        (0, assert_1.equal)((0, leader_supported_projection_1.validateCharacterLeaderSupportedProjection)(artifacts.dataset, exclusionIdDrift).valid, false);
    });
    it("keeps shadow parity cardId-only with no false conflict or authority", () => {
        const parity = artifacts.coverage.shadowParity;
        (0, assert_1.equal)(parity.comparisonMode, "card_id_only_no_value_authority");
        (0, assert_1.equal)(parity.cardIdCoverage.productiveJoinedCardIds, 1);
        (0, assert_1.equal)(parity.comparableValueReferences, 0);
        (0, assert_1.equal)(parity.representationMismatchComparableReferences, 0);
        (0, assert_1.equal)(parity.confirmedConflictComparableValues, 0);
        (0, assert_1.equal)(parity.zeroConflictIsCompleteness, false);
        (0, assert_1.equal)(parity.authoritySelected, false);
        (0, assert_1.equal)(parity.unknownValueReferences, 12265);
        (0, assert_1.deepStrictEqual)(artifacts.coverage.unjoinable, { scope: "productive_card_id", distinctCardIds: 0, references: 0 });
        (0, assert_1.equal)(artifacts.dataset.policy.characterArrayIncluded, false);
        (0, assert_1.equal)(artifacts.dataset.policy.patchOrApplyImplemented, false);
    });
    it("is canonical and byte-deterministic while public validation leaves source-bound GO NOT_EXECUTED", () => {
        const second = (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(artifacts.dataset, artifacts.coverage);
        (0, assert_1.equal)(second.raw.equals(artifacts.raw), true);
        (0, assert_1.equal)(second.gzip.equals(artifacts.gzip), true);
        (0, assert_1.equal)(second.coverageBytes.equals(artifacts.coverageBytes), true);
        (0, assert_1.equal)(second.validationBytes.equals(artifacts.validationBytes), true);
        (0, assert_1.equal)(second.manifestBytes.equals(artifacts.manifestBytes), true);
        (0, assert_1.equal)(artifacts.validation.readiness.offlineSupportedOnlyProjection, "GO");
        (0, assert_1.equal)(artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(artifacts.validation.readiness.localShadowAuditDefaultOff, "NOT_EXECUTED");
        (0, assert_1.equal)(artifacts.dataset.policy.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        (0, assert_1.equal)(artifacts.dataset.policy.concurrentSameUserAncestorReplacementProtected, false);
        (0, assert_1.equal)(artifacts.validation.safety.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        (0, assert_1.equal)(artifacts.validation.safety.concurrentSameUserAncestorReplacementProtected, false);
        (0, assert_1.equal)(artifacts.validation.readiness.concurrentOutputAncestorReplacement, "NO-GO");
        (0, assert_1.equal)(artifacts.manifest.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        (0, assert_1.equal)(artifacts.manifest.concurrentSameUserAncestorReplacementProtected, false);
        (0, assert_1.equal)(artifacts.raw.length < 16 * 1024 * 1024, true);
        (0, assert_1.equal)(artifacts.gzip.length < 2 * 1024 * 1024, true);
        (0, assert_1.equal)(artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length < 64 * 1024, true);
        (0, leader_supported_projection_source_1.assertCharacterLeaderSupportedProjectionArtifactBytes)(second, artifacts);
        const drifted = { ...second, gzip: Buffer.from(second.gzip) };
        drifted.gzip[0] ^= 1;
        (0, assert_1.throws)(() => (0, leader_supported_projection_source_1.assertCharacterLeaderSupportedProjectionArtifactBytes)(drifted, artifacts), /source-bound artifact mismatch: payload/);
        const validatorSource = leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionArtifact.toString();
        (0, assert_1.equal)(validatorSource.includes("runCharacterLeaderLifecycleSemanticsAudit"), true);
        (0, assert_1.equal)(validatorSource.includes("options.upstreamK55"), false);
    });
    it("rejects linked roots, aliasing, hardlink/create-only collisions and writes manifest last", async () => {
        const base = (0, path_1.resolve)(".agent-logs", `k56-safety-${process.pid}`);
        await (0, promises_1.rm)(base, { recursive: true, force: true });
        const names = ["sidecar", "production", "fyi", "k43", "k46", "k48", "output"];
        for (const name of names)
            await (0, promises_1.mkdir)((0, path_1.join)(base, name), { recursive: true });
        const native = (0, path_1.join)(base, "native.so"), database = (0, path_1.join)(base, "database.db");
        await (0, promises_1.writeFile)(native, "n");
        await (0, promises_1.writeFile)(database, "d");
        const common = {
            sidecarRoot: (0, path_1.join)(base, "sidecar"), productionRoot: (0, path_1.join)(base, "production"), fyiRoot: (0, path_1.join)(base, "fyi"),
            k43Root: (0, path_1.join)(base, "k43"), k46Root: (0, path_1.join)(base, "k46"), k48Root: (0, path_1.join)(base, "k48"),
            outputRoot: (0, path_1.join)(base, "output"), nativeRuntime: native, database,
        };
        try {
            await (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionRootSeparation)(common);
            await (0, assert_1.rejects)(() => (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionRootSeparation)({ ...common, outputRoot: common.k48Root }), /must not alias/);
            const linked = (0, path_1.join)(base, "linked-output");
            try {
                await (0, promises_1.symlink)(common.outputRoot, linked, process.platform === "win32" ? "junction" : "dir");
                await (0, assert_1.rejects)(() => (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionOutputRoot)(linked), /non-link directory|symlink or junction rejected/);
            }
            catch (error) {
                if (!["EPERM", "EACCES"].includes(error?.code))
                    throw error;
            }
            const collision = (0, path_1.join)(common.outputRoot, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage);
            await (0, promises_1.link)(native, collision);
            await (0, assert_1.rejects)(() => (0, leader_supported_projection_source_1.writeCharacterLeaderSupportedProjectionArtifacts)(common.outputRoot, artifacts), /output already exists/);
            await (0, promises_1.rm)(collision);
            await (0, leader_supported_projection_source_1.writeCharacterLeaderSupportedProjectionArtifacts)(common.outputRoot, artifacts);
            (0, assert_1.equal)((await (0, promises_1.lstat)((0, path_1.join)(common.outputRoot, leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest))).nlink, 1);
            await (0, assert_1.rejects)(() => (0, leader_supported_projection_source_1.writeCharacterLeaderSupportedProjectionArtifacts)(common.outputRoot, artifacts), /output already exists/);
            (0, assert_1.equal)((0, fs_1.existsSync)((0, path_1.join)(common.outputRoot, artifacts.manifest.fileName)), true);
        }
        finally {
            await (0, promises_1.rm)(base, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-supported-projection.spec.js.map