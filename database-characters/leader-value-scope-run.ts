import {
    CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES,
    CharacterLeaderValueScopeReport,
} from "./leader-value-scope-contract";
import {
    assertLeaderValueK3Stable,
    assertLeaderValueK48Stable,
    compactK48LeaderValueSource,
    loadPinnedK3LeaderValueSource,
} from "./leader-value-scope-source";
import {
    assertPinnedCharacterLeaderValueScope,
    buildCharacterLeaderValueScopeReport,
    evaluateCharacterLeaderValueScope,
} from "./leader-value-scope";
import { validateCharacterLeaderAssociationProjectionArtifact } from "./leader-association-projection";

export interface CharacterLeaderValueScopeRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
    k48Root: string;
}
class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_VALUE_SCOPE_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K49 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}
function authorizeCharacterLeaderValueScopeReport(report: CharacterLeaderValueScopeReport): CharacterLeaderValueScopeReport {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity, k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48IdentityAndFingerprintStable: true,
            k3ExactPinnedBeforeAndAfter: true, k3ValueFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: { ...report.readiness, leaderValueScope: "GO" },
    };
}

export async function runCharacterLeaderValueScopeAudit(options: CharacterLeaderValueScopeRunOptions): Promise<CharacterLeaderValueScopeReport> {
    if (options?.optIn !== true) throw new Error("K49 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.k48Root) {
        throw new Error("K49 requires all explicit roots");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K49 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root,
        };
        let beforeK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO") throw new Error("K49 requires K48 source-bound GO");
        const k48 = compactK48LeaderValueSource(beforeK48.artifacts);
        beforeK48 = undefined as any; (global as any).gc(); rss.sample();
        let beforeK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
        const k3Identity = beforeK3.identity;
        const scope = evaluateCharacterLeaderValueScope(k48, beforeK3);
        assertPinnedCharacterLeaderValueScope(scope);
        beforeK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
        assertLeaderValueK3Stable(k3Identity, afterK3.identity);
        afterK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO") throw new Error("K49 final K48 source-bound validation failed");
        const finalK48 = compactK48LeaderValueSource(afterK48.artifacts);
        assertLeaderValueK48Stable(k48.identity, finalK48.identity);
        afterK48 = undefined as any; (global as any).gc(); rss.sample();
        const report = authorizeCharacterLeaderValueScopeReport(buildCharacterLeaderValueScopeReport(k48.identity, k3Identity, scope));
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
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K49 requires ${name}`); return result; }
export function parseCharacterLeaderValueScopeCli(args: string[]): CharacterLeaderValueScopeRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root"];
    const allowed = new Set(["--opt-in-k49", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K49 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k49") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; }
    }
    if (args.filter(item => item === "--opt-in-k49").length !== 1) throw new Error("K49 requires exactly one --opt-in-k49");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
    };
}
async function run(): Promise<void> {
    const report = await runCharacterLeaderValueScopeAudit(parseCharacterLeaderValueScopeCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES) throw new Error("K49 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
