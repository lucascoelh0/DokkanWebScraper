"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCharacterLeaderSupportedCompatibilityLifecycle = exports.runCharacterLeaderSupportedCompatibilityFirstPass = void 0;
const crypto_1 = require("crypto");
const leader_supported_compatibility_contract_1 = require("./leader-supported-compatibility-contract");
const leader_supported_compatibility_1 = require("./leader-supported-compatibility");
const leader_supported_compatibility_source_1 = require("./leader-supported-compatibility-source");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 5);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES;
    }
    stop() {
        clearInterval(this.timer);
        this.observe();
        if (this.exceeded)
            throw new Error(`K62 parent RSS limit reached: ${this.peak}`);
        return this.peak;
    }
}
function parseArgs(argv) {
    const required = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
        "--k56-root", "--k58-root", "--k57-report", "--k59-report", "--k60-report", "--k60-receipt",
        "--k61-report", "--productive-characters", "--scraper-root", "--android-repository", "--output-root",
        "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k62", ...required]);
    const values = new Map();
    let optedIn = false;
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (!allowed.has(token))
            throw new Error(`K62 unknown option: ${token}`);
        if (token === "--opt-in-k62") {
            if (optedIn)
                throw new Error("K62 duplicate opt-in");
            optedIn = true;
            continue;
        }
        if (values.has(token))
            throw new Error(`K62 duplicate option: ${token}`);
        const value = argv[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`K62 missing value for ${token}`);
        values.set(token, value);
    }
    if (!optedIn)
        throw new Error("K62 requires --opt-in-k62");
    for (const name of required)
        if (!values.has(name))
            throw new Error(`K62 requires ${name}`);
    if (typeof global.gc !== "function")
        throw new Error("K62 requires Node --expose-gc");
    return {
        sidecarRoot: values.get("--sidecar-root"), productionRoot: values.get("--production-root"),
        fyiRoot: values.get("--fyi-root"), k43Root: values.get("--k43-root"), k46Root: values.get("--k46-root"),
        k48Root: values.get("--k48-root"), k56Root: values.get("--k56-root"), k58Root: values.get("--k58-root"),
        k57Report: values.get("--k57-report"), k59Report: values.get("--k59-report"),
        k60Report: values.get("--k60-report"), k60Receipt: values.get("--k60-receipt"),
        k61Report: values.get("--k61-report"), productiveCharacters: values.get("--productive-characters"),
        scraperRoot: values.get("--scraper-root"), androidRepository: values.get("--android-repository"),
        outputRoot: values.get("--output-root"), nativeRuntime: values.get("--native-runtime"),
        database: values.get("--database"),
    };
}
function assertByteIdentical(left, right) {
    for (const [label, a, b] of [["payload", left.gzip, right.gzip], ["coverage", left.coverageBytes, right.coverageBytes],
        ["validation", left.validationBytes, right.validationBytes], ["manifest", left.manifestBytes, right.manifestBytes]]) {
        if (!a.equals(b))
            throw new Error(`K62 double generation mismatch: ${label}`);
    }
}
const firstPassDependencies = {
    load: leader_supported_compatibility_source_1.loadCharacterLeaderSupportedCompatibilityInputs,
    buildReport: leader_supported_compatibility_1.buildCharacterLeaderSupportedCompatibilityReport,
    materialize: leader_supported_compatibility_1.materializeCharacterLeaderSupportedCompatibility,
    write: leader_supported_compatibility_source_1.writeCharacterLeaderSupportedCompatibilityArtifacts,
};
async function runCharacterLeaderSupportedCompatibilityFirstPass(options, dependencies = firstPassDependencies) {
    let loaded;
    let first;
    let second;
    try {
        loaded = await dependencies.load(options);
        first = dependencies.materialize(dependencies.buildReport(loaded.inputs));
        second = dependencies.materialize(dependencies.buildReport(loaded.inputs));
        assertByteIdentical(first, second);
        if (!first.validation.valid)
            throw new Error(`K62 validation failed: ${first.validation.failures.join("; ")}`);
        await dependencies.write(options.outputRoot, first);
        return {
            k55ValidationProcessPeakRssBytes: loaded.k55ValidationProcessPeakRssBytes,
            sourceReceipt: loaded.sourceReceipt,
            expected: {
                gzip: first.gzip,
                coverageBytes: first.coverageBytes,
                validationBytes: first.validationBytes,
                manifestBytes: first.manifestBytes,
            },
        };
    }
    finally {
        loaded = undefined;
        first = undefined;
        second = undefined;
    }
}
exports.runCharacterLeaderSupportedCompatibilityFirstPass = runCharacterLeaderSupportedCompatibilityFirstPass;
const lifecycleDependencies = {
    firstPass: runCharacterLeaderSupportedCompatibilityFirstPass,
    collectGarbage: () => global.gc(),
    validate: leader_supported_compatibility_source_1.validateCharacterLeaderSupportedCompatibilityArtifact,
};
async function runCharacterLeaderSupportedCompatibilityLifecycle(options, dependencies = lifecycleDependencies) {
    const firstPass = await dependencies.firstPass(options);
    dependencies.collectGarbage();
    const validated = await dependencies.validate(options, firstPass.expected, firstPass.sourceReceipt);
    return { initialChildPeak: firstPass.k55ValidationProcessPeakRssBytes, validated };
}
exports.runCharacterLeaderSupportedCompatibilityLifecycle = runCharacterLeaderSupportedCompatibilityLifecycle;
async function main() {
    const options = parseArgs(process.argv.slice(2));
    const rss = new RssGuard();
    await (0, leader_supported_compatibility_source_1.validateCharacterLeaderSupportedCompatibilityRootSeparation)(options);
    const lifecycle = await runCharacterLeaderSupportedCompatibilityLifecycle(options);
    const initialChildPeak = lifecycle.initialChildPeak;
    const validated = lifecycle.validated;
    const parentPeak = rss.stop();
    const maximum = Math.max(initialChildPeak, parentPeak);
    if (maximum >= leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES)
        throw new Error(`K62 per-process RSS limit reached: ${maximum}`);
    const artifacts = validated.artifacts;
    console.log(JSON.stringify({
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-supported-compatibility-run-result",
        contractVersion: leader_supported_compatibility_contract_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION,
        checkpoint: "K62.1",
        sourceBoundReconstruction: "GO",
        sourceStability: "CHECKPOINTED_PERSISTENT_DRIFT_ONLY",
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
            k58K55ExecutionCount: 1,
            k58K55ProcessPeakRssBytes: initialChildPeak,
            finalK58K55Execution: "NOT_EXECUTED",
            k62ParentProcessPeakRssBytes: parentPeak,
            maximumIndividualProcessPeakRssBytes: maximum,
            processTreeMeasurement: {
                status: "NOT_EXECUTED",
                requiredBoundary: "external_whole_process_tree_observer",
                eligibleForGoClaim: false,
            },
        },
        readiness: {
            offlineCompatibilityAudit: "GO",
            lineageK56ThroughK61: "GO",
            losslessReconstruction: "GO",
            perProcessRssUnder1GiB: "GO",
            processTreeRssUnder1GiB: "NOT_EXECUTED",
            k63AdditiveShadowContract: "GO",
            currentContractDirectConsumption: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
            androidImplementation: "NO-GO",
            ui: "NO-GO",
        },
    }, null, 2));
}
if (require.main === module)
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
//# sourceMappingURL=leader-supported-compatibility-run.js.map