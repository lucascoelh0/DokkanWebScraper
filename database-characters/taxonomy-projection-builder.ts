import { createHash } from "crypto";
import { DatabaseCharacterCardScopeReport } from "./card-scope-contract";
import { serializeCardScopeReport, validateCardScopeReport } from "./card-scope-evaluator";
import {
    CharacterStructuralIdentitySidecar,
    CharacterStructuralIdentityRecord,
    CharacterStructuralSidecarCoverage,
    CharacterStructuralSidecarManifest,
    CharacterStructuralSidecarValidation,
} from "./structural-sidecar-contract";
import {
    TAXONOMY_PROJECTION_CONTRACT_VERSION,
    TAXONOMY_PROJECTION_MAX_EXAMPLES,
    TAXONOMY_PROJECTION_SOURCE_PIN,
    TaxonomyProjectionCoverage,
    TaxonomyProjectionDataset,
    TaxonomyProjectionDimension,
    TaxonomyProjectionDimensionCoverage,
    TaxonomyProjectionExclusionReason,
    TaxonomyProjectionLineage,
    TaxonomyProjectionRecord,
} from "./taxonomy-projection-contract";

export interface TaxonomyProjectionK32Validation {
    manifest: CharacterStructuralSidecarManifest;
    sidecar: CharacterStructuralIdentitySidecar;
    coverage: CharacterStructuralSidecarCoverage;
    validation: CharacterStructuralSidecarValidation;
    sourceBoundValidation: { status: "GO"; sourceRootsRevalidated: true; exactArtifactBytesMatched: true };
}

export interface TaxonomyProjectionValidatedSources {
    k32: TaxonomyProjectionK32Validation;
    k34Report: DatabaseCharacterCardScopeReport;
    k34Stdout: string;
}

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const prettyBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const numeric = (left: string, right: string): number => Number(left) - Number(right) || left.localeCompare(right);
const dimensions: TaxonomyProjectionDimension[] = ["characterClass", "categories", "links"];

function emptyDimensionCoverage(): TaxonomyProjectionDimensionCoverage {
    return {
        includedCardCount: 0,
        includedFactCount: 0,
        excludedCardCount: 0,
        excludedFactCount: 0,
        exclusions: { partial: 0, unknown: 0, unjoinable: 0 },
        examples: { partial: [], unknown: [], unjoinable: [] },
    };
}

function exclude(
    coverage: TaxonomyProjectionDimensionCoverage,
    reason: TaxonomyProjectionExclusionReason,
    cardId: string,
    factCount: number,
): void {
    coverage.excludedCardCount++;
    coverage.excludedFactCount += factCount;
    coverage.exclusions[reason]++;
    if (coverage.examples[reason].length < TAXONOMY_PROJECTION_MAX_EXAMPLES) coverage.examples[reason].push(cardId);
}

function pinnedK32ManifestBytes(source: TaxonomyProjectionK32Validation): Buffer {
    return prettyBytes(source.manifest);
}

