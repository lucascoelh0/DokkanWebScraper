"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderAndroidShadow = void 0;
const crypto_1 = require("crypto");
const path_1 = require("path");
const leader_android_shadow_contract_1 = require("./leader-android-shadow-contract");
const leader_android_shadow_1 = require("./leader-android-shadow");
const leader_android_shadow_source_1 = require("./leader-android-shadow-source");
function parseOptions(argv) {
    if (argv[0] !== "--opt-in-k64" || argv.length !== 7)
        throw new Error("K64 explicit opt-in and exact arguments required");
    const values = new Map();
    for (let index = 1; index < argv.length; index += 2) {
        const key = argv[index], value = argv[index + 1];
        if (!["--k56-root", "--android-repository", "--output"].includes(key) || !value || values.has(key)) {
            throw new Error("K64 CLI arguments rejected");
        }
        values.set(key, value);
    }
    return {
        k56Root: (0, path_1.resolve)(values.get("--k56-root")),
        androidRepository: (0, path_1.resolve)(values.get("--android-repository")),
        outputRoot: (0, path_1.resolve)(values.get("--output")),
    };
}
function hash(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function assertSameArtifacts(left, right) {
    for (const key of ["raw", "gzip", "manifestBytes", "provenancePinBytes", "validationBytes"]) {
        if (!left[key].equals(right[key]))
            throw new Error(`K64 repeated materialization changed: ${key}`);
    }
}
async function firstPass(options, observeRss) {
    const source = await (0, leader_android_shadow_source_1.loadCharacterLeaderAndroidShadowSources)(options.k56Root, options.androidRepository);
    observeRss();
    const first = (0, leader_android_shadow_1.buildRealCharacterLeaderAndroidShadow)(source.k56, source.androidSource);
    observeRss();
    const second = (0, leader_android_shadow_1.buildRealCharacterLeaderAndroidShadow)(source.k56, source.androidSource);
    observeRss();
    assertSameArtifacts(first, second);
    return first;
}
async function runCharacterLeaderAndroidShadow(argv = process.argv.slice(2)) {
    const options = parseOptions(argv);
    if (typeof global.gc !== "function")
        throw new Error("K64 requires --expose-gc");
    await (0, leader_android_shadow_source_1.validateCharacterLeaderAndroidShadowRootSeparation)(options.k56Root, options.androidRepository, options.outputRoot);
    let peakRssBytes = process.memoryUsage().rss;
    const observeRss = () => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); };
    const artifacts = await firstPass(options, observeRss);
    global.gc();
    observeRss();
    await (0, leader_android_shadow_source_1.writeCharacterLeaderAndroidShadowArtifacts)(options.outputRoot, artifacts);
    const persisted = await (0, leader_android_shadow_source_1.readCharacterLeaderAndroidShadowArtifacts)(options.outputRoot, leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256);
    assertSameArtifacts(artifacts, persisted);
    observeRss();
    const after = await (0, leader_android_shadow_source_1.loadCharacterLeaderAndroidShadowSources)(options.k56Root, options.androidRepository);
    const rebuilt = (0, leader_android_shadow_1.buildRealCharacterLeaderAndroidShadow)(after.k56, after.androidSource);
    assertSameArtifacts(artifacts, rebuilt);
    (0, leader_android_shadow_1.assertRealCharacterLeaderAndroidShadowArtifactBytes)(persisted);
    observeRss();
    if (peakRssBytes >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES)
        throw new Error("K64 RSS byte budget reached");
    process.stdout.write(JSON.stringify({
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-producer-run",
        checkpoint: "K64",
        mode: "explicit_opt_in_offline_create_only_default_off",
        output: {
            root: options.outputRoot,
            files: {
                payload: { fileName: artifacts.manifest.fileName, sizeBytes: artifacts.gzip.length, sha256: hash(artifacts.gzip) },
                manifest: { fileName: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest, sizeBytes: artifacts.manifestBytes.length, sha256: hash(artifacts.manifestBytes) },
                provenancePin: { fileName: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin, sizeBytes: artifacts.provenancePinBytes.length, sha256: hash(artifacts.provenancePinBytes) },
                validation: { fileName: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation, sizeBytes: artifacts.validationBytes.length, sha256: hash(artifacts.validationBytes) },
            },
        },
        counts: artifacts.validation.counts,
        source: {
            k56FullArtifactFingerprintSha256: artifacts.dataset.provenance.sourceArtifactSha256,
            k56LineageFingerprintSha256: artifacts.dataset.provenance.sourceLineageSha256,
            k60PublicationReceiptSha256: artifacts.dataset.provenance.sourceReceiptSha256,
            k62_1CompatibilityReportSha256: artifacts.provenancePin.compatibilityAudit.reportSha256,
            androidCommit: artifacts.provenancePin.androidSource.commit,
            stability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY",
            transientABADriftDetection: "NO-GO",
        },
        determinism: { twoMaterializationsByteIdentical: true, postWriteReconstructionByteIdentical: true },
        rss: { processPeakRssBytes: peakRssBytes, maximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES },
        readiness: artifacts.validation.readiness,
    }));
}
exports.runCharacterLeaderAndroidShadow = runCharacterLeaderAndroidShadow;
if (require.main === module) {
    runCharacterLeaderAndroidShadow().catch(error => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=leader-android-shadow-run.js.map