"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSourceSettings = void 0;
const promises_1 = require("fs/promises");
async function readSourceSettings(settingsPath) {
    if (!settingsPath) {
        return undefined;
    }
    try {
        const rawSettings = await (0, promises_1.readFile)(settingsPath, { encoding: "utf8" });
        const settings = JSON.parse(rawSettings);
        return {
            glbAssetVersion: settings.GlbAssetVersion,
            glbDbVersion: settings.GlbDbVersion,
            glbApkVersion: settings.GlbApkVersion,
        };
    }
    catch {
        return undefined;
    }
}
exports.readSourceSettings = readSourceSettings;
//# sourceMappingURL=game-db-source-settings.js.map