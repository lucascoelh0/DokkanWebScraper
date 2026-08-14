import { CARD_SCOPE_RSS_LIMIT_BYTES } from "./card-scope-contract";
import { buildCardScopeReport, serializeCardScopeReport } from "./card-scope-evaluator";
import { validateCardScopeNativeEvidence } from "./card-scope-native";
import { CardScopeInputOptions, buildCardScopeJoinProof, loadCardScopeInputs } from "./card-scope-source";
import { streamDb1Cards } from "./source";

export interface CardScopeRunOptions extends CardScopeInputOptions { optIn: true }
export interface CardScopeRunResult {
    stdout: string;
    peakRssBytes: number;
    twoEvaluationByteIdentical: true;
}

class RssGuard {
    private peak = process.memoryUsage().rss;
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);

    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss);
        this.exceeded ||= this.peak >= CARD_SCOPE_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K34 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export async function runCardScopeAudit(options: CardScopeRunOptions): Promise<CardScopeRunResult> {
    if (options?.optIn !== true) throw new Error("K34 requires explicit opt-in");
    if (!options.sqliteRoot || !options.db1Root || !options.k2Root || !options.elfRoot || !options.nativeEvidenceRoot) {
        throw new Error("K34 requires explicit SQLite, DB1, K2, ELF and native-evidence roots");
    }
    const rss = new RssGuard();
    try {
        const inputs = await loadCardScopeInputs(options);
        rss.sample();
        const joinProof = await buildCardScopeJoinProof(inputs.taxonomy, streamDb1Cards(inputs.db1.artifactPath));
        rss.sample();
        const nativeProof = validateCardScopeNativeEvidence({
            inspection: inputs.nativeInspection,
            nativeSha256: inputs.nativeSha256,
            nativeSizeBytes: inputs.nativeSizeBytes,
            layoutBytes: inputs.nativeLayoutBytes,
        });
        rss.sample();
        const first = serializeCardScopeReport(buildCardScopeReport(inputs.schemaProof, joinProof, nativeProof));
        const second = serializeCardScopeReport(buildCardScopeReport(inputs.schemaProof, joinProof, nativeProof));
        if (first !== second) throw new Error("K34 double evaluation was not byte-identical");
        await inputs.revalidate();
        if (global.gc) global.gc();
        return { stdout: second, peakRssBytes: rss.stop(), twoEvaluationByteIdentical: true };
    } finally {
        rss.dispose();
    }
}

function argumentValue(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

function required(args: string[], name: string): string {
    const value = argumentValue(args, name);
    if (!value) throw new Error(`K34 requires ${name}`);
    return value;
}

export function parseCardScopeCli(args: string[]): CardScopeRunOptions {
    const roots = ["--sqlite-root", "--db1-root", "--k2-root", "--elf-root", "--native-evidence-root"];
    const allowed = new Set(["--opt-in-k34", ...roots]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K34 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k34") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k34").length !== 1) throw new Error("K34 requires exactly one --opt-in-k34");
    return {
        optIn: true,
        sqliteRoot: required(args, "--sqlite-root"),
        db1Root: required(args, "--db1-root"),
        k2Root: required(args, "--k2-root"),
        elfRoot: required(args, "--elf-root"),
        nativeEvidenceRoot: required(args, "--native-evidence-root"),
    };
}

async function run(): Promise<void> {
    const result = await runCardScopeAudit(parseCardScopeCli(process.argv.slice(2)));
    process.stdout.write(result.stdout);
    process.stderr.write(`K34 peak RSS bytes: ${result.peakRssBytes}\n`);
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
