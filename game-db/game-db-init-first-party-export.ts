import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";

const DEFAULT_OUTPUT_DIR = resolve(__dirname, "data", "game-db-acquisition", "first-party", "latest");

export function parseOutputDir(argv: string[]): string {
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--output-dir") {
            return resolve(argv[index + 1] ?? DEFAULT_OUTPUT_DIR);
        }

        if (token.startsWith("--output-dir=")) {
            return resolve(token.split("=", 2)[1]);
        }
    }

    return DEFAULT_OUTPUT_DIR;
}

async function main() {
    const outputDir = parseOutputDir(process.argv.slice(2));
    const dataDir = resolve(outputDir, "data");
    const metadataPath = resolve(outputDir, "metadata.json");
    const readmePath = resolve(outputDir, "README.txt");

    await mkdir(dataDir, { recursive: true });
    await writeFile(metadataPath, `${JSON.stringify({
        source: "first-party-export",
        region: "global",
        exportedAt: new Date().toISOString(),
        dbVersion: "",
        assetVersion: "",
        apkVersion: "",
        notes: "Fill these fields when wiring the real first-party acquisition step.",
    }, null, 2)}\n`, "utf8");

    await writeFile(readmePath, [
        "This directory is the placeholder contract for first-party Dokkan game DB exports.",
        "",
        "Expected contents:",
        "- metadata.json",
        "- data/*.csv",
        "",
        "The update runner can consume this directory with:",
        "npm run run:game-db-update -- --acquisition-mode first-party-export --first-party-dir <this directory> ...",
        "",
        "See docs/game-db/specs/game-db-first-party-acquisition-contract.md for the full contract.",
        "",
    ].join("\n"), "utf8");

    console.log(`Initialized first-party export scaffold at ${outputDir}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

