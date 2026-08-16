import { deepStrictEqual, equal, throws } from "assert";
import {
    CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN,
    CharacterLeaderCausalityCollectionNativeProof,
} from "./leader-causality-collection-contract";
import { parseCharacterLeaderCausalityCollectionCli } from "./leader-causality-collection-run";
import { assertLeaderCausalityCollectionNativeStable } from "./leader-causality-collection-source";
import {
    assertConservativeK52ForCollection,
    assertPinnedCharacterLeaderCausalityCollection,
    buildCharacterLeaderCausalityCollectionReport,
} from "./leader-causality-collection";

const args = [
    "--opt-in-k53", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];

function upstreamK52(): any {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-causality-semantics-audit",
        contractVersion: "1.0.0",
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: {}, scope: {}, semantics: {},
        policy: {
            structuralConditionEvidenceOnly: true, k3OmissionDisclosed: true, sqliteSeparatelyBoundToExactFirstPartySnapshot: true,
            sourceTextReadForIdentityOrJoin: false, sourceTextIncluded: false, humanBitNamesDerived: false,
            partySelectionContextDerived: false, lifecycleDerived: false, stackingDerived: false, payloadWritten: false,
            authoritySelected: false, productionModified: false, networkEnabled: false, r2Enabled: false,
            androidImplemented: false,
        },
        inputIntegrity: {
            k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48K3DatabaseAndNativeStable: true,
            databaseDescriptorBoundReadOnly: true, rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            leaderCausalityStructuralSemantics: "GO", type35StructuralCondition: "GO",
            humanBitNames: "NO-GO", partySelectionContext: "NO-GO", lifecycle: "NO-GO", stacking: "NO-GO",
            productProjection: "NO-GO", authority: "NO-GO", production: "NO-GO", writer: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
}

function nativeProof(): CharacterLeaderCausalityCollectionNativeProof {
    const pin = CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN;
    return {
        elfSha256: pin.nativeSha256,
        elfSizeBytes: pin.nativeSizeBytes,
        evidenceSha256: pin.nativeEvidenceSha256,
        evidenceSizeBytes: pin.nativeEvidenceSizeBytes,
        codeRegionCount: pin.nativeCodeRegions,
        instructionFragmentCount: pin.nativeInstructionFragments,
        exactCallCount: pin.nativeExactCalls,
        vtableCount: pin.nativeVtables,
        vtableBindingCount: pin.nativeVtableBindings,
        deckIndexVirtualDispatchBound: true,
        deckIndex0SevenPlayerRecordsBound: true,
        deckIndex1PuzzleEnemyVectorBound: true,
        deckIndex1EmptyFailsBound: true,
        otherDeckIndicesSupported: false,
        playerRuntimeUserCardOffsetBound: true,
        masterCardResolutionBound: true,
        cardElementGettersBound: true,
        elementBitPatternCallBound: true,
        onlyCauVal1Read: true,
        explicitAliveActiveCategoryOrTargetFilterFound: false,
        effectiveLeaderBranchBound: false,
        humanElementNamesBound: false,
        lifecycleBound: false,
        deathOrRemovalBound: false,
        stackingBound: false,
        productAuthorityBound: false,
    };
}

describe("K53 leader causality candidate collection", () => {
    it("parses exactly one opt-in, every explicit path and no loose or duplicate arguments", () => {
        const parsed = parseCharacterLeaderCausalityCollectionCli(args);
        equal(parsed.database, "db");
        equal(parsed.nativeRuntime, "elf");
        throws(() => parseCharacterLeaderCausalityCollectionCli(args.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderCausalityCollectionCli([...args, "loose"]), /unsupported argument/);
        throws(() => parseCharacterLeaderCausalityCollectionCli([...args, "--database", "again"]), /duplicate --database/);
        throws(() => parseCharacterLeaderCausalityCollectionCli(args.slice(0, -1)), /missing value/);
        throws(() => parseCharacterLeaderCausalityCollectionCli([...args, "--opt-in-k53"]), /exactly one/);
    });

    it("requires the real K52 GO boundary while retaining every conservative K52 NO-GO", () => {
        const upstream = upstreamK52();
        assertConservativeK52ForCollection(upstream);
        const promoted = JSON.parse(JSON.stringify(upstream));
        promoted.readiness.partySelectionContext = "GO";
        throws(() => assertConservativeK52ForCollection(promoted), /conservative K52 partySelectionContext NO-GO/);
        const unbound = JSON.parse(JSON.stringify(upstream));
        unbound.inputIntegrity.databaseDescriptorBoundReadOnly = false;
        throws(() => assertConservativeK52ForCollection(unbound), /integrity or conservative policy changed/);
    });

    it("accepts only the exact pinned native proof and detects proof drift", () => {
        const upstream = upstreamK52(), native = nativeProof();
        assertPinnedCharacterLeaderCausalityCollection(upstream, native);
        assertLeaderCausalityCollectionNativeStable(native, { ...native });
        throws(() => assertPinnedCharacterLeaderCausalityCollection(upstream, { ...native, exactCallCount: 5 }), /does not match pin/);
        throws(() => assertLeaderCausalityCollectionNativeStable(native, { ...native, evidenceSha256: "drift" }), /evidence changed/);
    });

    it("keeps the public report factory non-authoritative, bounded and structural", () => {
        const report = buildCharacterLeaderCausalityCollectionReport(upstreamK52(), nativeProof());
        equal(report.readiness.leaderCausalityCandidateCollection, "NOT_EXECUTED");
        equal(report.readiness.deckIndex0And1StructuralCollection, "NOT_EXECUTED");
        equal(report.readiness.effectiveLeaderRuntimeBranch, "NO-GO");
        equal(report.readiness.lifecycle, "NO-GO");
        equal(report.readiness.deathOrRemoval, "NO-GO");
        equal(report.readiness.stacking, "NO-GO");
        equal(report.readiness.authority, "NO-GO");
        equal(report.policy.effectiveLeaderBranchSelected, false);
        equal(report.policy.sourceTextIncluded, false);
        equal(report.inputIntegrity.k52RealAudit, "NOT_EXECUTED");
        equal(Buffer.byteLength(`${JSON.stringify(report)}\n`) < 64 * 1024, true);
    });

    it("pins only deck indices zero and one plus the exact runtime collection offsets", () => {
        deepStrictEqual(CHARACTER_LEADER_CAUSALITY_COLLECTION_PIN.supportedDeckIndices, [0, 1]);
        const report = buildCharacterLeaderCausalityCollectionReport(upstreamK52(), nativeProof());
        deepStrictEqual(report.offsets, {
            playerCandidateStrideBytes: 0x590,
            playerUserCardReferenceOffsetBytes: 0xa0,
            puzzleEnemyVectorBeginOffsetBytes: 0x100,
            puzzleEnemyVectorEndOffsetBytes: 0x108,
            puzzleEnemyVectorElementSizeBytes: 8,
        });
        equal(report.semantics.otherDeckIndices, "unsupported");
        equal(report.sources.native.explicitAliveActiveCategoryOrTargetFilterFound, false);
        equal(report.sources.native.humanElementNamesBound, false);
    });
});
