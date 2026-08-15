"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderScopeCli = exports.runCharacterLeaderScopeAudit = void 0;
const state_product_projection_1 = require("./state-product-projection");
const leader_scope_contract_1 = require("./leader-scope-contract");
const leader_scope_source_1 = require("./leader-scope-source");
const leader_scope_1 = require("./leader-scope");
function authorizeCharacterLeaderScopeReport(report) {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k43SourceBoundBefore: "GO",
            k43SourceBoundAfter: "GO",
            k43IdentityAndFingerprintStable: true,
            k3ExactPinnedFilesBeforeAndAfter: true,
            k3IdentityAndFingerprintStable: true,
            k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: { ...report.readiness, structuralScope: "GO", nextStructuralIdOnlyProjection: "GO" },
    };
}
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= leader_scope_contract_1.CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES; }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K45 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function runCharacterLeaderScopeAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K45 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root)
        throw new Error("K45 requires all explicit roots");
    if (typeof global.gc !== "function")
        throw new Error("K45 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot };
        let k43Validated = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)(sourceOptions);
        if (k43Validated.sourceBoundValidation !== "GO")
            throw new Error("K45 requires K43 source-bound validation GO");
        const k43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(k43Validated.artifacts);
        if (k43.states.length !== leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.includedStates)
            throw new Error("K45 K43 state pin changed");
        k43Validated = undefined;
        global.gc();
        rss.sample();
        let k3Before = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
        if (k3Before.states.length !== leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.k3States)
            throw new Error("K45 K3 state pin changed");
        const k3Identity = k3Before.identity;
        const scope = (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(k43.states, k3Before.states);
        (0, leader_scope_1.assertPinnedCharacterLeaderScope)(scope);
        k3Before = undefined;
        global.gc();
        rss.sample();
        let k3After = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
        (0, leader_scope_source_1.assertK3LeaderScopeSourceStable)(k3Identity, k3After.identity);
        k3After = undefined;
        global.gc();
        rss.sample();
        let k43After = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)(sourceOptions);
        if (k43After.sourceBoundValidation !== "GO")
            throw new Error("K45 final K43 source-bound validation failed");
        const finalK43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(k43After.artifacts);
        (0, leader_scope_source_1.assertK43LeaderScopeSourceStable)(k43.identity, finalK43.identity);
        k43After = undefined;
        global.gc();
        rss.sample();
        const report = authorizeCharacterLeaderScopeReport((0, leader_scope_1.buildCharacterLeaderScopeReport)(k43.identity, k3Identity, scope));
        rss.stop();
        return report;
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterLeaderScopeAudit = runCharacterLeaderScopeAudit;
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
    throw new Error(`K45 requires ${name}`); return result; }
function parseCharacterLeaderScopeCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root"];
    const allowed = new Set(["--opt-in-k45", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K45 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k45") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k45").length !== 1)
        throw new Error("K45 requires exactly one --opt-in-k45");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root") };
}
exports.parseCharacterLeaderScopeCli = parseCharacterLeaderScopeCli;
async function run() {
    const report = await runCharacterLeaderScopeAudit(parseCharacterLeaderScopeCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_scope_contract_1.CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES)
        throw new Error("K45 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-scope-run.js.map