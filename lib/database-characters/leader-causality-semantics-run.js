"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderCausalitySemanticsCli = exports.runCharacterLeaderCausalitySemanticsAudit = void 0;
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
const leader_causality_semantics_source_1 = require("./leader-causality-semantics-source");
const leader_causality_semantics_1 = require("./leader-causality-semantics");
const leader_association_projection_1 = require("./leader-association-projection");
const leader_native_semantics_1 = require("./leader-native-semantics");
const leader_target_semantics_source_1 = require("./leader-target-semantics-source");
const leader_target_semantics_1 = require("./leader-target-semantics");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const leader_value_scope_1 = require("./leader-value-scope");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES;
    }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K52 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function authorize(report) {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k48SourceBoundBefore: "GO",
            k48SourceBoundAfter: "GO",
            k48K3DatabaseAndNativeStable: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            leaderCausalityStructuralSemantics: "GO",
            type35StructuralCondition: "GO",
        },
    };
}
async function runCharacterLeaderCausalitySemanticsAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K52 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database)
        throw new Error("K52 requires all explicit roots, native runtime and database");
    if (typeof global.gc !== "function")
        throw new Error("K52 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root,
        };
        let beforeK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO")
            throw new Error("K52 requires K48 source-bound GO");
        const k48Value = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(beforeK48.artifacts);
        const k48Target = (0, leader_target_semantics_source_1.compactK48LeaderTargetSource)(beforeK48.artifacts);
        beforeK48 = undefined;
        global.gc();
        rss.sample();
        let beforeK3Value = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        const k3ValueIdentity = beforeK3Value.identity;
        (0, leader_value_scope_1.assertPinnedCharacterLeaderValueScope)((0, leader_value_scope_1.evaluateCharacterLeaderValueScope)(k48Value, beforeK3Value));
        let targetNative = await (0, leader_target_semantics_source_1.loadCharacterLeaderTargetNativeProof)(options.nativeRuntime);
        (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)((0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(k48Value, beforeK3Value), targetNative.k50);
        let targetK3 = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
        const targetK3Identity = targetK3.identity;
        (0, leader_target_semantics_1.assertPinnedCharacterLeaderTargetSemantics)((0, leader_target_semantics_1.evaluateCharacterLeaderTargetSemantics)(k48Target, beforeK3Value, targetK3), targetNative);
        let causalityK3 = await (0, leader_causality_semantics_source_1.loadPinnedK3LeaderCausalitySource)(options.sidecarRoot);
        const causalityK3Identity = causalityK3.identity;
        let database = await (0, leader_causality_semantics_source_1.loadPinnedLeaderCausalityDatabase)(options.database);
        const databaseIdentity = database.identity;
        let native = await (0, leader_causality_semantics_source_1.loadCharacterLeaderCausalityNativeProof)(options.nativeRuntime);
        const scope = (0, leader_causality_semantics_1.evaluateCharacterLeaderCausalitySemantics)(k48Value, causalityK3, database);
        (0, leader_causality_semantics_1.assertPinnedCharacterLeaderCausalitySemantics)(scope, causalityK3, database, native);
        const report = (0, leader_causality_semantics_1.buildCharacterLeaderCausalitySemanticsReport)(k48Value.identity, causalityK3Identity, databaseIdentity, native, scope);
        beforeK3Value = undefined;
        targetK3 = undefined;
        causalityK3 = undefined;
        database = undefined;
        global.gc();
        rss.sample();
        let afterNative = await (0, leader_causality_semantics_source_1.loadCharacterLeaderCausalityNativeProof)(options.nativeRuntime);
        (0, leader_causality_semantics_source_1.assertLeaderCausalityNativeStable)(native, afterNative);
        native = undefined;
        afterNative = undefined;
        let afterDatabase = await (0, leader_causality_semantics_source_1.loadPinnedLeaderCausalityDatabase)(options.database);
        (0, leader_causality_semantics_source_1.assertLeaderCausalityDatabaseStable)(databaseIdentity, afterDatabase.identity);
        afterDatabase = undefined;
        let afterCausalityK3 = await (0, leader_causality_semantics_source_1.loadPinnedK3LeaderCausalitySource)(options.sidecarRoot);
        (0, leader_causality_semantics_source_1.assertLeaderCausalityK3Stable)(causalityK3Identity, afterCausalityK3.identity);
        afterCausalityK3 = undefined;
        global.gc();
        rss.sample();
        let afterK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO")
            throw new Error("K52 final K48 source-bound validation failed");
        const afterK48Value = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(afterK48.artifacts), afterK48Target = (0, leader_target_semantics_source_1.compactK48LeaderTargetSource)(afterK48.artifacts);
        (0, leader_value_scope_source_1.assertLeaderValueK48Stable)(k48Value.identity, afterK48Value.identity);
        (0, leader_causality_semantics_source_1.assertLeaderCausalityK48TargetStable)(k48Target, afterK48Target);
        afterK48 = undefined;
        global.gc();
        rss.sample();
        let afterK3Value = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        (0, leader_value_scope_source_1.assertLeaderValueK3Stable)(k3ValueIdentity, afterK3Value.identity);
        (0, leader_value_scope_1.assertPinnedCharacterLeaderValueScope)((0, leader_value_scope_1.evaluateCharacterLeaderValueScope)(afterK48Value, afterK3Value));
        let afterTargetNative = await (0, leader_target_semantics_source_1.loadCharacterLeaderTargetNativeProof)(options.nativeRuntime);
        (0, leader_target_semantics_source_1.assertLeaderTargetNativeStable)(targetNative, afterTargetNative);
        (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)((0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(afterK48Value, afterK3Value), afterTargetNative.k50);
        let afterTargetK3 = await (0, leader_target_semantics_source_1.loadPinnedK3LeaderTargetSource)(options.sidecarRoot);
        (0, leader_target_semantics_source_1.assertLeaderTargetK3Stable)(targetK3Identity, afterTargetK3.identity);
        (0, leader_target_semantics_1.assertPinnedCharacterLeaderTargetSemantics)((0, leader_target_semantics_1.evaluateCharacterLeaderTargetSemantics)(afterK48Target, afterK3Value, afterTargetK3), afterTargetNative);
        afterK3Value = undefined;
        afterTargetNative = undefined;
        afterTargetK3 = undefined;
        targetNative = undefined;
        global.gc();
        rss.stop();
        return authorize(report);
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderCausalitySemanticsAudit = runCharacterLeaderCausalitySemanticsAudit;
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
        throw new Error(`K52 requires ${name}`);
    return result;
}
function parseCharacterLeaderCausalitySemanticsCli(args) {
    const values = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database"];
    const allowed = new Set(["--opt-in-k52", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K52 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k52") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k52").length !== 1)
        throw new Error("K52 requires exactly one --opt-in-k52");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"), nativeRuntime: required(args, "--native-runtime"), database: required(args, "--database"),
    };
}
exports.parseCharacterLeaderCausalitySemanticsCli = parseCharacterLeaderCausalitySemanticsCli;
async function run() {
    const report = await runCharacterLeaderCausalitySemanticsAudit(parseCharacterLeaderCausalitySemanticsCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES)
        throw new Error("K52 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-causality-semantics-run.js.map