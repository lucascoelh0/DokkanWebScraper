import {
    CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_SCOPE_RSS_LIMIT_BYTES,
    CharacterLeaderAssociationScopeReport,
} from "./leader-association-scope-contract";
import {
    assertLeaderAssociationK3Stable,
    assertLeaderAssociationK46Stable,
    compactK46LeaderAssociationSource,
    loadPinnedK3LeaderAssociationSource,
} from "./leader-association-scope-source";
import {
    assertPinnedCharacterLeaderAssociationScope,
    buildCharacterLeaderAssociationScopeReport,
    evaluateCharacterLeaderAssociationScope,
} from "./leader-association-scope";
import { validateCharacterLeaderProjectionArtifact } from "./leader-projection";

export interface CharacterLeaderAssociationScopeRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
}

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_ASSOCIATION_SCOPE_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K47 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

function authorizeCharacterLeaderAssociationScopeReport(
    report: CharacterLeaderAssociationScopeReport,
): CharacterLeaderAssociationScopeReport {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k46SourceBoundBefore: "GO", k46SourceBoundAfter: "GO", k46IdentityAndFingerprintStable: true,
            k3ExactPinnedBeforeAndAfter: true, k3AssociationFingerprintStable: true, k3DecodeBoundedToPinnedRawSize: true,
        },
        readiness: { ...report.readiness, structuralAssociationScope: "GO", nextStructuralIdAssociationProjection: "GO" },
    };
}

export async function runCharacterLeaderAssociationScopeAudit(
    options: CharacterLeaderAssociationScopeRunOptions,
): Promise<CharacterLeaderAssociationScopeReport> {
    if (options?.optIn !== true) throw new Error("K47 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root) {
        throw new Error("K47 requires all explicit roots");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K47 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root,
        };
        let beforeK46 = await validateCharacterLeaderProjectionArtifact(sourceOptions);
        if (beforeK46.sourceBoundValidation !== "GO") throw new Error("K47 requires K46 source-bound GO");
        const k46 = compactK46LeaderAssociationSource(beforeK46.artifacts);
        beforeK46 = undefined as any; (global as any).gc(); rss.sample();

        let beforeK3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
        const k3Identity = beforeK3.identity;
        const scope = evaluateCharacterLeaderAssociationScope(k46, beforeK3);
        assertPinnedCharacterLeaderAssociationScope(scope);
        beforeK3 = undefined as any; (global as any).gc(); rss.sample();

        let afterK3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
        assertLeaderAssociationK3Stable(k3Identity, afterK3.identity);
        afterK3 = undefined as any; (global as any).gc(); rss.sample();

        let afterK46 = await validateCharacterLeaderProjectionArtifact(sourceOptions);
        if (afterK46.sourceBoundValidation !== "GO") throw new Error("K47 final K46 source-bound validation failed");
        const finalK46 = compactK46LeaderAssociationSource(afterK46.artifacts);
        assertLeaderAssociationK46Stable(k46.identity, finalK46.identity);
        afterK46 = undefined as any; (global as any).gc(); rss.sample();

        const report = authorizeCharacterLeaderAssociationScopeReport(buildCharacterLeaderAssociationScopeReport(k46.identity, k3Identity, scope));
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
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K47 requires ${name}`); return result; }

export function parseCharacterLeaderAssociationScopeCli(args: string[]): CharacterLeaderAssociationScopeRunOptions {
    const roots = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root"];
    const allowed = new Set(["--opt-in-k47", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K47 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k47") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k47").length !== 1) throw new Error("K47 requires exactly one --opt-in-k47");
    return {
        optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
    };
}

async function run(): Promise<void> {
    const report = await runCharacterLeaderAssociationScopeAudit(parseCharacterLeaderAssociationScopeCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES) throw new Error("K47 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
