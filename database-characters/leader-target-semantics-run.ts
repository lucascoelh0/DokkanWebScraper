import { CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES, CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES, CharacterLeaderTargetSemanticsReport } from "./leader-target-semantics-contract";
import { assertLeaderTargetK3Stable, assertLeaderTargetNativeStable, compactK48LeaderTargetSource, loadCharacterLeaderTargetNativeProof, loadPinnedK3LeaderTargetSource } from "./leader-target-semantics-source";
import { assertPinnedCharacterLeaderTargetSemantics, buildCharacterLeaderTargetSemanticsReport, evaluateCharacterLeaderTargetSemantics } from "./leader-target-semantics";
import { assertPinnedCharacterLeaderNativeSemantics, evaluateCharacterLeaderNativeSemantics } from "./leader-native-semantics";
import { assertLeaderValueK3Stable, assertLeaderValueK48Stable, compactK48LeaderValueSource, loadPinnedK3LeaderValueSource } from "./leader-value-scope-source";
import { assertPinnedCharacterLeaderValueScope, evaluateCharacterLeaderValueScope } from "./leader-value-scope";
import { validateCharacterLeaderAssociationProjectionArtifact } from "./leader-association-projection";

export interface CharacterLeaderTargetSemanticsRunOptions { optIn: true; sidecarRoot: string; productionRoot: string; fyiRoot: string; k43Root: string; k46Root: string; k48Root: string; nativeRuntime: string }
class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); private exceeded = false; private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); } private observe(): void { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= CHARACTER_LEADER_TARGET_SEMANTICS_RSS_LIMIT_BYTES; }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K51 RSS limit reached: ${this.peak}`); } stop(): number { clearInterval(this.timer); this.sample(); return this.peak; } dispose(): void { clearInterval(this.timer); }
}
function authorize(report: CharacterLeaderTargetSemanticsReport): CharacterLeaderTargetSemanticsReport { return { ...report, inputIntegrity: { ...report.inputIntegrity, k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48K3NativeAndTargetRowsStable: true }, readiness: { ...report.readiness, leaderTargetSemantics: "GO", type82TargetAndCategoryFilters: "GO" } }; }
export async function runCharacterLeaderTargetSemanticsAudit(options: CharacterLeaderTargetSemanticsRunOptions): Promise<CharacterLeaderTargetSemanticsReport> {
    if (options?.optIn !== true) throw new Error("K51 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.k48Root || !options.nativeRuntime) throw new Error("K51 requires all explicit roots and native runtime");
    if (typeof (global as any).gc !== "function") throw new Error("K51 requires Node --expose-gc"); const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
        let beforeK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions); if (beforeK48.sourceBoundValidation !== "GO") throw new Error("K51 requires K48 source-bound GO");
        const k48Value = compactK48LeaderValueSource(beforeK48.artifacts), k48Target = compactK48LeaderTargetSource(beforeK48.artifacts); beforeK48 = undefined as any; (global as any).gc(); rss.sample();
        let beforeK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot); const k3Identity = beforeK3.identity;
        assertPinnedCharacterLeaderValueScope(evaluateCharacterLeaderValueScope(k48Value, beforeK3));
        let native = await loadCharacterLeaderTargetNativeProof(options.nativeRuntime);
        assertPinnedCharacterLeaderNativeSemantics(evaluateCharacterLeaderNativeSemantics(k48Value, beforeK3), native.k50);
        let targetK3 = await loadPinnedK3LeaderTargetSource(options.sidecarRoot); const targetIdentity = targetK3.identity;
        const scope = evaluateCharacterLeaderTargetSemantics(k48Target, beforeK3, targetK3); assertPinnedCharacterLeaderTargetSemantics(scope, native);
        beforeK3 = undefined as any; targetK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterNative = await loadCharacterLeaderTargetNativeProof(options.nativeRuntime); assertLeaderTargetNativeStable(native, afterNative); afterNative = undefined as any; (global as any).gc(); rss.sample();
        let afterK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot); assertLeaderValueK3Stable(k3Identity, afterK3.identity); afterK3 = undefined as any;
        let afterTargetK3 = await loadPinnedK3LeaderTargetSource(options.sidecarRoot); assertLeaderTargetK3Stable(targetIdentity, afterTargetK3.identity); afterTargetK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions); if (afterK48.sourceBoundValidation !== "GO") throw new Error("K51 final K48 source-bound validation failed");
        assertLeaderValueK48Stable(k48Value.identity, compactK48LeaderValueSource(afterK48.artifacts).identity); afterK48 = undefined as any; (global as any).gc(); rss.sample();
        const report = authorize(buildCharacterLeaderTargetSemanticsReport(k48Target.identity, k3Identity, targetIdentity.targetInputFingerprintSha256, native, scope)); rss.stop(); return report;
    } finally { rss.dispose(); }
}
function value(args: string[], name: string): string | undefined { const indexes = args.flatMap((item, index) => item === name ? [index] : []); if (indexes.length > 1) throw new Error(`duplicate ${name}`); if (!indexes.length) return undefined; const result = args[indexes[0] + 1]; if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`); return result; }
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K51 requires ${name}`); return result; }
export function parseCharacterLeaderTargetSemanticsCli(args: string[]): CharacterLeaderTargetSemanticsRunOptions {
    const values = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime"], allowed = new Set(["--opt-in-k51", ...values]);
    for (let index = 0; index < args.length; index++) { const argument = args[index]; if (!allowed.has(argument)) throw new Error(`K51 unsupported argument ${argument}`); if (argument !== "--opt-in-k51") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; } }
    if (args.filter(item => item === "--opt-in-k51").length !== 1) throw new Error("K51 requires exactly one --opt-in-k51"); return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"), k48Root: required(args, "--k48-root"), nativeRuntime: required(args, "--native-runtime") };
}
async function run(): Promise<void> { const report = await runCharacterLeaderTargetSemanticsAudit(parseCharacterLeaderTargetSemanticsCli(process.argv.slice(2))); const stdout = `${JSON.stringify(report, null, 2)}\n`; if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES) throw new Error("K51 stdout report byte limit reached"); process.stdout.write(stdout); }
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
