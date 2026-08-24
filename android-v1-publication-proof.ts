import { readFile } from "fs/promises";
import { DatasetManifest } from "./dataset-artifacts";
import {
    ANDROID_V1_CONSUMER_COMMIT,
    ANDROID_V1_PROJECTOR_VERSION,
} from "./android-v1-contract-projector";
import { AndroidV1ProjectorRunReport } from "./android-v1-contract-projector-run";
import { TeamAnalysisManifest } from "./team-analysis-artifacts";

export interface AndroidV1PublicationProofExpectation {
    characters: DatasetManifest,
    teamAnalysis?: TeamAnalysisManifest,
}

export async function assertAndroidV1PublicationProof(
    reportPath: string,
    expected: AndroidV1PublicationProofExpectation,
): Promise<AndroidV1ProjectorRunReport> {
    let report: AndroidV1ProjectorRunReport;
    try {
        report = JSON.parse(await readFile(reportPath, "utf8")) as AndroidV1ProjectorRunReport;
    } catch (error) {
        throw new Error(
            `Android v1 projection report is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!report || typeof report !== "object"
        || report.schemaVersion !== 1
        || report.contract !== "dokkanpanion-android-v1-projection"
        || report.projectorVersion !== ANDROID_V1_PROJECTOR_VERSION
        || report.consumerCommit !== ANDROID_V1_CONSUMER_COMMIT) {
        throw new Error("Android v1 projection report does not identify the frozen supported projector contract.");
    }
    if (!report.output?.characters || !report.output?.teamAnalysis) {
        throw new Error("Android v1 projection report is missing its paired output manifests.");
    }
    if (canonicalJson(report.output.characters) !== canonicalJson(expected.characters)) {
        throw new Error("Character manifest does not match the Android v1 projection report output.");
    }
    if (expected.teamAnalysis
        && canonicalJson(report.output.teamAnalysis) !== canonicalJson(expected.teamAnalysis)) {
        throw new Error("Team Analysis manifest does not match the Android v1 projection report output.");
    }
    if (report.output.teamAnalysis.sourceCharacterDatasetVersion !== report.output.characters.datasetVersion
        || report.output.teamAnalysis.sourceCharacterPayloadSha256 !== report.output.characters.sha256) {
        throw new Error("Android v1 projection report does not contain an exact Character/Team Analysis pair.");
    }
    return report;
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
