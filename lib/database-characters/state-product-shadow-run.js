"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterStateProductShadowCli = exports.runCharacterStateProductShadow = void 0;
const state_product_projection_1 = require("./state-product-projection");
const state_product_shadow_contract_1 = require("./state-product-shadow-contract");
const state_product_shadow_1 = require("./state-product-shadow");
function authorizeValidatedConsumer(consumer) {
    const report = Object.freeze({
        ...consumer.report,
        inputIntegrity: Object.freeze({
            ...consumer.report.inputIntegrity,
            k43ValidatedOnlyBySourceBoundApi: true,
            sourceBoundValidationBeforeLookup: "GO",
            sourceBoundValidationAfterLookup: "GO",
            exactK43ArtifactIdentityStable: true,
            exactSourceLineageStable: true,
        }),
        readiness: Object.freeze({ ...consumer.report.readiness, consumerShadow: "GO" }),
    });
    return Object.freeze({ report, lookup: consumer.lookup });
}
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_RSS_LIMIT_BYTES;
    }
    sample() { this.observe(); if (this.exceeded)
        throw new Error(`K44 RSS limit reached: ${this.peak}`); }
    stop() { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose() { clearInterval(this.timer); }
}
async function runCharacterStateProductShadow(options) {
    if (options?.optIn !== true)
        throw new Error("K44 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root)
        throw new Error("K44 requires all explicit roots");
    if (typeof global.gc !== "function")
        throw new Error("K44 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot };
        let before = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)(sourceOptions);
        (0, state_product_shadow_1.assertCharacterStateProductShadowSourceBound)(before);
        (0, state_product_shadow_1.assertPinnedCharacterStateProductShadowDataset)(before.artifacts.dataset);
        const consumer = (0, state_product_shadow_1.createCharacterStateProductShadowConsumer)(before.artifacts);
        const beforeFingerprint = (0, state_product_shadow_1.fingerprintCharacterStateProductShadowArtifact)(before.artifacts);
        rss.sample();
        before = undefined;
        global.gc?.();
        let after = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)(sourceOptions);
        (0, state_product_shadow_1.assertCharacterStateProductShadowSourceBound)(after);
        (0, state_product_shadow_1.assertPinnedCharacterStateProductShadowDataset)(after.artifacts.dataset);
        (0, state_product_shadow_1.assertCharacterStateProductShadowArtifactStable)(beforeFingerprint, (0, state_product_shadow_1.fingerprintCharacterStateProductShadowArtifact)(after.artifacts));
        after = undefined;
        global.gc();
        rss.sample();
        rss.stop();
        return authorizeValidatedConsumer(consumer);
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterStateProductShadow = runCharacterStateProductShadow;
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
        throw new Error(`K44 requires ${name}`);
    return result;
}
function parseCharacterStateProductShadowCli(args) {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root"];
    const allowed = new Set(["--opt-in-k44", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K44 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k44") {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k44").length !== 1)
        throw new Error("K44 requires exactly one --opt-in-k44");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"),
    };
}
exports.parseCharacterStateProductShadowCli = parseCharacterStateProductShadowCli;
async function run() {
    const consumer = await runCharacterStateProductShadow(parseCharacterStateProductShadowCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(consumer.report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= state_product_shadow_contract_1.CHARACTER_STATE_PRODUCT_SHADOW_REPORT_LIMIT_BYTES)
        throw new Error("K44 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=state-product-shadow-run.js.map