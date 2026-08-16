import { deepStrictEqual, equal, rejects, throws } from "assert";
import { EventEmitter } from "events";
import { existsSync, readFileSync } from "fs";
import { link, lstat, mkdir, rm, symlink, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { PassThrough } from "stream";
import type { CharacterLeaderAssociationProjectionArtifactSet } from "./leader-association-projection-contract";
import type { CharacterLeaderLifecycleSemanticsReport } from "./leader-lifecycle-semantics-contract";
import { CHARACTER_LEADER_CAUSALITY_PIN } from "./leader-causality-semantics-contract";
import { CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN } from "./leader-causality-collection-contract";
import { CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN } from "./leader-causality-deck-index-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CharacterLeaderSupportedProjectionArtifactSet,
} from "./leader-supported-projection-contract";
import {
    CharacterLeaderSupportedProjectionInputs,
    assertConservativeK55ForSupportedProjection,
    buildCharacterLeaderSupportedProjection,
    materializeCharacterLeaderSupportedProjection,
    validateCharacterLeaderSupportedProjection,
} from "./leader-supported-projection";
import {
    maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss,
    parseCharacterLeaderSupportedProjectionCli,
} from "./leader-supported-projection-run";
import {
    CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES,
    CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES,
    CharacterLeaderK55ChildLike,
    CharacterLeaderK55SubprocessOutcome,
    characterLeaderK55SubprocessArgs,
    collectCharacterLeaderK55ChildOutcome,
    parseCharacterLeaderK55SubprocessOutcome,
} from "./leader-supported-projection-k55-subprocess";
import {
    assertCharacterLeaderSupportedProjectionArtifactBytes,
    validateCharacterLeaderSupportedProjectionArtifact,
    validateCharacterLeaderSupportedProjectionOutputRoot,
    validateCharacterLeaderSupportedProjectionRootSeparation,
    writeCharacterLeaderSupportedProjectionArtifacts,
} from "./leader-supported-projection-source";

const args = [
    "--opt-in-k56", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--output-root", "o", "--native-runtime", "elf", "--database", "db",
];

function childOutcome(stdout: Buffer | string, overrides: Partial<CharacterLeaderK55SubprocessOutcome> = {}): CharacterLeaderK55SubprocessOutcome {
    return {
        stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout), stderr: Buffer.alloc(0), exitCode: 0, signal: null,
        timedOut: false, stdoutOverflow: false, stderrOverflow: false, terminationUnconfirmed: false, ...overrides,
    };
}

class NeverClosingK55Child extends EventEmitter {
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly killSignals: Array<NodeJS.Signals | undefined> = [];
    private readonly acceptsKill: boolean;
    constructor(acceptsKill = true) { super(); this.acceptsKill = acceptsKill; }
    kill(signal?: NodeJS.Signals): boolean {
        this.killSignals.push(signal);
        return this.acceptsKill;
    }
}

function implementationSource(fileName: string): string {
    const sibling = resolve(__dirname, fileName);
    const path = existsSync(sibling) ? sibling : resolve(__dirname, "..", "..", "database-characters", fileName);
    return readFileSync(path, "utf8");
}

