"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertAndroidV1PublicationProof = void 0;
const promises_1 = require("fs/promises");
const android_v1_contract_projector_1 = require("./android-v1-contract-projector");
async function assertAndroidV1PublicationProof(reportPath, expected) {
    let report;
    try {
        report = JSON.parse(await (0, promises_1.readFile)(reportPath, "utf8"));
    }
    catch (error) {
        throw new Error(`Android v1 projection report is unreadable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!report || typeof report !== "object"
        || report.schemaVersion !== 1
        || report.contract !== "dokkanpanion-android-v1-projection"
        || report.projectorVersion !== android_v1_contract_projector_1.ANDROID_V1_PROJECTOR_VERSION
        || report.consumerCommit !== android_v1_contract_projector_1.ANDROID_V1_CONSUMER_COMMIT) {
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
exports.assertAndroidV1PublicationProof = assertAndroidV1PublicationProof;
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
//# sourceMappingURL=android-v1-publication-proof.js.map