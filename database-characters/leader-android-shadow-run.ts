import { createHash } from "crypto";
import { resolve } from "path";
import {
    CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256,
    CHARACTER_LEADER_ANDROID_SHADOW_FILES,
    CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES,
    CharacterLeaderAndroidShadowArtifactSet,
} from "./leader-android-shadow-contract";
import {
    assertRealCharacterLeaderAndroidShadowArtifactBytes,
    buildRealCharacterLeaderAndroidShadow,
} from "./leader-android-shadow";
import {
    loadCharacterLeaderAndroidShadowSources,
    readCharacterLeaderAndroidShadowArtifacts,
    validateCharacterLeaderAndroidShadowRootSeparation,
    writeCharacterLeaderAndroidShadowArtifacts,
} from "./leader-android-shadow-source";

interface Options {
    k56Root: string;
    androidRepository: string;
    outputRoot: string;
}

function parseOptions(argv: string[]): Options {
    if (argv[0] !== "--opt-in-k64" || argv.length !== 7) throw new Error("K64 explicit opt-in and exact arguments required");
    const values = new Map<string, string>();
    for (let index = 1; index < argv.length; index += 2) {
        const key = argv[index], value = argv[index + 1];
        if (!["--k56-root", "--android-repository", "--output"].includes(key) || !value || values.has(key)) {
            throw new Error("K64 CLI arguments rejected");
        }
        values.set(key, value);
    }
    return {
        k56Root: resolve(values.get("--k56-root")!),
        androidRepository: resolve(values.get("--android-repository")!),
        outputRoot: resolve(values.get("--output")!),
    };
}

function hash(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function assertSameArtifacts(left: CharacterLeaderAndroidShadowArtifactSet, right: CharacterLeaderAndroidShadowArtifactSet): void {
    for (const key of ["raw", "gzip", "manifestBytes", "provenancePinBytes", "validationBytes"] as const) {
        if (!left[key].equals(right[key])) throw new Error(`K64 repeated materialization changed: ${key}`);
    }
}

async function firstPass(options: Options, observeRss: () => void): Promise<CharacterLeaderAndroidShadowArtifactSet> {
    const source = await loadCharacterLeaderAndroidShadowSources(options.k56Root, options.androidRepository);
    observeRss();
    const first = buildRealCharacterLeaderAndroidShadow(source.k56, source.androidSource);
    observeRss();
    const second = buildRealCharacterLeaderAndroidShadow(source.k56, source.androidSource);
    observeRss();
    assertSameArtifacts(first, second);
    return first;
}

export async function runCharacterLeaderAndroidShadow(argv = process.argv.slice(2)): Promise<void> {
    const options = parseOptions(argv);
    if (typeof global.gc !== "function") throw new Error("K64 requires --expose-gc");
    await validateCharacterLeaderAndroidShadowRootSeparation(
        options.k56Root,
        options.androidRepository,
        options.outputRoot,
    );
    let peakRssBytes = process.memoryUsage().rss;
    const observeRss = (): void => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); };
    const artifacts = await firstPass(options, observeRss);
    global.gc();
    observeRss();
    await writeCharacterLeaderAndroidShadowArtifacts(options.outputRoot, artifacts);
    const persisted = await readCharacterLeaderAndroidShadowArtifacts(
        options.outputRoot,
        CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256,
    );
    assertSameArtifacts(artifacts, persisted);
    observeRss();
    const after = await loadCharacterLeaderAndroidShadowSources(options.k56Root, options.androidRepository);
    const rebuilt = buildRealCharacterLeaderAndroidShadow(after.k56, after.androidSource);
    assertSameArtifacts(artifacts, rebuilt);
    assertRealCharacterLeaderAndroidShadowArtifactBytes(persisted);
    observeRss();
    if (peakRssBytes >= CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES) throw new Error("K64 RSS byte budget reached");
    process.stdout.write(JSON.stringify({
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-producer-run",
        checkpoint: "K64",
        mode: "explicit_opt_in_offline_create_only_default_off",
        output: {
            root: options.outputRoot,
            files: {
                payload: { fileName: artifacts.manifest.fileName, sizeBytes: artifacts.gzip.length, sha256: hash(artifacts.gzip) },
                manifest: { fileName: CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest, sizeBytes: artifacts.manifestBytes.length, sha256: hash(artifacts.manifestBytes) },
                provenancePin: { fileName: CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin, sizeBytes: artifacts.provenancePinBytes.length, sha256: hash(artifacts.provenancePinBytes) },
                validation: { fileName: CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation, sizeBytes: artifacts.validationBytes.length, sha256: hash(artifacts.validationBytes) },
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
        rss: { processPeakRssBytes: peakRssBytes, maximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES },
        readiness: artifacts.validation.readiness,
    }));
}

if (require.main === module) {
    runCharacterLeaderAndroidShadow().catch(error => {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exitCode = 1;
    });
}