export function assertPinnedTaxonomyProjectionSources(sources: TaxonomyProjectionValidatedSources): void {
    const pin = TAXONOMY_PROJECTION_SOURCE_PIN;
    const k32 = sources.k32;
    if (k32.sourceBoundValidation.status !== "GO" || !k32.sourceBoundValidation.sourceRootsRevalidated
        || !k32.sourceBoundValidation.exactArtifactBytesMatched || !k32.validation.valid) {
        throw new Error("K35 requires authoritative source-bound K32 validation");
    }
    const manifestBytes = pinnedK32ManifestBytes(k32);
    if (manifestBytes.length !== pin.k32.manifestSizeBytes || hash(manifestBytes) !== pin.k32.manifestSha256
        || k32.manifest.contractVersion !== pin.k32.contractVersion
        || k32.manifest.sha256 !== pin.k32.payloadSha256 || k32.manifest.sizeBytes !== pin.k32.payloadSizeBytes
        || k32.manifest.uncompressedSha256 !== pin.k32.rawSha256 || k32.manifest.uncompressedSizeBytes !== pin.k32.rawSizeBytes
        || k32.manifest.coverageSha256 !== pin.k32.coverageSha256 || k32.manifest.coverageSizeBytes !== pin.k32.coverageSizeBytes
        || k32.manifest.validationSha256 !== pin.k32.validationSha256 || k32.manifest.validationSizeBytes !== pin.k32.validationSizeBytes) {
        throw new Error("K35 K32 artifact pin changed");
    }
    const coverage = k32.coverage.database;
    if (k32.sidecar.records.length !== pin.expected.cardCount || coverage.cardCount !== pin.expected.cardCount
        || coverage.fieldStatuses.characterClass.supported !== pin.expected.characterClassIncludedCardCount
        || coverage.fieldStatuses.characterClass.partial !== 0 || coverage.fieldStatuses.characterClass.unknown !== 0
        || coverage.fieldStatuses.categories.supported !== pin.expected.categoryIncludedCardCount
        || coverage.fieldStatuses.categories.partial !== 0 || coverage.fieldStatuses.categories.unknown !== pin.expected.categoryUnknownCardCount
        || coverage.categoryAssignmentCount !== pin.expected.categoryAssignmentCount
        || coverage.fieldStatuses.links.supported !== pin.expected.linkIncludedCardCount
        || coverage.fieldStatuses.links.partial !== 0 || coverage.fieldStatuses.links.unknown !== pin.expected.linkUnknownCardCount
        || coverage.linkEntryCount !== pin.expected.linkEntryCount) throw new Error("K35 K32 supported coverage changed");

    assertPinnedTaxonomyProjectionCardScope(sources.k34Report, sources.k34Stdout);
    if (k32.manifest.source.k2.payloadSha256 !== sources.k34Report.provenance.k2.payloadSha256
        || k32.manifest.source.k2.manifestSha256 !== sources.k34Report.provenance.k2.manifestSha256
        || k32.manifest.source.k2.databaseSha256 !== sources.k34Report.provenance.sqlite.sha256
        || k32.manifest.source.k2.db1ArtifactSha256 !== sources.k34Report.provenance.db1.sha256) {
        throw new Error("K35 K32/K34 structural lineage mismatch");
    }
}

export function assertPinnedTaxonomyProjectionCardScope(report: DatabaseCharacterCardScopeReport, stdout: string): void {
    const pin = TAXONOMY_PROJECTION_SOURCE_PIN;
    validateCardScopeReport(report);
    const canonicalK34 = serializeCardScopeReport(report);
    if (canonicalK34 !== stdout || Buffer.byteLength(canonicalK34) !== pin.k34.reportSizeBytes
        || hash(canonicalK34) !== pin.k34.reportSha256) throw new Error("K35 K34 exact report pin changed");
    for (const dimension of dimensions) {
        if (report.dimensions[dimension].conclusion !== "stable_for_exact_pinned_profile") {
            throw new Error(`K35 K34 ${dimension} is not stable for the exact pinned profile`);
        }
    }
    const gates = report.gates;
    if (gates.reportExecution !== "GO" || gates.productiveAuthority !== "NO-GO" || gates.applyOrCharacterMutation !== "NO-GO"
        || gates.publisherOrR2 !== "NO-GO" || gates.android !== "NO-GO" || gates.fyiRemoval !== "NO-GO"
        || gates.dokkanInfoRemoval !== "NO-GO") throw new Error("K35 accepts K34 only with every productive gate NO-GO");
}

