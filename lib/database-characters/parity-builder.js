"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseCharacterParityCoverage = exports.buildDatabaseCharacterParityDataset = exports.buildHistoricalAudits = exports.compareCharacterParity = exports.compactDatabaseCards = exports.compactExternalCharacters = void 0;
const parity_contract_1 = require("./parity-contract");
const source_1 = require("./source");
const eq = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function compactState(state, index) {
    const stepValue = state.growthStep?.values.step;
    const parsedStep = typeof stepValue === "number" ? stepValue : Number(stepValue);
    return {
        stateKey: state.stateKey,
        releaseState: state.releaseState,
        availableAt: state.release.availableAt,
        availableAtSnapshot: state.release.availableAtSnapshot,
        progressionStep: Number.isFinite(parsedStep) ? parsedStep : index,
        growthStepSource: state.growthStep ? { table: state.growthStep.provenance.table, rowId: state.growthStep.provenance.rowId } : null,
        maxLevel: state.maxLevel,
        maxSALevel: state.maxSuperAttackLevel,
    };
}
function compactExternalCharacters(input) {
    const result = new Map();
    const visit = (value) => {
        if (!value?.id)
            return;
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        result.set(String(value.id), {
            id: String(value.id),
            rarity: value.rarity,
            type: value.type,
            characterClass: value.characterClass,
            maxLevel: value.maxLevel,
            maxSALevel: value.maxSALevel,
            baseHP: value.baseHP,
            maxLevelHP: value.maxLevelHP,
            baseAttack: value.baseAttack,
            maxLevelAttack: value.maxLevelAttack,
            baseDefence: value.baseDefence,
            maxDefence: value.maxDefence,
            portraitFilename: value.portraitFilename,
            exSuperAttack: value.exSuperAttack,
            transformationIds: transformations.flatMap((item) => item?.id ? [String(item.id)] : []),
        });
        transformations.forEach(visit);
    };
    input.forEach(visit);
    return result;
}
exports.compactExternalCharacters = compactExternalCharacters;
async function compactDatabaseCards(source) {
    const result = [];
    for await (const card of (0, source_1.streamDb1Cards)(source.artifactPath)) {
        result.push({
            cardId: card.cardId,
            recordKind: card.recordKind,
            rarity: card.rarity.value,
            type: card.type.value,
            characterClass: card.characterClass.value,
            stats: card.stats,
            states: card.skillStates.map(compactState),
            hasExAttack: card.skillStates.some(state => state.attacks.some(attack => attack.variant.value === "ex")),
            formIds: [...new Set(card.formRelations.flatMap(item => item.targetCardId ? [item.targetCardId] : []))].sort((a, b) => Number(a) - Number(b)),
        });
    }
    return result.sort((a, b) => Number(a.cardId) - Number(b.cardId));
}
exports.compactDatabaseCards = compactDatabaseCards;
function selectState(card, source, externalGeneratedAt) {
    const policy = source === "production" ? "initial_state" : "highest_released_progression_at_external_snapshot";
    const eligible = source === "production"
        ? card.states.filter(state => state.releaseState === "initial")
        : card.states.filter(state => state.availableAtSnapshot === true && state.availableAt !== null && state.availableAt <= externalGeneratedAt.replace("T", " ").replace("Z", ""));
    const selected = [...eligible].sort((left, right) => left.progressionStep - right.progressionStep || left.stateKey.localeCompare(right.stateKey)).at(-1);
    return {
        stateKey: selected?.stateKey ?? null,
        releaseState: selected?.releaseState ?? null,
        availableAt: selected?.availableAt ?? null,
        availableAtSnapshot: selected?.availableAtSnapshot ?? null,
        progressionStep: selected?.progressionStep ?? null,
        growthStepSource: selected?.growthStepSource ?? null,
        selectionPolicy: policy,
        comparable: Boolean(selected),
        maxLevel: selected?.maxLevel ?? null,
        maxSALevel: selected?.maxSALevel ?? null,
    };
}
function compareCharacterParity(card, external, source, externalGeneratedAt) {
    const selected = selectState(card, source, externalGeneratedAt);
    const comparisonState = {
        stateKey: selected.stateKey,
        releaseState: selected.releaseState,
        availableAt: selected.availableAt,
        availableAtSnapshot: selected.availableAtSnapshot,
        progressionStep: selected.progressionStep,
        growthStepSource: selected.growthStepSource,
        selectionPolicy: selected.selectionPolicy,
        comparable: selected.comparable,
    };
    const gains = ["original_rarity", ...(card.hasExAttack ? ["ex_attack"] : []), ...(card.states.length > 1 ? ["release_state_graph"] : []), ...(card.formIds.length ? ["form_relation_channel_provenance"] : [])];
    if (!external)
        return { identity: "unjoinable", comparisonState, agreementFields: [], representationGains: gains, conflicts: [], unknownFields: ["portrait", "leader_semantics", "form_target_set", ...(!selected.comparable ? ["release_state"] : [])], externalFormIds: [] };
    const agreements = ["identity"];
    const conflicts = [];
    const unknown = ["portrait", "leader_semantics", "form_target_set"];
    const comparableFields = [
        ["rarity", card.rarity, external.rarity],
        ["type", card.type, external.type],
        ["baseHP", card.stats.hpInitial, external.baseHP],
        ["baseAttack", card.stats.atkInitial, external.baseAttack],
        ["baseDefence", card.stats.defInitial, external.baseDefence],
    ];
    if (card.characterClass === "unawakened")
        unknown.push("characterClass");
    else
        comparableFields.push(["characterClass", card.characterClass, external.characterClass]);
    if (selected.comparable) {
        comparableFields.push(["maxLevel", selected.maxLevel, external.maxLevel], ["maxSALevel", selected.maxSALevel, external.maxSALevel]);
    }
    else {
        unknown.push("maxLevel", "maxSALevel", "release_state");
    }
    const maxStatsComparable = source === "production" || selected.releaseState === "initial";
    if (maxStatsComparable) {
        comparableFields.push(["maxLevelHP", card.stats.hpMax, external.maxLevelHP], ["maxLevelAttack", card.stats.atkMax, external.maxLevelAttack], ["maxDefence", card.stats.defMax, external.maxDefence]);
    }
    else {
        unknown.push("maxLevelHP", "maxLevelAttack", "maxDefence");
    }
    for (const [field, databaseValue, externalValue] of comparableFields) {
        if (externalValue === undefined || databaseValue === null || databaseValue === "unknown")
            unknown.push(field);
        else if (eq(databaseValue, externalValue))
            agreements.push(field);
        else
            conflicts.push({ field, databaseValue, externalValue });
    }
    if (card.hasExAttack && !external.exSuperAttack)
        gains.push("ex_attack");
    else if (card.hasExAttack === Boolean(external.exSuperAttack))
        agreements.push("ex_attack_presence");
    else
        unknown.push("ex_attack_presence");
    return {
        identity: "agreement",
        comparisonState,
        agreementFields: [...new Set(agreements)].sort(),
        representationGains: [...new Set(gains)].sort(),
        conflicts,
        unknownFields: [...new Set(unknown)].sort(),
        externalFormIds: external.transformationIds,
    };
}
exports.compareCharacterParity = compareCharacterParity;
function buildHistoricalAudits(cards, c3Counts) {
    const k1 = parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1;
    const k2 = parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2;
    const k3 = parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3;
    const k6 = parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6;
    const gainCount = (source, field) => cards.reduce((total, card) => total + Number(card[source].representationGains.includes(field)), 0);
    return [
        { issue: "z_awakened_duplicates", classification: "representation_gain", basis: "K1 separates card identity from UI duplicate collapse", counts: { zTransitions: k1.zAwakenTransitionCount }, sourceSidecars: ["k1"] },
        { issue: "original_rarity", classification: "representation_gain", basis: "K2 structural Z roots; neither external contract carries original rarity", counts: { cards: k2.cardCount }, sourceSidecars: ["k2"] },
        { issue: "portraits_incomplete_or_incorrect", classification: "unknown", basis: "external URLs exist but first-party resource bundle does not prove portrait/card-art role", counts: { firstPartyResourceIds: k6.firstPartyResourceIdCount, firstPartyResourceGaps: k6.missingCardResourceCount }, sourceSidecars: ["k6"] },
        { issue: "leader_or_vs_sum", classification: "unknown", basis: "no common first-party leader-clause identity", counts: {}, sourceSidecars: ["c3"] },
        { issue: "flat_boost_vs_percent", classification: "unknown", basis: "C3 has no common first-party production rule identity", counts: { c3Unknown: c3Counts.unknown }, sourceSidecars: ["c3"] },
        { issue: "name_tag_transformation_linking", classification: "representation_gain", basis: "K1 form joins use first-party IDs rather than names/tags", counts: { formTransitions: k1.formTransitionCount }, sourceSidecars: ["k1"] },
        { issue: "standby_finish_transformation_chains", classification: "representation_gain", basis: "K1 retains relation direction, channel and target IDs; external form sets remain incomparable", counts: { formTransitions: k1.formTransitionCount, productionChannelProvenanceGains: gainCount("production", "form_relation_channel_provenance"), fyiChannelProvenanceGains: gainCount("fyi", "form_relation_channel_provenance") }, sourceSidecars: ["k1", "k7"] },
        { issue: "ex_attacks", classification: "representation_gain", basis: "K3 retains first-party EX variants", counts: { firstPartyExAttacks: k3.exAttackCount, productionGains: gainCount("production", "ex_attack"), fyiGains: gainCount("fyi", "ex_attack") }, sourceSidecars: ["k3", "k7"] },
        { issue: "entrance_animation_grouping", classification: "unknown", basis: "K6 does not prove Entrance grouping", counts: {}, sourceSidecars: ["k6"] },
        { issue: "eza_seza_base_selection", classification: c3Counts.unjoinable ? "unjoinable" : "agreement", basis: "C3 stateKey shadow join plus explicit K7 comparison-state selection", counts: { joinedRules: Object.values(c3Counts).reduce((sum, value) => sum + value, 0) - c3Counts.unjoinable, unjoinableRules: c3Counts.unjoinable }, sourceSidecars: ["c3", "k7"] },
        { issue: "ids_forms_without_join", classification: "unjoinable", basis: "structural ID absent from external snapshots", counts: { productionCards: cards.filter(card => card.production.identity === "unjoinable").length, fyiCards: cards.filter(card => card.fyi.identity === "unjoinable").length }, sourceSidecars: ["k7"] },
        { issue: "auxiliary_states", classification: "representation_gain", basis: "K1 retains form and release states independently", counts: { states: k1.stateCount, cards: k2.cardCount }, sourceSidecars: ["k1", "k2"] },
    ];
}
exports.buildHistoricalAudits = buildHistoricalAudits;
function buildDatabaseCharacterParityDataset(options) {
    const cards = options.cards.map(card => ({
        cardId: card.cardId,
        recordKind: card.recordKind,
        production: compareCharacterParity(card, options.production.get(card.cardId), "production", ""),
        fyi: compareCharacterParity(card, options.fyi.get(card.cardId), "fyi", options.fyiGeneratedAt),
    }));
    const c3Counts = { agreement: 0, representation_gain: 0, confirmed_conflict: 0, unjoinable: 0, unknown: 0 };
    options.c3.records.forEach(item => c3Counts[item.classification]++);
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-shadow-parity",
        contractVersion: "1.1.0",
        generatedAt: options.source.generatedAt,
        source: {
            snapshotVersion: options.source.snapshotVersion,
            db1ArtifactSha256: options.source.artifactSha256,
            productionCharacters: { sha256: options.productionSha256, sizeBytes: options.productionSizeBytes, characterCount: options.productionTopLevelCount, contract: "legacy-dokkaninfo-character-json", asOf: "unversioned_content_hash_only" },
            fyiCharacters: { sha256: options.fyiSha256, sizeBytes: options.fyiSizeBytes, characterCount: options.fyiTopLevelCount, generatedAt: options.fyiGeneratedAt, contract: "fyi-current-released-state" },
            teamAnalysis: { sha256: options.teamSha256, stateCount: options.teamStateCount },
            c3Shadow: { sha256: options.c3Sha256, ruleCount: options.c3.records.length },
            upstreamSidecars: {
                k1: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.coverageSha256 },
                k2: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2.coverageSha256 },
                k3: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3.coverageSha256 },
                k6: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.coverageSha256 },
            },
            dokkanInfoCharacterCache: "absent",
        },
        policy: { structuralIdsOnly: true, textJoin: false, productionModified: false, externalParserAuthoritative: false, incomparableDomainsBecomeUnknown: true },
        cards,
        teamAnalysisClassificationCounts: c3Counts,
        historicalAudits: buildHistoricalAudits(cards, c3Counts),
    };
}
exports.buildDatabaseCharacterParityDataset = buildDatabaseCharacterParityDataset;
function buildDatabaseCharacterParityCoverage(dataset) {
    const sources = dataset.cards.flatMap(card => [card.production, card.fyi]);
    const auditIds = dataset.historicalAudits.map(item => item.issue);
    return {
        schemaVersion: 1,
        cardCount: dataset.cards.length,
        productionJoinedCount: dataset.cards.filter(card => card.production.identity === "agreement").length,
        productionUnjoinableCount: dataset.cards.filter(card => card.production.identity === "unjoinable").length,
        fyiJoinedCount: dataset.cards.filter(card => card.fyi.identity === "agreement").length,
        fyiUnjoinableCount: dataset.cards.filter(card => card.fyi.identity === "unjoinable").length,
        agreementFieldCount: sources.reduce((sum, item) => sum + item.agreementFields.length, 0),
        representationGainCount: sources.reduce((sum, item) => sum + item.representationGains.length, 0),
        confirmedConflictCount: sources.reduce((sum, item) => sum + item.conflicts.length, 0),
        unknownFieldCount: sources.reduce((sum, item) => sum + item.unknownFields.length, 0),
        c3ClassificationCounts: dataset.teamAnalysisClassificationCounts,
        historicalAuditCount: dataset.historicalAudits.length,
        duplicateHistoricalAuditCount: auditIds.length - new Set(auditIds).size,
        duplicateCardIdentityCount: dataset.cards.length - new Set(dataset.cards.map(card => card.cardId)).size,
    };
}
exports.buildDatabaseCharacterParityCoverage = buildDatabaseCharacterParityCoverage;
//# sourceMappingURL=parity-builder.js.map