"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderTargetSemanticsCli = exports.runCharacterLeaderTargetSemanticsAudit = void 0;
const leader_target_semantics_contract_1 = require("./leader-target-semantics-contract");
const leader_target_semantics_source_1 = require("./leader-target-semantics-source");
const leader_target_semantics_1 = require("./leader-target-semantics");
const leader_native_semantics_1 = require("./leader-native-semantics");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const leader_value_scope_1 = require("./leader-value-scope");
const leader_association_projection_1 = require("./leader-association-projection");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES; }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K51 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function authorize(report) { return { ...report, inputIntegrity: { ...report.inputIntegrity, k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48K3NativeAndTargetRowsStable: true }, readiness: { ...report.readiness, leaderTargetSemantics: "GO", type82TargetAndCategoryFilters: "GO" } }; }
async function runCharacterLeaderTargetSemanticsAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K51 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.k48Root || !options.nativeRuntime)
        throw new Error("K51 requires all explicit roots and native runtime");
    if (typeof global.gc !== "function")
        throw new Error("K51 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
        let beforeK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO")
            throw new Error("K51 requires K48 source-bound GO");
        const k48Value = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(beforeK48.artifacts), k48Target = (0, leader_target_semantics_source_1.compactK48LeaderTargetSource)(beforeK48.artifacts);
        beforeK48 = undefined;
        global.gc();
        rss.sample();
        let beforeK3 = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        const k3Identity = beforeK3.identity;
        (0, leader_value_scope_1.assertPinnedCharacterLeaderValueScope)((0, leader_value_scope_1.evaluateCharacterLeaderValueScope)(k48Value, beforeK3));
        let native = await (0, leader_target_semantics_source_1.loadCharacterLeaderTargetNativeProof)(options.nativeRuntime);
        (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)((0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(k48Value, beforeK3), native.k50);
        let targetK3 = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
        const targetIdentity = targetK3.identity;
        const scope = (0, leader_target_semantics_1.evaluateCharacterLeaderTargetSemantics)(k48Target, beforeK3, targetK3);
        (0, leader_target_semantics_1.assertPinnedCharacterLeaderTargetSemantics)(scope, native);
        beforeK3 = undefined;
        targetK3 = undefined;
        global.gc();
        rss.sample();
        let afterNative = await (0, leader_target_semantics_source_1.loadCharacterLeaderTargetNativeProof)(options.nativeRuntime);
        (0, leader_target_semantics_source_1.assertLeaderTargetNativeStable)(native, afterNative);
        afterNative = undefined;
        global.gc();
        rss.sample();
        let afterK3 = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        (0, leader_value_scope_source_1.assertLeaderValueK3Stable)(k3Identity, afterK3.identity);
        afterK3 = undefined;
        let afterTargetK3 = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
        (0, leader_target_semantics_source_1.assertLeaderTargetK3Stable)(targetIdentity, afterTargetK3.identity);
        afterTargetK3 = undefined;
        global.gc();
        rss.sample();
        let afterK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO")
            throw new Error("K51 final K48 source-bound validation failed");
        (0, leader_value_scope_source_1.assertLeaderValueK48Stable)(k48Value.identity, (0, leader_value_scope_source_1.compactK48LeaderValueSource)(afterK48.artifacts).identity);
        afterK48 = undefined;
        global.gc();
        rss.sample();
        const report = authorize((0, leader_target_semantics_1.buildCharacterLeaderTargetSemanticsReport)(k48Target.identity, k3Identity, targetIdentity.targetInputFingerprintSha256, native, scope));
        rss.stop();
        return report;
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderTargetSemanticsAudit = runCharacterLeaderTargetSemanticsAudit;
function value(args, name) { const indexes = args.flatMap((item, index) => item === name ? [index] : []); if (indexes.length > 1)
    throw new Error(`duplicate ${name}`); if (!indexes.length)
    return undefined; const result = args[indexes[0] + 1]; if (!result || result.startsWith("--"))
    throw new Error(`missing value for ${name}`); return result; }
function required(args, name) { const result = value(args, name); if (!result)
    throw new Error(`K51 requires ${name}`); return result; }
function parseCharacterLeaderTargetSemanticsCli(args) {
    const values = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime"], allowed = new Set(["--opt-in-k51", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K51 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k51") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k51").length !== 1)
        throw new Error("K51 requires exactly one --opt-in-k51");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"), k48Root: required(args, "--k48-root"), nativeRuntime: required(args, "--native-runtime") };
}
exports.parseCharacterLeaderTargetSemanticsCli = parseCharacterLeaderTargetSemanticsCli;
async function run() { const report = await runCharacterLeaderTargetSemanticsAudit(parseCharacterLeaderTargetSemanticsCli(process.argv.slice(2))); const stdout = `${JSON.stringify(report, null, 2)}\n`; if (Buffer.byteLength(stdout) >= leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES)
    throw new Error("K51 stdout report byte limit reached"); process.stdout.write(stdout); }
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-target-semantics-run.js.map