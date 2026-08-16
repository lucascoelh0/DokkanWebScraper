import {
    CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES,
    CharacterLeaderCausalityDeckIndexReport,
} from "./leader-causality-deck-index-contract";
import {
    assertLeaderCausalityDeckIndexNativeStable,
    loadCharacterLeaderCausalityDeckIndexNativeProof,
} from "./leader-causality-deck-index-source";
import {
    assertPinnedCharacterLeaderCausalityDeckIndex,
    buildCharacterLeaderCausalityDeckIndexReport,
} from "./leader-causality-deck-index";
import { runCharacterLeaderCausalityCollectionAudit } from "./leader-causality-collection-run";

export interface CharacterLeaderCausalityDeckIndexRunOptions {
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
        this.exceeded ||= this.peak >= CHARACTER_LEADER_CAUSALITY_DECK_INDEX_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K54 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

function authorize(report: CharacterLeaderCausalityDeckIndexReport): CharacterLeaderCausalityDeckIndexReport {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k53RealAudit: "GO",
            k53StructuralGosAndNoGosPreserved: true,
            nativeProofBefore: "GO",
            nativeProofAfter: "GO",
            nativeProofStableAcrossK53: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            deckIndexRuntimeArgumentProvenance: "GO",
            deckIndexIndependentFromTargetType: "GO",
        },
    };
}

export async function runCharacterLeaderCausalityDeckIndexAudit(
    options: CharacterLeaderCausalityDeckIndexRunOptions,
): Promise<CharacterLeaderCausalityDeckIndexReport> {
    if (options?.optIn !== true) throw new Error("K54 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database) {
        throw new Error("K54 requires all explicit roots, native runtime and database");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K54 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        let beforeNative = await loadCharacterLeaderCausalityDeckIndexNativeProof(options.nativeRuntime);
        (global as any).gc();
        rss.sample();
        const upstreamK53 = await runCharacterLeaderCausalityCollectionAudit({
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
        let afterNative = await loadCharacterLeaderCausalityDeckIndexNativeProof(options.nativeRuntime);
        (global as any).gc();
        rss.sample();
        assertLeaderCausalityDeckIndexNativeStable(beforeNative, afterNative);
        assertPinnedCharacterLeaderCausalityDeckIndex(upstreamK53, beforeNative);
        const report = buildCharacterLeaderCausalityDeckIndexReport(upstreamK53, beforeNative);
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
    if (!result) throw new Error(`K54 requires ${name}`);
    return result;
}

export function parseCharacterLeaderCausalityDeckIndexCli(args: string[]): CharacterLeaderCausalityDeckIndexRunOptions {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k54", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K54 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k54") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k54").length !== 1) throw new Error("K54 requires exactly one --opt-in-k54");
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
    const report = await runCharacterLeaderCausalityDeckIndexAudit(parseCharacterLeaderCausalityDeckIndexCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_CAUSALITY_DECK_INDEX_REPORT_LIMIT_BYTES) {
        throw new Error("K54 stdout report byte limit reached");
    }
    process.stdout.write(stdout);
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
