"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDatasetPublicationWriteAuthorized = exports.defaultChannelStatePath = exports.channelObjectKey = exports.parseDatasetPublicationChannel = void 0;
const path_1 = require("path");
function parseDatasetPublicationChannel(value) {
    const channel = value ?? "production";
    if (channel !== "production" && channel !== "staging") {
        throw new Error(`Invalid dataset publication channel: ${channel}`);
    }
    return channel;
}
exports.parseDatasetPublicationChannel = parseDatasetPublicationChannel;
function channelObjectKey(channel, productionObjectKey) {
    return channel === "production" ? productionObjectKey : `staging/${productionObjectKey}`;
}
exports.channelObjectKey = channelObjectKey;
function defaultChannelStatePath(productionStatePath, channel) {
    if (channel === "production")
        return (0, path_1.resolve)(productionStatePath);
    const extensionIndex = productionStatePath.lastIndexOf(".");
    const stagingPath = extensionIndex < 0
        ? `${productionStatePath}-staging`
        : `${productionStatePath.slice(0, extensionIndex)}-staging${productionStatePath.slice(extensionIndex)}`;
    return (0, path_1.resolve)(stagingPath);
}
exports.defaultChannelStatePath = defaultChannelStatePath;
function assertDatasetPublicationWriteAuthorized(options) {
    if (options.promoteProduction && options.channel !== "production") {
        throw new Error("--promote-production cannot be combined with the staging channel.");
    }
    if (options.target === "remote" &&
        !options.dryRun &&
        options.channel === "production" &&
        !options.promoteProduction) {
        throw new Error("Remote production publication requires the explicit --promote-production flag.");
    }
}
exports.assertDatasetPublicationWriteAuthorized = assertDatasetPublicationWriteAuthorized;
//# sourceMappingURL=dataset-publication-channel.js.map