import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { GameDbDokkanpanionProjection } from "./game-db-app-projection";
import { writeGameDbDataset } from "./game-db-dataset";
import { savePortraitFile } from "./portrait-assets";

export function hasFlag(argv: string[], flag: string): boolean {
    return argv.includes(flag);
}

export function hasOption(argv: string[], optionName: string): boolean {
    return argv.some(token => token === optionName || token.startsWith(`${optionName}=`));
}

async function spawnInherited(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: false,
        });

        child.on("error", error => {
            rejectPromise(error);
        });

        child.on("exit", code => {
            if (code && code !== 0) {
                rejectPromise(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
                return;
            }

            resolvePromise();
        });
    });
}

export async function ensureGameDbPortraits(characters: GameDbDokkanpanionProjection[]): Promise<void> {
    for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index];
        await savePortraitFile(character.portraitFilename, character.portraitSpec);

        if ((index + 1) % 50 === 0 || index + 1 === characters.length) {
            console.log(`Prepared ${index + 1}/${characters.length} portrait(s)`);
        }
    }
}

async function runPublishCommand(args: string[]): Promise<void> {
    if (process.platform === "win32") {
        await spawnInherited("cmd.exe", ["/d", "/s", "/c", "npx", "ts-node", "publish-r2.ts", ...args]);
        return;
    }

    await spawnInherited("npx", ["ts-node", "publish-r2.ts", ...args]);
}

export async function publishGameDbDataset(options?: {
    forwardedArgs?: string[],
    buildResult?: Awaited<ReturnType<typeof writeGameDbDataset>>,
}): Promise<{
    buildResult: Awaited<ReturnType<typeof writeGameDbDataset>>,
    preparedPortraitCount: number,
    publishStatePath: string,
}> {
    const forwardedArgs = options?.forwardedArgs ?? [];
    if (hasOption(forwardedArgs, "--dataset") || hasOption(forwardedArgs, "--manifest") || hasOption(forwardedArgs, "--state")) {
        throw new Error("Do not pass --dataset, --manifest, or --state to game-db-publish-r2.ts; those are managed by the wrapper.");
    }

    const buildResult = options?.buildResult ?? await writeGameDbDataset();
    const skipPortraits = hasFlag(forwardedArgs, "--skip-portraits");
    let preparedPortraitCount = 0;

    if (!skipPortraits) {
        const rawCharacters = await readFile(buildResult.projectionPath, "utf8");
        const characters = JSON.parse(rawCharacters) as GameDbDokkanpanionProjection[];
        await ensureGameDbPortraits(characters);
        preparedPortraitCount = characters.length;
    }

    const publishStatePath = resolve(buildResult.outputDir, "r2-publish-state.json");
    const publishArgs = [
        "--dataset",
        buildResult.datasetPath,
        "--manifest",
        buildResult.manifestPath,
        "--state",
        publishStatePath,
        ...forwardedArgs,
    ];

    await runPublishCommand(publishArgs);

    return {
        buildResult,
        preparedPortraitCount,
        publishStatePath,
    };
}

async function main() {
    await publishGameDbDataset({
        forwardedArgs: process.argv.slice(2),
    });
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