function k55(): CharacterLeaderLifecycleSemanticsReport {
    const noGos = {
        conditionalType82RuntimeBranch: "NO-GO", singleEvaluationOrReevaluation: "NO-GO", duration: "NO-GO",
        resetOrRemovalOutcome: "NO-GO", enterExitLifecycle: "NO-GO", leaderFriendComposition: "NO-GO",
        finalStackingOrComposition: "NO-GO", finalOperationOrderingOutsideHandler: "NO-GO",
        transformationDeathReviveExchangeStandby: "NO-GO", finalRounding: "NO-GO", productProjection: "NO-GO",
        authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO", network: "NO-GO",
        r2: "NO-GO", android: "NO-GO",
    } as const;
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-lifecycle-semantics-audit", contractVersion: "1.0.0",
        mode: "offline_local_explicit_opt_in_stdout_only", upstreamK54: {} as any, sources: { native: {} as any },
        scope: {
            unconditional: { effects: 3836, references: 12265, status: "supported" },
            conditional: { effects: 17, references: 45, status: "excluded", reason: "runtime_deck_index_unresolved" },
        },
        supported: {} as any, partial: {} as any, unknown: {} as any,
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

function inputs(): CharacterLeaderSupportedProjectionInputs {
    const conditionalIds = [...CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds];
    const projectedIds = Array.from({ length: 3836 }, (_, index) => String(index + 1));
    const effectIds = [...conditionalIds, ...projectedIds];
    const rawEffects = effectIds.map((rowId, index) => ({
        rowId, leaderSkillSetId: "set", efficacyType: 82,
        efficacyVector: [index + 1, index % 7 + 1, 0], calcOption: index === 17 ? 0 : 2,
        targetType: index % 3 === 0 ? 2 : index % 3 === 1 ? 12 : 13,
        subTargetTypeSetId: rowId === "2" ? "targets" : null, causalitySerializedShapeSha256: index < 17 ? `c${index}` : null,
        execTimingType: 1, descriptionCorrelatedToVectorPosition1: true,
    }));
    const associations: any[] = [];
    for (const rowId of conditionalIds) associations.push({ effect: { table: "leader_skills", rowId }, targetSetId: null, targets: [] });
    for (let index = 0; index < 28; index++) associations.push({ effect: { table: "leader_skills", rowId: conditionalIds[index % 17] }, targetSetId: null, targets: [] });
    for (const rowId of projectedIds) associations.push({
        effect: { table: "leader_skills", rowId },
        targetSetId: rowId === "2" ? "targets" : null,
        targets: rowId === "2" ? [{ table: "sub_target_types", rowId: "target" }, { table: "sub_target_types", rowId: "target" }] : [],
    });
    while (associations.length < 12310) associations.push({ effect: { table: "leader_skills", rowId: "1" }, targetSetId: null, targets: [] });
    const dataset: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: { k46: { k3: {} }, k3: {} },
        policy: { structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, semanticAssociationSelected: false },
        states: [{
            stateId: "1", sourceStateKey: "card:initial", cardId: "100", releaseState: "initial",
            leader: { set: { table: "leader_skill_sets", rowId: "set" }, effects: associations },
        }],
    };
    const k48: CharacterLeaderAssociationProjectionArtifactSet = {
        dataset, coverage: {} as any,
        validation: { valid: true, readiness: { sourceBoundValidation: "NOT_EXECUTED" } } as any,
        manifest: { sha256: "payload", uncompressedSha256: "raw" } as any,
        raw: Buffer.from("raw"), gzip: Buffer.from("gzip"), coverageBytes: Buffer.from("coverage"),
        validationBytes: Buffer.from("validation"), manifestBytes: Buffer.from("manifest"),
    };
    const identity: any = {
        profileId: "p", snapshotVersion: "s", manifest: {}, artifact: {}, coverage: {}, validation: {},
        associationInputFingerprintSha256: "a", valueInputFingerprintSha256: "v",
    };
    return {
        k48,
        k3Value: { identity, effects: rawEffects },
        k3Target: { identity: { artifactSha256: "k3", targetInputFingerprintSha256: "target" }, rows: [{ rowId: "target", targetSetId: "targets", valueType: 1, valueId: "42" }] },
        k3Causality: {
            identity: { ...identity, causalityInputFingerprintSha256: "causality" },
            effects: conditionalIds.map((rowId, index) => ({ rowId, expression: index % 2 ? ["&", 196, 197] as ["&", number, number] : 196 })),
            missingReferencedRowIds: [...CHARACTER_LEADER_CAUSALITY_PIN.referencedIds],
        },
        causalityDatabase: {
            identity: {
                sha256: CHARACTER_LEADER_CAUSALITY_PIN.databaseSha256,
                sizeBytes: CHARACTER_LEADER_CAUSALITY_PIN.databaseSizeBytes,
                rowsFingerprintSha256: CHARACTER_LEADER_CAUSALITY_PIN.databaseRowsFingerprintSha256,
                descriptorBoundReadOnly: true,
            },
            rows: CHARACTER_LEADER_CAUSALITY_PIN.referencedIds.map(id => ({
                id,
                causalityType: 35,
                cauVal1: CHARACTER_LEADER_CAUSALITY_PIN.masks[id as keyof typeof CHARACTER_LEADER_CAUSALITY_PIN.masks],
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
    this.timeout(30_000);
    let artifacts: CharacterLeaderSupportedProjectionArtifactSet;

    before(() => {
        const built = buildCharacterLeaderSupportedProjection(inputs());
        artifacts = materializeCharacterLeaderSupportedProjection(built.dataset, built.coverage);
    });

    it("parses exactly one opt-in and all nine explicit values", () => {
        const parsed = parseCharacterLeaderSupportedProjectionCli(args);
        equal(parsed.outputRoot, "o");
        throws(() => parseCharacterLeaderSupportedProjectionCli(args.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderSupportedProjectionCli([...args, "loose"]), /unsupported argument/);
        throws(() => parseCharacterLeaderSupportedProjectionCli([...args, "--database", "again"]), /duplicate --database/);
        throws(() => parseCharacterLeaderSupportedProjectionCli(args.slice(0, -1)), /missing value/);
    });

    it("accepts only the exact canonical K55 subprocess envelope and exact source arguments", () => {
        const report = k55(), processPeakRssBytes = 123_456_789;
        const stdout = `${JSON.stringify({ report, processPeakRssBytes })}\n`;
        deepStrictEqual(parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout)), { report, processPeakRssBytes });
        deepStrictEqual(characterLeaderK55SubprocessArgs({
            sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "43", k46Root: "46", k48Root: "48",
            nativeRuntime: "elf", database: "db",
        }), [
            "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
            "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
        ]);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout, { stderr: Buffer.from("warning") })), /wrote stderr/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout, { exitCode: 1 })), /exited 1/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout, { timedOut: true })), /timed out/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout, { terminationUnconfirmed: true })), /termination unconfirmed/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(stdout, { killError: "SIGKILL refused" })), /termination failed/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome("not-json\n")), /envelope malformed/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(`${JSON.stringify({ report, processPeakRssBytes, extra: true })}\n`)), /envelope rejected/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(Buffer.alloc(CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES + 1))), /stdout limit/);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(`${JSON.stringify({ report, processPeakRssBytes: 1024 * 1024 * 1024 })}\n`)), /envelope rejected/);
        const drifted = { ...report, contract: "drift" };
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(`${JSON.stringify({ report: drifted, processPeakRssBytes })}\n`)), /report contract drifted/);
        const promoted: any = JSON.parse(JSON.stringify(report));
        promoted.readiness.leaderFriendComposition = "GO";
        throws(() => parseCharacterLeaderK55SubprocessOutcome(childOutcome(`${JSON.stringify({ report: promoted, processPeakRssBytes })}\n`)), /conservative K55 leaderFriendComposition NO-GO/);
        equal(maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss(100, 300, 200), 300);
        throws(() => maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss(100, 1024 * 1024 * 1024, 200), /per-process RSS peak rejected/);
    });

    it("settles fail-closed when a terminated or errored child never emits close", async () => {
        const limits = { timeoutMs: 2, terminationGraceMs: 2, finalTerminationDeadlineMs: 20 };
        const neverClosing = new NeverClosingK55Child();
        const outcome = await Promise.race([
            collectCharacterLeaderK55ChildOutcome(neverClosing as CharacterLeaderK55ChildLike, limits),
            new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("K55 lifecycle promise remained pending")), 250)),
        ]);
        equal(outcome.timedOut, true);
        equal(outcome.terminationUnconfirmed, true);
        deepStrictEqual(neverClosing.killSignals, [undefined, "SIGKILL"]);
        throws(() => parseCharacterLeaderK55SubprocessOutcome(outcome), /termination unconfirmed/);

        for (const streamName of ["stdout", "stderr"] as const) {
            const overflowing = new NeverClosingK55Child();
            const overflowPromise = collectCharacterLeaderK55ChildOutcome(overflowing as CharacterLeaderK55ChildLike, {
                timeoutMs: 100, terminationGraceMs: 2, finalTerminationDeadlineMs: 20,
            });
            overflowing[streamName].write(Buffer.alloc((streamName === "stdout"
                ? CHARACTER_LEADER_K55_SUBPROCESS_STDOUT_LIMIT_BYTES
                : CHARACTER_LEADER_K55_SUBPROCESS_STDERR_LIMIT_BYTES) + 1));
            const overflowOutcome = await overflowPromise;
            equal(overflowOutcome[streamName === "stdout" ? "stdoutOverflow" : "stderrOverflow"], true);
            equal(overflowOutcome.terminationUnconfirmed, true);
            deepStrictEqual(overflowing.killSignals, [undefined, "SIGKILL"]);
        }

        const refused = new NeverClosingK55Child(false);
        const refusedOutcome = await collectCharacterLeaderK55ChildOutcome(refused as CharacterLeaderK55ChildLike, limits);
        equal(refusedOutcome.terminationUnconfirmed, true);
        equal(refusedOutcome.killError?.includes("not accepted"), true);

        const errored = new NeverClosingK55Child();
        const erroredPromise = collectCharacterLeaderK55ChildOutcome(errored as CharacterLeaderK55ChildLike, {
            timeoutMs: 100, terminationGraceMs: 2, finalTerminationDeadlineMs: 20,
        });
        errored.emit("error", new Error("synthetic spawn failure"));
        const erroredOutcome = await erroredPromise;
        equal(erroredOutcome.terminationUnconfirmed, true);
        equal(erroredOutcome.spawnError?.message, "synthetic spawn failure");
    });

    it("contains no direct in-process K55 execution in K56 source or runner", () => {
        for (const fileName of ["leader-supported-projection-source.ts", "leader-supported-projection-run.ts"]) {
            const source = implementationSource(fileName);
            equal(source.includes("runCharacterLeaderLifecycleSemanticsAudit"), false);
            equal(source.includes("runCharacterLeaderK55Subprocess"), true);
        }
        const runner = implementationSource("leader-supported-projection-run.ts");
        equal(runner.includes('rssAccountingScope: "per_process_not_process_tree"'), true);
        equal(runner.includes('perProcessRssUnder1GiB: "GO"'), true);
        equal(runner.includes('processTreeRssUnder1GiB: "NO-GO"'), true);
    });

    it("requires six K55 GOs and preserves every conservative NO-GO", () => {
        assertConservativeK55ForSupportedProjection(k55());
        const promoted: any = k55();
        promoted.readiness.leaderFriendComposition = "GO";
        throws(() => assertConservativeK55ForSupportedProjection(promoted), /conservative K55 leaderFriendComposition NO-GO/);
        const weakened: any = k55();
        weakened.readiness.oneStatusPerSourceRow = "NOT_EXECUTED";
        throws(() => assertConservativeK55ForSupportedProjection(weakened), /requires K55 oneStatusPerSourceRow GO/);
    });

    it("pins 3853/12310, excludes exactly 17/45 and prevents conditional leakage", () => {
        equal(artifacts.dataset.records.length, 12265);
        equal(new Set(artifacts.dataset.records.map(record => record.effectRowId)).size, 3836);
        equal(artifacts.coverage.excluded.length, 17);
        deepStrictEqual(artifacts.coverage.excluded.map(item => item.effectRowId), CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds);
        equal(artifacts.coverage.excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0), 45);
        const expectedProvenance = {
            k52NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256,
            k53NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.nativeEvidenceSha256,
            k54NativeEvidenceSha256: CHARACTER_LEADER_CAUSALITY_DECK_INDEX_PIN.nativeEvidenceSha256,
        };
        equal(artifacts.coverage.excluded.every(item => JSON.stringify(item.provenance) === JSON.stringify(expectedProvenance)), true);
        const excluded = new Set(artifacts.coverage.excluded.map(item => item.effectRowId));
        equal(artifacts.dataset.records.some(record => excluded.has(record.effectRowId)), false);
        const leaked: any = JSON.parse(JSON.stringify(artifacts.dataset));
        leaked.records[0].effectRowId = CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds[0];
        const validation = validateCharacterLeaderSupportedProjection(leaked, artifacts.coverage);
        equal(validation.valid, false);
        equal(validation.failures.includes("conditional effect leaked into payload"), true);
    });

    it("requires the exact six K3-missing IDs and exact SQLite type-35 mask tuples", () => {
        const zeroMissing = inputs();
        zeroMissing.k3Causality.missingReferencedRowIds = [];
        throws(() => buildCharacterLeaderSupportedProjection(zeroMissing), /type82 or causality corpus pin changed/);
        const idDrift = inputs();
        idDrift.k3Causality.missingReferencedRowIds[5] = "3593";
        throws(() => buildCharacterLeaderSupportedProjection(idDrift), /type82 or causality corpus pin changed/);
        const databaseDrift = inputs();
        databaseDrift.causalityDatabase.rows[0].cauVal1++;
        throws(() => buildCharacterLeaderSupportedProjection(databaseDrift), /type82 or causality corpus pin changed/);
        const conditionalIdDrift = inputs();
        conditionalIdDrift.k3Causality.effects[0].rowId = "5267";
        throws(() => buildCharacterLeaderSupportedProjection(conditionalIdDrift), /type82 or causality corpus pin changed/);
    });

    it("preserves source occurrence and duplicate target order without materializing unknowns", () => {
        const record = artifacts.dataset.records.find(item => item.effectRowId === "2")!;
        deepStrictEqual(record.targetFilters.map(item => [item.sourceTargetOccurrenceIndex, item.operation, item.categoryId]), [[0, "include", "42"], [1, "include", "42"]]);
        equal(record.targetFilterComposition.duplicateBehavior, "preserved_and_reapplied");
        const serialized = JSON.stringify(artifacts.dataset.records);
        for (const forbidden of ["execTimingType", "causality", "position2", "deckIndex", "fallback", "description", "finalValue", "primary", "secondary", "hybrid"]) {
            equal(serialized.includes(forbidden), false);
        }
        equal(artifacts.coverage.unknown.finalRounding, "unknown");
        equal(artifacts.coverage.partial.deactivation, "apis_invoked_outcome_unbound");
    });

    it("keeps user-confirmed domain rules corroborative, coverage-only and structurally separated", () => {
        const rule = artifacts.coverage.corroborativeDomainRules[0];
        equal(rule.ruleId, "k56-conditional-domain-rule-v1");
        equal(rule.provenance, "user_confirmed_domain_rule");
        equal(rule.communityCorroboration, "user_reported_not_independently_source_bound");
        equal(rule.firstPartyRuntimeDeckIndexEvidence, false);
        equal(rule.usedToAuthorizeSupportedProjection, false);
        equal(rule.appliesToExcludedConditionalEffectsOnly, true);
        deepStrictEqual(rule.elementTypeDomain, ["agl", "teq", "int", "str", "phy"]);
        deepStrictEqual(rule.battleClassDomain, ["super", "extreme", "none"]);
        deepStrictEqual(rule.awakeningState, {
            source: "selected_card_state", preZBattleClass: "none", postZBattleClass: "acquired_after_z_awakening",
        });
        deepStrictEqual(rule.condition, {
            scope: "team_including_friend", ownUnitSlots: 6, friendUnitSlots: 1, effectTarget: "eligible_matching_units",
            currentElementTypeRequired: true, currentBattleClassRequired: true,
        });
        deepStrictEqual(rule.friend, { conditionParticipation: "may_satisfy_condition", effectReceipt: "only_if_effect_target_matches" });
        deepStrictEqual(rule.passiveCrossScope, { allFiveElementTypesScope: "team_including_friend", authority: "corroborative_only" });
        deepStrictEqual(rule.dualSuperExtremeClause, {
            proofComposition: "separate_required_proofs",
            requiredProofs: ["super_class_presence", "extreme_class_presence", "all_five_element_types"],
        });
        equal(artifacts.coverage.excluded.every(item => item.corroborativeRule.ruleId === rule.ruleId
            && item.corroborativeRule.provenance === "user_confirmed_domain_rule"
            && item.corroborativeRule.usedToAuthorizeSupportedProjection === false), true);
        equal(JSON.stringify(artifacts.dataset).includes(rule.ruleId), false);
        const authorizationDrift: any = JSON.parse(JSON.stringify(artifacts.coverage));
        authorizationDrift.corroborativeDomainRules[0].usedToAuthorizeSupportedProjection = true;
        const validation = validateCharacterLeaderSupportedProjection(artifacts.dataset, authorizationDrift);
        equal(validation.valid, false);
        equal(validation.failures.includes("coverage pin changed"), true);
        const exclusionIdDrift: any = JSON.parse(JSON.stringify(artifacts.coverage));
        exclusionIdDrift.excluded[0].effectRowId = "5267";
        equal(validateCharacterLeaderSupportedProjection(artifacts.dataset, exclusionIdDrift).valid, false);
    });

    it("keeps shadow parity cardId-only with no false conflict or authority", () => {
        const parity = artifacts.coverage.shadowParity;
        equal(parity.comparisonMode, "card_id_only_no_value_authority");
        equal(parity.cardIdCoverage.productiveJoinedCardIds, 1);
        equal(parity.comparableValueReferences, 0);
        equal(parity.representationMismatchComparableReferences, 0);
        equal(parity.confirmedConflictComparableValues, 0);
        equal(parity.zeroConflictIsCompleteness, false);
        equal(parity.authoritySelected, false);
        equal(parity.unknownValueReferences, 12265);
        deepStrictEqual(artifacts.coverage.unjoinable, { scope: "productive_card_id", distinctCardIds: 0, references: 0 });
        equal(artifacts.dataset.policy.characterArrayIncluded, false);
        equal(artifacts.dataset.policy.patchOrApplyImplemented, false);
    });

    it("is canonical and byte-deterministic while public validation leaves source-bound GO NOT_EXECUTED", () => {
        const second = materializeCharacterLeaderSupportedProjection(artifacts.dataset, artifacts.coverage);
        equal(second.raw.equals(artifacts.raw), true);
        equal(second.gzip.equals(artifacts.gzip), true);
        equal(second.coverageBytes.equals(artifacts.coverageBytes), true);
        equal(second.validationBytes.equals(artifacts.validationBytes), true);
        equal(second.manifestBytes.equals(artifacts.manifestBytes), true);
        equal(artifacts.validation.readiness.offlineSupportedOnlyProjection, "GO");
        equal(artifacts.validation.readiness.sourceBoundValidation, "NOT_EXECUTED");
        equal(artifacts.validation.readiness.localShadowAuditDefaultOff, "NOT_EXECUTED");
        equal(artifacts.dataset.policy.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        equal(artifacts.dataset.policy.concurrentSameUserAncestorReplacementProtected, false);
        equal(artifacts.validation.safety.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        equal(artifacts.validation.safety.concurrentSameUserAncestorReplacementProtected, false);
        equal(artifacts.validation.readiness.concurrentOutputAncestorReplacement, "NO-GO");
        equal(artifacts.manifest.outputNamespaceThreatModel, "caller_controlled_stable_during_operation");
        equal(artifacts.manifest.concurrentSameUserAncestorReplacementProtected, false);
        equal(artifacts.raw.length < 16 * 1024 * 1024, true);
        equal(artifacts.gzip.length < 2 * 1024 * 1024, true);
        equal(artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length < 64 * 1024, true);
        assertCharacterLeaderSupportedProjectionArtifactBytes(second, artifacts);
        const drifted = { ...second, gzip: Buffer.from(second.gzip) };
        drifted.gzip[0] ^= 1;
        throws(() => assertCharacterLeaderSupportedProjectionArtifactBytes(drifted, artifacts), /source-bound artifact mismatch: payload/);
        const validatorSource = validateCharacterLeaderSupportedProjectionArtifact.toString();
        equal(validatorSource.includes("runCharacterLeaderK55Subprocess"), true);
        equal(validatorSource.includes("options.upstreamK55"), false);
    });

    it("rejects linked roots, aliasing, hardlink/create-only collisions and writes manifest last", async () => {
        const base = resolve(".agent-logs", `k56-safety-${process.pid}`);
        await rm(base, { recursive: true, force: true });
        const names = ["sidecar", "production", "fyi", "k43", "k46", "k48", "output"];
        for (const name of names) await mkdir(join(base, name), { recursive: true });
        const native = join(base, "native.so"), database = join(base, "database.db");
        await writeFile(native, "n"); await writeFile(database, "d");
        const common = {
            sidecarRoot: join(base, "sidecar"), productionRoot: join(base, "production"), fyiRoot: join(base, "fyi"),
            k43Root: join(base, "k43"), k46Root: join(base, "k46"), k48Root: join(base, "k48"),
            outputRoot: join(base, "output"), nativeRuntime: native, database,
        };
        try {
            await validateCharacterLeaderSupportedProjectionRootSeparation(common);
            await rejects(() => validateCharacterLeaderSupportedProjectionRootSeparation({ ...common, outputRoot: common.k48Root }), /must not alias/);
            const linked = join(base, "linked-output");
            try {
                await symlink(common.outputRoot, linked, process.platform === "win32" ? "junction" : "dir");
                await rejects(() => validateCharacterLeaderSupportedProjectionOutputRoot(linked), /non-link directory|symlink or junction rejected/);
            } catch (error: any) { if (!["EPERM", "EACCES"].includes(error?.code)) throw error; }
            const collision = join(common.outputRoot, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage);
            await link(native, collision);
            await rejects(() => writeCharacterLeaderSupportedProjectionArtifacts(common.outputRoot, artifacts), /output already exists/);
            await rm(collision);
            await writeCharacterLeaderSupportedProjectionArtifacts(common.outputRoot, artifacts);
            equal((await lstat(join(common.outputRoot, CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest))).nlink, 1);
            await rejects(() => writeCharacterLeaderSupportedProjectionArtifacts(common.outputRoot, artifacts), /output already exists/);
            equal(existsSync(join(common.outputRoot, artifacts.manifest.fileName)), true);
        } finally { await rm(base, { recursive: true, force: true }); }
    });
});
