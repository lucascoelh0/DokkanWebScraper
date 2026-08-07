import { IntegrationC1Dataset, IntegrationC1Manifest } from "./integration-c1-contract";
import { IntegrationC2Dataset, IntegrationC2Manifest } from "./integration-c2-contract";
import { IntegrationC3Dataset, IntegrationC3Manifest } from "./integration-c3-contract";
import { IntegrationC4CompatibilityReport, IntegrationC4Manifest, IntegrationC4Receipt } from "./integration-c4-contract";

export interface IntegrationC5FileChain {
    c1Manifest: IntegrationC1Manifest; c1Dataset: IntegrationC1Dataset;
    c2Manifest: IntegrationC2Manifest; c2Dataset: IntegrationC2Dataset;
    c3Manifest: IntegrationC3Manifest; c3Dataset: IntegrationC3Dataset;
    c4Manifest: IntegrationC4Manifest; c4Receipt: IntegrationC4Receipt; c4Compatibility: IntegrationC4CompatibilityReport; compatibilityFileSha256: string;
}
export function validateIntegrationC5FileChain(chain: IntegrationC5FileChain): string[] {
    const failures: string[] = [], { c1Manifest: m1, c1Dataset: d1, c2Manifest: m2, c2Dataset: d2, c3Manifest: m3, c3Dataset: d3, c4Manifest: m4, c4Receipt: receipt, c4Compatibility: compatibility } = chain;
    if (m1.sourceSnapshotVersion !== d1.sourceSnapshotVersion || m1.sourceDatabaseSha256 !== d1.sourceDatabaseSha256 || m1.nativeRuntimeSha256 !== d1.nativeRuntimeSha256) failures.push("C1 manifest/payload lineage");
    if (m2.sourceSnapshotVersion !== d2.sourceSnapshotVersion || d2.sourceSnapshotVersion !== d1.sourceSnapshotVersion || d2.sourceDatabaseSha256 !== d1.sourceDatabaseSha256 || d2.nativeRuntimeSha256 !== d1.nativeRuntimeSha256 || m2.sourceAuditSidecarSha256 !== m1.sha256 || d2.auditSidecar.sha256 !== m1.sha256) failures.push("C2 lineage");
    if (m3.sourceSupportedSidecarSha256 !== m2.sha256 || d3.sourceSupportedSidecar.sha256 !== m2.sha256 || d3.sourceSupportedSidecar.contractVersion !== m2.contractVersion) failures.push("C3 lineage");
    if (m4.compatibilityFile !== "database-first-update-c4-compatibility.json" || m4.generatedAt !== receipt.generatedAt || receipt.snapshotVersion !== d1.sourceSnapshotVersion || receipt.outputs.c1Sha256 !== m1.sha256 || receipt.outputs.c2Sha256 !== m2.sha256 || receipt.outputs.c3Sha256 !== m3.sha256 || receipt.inputs.sourceDatabaseSha256 !== d1.sourceDatabaseSha256 || receipt.inputs.nativeRuntimeSha256 !== d1.nativeRuntimeSha256) failures.push("C4 receipt lineage");
    if (chain.compatibilityFileSha256 !== receipt.compatibilityReportSha256 || compatibility.status !== "compatible" || compatibility.issues.length !== 0 || compatibility.snapshotVersion !== receipt.snapshotVersion || compatibility.sourceDatabase.sha256 !== receipt.inputs.sourceDatabaseSha256 || compatibility.sourceDatabase.schemaSha256 !== receipt.inputs.schemaSha256 || compatibility.nativeRuntime.sha256 !== receipt.inputs.nativeRuntimeSha256) failures.push("C4 compatibility lineage");
    return failures;
}
