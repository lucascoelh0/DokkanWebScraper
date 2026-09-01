"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportMemoryAssetObjectKey = exports.supportMemoryEnhancementItemKey = void 0;
function supportMemoryEnhancementItemKey(id) {
    return `SupportMemoryEnhancementItem:${id.trim()}`;
}
exports.supportMemoryEnhancementItemKey = supportMemoryEnhancementItemKey;
function supportMemoryAssetObjectKey(localPath) {
    const normalizedPath = localPath?.replace(/\\/g, "/");
    if (!normalizedPath || normalizedPath.startsWith("/") || /^[a-z]:\//i.test(normalizedPath))
        return undefined;
    if (normalizedPath.split("/").some(segment => !segment || segment === "." || segment === ".."))
        return undefined;
    const legacyPrefix = "data/support-memories/assets/dokkaninfo/";
    if (normalizedPath?.startsWith(legacyPrefix)) {
        return `support-memories/assets/${normalizedPath.slice(legacyPrefix.length)}`;
    }
    const gamePrefix = "data/support-memories/assets/game/";
    if (!normalizedPath?.startsWith(gamePrefix))
        return undefined;
    const afterPrefix = normalizedPath.slice(gamePrefix.length);
    const snapshotSeparator = afterPrefix.indexOf("/");
    if (snapshotSeparator <= 0 || snapshotSeparator === afterPrefix.length - 1)
        return undefined;
    return `support-memories/assets/${afterPrefix.slice(snapshotSeparator + 1)}`;
}
exports.supportMemoryAssetObjectKey = supportMemoryAssetObjectKey;
//# sourceMappingURL=support-memory-dokkaninfo-enrichment.js.map