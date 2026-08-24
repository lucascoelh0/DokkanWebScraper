import { resolve } from "path";

export type DatasetPublicationChannel = "production" | "staging";
export type DatasetContractLane = "v1" | "v2";

export function parseDatasetPublicationChannel(value?: string): DatasetPublicationChannel {
    const channel = value ?? "production";
    if (channel !== "production" && channel !== "staging") {
        throw new Error(`Invalid dataset publication channel: ${channel}`);
    }
    return channel;
}

export function parseDatasetContractLane(value?: string): DatasetContractLane {
    if (value !== "v1" && value !== "v2") {
        throw new Error(value === undefined
            ? "Missing dataset contract lane. Pass --contract-lane v1 or --contract-lane v2."
            : `Invalid dataset contract lane: ${value}`);
    }
    return value;
}

export function contractLaneObjectKey(
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    rootV1ObjectKey: string,
): string {
    if (channel === "production") {
        return contractLane === "v1" ? rootV1ObjectKey : `v2/${rootV1ObjectKey}`;
    }
    return `staging/${contractLane}/${rootV1ObjectKey}`;
}

export function defaultContractLaneStatePath(
    rootV1StatePath: string,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): string {
    if (channel === "production" && contractLane === "v1") return resolve(rootV1StatePath);
    const suffix = channel === "production" ? contractLane : `${channel}-${contractLane}`;
    const extensionIndex = rootV1StatePath.lastIndexOf(".");
    const lanePath = extensionIndex < 0
        ? `${rootV1StatePath}-${suffix}`
        : `${rootV1StatePath.slice(0, extensionIndex)}-${suffix}${rootV1StatePath.slice(extensionIndex)}`;
    return resolve(lanePath);
}

export function channelObjectKey(
    channel: DatasetPublicationChannel,
    productionObjectKey: string,
): string {
    return channel === "production" ? productionObjectKey : `staging/${productionObjectKey}`;
}

export function defaultChannelStatePath(
    productionStatePath: string,
    channel: DatasetPublicationChannel,
): string {
    if (channel === "production") return resolve(productionStatePath);
    const extensionIndex = productionStatePath.lastIndexOf(".");
    const stagingPath = extensionIndex < 0
        ? `${productionStatePath}-staging`
        : `${productionStatePath.slice(0, extensionIndex)}-staging${productionStatePath.slice(extensionIndex)}`;
    return resolve(stagingPath);
}

export function assertDatasetPublicationWriteAuthorized(options: {
    channel: DatasetPublicationChannel,
    target: "remote" | "local",
    dryRun: boolean,
    promoteProduction: boolean,
}): void {
    if (options.promoteProduction && options.channel !== "production") {
        throw new Error("--promote-production cannot be combined with the staging channel.");
    }
    if (options.target === "remote" &&
        !options.dryRun &&
        options.channel === "production" &&
        !options.promoteProduction
    ) {
        throw new Error(
            "Remote production publication requires the explicit --promote-production flag.",
        );
    }
}
