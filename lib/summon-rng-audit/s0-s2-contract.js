"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = exports.validateS0S2Audit = exports.S0_S2_CONTRACT_VERSION = exports.S0_S2_CONTRACT = exports.S0_S2_SCHEMA_VERSION = void 0;
const crypto_1 = require("crypto");
exports.S0_S2_SCHEMA_VERSION = 1;
exports.S0_S2_CONTRACT = "dokkan-summon-rng-audit-s0-s2";
exports.S0_S2_CONTRACT_VERSION = "0.1.0";
const classifications = ["first_party_supported", "statistically_supported", "corroborative_only", "consistent_but_unproven", "unknown", "contradicted"];
const roles = ["apk", "elf", "sqlite_current", "sqlite_backup", "official_rate_snapshot"];
const kinds = ["client_side_static", "protocol_network", "published_rates", "statistical_observation", "community_report", "server_side_inference"];
const sourceAuthorities = ["bandai_namco_dokkan_faq", "repository_local"];
const capabilities = ["offline_static_validation", "exact_null_model", "server_algorithm_recovery", "causal_or_false_rate_claim", "sensitive_or_live_methods"];
const sensitiveKeys = /(?:account|token|cookie|credential|password|secret|device|advertis|raw.?payload|authorization|session.?id)/i;
const sensitiveValues = /(?:\bauthorization\s*:|\bcookie\s*:|\b(?:bearer|basic)\s+[a-z0-9+/_=.-]{8,}|\b(?:access_?token|refresh_?token|password|secret|account_?id|device_?id|session_?id)\s*[=:]\s*\S+|\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.)/i;
const keys = (value) => value && typeof value === "object" ? Object.keys(value) : [];
const unique = (values) => new Set(values).size === values.length;
const ids = (values) => values.every(v => /^[a-z][a-z0-9_-]{0,63}$/.test(v.id)) && unique(values.map(v => v.id));
const text = (value) => typeof value === "string" && value.trim().length > 0;
function inspectSensitive(value, path = "$", failures = []) {
    if (typeof value === "string") {
        if (sensitiveValues.test(value))
            failures.push(`sensitive value: ${path}`);
        return failures;
    }
    if (!value || typeof value !== "object")
        return failures;
    for (const [key, child] of Object.entries(value)) {
        const policyField = path === "$.policy";
        if (!policyField && sensitiveKeys.test(key))
            failures.push(`sensitive key: ${path}.${key}`);
        inspectSensitive(child, `${path}.${key}`, failures);
    }
    return failures;
}
function exact(value, allowed, path, failures) {
    for (const key of keys(value))
        if (!allowed.includes(key))
            failures.push(`unknown field: ${path}.${key}`);
}
function refs(refs, known, label, failures) {
    if (!Array.isArray(refs) || refs.length === 0)
        failures.push(`${label} requires evidence refs`);
    else
        for (const ref of refs)
            if (!known.has(ref))
                failures.push(`dangling ref: ${label}:${ref}`);
}
function validateS0S2Audit(audit) {
    const failures = [];
    if (!audit || audit.schemaVersion !== 1 || audit.contract !== exports.S0_S2_CONTRACT || audit.contractVersion !== exports.S0_S2_CONTRACT_VERSION || audit.campaign !== "summon_rng" || audit.collectionMode !== "offline_only" || audit.productionMutation !== false || audit.defaultEnabled !== false)
        failures.push("root contract");
    exact(audit, ["schemaVersion", "contract", "contractVersion", "campaign", "collectionMode", "productionMutation", "defaultEnabled", "artifacts", "ledger", "findings", "decisions", "policy"], "$", failures);
    if (!Array.isArray(audit.artifacts) || !ids(audit.artifacts))
        failures.push("artifact IDs");
    if (!Array.isArray(audit.ledger) || !ids(audit.ledger))
        failures.push("ledger IDs");
    if (!Array.isArray(audit.findings) || !ids(audit.findings))
        failures.push("finding IDs");
    if (!Array.isArray(audit.decisions) || !ids(audit.decisions))
        failures.push("decision IDs");
    const allIds = [...(audit.artifacts ?? []), ...(audit.ledger ?? []), ...(audit.findings ?? []), ...(audit.decisions ?? [])].map(value => value.id);
    if (!unique(allIds))
        failures.push("cross-contract duplicate IDs");
    const artifactIds = new Set((audit.artifacts ?? []).map(v => v.id));
    const ledgerIds = new Set((audit.ledger ?? []).map(v => v.id));
    const ledgerById = new Map((audit.ledger ?? []).map(value => [value.id, value]));
    const evidenceIds = new Set([...ledgerIds, ...(audit.findings ?? []).map(v => v.id)]);
    for (const artifact of audit.artifacts ?? []) {
        exact(artifact, ["id", "role", "declared", "sha256", "sizeBytes", "region", "gameBuild", "version", "structuralIdentity"], `artifacts.${artifact.id}`, failures);
        if (!roles.includes(artifact.role) || artifact.declared !== true || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0 || !text(artifact.structuralIdentity))
            failures.push(`artifact contract: ${artifact.id}`);
        for (const value of [artifact.region, artifact.gameBuild, artifact.version])
            if (value !== undefined && !text(value))
                failures.push(`artifact metadata: ${artifact.id}`);
    }
    for (const entry of audit.ledger ?? []) {
        exact(entry, ["id", "kind", "classification", "summary", "artifactRefs", "sourceAuthority", "sourceRef"], `ledger.${entry.id}`, failures);
        if (!kinds.includes(entry.kind) || !classifications.includes(entry.classification) || !text(entry.summary))
            failures.push(`ledger contract: ${entry.id}`);
        if (entry.classification === "first_party_supported" && entry.kind !== "client_side_static" && entry.kind !== "protocol_network" && entry.kind !== "published_rates")
            failures.push(`unsupported first-party claim: ${entry.id}`);
        if (entry.sourceAuthority !== undefined && !sourceAuthorities.includes(entry.sourceAuthority))
            failures.push(`source authority: ${entry.id}`);
        if ((entry.sourceAuthority === undefined) !== (entry.sourceRef === undefined))
            failures.push(`source authority/ref pair: ${entry.id}`);
        if (entry.sourceAuthority === "bandai_namco_dokkan_faq" && !/^https:\/\/bnfaq\.channel\.or\.jp\/faq\/detail\/1625\/[0-9]+$/.test(entry.sourceRef ?? ""))
            failures.push(`official source ref: ${entry.id}`);
        if (entry.sourceAuthority === "repository_local" && !/^repository:[a-z0-9][a-z0-9_./-]+$/.test(entry.sourceRef ?? ""))
            failures.push(`repository source ref: ${entry.id}`);
        if (entry.classification === "first_party_supported" && (entry.artifactRefs?.length ?? 0) === 0 && entry.sourceAuthority !== "bandai_namco_dokkan_faq")
            failures.push(`unanchored first-party claim: ${entry.id}`);
        for (const ref of entry.artifactRefs ?? [])
            if (!artifactIds.has(ref))
                failures.push(`dangling artifact ref: ${entry.id}:${ref}`);
    }
    for (const finding of audit.findings ?? []) {
        exact(finding, ["id", "kind", "classification", "claim", "evidenceRefs", "conclusion"], `findings.${finding.id}`, failures);
        if (!kinds.includes(finding.kind) || !classifications.includes(finding.classification) || !text(finding.claim) || !text(finding.conclusion))
            failures.push(`finding contract: ${finding.id}`);
        refs(finding.evidenceRefs, ledgerIds, `finding.${finding.id}`, failures);
        if (finding.classification === "first_party_supported" && finding.kind !== "client_side_static" && finding.kind !== "protocol_network" && finding.kind !== "published_rates")
            failures.push(`unsupported first-party claim: ${finding.id}`);
        if (finding.classification === "first_party_supported" && finding.evidenceRefs.some(ref => ledgerById.get(ref)?.classification !== "first_party_supported"))
            failures.push(`classification-incompatible evidence: ${finding.id}`);
        if (finding.classification === "statistically_supported" && finding.evidenceRefs.every(ref => ledgerById.get(ref)?.classification !== "statistically_supported"))
            failures.push(`classification-incompatible evidence: ${finding.id}`);
    }
    for (const decision of audit.decisions ?? []) {
        exact(decision, ["id", "capability", "status", "claim", "evidenceRefs", "rationale"], `decisions.${decision.id}`, failures);
        if (!capabilities.includes(decision.capability) || !["GO", "NO-GO"].includes(decision.status) || !text(decision.claim) || !text(decision.rationale))
            failures.push(`decision contract: ${decision.id}`);
        refs(decision.evidenceRefs, evidenceIds, `decision.${decision.id}`, failures);
        if (decision.status === "GO" && decision.capability !== "offline_static_validation")
            failures.push(`GO contradicts capability policy: ${decision.id}`);
        if (decision.status === "GO" && decision.evidenceRefs.some(ref => {
            const evidence = ledgerById.get(ref) ?? (audit.findings ?? []).find(value => value.id === ref);
            return evidence?.classification !== "first_party_supported" && evidence?.classification !== "statistically_supported";
        }))
            failures.push(`GO lacks supported evidence: ${decision.id}`);
    }
    exact(audit.policy, ["credentials", "accountIds", "deviceIds", "rawAuthenticatedPayloads", "spend", "automation", "hooking", "instrumentation", "predictionOrExploitation", "production", "r2", "android"], "policy", failures);
    for (const key of ["credentials", "accountIds", "deviceIds", "rawAuthenticatedPayloads", "spend", "automation", "hooking", "instrumentation", "predictionOrExploitation", "production", "r2", "android"])
        if (audit.policy?.[key] !== false)
            failures.push(`policy not prohibited: ${key}`);
    inspectSensitive(audit, "$", failures);
    return { schemaVersion: 1, valid: failures.length === 0, artifactCount: audit.artifacts?.length ?? 0, ledgerCount: audit.ledger?.length ?? 0, findingCount: audit.findings?.length ?? 0, decisionCount: audit.decisions?.length ?? 0, failures: [...new Set(failures)] };
}
exports.validateS0S2Audit = validateS0S2Audit;
function sha256Hex(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
exports.sha256Hex = sha256Hex;
//# sourceMappingURL=s0-s2-contract.js.map