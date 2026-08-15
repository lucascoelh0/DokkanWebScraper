import { validateCharacterStateProductProjectionArtifact } from "./state-product-projection";
import {
    CHARACTER_LEADER_SCOPE_PIN,
    CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES,
    CharacterLeaderScopeReport,
} from "./leader-scope-contract";
import {
    assertK3LeaderScopeSourceStable,
    assertK43LeaderScopeSourceStable,
    compactK43LeaderScopeSource,
    loadPinnedK3LeaderScopeSource,
} from "./leader-scope-source";
import { assertPinnedCharacterLeaderScope, buildCharacterLeaderScopeReport, evaluateCharacterLeaderStructuralScope } from "./leader-scope";

export interface CharacterLeaderScopeRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
}

function authorizeCharacterLeaderScopeReport(report: CharacterLeaderScopeReport): CharacterLeaderScopeReport {
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
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= CHARACTER_LEADER_SCOPE_RSS_LIMIT_BYTES; }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K45 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export async function runCharacterLeaderScopeAudit(options: CharacterLeaderScopeRunOptions): Promise<CharacterLeaderScopeReport> {
    if (options?.optIn !== true) throw new Error("K45 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root) throw new Error("K45 requires all explicit roots");
    if (typeof (global as any).gc !== "function") throw new Error("K45 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot };
        let k43Validated = await validateCharacterStateProductProjectionArtifact(sourceOptions);
        if (k43Validated.sourceBoundValidation !== "GO") throw new Error("K45 requires K43 source-bound validation GO");
        const k43 = compactK43LeaderScopeSource(k43Validated.artifacts);
        if (k43.states.length !== CHARACTER_LEADER_SCOPE_PIN.includedStates) throw new Error("K45 K43 state pin changed");
        k43Validated = undefined as any;
        (global as any).gc();
        rss.sample();

        let k3Before = await loadPinnedK3LeaderScopeSource(options.sidecarRoot);
        if (k3Before.states.length !== CHARACTER_LEADER_SCOPE_PIN.k3States) throw new Error("K45 K3 state pin changed");
        const k3Identity = k3Before.identity;
        const scope = evaluateCharacterLeaderStructuralScope(k43.states, k3Before.states);
        assertPinnedCharacterLeaderScope(scope);
        k3Before = undefined as any;
        (global as any).gc();
        rss.sample();

        let k3After = await loadPinnedK3LeaderScopeSource(options.sidecarRoot);
        assertK3LeaderScopeSourceStable(k3Identity, k3After.identity);
        k3After = undefined as any;
        (global as any).gc();
        rss.sample();

        let k43After = await validateCharacterStateProductProjectionArtifact(sourceOptions);
        if (k43After.sourceBoundValidation !== "GO") throw new Error("K45 final K43 source-bound validation failed");
        const finalK43 = compactK43LeaderScopeSource(k43After.artifacts);
        assertK43LeaderScopeSourceStable(k43.identity, finalK43.identity);
        k43After = undefined as any;
        (global as any).gc();
        rss.sample();
        const report = authorizeCharacterLeaderScopeReport(buildCharacterLeaderScopeReport(k43.identity, k3Identity, scope));
        rss.stop();
        return report;
    } finally { rss.dispose(); }
}

function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K45 requires ${name}`); return result; }

export function parseCharacterLeaderScopeCli(args: string[]): CharacterLeaderScopeRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root"];
    const allowed = new Set(["--opt-in-k45", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K45 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k45") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; }
    }
    if (args.filter(item => item === "--opt-in-k45").length !== 1) throw new Error("K45 requires exactly one --opt-in-k45");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root") };
}

async function run(): Promise<void> {
    const report = await runCharacterLeaderScopeAudit(parseCharacterLeaderScopeCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SCOPE_REPORT_LIMIT_BYTES) throw new Error("K45 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
