"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDatasetPublicationWriteAuthorized = exports.defaultChannelStatePath = exports.channelObjectKey = exports.defaultContractLaneStatePath = exports.contractLaneObjectKey = exports.parseDatasetContractLane = exports.parseDatasetPublicationChannel = void 0;
const path_1 = require("path");
function parseDatasetPublicationChannel(value) {
    const channel = value ?? "production";
    if (channel !== "production" && channel !== "staging") {
        throw new Error(`Invalid dataset publication channel: ${channel}`);
    }
    return channel;
}
exports.parseDatasetPublicationChannel = parseDatasetPublicationChannel;
function parseDatasetContractLane(value) {
    if (value !== "v1" && value !== "v2") {
        throw new Error(value === undefined
            ? "Missing dataset contract lane. Pass --contract-lane v1 or --contract-lane v2."
            : `Invalid dataset contract lane: ${value}`);
    }
    return value;
}
exports.parseDatasetContractLane = parseDatasetContractLane;
function contractLaneObjectKey(channel, contractLane, rootV1ObjectKey) {
    if (channel === "production") {
        return contractLane === "v1" ? rootV1ObjectKey : `v2/${rootV1ObjectKey}`;
    }
    return `staging/${contractLane}/${rootV1ObjectKey}`;
}
exports.contractLaneObjectKey = contractLaneObjectKey;
function defaultContractLaneStatePath(rootV1StatePath, channel, contractLane) {
    if (channel === "production" && contractLane === "v1")
        return (0, path_1.resolve)(rootV1StatePath);
    const suffix = channel === "production" ? contractLane : `${channel}-${contractLane}`;
    const extensionIndex = rootV1StatePath.lastIndexOf(".");
    const lanePath = extensionIndex < 0
        ? `${rootV1StatePath}-${suffix}`
        : `${rootV1StatePath.slice(0, extensionIndex)}-${suffix}${rootV1StatePath.slice(extensionIndex)}`;
    return (0, path_1.resolve)(lanePath);
}
exports.defaultContractLaneStatePath = defaultContractLaneStatePath;
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