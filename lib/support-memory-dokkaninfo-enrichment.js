"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportMemoryAssetObjectKey = exports.supportMemoryEnhancementItemKey = void 0;
function supportMemoryEnhancementItemKey(id) {
    return `SupportMemoryEnhancementItem:${id.trim()}`;
}
exports.supportMemoryEnhancementItemKey = supportMemoryEnhancementItemKey;
function supportMemoryAssetObjectKey(localPath) {
    const normalizedPath = localPath?.replace(/\\/g, "/");
    const assetPrefix = "data/support-memories/assets/dokkaninfo/";
    if (!normalizedPath?.startsWith(assetPrefix)) {
        return undefined;
    }
    return `support-memories/assets/${normalizedPath.slice(assetPrefix.length)}`;
}
exports.supportMemoryAssetObjectKey = supportMemoryAssetObjectKey;
//# sourceMappingURL=support-memory-dokkaninfo-enrichment.js.map