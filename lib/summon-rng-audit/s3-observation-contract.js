"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyS3ObservationDataset = exports.generateS3Id = exports.validateS3ObservationDataset = exports.S3_CONTRACT_VERSION = exports.S3_CONTRACT = exports.S3_SCHEMA_VERSION = void 0;
exports.S3_SCHEMA_VERSION = 1;
exports.S3_CONTRACT = "dokkan-summon-rng-audit-s3-observations";
exports.S3_CONTRACT_VERSION = "0.2.0";
const regions = ["global", "japan"];
const triggerTypes = ["card_set", "rarity", "animation", "reward", "other"];
const summonTypes = ["friend_single", "friend_multi", "banner_single", "banner_multi"];
const rarities = ["N", "R", "SR", "SSR", "UR", "LR", "unknown"];
const origins = ["manual_screen_recording", "manual_screenshot_transcription", "sanitized_local_history", "consented_sanitized_contribution"];
const qualities = ["complete_verified", "complete_unverified", "partial_exploratory"];
const rulesStatuses = ["missing", "pinned"];
const evidenceRoles = ["trigger_preregistration", "official_rules", "observation_source"];
const evidenceMediaTypes = ["application/json", "text/html", "application/pdf", "image/png", "image/jpeg", "video/mp4"];
const rootFields = ["schemaVersion", "contract", "contractVersion", "campaign", "collectionMode", "datasetId", "defaultEnabled", "productionMutation", "triggerDefinition", "evidenceArtifacts", "banners", "sessions", "observations", "policy"];
const triggerFields = ["status", "triggerId", "observableType", "observableRule", "fixedBeforeCollection", "preregistrationEvidenceRef"];
const evidenceFields = ["evidenceId", "role", "sha256", "sizeBytes", "mediaType", "sanitized"];
const bannerFields = ["bannerId", "bannerVersion", "region", "validFromBucket", "validUntilBucket", "officialRulesStatus", "officialRulesEvidenceRef"];
const sessionFields = ["anonymousSessionId", "gameBuild", "region", "origin", "quality"];
const observationFields = ["observationId", "anonymousSessionId", "temporalBucket", "bannerId", "bannerVersion", "summonType", "multiId", "slotIndex", "cardId", "rarity", "featuredFlag", "guaranteedSlotFlag", "friendSummonSequenceId", "friendAttemptIndex", "friendTriggerFlag", "attemptsUntilTrigger", "friendToNormalIntervalSeconds", "origin", "quality", "sourceEvidenceRef"];
const policyFields = ["accountIds", "credentials", "deviceIds", "rawAuthenticatedPayloads", "reversibleIdentifierHashing", "experimentalSpend", "summonAutomation", "predictionOrExploitation", "production", "r2", "android"];
const sensitiveKeys = /(?:account|token|cookie|credential|password|secret|device|advertis|raw.?payload|authorization|user.?id|player.?id|email|phone|ip.?address)/i;
const sensitiveValues = /(?:\bauthorization\s*:|\bcookie\s*:|\b(?:bearer|basic)\s+[a-z0-9+/_=.-]{8,}|\b(?:access_?token|refresh_?token|password|secret|account_?id|device_?id|user_?id|player_?id)\s*[=:]\s*\S+|\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.)/i;
const generatedId = (prefix, value) => typeof value === "string" && new RegExp(`^${prefix}_[a-z0-9]{16}$`).test(value);
const label = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const bucket = (value) => {
    if (typeof value !== "string")
        return false;
    const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):00Z$/.exec(value);
    if (!match)
        return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const parsed = new Date(Date.UTC(year, month - 1, day, hour));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day && parsed.getUTCHours() === hour;
};
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const oneOf = (values, value) => typeof value === "string" && values.includes(value);
const object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value, allowed, path, failures) => {
    if (!object(value)) {
        failures.push(`object required: ${path}`);
        return;
    }
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            failures.push(`unknown field: ${path}.${key}`);
};
const unique = (values) => new Set(values).size === values.length;
function inspectSensitive(value, path, failures) {
    if (typeof value === "string") {
        if (sensitiveValues.test(value))
            failures.push(`sensitive value: ${path}`);
        return;
    }
    if (!value || typeof value !== "object")
        return;
    for (const [key, child] of Object.entries(value)) {
        const allowedContractField = key === "anonymousSessionId" || key === "rawAuthenticatedPayloads" || key === "deviceIds" || key === "accountIds" || key === "credentials";
        if (!allowedContractField && sensitiveKeys.test(key))
            failures.push(`sensitive key: ${path}.${key}`);
        inspectSensitive(child, `${path}.${key}`, failures);
    }
}
const bannerKey = (bannerId, bannerVersion, region) => `${region}\u0000${bannerId}\u0000${bannerVersion}`;
function validateS3ObservationDataset(value) {
    const failures = [];
    exact(value, rootFields, "$", failures);
    const dataset = object(value) ? value : {};
    const evidenceArtifacts = Array.isArray(dataset.evidenceArtifacts) ? dataset.evidenceArtifacts : [];
    const banners = Array.isArray(dataset.banners) ? dataset.banners : [];
    const sessions = Array.isArray(dataset.sessions) ? dataset.sessions : [];
    const observations = Array.isArray(dataset.observations) ? dataset.observations : [];
    if (dataset.schemaVersion !== exports.S3_SCHEMA_VERSION || dataset.contract !== exports.S3_CONTRACT || dataset.contractVersion !== exports.S3_CONTRACT_VERSION || dataset.campaign !== "summon_rng" || dataset.collectionMode !== "sanitized_observational_only" || dataset.defaultEnabled !== false || dataset.productionMutation !== false || !generatedId("dataset", dataset.datasetId))
        failures.push("root contract");
    if (!Array.isArray(dataset.evidenceArtifacts))
        failures.push("evidence artifacts array");
    if (!Array.isArray(dataset.banners))
        failures.push("banners array");
    if (!Array.isArray(dataset.sessions))
        failures.push("sessions array");
    if (!Array.isArray(dataset.observations))
        failures.push("observations array");
    exact(dataset.triggerDefinition, triggerFields, "triggerDefinition", failures);
    const trigger = object(dataset.triggerDefinition) ? dataset.triggerDefinition : {};
    if (trigger.status === "pending") {
        if (trigger.triggerId !== null || trigger.observableType !== null || trigger.observableRule !== null || trigger.fixedBeforeCollection !== false || trigger.preregistrationEvidenceRef !== null)
            failures.push("pending trigger definition");
    }
    else if (trigger.status === "fixed") {
        if (!label(trigger.triggerId) || !oneOf(triggerTypes, trigger.observableType) || typeof trigger.observableRule !== "string" || trigger.observableRule.trim().length < 8 || trigger.observableRule.length > 500 || trigger.fixedBeforeCollection !== true || !generatedId("evidence", trigger.preregistrationEvidenceRef))
            failures.push("fixed trigger definition");
    }
    else
        failures.push("trigger status");
    const knownEvidence = new Map();
    for (let index = 0; index < evidenceArtifacts.length; index++) {
        const evidence = evidenceArtifacts[index];
        exact(evidence, evidenceFields, `evidenceArtifacts[${index}]`, failures);
        if (!object(evidence) || !generatedId("evidence", evidence.evidenceId) || !oneOf(evidenceRoles, evidence.role) || !/^[a-f0-9]{64}$/.test(evidence.sha256) || !integer(evidence.sizeBytes, 1, Number.MAX_SAFE_INTEGER) || !oneOf(evidenceMediaTypes, evidence.mediaType) || evidence.sanitized !== true) {
            failures.push(`evidence artifact contract: ${index}`);
            continue;
        }
        if (knownEvidence.has(evidence.evidenceId))
            failures.push(`duplicate evidence artifact: ${evidence.evidenceId}`);
        knownEvidence.set(evidence.evidenceId, evidence);
    }
    if (trigger.status === "fixed" && knownEvidence.get(trigger.preregistrationEvidenceRef)?.role !== "trigger_preregistration")
        failures.push("trigger preregistration evidence");
    const knownBanners = new Map();
    for (let index = 0; index < banners.length; index++) {
        const banner = banners[index];
        exact(banner, bannerFields, `banners[${index}]`, failures);
        if (!object(banner) || !label(banner.bannerId) || !label(banner.bannerVersion) || !oneOf(regions, banner.region) || !bucket(banner.validFromBucket) || !bucket(banner.validUntilBucket) || !oneOf(rulesStatuses, banner.officialRulesStatus)) {
            failures.push(`banner contract: ${index}`);
            continue;
        }
        if (banner.validFromBucket > banner.validUntilBucket)
            failures.push(`banner validity: ${banner.bannerId}:${banner.bannerVersion}`);
        if (banner.officialRulesStatus === "pinned" ? (!generatedId("evidence", banner.officialRulesEvidenceRef) || knownEvidence.get(banner.officialRulesEvidenceRef)?.role !== "official_rules") : banner.officialRulesEvidenceRef !== null)
            failures.push(`official rules identity: ${banner.bannerId}:${banner.bannerVersion}`);
        const key = bannerKey(banner.bannerId, banner.bannerVersion, banner.region);
        if (knownBanners.has(key))
            failures.push(`duplicate banner version: ${banner.bannerId}:${banner.bannerVersion}:${banner.region}`);
        knownBanners.set(key, banner);
    }
    const knownSessions = new Map();
    for (let index = 0; index < sessions.length; index++) {
        const session = sessions[index];
        exact(session, sessionFields, `sessions[${index}]`, failures);
        if (!object(session) || !generatedId("anon", session.anonymousSessionId) || typeof session.gameBuild !== "string" || !/^\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?$/i.test(session.gameBuild) || !oneOf(regions, session.region) || !oneOf(origins, session.origin) || !oneOf(qualities, session.quality)) {
            failures.push(`session contract: ${index}`);
            continue;
        }
        if (knownSessions.has(session.anonymousSessionId))
            failures.push(`duplicate anonymous session: ${session.anonymousSessionId}`);
        knownSessions.set(session.anonymousSessionId, session);
    }
    const observationIds = [];
    const multiGroups = new Map();
    for (let index = 0; index < observations.length; index++) {
        const row = observations[index];
        exact(row, observationFields, `observations[${index}]`, failures);
        if (!object(row) || !generatedId("obs", row.observationId) || !generatedId("anon", row.anonymousSessionId) || !bucket(row.temporalBucket) || !label(row.bannerId) || !label(row.bannerVersion) || !oneOf(summonTypes, row.summonType) || !generatedId("multi", row.multiId) || !integer(row.slotIndex, 1, 100) || !integer(row.cardId, 1, Number.MAX_SAFE_INTEGER) || !oneOf(rarities, row.rarity) || !(typeof row.featuredFlag === "boolean" || row.featuredFlag === null) || !(typeof row.guaranteedSlotFlag === "boolean" || row.guaranteedSlotFlag === null) || !oneOf(origins, row.origin) || !oneOf(qualities, row.quality) || !(row.sourceEvidenceRef === null || generatedId("evidence", row.sourceEvidenceRef))) {
            failures.push(`observation contract: ${index}`);
            continue;
        }
        observationIds.push(row.observationId);
        const session = knownSessions.get(row.anonymousSessionId);
        if (!session)
            failures.push(`unknown anonymous session: ${row.observationId}`);
        else {
            if (session.region !== knownBanners.get(bannerKey(row.bannerId, row.bannerVersion, session.region))?.region)
                failures.push(`unknown banner version: ${row.observationId}`);
            if (row.origin !== session.origin || row.quality !== session.quality)
                failures.push(`session provenance mismatch: ${row.observationId}`);
            const banner = knownBanners.get(bannerKey(row.bannerId, row.bannerVersion, session.region));
            if (banner && (row.temporalBucket < banner.validFromBucket || row.temporalBucket > banner.validUntilBucket))
                failures.push(`observation outside banner validity: ${row.observationId}`);
        }
        if (row.quality === "complete_verified") {
            if (knownEvidence.get(row.sourceEvidenceRef)?.role !== "observation_source")
                failures.push(`verified observation lacks source evidence: ${row.observationId}`);
        }
        else if (row.sourceEvidenceRef !== null && knownEvidence.get(row.sourceEvidenceRef)?.role !== "observation_source")
            failures.push(`observation source evidence: ${row.observationId}`);
        const friend = row.summonType.startsWith("friend_");
        if (friend) {
            if (!generatedId("friendseq", row.friendSummonSequenceId) || !integer(row.friendAttemptIndex, 1, 100000) || typeof row.friendTriggerFlag !== "boolean" || row.friendToNormalIntervalSeconds !== null)
                failures.push(`friend observation linkage: ${row.observationId}`);
            if (row.friendTriggerFlag ? row.attemptsUntilTrigger !== row.friendAttemptIndex : row.attemptsUntilTrigger !== null)
                failures.push(`friend trigger attempt: ${row.observationId}`);
        }
        else {
            if (row.friendAttemptIndex !== null || row.friendTriggerFlag !== null || row.attemptsUntilTrigger !== null)
                failures.push(`banner observation friend fields: ${row.observationId}`);
            const linked = row.friendSummonSequenceId !== null;
            if (linked !== (row.friendToNormalIntervalSeconds !== null) || (linked && (!generatedId("friendseq", row.friendSummonSequenceId) || !integer(row.friendToNormalIntervalSeconds, 0, 604800))))
                failures.push(`banner observation linkage: ${row.observationId}`);
        }
        if (trigger.status !== "fixed" && (row.friendTriggerFlag === true || (!friend && row.friendSummonSequenceId !== null)))
            failures.push(`unfixed trigger used: ${row.observationId}`);
        const groupKey = `${row.anonymousSessionId}\u0000${row.multiId}`;
        const group = multiGroups.get(groupKey) ?? [];
        group.push(row);
        multiGroups.set(groupKey, group);
    }
    if (!unique(observationIds))
        failures.push("duplicate observation IDs");
    for (const rows of multiGroups.values()) {
        const first = rows[0];
        const common = (row) => row.temporalBucket === first.temporalBucket && row.bannerId === first.bannerId && row.bannerVersion === first.bannerVersion && row.summonType === first.summonType && row.friendSummonSequenceId === first.friendSummonSequenceId && row.friendAttemptIndex === first.friendAttemptIndex && row.friendToNormalIntervalSeconds === first.friendToNormalIntervalSeconds && row.origin === first.origin && row.quality === first.quality;
        if (!rows.every(common))
            failures.push(`inconsistent multi: ${first.multiId}`);
        const slots = rows.map(row => row.slotIndex).sort((a, b) => a - b);
        if (!unique(slots.map(String)) || slots.some((slot, index) => slot !== index + 1))
            failures.push(`non-contiguous multi slots: ${first.multiId}`);
        const expected = first.summonType.endsWith("_single") ? 1 : null;
        if (expected !== null && rows.length !== expected)
            failures.push(`single summon slot count: ${first.multiId}`);
    }
    const friendGroups = new Map();
    for (const row of observations.filter(row => object(row) && typeof row.summonType === "string" && row.summonType.startsWith("friend_") && typeof row.friendSummonSequenceId === "string")) {
        const key = `${row.anonymousSessionId}\u0000${row.friendSummonSequenceId}`;
        const group = friendGroups.get(key) ?? [];
        group.push(row);
        friendGroups.set(key, group);
    }
    for (const rows of friendGroups.values()) {
        const sequenceId = rows[0].friendSummonSequenceId;
        const attempts = [...new Set(rows.map(row => row.friendAttemptIndex))].sort((a, b) => a - b);
        if (attempts.some((attempt, index) => attempt !== index + 1))
            failures.push(`missing negative Friend attempt: ${sequenceId}`);
        const attemptRows = new Map();
        for (const row of rows) {
            const grouped = attemptRows.get(row.friendAttemptIndex) ?? [];
            grouped.push(row);
            attemptRows.set(row.friendAttemptIndex, grouped);
        }
        let priorBucket = null;
        for (const attempt of attempts) {
            const grouped = attemptRows.get(attempt) ?? [];
            if (new Set(grouped.map(row => row.multiId)).size !== 1)
                failures.push(`multiple summons for Friend attempt: ${sequenceId}:${attempt}`);
            const attemptBucket = grouped[0]?.temporalBucket;
            if (priorBucket !== null && attemptBucket < priorBucket)
                failures.push(`Friend attempt time reversal: ${sequenceId}:${attempt}`);
            priorBucket = attemptBucket;
        }
        if (new Set(rows.map(row => `${row.bannerId}\u0000${row.bannerVersion}\u0000${row.summonType}`)).size !== 1)
            failures.push(`inconsistent Friend sequence summon: ${sequenceId}`);
        const triggerAttempts = [...new Set(rows.filter(row => row.friendTriggerFlag).map(row => row.friendAttemptIndex))];
        if (triggerAttempts.length > 1)
            failures.push(`multiple trigger attempts: ${sequenceId}`);
        if (triggerAttempts.length === 1 && attempts[attempts.length - 1] !== triggerAttempts[0])
            failures.push(`Friend attempts after trigger: ${sequenceId}`);
    }
    const triggeredSequences = new Set();
    for (const [key, rows] of friendGroups)
        if (rows.some(row => row.friendTriggerFlag))
            triggeredSequences.add(key);
    for (const row of observations.filter(row => object(row) && typeof row.summonType === "string" && row.summonType.startsWith("banner_") && row.friendSummonSequenceId !== null)) {
        const key = `${row.anonymousSessionId}\u0000${row.friendSummonSequenceId}`;
        if (!triggeredSequences.has(key))
            failures.push(`linked banner lacks observed trigger: ${row.observationId}`);
        const triggerRows = friendGroups.get(key)?.filter(value => value.friendTriggerFlag) ?? [];
        if (triggerRows.length > 0) {
            const triggerBucket = triggerRows[0].temporalBucket;
            if (row.temporalBucket < triggerBucket)
                failures.push(`linked banner precedes trigger: ${row.observationId}`);
            else {
                const bucketDeltaSeconds = (Date.parse(row.temporalBucket) - Date.parse(triggerBucket)) / 1000;
                const minimumPossibleInterval = Math.max(0, bucketDeltaSeconds - 3599);
                const maximumPossibleInterval = bucketDeltaSeconds + 3599;
                const interval = row.friendToNormalIntervalSeconds;
                if (interval < minimumPossibleInterval || interval > maximumPossibleInterval)
                    failures.push(`Friend-to-normal interval inconsistent with buckets: ${row.observationId}`);
            }
        }
    }
    exact(dataset.policy, policyFields, "policy", failures);
    for (const field of policyFields)
        if (!object(dataset.policy) || dataset.policy[field] !== false)
            failures.push(`policy not prohibited: ${field}`);
    inspectSensitive(value, "$", failures);
    let candidate = 0;
    for (const row of observations.filter(object)) {
        const session = knownSessions.get(row.anonymousSessionId);
        const banner = session ? knownBanners.get(bannerKey(row.bannerId, row.bannerVersion, session.region)) : undefined;
        const linkedKey = row.friendSummonSequenceId ? `${row.anonymousSessionId}\u0000${row.friendSummonSequenceId}` : null;
        const triggerReady = !linkedKey || (trigger.status === "fixed" && triggeredSequences.has(linkedKey));
        const sourceBound = knownEvidence.get(row.sourceEvidenceRef)?.role === "observation_source";
        if (row.quality === "complete_verified" && sourceBound && banner?.officialRulesStatus === "pinned" && triggerReady)
            candidate++;
    }
    return {
        schemaVersion: 1,
        valid: [...new Set(failures)].length === 0,
        sessionCount: sessions.length,
        bannerVersionCount: banners.length,
        observationCount: observations.length,
        multiCount: multiGroups.size,
        friendSequenceCount: friendGroups.size,
        analysisCandidateObservationCount: candidate,
        exploratoryOnlyObservationCount: Math.max(0, observations.length - candidate),
        failures: [...new Set(failures)],
    };
}
exports.validateS3ObservationDataset = validateS3ObservationDataset;
function generateS3Id(kind) {
    return `${kind}_${(0, crypto_1.randomBytes)(8).toString("hex")}`;
}
exports.generateS3Id = generateS3Id;
function createEmptyS3ObservationDataset() {
    return {
        schemaVersion: 1,
        contract: exports.S3_CONTRACT,
        contractVersion: exports.S3_CONTRACT_VERSION,
        campaign: "summon_rng",
        collectionMode: "sanitized_observational_only",
        datasetId: generateS3Id("dataset"),
        defaultEnabled: false,
        productionMutation: false,
        triggerDefinition: { status: "pending", triggerId: null, observableType: null, observableRule: null, fixedBeforeCollection: false, preregistrationEvidenceRef: null },
        evidenceArtifacts: [],
        banners: [],
        sessions: [],
        observations: [],
        policy: { accountIds: false, credentials: false, deviceIds: false, rawAuthenticatedPayloads: false, reversibleIdentifierHashing: false, experimentalSpend: false, summonAutomation: false, predictionOrExploitation: false, production: false, r2: false, android: false },
    };
}
exports.createEmptyS3ObservationDataset = createEmptyS3ObservationDataset;
const crypto_1 = require("crypto");
//# sourceMappingURL=s3-observation-contract.js.map