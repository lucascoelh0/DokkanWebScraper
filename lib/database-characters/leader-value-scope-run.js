"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderValueScopeCli = exports.runCharacterLeaderValueScopeAudit = void 0;
const leader_value_scope_contract_1 = require("./leader-value-scope-contract");
const leader_value_scope_source_1 = require("./leader-value-scope-source");
const leader_value_scope_1 = require("./leader-value-scope");
const leader_association_projection_1 = require("./leader-association-projection");
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES;
    }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K49 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
function authorizeCharacterLeaderValueScopeReport(report) {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity, k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48IdentityAndFingerprintStable: true,
            k3ExactPinnedBeforeAndAfter: true, k3ValueFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: { ...report.readiness, leaderValueScope: "GO" },
    };
}
async function runCharacterLeaderValueScopeAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K49 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.k48Root) {
        throw new Error("K49 requires all explicit roots");
    }
    if (typeof global.gc !== "function")
        throw new Error("K49 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root,
        };
        let beforeK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO")
            throw new Error("K49 requires K48 source-bound GO");
        const k48 = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(beforeK48.artifacts);
        beforeK48 = undefined;
        global.gc();
        rss.sample();
        let beforeK3 = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        const k3Identity = beforeK3.identity;
        const scope = (0, leader_value_scope_1.evaluateCharacterLeaderValueScope)(k48, beforeK3);
        (0, leader_value_scope_1.assertPinnedCharacterLeaderValueScope)(scope);
        beforeK3 = undefined;
        global.gc();
        rss.sample();
        let afterK3 = await (0, leader_value_scope_source_1.loadPinnedK3LeaderValueSource)(options.sidecarRoot);
        (0, leader_value_scope_source_1.assertLeaderValueK3Stable)(k3Identity, afterK3.identity);
        afterK3 = undefined;
        global.gc();
        rss.sample();
        let afterK48 = await (0, leader_association_projection_1.validateCharacterLeaderAssociationProjectionArtifact)(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO")
            throw new Error("K49 final K48 source-bound validation failed");
        const finalK48 = (0, leader_value_scope_source_1.compactK48LeaderValueSource)(afterK48.artifacts);
        (0, leader_value_scope_source_1.assertLeaderValueK48Stable)(k48.identity, finalK48.identity);
        afterK48 = undefined;
        global.gc();
        rss.sample();
        const report = authorizeCharacterLeaderValueScopeReport((0, leader_value_scope_1.buildCharacterLeaderValueScopeReport)(k48.identity, k3Identity, scope));
        rss.stop();
        return report;
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderValueScopeAudit = runCharacterLeaderValueScopeAudit;
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
function required(args, name) { const result = value(args, name); if (!result)
    throw new Error(`K49 requires ${name}`); return result; }
function parseCharacterLeaderValueScopeCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root"];
    const allowed = new Set(["--opt-in-k49", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K49 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k49") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k49").length !== 1)
        throw new Error("K49 requires exactly one --opt-in-k49");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
    };
}
exports.parseCharacterLeaderValueScopeCli = parseCharacterLeaderValueScopeCli;
async function run() {
    const report = await runCharacterLeaderValueScopeAudit(parseCharacterLeaderValueScopeCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_value_scope_contract_1.CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES)
        throw new Error("K49 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-value-scope-run.js.map