import { resolve } from "path";

export type DatasetPublicationChannel = "production" | "staging";

export function parseDatasetPublicationChannel(value?: string): DatasetPublicationChannel {
    const channel = value ?? "production";
    if (channel !== "production" && channel !== "staging") {
        throw new Error(`Invalid dataset publication channel: ${channel}`);
    }
    return channel;
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