function buildTaxonomyProjectionLineage(sources: TaxonomyProjectionValidatedSources): TaxonomyProjectionLineage {
    const k32 = sources.k32.manifest;
    const k34 = sources.k34Report;
    return {
        profileId: TAXONOMY_PROJECTION_SOURCE_PIN.profileId,
        k32: {
            contractVersion: k32.contractVersion,
            manifestSha256: hash(pinnedK32ManifestBytes(sources.k32)),
            manifestSizeBytes: pinnedK32ManifestBytes(sources.k32).length,
            payloadSha256: k32.sha256,
            payloadSizeBytes: k32.sizeBytes,
            rawSha256: k32.uncompressedSha256,
            rawSizeBytes: k32.uncompressedSizeBytes,
            coverageSha256: k32.coverageSha256,
            coverageSizeBytes: k32.coverageSizeBytes,
            validationSha256: k32.validationSha256,
            validationSizeBytes: k32.validationSizeBytes,
            sourceBoundValidation: "GO",
            productiveManifestSha256: k32.source.productiveCharacters.manifestSha256,
            productivePayloadSha256: k32.source.productiveCharacters.payloadSha256,
        },
        k2: {
            contractVersion: k32.source.k2.contractVersion,
            manifestSha256: k32.source.k2.manifestSha256,
            manifestSizeBytes: k32.source.k2.manifestSizeBytes,
            payloadSha256: k32.source.k2.payloadSha256,
            payloadSizeBytes: k32.source.k2.payloadSizeBytes,
            uncompressedSizeBytes: k32.source.k2.uncompressedSizeBytes,
            coverageSha256: k32.source.k2.coverageSha256,
            coverageSizeBytes: k32.source.k2.coverageSizeBytes,
            validationSha256: k32.source.k2.validationSha256,
            validationSizeBytes: k32.source.k2.validationSizeBytes,
        },
        k34: {
            contractVersion: k34.contractVersion,
            profileId: k34.profileId,
            reportSha256: hash(sources.k34Stdout),
            reportSizeBytes: Buffer.byteLength(sources.k34Stdout),
            inProcessValidation: "GO",
        },
        sqlite: { sha256: k34.provenance.sqlite.sha256, sizeBytes: k34.provenance.sqlite.sizeBytes },
        db1: {
            sha256: k34.provenance.db1.sha256,
            sizeBytes: k34.provenance.db1.sizeBytes,
            uncompressedSizeBytes: k34.provenance.db1.uncompressedSizeBytes,
        },
        elf: {
            sha256: k34.provenance.nativeRuntime.sha256,
            sizeBytes: k34.provenance.nativeRuntime.sizeBytes,
            format: k34.provenance.nativeRuntime.format,
        },
        nativeLayout: {
            sha256: k34.provenance.nativeEvidence.sha256,
            sizeBytes: k34.provenance.nativeEvidence.sizeBytes,
        },
    };
}

export function projectSupportedTaxonomyRecords(
    sourceRecordsInput: CharacterStructuralIdentityRecord[],
): { records: TaxonomyProjectionRecord[]; coverage: TaxonomyProjectionCoverage } {
    const records: TaxonomyProjectionRecord[] = [];
    const coverage: TaxonomyProjectionCoverage = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-coverage",
        contractVersion: TAXONOMY_PROJECTION_CONTRACT_VERSION,
        sourceCardCount: sourceRecordsInput.length,
        projectedCardCount: 0,
        dimensions: {
            characterClass: emptyDimensionCoverage(),
            categories: emptyDimensionCoverage(),
            links: emptyDimensionCoverage(),
        },
    };

    const sourceRecords = [...sourceRecordsInput].sort((left, right) => numeric(left.cardId, right.cardId));
    for (const source of sourceRecords) {
        const record: TaxonomyProjectionRecord = { cardId: source.cardId };
        if (source.characterClass.status === "supported") {
            record.characterClass = { raw: source.characterClass.raw, normalized: source.characterClass.value };
            coverage.dimensions.characterClass.includedCardCount++;
            coverage.dimensions.characterClass.includedFactCount++;
        } else {
            exclude(coverage.dimensions.characterClass, source.characterClass.status, source.cardId, 1);
        }

        const categorySupported = source.categories.status === "supported"
            && source.categories.state === "present_with_row_provenance"
            && source.categories.assignments.length > 0
            && source.categories.assignments.every(value => value.status === "supported");
        if (categorySupported) {
            record.categories = source.categories.assignments
                .map(value => ({ categoryId: value.categoryId, relationRowId: value.relationRowId }))
                .sort((left, right) => numeric(left.categoryId, right.categoryId) || numeric(left.relationRowId, right.relationRowId));
            coverage.dimensions.categories.includedCardCount++;
            coverage.dimensions.categories.includedFactCount += record.categories.length;
        } else {
            const reason = source.categories.status === "partial" ? "partial" : "unknown";
            exclude(coverage.dimensions.categories, reason, source.cardId, source.categories.assignments.length);
        }

        const linksSupported = source.links.status === "supported"
            && source.links.state === "present_with_row_provenance"
            && source.links.entries.length > 0
            && source.links.entries.every(value => value.status === "supported");
        if (linksSupported) {
            record.links = source.links.entries
                .map(value => ({ slot: value.slot, linkSkillId: value.linkSkillId }))
                .sort((left, right) => left.slot - right.slot || numeric(left.linkSkillId, right.linkSkillId));
            coverage.dimensions.links.includedCardCount++;
            coverage.dimensions.links.includedFactCount += record.links.length;
        } else {
            const reason = source.links.status === "partial" ? "partial" : "unknown";
            exclude(coverage.dimensions.links, reason, source.cardId, source.links.entries.length);
        }
        records.push(record);
    }
    coverage.projectedCardCount = records.length;

    return { records, coverage };
}

