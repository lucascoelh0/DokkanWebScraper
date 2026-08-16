import { CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES } from "./leader-supported-public-shadow-contract";
import {
    CharacterLeaderSupportedPublicShadowOptions,
    runCharacterLeaderSupportedPublicShadow,
} from "./leader-supported-public-shadow";

const VALUES = [
    "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
    "--k56-root", "--k58-root", "--native-runtime", "--database", "--checked-at",
] as const;

function value(args: string[], name: typeof VALUES[number]): string {
    const indexes = args.flatMap((argument, index) => argument === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}

export function parseCharacterLeaderSupportedPublicShadowCli(args: string[]): CharacterLeaderSupportedPublicShadowOptions {
    const allowed = new Set<string>(["--opt-in-k61", "--remote-read-only", ...VALUES]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index]; if (!allowed.has(argument)) throw new Error(`K61 unsupported argument ${argument}`);
        if ((VALUES as readonly string[]).includes(argument)) {
            if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`missing value for ${argument}`); index++;
        }
    }
    if (args.filter(argument => argument === "--opt-in-k61").length !== 1
        || args.filter(argument => argument === "--remote-read-only").length !== 1) {
        throw new Error("K61 requires exactly one opt-in and remote-read-only flag");
    }
    return {
        optIn: true, remoteReadOnly: true,
        sidecarRoot: value(args, "--sidecar-root"), productionRoot: value(args, "--production-root"),
        fyiRoot: value(args, "--fyi-root"), k43Root: value(args, "--k43-root"),
        k46Root: value(args, "--k46-root"), k48Root: value(args, "--k48-root"),
        k56Root: value(args, "--k56-root"), k58Root: value(args, "--k58-root"),
        nativeRuntime: value(args, "--native-runtime"), database: value(args, "--database"),
        checkedAt: value(args, "--checked-at"),
    };
}

async function main(): Promise<void> {
    const report = await runCharacterLeaderSupportedPublicShadow(parseCharacterLeaderSupportedPublicShadowCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_REPORT_LIMIT_BYTES) throw new Error("K61 stdout report limit reached");
    process.stdout.write(stdout);
}

if (require.main === module) main().catch(error => {
    console.error(`K61 failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 512)}`); process.exitCode = 1;
});
