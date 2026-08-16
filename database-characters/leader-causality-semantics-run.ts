import {
    CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES,
    CharacterLeaderCausalitySemanticsReport,
} from "./leader-causality-semantics-contract";
import {
    assertLeaderCausalityDatabaseStable,
    assertLeaderCausalityK3Stable,
    assertLeaderCausalityK48TargetStable,
    assertLeaderCausalityNativeStable,
    loadCharacterLeaderCausalityNativeProof,
    loadPinnedK3LeaderCausalitySource,
    loadPinnedLeaderCausalityDatabase,
} from "./leader-causality-semantics-source";
import {
    assertPinnedCharacterLeaderCausalitySemantics,
    buildCharacterLeaderCausalitySemanticsReport,
    evaluateCharacterLeaderCausalitySemantics,
} from "./leader-causality-semantics";
import { validateCharacterLeaderAssociationProjectionArtifact } from "./leader-association-projection";
import { assertPinnedCharacterLeaderNativeSemantics, evaluateCharacterLeaderNativeSemantics } from "./leader-native-semantics";
import {
    assertLeaderTargetK3Stable,
    assertLeaderTargetNativeStable,
    compactK48LeaderTargetSource,
    loadCharacterLeaderTargetNativeProof,
    loadPinnedK3LeaderTargetSource,
} from "./leader-target-semantics-source";
import { assertPinnedCharacterLeaderTargetSemantics, evaluateCharacterLeaderTargetSemantics } from "./leader-target-semantics";
import {
    assertLeaderValueK3Stable,
    assertLeaderValueK48Stable,
    compactK48LeaderValueSource,
    loadPinnedK3LeaderValueSource,
} from "./leader-value-scope-source";
import { assertPinnedCharacterLeaderValueScope, evaluateCharacterLeaderValueScope } from "./leader-value-scope";

export interface CharacterLeaderCausalitySemanticsRunOptions {
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
        this.exceeded ||= this.peak >= CHARACTER_LEADER_CAUSALITY_SEMANTICS_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K52 RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}
