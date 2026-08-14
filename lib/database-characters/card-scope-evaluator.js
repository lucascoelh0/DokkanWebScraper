"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCardScopeReport = exports.validateCardScopeReport = exports.buildCardScopeReport = void 0;
const card_scope_contract_1 = require("./card-scope-contract");
const card_scope_native_1 = require("./card-scope-native");
const DIMENSIONS = ["characterClass", "categories", "links"];
function buildCardScopeReport(schemaProof, joinProof, nativeProof) {
    const dimensions = {};
    for (const dimension of DIMENSIONS) {
        const native = nativeProof.dimensions[dimension];
        const statuses = [schemaProof.status, joinProof.status, native.status];
        const stability = statuses.every(value => value === "supported")
            ? "supported"
            : statuses.some(value => value === "supported" || value === "partial") ? "partial" : "unknown";
        dimensions[dimension] = {
            schemaStatus: schemaProof.status,
            db1K2Status: joinProof.status,
            nativeStatus: native.status,
            stability,
            conclusion: stability === "supported" ? "stable_for_exact_pinned_profile" : "not_fully_proved",
            reasons: native.reasons.slice(0, card_scope_contract_1.CARD_SCOPE_MAX_EXAMPLES_PER_REASON),
            authority: "NO-GO",
        };
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-card-scope-audit",
        contractVersion: card_scope_contract_1.CARD_SCOPE_CONTRACT_VERSION,
        profileId: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.profileId,
        execution: {
            mode: "explicit_opt_in_offline_report_only",
            decision: "GO",
            stdoutOnly: true,
            maxExamplesPerReason: card_scope_contract_1.CARD_SCOPE_MAX_EXAMPLES_PER_REASON,
            rssLimitBytesExclusive: card_scope_contract_1.CARD_SCOPE_RSS_LIMIT_BYTES,
        },
        provenance: {
            snapshotVersion: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.snapshotVersion,
            sqlite: { fileName: card_scope_contract_1.CARD_SCOPE_FILES.sqlite, sha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.sha256, sizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.sizeBytes },
            db1: {
                fileName: card_scope_contract_1.CARD_SCOPE_FILES.db1Payload,
                sha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.sha256,
                sizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.sizeBytes,
                uncompressedSizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.uncompressedSizeBytes,
            },
            k2: {
                fileName: card_scope_contract_1.CARD_SCOPE_FILES.k2Payload,
                manifestSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.manifestSha256,
                payloadSha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.payloadSha256,
                payloadSizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.payloadSizeBytes,
            },
            nativeRuntime: { fileName: card_scope_contract_1.CARD_SCOPE_FILES.elf, ...card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf },
            nativeEvidence: {
                fileName: card_scope_contract_1.CARD_SCOPE_FILES.nativeLayout,
                sha256: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256,
                sizeBytes: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sizeBytes,
            },
        },
        policy: {
            identity: "card_id_and_row_id_only",
            namesOrLabelsAsIdentity: false,
            absentReplacementColumnsAloneProveStability: false,
            productiveStateBinding: "unavailable",
            mutationSurface: "none",
        },
        schemaProof,
        joinProof,
        nativeProof,
        dimensions,
        gates: {
            reportExecution: "GO",
            productiveAuthority: "NO-GO",
            applyOrCharacterMutation: "NO-GO",
            publisherOrR2: "NO-GO",
            android: "NO-GO",
            fyiRemoval: "NO-GO",
            dokkanInfoRemoval: "NO-GO",
        },
        residualUnknowns: [
            "The conclusion is structural and applies only to the exact pinned profile; it does not generalize across game versions.",
            "No productive release-state lineage binds an effective Character projection to this report.",
            "This report does not authorize value application, publication, Android changes, or source removal.",
        ],
    };
}
exports.buildCardScopeReport = buildCardScopeReport;
function validateCardScopeReport(report) {
    if (report.schemaVersion !== 1 || report.contract !== "dokkan-database-characters-card-scope-audit"
        || report.contractVersion !== card_scope_contract_1.CARD_SCOPE_CONTRACT_VERSION || report.profileId !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.profileId) {
        throw new Error("K34 report contract drift");
    }
    if (report.execution.mode !== "explicit_opt_in_offline_report_only" || report.execution.decision !== "GO"
        || !report.execution.stdoutOnly || report.execution.maxExamplesPerReason !== card_scope_contract_1.CARD_SCOPE_MAX_EXAMPLES_PER_REASON
        || report.execution.rssLimitBytesExclusive !== card_scope_contract_1.CARD_SCOPE_RSS_LIMIT_BYTES)
        throw new Error("K34 execution policy drift");
    if (report.policy.identity !== "card_id_and_row_id_only" || report.policy.namesOrLabelsAsIdentity
        || report.policy.absentReplacementColumnsAloneProveStability || report.policy.productiveStateBinding !== "unavailable"
        || report.policy.mutationSurface !== "none")
        throw new Error("K34 identity/mutation policy drift");
    const noGoGates = [report.gates.productiveAuthority, report.gates.applyOrCharacterMutation, report.gates.publisherOrR2,
        report.gates.android, report.gates.fyiRemoval, report.gates.dokkanInfoRemoval];
    if (report.gates.reportExecution !== "GO" || noGoGates.some(value => value !== "NO-GO"))
        throw new Error("K34 gate drift");
    if (report.provenance.snapshotVersion !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.snapshotVersion
        || report.provenance.sqlite.fileName !== card_scope_contract_1.CARD_SCOPE_FILES.sqlite || report.provenance.sqlite.sha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.sha256
        || report.provenance.sqlite.sizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.sizeBytes
        || report.provenance.db1.fileName !== card_scope_contract_1.CARD_SCOPE_FILES.db1Payload || report.provenance.db1.sha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.sha256
        || report.provenance.db1.sizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.sizeBytes
        || report.provenance.db1.uncompressedSizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1.uncompressedSizeBytes
        || report.provenance.k2.fileName !== card_scope_contract_1.CARD_SCOPE_FILES.k2Payload || report.provenance.k2.manifestSha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.manifestSha256
        || report.provenance.k2.payloadSha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.payloadSha256
        || report.provenance.k2.payloadSizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.k2.payloadSizeBytes
        || report.provenance.nativeRuntime.fileName !== card_scope_contract_1.CARD_SCOPE_FILES.elf || report.provenance.nativeRuntime.sha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sha256
        || report.provenance.nativeRuntime.sizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sizeBytes || report.provenance.nativeRuntime.format !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.format
        || report.provenance.nativeEvidence.fileName !== card_scope_contract_1.CARD_SCOPE_FILES.nativeLayout
        || report.provenance.nativeEvidence.sha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256
        || report.provenance.nativeEvidence.sizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sizeBytes)
        throw new Error("K34 report provenance drift");
    if (report.schemaProof.tableCount !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite.tableCount
        || JSON.stringify(report.schemaProof.cardsColumns) !== JSON.stringify(card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.cards)
        || JSON.stringify(report.schemaProof.categoryRelationColumns) !== JSON.stringify(card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.card_card_categories)
        || JSON.stringify(report.schemaProof.optimalAwakeningGrowthColumns) !== JSON.stringify(card_scope_contract_1.CARD_SCOPE_TABLE_LAYOUTS.optimal_awakening_growths)
        || Object.values(report.schemaProof.replacementColumns).some(columns => columns.length !== 0))
        throw new Error("K34 report schema-proof drift");
    if (report.joinProof.identityPolicy !== "structural_ids_only_no_names_or_labels"
        || report.joinProof.db1CardCount !== report.joinProof.k2CardCount || report.joinProof.joinedCardCount !== report.joinProof.k2CardCount
        || report.joinProof.db1CardCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.cardCount
        || report.joinProof.growthStateCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.growthStateCount
        || report.joinProof.distinctGrowthRowCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.distinctGrowthRowCount
        || report.joinProof.categoryAssignmentCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.categoryAssignmentCount
        || report.joinProof.linkAssignmentCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.linkAssignmentCount
        || [report.joinProof.duplicateCardIdCount, report.joinProof.missingCardJoinCount, report.joinProof.duplicateCategoryRelationIdCount,
            report.joinProof.missingCategoryJoinCount, report.joinProof.duplicateLinkSlotCount, report.joinProof.missingLinkJoinCount].some(value => value !== 0)) {
        throw new Error("K34 report join-proof drift");
    }
    for (const dimension of DIMENSIONS) {
        const decision = report.dimensions[dimension];
        const nativeDimension = report.nativeProof.dimensions[dimension];
        if (!decision || decision.reasons.length > card_scope_contract_1.CARD_SCOPE_MAX_EXAMPLES_PER_REASON || decision.authority !== "NO-GO") {
            throw new Error(`K34 invalid ${dimension} decision`);
        }
        if (!nativeDimension || nativeDimension.reasons.length > card_scope_contract_1.CARD_SCOPE_MAX_EXAMPLES_PER_REASON) {
            throw new Error(`K34 invalid ${dimension} native proof roles`);
        }
        const requiredRoles = card_scope_native_1.CARD_SCOPE_NATIVE_REQUIRED_ROLES[dimension];
        const uniqueProofRoles = new Set(nativeDimension.proofRoles);
        const expectedProofRoles = requiredRoles.filter(role => uniqueProofRoles.has(role));
        const missingRoles = requiredRoles.filter(role => !uniqueProofRoles.has(role));
        const expectedNativeStatus = missingRoles.length === 0 ? "supported" : expectedProofRoles.length === 0 ? "unknown" : "partial";
        const expectedReasons = missingRoles.length === 0 ? [] : [`native path missing required roles: ${missingRoles.join(",")}`];
        if (uniqueProofRoles.size !== nativeDimension.proofRoles.length
            || JSON.stringify(nativeDimension.proofRoles) !== JSON.stringify(expectedProofRoles)
            || nativeDimension.status !== expectedNativeStatus
            || JSON.stringify(nativeDimension.reasons) !== JSON.stringify(expectedReasons)) {
            throw new Error(`K34 invalid ${dimension} native proof roles`);
        }
        const fullySupported = decision.schemaStatus === "supported" && decision.db1K2Status === "supported" && decision.nativeStatus === "supported";
        if ((decision.stability === "supported") !== fullySupported
            || (decision.conclusion === "stable_for_exact_pinned_profile") !== fullySupported) {
            throw new Error(`K34 unsupported GO inference for ${dimension}`);
        }
        if (decision.schemaStatus !== report.schemaProof.status || decision.db1K2Status !== report.joinProof.status
            || decision.nativeStatus !== nativeDimension.status || JSON.stringify(decision.reasons) !== JSON.stringify(nativeDimension.reasons)) {
            throw new Error(`K34 ${dimension} decision/proof mismatch`);
        }
    }
    const nativeStatuses = Object.values(report.nativeProof.dimensions).map(value => value.status);
    const expectedNativeStatus = nativeStatuses.every(value => value === "supported") ? "supported"
        : nativeStatuses.every(value => value === "unknown") ? "unknown" : "partial";
    if (report.nativeProof.status !== expectedNativeStatus)
        throw new Error("K34 native aggregate status drift");
    if (report.nativeProof.sourceSha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sha256
        || report.nativeProof.sourceSizeBytes !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf.sizeBytes
        || report.nativeProof.layoutSha256 !== card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256
        || report.nativeProof.codeRegionCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeCodeRegionCount
        || report.nativeProof.directCallCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeDirectCallCount
        || report.nativeProof.relocationCount !== card_scope_contract_1.CARD_SCOPE_EXPECTED_COUNTS.nativeRelocationCount)
        throw new Error("K34 native provenance drift");
}
exports.validateCardScopeReport = validateCardScopeReport;
function serializeCardScopeReport(report) {
    validateCardScopeReport(report);
    return `${JSON.stringify(report, null, 2)}\n`;
}
exports.serializeCardScopeReport = serializeCardScopeReport;
//# sourceMappingURL=card-scope-evaluator.js.map