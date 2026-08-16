"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const leader_causality_collection_contract_1 = require("./leader-causality-collection-contract");
const leader_causality_deck_index_contract_1 = require("./leader-causality-deck-index-contract");
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_1 = require("./leader-supported-projection");
const leader_supported_shadow_contract_1 = require("./leader-supported-shadow-contract");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const leader_supported_shadow_run_1 = require("./leader-supported-shadow-run");
const cli = [
    "--opt-in-k57", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--native-runtime", "elf", "--database", "db",
];
function implementationSource(fileName) {
    const sibling = (0, path_1.resolve)(__dirname, fileName);
    const path = (0, fs_1.existsSync)(sibling) ? sibling : (0, path_1.resolve)(__dirname, "..", "..", "database-characters", fileName);
    return (0, fs_1.readFileSync)(path, "utf8");
}
function record(state, occurrence, globalIndex) {
    const effect = globalIndex % leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctEffectRowIds + 1;
    return {
        stateId: String(state), sourceStateKey: `card:${state}:initial`,
        cardId: String((state - 1) % leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctCardIds + 1), releaseState: "initial",
        leaderSetRowId: `set-${state}`, effectRowId: `projected-${effect}`, sourceEffectOccurrenceIndex: occurrence,
        selector: { kind: "structural_mask", mask: effect }, commonModifier: effect % 13,
        stats: ["hp", "atk", "def"],
        calculation: globalIndex % 2 === 0
            ? { kind: "flat_points", value: effect, integerConversion: "at_handler" }
            : { kind: "proportional_percent_divided_by_100", numerator: effect, divisor: 100 },
        targetScope: globalIndex % 3 === 0 ? "team_allies" : globalIndex % 3 === 1 ? "super_class_allies" : "extreme_class_allies",
        targetFilters: globalIndex === 0 ? [
            { sourceTargetOccurrenceIndex: 0, operation: "include", selector: "card_category_id", categoryId: "42" },
            { sourceTargetOccurrenceIndex: 1, operation: "include", selector: "card_category_id", categoryId: "42" },
        ] : [],
        targetFilterComposition: { operator: "and_sequential", emptyBehavior: "identity", duplicateBehavior: "preserved_and_reapplied" },
    };
}
function fixture() {
    const records = [];
    for (let state = 1; state <= leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.distinctStateIds; state++) {
        const count = state <= 5017 ? 2 : 1;
        for (let occurrence = 0; occurrence < count; occurrence++)
            records.push(record(state, occurrence, records.length));
    }
    const domainRule = {
        ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule",
        communityCorroboration: "user_reported_not_independently_source_bound", firstPartyRuntimeDeckIndexEvidence: false,
        usedToAuthorizeSupportedProjection: false, appliesToExcludedConditionalEffectsOnly: true,
        elementTypeDomain: ["agl", "teq", "int", "str", "phy"], battleClassDomain: ["super", "extreme", "none"],
        awakeningState: { source: "selected_card_state", preZBattleClass: "none", postZBattleClass: "acquired_after_z_awakening" },
        condition: {
            scope: "team_including_friend", ownUnitSlots: 6, friendUnitSlots: 1, effectTarget: "eligible_matching_units",
            currentElementTypeRequired: true, currentBattleClassRequired: true,
        },
        friend: { conditionParticipation: "may_satisfy_condition", effectReceipt: "only_if_effect_target_matches" },
        passiveCrossScope: { allFiveElementTypesScope: "team_including_friend", authority: "corroborative_only" },
        dualSuperExtremeClause: {
            proofComposition: "separate_required_proofs",
            requiredProofs: ["super_class_presence", "extreme_class_presence", "all_five_element_types"],
        },
    };
    let affectedIndex = 0;
    const excluded = leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds.map((effectRowId, index) => {
        const count = index < 11 ? 3 : 2;
        const affectedReferences = Array.from({ length: count }, () => ({
            stateId: `excluded-${affectedIndex + 1}`, sourceEffectOccurrenceIndex: affectedIndex++,
        }));
        return {
            effectRowId, affectedReferences, expression: index % 2 === 0 ? 196 : ["&", 196, 197],
            reason: "runtime_deck_index_unresolved",
            provenance: {
                k52NativeEvidenceSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
                k53NativeEvidenceSha256: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
                k54NativeEvidenceSha256: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
            },
            corroborativeRule: {
                ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule",
                usedToAuthorizeSupportedProjection: false,
            },
        };
    });
    const source = {};
    const dataset = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only_default_off", source,
        policy: {
            supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false, conditionalEffectsIncluded: false,
            unknownValuesMaterialized: false, execTimingTypeIncluded: false, causalityIncluded: false,
            ignoredPosition2Included: false, textOrDescriptionIncluded: false, aggregateOrFinalValueIncluded: false,
            primarySecondaryOrHybridInvented: false, characterArrayIncluded: false, patchOrApplyImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        },
        records,
    };
    const coverage = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" }, excluded: excluded,
        corroborativeDomainRules: [domainRule],
        partial: { creation: "factory_per_source_row", application: "shared_start_turn_execution_invocation", deactivation: "apis_invoked_outcome_unbound" },
        unknown: {
            recurrence: "unknown", duration: "unknown", removalOutcome: "unknown", enterExitLifecycle: "unknown",
            leaderFriendComposition: "unknown", finalStackingOrComposition: "unknown", operationOrderingOutsideHandler: "unknown",
            finalRounding: "unknown", transformationDeathReviveExchangeStandby: "unknown", effectiveConditionalBranch: "unknown",
        },
        unjoinable: { scope: "productive_card_id", distinctCardIds: 0, references: 0 },
        shadowParity: {
            comparisonMode: "card_id_only_no_value_authority", cardIdCoverage: {
                projectedDistinctCardIds: 3434, productiveJoinedCardIds: 0, productiveUnjoinableCardIds: 3434,
            },
            structuralRepresentationGainReferences: 0, comparableValueReferences: 0, representationMismatchComparableReferences: 0,
            comparableAgreementCardIds: 0, confirmedConflictComparableValues: 0, unknownValueReferences: 12265,
            unjoinableReferences: 12265, zeroConflictIsCompleteness: false, authoritySelected: false,
        },
        provenance: {
            k52CausalityInputFingerprintSha256: "c", k52DatabaseSha256: "d", k52DatabaseRowsFingerprintSha256: "r",
            k52NativeEvidenceSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53NativeEvidenceSha256: leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54NativeEvidenceSha256: leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
            k55NativeEvidenceSha256: "k55",
        },
    };
    return (0, leader_supported_projection_1.materializeCharacterLeaderSupportedProjection)(dataset, coverage);
}
describe("K57 supported leader shadow consumer", function () {
    this.timeout(30000);
    let artifacts;
    let consumer;
    before(() => {
        artifacts = fixture();
        consumer = (0, leader_supported_shadow_1.createCharacterLeaderSupportedShadow)(artifacts);
    });
    it("parses exactly one opt-in and all nine explicit values", () => {
        const parsed = (0, leader_supported_shadow_run_1.parseCharacterLeaderSupportedShadowCli)(cli);
        (0, assert_1.equal)(parsed.k56Root, "56");
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.parseCharacterLeaderSupportedShadowCli)(cli.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.parseCharacterLeaderSupportedShadowCli)([...cli, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.parseCharacterLeaderSupportedShadowCli)([...cli, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.parseCharacterLeaderSupportedShadowCli)(cli.slice(0, -1)), /missing value/);
    });
    it("pins the real K56 identities and exact supported/excluded boundary", () => {
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sha256, "345f7ab587fe893c58971799e220548896f2bf803b667b18a70595f32ac78154");
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest.sizeBytes, 7146);
        (0, assert_1.deepStrictEqual)(artifacts.coverage.excluded.map(item => item.effectRowId), leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds);
        (0, assert_1.equal)(artifacts.coverage.excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0), 45);
        (0, assert_1.equal)(artifacts.coverage.corroborativeDomainRules[0].firstPartyRuntimeDeckIndexEvidence, false);
        (0, assert_1.equal)(artifacts.coverage.corroborativeDomainRules[0].usedToAuthorizeSupportedProjection, false);
        (0, assert_1.equal)(JSON.stringify(artifacts.dataset).includes("k56-conditional-domain-rule-v1"), false);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_1.assertExactCharacterLeaderSupportedShadowK56Identity)(artifacts), /exact real K56 artifact identity rejected/);
    });
    it("builds all private indexes and preserves exact source order and full records", () => {
        const inventory = consumer.inventory();
        (0, assert_1.deepStrictEqual)({
            references: inventory.references, states: inventory.distinctStateIds,
            cards: inventory.distinctCardIds, effects: inventory.distinctEffectRowIds,
        }, { references: 12265, states: 7248, cards: 3434, effects: 3836 });
        (0, assert_1.equal)(inventory.samples.stateIds.length <= 5 && inventory.samples.references.length <= 5, true);
        const state = consumer.lookupStateId("1");
        (0, assert_1.deepStrictEqual)(state.map(item => item.sourceEffectOccurrenceIndex), [0, 1]);
        (0, assert_1.deepStrictEqual)(consumer.lookupReference("1", 0), artifacts.dataset.records[0]);
        (0, assert_1.deepStrictEqual)(consumer.lookupCardId("1")[0], artifacts.dataset.records[0]);
        (0, assert_1.deepStrictEqual)(consumer.lookupEffectRowId("projected-1")[0], artifacts.dataset.records[0]);
        (0, assert_1.deepStrictEqual)(state[0].targetFilters.map(filter => filter.categoryId), ["42", "42"]);
    });
    it("rejects duplicate reference identities", () => {
        const duplicate = [artifacts.dataset.records[0], { ...artifacts.dataset.records[1], sourceEffectOccurrenceIndex: 0 }];
        (0, assert_1.throws)(() => (0, leader_supported_shadow_1.assertCharacterLeaderSupportedShadowReferenceIdentitiesUnique)(duplicate), /duplicate reference identity/);
    });
    it("returns deeply frozen clones that cannot mutate private indexes", () => {
        const first = consumer.lookupStateId("1");
        (0, assert_1.equal)(Object.isFrozen(first), true);
        (0, assert_1.equal)(Object.isFrozen(first[0]), true);
        (0, assert_1.equal)(Object.isFrozen(first[0].targetFilters), true);
        (0, assert_1.throws)(() => { first.push({}); }, TypeError);
        (0, assert_1.throws)(() => { first[0].cardId = "mutated"; }, TypeError);
        (0, assert_1.throws)(() => { first[0].targetFilters[0].categoryId = "mutated"; }, TypeError);
        (0, assert_1.equal)(consumer.lookupReference("1", 0)?.cardId, "1");
        (0, assert_1.equal)(consumer.lookupReference("1", 0) === first[0], false);
        (0, assert_1.equal)(Object.isFrozen(consumer.inventory().samples.references), true);
    });
    it("keeps direct factory readiness NOT_EXECUTED and report bounded without records or presentation", () => {
        const report = consumer.report();
        (0, assert_1.equal)(report.readiness.consumerShadow, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.perProcessRssUnder1GiB, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.processTreeRssUnder1GiB, "NO-GO");
        (0, assert_1.equal)(report.rssAccounting.scope, "per_process_not_process_tree");
        (0, assert_1.equal)(report.rssAccounting.measurements, null);
        const serialized = JSON.stringify(report);
        (0, assert_1.equal)(serialized.includes('"records"'), false);
        (0, assert_1.equal)(/description|presentation|Character\[\]|sourceText/i.test(serialized), false);
        (0, assert_1.equal)(Buffer.byteLength(`${JSON.stringify(report, null, 2)}\n`) < leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES, true);
        (0, leader_supported_shadow_1.assertCharacterLeaderSupportedShadowReportBound)(report);
    });
    it("detects deterministic full-artifact fingerprint drift", () => {
        const after = { ...artifacts, gzip: Buffer.from(artifacts.gzip) };
        after.gzip[0] ^= 1;
        (0, assert_1.equal)((0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(after) === (0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(artifacts), false);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.assertCharacterLeaderSupportedShadowArtifactsStable)(artifacts, after), /artifact fingerprint drifted/);
    });
    it("uses two real K56 validators in the runner without writer, network, or injected authority", () => {
        const source = implementationSource("leader-supported-shadow-run.ts");
        (0, assert_1.equal)((source.match(/await validateCharacterLeaderSupportedProjectionArtifact/g) ?? []).length, 2);
        (0, assert_1.equal)(source.includes("upstreamK55"), false);
        (0, assert_1.equal)(source.includes("writeCharacterLeader"), false);
        (0, assert_1.equal)(/\bfetch\s*\(|https?:\/\//.test(source), false);
        (0, assert_1.equal)(source.includes('sourceBoundValidationBefore: "GO"'), true);
        (0, assert_1.equal)(source.includes('sourceBoundValidationAfter: "GO"'), true);
    });
    it("reports only maximum individual process RSS and leaves process-tree RSS NO-GO", () => {
        (0, assert_1.equal)((0, leader_supported_shadow_run_1.maximumIndividualCharacterLeaderSupportedShadowProcessPeakRss)(100, 300, 200), 300);
        (0, assert_1.throws)(() => (0, leader_supported_shadow_run_1.maximumIndividualCharacterLeaderSupportedShadowProcessPeakRss)(100, 1024 * 1024 * 1024, 200), /per-process RSS peak rejected/);
        const runner = implementationSource("leader-supported-shadow-run.ts");
        (0, assert_1.equal)(runner.includes('scope: "per_process_not_process_tree"'), true);
        (0, assert_1.equal)(runner.includes("maximumIndividualProcessPeakRssBytes"), true);
    });
});
//# sourceMappingURL=leader-supported-shadow.spec.js.map