function authorize(report: CharacterLeaderCausalitySemanticsReport): CharacterLeaderCausalitySemanticsReport {
    return {
        ...report,
        inputIntegrity: {
            ...report.inputIntegrity,
            k48SourceBoundBefore: "GO",
            k48SourceBoundAfter: "GO",
            k48K3DatabaseAndNativeStable: true,
            rssStayedBelowExclusiveLimit: true,
        },
        readiness: {
            ...report.readiness,
            leaderCausalityStructuralSemantics: "GO",
            type35StructuralCondition: "GO",
        },
    };
}
export async function runCharacterLeaderCausalitySemanticsAudit(
    options: CharacterLeaderCausalitySemanticsRunOptions,
): Promise<CharacterLeaderCausalitySemanticsReport> {
    if (options?.optIn !== true) throw new Error("K52 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.nativeRuntime || !options.database) throw new Error("K52 requires all explicit roots, native runtime and database");
    if (typeof (global as any).gc !== "function") throw new Error("K52 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        const sourceOptions = {
            artifactRoot: options.k48Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root,
        };
        let beforeK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (beforeK48.sourceBoundValidation !== "GO") throw new Error("K52 requires K48 source-bound GO");
        const k48Value = compactK48LeaderValueSource(beforeK48.artifacts);
        const k48Target = compactK48LeaderTargetSource(beforeK48.artifacts);
        beforeK48 = undefined as any; (global as any).gc(); rss.sample();

        let beforeK3Value = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
        const k3ValueIdentity = beforeK3Value.identity;
        assertPinnedCharacterLeaderValueScope(evaluateCharacterLeaderValueScope(k48Value, beforeK3Value));
        let targetNative = await loadCharacterLeaderTargetNativeProof(options.nativeRuntime);
        assertPinnedCharacterLeaderNativeSemantics(evaluateCharacterLeaderNativeSemantics(k48Value, beforeK3Value), targetNative.k50);
        let targetK3 = await loadPinnedK3LeaderTargetSource(options.sidecarRoot);
        const targetK3Identity = targetK3.identity;
        assertPinnedCharacterLeaderTargetSemantics(evaluateCharacterLeaderTargetSemantics(k48Target, beforeK3Value, targetK3), targetNative);

        let causalityK3 = await loadPinnedK3LeaderCausalitySource(options.sidecarRoot);
        const causalityK3Identity = causalityK3.identity;
        let database = await loadPinnedLeaderCausalityDatabase(options.database);
        const databaseIdentity = database.identity;
        let native = await loadCharacterLeaderCausalityNativeProof(options.nativeRuntime);
        const scope = evaluateCharacterLeaderCausalitySemantics(k48Value, causalityK3, database);
        assertPinnedCharacterLeaderCausalitySemantics(scope, causalityK3, database, native);
        const report = buildCharacterLeaderCausalitySemanticsReport(k48Value.identity, causalityK3Identity, databaseIdentity, native, scope);
        beforeK3Value = undefined as any; targetK3 = undefined as any; causalityK3 = undefined as any; database = undefined as any;
        (global as any).gc(); rss.sample();

        let afterNative = await loadCharacterLeaderCausalityNativeProof(options.nativeRuntime);
        assertLeaderCausalityNativeStable(native, afterNative); native = undefined as any; afterNative = undefined as any;
        let afterDatabase = await loadPinnedLeaderCausalityDatabase(options.database);
        assertLeaderCausalityDatabaseStable(databaseIdentity, afterDatabase.identity); afterDatabase = undefined as any;
        let afterCausalityK3 = await loadPinnedK3LeaderCausalitySource(options.sidecarRoot);
        assertLeaderCausalityK3Stable(causalityK3Identity, afterCausalityK3.identity); afterCausalityK3 = undefined as any;
        (global as any).gc(); rss.sample();

        let afterK48 = await validateCharacterLeaderAssociationProjectionArtifact(sourceOptions);
        if (afterK48.sourceBoundValidation !== "GO") throw new Error("K52 final K48 source-bound validation failed");
        const afterK48Value = compactK48LeaderValueSource(afterK48.artifacts), afterK48Target = compactK48LeaderTargetSource(afterK48.artifacts);
        assertLeaderValueK48Stable(k48Value.identity, afterK48Value.identity);
        assertLeaderCausalityK48TargetStable(k48Target, afterK48Target);
        afterK48 = undefined as any; (global as any).gc(); rss.sample();
        let afterK3Value = await loadPinnedK3LeaderValueSource(options.sidecarRoot);
        assertLeaderValueK3Stable(k3ValueIdentity, afterK3Value.identity);
        assertPinnedCharacterLeaderValueScope(evaluateCharacterLeaderValueScope(afterK48Value, afterK3Value));
        let afterTargetNative = await loadCharacterLeaderTargetNativeProof(options.nativeRuntime);
        assertLeaderTargetNativeStable(targetNative, afterTargetNative);
        assertPinnedCharacterLeaderNativeSemantics(evaluateCharacterLeaderNativeSemantics(afterK48Value, afterK3Value), afterTargetNative.k50);
        let afterTargetK3 = await loadPinnedK3LeaderTargetSource(options.sidecarRoot);
        assertLeaderTargetK3Stable(targetK3Identity, afterTargetK3.identity);
        assertPinnedCharacterLeaderTargetSemantics(evaluateCharacterLeaderTargetSemantics(afterK48Target, afterK3Value, afterTargetK3), afterTargetNative);
        afterK3Value = undefined as any; afterTargetNative = undefined as any; afterTargetK3 = undefined as any; targetNative = undefined as any;
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
    const result = value(args, name); if (!result) throw new Error(`K52 requires ${name}`); return result;
}
export function parseCharacterLeaderCausalitySemanticsCli(args: string[]): CharacterLeaderCausalitySemanticsRunOptions {
    const values = ["--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--native-runtime", "--database"];
    const allowed = new Set(["--opt-in-k52", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K52 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k52") {
            const next = args[index + 1]; if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`); index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k52").length !== 1) throw new Error("K52 requires exactly one --opt-in-k52");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"), k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"), nativeRuntime: required(args, "--native-runtime"), database: required(args, "--database"),
    };
}
async function run(): Promise<void> {
    const report = await runCharacterLeaderCausalitySemanticsAudit(parseCharacterLeaderCausalitySemanticsCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_CAUSALITY_SEMANTICS_REPORT_LIMIT_BYTES) throw new Error("K52 stdout report byte limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
