import { CHARACTER_REFRESH_PROFILE, DatabaseCharacterRefreshCoverage, DatabaseCharacterRefreshReceipt } from "./refresh-contract";

export function buildDatabaseCharacterRefreshReceipt(): DatabaseCharacterRefreshReceipt {
    const profile = CHARACTER_REFRESH_PROFILE;
    const sidecars = profile.sidecars.map(sidecar => ({
        ...sidecar,
        schemaVersion: 1 as const,
        sourceDb1ArtifactSha256: profile.db1.sha256,
        validationValid: true as const,
        absenceBehavior: "preserve_production" as const,
    }));
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-refresh-receipt",
        contractVersion: "1.0.0",
        generatedAt: profile.generatedAt,
        profileId: profile.profileId,
        source: {
            snapshotVersion: profile.snapshotVersion,
            sqlite: { sha256: profile.sqlite.sha256, sizeBytes: profile.sqlite.sizeBytes },
            db1: { sha256: profile.db1.sha256, sizeBytes: profile.db1.sizeBytes, cardCount: profile.db1.cardCount },
            nativeRuntime: { sha256: profile.elf.sha256, sizeBytes: profile.elf.sizeBytes, format: profile.elf.format },
            semanticFiles: profile.semanticFiles.map(file => ({ ...file })),
        },
        sidecars,
        totals: {
            sidecarCount: sidecars.length,
            consumerSidecarCount: sidecars.filter(sidecar => sidecar.consumerScopes.length > 0).length,
            auditSidecarCount: sidecars.filter(sidecar => sidecar.auditScopes.length > 0).length,
            compressedBytes: sidecars.reduce((sum, sidecar) => sum + sidecar.artifact.sizeBytes, 0),
            uncompressedBytes: sidecars.reduce((sum, sidecar) => sum + sidecar.artifact.uncompressedSizeBytes, 0),
        },
        policy: { optional: true, enabledByDefault: false, productionImportCount: 0, productionReplacement: false, r2Publication: false, androidConsumption: false, absenceBehavior: "preserve_production", consumerChannel: "supported_only_scopes", auditChannelSeparate: true },
        execution: { mode: "focused_profile_verification", db0Db50Replay: false, sidecarsRegenerated: false, receiptWrittenAfterCompatibility: true },
    };
}

export function buildDatabaseCharacterRefreshCoverage(receipt: DatabaseCharacterRefreshReceipt): DatabaseCharacterRefreshCoverage {
    return {
        schemaVersion: 1,
        sidecarCount: receipt.sidecars.length,
        consumerSidecarCount: receipt.sidecars.filter(sidecar => sidecar.consumerScopes.length > 0).length,
        auditSidecarCount: receipt.sidecars.filter(sidecar => sidecar.auditScopes.length > 0).length,
        compressedBytes: receipt.sidecars.reduce((sum, sidecar) => sum + sidecar.artifact.sizeBytes, 0),
        uncompressedBytes: receipt.sidecars.reduce((sum, sidecar) => sum + sidecar.artifact.uncompressedSizeBytes, 0),
        semanticFileCount: receipt.source.semanticFiles.length,
        invalidSidecarCount: receipt.sidecars.filter(sidecar => !sidecar.validationValid).length,
        productionImportCount: receipt.policy.productionImportCount,
    };
}
