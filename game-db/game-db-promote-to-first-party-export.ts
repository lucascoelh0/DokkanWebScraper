import { resolve } from "path";
import {
    DEFAULT_FIRST_PARTY_DIR,
    GameDbFirstPartyExportMetadata,
    resolveGameDbAcquisitionOptions,
} from "./game-db-acquisition";
import {
    assertFirstPartyExportSourceInventory,
    assertNoFirstPartyExportPathOverlap,
    commitFirstPartyExport,
    copyFirstPartyExportSourceInventory,
} from "./game-db-first-party-export-commit";
import { readSourceSettings } from "./game-db-source-settings";
import { FIRST_PARTY_EXPORT_GAME_DB_TABLES } from "./game-db-table-inventory";
import { resolveGameDbSourceConfig } from "./game-db-source";

export interface GameDbPromoteOptions {
    sourceRoot?: string,
    outputDir?: string,
    note?: string,
}

export function parsePromoteArgs(argv: string[]): Required<GameDbPromoteOptions> {
    let sourceRoot = "";
    let outputDir = DEFAULT_FIRST_PARTY_DIR;
    let note = "Promoted from an existing external export into the first-party export contract.";

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (token === "--source-root" || token.startsWith("--source-root=")) {
            sourceRoot = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }

        if (token === "--output-dir" || token.startsWith("--output-dir=")) {
            outputDir = resolve(token.includes("=") ? token.split("=", 2)[1] : argv[++index]);
            continue;
        }

        if (token === "--note" || token.startsWith("--note=")) {
            note = token.includes("=") ? token.split("=", 2)[1] : argv[++index];
            continue;
        }

        throw new Error(`Unexpected argument: ${token}`);
    }

    return {
        sourceRoot,
        outputDir,
        note,
    };
}

export async function promoteToFirstPartyExport(options?: GameDbPromoteOptions): Promise<{
    outputDir: string,
    metadataPath: string,
    copiedTableCount: number,
}> {
    const parsed = {
        sourceRoot: options?.sourceRoot ?? "",
        outputDir: options?.outputDir ?? DEFAULT_FIRST_PARTY_DIR,
        note: options?.note ?? "Promoted from an existing external export into the first-party export contract.",
    };

    const acquisitionDefaults = resolveGameDbAcquisitionOptions();
    const sourceConfig = resolveGameDbSourceConfig(parsed.sourceRoot || acquisitionDefaults.sourceRootOverride || undefined);
    const outputDir = resolve(parsed.outputDir);
    const sourceSettings = await readSourceSettings(sourceConfig.settingsPath);
    await assertNoFirstPartyExportPathOverlap(sourceConfig.dataDir, outputDir);
    await assertFirstPartyExportSourceInventory(sourceConfig.dataDir);

    const metadata: GameDbFirstPartyExportMetadata = {
        source: "first-party-export",
        region: "global",
        exportedAt: new Date().toISOString(),
        dbVersion: sourceSettings?.glbDbVersion?.toString(),
        assetVersion: sourceSettings?.glbAssetVersion?.toString(),
        apkVersion: sourceSettings?.glbApkVersion,
        notes: parsed.note,
    };

    const committed = await commitFirstPartyExport({
        outputDir,
        metadata,
        materializeData: dataDir => copyFirstPartyExportSourceInventory(sourceConfig.dataDir, dataDir),
    });

    return {
        outputDir: committed.outputDir,
        metadataPath: committed.metadataPath,
        copiedTableCount: FIRST_PARTY_EXPORT_GAME_DB_TABLES.length,
    };
}

async function main() {
    const parsed = parsePromoteArgs(process.argv.slice(2));
    const result = await promoteToFirstPartyExport(parsed);
    console.log(`Promoted ${result.copiedTableCount} table(s) into ${result.outputDir}`);
    console.log(`Wrote metadata to ${result.metadataPath}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

