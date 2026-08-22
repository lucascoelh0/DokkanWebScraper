"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_supported_compatibility_golden_1 = require("./leader-supported-compatibility-golden");
const leader_supported_compatibility_git_source_1 = require("./leader-supported-compatibility-git-source");
const leader_supported_compatibility_1 = require("./leader-supported-compatibility");
const leader_supported_compatibility_source_1 = require("./leader-supported-compatibility-source");
const leader_supported_compatibility_run_1 = require("./leader-supported-compatibility-run");
const sha256 = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
function pinnedAndroidIdentity() {
    const value = {
        repositoryUrl: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN.repositoryUrl,
        commit: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN.commit,
        access: "git_object_database_only",
        checkoutBytesRead: false,
        files: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN.files.map(file => ({ ...file })),
    };
    return { ...value, fingerprintSha256: sha256(JSON.stringify(value)) };
}
function fixture() {
    const effects = Array.from({ length: 3836 }, (_, index) => ({
        effectRowId: String(index + 1), referenceCount: index === 0 ? 8430 : 1,
        classification: "additive_contract_required",
        reason: "lossless_supported_shadow_requires_separate_additive_contract",
    }));
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-compatibility-audit", contractVersion: "1.2.0", checkpoint: "K62.1",
        mode: "explicit_opt_in_offline_default_off_non_authoritative",
        lineage: {
            k56: { source: {}, fullArtifactFingerprintSha256: "a".repeat(64), lineageFingerprintSha256: "b".repeat(64), sourceBoundViaK58: "GO" },
            sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY", transientABADriftDetection: "NO-GO",
        },
        inventory: { effects: 3836, references: 12265, states: 7248, cards: 3434, publicIndexes: 4, excludedEffects: 17, excludedReferences: 45, excludedReason: "runtime_deck_index_unresolved" },
        comparison: {
            productiveCharacterDataset: {
                joinableReferences: 8893, unjoinableReferences: 3372, identityAgreementReferences: 8893,
                representationGainReferences: 8893, representationMismatchReferences: 0, comparableValueReferences: 0,
                confirmedConflictReferences: 0, unknownValueReferences: 12265, zeroConflictIsCompleteness: false,
                distinctJoinableCards: 2265, distinctUnjoinableCards: 1169, textBaselinePresentReferences: 8893,
                structuredLeaderDetailsPresentReferences: 0, identityOnlyNoTextAuthority: true,
            },
            scraperLeaderContract: {}, teamAnalysisContract: {}, android: {
                source: pinnedAndroidIdentity(),
                wireAndDomainSourceFingerprintSha256: pinnedAndroidIdentity().fingerprintSha256,
            },
        },
        dimensionMatrix: leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_DIMENSION_GOLDEN.map(item => ({ ...item })),
        effectCompatibility: { counts: { directly_representable: 0, additive_contract_required: 3836, current_model_lossy: 0, runtime_context_required: 0, blocked_unknown: 0 }, effects },
        k63Proposal: { replacesEffectiveValues: false, existingFallback: "byte_and_semantically_identical", modifiesUi: false, modifiesCharacterEntity: false },
        boundaries: { conditional17Included: false, deckIndex: "unknown", leaderFriendComposition: "unknown", finalStacking: "unknown", finalRounding: "unknown", transformationsDeathReviveExchangeStandby: "unknown", combatCalculation: "NOT_EXECUTED", runtimeInstrumentation: "NOT_EXECUTED", newTextParsing: "NOT_EXECUTED", networkRequestCount: 0, authenticatedRequestCount: 0, r2MutationCount: 0, publisherExecuted: false, authoritySelected: false, androidModified: false, androidSourceBytesReadFromGitObjectDatabaseOnly: true, androidCheckoutBytesRead: false, androidSourceCanAuthorizeMaterializedBytes: false },
        readiness: { lineageK56ThroughK61: "GO", processTreeRssUnder1GiB: "NOT_EXECUTED" },
    };
}
function syntheticAndroidPin(bytes) {
    return {
        repositoryUrl: "https://example.test/android.git",
        commit: "a".repeat(40),
        files: [{
                path: "domain/src/main/java/example/Source.kt",
                blobId: "b".repeat(40),
                sizeBytes: bytes.length,
                sha256: sha256(bytes),
            }],
    };
}
function syntheticSourceReceipt(marker) {
    const androidBody = {
        repositoryUrl: "https://example.test/android.git", commit: "a".repeat(40), access: "git_object_database_only",
        checkoutBytesRead: false, files: [],
    };
    const body = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-source-receipt",
        roots: [{ role: "K58 artifacts", path: "root", realPath: "root", dev: 1, ino: 2, entries: [] }],
        files: [{ role: "K55 database", path: "db", realPath: "db", dev: 1, ino: 3, sizeBytes: 1, sha256: marker.repeat(64) }],
        android: { ...androidBody, fingerprintSha256: sha256(JSON.stringify(androidBody)) },
    };
    return { ...body, fingerprintSha256: sha256(JSON.stringify(body)) };
}
function fakeGitExecutor(root, pin, bytes, mutate) {
    return {
        async run(command) {
            assert_1.strict.equal(command.repository, root);
            (0, assert_1.strict)(!command.args.includes("checkout"));
            (0, assert_1.strict)(!command.args.includes("show"));
            const source = pin.files[0];
            let output;
            switch (command.label) {
                case "repository root":
                    assert_1.strict.deepEqual(command.args, ["rev-parse", "--show-toplevel"]);
                    output = Buffer.from(`${root}\n`, "utf8");
                    break;
                case "repository URL":
                    assert_1.strict.deepEqual(command.args, ["config", "--get", "remote.origin.url"]);
                    output = Buffer.from(`${pin.repositoryUrl}\n`, "utf8");
                    break;
                case "commit":
                    assert_1.strict.deepEqual(command.args, ["rev-parse", "--verify", "--end-of-options", pin.commit]);
                    output = Buffer.from(`${pin.commit}\n`, "utf8");
                    break;
                case "commit lineage":
                    assert_1.strict.deepEqual(command.args, ["rev-parse", "--verify", "--end-of-options", `${pin.commit}^{commit}`]);
                    output = Buffer.from(`${pin.commit}\n`, "utf8");
                    break;
                case `tree entry ${source.path}`:
                    assert_1.strict.deepEqual(command.args, ["ls-tree", "-z", pin.commit, "--", source.path]);
                    output = Buffer.from(`100644 blob ${source.blobId}\t${source.path}\0`, "utf8");
                    break;
                case `blob type ${source.path}`:
                    assert_1.strict.deepEqual(command.args, ["cat-file", "-t", source.blobId]);
                    output = Buffer.from("blob\n", "utf8");
                    break;
                case `blob size ${source.path}`:
                    assert_1.strict.deepEqual(command.args, ["cat-file", "-s", source.blobId]);
                    output = Buffer.from(`${source.sizeBytes}\n`, "utf8");
                    break;
                case `blob bytes ${source.path}`:
                    assert_1.strict.deepEqual(command.args, ["cat-file", "blob", source.blobId]);
                    output = Buffer.from(bytes);
                    break;
                default:
                    throw new Error(`unexpected Git command: ${command.label}`);
            }
            (0, assert_1.strict)(output.length < command.maximumStdoutBytesExclusive);
            const mutated = mutate?.(command, output);
            return mutated ?? output;
        },
    };
}
describe("K62 supported leader compatibility", () => {
    it("captures the immutable receipt, collects garbage, then starts the single heavy validator", async () => {
        const events = [];
        const options = {
            sidecarRoot: "sidecar", productionRoot: "production", fyiRoot: "fyi",
            k43Root: "k43", k46Root: "k46", k48Root: "k48", nativeRuntime: "native", database: "database",
            k56Root: "k56", k58Root: "k58",
        };
        const android = pinnedAndroidIdentity();
        const sourceReceipt = syntheticSourceReceipt("a");
        const validatedK58 = { sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: 123 };
        const result = await (0, leader_supported_compatibility_source_1.captureCharacterLeaderSupportedCompatibilityReceiptBeforeHeavyValidation)(options, android, {
            captureReceipt: (async (receivedOptions, receivedAndroid) => {
                assert_1.strict.equal(receivedOptions, options);
                assert_1.strict.equal(receivedAndroid, android);
                events.push("receipt");
                return sourceReceipt;
            }),
            collectGarbage: () => events.push("gc"),
            validateK58: (async (received) => {
                assert_1.strict.equal(received.artifactRoot, options.k58Root);
                assert_1.strict.equal(received.k56Root, options.k56Root);
                events.push("heavy-validator");
                return validatedK58;
            }),
        });
        assert_1.strict.deepEqual(events, ["receipt", "gc", "heavy-validator"]);
        assert_1.strict.equal(result.sourceReceipt, sourceReceipt);
        assert_1.strict.equal(result.validatedK58, validatedK58);
    });
    it("finishes the single heavy load and double generation before GC and post-write receipt validation", async () => {
        const events = [];
        const options = { outputRoot: "unused-output-root" };
        const sourceReceipt = syntheticSourceReceipt("a");
        const artifacts = () => ({
            gzip: Buffer.from("payload"),
            coverageBytes: Buffer.from("coverage"),
            validationBytes: Buffer.from("validation"),
            manifestBytes: Buffer.from("manifest"),
            validation: { valid: true, failures: [] },
        });
        const validated = { sourceBoundReconstruction: "GO", sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY" };
        const result = await (0, leader_supported_compatibility_run_1.runCharacterLeaderSupportedCompatibilityLifecycle)(options, {
            firstPass: async () => {
                events.push("first-pass:start");
                const firstPass = await (0, leader_supported_compatibility_run_1.runCharacterLeaderSupportedCompatibilityFirstPass)(options, {
                    load: (async () => {
                        events.push("load");
                        return { inputs: { marker: "loaded" }, k55ValidationProcessPeakRssBytes: 123, sourceReceipt };
                    }),
                    buildReport: ((inputs) => {
                        assert_1.strict.equal(inputs.marker, "loaded");
                        events.push("build");
                        return { marker: "report" };
                    }),
                    materialize: ((report) => {
                        assert_1.strict.equal(report.marker, "report");
                        events.push("materialize");
                        return artifacts();
                    }),
                    write: (async (outputRoot) => {
                        assert_1.strict.equal(outputRoot, options.outputRoot);
                        events.push("write");
                    }),
                });
                events.push("first-pass:end");
                return firstPass;
            },
            collectGarbage: () => events.push("gc"),
            validate: (async (_options, expected, receipt) => {
                assert_1.strict.equal(receipt, sourceReceipt);
                assert_1.strict.equal(expected.gzip.toString(), "payload");
                assert_1.strict.equal(expected.coverageBytes.toString(), "coverage");
                assert_1.strict.equal(expected.validationBytes.toString(), "validation");
                assert_1.strict.equal(expected.manifestBytes.toString(), "manifest");
                events.push("post-write-validation");
                return validated;
            }),
        });
        assert_1.strict.deepEqual(events, [
            "first-pass:start", "load", "build", "materialize", "build", "materialize", "write",
            "first-pass:end", "gc", "post-write-validation",
        ]);
        assert_1.strict.equal(result.initialChildPeak, 123);
        assert_1.strict.equal(result.validated, validated);
    });
    it("compares all four persisted members and rejects source receipt drift", () => {
        const expected = {
            gzip: Buffer.from("payload"), coverageBytes: Buffer.from("coverage"),
            validationBytes: Buffer.from("validation"), manifestBytes: Buffer.from("manifest"),
        };
        assert_1.strict.doesNotThrow(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilityPersistedBytes)(expected, expected));
        const cases = [
            ["gzip", "payload"], ["coverageBytes", "coverage"],
            ["validationBytes", "validation"], ["manifestBytes", "manifest"],
        ];
        for (const [member, label] of cases) {
            assert_1.strict.throws(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilityPersistedBytes)({ ...expected, [member]: Buffer.from("drift") }, expected), new RegExp(label));
        }
        const before = syntheticSourceReceipt("a");
        assert_1.strict.doesNotThrow(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilitySourceReceiptStable)(before, before));
        assert_1.strict.throws(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilitySourceReceiptStable)(before, syntheticSourceReceipt("c")), /persistent source identity drifted after write/);
    });
    it("rejects output overlap with every receipt source class", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k621-separation-"));
        try {
            const directoryNames = ["output", "k56", "k58", "sidecar", "production", "fyi", "k43", "k46", "k48", "scraper", "android"];
            const directories = Object.fromEntries(directoryNames.map(name => [name, (0, path_1.join)(root, name)]));
            await Promise.all(Object.values(directories).map(path => (0, promises_1.mkdir)(path)));
            const sourceDirectory = (0, path_1.join)(root, "files");
            await (0, promises_1.mkdir)(sourceDirectory);
            const sourceFile = async (name) => {
                const path = (0, path_1.join)(sourceDirectory, name);
                await (0, promises_1.writeFile)(path, name);
                return path;
            };
            const options = {
                outputRoot: directories.output, k56Root: directories.k56, k58Root: directories.k58,
                sidecarRoot: directories.sidecar, productionRoot: directories.production, fyiRoot: directories.fyi,
                k43Root: directories.k43, k46Root: directories.k46, k48Root: directories.k48,
                scraperRoot: directories.scraper, androidRepository: directories.android,
                k57Report: await sourceFile("k57.json"), k59Report: await sourceFile("k59.json"),
                k60Report: await sourceFile("k60.json"), k60Receipt: await sourceFile("k60-receipt.json"),
                k61Report: await sourceFile("k61.json"), productiveCharacters: await sourceFile("characters.json"),
                nativeRuntime: await sourceFile("native.so"), database: await sourceFile("database.db"),
            };
            await assert_1.strict.doesNotReject((0, leader_supported_compatibility_source_1.validateCharacterLeaderSupportedCompatibilityRootSeparation)(options));
            const receiptRoots = [
                ["k56Root", "K56"], ["k58Root", "K58"], ["sidecarRoot", "K55 sidecar"],
                ["productionRoot", "K55 production"], ["fyiRoot", "K55 FYI"], ["k43Root", "K55 K43"],
                ["k46Root", "K55 K46"], ["k48Root", "K55 K48"], ["scraperRoot", "scraper"],
                ["androidRepository", "Android repository"],
            ];
            for (const [field, label] of receiptRoots) {
                await assert_1.strict.rejects((0, leader_supported_compatibility_source_1.validateCharacterLeaderSupportedCompatibilityRootSeparation)({ ...options, outputRoot: options[field] }), new RegExp(`${label} root`, "i"));
            }
            const sourceFiles = [
                ["k57Report", "K57 report"], ["k59Report", "K59 report"], ["k60Report", "K60 report"],
                ["k60Receipt", "K60 receipt"], ["k61Report", "K61 report"],
                ["productiveCharacters", "productive Character"], ["nativeRuntime", "K55 native runtime"],
                ["database", "K55 database"],
            ];
            for (const [field, label] of sourceFiles) {
                const overlapping = (0, path_1.join)(directories.output, `${field}.source`);
                await (0, promises_1.writeFile)(overlapping, field);
                await assert_1.strict.rejects((0, leader_supported_compatibility_source_1.validateCharacterLeaderSupportedCompatibilityRootSeparation)({ ...options, [field]: overlapping }), new RegExp(`${label}.*source file`, "i"));
            }
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("rejects a selected scraper pin whose linked ancestor resolves outside the canonical root", () => {
        const canonicalRoot = (0, path_1.resolve)((0, path_1.join)((0, os_1.tmpdir)(), "k621-scraper-root"));
        assert_1.strict.doesNotThrow(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest)(canonicalRoot, "nested/pin.ts", (0, path_1.join)(canonicalRoot, "nested", "pin.ts")));
        assert_1.strict.throws(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest)(canonicalRoot, "linked/pin.ts", (0, path_1.resolve)((0, path_1.join)(canonicalRoot, "..", "outside", "pin.ts"))), /escaped canonical root/);
        assert_1.strict.throws(() => (0, leader_supported_compatibility_source_1.assertCharacterLeaderSupportedCompatibilitySelectedPinWithinRootForTest)(canonicalRoot, "nested/../pin.ts", (0, path_1.join)(canonicalRoot, "pin.ts")), /escaped canonical root/);
    });
    it("ignores more than ten thousand unrelated production files but detects consumed-member drift", async function () {
        this.timeout(15000);
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k621-selected-production-"));
        try {
            const consumed = (0, path_1.join)(root, "characters.json");
            await (0, promises_1.writeFile)(consumed, "pinned-consumed-bytes");
            const unrelatedCount = 10001;
            for (let offset = 0; offset < unrelatedCount; offset += 250) {
                await Promise.all(Array.from({ length: Math.min(250, unrelatedCount - offset) }, (_, index) => (0, promises_1.writeFile)((0, path_1.join)(root, `unrelated-${String(offset + index).padStart(5, "0")}.tmp`), "x")));
            }
            const before = await (0, leader_supported_compatibility_source_1.captureCharacterLeaderSupportedCompatibilitySelectedRootForTest)(root, "K55 production inputs", ["characters.json"]);
            const afterUnrelatedInventory = await (0, leader_supported_compatibility_source_1.captureCharacterLeaderSupportedCompatibilitySelectedRootForTest)(root, "K55 production inputs", ["characters.json"]);
            assert_1.strict.deepEqual(afterUnrelatedInventory, before);
            assert_1.strict.deepEqual(before.entries.map(entry => entry.relativePath), ["characters.json"]);
            await (0, promises_1.writeFile)(consumed, "drifted-consumed-bytes");
            const afterConsumedDrift = await (0, leader_supported_compatibility_source_1.captureCharacterLeaderSupportedCompatibilitySelectedRootForTest)(root, "K55 production inputs", ["characters.json"]);
            assert_1.strict.notDeepEqual(afterConsumedDrift, before);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("materializes byte-identically and reconstructs losslessly", () => {
        const first = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
        const second = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
        (0, assert_1.strict)(first.raw.equals(second.raw));
        (0, assert_1.strict)(first.gzip.equals(second.gzip));
        (0, assert_1.strict)(first.coverageBytes.equals(second.coverageBytes));
        (0, assert_1.strict)(first.validationBytes.equals(second.validationBytes));
        (0, assert_1.strict)(first.manifestBytes.equals(second.manifestBytes));
        (0, assert_1.strict)((0, zlib_1.gunzipSync)(first.gzip).equals(first.raw));
        assert_1.strict.equal(first.validation.valid, true);
    });
    it("rejects dimension and effect classification mutations", () => {
        const dimension = fixture();
        dimension.dimensionMatrix[0].classification = "directly_representable";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(dimension).includes("dimension matrix changed"));
        const effect = fixture();
        effect.effectCompatibility.effects.pop();
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(effect).includes("effect classification changed"));
    });
    it("rejects forbidden execution, completeness and text identity mutations", () => {
        const execution = fixture();
        execution.boundaries.networkRequestCount = 1;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(execution).includes("forbidden boundary changed"));
        const completeness = fixture();
        completeness.comparison.productiveCharacterDataset.zeroConflictIsCompleteness = true;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(completeness).includes("zero-conflict completeness boundary changed"));
        const text = fixture();
        text.identity = { title: "forbidden" };
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(text).includes("text or presentation entered K62 identity report"));
        const runtime = fixture();
        runtime.boundaries.finalRounding = false;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(runtime).includes("runtime unknown boundary changed"));
        const android = fixture();
        android.comparison.android.source.repositoryUrl = "https://example.test/wrong.git";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(android).includes("Android Git object source provenance changed"));
        const authority = fixture();
        authority.boundaries.androidSourceCanAuthorizeMaterializedBytes = true;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(authority).includes("Android source authority boundary changed"));
        const rss = fixture();
        rss.readiness.processTreeRssUnder1GiB = "GO";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(rss).includes("process-tree RSS requires external execution evidence"));
        const overclaim = fixture();
        overclaim.lineage.stableAcrossAudit = true;
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(overclaim).includes("source stability overclaim"));
        const immutable = fixture();
        immutable.lineage.sourceStability = "IMMUTABLE_ACROSS_AUDIT";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(immutable).includes("source stability overclaim"));
        const abaOverclaim = fixture();
        abaOverclaim.lineage.transientABADriftDetection = "GO";
        (0, assert_1.strict)((0, leader_supported_compatibility_1.validateCharacterLeaderSupportedCompatibilityReport)(abaOverclaim).includes("source stability overclaim"));
    });
    it("keeps source pins relative and the K63 proposal absent-compatible", () => {
        for (const [path] of leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_SOURCE_PINS.scraper) {
            (0, assert_1.strict)(!path.includes(":"));
            (0, assert_1.strict)(!path.startsWith("/"));
        }
        for (const source of leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN.files) {
            (0, assert_1.strict)(!source.path.includes(":"));
            (0, assert_1.strict)(!source.path.startsWith("/"));
        }
        const value = fixture();
        assert_1.strict.equal(value.k63Proposal.existingFallback, "byte_and_semantically_identical");
        assert_1.strict.equal(value.k63Proposal.replacesEffectiveValues, false);
    });
    it("reads pinned Android bytes only from a mocked Git object database", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k621-android-git-"));
        try {
            const bytes = Buffer.from("object database bytes", "utf8");
            const pin = syntheticAndroidPin(bytes);
            const checkoutPath = (0, path_1.join)(root, pin.files[0].path);
            await (0, promises_1.mkdir)((0, path_1.dirname)(checkoutPath), { recursive: true });
            await (0, promises_1.writeFile)(checkoutPath, "different untrusted checkout bytes");
            const executor = fakeGitExecutor(root, pin, bytes);
            const identity = await (0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest)(root, executor, pin);
            assert_1.strict.equal(identity.repositoryUrl, pin.repositoryUrl);
            assert_1.strict.equal(identity.commit, pin.commit);
            assert_1.strict.equal(identity.checkoutBytesRead, false);
            assert_1.strict.equal(identity.access, "git_object_database_only");
            assert_1.strict.deepEqual(identity.files, pin.files);
            (0, assert_1.strict)(!JSON.stringify(identity).includes("object database bytes"));
            (0, assert_1.strict)(!JSON.stringify(identity).includes("different untrusted checkout bytes"));
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("disables lazy object fetch after removing ambient Git overrides", () => {
        const environment = (0, leader_supported_compatibility_git_source_1.characterLeaderSupportedCompatibilityGitEnvironmentForTest)({
            PATH: "fixed-path",
            GIT_DIR: "untrusted-git-dir",
            git_object_directory: "untrusted-object-directory",
            GIT_NO_LAZY_FETCH: "0",
            GIT_OPTIONAL_LOCKS: "1",
        });
        assert_1.strict.equal(environment.PATH, "fixed-path");
        assert_1.strict.equal(environment.GIT_NO_LAZY_FETCH, "1");
        assert_1.strict.equal(environment.GIT_OPTIONAL_LOCKS, "0");
        assert_1.strict.equal(environment.LC_ALL, "C");
        assert_1.strict.equal(environment.GIT_DIR, undefined);
        assert_1.strict.equal(environment.git_object_directory, undefined);
    });
    it("fails closed on Android Git repository lineage and object divergence", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k621-android-git-failure-"));
        try {
            const bytes = Buffer.from("object database bytes", "utf8");
            const pin = syntheticAndroidPin(bytes);
            const cases = [
                ["repository", (command, output) => command.label === "repository root" ? Buffer.from(`${(0, path_1.join)(root, "other")}\n`) : output],
                ["URL", (command, output) => command.label === "repository URL" ? Buffer.from("https://example.test/wrong.git\n") : output],
                ["commit", (command, output) => command.label === "commit" ? Buffer.from(`${"f".repeat(40)}\n`) : output],
                ["lineage", (command, output) => command.label === "commit lineage" ? Buffer.from(`${"e".repeat(40)}\n`) : output],
                ["path", (command, output) => command.label.startsWith("tree entry") ? Buffer.alloc(0) : output],
                ["blob", (command, output) => command.label.startsWith("tree entry") ? Buffer.from(`100644 blob ${"d".repeat(40)}\t${pin.files[0].path}\0`) : output],
                ["type", (command, output) => command.label.startsWith("blob type") ? Buffer.from("tree\n") : output],
                ["size", (command, output) => command.label.startsWith("blob size") ? Buffer.from(`${bytes.length + 1}\n`) : output],
                ["bytes", (command, output) => command.label.startsWith("blob bytes") ? Buffer.alloc(bytes.length, 0) : output],
            ];
            for (const [label, mutate] of cases) {
                await assert_1.strict.rejects((0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest)(root, fakeGitExecutor(root, pin, bytes, mutate), pin), new RegExp(label, "i"));
            }
            const missingCommit = fakeGitExecutor(root, pin, bytes, command => {
                if (command.label === "commit")
                    throw new Error("missing commit");
                return undefined;
            });
            await assert_1.strict.rejects((0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest)(root, missingCommit, pin), /missing commit/);
            const missingPromisorObject = fakeGitExecutor(root, pin, bytes, command => {
                if (command.label.startsWith("blob bytes"))
                    throw new Error("missing promisor object");
                return undefined;
            });
            await assert_1.strict.rejects((0, leader_supported_compatibility_git_source_1.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest)(root, missingPromisorObject, pin), /missing promisor object/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    it("writes create-only with manifest last and rejects tampering", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k62-spec-"));
        try {
            const artifacts = (0, leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility)(fixture());
            await (0, leader_supported_compatibility_source_1.writeCharacterLeaderSupportedCompatibilityArtifacts)(root, artifacts);
            const reread = await (0, leader_supported_compatibility_source_1.readCharacterLeaderSupportedCompatibilityArtifacts)(root);
            (0, assert_1.strict)(reread.gzip.equals(artifacts.gzip));
            await assert_1.strict.rejects(() => (0, leader_supported_compatibility_source_1.writeCharacterLeaderSupportedCompatibilityArtifacts)(root, artifacts));
            await (0, promises_1.chmod)((0, path_1.join)(root, artifacts.manifest.fileName), 0o644);
            await (0, promises_1.writeFile)((0, path_1.join)(root, artifacts.manifest.fileName), Buffer.from("tampered"));
            await assert_1.strict.rejects(() => (0, leader_supported_compatibility_source_1.readCharacterLeaderSupportedCompatibilityArtifacts)(root));
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=leader-supported-compatibility.spec.js.map