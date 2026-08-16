import { CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES } from "./leader-supported-publisher-contract";
import { CharacterLeaderSupportedPublisherOptions, runCharacterLeaderSupportedPublisher } from "./leader-supported-publisher";

const VALUES = [
    "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
    "--k56-root", "--k58-root", "--k59-output-root", "--output-root", "--native-runtime", "--database", "--checked-at",
] as const;
const CONFIRM = "--confirm-publication-id" as const;
function value(args: string[], name: typeof VALUES[number] | typeof CONFIRM): string {
    const indexes = args.flatMap((argument, index) => argument === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const result = args[indexes[0] + 1]; if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`); return result;
}

export function parseCharacterLeaderSupportedPublisherCli(args: string[]): CharacterLeaderSupportedPublisherOptions {
    const allowed = new Set<string>(["--opt-in-k60", "--dry-run", "--publish", CONFIRM, ...VALUES]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index]; if (!allowed.has(argument)) throw new Error(`K60 unsupported argument ${argument}`);
        if ((VALUES as readonly string[]).includes(argument) || argument === CONFIRM) {
            if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`missing value for ${argument}`); index++;
        }
    }
    if (args.filter(argument => argument === "--opt-in-k60").length !== 1) throw new Error("K60 requires exactly one --opt-in-k60");
    const dry = args.filter(argument => argument === "--dry-run").length, publish = args.filter(argument => argument === "--publish").length;
    if (dry + publish !== 1) throw new Error("K60 requires exactly one --dry-run or --publish");
    const confirmations = args.filter(argument => argument === CONFIRM).length;
    if (dry && confirmations) throw new Error("K60 dry-run forbids --confirm-publication-id");
    if (publish && confirmations !== 1) throw new Error("K60 publish requires exactly one --confirm-publication-id");
    const common = {
        optIn: true as const, sidecarRoot: value(args, "--sidecar-root"), productionRoot: value(args, "--production-root"),
        fyiRoot: value(args, "--fyi-root"), k43Root: value(args, "--k43-root"), k46Root: value(args, "--k46-root"),
        k48Root: value(args, "--k48-root"), k56Root: value(args, "--k56-root"), k58Root: value(args, "--k58-root"),
        k59OutputRoot: value(args, "--k59-output-root"), outputRoot: value(args, "--output-root"),
        nativeRuntime: value(args, "--native-runtime"), database: value(args, "--database"), checkedAt: value(args, "--checked-at"),
    };
    if (publish) {
        const confirmPublicationId = value(args, CONFIRM);
        if (!/^[a-f0-9]{64}$/.test(confirmPublicationId)) throw new Error("K60 confirmation must be canonical 64-hex");
        return { ...common, mode: "publish", confirmPublicationId };
    }
    return { ...common, mode: "dry-run" };
}

async function main(): Promise<void> {
    const result = await runCharacterLeaderSupportedPublisher(parseCharacterLeaderSupportedPublisherCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES) throw new Error("K60 stdout limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) main().catch(error => { console.error(`K60 failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 512)}`); process.exitCode = 1; });
