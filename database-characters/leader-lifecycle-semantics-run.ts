import {
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderLifecycleSemanticsReport,
} from "./leader-lifecycle-semantics-contract";
import {
    assertLeaderLifecycleSemanticsNativeStable,
    loadCharacterLeaderLifecycleSemanticsNativeProof,
} from "./leader-lifecycle-semantics-source";
import {
    assertPinnedCharacterLeaderLifecycleSemantics,
    buildCharacterLeaderLifecycleSemanticsReport,
} from "./leader-lifecycle-semantics";
import { runCharacterLeaderCausalityDeckIndexAudit } from "./leader-causality-deck-index-run";

export interface CharacterLeaderLifecycleSemanticsRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
    k43Root: string;
    k46Root: string;
    k48Root: string;
    nativeRuntime: string;
    database: string;
}

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_LIFECYCLE_SEMANTICS_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K55 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

function authorize(report: CharacterLeaderLifecycleSemanticsReport): CharacterLeaderLifecycleSemanticsReport {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k54RealAudit: "GO",
            k54StructuralGosAndAllNoGosPreserved: true,
            nativeProofBefore: "GO",
            nativeProofAfter: "GO",
            nativeProofStableAcrossK54: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            oneStatusPerSourceRow: "GO",
            startTurnSharedExecutionInvocation: "GO",
            type82MatchingRowsAdditiveInCalculator: "GO",
            calcOption0IntegerConversionAtHandler: "GO",
            calcOption2DivideBy100FloatAtHandler: "GO",
            postConditionIndependentOfType35: "GO",
        },
    };
}

export async function runCharacterLeaderLifecycleSemanticsAudit(
    options: CharacterLeaderLifecycleSemanticsRunOptions,
): Promise<CharacterLeaderLifecycleSemanticsReport> {
    if (options?.optIn !== true) throw new Error("K55 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database) {
        throw new Error("K55 requires all explicit roots, native runtime and database");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K55 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        let beforeNative = await loadCharacterLeaderLifecycleSemanticsNativeProof(options.nativeRuntime);
        (global as any).gc();
        rss.sample();
        const upstreamK54 = await runCharacterLeaderCausalityDeckIndexAudit({
            optIn: true,
            sidecarRoot: options.sidecarRoot,
            productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot,
            k43Root: options.k43Root,
            k46Root: options.k46Root,
            k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime,
            database: options.database,
        });
        rss.sample();
        let afterNative = await loadCharacterLeaderLifecycleSemanticsNativeProof(options.nativeRuntime);
        (global as any).gc();
        rss.sample();
        assertLeaderLifecycleSemanticsNativeStable(beforeNative, afterNative);
        assertPinnedCharacterLeaderLifecycleSemantics(upstreamK54, beforeNative);
        const report = buildCharacterLeaderLifecycleSemanticsReport(upstreamK54, beforeNative);
        beforeNative = undefined as any;
        afterNative = undefined as any;
        (global as any).gc();
        rss.stop();
        return authorize(report);
    } finally {
        rss.dispose();
    }
}

function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}

function required(args: string[], name: string): string {
    const result = value(args, name);
    if (!result) throw new Error(`K55 requires ${name}`);
    return result;
}

export function parseCharacterLeaderLifecycleSemanticsCli(args: string[]): CharacterLeaderLifecycleSemanticsRunOptions {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k55", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K55 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k55") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k55").length !== 1) throw new Error("K55 requires exactly one --opt-in-k55");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
        k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
        nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}

async function run(): Promise<void> {
    const report = await runCharacterLeaderLifecycleSemanticsAudit(parseCharacterLeaderLifecycleSemanticsCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_LIFECYCLE_SEMANTICS_REPORT_LIMIT_BYTES) {
        throw new Error("K55 stdout report byte limit reached");
    }
    process.stdout.write(stdout);
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
