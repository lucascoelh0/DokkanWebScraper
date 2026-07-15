"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishGameDbDataset = exports.ensureGameDbPortraits = exports.hasOption = exports.hasFlag = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const game_db_dataset_1 = require("./game-db-dataset");
const portrait_assets_1 = require("./portrait-assets");
function hasFlag(argv, flag) {
    return argv.includes(flag);
}
exports.hasFlag = hasFlag;
function hasOption(argv, optionName) {
    return argv.some(token => token === optionName || token.startsWith(`${optionName}=`));
}
exports.hasOption = hasOption;
async function spawnInherited(command, args) {
    await new Promise((resolvePromise, rejectPromise) => {
        const child = (0, child_process_1.spawn)(command, args, {
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
async function ensureGameDbPortraits(characters) {
    for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index];
        await (0, portrait_assets_1.savePortraitFile)(character.portraitFilename, character.portraitSpec);
        if ((index + 1) % 50 === 0 || index + 1 === characters.length) {
            console.log(`Prepared ${index + 1}/${characters.length} portrait(s)`);
        }
    }
}
exports.ensureGameDbPortraits = ensureGameDbPortraits;
async function runPublishCommand(args) {
    if (process.platform === "win32") {
        await spawnInherited("cmd.exe", ["/d", "/s", "/c", "npx", "ts-node", "publish-r2.ts", ...args]);
        return;
    }
    await spawnInherited("npx", ["ts-node", "publish-r2.ts", ...args]);
}
async function publishGameDbDataset(options) {
    const forwardedArgs = options?.forwardedArgs ?? [];
    if (hasOption(forwardedArgs, "--dataset") || hasOption(forwardedArgs, "--manifest") || hasOption(forwardedArgs, "--state")) {
        throw new Error("Do not pass --dataset, --manifest, or --state to game-db-publish-r2.ts; those are managed by the wrapper.");
    }
    const buildResult = options?.buildResult ?? await (0, game_db_dataset_1.writeGameDbDataset)();
    const skipPortraits = hasFlag(forwardedArgs, "--skip-portraits");
    let preparedPortraitCount = 0;
    if (!skipPortraits) {
        const rawCharacters = await (0, promises_1.readFile)(buildResult.projectionPath, "utf8");
        const characters = JSON.parse(rawCharacters);
        await ensureGameDbPortraits(characters);
        preparedPortraitCount = characters.length;
    }
    const publishStatePath = (0, path_1.resolve)(buildResult.outputDir, "r2-publish-state.json");
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
exports.publishGameDbDataset = publishGameDbDataset;
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
//# sourceMappingURL=game-db-publish-r2.js.map