export function buildTaxonomyProjection(
    sources: TaxonomyProjectionValidatedSources,
): { projection: TaxonomyProjectionDataset; coverage: TaxonomyProjectionCoverage } {
    assertPinnedTaxonomyProjectionSources(sources);
    const { records, coverage } = projectSupportedTaxonomyRecords(sources.k32.sidecar.records);

    const expected = TAXONOMY_PROJECTION_SOURCE_PIN.expected;
    const classCoverage = coverage.dimensions.characterClass;
    const categoryCoverage = coverage.dimensions.categories;
    const linkCoverage = coverage.dimensions.links;
    if (coverage.sourceCardCount !== expected.cardCount || coverage.projectedCardCount !== expected.cardCount
        || classCoverage.includedCardCount !== expected.characterClassIncludedCardCount || classCoverage.excludedCardCount !== 0
        || categoryCoverage.includedCardCount !== expected.categoryIncludedCardCount
        || categoryCoverage.exclusions.unknown !== expected.categoryUnknownCardCount
        || categoryCoverage.includedFactCount !== expected.categoryAssignmentCount
        || linkCoverage.includedCardCount !== expected.linkIncludedCardCount
        || linkCoverage.exclusions.unknown !== expected.linkUnknownCardCount
        || linkCoverage.includedFactCount !== expected.linkEntryCount) throw new Error("K35 projected supported coverage changed");

    return {
        projection: {
            schemaVersion: 1,
            contract: "dokkan-database-character-taxonomy-projection",
            contractVersion: TAXONOMY_PROJECTION_CONTRACT_VERSION,
            generatedAt: TAXONOMY_PROJECTION_SOURCE_PIN.generatedAt,
            datasetVersion: TAXONOMY_PROJECTION_SOURCE_PIN.datasetVersion,
            mode: "explicit_opt_in_offline_generation_validation_only",
            source: buildTaxonomyProjectionLineage(sources),
            policy: {
                recordKey: "cardId",
                records: "card_scoped",
                dimensions: "supported_only",
                labelsOrPresentationIncluded: false,
                labelsAsAuthority: false,
                categoryOrder: "numeric_category_id_then_relation_row_id",
                linkOrder: "slot",
                missingRowEvidence: "omit_dimension_without_empty_invention",
                characterShapeReadOrWritten: false,
                applyOrOverlayApiImplemented: false,
                consumerImplemented: false,
                publisherImplemented: false,
                androidImplemented: false,
            },
            records,
        },
        coverage,
    };
}
