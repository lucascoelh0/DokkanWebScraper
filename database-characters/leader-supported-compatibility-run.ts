import { createHash } from "crypto";
import {
    CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES,
} from "./leader-supported-compatibility-contract";
import {
    buildCharacterLeaderSupportedCompatibilityReport,
    materializeCharacterLeaderSupportedCompatibility,
} from "./leader-supported-compatibility";
import {
    CharacterLeaderSupportedCompatibilityRunOptions,
    loadCharacterLeaderSupportedCompatibilityInputs,
    validateCharacterLeaderSupportedCompatibilityArtifact,
    validateCharacterLeaderSupportedCompatibilityRootSeparation,
    writeCharacterLeaderSupportedCompatibilityArtifacts,
} from "./leader-supported-compatibility-source";

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 5);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES;
    }
    stop(): number {
        clearInterval(this.timer);
        this.observe();
        if (this.exceeded) throw new Error(`K62 parent RSS limit reached: ${this.peak}`);
        return this.peak;
    }
}

function parseArgs(argv: string[]): CharacterLeaderSupportedCompatibilityRunOptions {
    const required = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
        "--k56-root", "--k58-root", "--k57-report", "--k59-report", "--k60-report", "--k60-receipt",
        "--k61-report", "--productive-characters", "--scraper-root", "--android-root", "--output-root",
        "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k62", ...required]);
    const values = new Map<string, string>();
    let optedIn = false;
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (!allowed.has(token)) throw new Error(`K62 unknown option: ${token}`);
        if (token === "--opt-in-k62") { if (optedIn) throw new Error("K62 duplicate opt-in"); optedIn = true; continue; }
        if (values.has(token)) throw new Error(`K62 duplicate option: ${token}`);
        const value = argv[++index];
        if (!value || value.startsWith("--")) throw new Error(`K62 missing value for ${token}`);
        values.set(token, value);
    }
    if (!optedIn) throw new Error("K62 requires --opt-in-k62");
    for (const name of required) if (!values.has(name)) throw new Error(`K62 requires ${name}`);
    if (typeof global.gc !== "function") throw new Error("K62 requires Node --expose-gc");
    return {
        sidecarRoot: values.get("--sidecar-root")!, productionRoot: values.get("--production-root")!,
        fyiRoot: values.get("--fyi-root")!, k43Root: values.get("--k43-root")!, k46Root: values.get("--k46-root")!,
        k48Root: values.get("--k48-root")!, k56Root: values.get("--k56-root")!, k58Root: values.get("--k58-root")!,
        k57Report: values.get("--k57-report")!, k59Report: values.get("--k59-report")!,
        k60Report: values.get("--k60-report")!, k60Receipt: values.get("--k60-receipt")!,
        k61Report: values.get("--k61-report")!, productiveCharacters: values.get("--productive-characters")!,
        scraperRoot: values.get("--scraper-root")!, androidRoot: values.get("--android-root")!,
        outputRoot: values.get("--output-root")!, nativeRuntime: values.get("--native-runtime")!,
        database: values.get("--database")!,
    };
}

function assertByteIdentical(left: ReturnType<typeof materializeCharacterLeaderSupportedCompatibility>, right: ReturnType<typeof materializeCharacterLeaderSupportedCompatibility>): void {
    for (const [label, a, b] of [["payload", left.gzip, right.gzip], ["coverage", left.coverageBytes, right.coverageBytes],
        ["validation", left.validationBytes, right.validationBytes], ["manifest", left.manifestBytes, right.manifestBytes]] as Array<[string, Buffer, Buffer]>) {
        if (!a.equals(b)) throw new Error(`K62 double generation mismatch: ${label}`);
    }
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const rss = new RssGuard();
    await validateCharacterLeaderSupportedCompatibilityRootSeparation(options);
    let loaded = await loadCharacterLeaderSupportedCompatibilityInputs(options);
    const first = materializeCharacterLeaderSupportedCompatibility(buildCharacterLeaderSupportedCompatibilityReport(loaded.inputs));
    const second = materializeCharacterLeaderSupportedCompatibility(buildCharacterLeaderSupportedCompatibilityReport(loaded.inputs));
    assertByteIdentical(first, second);
    if (!first.validation.valid) throw new Error(`K62 validation failed: ${first.validation.failures.join("; ")}`);
    await writeCharacterLeaderSupportedCompatibilityArtifacts(options.outputRoot, first);
    const initialChildPeak = loaded.k55ValidationProcessPeakRssBytes;
    loaded = undefined as any;
    global.gc!();
    const validated = await validateCharacterLeaderSupportedCompatibilityArtifact(options);
    const finalChildPeak = validated.k55ValidationProcessPeakRssBytes;
    const parentPeak = rss.stop();
    const maximum = Math.max(initialChildPeak, finalChildPeak, parentPeak);
    if (maximum >= CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES) throw new Error(`K62 per-process RSS limit reached: ${maximum}`);
    const artifacts = validated.artifacts;
    console.log(JSON.stringify({
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-run-result",
        contractVersion: "1.0.0",
        sourceBoundValidation: "GO",
        doubleGenerationByteIdentical: true,
        artifacts: {
            payload: { fileName: artifacts.manifest.fileName, sizeBytes: artifacts.gzip.length, sha256: hash(artifacts.gzip) },
            coverage: { fileName: artifacts.manifest.coverageFile, sizeBytes: artifacts.coverageBytes.length, sha256: hash(artifacts.coverageBytes) },
            validation: { fileName: artifacts.manifest.validationFile, sizeBytes: artifacts.validationBytes.length, sha256: hash(artifacts.validationBytes) },
            manifest: { fileName: "database-characters-k62-leader-supported-compatibility-manifest.json", sizeBytes: artifacts.manifestBytes.length, sha256: hash(artifacts.manifestBytes) },
        },
        inventory: artifacts.report.inventory,
        parity: artifacts.report.comparison.productiveCharacterDataset,
        effectClassificationCounts: artifacts.report.effectCompatibility.counts,
        k63Decision: artifacts.report.k63Proposal.decision,
        rssAccounting: {
            scope: "per_process_not_process_tree",
            initialK58K55ProcessPeakRssBytes: initialChildPeak,
            finalK58K55ProcessPeakRssBytes: finalChildPeak,
            k62ParentProcessPeakRssBytes: parentPeak,
            maximumIndividualProcessPeakRssBytes: maximum,
        },
        readiness: {
            offlineCompatibilityAudit: "GO",
            lineageK56ThroughK61: "GO",
            losslessReconstruction: "GO",
            perProcessRssUnder1GiB: "GO",
            processTreeRssUnder1GiB: "NO-GO",
            k63AdditiveShadowContract: "GO",
            currentContractDirectConsumption: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
            androidImplementation: "NO-GO",
            ui: "NO-GO",
        },
    }, null, 2));
}

if (require.main === module) main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
