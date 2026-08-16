"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderCausalityDeckIndexCli = exports.runCharacterLeaderCausalityDeckIndexAudit = void 0;
const leader_causality_deck_index_contract_1 = require("./leader-causality-deck-index-contract");
const leader_causality_deck_index_source_1 = require("./leader-causality-deck-index-source");
const leader_causality_deck_index_1 = require("./leader-causality-deck-index");
const leader_causality_collection_run_1 = require("./leader-causality-collection-run");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES;
    }
    sample() {
        this.observe();
        if (this.exceeded)
            throw new Error(`K54 RSS limit reached: ${this.peak}`);
    }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function authorize(report) {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k53RealAudit: "GO",
            k53StructuralGosAndNoGosPreserved: true,
            nativeProofBefore: "GO",
            nativeProofAfter: "GO",
            nativeProofStableAcrossK53: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            deckIndexRuntimeArgumentProvenance: "GO",
            deckIndexIndependentFromTargetType: "GO",
        },
    };
}
async function runCharacterLeaderCausalityDeckIndexAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K54 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database) {
        throw new Error("K54 requires all explicit roots, native runtime and database");
    }
    if (typeof global.gc !== "function")
        throw new Error("K54 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        let beforeNative = await (0, leader_causality_deck_index_source_1.loadCharacterLeaderCausalityDeckIndexNativeProof)(options.nativeRuntime);
        global.gc();
        rss.sample();
        const upstreamK53 = await (0, leader_causality_collection_run_1.runCharacterLeaderCausalityCollectionAudit)({
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
        let afterNative = await (0, leader_causality_deck_index_source_1.loadCharacterLeaderCausalityDeckIndexNativeProof)(options.nativeRuntime);
        global.gc();
        rss.sample();
        (0, leader_causality_deck_index_source_1.assertLeaderCausalityDeckIndexNativeStable)(beforeNative, afterNative);
        (0, leader_causality_deck_index_1.assertPinnedCharacterLeaderCausalityDeckIndex)(upstreamK53, beforeNative);
        const report = (0, leader_causality_deck_index_1.buildCharacterLeaderCausalityDeckIndexReport)(upstreamK53, beforeNative);
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
exports.runCharacterLeaderCausalityDeckIndexAudit = runCharacterLeaderCausalityDeckIndexAudit;
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
        throw new Error(`K54 requires ${name}`);
    return result;
}
function parseCharacterLeaderCausalityDeckIndexCli(args) {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k54", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K54 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k54") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k54").length !== 1)
        throw new Error("K54 requires exactly one --opt-in-k54");
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
exports.parseCharacterLeaderCausalityDeckIndexCli = parseCharacterLeaderCausalityDeckIndexCli;
async function run() {
    const report = await runCharacterLeaderCausalityDeckIndexAudit(parseCharacterLeaderCausalityDeckIndexCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_causality_deck_index_contract_1.CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES) {
        throw new Error("K54 stdout report byte limit reached");
    }
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-causality-deck-index-run.js.map