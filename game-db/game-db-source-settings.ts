import { readFile } from "fs/promises";
import { GameDbExperimentReport } from "./game-db-contract";

export type GameDbSourceSettings = NonNullable<GameDbExperimentReport["sourceSettings"]>;

export async function readSourceSettings(settingsPath?: string): Promise<GameDbSourceSettings | undefined> {
    if (!settingsPath) {
        return undefined;
    }

    try {
        const rawSettings = await readFile(settingsPath, { encoding: "utf8" });
        const settings = JSON.parse(rawSettings);
        return {
            glbAssetVersion: settings.GlbAssetVersion,
            glbDbVersion: settings.GlbDbVersion,
            glbApkVersion: settings.GlbApkVersion,
        };
    } catch {
        return undefined;
    }
}
