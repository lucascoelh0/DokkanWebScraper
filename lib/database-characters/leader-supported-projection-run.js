"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderSupportedProjectionCli = exports.runCharacterLeaderSupportedProjection = exports.maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss = void 0;
const crypto_1 = require("crypto");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_projection_source_1 = require("./leader-supported-projection-source");
const leader_supported_projection_k55_subprocess_1 = require("./leader-supported-projection-k55-subprocess");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample() {
        this.observe();
        if (this.exceeded)
            throw new Error(`K56 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss(...peaks) {
    if (peaks.length !== 3 || peaks.some(peak => !Number.isSafeInteger(peak) || peak <= 0
        || peak >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_RSS_LIMIT_BYTES))
        throw new Error("K56 per-process RSS peak rejected");
    return Math.max(...peaks);
}
exports.maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss = maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss;
async function runCharacterLeaderSupportedProjection(options) {
    if (options?.optIn !== true)
        throw new Error("K56 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.outputRoot || !options.nativeRuntime || !options.database) {
        throw new Error("K56 requires every explicit source/output root, native runtime and database");
    }
    if (typeof global.gc !== "function")
        throw new Error("K56 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionRootSeparation)(options);
        rss.sample();
        let initialChild = await (0, leader_supported_projection_k55_subprocess_1.runCharacterLeaderK55Subprocess)({
            sidecarRoot: options.sidecarRoot,
            productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot,
            k43Root: options.k43Root,
            k46Root: options.k46Root,
            k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime,
            database: options.database,
        });
        const k55InitialProcessPeakRssBytes = initialChild.processPeakRssBytes;
        let upstreamK55 = initialChild.report;
        initialChild = undefined;
        rss.sample();
        let first = await (0, leader_supported_projection_source_1.buildCharacterLeaderSupportedProjectionFromSources)(options, upstreamK55);
        rss.sample();
        let second = await (0, leader_supported_projection_source_1.buildCharacterLeaderSupportedProjectionFromSources)(options, upstreamK55);
        rss.sample();
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip)
            || !first.coverageBytes.equals(second.coverageBytes) || !first.validationBytes.equals(second.validationBytes)
            || !first.manifestBytes.equals(second.manifestBytes))
            throw new Error("K56 two materializations are not byte-identical");
        first = undefined;
        global.gc();
        rss.sample();
        await (0, leader_supported_projection_source_1.writeCharacterLeaderSupportedProjectionArtifacts)(options.outputRoot, second);
        second = undefined;
        upstreamK55 = undefined;
        global.gc();
        rss.sample();
        const validated = await (0, leader_supported_projection_source_1.validateCharacterLeaderSupportedProjectionArtifact)({ artifactRoot: options.outputRoot, ...options });
        rss.sample();
        const parentProcessPeakRssBytes = rss.stop();
        const maximumIndividualProcessPeakRssBytes = maximumIndividualCharacterLeaderSupportedProjectionProcessPeakRss(parentProcessPeakRssBytes, k55InitialProcessPeakRssBytes, validated.k55ValidationProcessPeakRssBytes);
        return {
            outputRoot: options.outputRoot,
            manifest: validated.artifacts.manifest,
            coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation,
            manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length,
            twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuildAndWrite: true,
            k55RealAudit: "GO",
            sourceBoundValidation: "GO",
            localShadowAuditDefaultOff: "GO",
            rssAccountingScope: "per_process_not_process_tree",
            k55InitialProcessPeakRssBytes,
            k55ValidationProcessPeakRssBytes: validated.k55ValidationProcessPeakRssBytes,
            parentProcessPeakRssBytes,
            maximumIndividualProcessPeakRssBytes,
            readiness: {
                offlineSupportedOnlyProjection: "GO", conditional17: "NO-GO", deckFallback: "NO-GO",
                effectiveCombinedLeaderValue: "NO-GO", authority: "NO-GO", apply: "NO-GO", production: "NO-GO",
                publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO", ui: "NO-GO",
                fyiRemoval: "NO-GO", combatCalculation: "NO-GO", dynamicInstrumentation: "NO-GO",
                concurrentOutputAncestorReplacement: "NO-GO",
                perProcessRssUnder1GiB: "GO",
                processTreeRssUnder1GiB: "NO-GO",
            },
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderSupportedProjection = runCharacterLeaderSupportedProjection;
function value(args, name) {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!indexes.length)
        return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return result;
}
function required(args, name) {
    const result = value(args, name);
    if (!result)
        throw new Error(`K56 requires ${name}`);
    return result;
}
function parseCharacterLeaderSupportedProjectionCli(args) {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--output-root",
        "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k56", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K56 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k56") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k56").length !== 1)
        throw new Error("K56 requires exactly one --opt-in-k56");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
        k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
        outputRoot: required(args, "--output-root"),
        nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}
exports.parseCharacterLeaderSupportedProjectionCli = parseCharacterLeaderSupportedProjectionCli;
async function run() {
    const result = await runCharacterLeaderSupportedProjection(parseCharacterLeaderSupportedProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K56 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-supported-projection-run.js.map