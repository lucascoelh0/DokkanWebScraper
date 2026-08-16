"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderCausalityCollectionCli = exports.runCharacterLeaderCausalityCollectionAudit = void 0;
const leader_causality_collection_contract_1 = require("./leader-causality-collection-contract");
const leader_causality_collection_source_1 = require("./leader-causality-collection-source");
const leader_causality_collection_1 = require("./leader-causality-collection");
const leader_causality_semantics_run_1 = require("./leader-causality-semantics-run");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_RSS_LIMIT_BYTES;
    }
    sample() {
        this.observe();
        if (this.exceeded)
            throw new Error(`K53 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function authorize(report) {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k52RealAudit: "GO",
            k52ConservativeNoGosPreserved: true,
            nativeProofBefore: "GO",
            nativeProofAfter: "GO",
            nativeProofStableAcrossK52: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            leaderCausalityCandidateCollection: "GO",
            deckIndex0And1StructuralCollection: "GO",
        },
    };
}
async function runCharacterLeaderCausalityCollectionAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K53 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database) {
        throw new Error("K53 requires all explicit roots, native runtime and database");
    }
    if (typeof global.gc !== "function")
        throw new Error("K53 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        let beforeNative = await (0, leader_causality_collection_source_1.loadCharacterLeaderCausalityCollectionNativeProof)(options.nativeRuntime);
        global.gc();
        rss.sample();
        const upstreamK52 = await (0, leader_causality_semantics_run_1.runCharacterLeaderCausalitySemanticsAudit)({
            optIn: true,
            sidecarRoot: options.sidecarRoot,
            productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot,
            k43Root: options.k43Root,
            k46Root: options.k46Root,
            k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime,
            database: options.database,
        });
        rss.sample();
        let afterNative = await (0, leader_causality_collection_source_1.loadCharacterLeaderCausalityCollectionNativeProof)(options.nativeRuntime);
        global.gc();
        rss.sample();
        (0, leader_causality_collection_source_1.assertLeaderCausalityCollectionNativeStable)(beforeNative, afterNative);
        (0, leader_causality_collection_1.assertPinnedCharacterLeaderCausalityCollection)(upstreamK52, beforeNative);
        const report = (0, leader_causality_collection_1.buildCharacterLeaderCausalityCollectionReport)(upstreamK52, beforeNative);
        beforeNative = undefined;
        afterNative = undefined;
        global.gc();
        rss.stop();
        return authorize(report);
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderCausalityCollectionAudit = runCharacterLeaderCausalityCollectionAudit;
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
        throw new Error(`K53 requires ${name}`);
    return result;
}
function parseCharacterLeaderCausalityCollectionCli(args) {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k53", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K53 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k53") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k53").length !== 1)
        throw new Error("K53 requires exactly one --opt-in-k53");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
        k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
        nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}
exports.parseCharacterLeaderCausalityCollectionCli = parseCharacterLeaderCausalityCollectionCli;
async function run() {
    const report = await runCharacterLeaderCausalityCollectionAudit(parseCharacterLeaderCausalityCollectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_causality_collection_contract_1.CHARACTER_LEADER_CAUSALITY_COLLECTION_REPORT_LIMIT_BYTES)
        throw new Error("K53 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-causality-collection-run.js.map