import {
    CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_NATIVE_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderNativeSemanticsReport,
} from "./leader-native-semantics-contract";
import { assertCharacterLeaderNativeProofStable, loadCharacterLeaderNativeProof } from "./leader-native-semantics-source";
import { assertPinnedCharacterLeaderNativeSemantics, buildCharacterLeaderNativeSemanticsReport, evaluateCharacterLeaderNativeSemantics } from "./leader-native-semantics";
import { assertLeaderValueK3Stable, assertLeaderValueK48Stable, compactK48LeaderValueSource, loadPinnedK3LeaderValueSource } from "./leader-value-scope-source";
import { assertPinnedCharacterLeaderValueScope, evaluateCharacterLeaderValueScope } from "./leader-value-scope";
import { validateCharacterLeaderAssociationProjectionArtifact } from "./leader-association-projection";

export interface CharacterLeaderNativeSemanticsRunOptions {
    optIn: true; sidecarRoot: string; productionRoot: string; fyiRoot: string; k43Root: string; k46Root: string; k48Root: string; nativeRuntime: string;
}
class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void { this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); this.exceeded ||= this.peak >= CHARACTER_LEADER_NATIVE_SEMANTICS_RSS_LIMIT_BYTES; }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K50 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}
function authorize(report: CharacterLeaderNativeSemanticsReport): CharacterLeaderNativeSemanticsReport {
    return {
        ...report,
        inputIntegrity: { ...report.inputIntegrity, k48SourceBoundBefore: "GO", k48SourceBoundAfter: "GO", k48AndK3Stable: true, nativeExactPinnedBeforeAndAfter: true },
        readiness: { ...report.readiness, nativeLeaderSemantics: "GO", type82FieldSemantics: "GO" },
    };
}
export async function runCharacterLeaderNativeSemanticsAudit(options: CharacterLeaderNativeSemanticsRunOptions): Promise<CharacterLeaderNativeSemanticsReport> {
    if (options?.optIn !== true) throw new Error("K50 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root || !options.k48Root || !options.nativeRuntime) throw new Error("K50 requires all explicit roots and native runtime");
    if (typeof (global as any).gc !== "function") throw new Error("K50 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = { artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
        let beforeK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO") throw new Error("K50 requires K48 source-bound GO");
        const k48 = compactK48LeaderValueSource(beforeK48.artifacts);
        beforeK48 = undefined as any; (global as any).gc(); rss.sample();
        let beforeK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
        const k3Identity = beforeK3.identity;
        const k49Scope = evaluateCharacterLeaderValueScope(k48, beforeK3); assertPinnedCharacterLeaderValueScope(k49Scope);
        let native = await loadCharacterLeaderNativeProof(options.nativeRuntime);
        const scope = evaluateCharacterLeaderNativeSemantics(k48, beforeK3); assertPinnedCharacterLeaderNativeSemantics(scope, native);
        beforeK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterNative = await loadCharacterLeaderNativeProof(options.nativeRuntime); assertCharacterLeaderNativeProofStable(native, afterNative);
        afterNative = undefined as any; (global as any).gc(); rss.sample();
        let afterK3 = await loadPinnedK3LeaderValueSource(options.sidecarRoot); assertLeaderValueK3Stable(k3Identity, afterK3.identity);
        afterK3 = undefined as any; (global as any).gc(); rss.sample();
        let afterK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO") throw new Error("K50 final K48 source-bound validation failed");
        const finalK48 = compactK48LeaderValueSource(afterK48.artifacts); assertLeaderValueK48Stable(k48.identity, finalK48.identity);
        afterK48 = undefined as any; (global as any).gc(); rss.sample();
        const report = authorize(buildCharacterLeaderNativeSemanticsReport(k48.identity, k3Identity, native, scope));
        rss.stop(); return report;
    } finally { rss.dispose(); }
}
function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []); if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined; const result = args[indexes[0] + 1]; if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`); return result;
}
function required(args: string[], name: string): string { const result = value(args, name); if (!result) throw new Error(`K50 requires ${name}`); return result; }
export function parseCharacterLeaderNativeSemanticsCli(args: string[]): CharacterLeaderNativeSemanticsRunOptions {
    const values = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime"];
    const allowed = new Set(["--opt-in-k50", ...values]);
    for (let index = 0; index < args.length; index++) { const argument = args[index]; if (!allowed.has(argument)) throw new Error(`K50 unsupported argument ${argument}`); if (argument !== "--opt-in-k50") { const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++; } }
    if (args.filter(item => item === "--opt-in-k50").length !== 1) throw new Error("K50 requires exactly one --opt-in-k50");
    return { optIn: true, sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"), fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"), k48Root: required(args, "--k48-root"), nativeRuntime: required(args, "--native-runtime") };
}
async function run(): Promise<void> {
    const report = await runCharacterLeaderNativeSemanticsAudit(parseCharacterLeaderNativeSemanticsCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`; if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES) throw new Error("K50 stdout report byte limit reached"); process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
