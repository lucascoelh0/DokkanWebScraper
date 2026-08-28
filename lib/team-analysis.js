"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTeamAnalysisDatasetForDelivery = exports.validateTeamAnalysisDatasetForDelivery = exports.assertValidTeamAnalysisDataset = exports.validateTeamAnalysisDataset = exports.buildTeamAnalysisCoverageReport = exports.mapPassiveDetailsToSource = exports.parsePassive = exports.parseSuperAttack = exports.buildTeamAnalysisDataset = exports.releaseStateFromForm = exports.buildAwakeningFamilyId = exports.buildVariantGroupId = exports.buildHardDuplicateGroupId = exports.buildStateKey = exports.buildTransformationActivationContractKey = exports.HP_REMAINING_SCALING_DOMAIN_RULE_VERSION = exports.SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION = exports.TEAM_ANALYSIS_PARSER_VERSION = exports.TEAM_ANALYSIS_RULES_VERSION = exports.TEAM_ANALYSIS_SCHEMA_VERSION = void 0;
const crypto_1 = require("crypto");
const team_analysis_chance_lexicon_1 = require("./team-analysis-chance-lexicon");
const team_analysis_first_party_probabilities_1 = require("./team-analysis-first-party-probabilities");
exports.TEAM_ANALYSIS_SCHEMA_VERSION = 1;
exports.TEAM_ANALYSIS_RULES_VERSION = "1";
exports.TEAM_ANALYSIS_PARSER_VERSION = "1.9.19";
exports.SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION = "sa-stat-raise-lifecycle-v1";
exports.HP_REMAINING_SCALING_DOMAIN_RULE_VERSION = "hp-remaining-scaling-v1";
const EFFECT_DECISION_DOMAIN_RULE_VERSIONS = new Set([
    exports.SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION,
    exports.HP_REMAINING_SCALING_DOMAIN_RULE_VERSION,
]);
function buildTransformationActivationContractKey(sourceCardId, targetFormId) {
    return `${sourceCardId}->${targetFormId}`;
}
exports.buildTransformationActivationContractKey = buildTransformationActivationContractKey;
function buildStateKey(characterId, formId, releaseState) {
    return `${characterId}:${formId}:${releaseState}`;
}
exports.buildStateKey = buildStateKey;
function buildHardDuplicateGroupId(characterId) {
    return `card:${characterId}`;
}
exports.buildHardDuplicateGroupId = buildHardDuplicateGroupId;
function buildVariantGroupId(canonicalId) {
    return `canonical:${canonicalId}`;
}
exports.buildVariantGroupId = buildVariantGroupId;
function buildAwakeningFamilyId(baseCharacterId) {
    return `awakening:${baseCharacterId}`;
}
exports.buildAwakeningFamilyId = buildAwakeningFamilyId;
function releaseStateFromForm(form) {
    if (form.sezaReleaseDate) {
        return "seza";
    }
    if (form.ezaReleaseDate) {
        return "eza";
    }
    return "initial";
}
exports.releaseStateFromForm = releaseStateFromForm;
function buildTeamAnalysisDataset(characters, catalogEntries, options) {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const states = characters
        .flatMap(character => buildCharacterStates(character, catalogById.get(character.id), options.nameIdentityContract, options.cardIdentityContract, options.activeSkillActivationContract, options.transformationActivationContract))
        .sort(compareAnalysisStates);
    const ruleCounts = countRuleStatuses(states);
    return {
        schemaVersion: exports.TEAM_ANALYSIS_SCHEMA_VERSION,
        rulesVersion: options.rulesVersion ?? exports.TEAM_ANALYSIS_RULES_VERSION,
        parserVersion: options.parserVersion ?? exports.TEAM_ANALYSIS_PARSER_VERSION,
        generatedAt: options.generatedAt,
        sourceCharacterDatasetVersion: options.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: options.sourceCharacterPayloadSha256,
        stateCount: states.length,
        supportedRuleCount: ruleCounts.supported,
        partialRuleCount: ruleCounts.partial,
        unknownRuleCount: ruleCounts.unknown,
        states,
    };
}
exports.buildTeamAnalysisDataset = buildTeamAnalysisDataset;
function buildCharacterStates(character, catalogEntry, nameIdentityContract, cardIdentityContract, activeSkillActivationContract, transformationActivationContract) {
    const rootForm = character;
    const forms = [rootForm, ...(character.transformations ?? [])];
    return forms.flatMap(form => {
        const releaseSources = analysisReleaseSources(form);
        return releaseSources.map(releaseSource => {
            const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState, cardIdentityContract);
            const stateKey = buildStateKey(identity.characterId, identity.formId, identity.releaseState);
            const passive = releaseSource.passiveText
                ? parsePassive(stateKey, releaseSource.passiveName, releaseSource.passiveText, releaseSource.passiveDetails, {
                    characterId: identity.characterId,
                    formId: identity.formId,
                    canonicalId: identity.canonicalId,
                    releaseState: identity.releaseState,
                    ...(releaseSource.passiveDetails?.sourceSkillId
                        ? { passiveSkillSetId: releaseSource.passiveDetails.sourceSkillId }
                        : {}),
                    ...(nameIdentityContract ? { nameIdentityContract } : {}),
                })
                : undefined;
            const superAttacks = analysisSuperAttackSources(form, releaseSource.releaseState, releaseSources.length === 1).map(source => parseSuperAttack(stateKey, source));
            const activeSkillActivationCondition = resolvedActiveSkillActivationCondition(form, releaseSource.releaseState, activeSkillActivationContract);
            const transformationActivationCondition = form.id === character.id
                ? undefined
                : transformationActivationContract?.get(buildTransformationActivationContractKey(character.id, form.id));
            return {
                stateKey,
                characterId: identity.characterId,
                ...(identity.canonicalId ? { canonicalId: identity.canonicalId } : {}),
                ...(identity.gameCharacterId ? { gameCharacterId: identity.gameCharacterId } : {}),
                ...(identity.baseCharacterId ? { baseCharacterId: identity.baseCharacterId } : {}),
                hardDuplicateGroupId: identity.hardDuplicateGroupId,
                ...(identity.variantGroupId ? { variantGroupId: identity.variantGroupId } : {}),
                ...(identity.awakeningFamilyId ? { awakeningFamilyId: identity.awakeningFamilyId } : {}),
                formId: identity.formId,
                releaseState: identity.releaseState,
                displayName: form.name,
                ...(activeSkillActivationCondition ? { activeSkillActivationCondition } : {}),
                ...(transformationActivationCondition ? { transformationActivationCondition } : {}),
                ...(passive ? { passive } : {}),
                ...(superAttacks.length > 0 ? { superAttacks } : {}),
            };
        });
    });
}
function analysisActiveSkillActivationCondition(form, releaseState) {
    const details = releaseState === "initial"
        ? form.activeSkillDetails
        : form.ezaActiveSkillDetails?.length
            ? form.ezaActiveSkillDetails
            : form.activeSkillDetails;
    return details?.find(detail => detail.activationCondition)?.activationCondition;
}
function resolvedActiveSkillActivationCondition(form, releaseState, activeSkillActivationContract) {
    const firstParty = activeSkillActivationContract?.get(form.id);
    const payload = analysisActiveSkillActivationCondition(form, releaseState);
    if (!firstParty)
        return payload;
    if (!payload)
        return firstParty;
    const rank = (status) => status === "supported" ? 2 : status === "partial" ? 1 : 0;
    return rank(firstParty.status) >= rank(payload.status) ? firstParty : payload;
}
function resolveIdentity(character, form, catalogEntry, releaseState = releaseStateFromForm(form), cardIdentityContract) {
    const firstPartyIdentity = cardIdentityContract?.get(character.id);
    const canonicalId = firstPartyIdentity?.canonicalId ?? catalogEntry?.canonicalId;
    const baseCharacterId = catalogEntry?.baseCharacterId;
    return {
        characterId: character.id,
        canonicalId,
        gameCharacterId: firstPartyIdentity?.gameCharacterId ?? catalogEntry?.characterId,
        baseCharacterId,
        hardDuplicateGroupId: buildHardDuplicateGroupId(character.id),
        variantGroupId: canonicalId ? buildVariantGroupId(canonicalId) : undefined,
        awakeningFamilyId: baseCharacterId ? buildAwakeningFamilyId(baseCharacterId) : undefined,
        formId: form.id,
        releaseState,
    };
}
function analysisReleaseSources(form) {
    const initialPassiveDetails = materialText(form.passiveDetails?.text) ? form.passiveDetails : undefined;
    const ezaPassiveDetails = materialText(form.ezaPassiveDetails?.text) ? form.ezaPassiveDetails : undefined;
    const sezaPassiveDetails = materialText(form.sezaPassiveDetails?.text) ? form.sezaPassiveDetails : undefined;
    const initialPassiveText = materialText(initialPassiveDetails?.text) ?? materialText(form.passive) ?? "";
    const ezaPassiveText = materialText(ezaPassiveDetails?.text) ?? materialText(form.ezaPassive) ?? "";
    const sezaPassiveText = materialText(sezaPassiveDetails?.text) ?? materialText(form.sezaPassive) ?? "";
    if (!ezaPassiveText && !sezaPassiveText) {
        const initial = {
            releaseState: "initial",
            passiveText: initialPassiveText,
            passiveName: initialPassiveDetails?.name,
            passiveDetails: initialPassiveDetails,
        };
        return hasMaterialEzaSuperAttackSource(form)
            ? [initial, { releaseState: "eza", passiveText: "" }]
            : [initial];
    }
    const releases = [{
            releaseState: "initial",
            passiveText: initialPassiveText,
            passiveName: initialPassiveDetails?.name,
            passiveDetails: initialPassiveDetails,
        }];
    if (ezaPassiveText) {
        releases.push({
            releaseState: "eza",
            passiveText: ezaPassiveText,
            passiveName: ezaPassiveDetails?.name,
            passiveDetails: ezaPassiveDetails,
        });
    }
    if (sezaPassiveText) {
        releases.push({
            releaseState: "seza",
            passiveText: sezaPassiveText,
            passiveName: sezaPassiveDetails?.name,
            passiveDetails: sezaPassiveDetails,
        });
    }
    return releases;
}
function hasMaterialEzaSuperAttackSource(form) {
    return [
        form.ezaSuperAttackDetails?.effect,
        form.ezaSuperAttack,
        form.ezaUltraSuperAttackDetails?.effect,
        form.ezaUltraSuperAttack,
        form.ezaExSuperAttackDetails?.effect,
        form.ezaExSuperAttack,
    ].some(value => materialText(value) !== undefined);
}
function materialText(value) {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
function analysisSuperAttackSources(form, releaseState, singleReleaseState) {
    const useBaseFields = releaseState === "initial";
    const useAwakenedFields = releaseState === "eza" || releaseState === "seza";
    const slots = [
        {
            variant: "normal",
            baseText: form.superAttack,
            ezaText: form.ezaSuperAttack,
            baseDetails: form.superAttackDetails,
            ezaDetails: form.ezaSuperAttackDetails,
        },
        {
            variant: "ultra",
            baseText: form.ultraSuperAttack,
            ezaText: form.ezaUltraSuperAttack,
            baseDetails: form.ultraSuperAttackDetails,
            ezaDetails: form.ezaUltraSuperAttackDetails,
        },
        {
            variant: "extra",
            baseText: form.exSuperAttack,
            ezaText: form.ezaExSuperAttack,
            baseDetails: form.exSuperAttackDetails,
            ezaDetails: form.ezaExSuperAttackDetails,
        },
    ];
    const attacks = [];
    for (const slot of slots) {
        const baseDetails = materialText(slot.baseDetails?.effect) ? slot.baseDetails : undefined;
        const awakenedDetails = materialText(slot.ezaDetails?.effect) ? slot.ezaDetails : undefined;
        const details = useAwakenedFields
            ? awakenedDetails ?? (singleReleaseState ? baseDetails : undefined)
            : useBaseFields
                ? baseDetails
                : undefined;
        const fallbackText = useAwakenedFields
            ? materialText(slot.ezaText) ?? (singleReleaseState ? materialText(slot.baseText) : undefined)
            : useBaseFields
                ? materialText(slot.baseText)
                : undefined;
        const effectText = materialText(details?.effect) ?? fallbackText ?? "";
        if (!effectText) {
            continue;
        }
        attacks.push({
            variant: slot.variant,
            ordinal: 0,
            ...(details?.name ? { name: details.name } : {}),
            ...(details?.ki !== undefined ? { ki: details.ki } : {}),
            ...(details?.type !== undefined ? { attackType: String(details.type) } : {}),
            ...(details?.style ? { style: details.style } : {}),
            ...(details?.attackIncrease ? { attackIncrease: details.attackIncrease } : {}),
            effectText,
            conditionText: details?.condition ?? "",
            ...(details?.structuralSource ? { structuralSource: details.structuralSource } : {}),
            ...(details?.sourceAttackId ? { sourceAttackId: details.sourceAttackId } : {}),
            ...(details?.effects?.length ? { structuredEffects: details.effects } : {}),
        });
    }
    const units = releaseState === "initial"
        ? form.unitSuperAttacks
        : form.ezaUnitSuperAttacks;
    if (units) {
        units.forEach((unit, ordinal) => {
            const effectText = unit.effect ?? "";
            if (!effectText) {
                return;
            }
            attacks.push({
                variant: "unit",
                ordinal,
                ...(unit.name ? { name: unit.name } : {}),
                ...(unit.ki !== undefined ? { ki: unit.ki } : {}),
                ...(unit.type !== undefined ? { attackType: String(unit.type) } : {}),
                ...(unit.style ? { style: unit.style } : {}),
                ...(unit.attackIncrease ? { attackIncrease: unit.attackIncrease } : {}),
                effectText,
                conditionText: unit.unitSuperAttackCondition ?? "",
                ...(unit.structuralSource ? { structuralSource: unit.structuralSource } : {}),
                ...(unit.sourceAttackId ? { sourceAttackId: unit.sourceAttackId } : {}),
                ...(unit.effects?.length ? { structuredEffects: unit.effects } : {}),
            });
        });
    }
    return attacks;
}
function compareAnalysisStates(left, right) {
    const releaseOrder = { initial: 0, eza: 1, seza: 2 };
    return left.characterId.localeCompare(right.characterId)
        || left.formId.localeCompare(right.formId)
        || releaseOrder[left.releaseState] - releaseOrder[right.releaseState];
}
function parseSuperAttack(stateKey, source) {
    const rawText = source.effectText;
    const structuralEvidence = validStructuralEvidence(stateKey, rawText, source.structuralSource, "super_attack", source.variant, source.sourceAttackId);
    const candidates = superAttackEffectCandidates(rawText)
        .sort((left, right) => left.start - right.start || right.end - left.end);
    const accepted = [];
    for (const candidate of candidates) {
        if (!accepted.some(existing => candidate.start < existing.end && candidate.end > existing.start)) {
            accepted.push(candidate);
        }
    }
    accepted.sort((left, right) => left.start - right.start);
    const parsedEffects = accepted.flatMap(candidate => {
        const fragments = sourceFragmentsForAbsoluteRange(rawText, candidate.start, candidate.end);
        const sourceText = rawText.slice(candidate.start, candidate.end);
        return candidate.effects.map(effect => applySuperAttackStructuralSemantics({ ...effect, sourceText, source: fragments }, structuralEvidence));
    });
    const structuredEffects = source.structuredEffects?.length
        ? source.structuredEffects.map(effect => structuredSuperAttackEffect(effect, rawText))
        : [];
    const effects = structuredEffects.length > 0
        ? mergeStructuredSuperAttackEffects(structuredEffects, parsedEffects)
        : parsedEffects;
    const unparsedFragments = complementSourceFragments(rawText, accepted.map(candidate => ({ start: candidate.start, end: candidate.end })));
    const effectStatus = superAttackEffectListStatus(effects);
    const condition = parseSuperAttackCondition(source.conditionText);
    const parseStatus = effects.length === 0
        ? "unknown"
        : unparsedFragments.length > 0 || condition.parseStatus !== "supported" || effectStatus !== "supported"
            ? "partial"
            : "supported";
    return {
        id: `${stateKey}:super-attack:${source.variant}:${source.ordinal}`,
        variant: source.variant,
        ordinal: source.ordinal,
        ...(source.name ? { name: source.name } : {}),
        ...(source.ki !== undefined ? { ki: source.ki } : {}),
        ...(source.attackType ? { attackType: source.attackType } : {}),
        ...(source.style ? { style: source.style } : {}),
        ...(source.attackIncrease ? { attackIncrease: source.attackIncrease } : {}),
        effectOrigin: "super_attack",
        rawText,
        condition,
        effects,
        effectStatus,
        parseStatus,
        sourceFragments: wholeLineSourceFragments(rawText),
        unparsedFragments,
        ...(structuralEvidence.length > 0 ? { structuralEvidence } : {}),
    };
}
exports.parseSuperAttack = parseSuperAttack;
function structuredSuperAttackEffect(effect, rawText) {
    const resolutionSource = effect.source.kind === "first_party_game_db"
        ? "first_party_game_db"
        : "dokkan_fyi_payload";
    const duration = structuredSuperAttackDuration(effect.durationTurns, resolutionSource);
    const target = effect.target === "allies"
        ? { scope: effect.target, selfInclusion: effect.selfInclusion ?? "unknown" }
        : { scope: effect.target };
    const statRaise = effect.kind === "atk_raise" || effect.kind === "def_raise";
    const enemyLowering = effect.kind === "enemy_atk_lowering" || effect.kind === "enemy_def_lowering";
    const statEffect = statRaise || enemyLowering;
    const source = wholeLineSourceFragments(rawText);
    const base = {
        kind: effect.kind,
        origin: "super_attack",
        target,
        ...(statEffect && effect.value !== undefined ? { value: effect.value, unit: "percent" } : {}),
        duration,
        activationTiming: superAttackActivationTiming(),
        parseStatus: effect.status,
        sourceText: rawText,
        source,
        provenance: { source: resolutionSource, evidenceId: effect.source.rowId },
    };
    if (statRaise) {
        return {
            ...base,
            stacking: {
                kind: "stackable",
                scope: superAttackStackingScope(duration),
                source: "documented_domain_rule",
                provenance: domainRuleProvenance(),
            },
            applicationTrigger: {
                kind: "per_super_attack",
                source: "documented_domain_rule",
                provenance: domainRuleProvenance(),
            },
            calculationBucket: {
                bucket: "super_attack_raise",
                source: "documented_domain_rule",
            },
        };
    }
    if (enemyLowering) {
        return {
            ...base,
            stacking: {
                kind: "not_stackable",
                source: resolutionSource,
                provenance: { source: resolutionSource, evidenceId: effect.source.rowId },
            },
            calculationBucket: {
                bucket: "super_attack_enemy_stat_lowering",
                source: "documented_domain_rule",
            },
        };
    }
    return base;
}
function mergeStructuredSuperAttackEffects(structuredEffects, parsedEffects) {
    const remainingParsed = [...parsedEffects];
    const merged = structuredEffects.map(structured => {
        const compatibleIndices = remainingParsed
            .map((parsed, index) => ({ parsed, index }))
            .filter(({ parsed }) => sameSuperAttackEffectSubject(structured, parsed));
        const exactDuration = compatibleIndices.find(({ parsed }) => structured.duration.kind !== "unknown"
            && parsed.duration.kind === structured.duration.kind
            && parsed.duration.turns === structured.duration.turns);
        const match = exactDuration ?? (compatibleIndices.length === 1 ? compatibleIndices[0] : undefined);
        if (!match)
            return structured;
        remainingParsed.splice(match.index, 1);
        return enrichStructuredSuperAttackEffect(structured, match.parsed);
    });
    return [...merged, ...remainingParsed];
}
function sameSuperAttackEffectSubject(left, right) {
    return left.kind === right.kind
        && left.target.scope === right.target.scope
        && left.target.selfInclusion === right.target.selfInclusion;
}
function enrichStructuredSuperAttackEffect(structured, parsed) {
    const duration = structured.duration.kind === "unknown" && parsed.duration.kind !== "unknown"
        ? parsed.duration
        : structured.duration;
    const stacking = structured.stacking && (structured.kind === "atk_raise" || structured.kind === "def_raise") ? {
        ...structured.stacking,
        scope: superAttackStackingScope(duration),
    } : structured.stacking;
    const parseStatus = structured.parseStatus === "unknown" || parsed.parseStatus === "unknown"
        ? "unknown"
        : structured.parseStatus === "partial" || parsed.parseStatus === "partial"
            ? "partial"
            : "supported";
    return {
        ...structured,
        ...(structured.magnitude === undefined && parsed.magnitude !== undefined ? { magnitude: parsed.magnitude } : {}),
        ...(structured.value === undefined && parsed.value !== undefined ? { value: parsed.value } : {}),
        ...(structured.unit === undefined && parsed.unit !== undefined ? { unit: parsed.unit } : {}),
        ...(structured.activationChancePercent === undefined && parsed.activationChancePercent !== undefined
            ? { activationChancePercent: parsed.activationChancePercent }
            : {}),
        ...(structured.qualitativeChanceTerm === undefined && parsed.qualitativeChanceTerm !== undefined
            ? { qualitativeChanceTerm: parsed.qualitativeChanceTerm }
            : {}),
        ...(structured.probabilitySource === undefined && parsed.probabilitySource !== undefined
            ? { probabilitySource: parsed.probabilitySource }
            : {}),
        duration,
        ...(stacking ? { stacking } : {}),
        parseStatus,
    };
}
function structuredSuperAttackDuration(turns, source) {
    const provenance = { source };
    if (turns === 1) {
        return { kind: "current_turn", source, provenance };
    }
    if (turns !== undefined && Number.isSafeInteger(turns) && turns > 1) {
        return { kind: "turns", turns, source, provenance };
    }
    return { kind: "unknown", source: "unresolved" };
}
function validStructuralEvidence(stateKey, normalizedText, source, channel, attackVariant, sourceEntityId) {
    const structuralDisplayText = source?.evidence?.length > 0
        && source.evidence.every(entry => entry.provenance?.source === "first_party_game_db")
        ? cleanStructuralText(source.rawText).split("\n")
            .map(line => line.replace(/\s+/g, " ").trim())
            .join("\n")
        : source ? cleanStructuralText(source.rawText) : undefined;
    if (!source
        || source.rawTextSha256 !== sha256Text(source.rawText)
        || source.normalizedTextSha256 !== sha256Text(normalizedText)
        || structuralDisplayText !== normalizedText) {
        return [];
    }
    let previousAnchorEnd = -1;
    const valid = [];
    for (const entry of source.evidence ?? []) {
        const anchor = entry.anchor;
        const start = anchor?.sourceSpan?.start;
        const end = anchor?.sourceSpan?.end;
        const expectedPayloadField = entry.provenance?.source === "first_party_game_db"
            ? channel === "passive"
                ? [
                    "passive_skill_sets.itemized_description",
                    "passive_skill_sets.group_itemized_description",
                    "passive_skill_sets.character_itemized_description",
                ].includes(entry.provenance.payloadField)
                : entry.provenance.payloadField === "special_sets.description"
            : entry.provenance?.source === "dokkan_fyi_payload"
                ? entry.provenance.payloadField === (channel === "passive"
                    ? entry.releaseState === "initial"
                        ? "props.character.passive_skill.description"
                        : "props.character.extreme_z_awakening.passive_skill.description"
                    : "props.character.super_attacks[].description")
                : false;
        const stateIdentity = stateKey.split(":");
        const markerResolution = entry.markers.every(marker => marker.resolution === "supported")
            ? "supported"
            : entry.markers.every(marker => marker.resolution === "unresolved")
                ? "unresolved"
                : "partial";
        if (entry.kind !== "effect_markers"
            || entry.stateKey !== stateKey
            || entry.characterId !== stateIdentity[0]
            || entry.formId !== stateIdentity[1]
            || entry.releaseState !== stateIdentity[2]
            || entry.channel !== channel
            || entry.rawTextSha256 !== source.rawTextSha256
            || entry.normalizedTextSha256 !== source.normalizedTextSha256
            || !entry.provenance
            || entry.provenance.markerSyntax !== "passiveImg"
            || !expectedPayloadField
            || (entry.provenance.source === "dokkan_fyi_payload"
                ? !/^[a-f0-9]{32}$/i.test(entry.provenance.sourceVersion)
                : !/^\d+$/.test(entry.provenance.sourceVersion))
            || (channel === "super_attack" && entry.attackVariant !== attackVariant)
            || (channel === "passive" && entry.passiveSkillId !== sourceEntityId)
            || (channel === "super_attack" && entry.superAttackId !== sourceEntityId)
            || entry.resolution !== markerResolution
            || !Number.isInteger(start) || !Number.isInteger(end)
            || start < 0 || end <= start || end > source.rawText.length
            || start < previousAnchorEnd
            || source.rawText.slice(start, end).trimEnd() !== anchor.structuralText
            || cleanStructuralAnchor(anchor.structuralText) !== anchor.normalizedText
            || !structuralAnchorMatchesDisplay(normalizedText, anchor)
            || !validStructuralMarkers(source.rawText, entry)) {
            continue;
        }
        const expectedIdPart = channel === "passive"
            ? entry.passiveSkillId ?? "unknown"
            : entry.superAttackId ?? "unknown";
        if (entry.id !== `${stateKey}:${channel}:${expectedIdPart}:${start}`) {
            continue;
        }
        previousAnchorEnd = end;
        const { semanticConflicts: _ignoredSourceConflicts, ...trustedEntry } = entry;
        const corroboration = (entry.corroboration ?? []).filter(validStructuralCorroboration);
        valid.push({
            ...trustedEntry,
            anchor: { ...entry.anchor, sourceSpan: { ...entry.anchor.sourceSpan } },
            markers: entry.markers.map(marker => ({ ...marker, sourceSpan: { ...marker.sourceSpan } })),
            ...(corroboration.length > 0 ? { corroboration: corroboration.map(item => ({ ...item })) } : {}),
        });
    }
    return valid;
}
function validStructuralCorroboration(item) {
    return item?.source === "first_party_game_db"
        && ["corroborating", "divergent", "unresolved"].includes(item.resolution)
        && typeof item.sourceVersion === "string" && item.sourceVersion.length > 0
        && typeof item.reason === "string" && item.reason.length > 0
        && (item.passiveSkillSetId === undefined || /^\d+$/.test(item.passiveSkillSetId))
        && (item.passiveSkillIds === undefined || item.passiveSkillIds.every(id => /^\d+$/.test(id)));
}
function validStructuralMarkers(rawText, evidence) {
    const tokens = [...evidence.anchor.structuralText.matchAll(/\{passiveImg:([^}]+)\}/g)];
    const prefixTokens = [];
    let prefixEnd = 0;
    for (const token of tokens) {
        const tokenIndex = token.index ?? 0;
        if (evidence.anchor.structuralText.slice(prefixEnd, tokenIndex).trim() === "") {
            prefixTokens.push(token);
            prefixEnd = tokenIndex + token[0].length;
        }
        else {
            break;
        }
    }
    const expectedTokens = evidence.channel === "passive" && tokens.length === evidence.markers.length
        ? tokens
        : prefixTokens;
    if (expectedTokens.length !== evidence.markers.length) {
        return false;
    }
    return evidence.markers.every((marker, order) => {
        const expected = expectedTokens[order];
        const markerKind = structuralMarkerKind(marker.sourceToken);
        return marker.order === order
            && marker.sourceToken === expected[1]
            && marker.markerKind === markerKind
            && marker.resolution === (markerKind === "unknown" ? "unresolved" : "supported")
            && marker.sourceSpan.start === evidence.anchor.sourceSpan.start + (expected.index ?? 0)
            && marker.sourceSpan.end === marker.sourceSpan.start + expected[0].length
            && rawText.slice(marker.sourceSpan.start, marker.sourceSpan.end) === expected[0];
    });
}
function structuralMarkerKind(sourceToken) {
    if (sourceToken === "once" || sourceToken === "forever")
        return sourceToken;
    if (sourceToken === "up_g")
        return "value_up";
    if (sourceToken === "down_r" || sourceToken === "down_y")
        return "value_down";
    return "unknown";
}
function cleanStructuralText(value) {
    return value
        .replace(/\{[^}]+\}/g, "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim().replace(/^\*\s*/, "").replace(/\s*\*$/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
function cleanStructuralAnchor(value) {
    return cleanStructuralText(value)
        .replace(/^\s*-\s*/, "")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function structuralAnchorMatchesDisplay(normalizedText, anchor) {
    const fragments = wholeLineSourceFragments(normalizedText);
    const endLineIndex = anchor.endLineIndex ?? anchor.lineIndex;
    if (!Number.isInteger(anchor.lineIndex)
        || !Number.isInteger(endLineIndex)
        || endLineIndex < anchor.lineIndex
        || endLineIndex >= fragments.length) {
        return false;
    }
    const displayText = fragments.slice(anchor.lineIndex, endLineIndex + 1)
        .map(fragment => fragment.text.replace(/^\s*-\s*/, ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    return displayText === anchor.normalizedText || displayText.includes(anchor.normalizedText);
}
function sha256Text(value) {
    return (0, crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
}
function evidenceMatchesEffect(evidence, sourceText, source) {
    const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
    return source.length > 0
        && source.every(fragment => fragment.lineIndex >= evidence.anchor.lineIndex
            && fragment.lineIndex <= endLineIndex)
        && evidence.anchor.normalizedText.replace(/\s+/g, " ").includes(sourceText.replace(/\s+/g, " ").trim());
}
function applySuperAttackStructuralSemantics(effect, evidenceEntries) {
    const matching = evidenceEntries.filter(entry => evidenceMatchesEffect(entry, effect.sourceText, effect.source));
    const once = matching.find(entry => entry.markers.some(marker => marker.markerKind === "once"));
    const forever = matching.find(entry => entry.markers.some(marker => marker.markerKind === "forever"));
    if (!once && !forever) {
        return effect;
    }
    if (once) {
        effect.activationLimit = markerActivationLimit(once);
    }
    if (forever) {
        if (effect.duration.kind === "unknown" || effect.duration.kind === "permanent") {
            effect.duration = {
                kind: "permanent",
                source: markerResolutionSource(forever),
                provenance: markerDecisionProvenance(forever),
            };
        }
        else {
            recordStructuralConflict(forever, "duration", "battle", effect.duration.kind, "explicit_text");
        }
    }
    return effect;
}
function markerActivationLimit(evidence) {
    return {
        kind: "once",
        source: markerResolutionSource(evidence),
        provenance: markerDecisionProvenance(evidence),
    };
}
function markerResolutionSource(evidence) {
    return evidence.provenance.source === "first_party_game_db"
        ? "first_party_game_db"
        : "dokkan_fyi_structural_marker";
}
function markerDecisionProvenance(evidence) {
    return { source: markerResolutionSource(evidence), evidenceId: evidence.id };
}
function recordStructuralConflict(evidence, field, structuralValue, competingValue, competingSource) {
    evidence.semanticConflicts = [
        ...(evidence.semanticConflicts ?? []),
        { field, structuralValue, competingValue, competingSource },
    ];
}
function parseSuperAttackCondition(rawText) {
    const sourceFragments = wholeLineSourceFragments(rawText);
    if (!rawText) {
        return {
            rawText,
            expression: { op: "always" },
            parseStatus: "supported",
            sourceFragments,
            unparsedFragments: [],
        };
    }
    return {
        rawText,
        expression: { op: "unknown", sourceText: rawText },
        parseStatus: "unknown",
        sourceFragments,
        unparsedFragments: sourceFragments,
    };
}
function superAttackEffectCandidates(rawText) {
    const candidates = [];
    const raisePattern = /(?:(greatly|massively)\s+)?raises?\s+(?:(?:all\s+)?allies['’]\s+)?(ATK|DEF)(?:\s*&\s*(ATK|DEF))?(?:\s+by\s+(\d+(?:\.\d+)?)%|\s*\+(\d+(?:\.\d+)?)%)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s+(?:per|with\s+each)\s+Super\s+Attack)?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(raisePattern)) {
        if (match.index === undefined)
            continue;
        const text = match[0];
        const target = /allies['’]/i.test(text)
            ? { scope: "allies", selfInclusion: "unknown" }
            : { scope: "self" };
        const magnitude = superAttackMagnitude(match[1], "raise");
        const value = numericMatch(match[4] ?? match[5]);
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[2], match[3]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => superAttackStatEffect(stat === "ATK" ? "atk_raise" : "def_raise", target, magnitude, value, duration, stacking)),
        });
    }
    const boostPattern = /(?:(?:all\s+)?allies['’]\s+)?(ATK|DEF)(?:\s*&\s*(ATK|DEF))?\s*\+(\d+(?:\.\d+)?)%(?:\s+for\s+(?:all\s+)?allies)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(boostPattern)) {
        if (match.index === undefined)
            continue;
        const text = match[0];
        const target = /allies/i.test(text)
            ? { scope: "allies", selfInclusion: "unknown" }
            : { scope: "self" };
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[1], match[2]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => superAttackStatEffect(stat === "ATK" ? "atk_raise" : "def_raise", target, "raise", numericMatch(match[3]), duration, stacking)),
        });
    }
    const lowerPattern = /(?:(greatly|massively)\s+)?lowers?\s+(?!own\b)(ATK|DEF)(?:\s*&\s*(ATK|DEF))?(?:\s+by\s+(\d+(?:\.\d+)?)%)?(?:\s+(?:for\s+\d+\s+turns?|in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle))?(?:\s+(?:per|with\s+each)\s+Super\s+Attack)?(?:\s*\(up\s+to\s+\d+(?:\.\d+)?%\)|,?\s*(?:stacking|stacks?|accumulating|accumulates?)\s+up\s+to\s+\d+(?:\.\d+)?%)?/gi;
    for (const match of rawText.matchAll(lowerPattern)) {
        if (match.index === undefined)
            continue;
        const text = match[0];
        const target = superAttackEnemyTarget(rawText, match.index, match.index + text.length);
        const magnitude = superAttackMagnitude(match[1], "lower");
        const value = numericMatch(match[4]);
        const duration = superAttackDuration(text);
        const stacking = superAttackStacking(text);
        const stats = uniqueStrings([match[2], match[3]].filter(Boolean).map(value => value.toUpperCase()));
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: stats.map(stat => ({
                kind: stat === "ATK" ? "enemy_atk_lowering" : "enemy_def_lowering",
                origin: "super_attack",
                target,
                magnitude,
                ...(value !== undefined ? { value, unit: "percent" } : {}),
                duration,
                stacking,
                activationTiming: superAttackActivationTiming(),
                calculationBucket: {
                    bucket: "super_attack_enemy_stat_lowering",
                    source: "documented_domain_rule",
                },
                parseStatus: "supported",
            })),
        });
    }
    collectSuperAttackStatusCandidates(rawText, /(?:(?:with|and)\s+)?(?:(?:\d+(?:\.\d+)?%|(?:a\s+)?(?:rare|medium|high|great))\s+chance\s+(?:of|to)\s+|a\s+chance\s+(?:of|to)\s+|may\s+)?(?:stunning|stuns?|stun)\s+(?:the\s+)?(?:enemy|enemies|them)(?:\s+for\s+\d+\s+turns?)?/gi, "stun", candidates);
    collectSuperAttackStatusCandidates(rawText, /(?:(?:with|and)\s+)?(?:(?:\d+(?:\.\d+)?%|(?:a\s+)?(?:rare|medium|high|great))\s+chance\s+(?:of|to)\s+|a\s+chance\s+(?:of|to)\s+|may\s+)?(?:sealing|seals?|seal)\s+(?:(?:the\s+)?enemy(?:'s)?\s+)?Super\s+Attack(?:\s+for\s+\d+\s+turns?)?/gi, "super_attack_seal", candidates);
    return candidates;
}
function superAttackStatEffect(kind, target, magnitude, value, duration, stacking) {
    const resolvedDuration = duration.kind === "unknown"
        ? {
            kind: "permanent",
            source: "documented_domain_rule",
            provenance: domainRuleProvenance(),
        }
        : duration;
    const resolvedStacking = stacking.kind === "not_stackable"
        ? stacking
        : {
            ...stacking,
            kind: "stackable",
            scope: superAttackStackingScope(resolvedDuration),
            source: stacking.kind === "stackable" ? stacking.source : "documented_domain_rule",
            provenance: stacking.kind === "stackable"
                ? { source: stacking.source }
                : domainRuleProvenance(),
        };
    return {
        kind,
        origin: "super_attack",
        target,
        magnitude,
        ...(value !== undefined ? { value, unit: "percent" } : {}),
        duration: resolvedDuration,
        stacking: resolvedStacking,
        applicationTrigger: {
            kind: "per_super_attack",
            source: "documented_domain_rule",
            provenance: domainRuleProvenance(),
        },
        activationTiming: superAttackActivationTiming(),
        calculationBucket: {
            bucket: "super_attack_raise",
            source: "documented_domain_rule",
        },
        parseStatus: "supported",
    };
}
function superAttackStackingScope(duration) {
    if (duration.kind === "current_turn")
        return "current_turn";
    if (duration.kind === "turns")
        return "active_windows";
    if (duration.kind === "permanent")
        return "battle";
    return "unknown";
}
function domainRuleProvenance() {
    return {
        source: "documented_domain_rule",
        ruleVersion: exports.SUPER_ATTACK_STAT_RAISE_DOMAIN_RULE_VERSION,
    };
}
function collectSuperAttackStatusCandidates(rawText, pattern, kind, candidates) {
    for (const match of rawText.matchAll(pattern)) {
        if (match.index === undefined)
            continue;
        const text = match[0];
        const probability = superAttackProbability(text);
        candidates.push({
            start: match.index,
            end: match.index + text.length,
            effects: [{
                    kind,
                    origin: "super_attack",
                    target: superAttackEnemyTarget(rawText, match.index, match.index + text.length),
                    ...probability,
                    duration: superAttackDuration(text),
                    activationTiming: superAttackActivationTiming(),
                    parseStatus: probability.probabilitySource === "unresolved" ? "partial" : "supported",
                }],
        });
    }
}
function superAttackActivationTiming() {
    return {
        moment: "when_super_attack_effect_resolves",
        source: "documented_domain_rule",
    };
}
function superAttackMagnitude(qualifier, direction) {
    const normalized = qualifier?.toLowerCase();
    if (normalized === "greatly")
        return direction === "raise" ? "greatly_raise" : "greatly_lower";
    if (normalized === "massively")
        return direction === "raise" ? "massively_raise" : "massively_lower";
    return direction;
}
function superAttackDuration(sourceText) {
    const turns = sourceText.match(/for\s+(\d+)\s+turns?/i);
    if (turns) {
        const value = Number(turns[1]);
        return value === 1
            ? { kind: "current_turn", source: "explicit_text" }
            : { kind: "turns", turns: value, source: "explicit_text" };
    }
    if (/\b(?:in\s+battle|permanently|for\s+the\s+rest\s+of\s+(?:the\s+)?battle)\b/i.test(sourceText)) {
        return { kind: "permanent", source: "explicit_text" };
    }
    return { kind: "unknown", source: "unresolved" };
}
function superAttackStacking(sourceText) {
    if (/\bnot\s+stackable\b/i.test(sourceText)) {
        return { kind: "not_stackable", source: "explicit_text" };
    }
    const cap = sourceText.match(/(?:up\s+to|maximum\s+of)\s+(\d+(?:\.\d+)?)%/i);
    if (cap) {
        return {
            kind: "stackable",
            capPercent: Number(cap[1]),
            source: "explicit_text",
            capSource: "explicit_text",
        };
    }
    if (/\b(?:stackable|stacks?|stacking|accumulates?|accumulating|per\s+Super\s+Attack|with\s+each\s+Super\s+Attack)\b/i.test(sourceText)) {
        return { kind: "stackable", source: "explicit_text" };
    }
    return { kind: "unknown", source: "unresolved" };
}
function superAttackProbability(sourceText) {
    const explicit = sourceText.match(/(\d+(?:\.\d+)?)%\s+chance/i);
    if (explicit) {
        return { activationChancePercent: Number(explicit[1]), probabilitySource: "explicit_text" };
    }
    const term = sourceText.match(/\b(rare|medium|high|great)\s+chance\b/i)?.[1]?.toLowerCase()
        ?? (sourceText.match(/\ba\s+chance\b/i) ? "a chance" : undefined)
        ?? (sourceText.match(/\bmay\b/i) ? "may" : undefined);
    if (term) {
        return {
            qualitativeChanceTerm: term,
            probabilitySource: "unresolved",
        };
    }
    return {};
}
function superAttackEnemyTarget(rawText, start, end) {
    const effectText = rawText.slice(start, end);
    if (/\b(?:the\s+enemy|enemy)\b/i.test(effectText) && !/\ball\s+enemies\b/i.test(effectText)) {
        return { scope: "current_target" };
    }
    if (/\b(?:all\s+enemies|enemies|them)\b/i.test(effectText)) {
        return { scope: "all_enemies" };
    }
    const previousBoundary = Math.max(rawText.lastIndexOf(";", start - 1), rawText.lastIndexOf(".", start - 1), rawText.lastIndexOf("!", start - 1), rawText.lastIndexOf("?", start - 1));
    const followingBoundaries = [";", ".", "!", "?"]
        .map(delimiter => rawText.indexOf(delimiter, end))
        .filter(index => index >= 0);
    const nextBoundary = followingBoundaries.length > 0 ? Math.min(...followingBoundaries) : rawText.length;
    const clauseText = rawText.slice(previousBoundary + 1, nextBoundary);
    return /\ball\s+enemies\b/i.test(clauseText)
        ? { scope: "all_enemies" }
        : { scope: "current_target" };
}
function superAttackEffectListStatus(effects) {
    return aggregateStatuses(effects.map(effect => effect.parseStatus));
}
function wholeLineSourceFragments(rawText) {
    return rawText.replace(/\r\n/g, "\n").split("\n").flatMap((text, lineIndex) => text.length > 0
        ? [{ lineIndex, text, start: 0, end: text.length }]
        : []);
}
function sourceFragmentsForAbsoluteRange(rawText, start, end) {
    const fragments = [];
    const lines = rawText.split(/\r?\n/);
    let absoluteStart = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const lineEnd = absoluteStart + line.length;
        const fragmentStart = Math.max(start, absoluteStart);
        const fragmentEnd = Math.min(end, lineEnd);
        if (fragmentEnd > fragmentStart) {
            const localStart = fragmentStart - absoluteStart;
            const localEnd = fragmentEnd - absoluteStart;
            fragments.push({
                lineIndex,
                text: line.slice(localStart, localEnd),
                start: localStart,
                end: localEnd,
            });
        }
        const separatorLength = rawText.slice(lineEnd, lineEnd + 2) === "\r\n" ? 2 : 1;
        absoluteStart = lineEnd + (lineIndex < lines.length - 1 ? separatorLength : 0);
    }
    return fragments;
}
function complementSourceFragments(rawText, ranges) {
    const merged = [];
    for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) {
            previous.end = Math.max(previous.end, range.end);
        }
        else {
            merged.push({ ...range });
        }
    }
    const fragments = [];
    let cursor = 0;
    for (const range of [...merged, { start: rawText.length, end: rawText.length }]) {
        if (range.start > cursor && /\S/.test(rawText.slice(cursor, range.start))) {
            fragments.push(...sourceFragmentsForAbsoluteRange(rawText, cursor, range.start)
                .filter(fragment => /\S/.test(fragment.text)));
        }
        cursor = Math.max(cursor, range.end);
    }
    return fragments;
}
function numericMatch(value) {
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function uniqueStrings(values) {
    return Array.from(new Set(values));
}
function parsePassive(stateKey, name, rawText, passiveDetails, context) {
    const sourceMap = mapPassiveDetailsToSource(rawText, passiveDetails);
    const conditionEvidence = validConditionEvidence(stateKey, rawText, sourceMap.sourceFragments, passiveDetails?.conditionEvidence ?? [], context);
    const structuralEvidence = context
        ? validStructuralEvidence(stateKey, rawText, passiveDetails?.structuralSource, "passive", undefined, passiveDetails?.sourceSkillId)
        : [];
    const parsingConditionEvidence = [
        ...conditionEvidence,
        ...conditionEvidenceFromStructuralEvidence(stateKey, rawText, structuralEvidence, conditionEvidence),
    ];
    const blocks = buildLogicalPassiveBlocks(sourceMap);
    const rules = [];
    const unparsedFragments = [];
    let currentCondition;
    let currentConditionUsed = false;
    const flushUnusedCondition = () => {
        if (!currentCondition || currentConditionUsed) {
            return;
        }
        rules.push(isStandalonePassiveAction(currentCondition.text)
            ? standalonePassiveActionRule(stateKey, currentCondition)
            : unknownStandaloneRule(stateKey, currentCondition));
        unparsedFragments.push(...currentCondition.source);
    };
    for (const block of blocks) {
        if (block.kind === "condition") {
            flushUnusedCondition();
            currentCondition = block;
            currentConditionUsed = false;
            continue;
        }
        const compositeScaling = currentCondition
            ? parseCompositeScalingConditionHeader(currentCondition.text)
            : undefined;
        const headerScaling = currentCondition
            ? compositeScaling?.scaling
                ?? parseKiAmountScalingHeader(currentCondition.text)
                ?? parseKiSphereScalingHeader(currentCondition.text)
                ?? parseCombatEventScalingHeader(currentCondition.text)
                ?? parseCategoryAllyScalingHeader(currentCondition.text)
                ?? parseCategoryNameAllyScalingHeader(currentCondition.text)
                ?? parseCategoryOrClassAllyScalingHeader(currentCondition.text)
                ?? parseNameAllyScalingHeader(currentCondition.text)
                ?? parseClassAllyScalingHeader(currentCondition.text)
                ?? parseTurnPassedScalingHeader(currentCondition.text)
                ?? parseExistingEnemyScalingHeader(currentCondition.text)
                ?? parseHpRemainingScalingHeader(currentCondition.text)
            : undefined;
        const perTurnApplicationHeader = currentCondition
            ? isPerTurnApplicationHeader(currentCondition.text)
            : false;
        const headerConditionResult = currentCondition
            ? compositeScaling
                ? parseCondition(currentCondition.text, compositeScaling.conditionText, context)
                : headerScaling || perTurnApplicationHeader
                    ? { condition: { op: "always" }, status: "supported" }
                    : parseCondition(currentCondition.text, enrichedConditionText(currentCondition, parsingConditionEvidence), context)
            : { condition: { op: "always" }, status: "supported" };
        const inlineEnemyStatus = splitInlineEnemyStatusCondition(block, parsingConditionEvidence);
        const inlineTemporal = splitInlineTemporalCondition(inlineEnemyStatus?.effectText ?? block.text);
        const inlineConditionResults = [
            ...(inlineEnemyStatus
                ? [parseCondition(inlineEnemyStatus.conditionText, undefined, context)]
                : []),
            ...(inlineTemporal
                ? [parseCondition(inlineTemporal.conditionText, undefined, context)]
                : []),
        ];
        const conditionResult = inlineConditionResults.reduce(combineConditionResults, headerConditionResult);
        const effectResult = parseEffects(inlineTemporal?.effectText ?? inlineEnemyStatus?.effectText ?? block.text, {
            stateKey,
            rawText,
            ruleLineIndex: block.source[0]?.lineIndex ?? -1,
            ...((currentCondition || inlineTemporal?.activationContextText || inlineEnemyStatus) ? {
                phaseContextText: [
                    currentCondition?.text,
                    inlineEnemyStatus?.conditionText,
                    inlineTemporal?.activationContextText,
                ]
                    .filter((value) => Boolean(value))
                    .join(" "),
            } : {}),
            ...(headerScaling ? { headerScaling } : {}),
        });
        effectResult.effects = effectResult.effects.map(effect => applyPassiveHeaderSemantics(applyPassiveStructuralSemantics(effect, block.source, structuralEvidence, currentCondition?.source), currentCondition?.text, headerScaling));
        const source = uniqueOrderedFragments([
            ...(currentCondition?.source ?? []),
            ...block.source,
        ]);
        const parseStatus = combineParseStatuses(conditionResult.status, effectResult.status);
        rules.push({
            id: ruleIdFromFragment(stateKey, block.source[block.source.length - 1]),
            condition: conditionResult.condition,
            conditionStatus: conditionResult.status,
            effects: effectResult.effects,
            effectStatus: effectResult.status,
            source,
            parseStatus,
            confidence: confidenceFromStatus(parseStatus),
        });
        if (conditionResult.status !== "supported" && currentCondition) {
            unparsedFragments.push(...currentCondition.source);
        }
        if (effectResult.status !== "supported") {
            unparsedFragments.push(...block.source);
        }
        currentConditionUsed = true;
    }
    flushUnusedCondition();
    return {
        ...(name ? { name } : {}),
        rawText,
        parseStatus: aggregatePassiveStatus(rules),
        rules,
        unparsedFragments: uniqueOrderedFragments(unparsedFragments),
        ...(conditionEvidence.length > 0 ? { conditionEvidence } : {}),
        ...(structuralEvidence.length > 0 ? { structuralEvidence } : {}),
    };
}
exports.parsePassive = parsePassive;
function applyPassiveStructuralSemantics(effect, source, evidenceEntries, triggerContext = []) {
    const matching = evidenceEntries.filter(entry => evidenceMatchesEffect(entry, effect.sourceText, source));
    if (matching.length === 0) {
        return effect;
    }
    const once = matching.find(entry => entry.markers.some(marker => marker.markerKind === "once"));
    const forever = matching.find(entry => entry.markers.some(marker => marker.markerKind === "forever"));
    if (!once && !forever) {
        return effect;
    }
    if (once) {
        effect.activationLimit = markerActivationLimit(once);
    }
    if (forever) {
        if (!effect.duration || effect.duration.kind === "unknown" || effect.duration.kind === "battle") {
            effect.duration = {
                kind: "battle",
                source: markerResolutionSource(forever),
                provenance: markerDecisionProvenance(forever),
            };
        }
        else {
            recordStructuralConflict(forever, "duration", "battle", effect.duration.kind, "explicit_text");
        }
    }
    if (effect.scaling?.kind === "per_combat_event") {
        effect.applicationTrigger = {
            kind: "per_combat_event",
            source: "explicit_text",
            provenance: { source: "explicit_text" },
        };
        if (effect.stackCap !== undefined || effect.perStack !== undefined) {
            effect.stacking = {
                kind: "stackable",
                scope: passiveStackingScope(effect.duration),
                source: "explicit_text",
                ...(effect.stackCap !== undefined
                    ? { capPercent: effect.stackCap, capSource: "explicit_text" }
                    : {}),
                provenance: { source: "explicit_text" },
            };
        }
    }
    else if (triggerContext.some(fragment => /\b(?:entrance|entering|entry)\b/i.test(fragment.text))) {
        effect.applicationTrigger = {
            kind: "entry",
            source: "explicit_text",
            provenance: { source: "explicit_text" },
        };
    }
    else {
        effect.applicationTrigger = {
            kind: "unknown",
            source: "unresolved",
            provenance: { source: "unresolved" },
        };
    }
    return effect;
}
function applyPassiveHeaderSemantics(effect, headerText, headerScaling) {
    const explicitPerTurn = isPerTurnApplicationHeader(headerText ?? "");
    const hpRemaining = headerScaling?.kind === "hp_remaining";
    const turnPassed = headerScaling?.kind === "per_turn_passed";
    if (!explicitPerTurn && !hpRemaining && !turnPassed) {
        return effect;
    }
    const source = explicitPerTurn || turnPassed
        ? "explicit_text"
        : "documented_domain_rule";
    return {
        ...effect,
        applicationTrigger: {
            kind: "per_turn",
            source,
            provenance: {
                source,
                ...(hpRemaining ? { ruleVersion: exports.HP_REMAINING_SCALING_DOMAIN_RULE_VERSION } : {}),
            },
        },
    };
}
function isPerTurnApplicationHeader(sourceText) {
    return /^At the start of (?:each )?turn$/i.test(sourceText.trim());
}
function passiveStackingScope(duration) {
    if (duration?.kind === "within_turn")
        return "current_turn";
    if (duration?.kind === "turns")
        return "active_windows";
    if (duration?.kind === "battle")
        return "battle";
    return "unknown";
}
function validConditionEvidence(stateKey, rawText, sourceFragments, evidenceEntries, context) {
    if (!context || evidenceEntries.length === 0) {
        return [];
    }
    const passiveTextSha256 = (0, crypto_1.createHash)("sha256").update(rawText, "utf8").digest("hex");
    const fragmentsByLine = new Map(sourceFragments.map(fragment => [fragment.lineIndex, fragment]));
    const seenLines = new Set();
    return evidenceEntries.filter(evidence => {
        const endLineIndex = evidence.anchor?.endLineIndex ?? evidence.anchor?.lineIndex;
        const anchorLineIndexes = Number.isInteger(evidence.anchor?.lineIndex)
            && Number.isInteger(endLineIndex)
            && endLineIndex >= evidence.anchor.lineIndex
            ? Array.from({ length: endLineIndex - evidence.anchor.lineIndex + 1 }, (_value, index) => evidence.anchor.lineIndex + index)
            : [];
        if (evidence.kind !== "enemy_status"
            || evidence.stateKey !== stateKey
            || evidence.characterId !== context.characterId
            || evidence.formId !== context.formId
            || evidence.releaseState !== context.releaseState
            || evidence.passiveTextSha256 !== passiveTextSha256
            || (evidence.provenance?.source !== "dokkan_fyi_payload"
                && evidence.provenance?.source !== "first_party_game_db")
            || evidence.provenance.markerSyntax !== "passiveImg"
            || !evidence.provenance.sourceVersion
            || anchorLineIndexes.length === 0
            || anchorLineIndexes.some(lineIndex => seenLines.has(lineIndex))) {
            return false;
        }
        const expectedPayloadField = evidence.provenance.source === "dokkan_fyi_payload"
            ? context.releaseState === "initial"
                ? "props.character.passive_skill.description"
                : "props.character.extreme_z_awakening.passive_skill.description"
            : undefined;
        const anchorFragments = anchorLineIndexes
            .map(lineIndex => fragmentsByLine.get(lineIndex))
            .filter((fragment) => fragment !== undefined);
        const normalizedConditionAnchorText = logicalText("condition", anchorFragments);
        const normalizedEffectAnchorText = logicalText("effect", anchorFragments);
        if (anchorFragments.length !== anchorLineIndexes.length
            || (expectedPayloadField !== undefined && evidence.provenance.payloadField !== expectedPayloadField)
            || (evidence.provenance.source === "first_party_game_db"
                && evidence.passiveSkillId !== context.passiveSkillSetId)
            || (normalizedConditionAnchorText !== evidence.anchor.normalizedText
                && normalizedEffectAnchorText !== evidence.anchor.normalizedText)
            || stripPassiveMarkers(evidence.anchor.structuralText).replace(/\s+/g, " ")
                !== evidence.anchor.normalizedText) {
            return false;
        }
        const semanticStructuralText = evidence.anchor.structuralText.replace(/\s+/g, " ");
        const statusSource = semanticStructuralText.slice(semanticStructuralText.toLowerCase().indexOf("following status:")
            + "following status:".length);
        const sourceTokens = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)]
            .map(match => match[1]);
        if (sourceTokens.length !== evidence.statuses.length
            || evidence.statuses.some((status, order) => status.order !== order
                || status.sourceToken !== sourceTokens[order]
                || (status.status !== undefined
                    && status.status !== enemyStatusFromEvidenceMarker(status.sourceToken))
                || status.resolution !== (status.status ? "supported" : "unresolved"))) {
            return false;
        }
        const expectedConnector = evidenceConnector(evidence.anchor.structuralText, sourceTokens.length);
        if (evidence.connector !== expectedConnector
            || evidence.resolution !== evidenceResolution(evidence.statuses, expectedConnector)) {
            return false;
        }
        anchorLineIndexes.forEach(lineIndex => seenLines.add(lineIndex));
        return true;
    }).sort((left, right) => left.anchor.lineIndex - right.anchor.lineIndex);
}
function conditionEvidenceForBlock(block, evidenceEntries) {
    const lineIndexes = new Set(block.source.map(fragment => fragment.lineIndex));
    return evidenceEntries.filter(evidence => {
        const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        for (let lineIndex = evidence.anchor.lineIndex; lineIndex <= endLineIndex; lineIndex += 1) {
            if (lineIndexes.has(lineIndex))
                return true;
        }
        return false;
    });
}
function conditionEvidenceFromStructuralEvidence(stateKey, rawText, structuralEvidence, explicitEvidence) {
    const explicitLines = new Set();
    explicitEvidence.forEach(evidence => {
        const end = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        for (let line = evidence.anchor.lineIndex; line <= end; line += 1) {
            explicitLines.add(line);
        }
    });
    const derived = [];
    for (const evidence of structuralEvidence) {
        const endLine = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        const overlapsExplicit = Array.from({ length: endLine - evidence.anchor.lineIndex + 1 }, (_value, index) => evidence.anchor.lineIndex + index).some(line => explicitLines.has(line));
        const structuralText = evidence.anchor.structuralText.replace(/\s+/g, " ");
        const statusOffset = structuralText.toLowerCase().indexOf("following status:");
        if (overlapsExplicit || statusOffset < 0 || evidence.channel !== "passive")
            continue;
        const provenance = evidence.provenance.source === "dokkan_fyi_payload"
            ? evidence.provenance.payloadField === "props.character.passive_skill.description"
                || evidence.provenance.payloadField === "props.character.extreme_z_awakening.passive_skill.description"
                ? {
                    source: evidence.provenance.source,
                    sourceVersion: evidence.provenance.sourceVersion,
                    payloadField: evidence.provenance.payloadField,
                    markerSyntax: evidence.provenance.markerSyntax,
                }
                : undefined
            : evidence.provenance.payloadField !== "special_sets.description"
                ? {
                    source: evidence.provenance.source,
                    sourceVersion: evidence.provenance.sourceVersion,
                    payloadField: evidence.provenance.payloadField,
                    markerSyntax: evidence.provenance.markerSyntax,
                }
                : undefined;
        if (!provenance)
            continue;
        const statusSource = structuralText.slice(statusOffset + "following status:".length);
        const sourceTokens = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)]
            .map(match => match[1]);
        const statuses = [];
        for (const [order, sourceToken] of sourceTokens.entries()) {
            const status = enemyStatusFromEvidenceMarker(sourceToken);
            if (!status) {
                statuses.length = 0;
                break;
            }
            statuses.push({ order, sourceToken, status, resolution: "supported" });
        }
        if (statuses.length === 0)
            continue;
        const connector = evidenceConnector(evidence.anchor.structuralText, statuses.length);
        if (statuses.length > 1 && !connector)
            continue;
        derived.push({
            kind: "enemy_status",
            stateKey,
            characterId: evidence.characterId,
            formId: evidence.formId,
            releaseState: evidence.releaseState,
            ...(evidence.passiveSkillId ? { passiveSkillId: evidence.passiveSkillId } : {}),
            passiveTextSha256: (0, crypto_1.createHash)("sha256").update(rawText, "utf8").digest("hex"),
            anchor: {
                lineIndex: evidence.anchor.lineIndex,
                ...(evidence.anchor.endLineIndex !== undefined
                    ? { endLineIndex: evidence.anchor.endLineIndex }
                    : {}),
                normalizedText: evidence.anchor.normalizedText,
                structuralText: evidence.anchor.structuralText,
            },
            statuses,
            ...(connector ? { connector } : {}),
            resolution: "supported",
            provenance,
        });
    }
    return derived;
}
function stripPassiveMarkers(sourceText) {
    return sourceText.replace(/\{[^}]+\}/g, "").trim();
}
function evidenceConnector(structuralText, markerCount) {
    if (markerCount < 2) {
        return undefined;
    }
    const semanticStructuralText = structuralText.replace(/\s+/g, " ");
    const statusSource = semanticStructuralText.slice(semanticStructuralText.toLowerCase().indexOf("following status:") + "following status:".length);
    const firstMarkerIndex = statusSource.search(/\{passiveImg:[^}]+\}/);
    const lastMarkerIndex = statusSource.lastIndexOf("{passiveImg:");
    const lastMarkerEnd = lastMarkerIndex >= 0 ? statusSource.indexOf("}", lastMarkerIndex) + 1 : -1;
    if (firstMarkerIndex < 0 || lastMarkerEnd <= firstMarkerIndex) {
        return undefined;
    }
    const markerList = statusSource.slice(firstMarkerIndex, lastMarkerEnd)
        .replace(/\{passiveImg:[^}]+\}/g, "#");
    const hasAnd = /\band\b/i.test(markerList);
    const hasOr = /\bor\b/i.test(markerList);
    if (hasAnd === hasOr) {
        return undefined;
    }
    return hasAnd ? "and" : "or";
}
function evidenceResolution(statuses, connector) {
    if (statuses.length === 0) {
        return "unresolved";
    }
    return statuses.some(status => !status.status) || (statuses.length > 1 && !connector)
        ? "partial"
        : "supported";
}
function enemyStatusFromEvidenceMarker(sourceToken) {
    if (sourceToken === "atk_down")
        return "atk_down";
    if (sourceToken === "def_down")
        return "def_down";
    if (sourceToken === "stun")
        return "stunned";
    if (sourceToken === "astute")
        return "super_attack_sealed";
    return undefined;
}
function enrichedConditionText(block, evidenceEntries) {
    const evidenceByLine = new Map();
    evidenceEntries.forEach(evidence => {
        const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        for (let lineIndex = evidence.anchor.lineIndex; lineIndex <= endLineIndex; lineIndex += 1) {
            evidenceByLine.set(lineIndex, evidence);
        }
    });
    if (!block.source.some(fragment => evidenceByLine.has(fragment.lineIndex))) {
        return block.text;
    }
    const enrichedSource = block.source.map(fragment => {
        const evidence = evidenceByLine.get(fragment.lineIndex);
        if (!evidence) {
            return fragment;
        }
        return {
            ...fragment,
            text: fragment.lineIndex === evidence.anchor.lineIndex
                ? semanticEvidenceText(evidence)
                : "",
        };
    });
    return logicalText(block.kind, enrichedSource);
}
function splitInlineEnemyStatusCondition(block, evidenceEntries) {
    const evidence = conditionEvidenceForBlock(block, evidenceEntries).find(entry => /following status:/i.test(entry.anchor.structuralText.replace(/\s+/g, " ")));
    if (!evidence)
        return undefined;
    const semanticText = semanticEvidenceText(evidence).replace(/\s+/g, " ").trim();
    const statusOffset = semanticText.toLowerCase().indexOf("following status:");
    if (statusOffset < 0)
        return undefined;
    const prefix = semanticText.slice(0, statusOffset).toLowerCase();
    const whenOffset = prefix.lastIndexOf(" when ");
    const ifOffset = prefix.lastIndexOf(" if ");
    const conditionOffset = Math.max(whenOffset, ifOffset);
    if (conditionOffset <= 0)
        return undefined;
    const effectText = semanticText.slice(0, conditionOffset).trim();
    const conditionText = semanticText.slice(conditionOffset + 1).trim();
    return effectText && conditionText ? { effectText, conditionText } : undefined;
}
function semanticEvidenceText(evidence) {
    let order = 0;
    const structuralText = evidence.anchor.structuralText.replace(/\s+/g, " ");
    const statusOffset = structuralText.toLowerCase().indexOf("following status:")
        + "following status:".length;
    return structuralText.replace(/\{passiveImg:([^}]+)\}/g, (_match, sourceToken, offset) => {
        if (offset < statusOffset) {
            return "";
        }
        const item = evidence.statuses[order++];
        const status = item?.sourceToken === sourceToken
            ? item.status ?? enemyStatusFromEvidenceMarker(sourceToken)
            : undefined;
        if (!status) {
            return "unresolved enemy status";
        }
        if (status === "atk_down")
            return "ATK Down";
        if (status === "def_down")
            return "DEF Down";
        if (status === "stunned")
            return "stunned";
        return "Super Attack sealed";
    });
}
function combineConditionResults(left, right) {
    if (left.condition.op === "always") {
        return right;
    }
    if (right.condition.op === "always") {
        return left;
    }
    const condition = resolveThatEnemyReferences({
        op: "all",
        children: [left.condition, right.condition],
    });
    return { condition, status: conditionExpressionStatus(condition) };
}
function splitInlineTemporalCondition(sourceText) {
    const temporalSuffix = /\s+((?:starting from the \d+(?:st|nd|rd|th) turn|for \d+ turn(?:s|\(s\))?) from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(sourceText);
    const kiSuffix = /\s+((?:when|if) attacking with (?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?) Ki)$/i.exec(sourceText)
        ?? /\s+((?:when attacking with\s+|with\s+)(?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained)$/i.exec(sourceText);
    const combatSuffix = /\s+((?:before|when|after)\s+(?:(?:performing|receiving|evading)(?:\s+(?:an?|the|\d+(?:\s+or\s+(?:more|less))?)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attacks?)?|attacking|delivering\s+(?:a\s+|the\s+)?final blow)(?:\s+(?:in battle|within the turn))?)$/i.exec(sourceText);
    const enemyHpSuffix = /\s+((?:when|if) (?:the )?enemy['â€™]s HP is \d+%(?:\s+or\s+(?:more|less|above|below))?)$/i.exec(sourceText);
    const againstNormalAttack = /\s+(against normal attacks?)$/i.exec(sourceText);
    const suffix = temporalSuffix ?? kiSuffix ?? combatSuffix ?? enemyHpSuffix ?? againstNormalAttack;
    if (!suffix || suffix.index === undefined) {
        return undefined;
    }
    const effectText = sourceText.slice(0, suffix.index).trim();
    const conditionText = againstNormalAttack && suffix === againstNormalAttack
        ? "When receiving a normal attack"
        : suffix[1];
    return effectText
        ? {
            effectText,
            conditionText,
            ...(!(againstNormalAttack && suffix === againstNormalAttack)
                ? { activationContextText: suffix[1] }
                : {}),
        }
        : undefined;
}
function mapPassiveDetailsToSource(rawText, passiveDetails) {
    const normalizedRawText = rawText.replace(/\r\n/g, "\n");
    const rawLines = normalizedRawText.split("\n");
    const sourceFragments = rawLines
        .map((line, lineIndex) => trimmedFragment(line, lineIndex))
        .filter(fragment => fragment.text.length > 0);
    const lineTexts = passiveDetails?.lines ?? sourceFragments.map(fragment => fragment.text);
    const lines = alignPassiveTexts(rawLines, lineTexts);
    const sectionEntries = (passiveDetails?.sections ?? []).flatMap(section => [
        ...(section.label ? [{ type: "label", text: section.label }] : []),
        ...section.lines.map(text => ({ type: "line", text })),
    ]);
    const mappedSectionEntries = alignPassiveTexts(rawLines, sectionEntries.map(entry => entry.text));
    let mappedIndex = 0;
    const sections = (passiveDetails?.sections ?? []).map(section => ({
        ...(section.label ? { label: mappedSectionEntries[mappedIndex++] } : {}),
        lines: section.lines.map(() => mappedSectionEntries[mappedIndex++]),
    }));
    const unmappedTexts = [
        ...lines.filter(line => !line.mapped).map(line => line.text),
        ...mappedSectionEntries.filter(entry => !entry.mapped).map(entry => entry.text),
    ];
    return {
        rawText,
        sourceFragments,
        lines,
        sections,
        unmappedTexts,
    };
}
exports.mapPassiveDetailsToSource = mapPassiveDetailsToSource;
function alignPassiveTexts(rawLines, texts) {
    const stream = buildAlignmentStream(rawLines);
    let cursor = 0;
    return texts.map(text => {
        const normalizedText = normalizeAlignmentText(text);
        const matchIndex = normalizedText ? stream.text.indexOf(normalizedText, cursor) : -1;
        if (matchIndex < 0) {
            return { text, source: [], mapped: false };
        }
        cursor = matchIndex + normalizedText.length;
        const positions = stream.positions.slice(matchIndex, cursor);
        return {
            text,
            source: fragmentsFromAlignmentPositions(rawLines, positions),
            mapped: true,
        };
    });
}
function buildAlignmentStream(rawLines) {
    let text = "";
    const positions = [];
    rawLines.forEach((line, lineIndex) => {
        const bullet = /^\s*-\s+/.exec(line);
        for (let column = 0; column < line.length; column += 1) {
            const character = line[column];
            const structuralBullet = Boolean(bullet && column >= (bullet.index ?? 0) && column < (bullet[0].length));
            if (/\s/.test(character) || character === "*" || structuralBullet) {
                continue;
            }
            text += character;
            positions.push({ lineIndex, column });
        }
    });
    return { text, positions };
}
function normalizeAlignmentText(text) {
    return text.replace(/^\s*-\s+/, "").replace(/[\s*]/g, "");
}
function fragmentsFromAlignmentPositions(rawLines, positions) {
    const ranges = new Map();
    for (const position of positions) {
        const range = ranges.get(position.lineIndex);
        if (range) {
            range.start = Math.min(range.start, position.column);
            range.end = Math.max(range.end, position.column + 1);
        }
        else {
            ranges.set(position.lineIndex, { start: position.column, end: position.column + 1 });
        }
    }
    return [...ranges.entries()].sort(([left], [right]) => left - right).map(([lineIndex, range]) => ({
        lineIndex,
        text: rawLines[lineIndex].slice(range.start, range.end),
        start: range.start,
        end: range.end,
    }));
}
function buildLogicalPassiveBlocks(sourceMap) {
    const hasCompleteStructuredSectionBoundaries = sourceMap.sections.length > 0
        && sourceMap.sections.every(section => Boolean(section.label));
    if (hasCompleteStructuredSectionBoundaries) {
        const structured = buildStructuredLogicalPassiveBlocks(sourceMap);
        if (structured) {
            return structured;
        }
        return structuredSectionsContainSwallowedLogicalHeader(sourceMap)
            || structuredSectionsSplitEffectContinuation(sourceMap)
            ? buildHeuristicLogicalPassiveBlocks(sourceMap.sourceFragments)
            : failClosedLogicalPassiveBlocks(sourceMap.sourceFragments);
    }
    return buildHeuristicLogicalPassiveBlocks(sourceMap.sourceFragments);
}
function structuredSectionsSplitEffectContinuation(sourceMap) {
    const entries = sourceMap.sections.flatMap(section => [
        ...(section.label ? [{ kind: "condition", mappedText: section.label }] : []),
        ...section.lines.map(mappedText => ({ kind: "effect", mappedText })),
    ]);
    return entries.some((entry, index) => index > 0
        && entry.kind === "condition"
        && entries[index - 1].kind === "effect"
        && effectTextRequiresContinuation(logicalText("effect", entries[index - 1].mappedText.source)));
}
function structuredSectionsContainSwallowedLogicalHeader(sourceMap) {
    return sourceMap.sections.some(section => section.lines.some(line => line.source.slice(1).some(fragment => isStructuredBoundaryHeader(fragment.text))));
}
function isStructuredBoundaryHeader(text) {
    return /^[A-Z0-9]/.test(text.trim())
        && isLogicalHeaderStart(text)
        && !isEffectModifierContinuation(text);
}
function buildStructuredLogicalPassiveBlocks(sourceMap) {
    if (structuredSectionsSplitEffectContinuation(sourceMap)) {
        return undefined;
    }
    const entries = sourceMap.sections.flatMap(section => [
        ...(section.label ? [{ kind: "condition", mappedText: section.label }] : []),
        ...section.lines.map(mappedText => ({ kind: "effect", mappedText })),
    ]);
    if (entries.length === 0 || entries.some(entry => !entry.mappedText.mapped || entry.mappedText.source.length === 0)) {
        return undefined;
    }
    const blocks = [];
    const assignedLineIndexes = new Set();
    let previousLineIndex = -1;
    for (const entry of entries) {
        const lineIndexes = [...new Set(entry.mappedText.source.map(fragment => fragment.lineIndex))]
            .sort((left, right) => left - right);
        if (entry.kind === "effect" && entry.mappedText.source.slice(1).some(fragment => isStructuredBoundaryHeader(fragment.text))) {
            return undefined;
        }
        if (lineIndexes[0] <= previousLineIndex
            || lineIndexes.some(lineIndex => assignedLineIndexes.has(lineIndex))) {
            return undefined;
        }
        const source = sourceMap.sourceFragments.filter(fragment => lineIndexes.includes(fragment.lineIndex));
        if (source.length !== lineIndexes.length) {
            return undefined;
        }
        lineIndexes.forEach(lineIndex => assignedLineIndexes.add(lineIndex));
        previousLineIndex = lineIndexes[lineIndexes.length - 1];
        blocks.push({
            kind: entry.kind,
            text: logicalText(entry.kind, source),
            source,
        });
    }
    if (assignedLineIndexes.size !== sourceMap.sourceFragments.length
        || sourceMap.sourceFragments.some(fragment => !assignedLineIndexes.has(fragment.lineIndex))) {
        return undefined;
    }
    return blocks;
}
function failClosedLogicalPassiveBlocks(sourceFragments) {
    return sourceFragments.length > 0
        ? [{ kind: "condition", text: logicalText("condition", sourceFragments), source: sourceFragments }]
        : [];
}
function buildHeuristicLogicalPassiveBlocks(sourceFragments) {
    const blocks = [];
    let current;
    const flush = () => {
        if (!current) {
            return;
        }
        blocks.push({
            kind: current.kind,
            text: logicalText(current.kind, current.source),
            source: current.source,
        });
        current = undefined;
    };
    for (const fragment of sourceFragments) {
        const isBullet = /^-\s+/.test(fragment.text);
        if (isBullet) {
            flush();
            current = { kind: "effect", source: [fragment] };
            continue;
        }
        if (!current) {
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "effect"
            && isStructuredBoundaryHeader(fragment.text)
            && !effectTextRequiresContinuation(logicalText("effect", current.source))
            && !isEffectModifierContinuation(fragment.text)) {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "condition"
            && isStructuredBoundaryHeader(fragment.text)
            && conditionExpressionStatus(parseBooleanCondition(logicalText("condition", current.source))) === "supported") {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "condition"
            && /^When the target enemy is in the following status:/i.test(fragment.text)) {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        current.source.push(fragment);
    }
    flush();
    return blocks;
}
function isEffectModifierContinuation(text) {
    return /^for\s+\d+\s+turn(?:s|\(s\))?$/i.test(text.trim());
}
function effectTextRequiresContinuation(text) {
    return /(?:\bwith|\bwhen|\bif|\band|\bor|\bto|\bfrom|\bwhen facing|\bafter (?:the character )?(?:performs?|receives?|evades?))\s*$/i.test(text.trim());
}
function logicalText(kind, source) {
    return source.map((fragment, index) => {
        const text = fragment.text.replace(/^\*|\*$/g, "").trim();
        return kind === "effect" && index === 0 ? text.replace(/^-\s+/, "") : text;
    }).join(" ").replace(/\s+/g, " ").trim();
}
function isLogicalHeaderStart(text) {
    const trimmed = text.trim();
    return /^(?:Activates the Entrance Animation|Basic effect\(s\)|When\b|If\b|Per\b|As the\b|After\b|Before\b|At the\b|With\b|Without\b|While\b|The less\b|The more\b|Upon\b|Once\b|Every\b|\d+ or more\b)/i.test(trimmed)
        || /^(?:For|Starting)\b/.test(trimmed)
        || /^(?:On the (?:\d+(?:st|nd|rd|th)|character['â€™]s next attacking turn)|Up to the \d+(?:st|nd|rd|th)|From the \d+(?:st|nd|rd|th) (?:through|to) the \d+(?:st|nd|rd|th))\b/.test(trimmed);
}
function isAlwaysHeader(text) {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}
function parseCondition(sourceText, semanticText = sourceText, context) {
    const text = sourceText.trim();
    if (isAlwaysHeader(text)) {
        return { condition: { op: "always" }, status: "supported" };
    }
    const parsed = bindNameIdentitySets(parseBooleanCondition(semanticText.trim()), context);
    const condition = resolveThatEnemyReferences(semanticText === sourceText ? parsed : rewriteConditionSourceText(parsed, sourceText));
    return { condition, status: conditionExpressionStatus(condition) };
}
const NAME_IDENTITY_PREDICATE_KINDS = new Set([
    "ally_name_present",
    "ally_category_name_present",
    "rotation_partner_name",
    "enemy_name",
]);
function bindNameIdentitySets(condition, context) {
    if (condition.op === "predicate") {
        if (!NAME_IDENTITY_PREDICATE_KINDS.has(condition.predicate.kind)) {
            return condition;
        }
        const predicate = {
            ...condition.predicate,
            nameMatch: condition.predicate.nameMatch ?? "includes",
        };
        const passiveSkillSetId = context?.passiveSkillSetId;
        const contract = context?.nameIdentityContract;
        if (!passiveSkillSetId || !contract || predicate.names?.length !== 1) {
            return predicateExpression(predicate);
        }
        const expectedScope = predicate.scope === "rotation"
            ? "rotation"
            : predicate.scope === "team"
                ? "team"
                : predicate.scope === "enemy"
                    ? "enemy"
                    : undefined;
        if (!expectedScope) {
            return predicateExpression(predicate);
        }
        const expectedName = normalizeNameIdentityKey(predicate.names[0]);
        const expectedCount = predicate.count ?? 1;
        const expectedCategories = predicate.categories?.map(normalizeNameIdentityKey).sort() ?? [];
        const structuralMatches = contract.bindings.filter(binding => binding.passiveSkillSetId === passiveSkillSetId
            && (predicate.kind === "enemy_name" ? binding.scope === "enemy" : binding.scope !== "enemy")
            && (predicate.kind === "ally_category_name_present"
                ? expectedCategories.length > 0
                    && JSON.stringify(binding.categories?.map(normalizeNameIdentityKey).sort() ?? [])
                        === JSON.stringify(expectedCategories)
                : binding.categories === undefined)
            && binding.count === expectedCount + (predicate.selfInclusion === "excluded"
                && context?.canonicalId !== undefined
                && binding.canonicalIds.includes(context.canonicalId)
                ? 1
                : 0));
        const preferredMatches = (bindings) => {
            const exactMatches = bindings.filter(binding => binding.canonicalNames.some(name => normalizeNameIdentityKey(name) === expectedName));
            const nameMatches = exactMatches.length > 0
                ? exactMatches
                : bindings.filter(binding => binding.canonicalNames.some(name => normalizeNameIdentityKey(name).includes(expectedName)));
            if (nameMatches.length === 0) {
                return [];
            }
            const preferredSize = predicate.nameMatch === "exact"
                ? Math.min(...nameMatches.map(binding => binding.canonicalIds.length))
                : Math.max(...nameMatches.map(binding => binding.canonicalIds.length));
            return nameMatches.filter(binding => binding.canonicalIds.length === preferredSize);
        };
        const scopedMatches = preferredMatches(structuralMatches.filter(binding => binding.scope === expectedScope));
        const matches = scopedMatches.length === 1 ? scopedMatches : preferredMatches(structuralMatches);
        if (matches.length !== 1) {
            return predicateExpression(predicate);
        }
        const officialScope = matches[0].scope;
        const officialKind = predicate.kind === "ally_category_name_present"
            || predicate.kind === "enemy_name"
            ? predicate.kind
            : officialScope === "rotation" && predicate.selfInclusion === "excluded"
                ? "rotation_partner_name"
                : "ally_name_present";
        return predicateExpression({
            ...predicate,
            kind: officialKind,
            scope: officialScope,
            nameIdentitySetId: matches[0].identitySetId,
            canonicalIds: matches[0].canonicalIds,
        });
    }
    if (condition.op === "all" || condition.op === "any") {
        return { ...condition, children: condition.children.map(child => bindNameIdentitySets(child, context)) };
    }
    if (condition.op === "not") {
        return { op: "not", child: bindNameIdentitySets(condition.child, context) };
    }
    return condition;
}
function normalizeNameIdentityKey(value) {
    return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}
function rewriteConditionSourceText(condition, sourceText) {
    if (condition.op === "predicate") {
        return predicateExpression({ ...condition.predicate, sourceText });
    }
    if (condition.op === "unknown") {
        return { op: "unknown", sourceText };
    }
    if (condition.op === "not") {
        return { op: "not", child: rewriteConditionSourceText(condition.child, sourceText) };
    }
    if (condition.op === "all" || condition.op === "any") {
        return {
            op: condition.op,
            children: condition.children.map(child => rewriteConditionSourceText(child, sourceText)),
        };
    }
    return condition;
}
function resolveThatEnemyReferences(condition) {
    if (condition.op === "not") {
        return condition;
    }
    if (condition.op === "any") {
        return {
            op: "any",
            children: condition.children.map(resolveThatEnemyReferences),
        };
    }
    if (condition.op !== "all") {
        return condition;
    }
    return resolveThatEnemyReferencesInConjunction(condition, conjunctiveComponentProvesSingleEnemy(condition));
}
function conjunctiveComponentProvesSingleEnemy(condition) {
    if (condition.op === "predicate") {
        return condition.predicate.kind === "enemy_count"
            && condition.predicate.comparator === "eq"
            && condition.predicate.value === 1;
    }
    return condition.op === "all" && condition.children.some(conjunctiveComponentProvesSingleEnemy);
}
function resolveThatEnemyReferencesInConjunction(condition, provesSingleEnemy) {
    if (condition.op === "predicate") {
        if (!provesSingleEnemy
            || condition.predicate.scope !== "enemy"
            || condition.predicate.enemySelection !== "unknown") {
            return condition;
        }
        return predicateExpression({
            ...condition.predicate,
            enemySelection: "only_enemy",
        });
    }
    if (condition.op === "all") {
        return {
            op: "all",
            children: condition.children.map(child => child.op === "all" || child.op === "predicate"
                ? resolveThatEnemyReferencesInConjunction(child, provesSingleEnemy)
                : resolveThatEnemyReferences(child)),
        };
    }
    return resolveThatEnemyReferences(condition);
}
function parseBooleanCondition(sourceText) {
    const original = sourceText.trim();
    const withoutPrefix = original.replace(/^(?:when|if)\s+/i, "").trim();
    const text = stripOuterConditionParentheses(withoutPrefix);
    const negated = /^not\s+(.+)$/i.exec(text);
    if (negated && isCombatEventLanguage(negated[1])) {
        const child = parseBooleanCondition(negated[1]);
        if (child.op !== "unknown") {
            return { op: "not", child };
        }
    }
    const qualifiedEnemyStatus = parseQualifiedEnemyStatusCondition(text, original);
    if (qualifiedEnemyStatus) {
        return qualifiedEnemyStatus;
    }
    const nextTurnOrTeam = parseNextTurnOrTeamAlternative(text, original);
    if (nextTurnOrTeam) {
        return nextTurnOrTeam;
    }
    const exact = parseExactConditionClause(text, original);
    if (exact) {
        return exact;
    }
    const sharedScopeAlly = parseSharedScopeCategoryAllyCondition(text, original);
    if (sharedScopeAlly) {
        return sharedScopeAlly;
    }
    const sharedCategoryAlternatives = parseSharedScopeCategoryAllyAlternatives(text, original);
    if (sharedCategoryAlternatives) {
        return sharedCategoryAlternatives;
    }
    const mixedNameOrCategoryAlly = parseMixedNameOrCategoryAllyCondition(text, original);
    if (mixedNameOrCategoryAlly) {
        return mixedNameOrCategoryAlly;
    }
    const hpWithAlly = parseHpWithAllyCondition(text, original);
    if (hpWithAlly) {
        return hpWithAlly;
    }
    const commaAlternatives = parseCommaSeparatedConditionAlternatives(text);
    if (commaAlternatives) {
        return commaAlternatives;
    }
    const explicitAlternative = /^(.*?),\s+or when\s+(.+)$/i.exec(text);
    if (explicitAlternative) {
        const left = parseBooleanCondition(explicitAlternative[1]);
        const right = parseBooleanCondition(explicitAlternative[2]);
        if (left.op !== "unknown" && right.op !== "unknown") {
            return { op: "any", children: [left, right] };
        }
    }
    const scopedCategoryTemporal = parseScopedCategoryAlternativesWithTemporal(text, original);
    if (scopedCategoryTemporal) {
        return scopedCategoryTemporal;
    }
    const singleEnemyHpAlternative = parseSingleEnemyHpAlternative(text, original);
    if (singleEnemyHpAlternative) {
        return singleEnemyHpAlternative;
    }
    const nextTurnSuffix = /^(HP is .+?)\s+(starting from (?:the )?(?:character['â€™]s )?next attacking turn)$/i.exec(text);
    if (nextTurnSuffix) {
        const hp = parseExactHpCondition(nextTurnSuffix[1], original);
        const nextTurn = parseNextAttackingTurnCondition(nextTurnSuffix[2], original);
        if (hp && nextTurn) {
            return { op: "all", children: [hp, nextTurn] };
        }
    }
    const allRotationSpheresSuffix = /^(.*?)\s+when all allies attacking in the same turn have obtained a Ki Sphere$/i.exec(text);
    if (allRotationSpheresSuffix?.[1].trim()) {
        const prefix = parseBooleanCondition(allRotationSpheresSuffix[1]);
        const allRotation = parseAllRotationKiSphereCondition("When all allies attacking in the same turn have obtained a Ki Sphere", original);
        if (prefix.op !== "unknown" && allRotation) {
            return { op: "all", children: [prefix, allRotation] };
        }
    }
    const dualScopeName = parseNameEnemyOrTeamAlternative(text, original);
    if (dualScopeName) {
        return dualScopeName;
    }
    const qualifiedSuffix = /^(.*?)\s+(?:(?:and\s+)?if|when)\s+((?:there (?:is|are)|your team has|an? .+? ally|another .+? ally).+)$/i.exec(text);
    if (qualifiedSuffix) {
        const prefix = parseBooleanCondition(qualifiedSuffix[1]);
        const suffix = parseBooleanCondition(qualifiedSuffix[2]);
        if (prefix.op !== "unknown" && suffix.op !== "unknown") {
            return { op: "all", children: [prefix, suffix] };
        }
    }
    const trailingRuntimeCondition = /^(.*?)\s+when\s+(HP is \d+% or (?:more|less|above|below))$/i.exec(text);
    if (trailingRuntimeCondition) {
        const prefix = parseBooleanCondition(trailingRuntimeCondition[1]);
        const suffix = parseBooleanCondition(trailingRuntimeCondition[2]);
        if (prefix.op !== "unknown" && suffix.op !== "unknown") {
            return { op: "all", children: [prefix, suffix] };
        }
    }
    const hpAfterReceived = /^HP is (\d+)% or (more|less) at the start of the character's attacking turn after the character receives (\d+) or more attacks in battle$/i.exec(text);
    if (hpAfterReceived) {
        const hp = Number(hpAfterReceived[1]);
        const attacks = Number(hpAfterReceived[3]);
        if (isHpPercent(hp) && Number.isInteger(attacks) && attacks > 0) {
            const identity = combatEventIdentity("attack", "landed");
            return {
                op: "all",
                children: [
                    predicateExpression({
                        kind: "hp_percent",
                        scope: "team",
                        comparator: /^more$/i.test(hpAfterReceived[2]) ? "gte" : "lte",
                        value: hp,
                        evaluationMoment: "start_of_turn",
                        sourceText: original,
                    }),
                    combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
                        countScope: "battle",
                        countScopeSource: "explicit_text",
                    }), original, "gte", attacks),
                ],
            };
        }
    }
    const sharedCombatScope = /^After (performing|receiving|evading) (\d+)(?: or more)? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack(?:s|\(s\)))\s+(and|or)\s+(performing|receiving|evading) (\d+)(?: or more)? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack(?:s|\(s\))) in battle$/i.exec(text);
    if (sharedCombatScope) {
        const build = (directionText, valueText, attackText) => {
            const direction = /^performing$/i.test(directionText)
                ? "performed"
                : /^receiving$/i.test(directionText) ? "landed" : "evaded";
            const identity = combatEventIdentity(attackText, direction);
            return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
                countScope: "battle",
                countScopeSource: "explicit_text",
            }), original, "gte", Number(valueText));
        };
        return {
            op: /^and$/i.test(sharedCombatScope[4]) ? "all" : "any",
            children: [
                build(sharedCombatScope[1], sharedCombatScope[2], sharedCombatScope[3]),
                build(sharedCombatScope[5], sharedCombatScope[6], sharedCombatScope[7]),
            ],
        };
    }
    for (const connector of ["or", "and"]) {
        const parts = splitTopLevelCondition(text, connector);
        if (parts.length > 1) {
            return {
                op: connector === "or" ? "any" : "all",
                children: parts.map(parseBooleanCondition),
            };
        }
    }
    const temporalSuffix = parseTemporalSuffixCondition(text);
    if (temporalSuffix) {
        return temporalSuffix;
    }
    return parsePartialSlotCondition(text) ?? { op: "unknown", sourceText: original };
}
function parseQualifiedEnemyStatusCondition(text, sourceText) {
    const match = /^(.*?)(,?\s*(?:or\s+)?if)\s+((?:the )?(?:target|attacked|selected) enemy is in the following status:\s*.+)$/i.exec(text);
    if (!match)
        return undefined;
    const prefix = match[1].replace(/,\s*$/, "").trim();
    if (!prefix)
        return undefined;
    const base = parseBooleanCondition(prefix);
    const status = parseEnemyStatusCondition(match[3], sourceText);
    if (!status || base.op === "unknown")
        return undefined;
    return {
        op: /\bor\s+if\b/i.test(match[2]) ? "any" : "all",
        children: [base, status],
    };
}
function parseSharedScopeCategoryAllyCondition(text, sourceText) {
    const match = /^(there are \d+(?: or more)?\s+.+? Category allies)\s+(and|or)\s+(\d+(?: or more)?\s+.+? Category allies)\s+(on the team|attacking in the same turn)$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const children = [match[1], match[3]].map(part => parseAllyConditionClause(`${part} ${match[4]}`, sourceText));
    if (children.some(child => child === undefined)) {
        return undefined;
    }
    return {
        op: match[2].toLowerCase() === "and" ? "all" : "any",
        children: children,
    };
}
function parseSharedScopeCategoryAllyAlternatives(text, sourceText) {
    const match = /^there are\s+(.+?)\s+(on the team|attacking in the same turn)$/i.exec(text);
    if (!match || !/\bor\b/i.test(match[1])) {
        return undefined;
    }
    const items = [...match[1].matchAll(/(?:another\s+)?(?:\d+(?:\s+or\s+more)?\s+)?(?:"[^"]+"(?:\s+or\s+"[^"]+")*)\s+Category all(?:y|ies)/gi)]
        .map(item => item[0].trim());
    if (items.length < 2) {
        return undefined;
    }
    const residue = items.reduce((remaining, item) => remaining.replace(item, "#"), match[1]);
    if (!/^#(?:\s*(?:,|and|or)\s*#)+$/i.test(residue.trim())) {
        return undefined;
    }
    const children = items.map(item => parseAllyConditionClause(`${item} ${match[2]}`, sourceText));
    if (children.some(child => child === undefined)) {
        return undefined;
    }
    return { op: "any", children: children };
}
function parseMixedNameOrCategoryAllyCondition(text, sourceText) {
    const match = /^("[^"]+")\s+or\s+(another\s+.+? Category ally)\s+(?:is\s+)?(on the team|attacking in the same turn)$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const names = parseQuotedValues(match[1]);
    const scope = /^on the team$/i.test(match[3]) ? "team" : "rotation";
    const category = parseAllyConditionClause(`${match[2]} ${match[3]}`, sourceText);
    if (names?.values.length !== 1 || !category) {
        return undefined;
    }
    const name = predicateExpression({
        kind: "ally_name_present",
        scope,
        selfInclusion: "included",
        names: names.values,
        nameMatch: "exact",
        sourceText,
    });
    return { op: "any", children: [name, category] };
}
function parseHpWithAllyCondition(text, sourceText) {
    const match = /^(HP is .+?)\s+with\s+(.+? all(?:y|ies)(?: .+?)? (?:on the team|attacking in the same turn))$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const hp = parseExactHpCondition(match[1], sourceText);
    const ally = parseAllyConditionClause(match[2], sourceText);
    return hp && ally ? { op: "all", children: [hp, ally] } : undefined;
}
function parseCommaSeparatedConditionAlternatives(text) {
    if (!/,\s*or\s+when\b/i.test(text) || !/,\s*when\b/i.test(text)) {
        return undefined;
    }
    const parts = text.split(/,\s*(?:or\s+)?when\s+/i).map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) {
        return undefined;
    }
    const children = parts.map(parseBooleanCondition);
    return children.some(child => child.op === "unknown")
        ? undefined
        : { op: "any", children };
}
function parseNextTurnOrTeamAlternative(text, sourceText) {
    const normalizedText = text.replace(/’/g, "'");
    if (!normalizedText.toLowerCase().startsWith("on the character's next attacking turn after ")) {
        return undefined;
    }
    const separator = /,\s+or when\s+/i.exec(normalizedText);
    if (!separator || separator.index === undefined) {
        return undefined;
    }
    const nextTurnText = normalizedText.slice(0, separator.index).trim();
    const teamAndTemporal = normalizedText.slice(separator.index + separator[0].length).trim();
    const temporalMatch = /(starting from the \d+(?:st|nd|rd|th) turn from (?:the start of battle|the character's entry turn))$/i.exec(teamAndTemporal);
    if (!temporalMatch || temporalMatch.index === undefined) {
        return undefined;
    }
    const allyText = teamAndTemporal.slice(0, temporalMatch.index).trim();
    const nextTurn = parseNextAttackingTurnCondition(nextTurnText, sourceText);
    const ally = parseAllyConditionClause(allyText, sourceText);
    const temporal = parseExactTemporalCondition(temporalMatch[1], sourceText);
    return nextTurn && ally && temporal
        ? { op: "any", children: [nextTurn, { op: "all", children: [ally, temporal] }] }
        : undefined;
}
function parseScopedCategoryAlternativesWithTemporal(text, sourceText) {
    const match = /^(.*?)(there are\s+.+? Category allies(?:,\s*.+? Category allies)*\s+or\s+.+? Category allies attacking in the same turn)\s+(starting from the \d+(?:st|nd|rd|th) turn from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const categories = parseSharedScopeCategoryAllyAlternatives(match[2], sourceText);
    const temporal = parseExactTemporalCondition(match[3], sourceText);
    if (!categories || !temporal) {
        return undefined;
    }
    const children = [];
    const prefix = match[1].replace(/\s+and\s+$/i, "").trim();
    if (prefix) {
        const prefixCondition = parseBooleanCondition(prefix);
        if (prefixCondition.op === "unknown") {
            return undefined;
        }
        children.push(prefixCondition);
    }
    children.push(categories, temporal);
    return { op: "all", children };
}
function parseSingleEnemyHpAlternative(text, sourceText) {
    const match = /^facing only 1 enemy and that enemy['â€™]s HP is (\d+)% or (more|less),?\s+or when (there is .+ Category enemy)$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const enemyCount = parseEnemyCountCondition("facing only 1 enemy", sourceText);
    const enemyHp = parseEnemyHpCondition(`that enemy's HP is ${match[1]}% or ${match[2]}`, sourceText);
    const alternative = parseExactEnemyCondition(match[3], sourceText);
    return enemyCount && enemyHp && alternative
        ? { op: "any", children: [{ op: "all", children: [enemyCount, enemyHp] }, alternative] }
        : undefined;
}
function parseNameEnemyOrTeamAlternative(text, sourceText) {
    const includes = /^there is an (enemy or an ally|ally or an enemy) whose name includes\s+(.+)$/i.exec(text);
    if (includes) {
        const enemy = buildEnemyNameExpression(includes[2], "includes", "any_enemy", sourceText);
        const ally = parseAllyConditionClause(`an ally whose name includes ${includes[2]} on the team`, sourceText);
        if (enemy && ally) {
            return { op: "any", children: [enemy, ally] };
        }
    }
    const rotationAllyOrEnemy = /^the name of an ally who is attacking in the same turn or an enemy includes\s+(.+)$/i.exec(text);
    if (rotationAllyOrEnemy) {
        const selector = parseNameSelectorValues(rotationAllyOrEnemy[1]);
        const enemy = buildEnemyNameExpression(rotationAllyOrEnemy[1], "includes", "any_enemy", sourceText);
        const ally = selector
            ? combineQuotedPredicateExpressions(selector.included, value => predicateExpression({
                ...allyPredicate("name", value, "rotation", "included", undefined, undefined, sourceText).predicate,
                nameMatch: "includes",
                ...(selector.excluded ? {
                    excludedNames: selector.excluded.values,
                    excludedNameMatch: "includes",
                } : {}),
            }))
            : undefined;
        if (enemy && ally) {
            return { op: "any", children: [ally, enemy] };
        }
    }
    const match = /^(.*?)(?:(?:,\s*)?or when\s+)?("[^"]+") is an enemy or on the team$/i.exec(text);
    if (!match)
        return undefined;
    const names = parseQuotedValues(match[2]);
    if (names?.values.length !== 1)
        return undefined;
    const name = names.values[0];
    const alternatives = [
        predicateExpression({
            kind: "enemy_name",
            scope: "enemy",
            enemySelection: "any_enemy",
            names: [name],
            nameMatch: "exact",
            sourceText,
        }),
        predicateExpression({
            kind: "ally_name_present",
            scope: "team",
            selfInclusion: "included",
            names: [name],
            nameMatch: "exact",
            sourceText,
        }),
    ];
    const prefix = match[1].replace(/,\s*$/, "").trim();
    if (prefix) {
        const prefixCondition = parseBooleanCondition(prefix);
        if (prefixCondition.op === "unknown")
            return undefined;
        alternatives.unshift(prefixCondition);
    }
    return { op: "any", children: alternatives };
}
function parseExactConditionClause(text, sourceText) {
    const entrance = parseEntranceAnimationCondition(text, sourceText);
    if (entrance) {
        return entrance;
    }
    const perTurnConditional = /^At the start of each turn when (.+)$/i.exec(text);
    if (perTurnConditional) {
        const condition = parseBooleanCondition(perTurnConditional[1]);
        if (condition.op !== "unknown") {
            return rewriteConditionSourceText(condition, sourceText);
        }
    }
    const nextAttackingTurn = parseNextAttackingTurnCondition(text, sourceText);
    if (nextAttackingTurn) {
        return nextAttackingTurn;
    }
    const whileObtainingKiSphere = /^(.*?)\s+when the character obtains a Ki Sphere$/i.exec(text);
    if (whileObtainingKiSphere) {
        const base = parseBooleanCondition(whileObtainingKiSphere[1]);
        if (base.op !== "unknown") {
            return mapConditionPredicates(rewriteConditionSourceText(base, sourceText), predicate => ENEMY_PREDICATE_KINDS.has(predicate.kind)
                ? { ...predicate, evaluationMoment: "when_obtaining_ki_sphere" }
                : predicate);
        }
    }
    if (/^activating the Active Skill$/i.test(text)) {
        return predicateExpression({
            kind: "active_skill_used",
            scope: "self",
            sourceText,
        });
    }
    const runtimeFlag = parseExactRuntimeFlagCondition(text, sourceText);
    if (runtimeFlag) {
        return runtimeFlag;
    }
    const receivingAttackWithKi = parseReceivingAttackWithKiCondition(text, sourceText);
    if (receivingAttackWithKi) {
        return receivingAttackWithKi;
    }
    const receivingAttackWithKiSpheres = parseReceivingAttackWithKiSpheresCondition(text, sourceText);
    if (receivingAttackWithKiSpheres) {
        return receivingAttackWithKiSpheres;
    }
    const incomingFromMarkedEnemy = /^receiving an? (?:(Ki Blast|Unarmed|Physical) )?(?:Super Attack|attack) from an enemy who is hit by the character's (?:Super Attack|Ultra Super Attack|Unit Super Attack|Ultra Super Attack or Unit Super Attack)$/i.exec(text);
    if (incomingFromMarkedEnemy) {
        const incomingText = incomingFromMarkedEnemy[1]
            ? `${incomingFromMarkedEnemy[1]} Super Attack`
            : "receiving an attack";
        return predicateExpression({
            kind: "incoming_attack_from_enemy_hit_by_self_super_attack",
            scope: "self",
            combatEvent: combatEventDescriptor(combatEventIdentity(incomingText, "targeted"), "current_event", "during_event", {
                relativeTimingSource: "explicit_text",
                modeSource: "explicit_text",
            }),
            sourceText,
        });
    }
    const kiSphereCollectionOrder = parseKiSphereCollectionOrderCondition(text, sourceText);
    if (kiSphereCollectionOrder) {
        return kiSphereCollectionOrder;
    }
    const combatEvent = parseExactCombatEventCondition(text, sourceText);
    if (combatEvent) {
        return combatEvent;
    }
    const ki = parseExactKiCondition(text, sourceText);
    if (ki) {
        return ki;
    }
    const enemy = parseExactEnemyCondition(text, sourceText);
    if (enemy) {
        return enemy;
    }
    const hp = parseExactHpCondition(text, sourceText);
    if (hp) {
        return hp;
    }
    const temporal = parseExactTemporalCondition(text, sourceText);
    if (temporal) {
        return temporal;
    }
    const slot = parseExactSlotCondition(text, sourceText);
    if (slot) {
        return slot;
    }
    const allRotationKiSphere = parseAllRotationKiSphereCondition(text, sourceText);
    if (allRotationKiSphere) {
        return allRotationKiSphere;
    }
    const allRotationCategory = /^all allies attacking in the same turn are (.+?) Category characters?$/i.exec(text);
    if (allRotationCategory) {
        const categoryValues = parseQuotedValues(allRotationCategory[1]);
        if (categoryValues) {
            return predicateExpression({
                kind: "all_rotation_allies_category",
                scope: "rotation",
                selfInclusion: "included",
                categories: categoryValues.values,
                sourceText,
            });
        }
    }
    const allRotationClass = /^all allies attacking in the same turn are (Super|Extreme) Class characters?$/i.exec(text);
    if (allRotationClass) {
        return predicateExpression({
            kind: "all_rotation_allies_class",
            scope: "rotation",
            selfInclusion: "included",
            classes: [normalizeClass(allRotationClass[1])],
            sourceText,
        });
    }
    const allTeamCategoryClass = /^all allies are (Super|Extreme) Class (.+?) Category characters?$/i.exec(text);
    if (allTeamCategoryClass) {
        const categories = parseQuotedValues(allTeamCategoryClass[2]);
        if (categories?.values.length === 1) {
            return predicateExpression({
                kind: "ally_category_class_present",
                scope: "team",
                selfInclusion: "included",
                comparator: "eq",
                count: 7,
                categories: categories.values,
                classes: [normalizeClass(allTeamCategoryClass[1])],
                sourceText,
            });
        }
    }
    const allTeamCategoryOrClass = /^all allies are (.+?) Category characters? or (Super|Extreme) Class characters?$/i.exec(text)
        ?? /^all allies are (Super|Extreme) Class characters? or (.+?) Category characters?$/i.exec(text);
    if (allTeamCategoryOrClass) {
        const categorySource = allTeamCategoryOrClass[1]?.toLowerCase() === "super"
            || allTeamCategoryOrClass[1]?.toLowerCase() === "extreme"
            ? allTeamCategoryOrClass[2]
            : allTeamCategoryOrClass[1];
        const classSource = allTeamCategoryOrClass[1]?.toLowerCase() === "super"
            || allTeamCategoryOrClass[1]?.toLowerCase() === "extreme"
            ? allTeamCategoryOrClass[1]
            : allTeamCategoryOrClass[2];
        const categories = parseQuotedValues(categorySource);
        if (categories && categories.connector !== "and" && /^(?:Super|Extreme)$/i.test(classSource)) {
            return predicateExpression({
                kind: "ally_category_or_class_present",
                scope: "team",
                selfInclusion: "included",
                comparator: "eq",
                count: 7,
                categories: categories.values,
                classes: [normalizeClass(classSource)],
                sourceText,
            });
        }
    }
    const allTeamClass = /^all allies are (Super|Extreme) Class characters?$/i.exec(text);
    if (allTeamClass) {
        return predicateExpression({
            kind: "team_class_count",
            scope: "team",
            selfInclusion: "included",
            comparator: "eq",
            count: 7,
            classes: [normalizeClass(allTeamClass[1])],
            sourceText,
        });
    }
    const allTeamCategory = /^all allies are (.+?) Category characters?$/i.exec(text);
    if (allTeamCategory) {
        const categories = parseQuotedValues(allTeamCategory[1]);
        if (categories && categories.connector !== "and") {
            return predicateExpression({
                kind: "team_category_count",
                scope: "team",
                selfInclusion: "included",
                comparator: "eq",
                count: 7,
                categories: categories.values,
                sourceText,
            });
        }
    }
    const soleTeamCategory = /^the character is the only (.+?) Category character on the team$/i.exec(text);
    if (soleTeamCategory) {
        const categories = parseQuotedValues(soleTeamCategory[1]);
        if (categories?.values.length === 1) {
            return {
                op: "all",
                children: [
                    predicateExpression({
                        kind: "character_category",
                        scope: "self",
                        categories: categories.values,
                        sourceText,
                    }),
                    predicateExpression({
                        kind: "team_category_count",
                        scope: "team",
                        selfInclusion: "included",
                        comparator: "eq",
                        count: 1,
                        categories: categories.values,
                        sourceText,
                    }),
                ],
            };
        }
    }
    const allFiveClassTypes = /^the team includes all five (Super|Extreme) Types$/i.exec(text);
    if (allFiveClassTypes) {
        const className = normalizeClass(allFiveClassTypes[1]);
        return {
            op: "all",
            children: TEAM_ANALYSIS_TYPES.map(type => predicateExpression({
                kind: "ally_class_type_present",
                scope: "team",
                selfInclusion: "included",
                classes: [className],
                types: [type],
                sourceText,
            })),
        };
    }
    if (/^(?:the team includes all five Types|all five Types are represented on the team)$/i.test(text)) {
        return {
            op: "all",
            children: TEAM_ANALYSIS_TYPES.map(type => predicateExpression({
                kind: "ally_type_present",
                scope: "team",
                selfInclusion: "included",
                types: [type],
                sourceText,
            })),
        };
    }
    const selfClass = /^(?:the|this) character is (Super|Extreme) Class$/i.exec(text);
    if (selfClass) {
        return predicateExpression({
            kind: "character_class",
            scope: "self",
            classes: [normalizeClass(selfClass[1])],
            sourceText,
        });
    }
    const selfType = /^(?:the|this) character is (AGL|TEQ|INT|STR|PHY) Type$/i.exec(text);
    if (selfType) {
        return predicateExpression({
            kind: "character_type",
            scope: "self",
            types: [normalizeType(selfType[1])],
            sourceText,
        });
    }
    const onlyTypeInRotation = /^(?:the|this) character is the only (AGL|TEQ|INT|STR|PHY) Type ally attacking in the (?:same )?turn$/i.exec(text);
    if (onlyTypeInRotation) {
        const type = normalizeType(onlyTypeInRotation[1]);
        return {
            op: "all",
            children: [
                predicateExpression({
                    kind: "character_type",
                    scope: "self",
                    types: [type],
                    sourceText,
                }),
                {
                    op: "not",
                    child: allyPredicate("type", type, "rotation", "excluded", undefined, undefined, sourceText),
                },
            ],
        };
    }
    const namedAlly = parseExactNamedAllyCondition(text, sourceText);
    if (namedAlly) {
        return namedAlly;
    }
    return parseAllyConditionClause(text, sourceText);
}
function parseAllRotationKiSphereCondition(text, sourceText) {
    if (!/^(?:When )?all allies attacking in the same turn have obtained a Ki Sphere$/i.test(text)) {
        return undefined;
    }
    return predicateExpression({
        kind: "all_rotation_allies_obtained_ki_sphere",
        scope: "rotation",
        selfInclusion: "included",
        evaluationMoment: "when_obtaining_ki_sphere",
        sourceText,
    });
}
function parseNextAttackingTurnCondition(text, sourceText) {
    const normalizedText = text.replace(/’/g, "'");
    const timed = /^(On|At the start of|Starting from) (?:the )?(?:character's )?next attacking turn(?: after (.+))?$/i.exec(normalizedText);
    if (!timed) {
        return undefined;
    }
    const relativeTiming = /^Starting from$/i.test(timed[1]) ? "starting_next_attacking_turn" : "on_next_attacking_turn";
    if (!timed[2]) {
        return predicateExpression({
            kind: "next_attacking_turn",
            scope: "self",
            evaluationMoment: relativeTiming,
            sourceText,
        });
    }
    const eventCondition = parseNextAttackingTurnEvent(timed[2], sourceText);
    if (!eventCondition) {
        return undefined;
    }
    return mapConditionPredicates(eventCondition, predicate => predicate.combatEvent
        ? {
            ...predicate,
            sourceText,
            combatEvent: {
                ...predicate.combatEvent,
                relativeTiming,
                provenance: {
                    ...predicate.combatEvent.provenance,
                    relativeTiming: "explicit_text",
                },
            },
        }
        : predicate);
}
function parseNextAttackingTurnEvent(sourceBody, sourceText) {
    const combined = /^(?:the character )?(?:performs?|performing) (\d+)(?: or more)? ((?:Super\s+)?attack(?:s|\(s\))) and (?:the character )?(?:receives?|receiving) (\d+)(?: or more)? ((?:Super\s+)?attack(?:s|\(s\))) in battle$/i.exec(sourceBody);
    if (combined) {
        const performed = combatEventIdentity(combined[2], "performed");
        const received = combatEventIdentity(combined[4], "landed");
        return {
            op: "all",
            children: [
                combatPredicate(performed, combatEventDescriptor(performed, "accumulated_count", "after_event", {
                    countScope: "battle",
                    countScopeSource: "explicit_text",
                }), sourceText, "gte", Number(combined[1])),
                combatPredicate(received, combatEventDescriptor(received, "accumulated_count", "after_event", {
                    countScope: "battle",
                    countScopeSource: "explicit_text",
                }), sourceText, "gte", Number(combined[3])),
            ],
        };
    }
    const shared = /^the character performs (\d+)(?: or more)? attack(?:s|\(s\)) or receives (\d+)(?: or more)? attack(?:s|\(s\)) in battle$/i.exec(sourceBody);
    if (shared) {
        const performed = combatEventIdentity("attack", "performed");
        const received = combatEventIdentity("attack", "landed");
        return {
            op: "any",
            children: [
                combatPredicate(performed, combatEventDescriptor(performed, "accumulated_count", "after_event", {
                    countScope: "battle",
                    countScopeSource: "explicit_text",
                }), sourceText, "gte", Number(shared[1])),
                combatPredicate(received, combatEventDescriptor(received, "accumulated_count", "after_event", {
                    countScope: "battle",
                    countScopeSource: "explicit_text",
                }), sourceText, "gte", Number(shared[2])),
            ],
        };
    }
    let normalized = sourceBody
        .replace(/^the character performs\s+/i, "performing ")
        .replace(/^the character receives\s+/i, "receiving ")
        .replace(/^the character evades\s+/i, "evading ");
    if (/^(?:performing|receiving|evading) \d+(?: or more)? .+attack(?:s|\(s\))$/i.test(normalized)) {
        normalized += " in battle";
    }
    const condition = parseBooleanCondition(normalized);
    return condition.op !== "unknown" && collectCombatPredicates(condition).length > 0
        ? rewriteConditionSourceText(condition, sourceText)
        : undefined;
}
function parseExactNamedAllyCondition(text, sourceText) {
    const rotation = /^(?:your team has )?(.+?)(?: is)? attacking in the same turn$/i.exec(text);
    const team = /^(.+?) is on the team$/i.exec(text);
    const match = rotation ?? team;
    if (!match) {
        return undefined;
    }
    const names = parseQuotedValues(match[1]);
    if (!names) {
        return undefined;
    }
    const scope = rotation ? "rotation" : "team";
    return combineQuotedPredicateExpressions(names, name => {
        const expression = allyPredicate("name", name, scope, "included", undefined, undefined, sourceText);
        return predicateExpression({ ...expression.predicate, nameMatch: "exact" });
    });
}
function parseExactRuntimeFlagCondition(text, sourceText) {
    const guard = /^After guard is activated(?: (\d+) times? in battle)?$/i.exec(text);
    if (guard) {
        const count = guard[1] ? Number(guard[1]) : undefined;
        if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
            return undefined;
        }
        return predicateExpression({
            kind: "guard_activated",
            scope: "self",
            ...(count !== undefined ? { comparator: "gte", value: count } : {}),
            sourceText,
        });
    }
    if (/^After the character's Revival Skill is activated$/i.test(text)) {
        return predicateExpression({
            kind: "revive_triggered",
            scope: "self",
            sourceText,
        });
    }
    if (/^After the character's or an ally's Revival Skill is activated$/i.test(text)) {
        return predicateExpression({
            kind: "revive_triggered",
            scope: "team",
            selfInclusion: "included",
            sourceText,
        });
    }
    if (/^After an ally's Revival Skill is activated$/i.test(text)) {
        return predicateExpression({
            kind: "revive_triggered",
            scope: "team",
            selfInclusion: "excluded",
            sourceText,
        });
    }
    if (/^At the end of the turn in which the character's Revival Skill is activated$/i.test(text)) {
        return predicateExpression({
            kind: "revive_triggered",
            scope: "self",
            evaluationMoment: "end_of_turn",
            sourceText,
        });
    }
    const finish = /^(?:the )?Finish Effect is (not )?activated$/i.exec(text);
    if (finish) {
        const activated = predicateExpression({
            kind: "finish_effect_activated",
            scope: "self",
            sourceText,
        });
        return finish[1] ? { op: "not", child: activated } : activated;
    }
    const domain = /^(?:the )?Domain "([^"]+)" is active$/i.exec(text);
    if (domain) {
        return predicateExpression({
            kind: "domain_active",
            scope: "battle",
            domainNames: [domain[1]],
            sourceText,
        });
    }
    if (/^(?:the )?character is KO'd$/i.test(text)) {
        return predicateExpression({
            kind: "character_ko",
            scope: "self",
            sourceText,
        });
    }
    if (/^(?:When )?Giant Ape Transformation ends$/i.test(text)) {
        return predicateExpression({
            kind: "giant_form_ended",
            scope: "self",
            sourceText,
        });
    }
    return undefined;
}
function parseReceivingAttackWithKiCondition(text, sourceText) {
    const match = /^receiving an? attack with (?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))? Ki$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const value = Number(match[2]);
    if (!isKiAmount(value)) {
        return undefined;
    }
    const comparator = /^at least$/i.test(match[1] ?? "") || /^more$/i.test(match[3] ?? "")
        ? "gte"
        : /^at most$/i.test(match[1] ?? "") || /^less$/i.test(match[3] ?? "")
            ? "lte"
            : "eq";
    const incomingAttack = parseExactCombatEventCondition("receiving an attack", sourceText);
    if (!incomingAttack) {
        return undefined;
    }
    return {
        op: "all",
        children: [
            incomingAttack,
            kiAmountPredicate(comparator, value, "when_targeted_by_attack", sourceText),
        ],
    };
}
function parseReceivingAttackWithKiSpheresCondition(text, sourceText) {
    const match = /^receiving an? attack\s+(.+ Ki Spheres? obtained)$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const incomingAttack = parseExactCombatEventCondition("receiving an attack", sourceText);
    const kiSpheres = parseExactKiCondition(match[1], sourceText);
    if (!incomingAttack || !kiSpheres) {
        return undefined;
    }
    return {
        op: "all",
        children: [incomingAttack, kiSpheres],
    };
}
function parseKiSphereCollectionOrderCondition(text, sourceText) {
    const pattern = new RegExp(`^(?:the|this) character is the\\s+(${SLOT_LIST_PATTERN})\\s+to obtain Ki Spheres in a turn$`, "i");
    const match = pattern.exec(text);
    if (!match) {
        return undefined;
    }
    return predicateExpression({
        kind: "ki_sphere_collection_order",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText,
    });
}
function parseEntranceAnimationCondition(text, sourceText) {
    if (/^Activates the Entrance Animation upon the character's entry$/i.test(text)) {
        return { op: "always" };
    }
    const entrance = /^Activates the Entrance Animation when (.+?)(?: upon the character's entry)?$/i.exec(text);
    if (!entrance) {
        return undefined;
    }
    const categoryEnemyOrRotationAlly = /^(?:there is )?a?\s*(.+?) Category enemy or another (.+?) Category ally at the start of the character's attacking turn$/i.exec(entrance[1]);
    if (categoryEnemyOrRotationAlly) {
        const enemyCategories = parseQuotedValues(categoryEnemyOrRotationAlly[1]);
        const allyCategories = parseQuotedValues(categoryEnemyOrRotationAlly[2]);
        if (enemyCategories?.values.length === 1 && allyCategories?.values.length === 1) {
            return {
                op: "any",
                children: [
                    predicateExpression({
                        kind: "enemy_category",
                        scope: "enemy",
                        categories: enemyCategories.values,
                        enemySelection: "any_enemy",
                        sourceText,
                    }),
                    predicateExpression({
                        kind: "rotation_partner_category",
                        scope: "rotation",
                        selfInclusion: "excluded",
                        categories: allyCategories.values,
                        sourceText,
                    }),
                ],
            };
        }
    }
    const condition = parseBooleanCondition(entrance[1].replace(/\s+at the start of the character's attacking turn/gi, ""));
    return condition.op === "unknown" ? undefined : rewriteConditionSourceText(condition, sourceText);
}
function isCombatEventLanguage(sourceText) {
    return /\b(?:attacks?|Super Attacks?|evad(?:e|ed|ing)|final blow)\b/i.test(sourceText);
}
function combatEventIdentity(sourceText, direction) {
    if (direction === "final_blow") {
        return {
            eventType: "final_blow_delivered",
            actor: "self",
            attackKind: "unknown",
            predicateKind: "final_blow_delivered",
            actorSource: "explicit_text",
            attackKindSource: "unresolved",
        };
    }
    const superAttack = /\b(?:Super|Ultra Super) Attacks?\b/i.test(sourceText);
    const normalAttack = /\bnormal attacks?\b/i.test(sourceText);
    const attackStyle = /\bKi Blast Super Attack\b/i.test(sourceText)
        ? "ki_blast"
        : /\bUnarmed Super Attack\b/i.test(sourceText)
            ? "unarmed"
            : /\bPhysical Super Attack\b/i.test(sourceText)
                ? "physical"
                : superAttack
                    ? "unknown"
                    : undefined;
    const eventType = direction === "performed"
        ? "attack_performed"
        : direction === "targeted"
            ? "incoming_attack"
            : direction === "landed"
                ? "attack_landed"
                : "attack_evaded";
    const predicateKind = direction === "performed"
        ? superAttack ? "super_attacks_performed" : "attacks_performed"
        : direction === "targeted"
            ? superAttack ? "incoming_super_attack" : "incoming_attack"
            : direction === "landed"
                ? superAttack ? "super_attack_received" : "attacks_received"
                : "attacks_evaded";
    return {
        eventType,
        actor: direction === "performed" ? "self" : "enemy",
        attackKind: superAttack ? "super_attack" : normalAttack ? "normal_attack" : "unknown",
        ...(attackStyle ? { attackStyle } : {}),
        predicateKind,
        actorSource: "documented_domain_rule",
        attackKindSource: superAttack || normalAttack ? "explicit_text" : "unresolved",
        ...(attackStyle ? { attackStyleSource: attackStyle === "unknown" ? "unresolved" : "explicit_text" } : {}),
    };
}
function combatEventDescriptor(identity, mode, relativeTiming, options) {
    return {
        eventType: identity.eventType,
        actor: identity.actor,
        attackKind: identity.attackKind,
        ...(identity.attackStyle ? { attackStyle: identity.attackStyle } : {}),
        mode,
        ...(options?.countScope ? { countScope: options.countScope } : {}),
        relativeTiming,
        provenance: {
            eventType: "explicit_text",
            actor: identity.actorSource,
            attackKind: identity.attackKindSource,
            ...(identity.attackStyleSource ? { attackStyle: identity.attackStyleSource } : {}),
            mode: options?.modeSource ?? "explicit_text",
            ...(options?.countScopeSource ? { countScope: options.countScopeSource } : {}),
            relativeTiming: options?.relativeTimingSource ?? "explicit_text",
        },
    };
}
function combatPredicate(identity, descriptor, sourceText, comparator, value) {
    return predicateExpression({
        kind: identity.predicateKind,
        scope: "self",
        ...(comparator ? { comparator } : {}),
        ...(value !== undefined ? { value } : {}),
        combatEvent: descriptor,
        sourceText,
    });
}
function parseCombatCountScope(sourceText) {
    if (/\b(?:within|in) (?:the )?(?:current )?turn\b/i.test(sourceText)) {
        return { countScope: "current_turn", source: "explicit_text" };
    }
    if (/\b(?:in|throughout) (?:the )?battle\b/i.test(sourceText)) {
        return { countScope: "battle", source: "explicit_text" };
    }
    return { countScope: "unknown", source: "unresolved" };
}
function parseExactCombatEventCondition(text, sourceText) {
    if (/^At the end of the turn in which a final blow is delivered$/i.test(text)) {
        const identity = combatEventIdentity("final blow", "final_blow");
        return combatPredicate(identity, combatEventDescriptor(identity, "current_event", "after_event"), sourceText);
    }
    if (/^Before evading an? attack within the turn$/i.test(text)) {
        const identity = combatEventIdentity("attack", "targeted");
        return combatPredicate(identity, combatEventDescriptor(identity, "current_event", "before_event"), sourceText);
    }
    const firstEvent = /^(?:When )?(attacking|receiving an? attack) for the 1st time(?: (within the turn|in battle))?$/i.exec(text);
    if (firstEvent) {
        const direction = /^attacking$/i.test(firstEvent[1]) ? "performed" : "landed";
        const identity = combatEventIdentity("attack", direction);
        const countScope = /^within the turn$/i.test(firstEvent[2] ?? "")
            ? "current_turn"
            : "battle";
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "during_event", {
            countScope,
            countScopeSource: firstEvent[2] ? "explicit_text" : "documented_domain_rule",
        }), sourceText, "eq", 1);
    }
    const ordinalPerformed = /^(?:When )?the character performs the (\d+)(?:st|nd|rd|th) attack in battle$/i.exec(text);
    if (ordinalPerformed) {
        const value = Number(ordinalPerformed[1]);
        if (!Number.isInteger(value) || value < 1)
            return undefined;
        const identity = combatEventIdentity("attack", "performed");
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "during_event", {
            countScope: "battle",
            countScopeSource: "explicit_text",
        }), sourceText, "eq", value);
    }
    const repeatedExact = /^Every time the character (performs|receives|evades) (\d+)(?: or more)? attack(?:s|\(s\)) in battle$/i.exec(text);
    if (repeatedExact) {
        const value = Number(repeatedExact[2]);
        if (!Number.isInteger(value) || value < 1) {
            return undefined;
        }
        const direction = /^performs$/i.test(repeatedExact[1])
            ? "performed"
            : /^receives$/i.test(repeatedExact[1])
                ? "landed"
                : "evaded";
        const identity = combatEventIdentity("attack", direction);
        return combatPredicate(identity, combatEventDescriptor(identity, "repeated_threshold", "after_event", {
            countScope: "battle",
            countScopeSource: "explicit_text",
        }), sourceText, "gte", value);
    }
    const completedCount = /^After (?:the character )?(?:performs?|performing) (\d+)(?: or more)? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?Attack(?:s|\(s\))) in battle$/i.exec(text);
    if (completedCount) {
        const value = Number(completedCount[1]);
        if (!Number.isInteger(value) || value < 1)
            return undefined;
        const identity = combatEventIdentity(completedCount[2], "performed");
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: "battle",
            countScopeSource: "explicit_text",
        }), sourceText, "gte", value);
    }
    const bareCount = /^(performing|receiving|evading) (\d+)(?: or more)? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack(?:s|\(s\))) in battle$/i.exec(text);
    if (bareCount) {
        const value = Number(bareCount[2]);
        if (!Number.isInteger(value) || value < 1)
            return undefined;
        const direction = /^performing$/i.test(bareCount[1])
            ? "performed"
            : /^receiving$/i.test(bareCount[1]) ? "landed" : "evaded";
        const identity = combatEventIdentity(bareCount[3], direction);
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: "battle",
            countScopeSource: "explicit_text",
        }), sourceText, "gte", value);
    }
    const repeatedPerformed = /^Every time the character performs (\d+) or more ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attacks?) ((?:in|throughout) (?:the )?battle)$/i.exec(text);
    if (repeatedPerformed) {
        const value = Number(repeatedPerformed[1]);
        if (!Number.isInteger(value) || value < 1) {
            return undefined;
        }
        const identity = combatEventIdentity(repeatedPerformed[2], "performed");
        const scope = parseCombatCountScope(repeatedPerformed[3]);
        return combatPredicate(identity, combatEventDescriptor(identity, "repeated_threshold", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        }), sourceText, "gte", value);
    }
    if (/^Every time the character is about to attack$/i.test(text)) {
        const identity = combatEventIdentity("attack", "performed");
        return combatPredicate(identity, combatEventDescriptor(identity, "current_event", "before_event"), sourceText);
    }
    if (/^Every time\b/i.test(text)) {
        return undefined;
    }
    if (/^after receiving or evading an? attack$/i.test(text)) {
        const received = combatEventIdentity("attack", "landed");
        const evaded = combatEventIdentity("attack", "evaded");
        return {
            op: "any",
            children: [received, evaded].map(identity => combatPredicate(identity, combatEventDescriptor(identity, "current_event", "after_event"), sourceText)),
        };
    }
    const interval = /^(?:after\s+)?(performing|receiving|evading)\s+between\s+(\d+)\s+and\s+(\d+)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack(?:s|\(s\)))\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (interval) {
        const lower = Number(interval[2]);
        const upper = Number(interval[3]);
        if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower < 0 || lower > upper) {
            return undefined;
        }
        const direction = /^performing$/i.test(interval[1]) ? "performed" : /^receiving$/i.test(interval[1]) ? "landed" : "evaded";
        const identity = combatEventIdentity(interval[4], direction);
        const scope = parseCombatCountScope(interval[5]);
        const descriptor = combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        });
        return {
            op: "all",
            children: [
                combatPredicate(identity, descriptor, sourceText, "gte", lower),
                combatPredicate(identity, descriptor, sourceText, "lte", upper),
            ],
        };
    }
    const counted = /^(after|before)\s+(performing|receiving|evading)\s+(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack(?:s|\(s\)))\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (counted) {
        const value = Number(counted[4]);
        if (!Number.isInteger(value) || value < 0) {
            return undefined;
        }
        const direction = /^performing$/i.test(counted[2]) ? "performed" : /^receiving$/i.test(counted[2]) ? "landed" : "evaded";
        const identity = combatEventIdentity(counted[6], direction);
        const scope = parseCombatCountScope(counted[7]);
        const comparator = counted[5]
            ? /^more$/i.test(counted[5]) ? "gte" : "lte"
            : /^at least$/i.test(counted[3] ?? "") ? "gte"
                : /^at most$/i.test(counted[3] ?? "") ? "lte"
                    : /^exactly$/i.test(counted[3] ?? "") ? "eq"
                        : /^before$/i.test(counted[1]) ? "lt" : "gte";
        // "Before receiving N attacks" is a comparator over already resolved
        // history (count < N), not proof that a landed outcome exists before
        // resolution. Completed event counters therefore remain after-event.
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        }), sourceText, comparator, value);
    }
    const currentPatterns = [
        { pattern: /^(?:when )?(?:attacking|performing an? attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^before (?:attacking|performing an? attack)$/i, direction: "performed", timing: "before_event" },
        { pattern: /^after (?:attacking|performing an? attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^after performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?receiving an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal|Super) attack)$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^after the enemy launches an? (Super Attack) at the character$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^(?:receiving|when receiving) an? attack$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^before receiving an? attack(?: within the turn)?$/i, direction: "targeted", timing: "before_event" },
        { pattern: /^after (?:receiving|being hit by) an? attack$/i, direction: "landed", timing: "after_event" },
        { pattern: /^(?:when )?evading an? attack$/i, direction: "evaded", timing: "during_event" },
        { pattern: /^after evading an? attack$/i, direction: "evaded", timing: "after_event" },
        { pattern: /^after delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "after_event" },
        { pattern: /^(?:when )?delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "during_event" },
    ];
    for (const candidate of currentPatterns) {
        const match = candidate.pattern.exec(text);
        if (!match) {
            continue;
        }
        const identity = combatEventIdentity(match[1] ?? text, candidate.direction);
        return combatPredicate(identity, combatEventDescriptor(identity, "current_event", candidate.timing), sourceText);
    }
    return undefined;
}
function parseExactKiCondition(text, sourceText) {
    const currentAmount = /^(?:the character's )?Ki is (?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?$/i.exec(text);
    if (currentAmount) {
        const value = Number(currentAmount[2]);
        if (!isKiAmount(value)) {
            return undefined;
        }
        const comparator = /^at least$/i.test(currentAmount[1] ?? "") || /^more$/i.test(currentAmount[3] ?? "")
            ? "gte"
            : /^at most$/i.test(currentAmount[1] ?? "") || /^less$/i.test(currentAmount[3] ?? "")
                ? "lte"
                : "eq";
        return kiAmountPredicate(comparator, value, "when_attacking", sourceText);
    }
    const interval = /^(?:attacking|before attacking) with (?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+) Ki$/i.exec(text);
    if (interval) {
        const lower = Number(interval[1]);
        const upper = Number(interval[2]);
        if (!isKiAmount(lower) || !isKiAmount(upper) || lower > upper) {
            return undefined;
        }
        const evaluationMoment = /^before attacking/i.test(text)
            ? "before_attack"
            : "when_attacking";
        return {
            op: "all",
            children: [
                kiAmountPredicate("gte", lower, evaluationMoment, sourceText),
                kiAmountPredicate("lte", upper, evaluationMoment, sourceText),
            ],
        };
    }
    const amount = /^(attacking with|before attacking with|after attacking with|with) (?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))? Ki$/i.exec(text);
    if (amount) {
        const value = Number(amount[3]);
        if (!isKiAmount(value)) {
            return undefined;
        }
        const comparator = /^at least$/i.test(amount[2] ?? "") || /^more$/i.test(amount[4] ?? "")
            ? "gte"
            : /^at most$/i.test(amount[2] ?? "") || /^less$/i.test(amount[4] ?? "")
                ? "lte"
                : "eq";
        return kiAmountPredicate(comparator, value, /^before attacking with$/i.test(amount[1]) ? "before_attack" : "when_attacking", sourceText);
    }
    const sphereInterval = /^(?:attacking with\s+|with\s+)?(?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+)\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereInterval) {
        const lower = Number(sphereInterval[1]);
        const upper = Number(sphereInterval[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereInterval[3]);
        if (!isKiSphereCount(lower) || !isKiSphereCount(upper) || lower > upper || !kiSphereTypes) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                kiSphereCountPredicate("gte", lower, kiSphereTypes, sourceText),
                kiSphereCountPredicate("lte", upper, kiSphereTypes, sourceText),
            ],
        };
    }
    const sphereCount = /^(?:attacking with\s+|with\s+)?(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereCount) {
        const value = Number(sphereCount[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereCount[4]);
        if (!isKiSphereCount(value) || !kiSphereTypes) {
            return undefined;
        }
        const comparator = /^at least$/i.test(sphereCount[1] ?? "") || /^more$/i.test(sphereCount[3] ?? "")
            ? "gte"
            : /^at most$/i.test(sphereCount[1] ?? "") || /^less$/i.test(sphereCount[3] ?? "")
                ? "lte"
                : "eq";
        return kiSphereCountPredicate(comparator, value, kiSphereTypes, sourceText);
    }
    const excludedTypePresence = /^With\s+an?\s*Type Ki Sphere obtained \((AGL|TEQ|INT|STR|PHY) excluded\)$/i.exec(text);
    if (excludedTypePresence) {
        const excluded = normalizeType(excludedTypePresence[1]);
        return {
            op: "any",
            children: TEAM_ANALYSIS_TYPES
                .filter(type => type !== excluded)
                .map(type => predicateExpression({
                kind: "ki_sphere_type_obtained",
                scope: "self",
                comparator: "gte",
                value: 1,
                kiSphereTypes: [type],
                kiContext: "collected_ki_spheres",
                sourceText,
            })),
        };
    }
    const spherePresence = /^With\s+an?\s*(.*?)\s*Ki Sphere obtained$/i.exec(text);
    if (spherePresence) {
        const kiSphereTypes = parseKiSphereTypes(spherePresence[1]);
        if (kiSphereTypes) {
            return predicateExpression({
                kind: "ki_sphere_type_obtained",
                scope: "self",
                comparator: "gte",
                value: 1,
                kiSphereTypes,
                kiContext: "collected_ki_spheres",
                sourceText,
            });
        }
    }
    return undefined;
}
function kiAmountPredicate(comparator, value, evaluationMoment, sourceText) {
    return predicateExpression({
        kind: "ki_amount",
        scope: "self",
        comparator,
        value,
        evaluationMoment,
        kiContext: "final_attack_ki",
        sourceText,
    });
}
function kiSphereCountPredicate(comparator, value, kiSphereTypes, sourceText) {
    return predicateExpression({
        kind: "ki_spheres_obtained",
        scope: "self",
        comparator,
        value,
        kiSphereTypes,
        kiContext: "collected_ki_spheres",
        sourceText,
    });
}
function isKiAmount(value) {
    return Number.isInteger(value) && value >= 0 && value <= 24;
}
function isKiSphereCount(value) {
    return Number.isInteger(value) && value >= 0;
}
function parseExactEnemyCondition(text, sourceText) {
    const exact = parseEnemyCountCondition(text, sourceText)
        ?? parseEnemyHpCondition(text, sourceText)
        ?? parseEnemyStatusCondition(text, sourceText)
        ?? parseEnemyNameCondition(text, sourceText)
        ?? parseEnemyAttributeCondition(text, sourceText);
    if (exact) {
        return exact;
    }
    const qualifiedStatus = /^(.*?)\s+if\s+((?:the )?(?:target|attacked|selected) enemy is in the following status:\s*.+)$/i.exec(text);
    if (qualifiedStatus) {
        const status = parseEnemyStatusCondition(qualifiedStatus[2], sourceText);
        if (status) {
            return {
                op: "all",
                children: [
                    { op: "unknown", sourceText: qualifiedStatus[1].trim() },
                    status,
                ],
            };
        }
    }
    const missingStatusWithHp = /^((?:the )?(?:target|attacked|selected) enemy is in the following status:)\s+HP is\s+(.+?)(\s*,.*)?$/i.exec(text);
    if (missingStatusWithHp) {
        const hp = parseEnemyHpComparison(missingStatusWithHp[2], sourceText, "current_target");
        if (hp) {
            return missingStatusWithHp[3]
                ? {
                    op: "all",
                    children: [hp, { op: "unknown", sourceText: missingStatusWithHp[3].trim() }],
                }
                : hp;
        }
    }
    const excludedQualifier = /^(.*?)\s+(\([^)]*\bexcluded\))$/i.exec(text);
    if (excludedQualifier) {
        const known = parseEnemyNameCondition(excludedQualifier[1], sourceText);
        if (known) {
            return {
                op: "all",
                children: [known, { op: "unknown", sourceText: excludedQualifier[2] }],
            };
        }
    }
    return undefined;
}
function parseEnemyCountCondition(text, sourceText) {
    const matchingClassCount = /^facing\s+(\d+)\s+or more\s+(Super|Extreme) Class enemies$/i.exec(text);
    if (matchingClassCount && Number(matchingClassCount[1]) > 0) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection: "any_enemy",
            comparator: "gte",
            count: Number(matchingClassCount[1]),
            classes: [normalizeClass(matchingClassCount[2])],
            sourceText,
        });
    }
    if (/^(?:facing|there (?:is|are))\s+multiple enemies$/i.test(text)) {
        return enemyCountPredicate("gte", 2, sourceText);
    }
    if (/^(?:facing|there (?:is|are))\s+no enemies$/i.test(text)) {
        return enemyCountPredicate("eq", 0, sourceText);
    }
    const only = /^(?:facing|there (?:is|are))\s+only\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    if (only) {
        return enemyCountPredicateIfValid("eq", Number(only[1]), sourceText);
    }
    const qualified = /^(?:facing|there (?:is|are))\s+(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text)
        ?? /^(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text);
    if (qualified) {
        return enemyCountPredicateIfValid(qualified[2].toLowerCase() === "more" ? "gte" : "lte", Number(qualified[1]), sourceText);
    }
    const exact = /^(?:facing|there (?:is|are))\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    return exact ? enemyCountPredicateIfValid("eq", Number(exact[1]), sourceText) : undefined;
}
function enemyCountPredicateIfValid(comparator, value, sourceText) {
    return isEnemyCount(value) ? enemyCountPredicate(comparator, value, sourceText) : undefined;
}
function enemyCountPredicate(comparator, value, sourceText) {
    return predicateExpression({
        kind: "enemy_count",
        scope: "battle",
        comparator,
        value,
        sourceText,
    });
}
function isEnemyCount(value) {
    return Number.isInteger(value) && value >= 0;
}
function parseEnemyHpCondition(text, sourceText) {
    let body = text.trim();
    let evaluationMoment;
    const beforeAttack = /^before attacking\s+/i.exec(body);
    if (beforeAttack) {
        evaluationMoment = "before_attack";
        body = body.slice(beforeAttack[0].length).trim();
    }
    const momentSuffixes = [
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+when attacking$/i, moment: "when_attacking" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }
    let enemySelection;
    let comparisonText;
    const selected = /^(?:(?:the )?(?:target|attacked|selected) enemy|an? enemy being attacked)['’]s HP is\s+(.+)$/i.exec(body);
    const whose = /^an? enemy whose HP is\s+(.+)$/i.exec(body);
    const withHp = /^facing an? enemy with\s+(.+)\s+HP$/i.exec(body);
    const only = /^that enemy['’]s HP is\s+(.+)$/i.exec(body);
    const ambiguous = /^(?:the )?enemy['’]s HP is\s+(.+)$/i.exec(body);
    if (selected) {
        enemySelection = "current_target";
        comparisonText = selected[1];
    }
    else if (whose) {
        enemySelection = evaluationMoment === "before_attack" ? "current_target" : "any_enemy";
        comparisonText = whose[1];
    }
    else if (withHp) {
        enemySelection = "any_enemy";
        comparisonText = withHp[1];
    }
    else if (only) {
        enemySelection = "unknown";
        comparisonText = only[1];
    }
    else if (ambiguous) {
        enemySelection = "unknown";
        comparisonText = ambiguous[1];
    }
    else {
        return undefined;
    }
    const condition = parseEnemyHpComparison(comparisonText, sourceText, enemySelection, evaluationMoment);
    if (!only || !condition) {
        return condition;
    }
    return mapConditionPredicates(condition, predicate => ({
        ...predicate,
        enemyReference: "that_enemy",
    }));
}
function mapConditionPredicates(condition, transform) {
    if (condition.op === "predicate") {
        return predicateExpression(transform(condition.predicate));
    }
    if (condition.op === "all" || condition.op === "any") {
        return { op: condition.op, children: condition.children.map(child => mapConditionPredicates(child, transform)) };
    }
    if (condition.op === "not") {
        return { op: "not", child: mapConditionPredicates(condition.child, transform) };
    }
    return condition;
}
function parseEnemyHpComparison(comparisonText, sourceText, enemySelection, evaluationMoment) {
    const interval = /^between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(comparisonText);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                enemyHpPredicate("gte", minimum, sourceText, enemySelection, evaluationMoment),
                enemyHpPredicate("lte", maximum, sourceText, enemySelection, evaluationMoment),
            ],
        };
    }
    const exact = /^exactly\s+(\d+)%$/i.exec(comparisonText);
    if (exact) {
        return enemyHpPredicateIfValid("eq", Number(exact[1]), sourceText, enemySelection, evaluationMoment);
    }
    const strict = /^(above|below)\s+(\d+)%$/i.exec(comparisonText);
    if (strict) {
        return enemyHpPredicateIfValid(strict[1].toLowerCase() === "above" ? "gt" : "lt", Number(strict[2]), sourceText, enemySelection, evaluationMoment);
    }
    const qualified = /^(\d+)%\s+or\s+(more|less|above|below)$/i.exec(comparisonText);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return enemyHpPredicateIfValid(qualifier === "more" || qualifier === "above" ? "gte" : "lte", Number(qualified[1]), sourceText, enemySelection, evaluationMoment);
    }
    const plain = /^(\d+)%$/i.exec(comparisonText);
    return plain
        ? enemyHpPredicateIfValid("eq", Number(plain[1]), sourceText, enemySelection, evaluationMoment)
        : undefined;
}
function enemyHpPredicateIfValid(comparator, value, sourceText, enemySelection, evaluationMoment) {
    return isHpPercent(value)
        ? enemyHpPredicate(comparator, value, sourceText, enemySelection, evaluationMoment)
        : undefined;
}
function enemyHpPredicate(comparator, value, sourceText, enemySelection, evaluationMoment) {
    return predicateExpression({
        kind: "enemy_hp_percent",
        scope: "enemy",
        comparator,
        value,
        enemySelection,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}
function parseEnemyStatusCondition(text, sourceText) {
    const header = /^(?:the )?(target|attacked|selected) enemy is in the following status:\s*(.+)$/i.exec(text);
    if (header) {
        return parseEnemyStatusValues(header[2], "current_target", sourceText);
    }
    const possessiveSeal = /^(?:the )?(target|attacked|selected) enemy['’]s Super Attack is (not )?sealed$/i.exec(text);
    if (possessiveSeal) {
        const predicate = enemyStatusPredicate("super_attack_sealed", "current_target", sourceText);
        return possessiveSeal[2] ? { op: "not", child: predicate } : predicate;
    }
    const forms = [
        { pattern: /^there (?:is|are) an? (.+?) enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^all enemies are (.+)$/i, selection: "all_enemies" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy (?:is|has) (.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy (?:is|has) (.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy (?:is|has) (.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        let value = match[1].trim();
        let negated = false;
        if (/^not\s+/i.test(value)) {
            negated = true;
            value = value.replace(/^not\s+/i, "");
        }
        const status = parseEnemyStatusTerm(value);
        if (status) {
            const predicate = enemyStatusPredicate(status, form.selection, sourceText);
            return negated ? { op: "not", child: predicate } : predicate;
        }
    }
    const noStatus = /^there are no\s+(.+?)\s+enemies$/i.exec(text);
    if (noStatus) {
        const status = parseEnemyStatusTerm(noStatus[1]);
        return status
            ? { op: "not", child: enemyStatusPredicate(status, "any_enemy", sourceText) }
            : undefined;
    }
    return undefined;
}
function parseEnemyStatusValues(sourceText, selection, predicateSourceText) {
    const atomPattern = /ATK Down|DEF Down|stunned|Super Attack sealed|unresolved enemy status|HP is (?:between\s+\d+%\s+and\s+\d+%|exactly\s+\d+%|(?:above|below)\s+\d+%|\d+%(?:\s+or\s+(?:more|less|above|below))?)/gi;
    const matches = [...sourceText.matchAll(atomPattern)];
    const hasStatusAtom = matches.some(match => !/^HP is /i.test(match[0]));
    if (!hasStatusAtom || matches.some(match => match.index === undefined)) {
        return undefined;
    }
    const separators = [];
    let cursor = 0;
    for (const match of matches) {
        const separator = sourceText.slice(cursor, match.index).trim();
        if (cursor === 0) {
            if (separator)
                return undefined;
        }
        else {
            if (!/^(?:,|and|or|,\s*(?:and|or))$/i.test(separator))
                return undefined;
            separators.push(separator.toLowerCase());
        }
        cursor = (match.index ?? 0) + match[0].length;
    }
    const trailing = sourceText.slice(cursor).trim();
    if (trailing && trailing !== ",") {
        return undefined;
    }
    const children = matches.map(match => {
        if (/^unresolved enemy status$/i.test(match[0])) {
            return { op: "unknown", sourceText: predicateSourceText };
        }
        if (/^HP is /i.test(match[0])) {
            return parseEnemyHpComparison(match[0].replace(/^HP is\s+/i, ""), predicateSourceText, selection) ?? { op: "unknown", sourceText: predicateSourceText };
        }
        return enemyStatusPredicate(parseEnemyStatusTerm(match[0]), selection, predicateSourceText);
    });
    if (children.length === 1) {
        return trailing
            ? { op: "all", children: [children[0], { op: "unknown", sourceText: predicateSourceText }] }
            : children[0];
    }
    const hasAnd = separators.some(separator => /\band\b/.test(separator));
    const hasOr = separators.some(separator => /\bor\b/.test(separator));
    if (!hasAnd && !hasOr) {
        return { op: "unknown", sourceText: predicateSourceText };
    }
    if (hasAnd && hasOr) {
        return combineStatusAtomsWithPrecedence(children, separators, predicateSourceText, trailing === ",");
    }
    const condition = {
        op: hasAnd ? "all" : "any",
        children,
    };
    return trailing
        ? { op: "all", children: [condition, { op: "unknown", sourceText: predicateSourceText }] }
        : condition;
}
function combineStatusAtomsWithPrecedence(children, separators, sourceText, hasTrailingResidual) {
    const groups = [[children[0]]];
    separators.forEach((separator, index) => {
        if (/\bor\b/.test(separator)) {
            groups.push([children[index + 1]]);
        }
        else {
            groups[groups.length - 1].push(children[index + 1]);
        }
    });
    const condition = groups.length === 1
        ? { op: "all", children: groups[0] }
        : {
            op: "any",
            children: groups.map(group => group.length === 1 ? group[0] : { op: "all", children: group }),
        };
    return hasTrailingResidual
        ? { op: "all", children: [condition, { op: "unknown", sourceText }] }
        : condition;
}
function parseEnemyStatusTerm(sourceText) {
    const normalized = sourceText.trim().toLowerCase();
    if (normalized === "atk down")
        return "atk_down";
    if (normalized === "def down")
        return "def_down";
    if (normalized === "stunned")
        return "stunned";
    if (normalized === "super attack sealed")
        return "super_attack_sealed";
    return undefined;
}
function enemyStatusPredicate(status, enemySelection, sourceText) {
    return predicateExpression({
        kind: "enemy_status",
        scope: "enemy",
        enemySelection,
        enemyStatuses: [status],
        sourceText,
    });
}
function parseEnemyNameCondition(text, sourceText) {
    const includesForms = [
        { pattern: /^there (?:is|are) an? enem(?:y|ies) whose name includes\s+(.+)$/i, selection: "any_enemy" },
        { pattern: /^an? enemy whose name includes\s+(.+)$/i, selection: "any_enemy" },
        { pattern: /^an? enemy includes\s+(.+)$/i, selection: "any_enemy" },
        { pattern: /^attacking an? enemy whose name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name includes\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name includes\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of includesForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "includes", form.selection, sourceText);
        }
    }
    const noIncludes = /^there (?:is|are) no enem(?:y|ies) whose name includes\s+(.+)$/i.exec(text);
    if (noIncludes) {
        const expression = buildEnemyNameExpression(noIncludes[1], "includes", "any_enemy", sourceText);
        return expression ? { op: "not", child: expression } : undefined;
    }
    const exactForms = [
        { pattern: /^(.+) is an enemy$/i, selection: "any_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of exactForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "exact", form.selection, sourceText);
        }
    }
    return undefined;
}
function buildEnemyNameExpression(sourceValues, nameMatch, enemySelection, sourceText) {
    const qualified = parseIndividuallyQualifiedNameValues(sourceValues);
    if (qualified) {
        return combineIndividuallyQualifiedNames(qualified, value => predicateExpression({
            kind: "enemy_name",
            scope: "enemy",
            enemySelection,
            names: [value.name],
            nameMatch,
            ...(value.excludedNames ? {
                excludedNames: value.excludedNames,
                excludedNameMatch: nameMatch,
            } : {}),
            sourceText,
        }));
    }
    const exclusion = /^(.*?)\s*,?\s+excluding\s+(.+)$/i.exec(sourceValues);
    const parentheticalExclusion = /^(.*?)\s*\(([^()]*)\s+excluded\)$/i.exec(sourceValues);
    const includedText = exclusion?.[1] ?? parentheticalExclusion?.[1] ?? sourceValues;
    const included = parseQuotedValues(includedText);
    if (!included) {
        return undefined;
    }
    const excluded = exclusion
        ? parseQuotedValues(exclusion[2])
        : parentheticalExclusion
            ? parseExcludedNameExamples(parentheticalExclusion[2])
            : undefined;
    if (exclusion && !excluded) {
        return undefined;
    }
    if (parentheticalExclusion && !excluded) {
        return undefined;
    }
    const children = included.values.map(name => predicateExpression({
        kind: "enemy_name",
        scope: "enemy",
        enemySelection,
        names: [name],
        nameMatch,
        ...(excluded ? { excludedNames: excluded.values, excludedNameMatch: nameMatch } : {}),
        sourceText,
    }));
    return children.length === 1
        ? children[0]
        : { op: included.connector === "and" ? "all" : "any", children };
}
function parseExcludedNameExamples(sourceText) {
    const values = sourceText
        .split(/\s*,\s*|\s+(?:and|or)\s+/i)
        .map(value => value.replace(/^['"]|['"]$/g, "").trim())
        .filter(value => value.length > 0 && !/^etc\.?$/i.test(value));
    return values.length > 0 && values.every(value => !/[()]/.test(value)) ? { values } : undefined;
}
function parseEnemyAttributeCondition(text, sourceText) {
    const forms = [
        { pattern: /^there (?:is|are) no\s+(.+?)\s+enemies$/i, selection: "any_enemy", negated: true },
        { pattern: /^there (?:is|are)\s+(?:an?\s+)?(.+?)\s+enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^an?\s+(.+?)\s+enemy$/i, selection: "any_enemy" },
        { pattern: /^attacking\s+(?:an?\s+)?(.+?)\s+enemy$/i, selection: "current_target" },
        { pattern: /^all enemies are\s+(.+)$/i, selection: "all_enemies" },
        { pattern: /^the only enemy is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the enemy is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        const expression = parseEnemyAttribute(match[1], form.selection, sourceText);
        if (expression) {
            return form.negated ? { op: "not", child: expression } : expression;
        }
    }
    return undefined;
}
function parseEnemyAttribute(sourceText, enemySelection, predicateSourceText) {
    const classType = /^(Super|Extreme)(?: Class)?\s+(AGL|TEQ|INT|STR|PHY)(?: Type)?$/i.exec(sourceText);
    if (classType) {
        return predicateExpression({
            kind: "enemy_class_type",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classType[1])],
            types: [normalizeType(classType[2])],
            sourceText: predicateSourceText,
        });
    }
    const classMatch = /^(Super|Extreme) Class$/i.exec(sourceText);
    if (classMatch) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type$/i.exec(sourceText);
    if (typeMatch) {
        return predicateExpression({
            kind: "enemy_type",
            scope: "enemy",
            enemySelection,
            types: [normalizeType(typeMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const categoryMatch = /^(.+?) Category$/i.exec(sourceText);
    if (categoryMatch) {
        const categories = parseQuotedValues(categoryMatch[1]);
        if (!categories) {
            return undefined;
        }
        const children = categories.values.map(category => predicateExpression({
            kind: "enemy_category",
            scope: "enemy",
            enemySelection,
            categories: [category],
            sourceText: predicateSourceText,
        }));
        return children.length === 1
            ? children[0]
            : { op: categories.connector === "and" ? "all" : "any", children };
    }
    const status = parseEnemyStatusTerm(sourceText);
    return status ? enemyStatusPredicate(status, enemySelection, predicateSourceText) : undefined;
}
function parseExactHpCondition(text, sourceText) {
    let body = text.trim();
    let evaluationMoment;
    const startPrefix = /^at the start of (?:the )?turn,?\s+(?:when\s+)?/i.exec(body);
    if (startPrefix) {
        evaluationMoment = "start_of_turn";
        body = body.slice(startPrefix[0].length).trim();
    }
    const entryAtMatch = /^upon entering the attacking turn with HP at\s+(.+)$/i.exec(body);
    const entryValueMatch = /^upon entering the attacking turn with\s+(\d+)% HP(?:\s+(or more|or less|or above|or below))?$/i.exec(body);
    if (entryAtMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryAtMatch[1]}`;
    }
    else if (entryValueMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryValueMatch[1]}%${entryValueMatch[2] ? ` ${entryValueMatch[2]}` : ""}`;
    }
    const momentSuffixes = [
        { pattern: /\s+at the start of the character['â€™]s attacking turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the end of (?:the )?turn$/i, moment: "end_of_turn" },
        { pattern: /\s+when attacking$/i, moment: "when_attacking" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }
    const interval = /^HP is between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(body);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                hpPredicate("gte", minimum, sourceText, evaluationMoment),
                hpPredicate("lte", maximum, sourceText, evaluationMoment),
            ],
        };
    }
    const exact = /^HP is exactly\s+(\d+)%$/i.exec(body);
    if (exact) {
        return hpPredicateIfValid("eq", Number(exact[1]), sourceText, evaluationMoment);
    }
    const strict = /^HP is\s+(above|below)\s+(\d+)%$/i.exec(body);
    if (strict) {
        return hpPredicateIfValid(strict[1].toLowerCase() === "above" ? "gt" : "lt", Number(strict[2]), sourceText, evaluationMoment);
    }
    const qualified = /^HP is\s+(\d+)%\s+or\s+(more|less|above|below)$/i.exec(body);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return hpPredicateIfValid(qualifier === "more" || qualifier === "above" ? "gte" : "lte", Number(qualified[1]), sourceText, evaluationMoment);
    }
    const plain = /^HP is\s+(\d+)%$/i.exec(body);
    return plain
        ? hpPredicateIfValid("eq", Number(plain[1]), sourceText, evaluationMoment)
        : undefined;
}
function hpPredicateIfValid(comparator, value, sourceText, evaluationMoment) {
    return isHpPercent(value) ? hpPredicate(comparator, value, sourceText, evaluationMoment) : undefined;
}
function hpPredicate(comparator, value, sourceText, evaluationMoment) {
    return predicateExpression({
        kind: "hp_percent",
        scope: "team",
        comparator,
        value,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}
function isHpPercent(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
}
function parseExactTemporalCondition(text, sourceText) {
    const starting = /^starting from the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (starting) {
        return temporalPredicateIfValid(starting[2], "gte", Number(starting[1]), sourceText);
    }
    const point = /^on the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (point) {
        return temporalPredicateIfValid(point[2] ?? "the start of battle", "eq", Number(point[1]), sourceText);
    }
    const pointList = /^on the (.+?) turns from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (pointList) {
        const values = parseOrdinalValues(pointList[1]);
        if (values) {
            return {
                op: "any",
                children: values.map(value => temporalPredicate(pointList[2], "eq", value, sourceText)),
            };
        }
    }
    const upper = /^up to the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (upper) {
        return temporalPredicateIfValid(upper[2] ?? "the start of battle", "lte", Number(upper[1]), sourceText);
    }
    const durationWindow = /^for (\d+) turn(?:s|\(s\))? from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (durationWindow) {
        const end = Number(durationWindow[1]);
        return temporalWindowIfValid(durationWindow[2], 1, end, sourceText);
    }
    const explicitWindow = /^from the (\d+)(?:st|nd|rd|th) (?:through|to) the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (explicitWindow) {
        return temporalWindowIfValid(explicitWindow[3], Number(explicitWindow[1]), Number(explicitWindow[2]), sourceText);
    }
    return undefined;
}
function temporalWindowIfValid(origin, start, end, sourceText) {
    if (!isTurnIndex(start) || !isTurnIndex(end) || start > end) {
        return undefined;
    }
    return {
        op: "all",
        children: [
            temporalPredicate(origin, "gte", start, sourceText),
            temporalPredicate(origin, "lte", end, sourceText),
        ],
    };
}
function temporalPredicateIfValid(origin, comparator, value, sourceText) {
    return isTurnIndex(value) ? temporalPredicate(origin, comparator, value, sourceText) : undefined;
}
function temporalPredicate(origin, comparator, value, sourceText) {
    const fromEntry = /character['â€™]s entry turn/i.test(origin);
    return predicateExpression({
        kind: fromEntry ? "turn_from_entry" : "battle_turn",
        scope: fromEntry ? "self" : "battle",
        comparator,
        value,
        sourceText,
    });
}
function isTurnIndex(value) {
    return Number.isInteger(value) && value >= 1;
}
function parseOrdinalValues(sourceText) {
    const values = [...sourceText.matchAll(/\b(\d+)(?:st|nd|rd|th)\b/gi)].map(match => Number(match[1]));
    const separators = sourceText.replace(/\b\d+(?:st|nd|rd|th)\b/gi, "#").trim();
    if (values.length === 0
        || values.some(value => !isTurnIndex(value))
        || !/^#(?:\s*(?:,|&|and|or)\s*#)*$/i.test(separators)) {
        return undefined;
    }
    return values;
}
function parseTemporalSuffixCondition(text) {
    const attackingWithKiSuffix = /^(.*?)\s+(when attacking with (?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))? Ki)$/i.exec(text);
    if (attackingWithKiSuffix && attackingWithKiSuffix[1].trim()) {
        const prefix = parseBooleanCondition(attackingWithKiSuffix[1]);
        const suffix = parseBooleanCondition(attackingWithKiSuffix[2]);
        if (prefix.op !== "unknown" && suffix.op !== "unknown") {
            return { op: "all", children: [prefix, suffix] };
        }
    }
    const receivingAttackWithKiSuffix = /^(.*?)\s+(when receiving an? attack with (?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))? Ki)$/i.exec(text);
    if (receivingAttackWithKiSuffix && receivingAttackWithKiSuffix[1].trim()) {
        const prefix = parseBooleanCondition(receivingAttackWithKiSuffix[1]);
        const suffix = parseBooleanCondition(receivingAttackWithKiSuffix[2]);
        if (prefix.op !== "unknown" && suffix.op !== "unknown") {
            return { op: "all", children: [prefix, suffix] };
        }
    }
    const suffix = /^(.*?)\s+(starting from the \d+(?:st|nd|rd|th) turn from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(text);
    if (suffix && suffix[1].trim()) {
        const temporal = parseExactTemporalCondition(suffix[2], suffix[2]);
        if (temporal) {
            return {
                op: "all",
                children: [parseBooleanCondition(suffix[1]), temporal],
            };
        }
    }
    const combatSuffix = /^(.*?)\s+((?:when|before|after)\s+(?:attacking|(?:performing|receiving|evading)(?:\s+(?:an?|the)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attack)?|delivering\s+(?:a\s+|the\s+)?final blow))$/i.exec(text);
    if (combatSuffix && combatSuffix[1].trim()) {
        const combat = parseExactCombatEventCondition(combatSuffix[2], combatSuffix[2]);
        if (combat) {
            return {
                op: "all",
                children: [parseBooleanCondition(combatSuffix[1]), combat],
            };
        }
    }
    return undefined;
}
function parseAllyConditionClause(sourceBody, sourceText) {
    let body = sourceBody.trim();
    body = body.replace(/^characters? whose names? include\s+/i, "allies whose name includes ");
    body = body.replace(/^allies whose names include\s+/i, "allies whose name includes ");
    let selfInclusion = "included";
    if (/\(self excluded\)/i.test(body)) {
        selfInclusion = "excluded";
        body = body.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    }
    else if (/\(self included\)/i.test(body)) {
        body = body.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    let negated = false;
    if (/^without\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^without\s+/i, "");
    }
    if (/^there (?:is|are) no\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^there (?:is|are) no\s+/i, "");
    }
    else {
        body = body.replace(/^there (?:is|are)\s+/i, "");
    }
    const otherMatch = /^other\s+/i.exec(body);
    if (otherMatch) {
        selfInclusion = "excluded";
        body = body.slice(otherMatch[0].length);
    }
    body = body.replace(/^allies whose names include\s+/i, "allies whose name includes ");
    const anotherMatch = /^another\s+/i.exec(body);
    if (anotherMatch) {
        selfInclusion = "excluded";
        body = body.slice(anotherMatch[0].length);
    }
    let count;
    let comparator;
    const countMatch = /^(\d+)\s+or more\s+/i.exec(body);
    if (countMatch) {
        count = Number(countMatch[1]);
        comparator = "gte";
        body = body.slice(countMatch[0].length);
    }
    else {
        const exactCountMatch = /^(\d+)\s+/i.exec(body);
        if (exactCountMatch) {
            count = Number(exactCountMatch[1]);
            comparator = "eq";
            body = body.slice(exactCountMatch[0].length);
        }
    }
    body = body.replace(/^an?\s+/i, "");
    body = body.replace(/^characters? whose names? include\s+/i, "allies whose name includes ");
    let scope;
    const teamMatch = /\s+(?:is\s+|are\s+)?on the team$/i.exec(body);
    const rotationMatch = /\s+(?:is\s+|are\s+)?attacking in the same turn$/i.exec(body);
    if (teamMatch) {
        scope = "team";
        body = body.slice(0, teamMatch.index).trim();
    }
    else if (rotationMatch) {
        scope = "rotation";
        body = body.slice(0, rotationMatch.index).trim();
    }
    else {
        return undefined;
    }
    const classCategoryMatch = /^(?:(Super|Extreme) Class\s+(.+?) Category|(.+?) Category\s+(Super|Extreme) Class) all(?:y|ies)$/i.exec(body);
    if (classCategoryMatch) {
        const className = normalizeClass(classCategoryMatch[1] ?? classCategoryMatch[4]);
        const categoryValues = parseQuotedValues(classCategoryMatch[2] ?? classCategoryMatch[3]);
        if (categoryValues) {
            const children = categoryValues.values.map(category => allyPredicate("category_class", { category, className }, scope, selfInclusion, count, comparator, sourceText));
            const expression = children.length === 1
                ? children[0]
                : { op: categoryValues.connector === "and" ? "all" : "any", children };
            return negated ? { op: "not", child: expression } : expression;
        }
    }
    const categoryAndName = /^(.+?) Category all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (categoryAndName) {
        const categories = parseQuotedValues(categoryAndName[1]);
        const qualifiedNames = parseIndividuallyQualifiedNameValues(categoryAndName[2]);
        const nameSelector = qualifiedNames ? undefined : parseNameSelectorValues(categoryAndName[2]);
        const expression = categories && qualifiedNames && categories.connector !== "and"
            ? combineIndividuallyQualifiedNames(qualifiedNames, value => predicateExpression({
                kind: "ally_category_name_present",
                scope,
                selfInclusion,
                ...(count !== undefined ? { comparator, count } : {}),
                categories: categories.values,
                names: [value.name],
                nameMatch: "includes",
                ...(value.excludedNames ? {
                    excludedNames: value.excludedNames,
                    excludedNameMatch: "includes",
                } : {}),
                sourceText,
            }))
            : categories && nameSelector
                && categories.connector !== "and" && nameSelector.included.connector !== "and"
                ? predicateExpression({
                    kind: "ally_category_name_present",
                    scope,
                    selfInclusion,
                    ...(count !== undefined ? { comparator, count } : {}),
                    categories: categories.values,
                    names: nameSelector.included.values,
                    nameMatch: "includes",
                    ...(nameSelector.excluded ? {
                        excludedNames: nameSelector.excluded.values,
                        excludedNameMatch: "includes",
                    } : {}),
                    sourceText,
                })
                : undefined;
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const categoryMatch = /^(.+?) Category all(?:y|ies)$/i.exec(body);
    if (categoryMatch) {
        const expression = buildQuotedPredicateExpression(categoryMatch[1], value => allyPredicate("category", value, scope, selfInclusion, count, comparator, sourceText));
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const nameMatch = /^all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (nameMatch) {
        const qualified = parseIndividuallyQualifiedNameValues(nameMatch[1]);
        const selector = qualified ? undefined : parseNameSelectorValues(nameMatch[1]);
        const expression = qualified
            ? combineIndividuallyQualifiedNames(qualified, value => predicateExpression({
                ...allyPredicate("name", value.name, scope, selfInclusion, count, comparator, sourceText).predicate,
                nameMatch: "includes",
                ...(value.excludedNames ? {
                    excludedNames: value.excludedNames,
                    excludedNameMatch: "includes",
                } : {}),
            }))
            : selector
                ? combineQuotedPredicateExpressions(selector.included, value => predicateExpression({
                    ...allyPredicate("name", value, scope, selfInclusion, count, comparator, sourceText).predicate,
                    nameMatch: "includes",
                    ...(selector.excluded ? {
                        excludedNames: selector.excluded.values,
                        excludedNameMatch: "includes",
                    } : {}),
                }))
                : undefined;
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const classTypeMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (classTypeMatch) {
        const expression = allyPredicate("class_type", { className: normalizeClass(classTypeMatch[1]), typeName: normalizeType(classTypeMatch[2]) }, scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    const classMatch = /^(Super|Extreme) Class all(?:y|ies)$/i.exec(body);
    if (classMatch) {
        const expression = allyPredicate("class", normalizeClass(classMatch[1]), scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (typeMatch) {
        const expression = allyPredicate("type", normalizeType(typeMatch[1]), scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    return undefined;
}
function parseIndividuallyQualifiedNameValues(sourceText) {
    const matches = [...sourceText.matchAll(/"([^"]+)"(?:\s*\(([^()]*)\s+excluded\))?/g)];
    if (matches.length === 0 || matches.some(match => match.index === undefined)) {
        return undefined;
    }
    const separators = [];
    let cursor = 0;
    for (const match of matches) {
        const separator = sourceText.slice(cursor, match.index).trim();
        if (cursor === 0) {
            if (separator)
                return undefined;
        }
        else {
            if (!/^(?:,|and|or|,\s*(?:and|or))$/i.test(separator))
                return undefined;
            separators.push(separator);
        }
        cursor = (match.index ?? 0) + match[0].length;
    }
    if (sourceText.slice(cursor).trim()) {
        return undefined;
    }
    const hasAnd = separators.some(separator => /\band\b/i.test(separator));
    const hasOr = separators.some(separator => /\bor\b/i.test(separator));
    if (hasAnd && hasOr) {
        return undefined;
    }
    const values = [];
    for (const match of matches) {
        const excluded = match[2] ? parseExcludedNameExamples(match[2]) : undefined;
        if (match[2] && !excluded) {
            return undefined;
        }
        values.push({
            name: match[1].trim(),
            ...(excluded ? { excludedNames: excluded.values } : {}),
        });
    }
    return {
        values,
        connector: values.length === 1 ? "single" : hasAnd ? "and" : "or",
    };
}
function combineIndividuallyQualifiedNames(parsed, build) {
    const children = parsed.values.map(build);
    return children.length === 1
        ? children[0]
        : { op: parsed.connector === "and" ? "all" : "any", children };
}
function parseNameSelectorValues(sourceText) {
    const parenthetical = /^(.*?)\s*\(([^()]*)\s+excluded\)$/i.exec(sourceText.trim());
    const included = parseQuotedValues(parenthetical?.[1] ?? sourceText);
    if (!included)
        return undefined;
    const excluded = parenthetical ? parseExcludedNameExamples(parenthetical[2]) : undefined;
    if (parenthetical && !excluded)
        return undefined;
    return { included, ...(excluded ? { excluded } : {}) };
}
function combineQuotedPredicateExpressions(parsed, build) {
    const children = parsed.values.map(build);
    return children.length === 1
        ? children[0]
        : { op: parsed.connector === "and" ? "all" : "any", children };
}
function allyPredicate(type, value, scope, selfInclusion, count, comparator, sourceText) {
    const rotationPartner = scope === "rotation" && selfInclusion === "excluded";
    const kind = type === "category"
        ? (rotationPartner ? "rotation_partner_category" : "ally_category_present")
        : type === "name"
            ? (rotationPartner ? "rotation_partner_name" : "ally_name_present")
            : type === "class"
                ? "ally_class_present"
                : type === "type"
                    ? "ally_type_present"
                    : type === "class_type"
                        ? "ally_class_type_present"
                        : "ally_category_class_present";
    return predicateExpression({
        kind,
        scope,
        selfInclusion,
        ...(count !== undefined ? { comparator, count } : {}),
        ...(type === "category" ? { categories: [value] } : {}),
        ...(type === "name" ? { names: [value] } : {}),
        ...(type === "class" ? { classes: [value] } : {}),
        ...(type === "type" ? { types: [value] } : {}),
        ...(type === "class_type" ? {
            classes: [value.className],
            types: [value.typeName],
        } : {}),
        ...(type === "category_class" ? {
            categories: [value.category],
            classes: [value.className],
        } : {}),
        sourceText,
    });
}
function predicateExpression(predicate) {
    return { op: "predicate", predicate };
}
const TEAM_ANALYSIS_TYPES = ["AGL", "TEQ", "INT", "STR", "PHY"];
const TEAM_ANALYSIS_CLASSES = ["Super", "Extreme"];
const KI_SPHERE_TYPES = [
    ...TEAM_ANALYSIS_TYPES,
    "rainbow",
    "non_rainbow",
    "sweet_treat",
    "any",
];
const SLOT_LIST_PATTERN = "(?:1st|2nd|3rd)(?:\\s*(?:,|and|or)\\s*(?:1st|2nd|3rd))*";
function normalizeClass(value) {
    return /^super$/i.test(value) ? "Super" : "Extreme";
}
function normalizeType(value) {
    return value.toUpperCase();
}
function parseKiSphereTypes(sourceText) {
    const text = sourceText.trim();
    if (!text || /^any$/i.test(text)) {
        return ["any"];
    }
    if (/^Rainbow$/i.test(text)) {
        return ["rainbow"];
    }
    if (/^(?:non[- ]Rainbow|Type)$/i.test(text)) {
        return ["non_rainbow"];
    }
    if (/^sweet treat$/i.test(text)) {
        return ["sweet_treat"];
    }
    const parts = text.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY|Rainbow)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(part => /^Rainbow$/i.test(part) ? "rainbow" : normalizeType(part)))];
}
function parseKiSphereDestination(sourceText) {
    if (/^Rainbow$/i.test(sourceText.trim())) {
        return "rainbow";
    }
    return /^(?:AGL|TEQ|INT|STR|PHY)$/i.test(sourceText.trim())
        ? normalizeType(sourceText.trim())
        : undefined;
}
function parseConcreteKiSphereTypes(sourceText) {
    const types = parseKiSphereTypes(sourceText);
    return types && types.every((type) => type === "rainbow" || TEAM_ANALYSIS_TYPES.includes(type))
        ? types
        : undefined;
}
function parseExcludedKiSphereTypes(sourceText) {
    const text = sourceText.replace(/\s+excluded$/i, "").trim();
    const types = parseKiSphereTypes(text);
    return types && types.every((type) => TEAM_ANALYSIS_TYPES.includes(type))
        ? types
        : undefined;
}
function parseKiAmountScalingHeader(sourceText) {
    const match = /^For every(?:\s+(\d+))?\s+Ki (when attacking|when receiving an? attack)$/i.exec(sourceText.trim());
    const kiPerIncrement = match ? Number(match[1] ?? 1) : NaN;
    if (!Number.isInteger(kiPerIncrement) || kiPerIncrement < 1) {
        return undefined;
    }
    return {
        kind: "per_ki_amount",
        kiPerIncrement,
        kiContext: "final_attack_ki",
        evaluationMoment: /^when receiving/i.test(match?.[2] ?? "")
            ? "when_targeted_by_attack"
            : "when_attacking",
    };
}
function parseKiSphereScalingHeader(sourceText) {
    const deferredCount = /^For every Ki Sphere obtained with (\d+) or more Ki Spheres obtained \(count starts from the (\d+)(?:st|nd|rd|th) Ki Sphere\)$/i.exec(sourceText.trim());
    if (deferredCount) {
        const minimum = Number(deferredCount[1]);
        const countStartsFrom = Number(deferredCount[2]);
        if (!Number.isInteger(minimum) || minimum < 1 || minimum !== countStartsFrom) {
            return undefined;
        }
        return {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
            countStartsFrom,
            selection: "all_obtained",
        };
    }
    const largestType = /^For every (AGL|TEQ|INT|STR|PHY|Rainbow) or (AGL|TEQ|INT|STR|PHY|Rainbow) Ki Sphere obtained \(whichever Ki Sphere is collected more will be counted\)$/i.exec(sourceText.trim());
    if (largestType) {
        return {
            kind: "per_ki_sphere",
            kiSphereTypes: [
                /^Rainbow$/i.test(largestType[1]) ? "rainbow" : normalizeType(largestType[1]),
                /^Rainbow$/i.test(largestType[2]) ? "rainbow" : normalizeType(largestType[2]),
            ],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
            selection: "largest_type_count",
        };
    }
    const excludedType = /^For every(?:\s+(\d+))?\s+Type Ki Spheres? obtained \((AGL|TEQ|INT|STR|PHY) excluded\)$/i.exec(sourceText.trim());
    if (excludedType) {
        const spheresPerIncrement = Number(excludedType[1] ?? 1);
        if (!Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
            return undefined;
        }
        return {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            excludedKiSphereTypes: [normalizeType(excludedType[2])],
            spheresPerIncrement,
            kiContext: "collected_ki_spheres",
        };
    }
    const excluded = /^For every(?:\s+(\d+))?\s+non-(AGL|TEQ|INT|STR|PHY) Ki Spheres? obtained$/i.exec(sourceText.trim());
    if (excluded) {
        const spheresPerIncrement = Number(excluded[1] ?? 1);
        if (!Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
            return undefined;
        }
        return {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            excludedKiSphereTypes: [normalizeType(excluded[2])],
            spheresPerIncrement,
            kiContext: "collected_ki_spheres",
        };
    }
    const match = /^For every(?:\s+(\d+))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const spheresPerIncrement = Number(match[1] ?? 1);
    const kiSphereTypes = parseKiSphereTypes(match[2]);
    if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
        return undefined;
    }
    return {
        kind: "per_ki_sphere",
        kiSphereTypes,
        spheresPerIncrement,
        kiContext: "collected_ki_spheres",
    };
}
function parseCombatEventScalingHeader(sourceText) {
    if (/^For every Super Attack the enemy launches at the character$/i.test(sourceText.trim())) {
        const identity = combatEventIdentity("Super Attack", "targeted");
        return {
            kind: "per_combat_event",
            connector: "single",
            eventsPerIncrement: 1,
            events: [combatEventDescriptor(identity, "per_event", "during_event", {
                    countScope: "battle",
                    countScopeSource: "documented_domain_rule",
                })],
        };
    }
    const match = /^For every(?:\s+(\d+))?\s+(.+)$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const eventsPerIncrement = Number(match[1] ?? 1);
    if (!Number.isInteger(eventsPerIncrement) || eventsPerIncrement < 1) {
        return undefined;
    }
    const body = match[2].trim();
    const connectors = [...body.matchAll(/\s+(and|or)\s+/gi)].map(item => item[1].toLowerCase());
    if (connectors.includes("and") && connectors.includes("or")) {
        return undefined;
    }
    const connector = connectors[0] ?? "single";
    const parts = body.split(/\s+(?:and|or)\s+/i).map(part => part.trim());
    const identities = parts.map((part, index) => {
        const direct = parsePerEventIdentity(part);
        if (direct) {
            return direct;
        }
        if (/^evaded$/i.test(part) && index > 0 && /attack received$/i.test(parts[index - 1])) {
            return combatEventIdentity("attack evaded", "evaded");
        }
        return undefined;
    });
    if (identities.some(identity => !identity)) {
        return undefined;
    }
    return {
        kind: "per_combat_event",
        connector,
        eventsPerIncrement,
        events: identities.map(identity => combatEventDescriptor(identity, "per_event", "after_event", {
            countScope: "battle",
            countScopeSource: "documented_domain_rule",
            relativeTimingSource: "documented_domain_rule",
        })),
    };
}
function parseCompositeScalingConditionHeader(sourceText) {
    const text = sourceText.trim();
    const combat = /^(For every(?:\s+\d+)?\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack performed)\s+(.+)$/i.exec(text);
    if (combat) {
        const scaling = parseCombatEventScalingHeader(combat[1]);
        const condition = parseBooleanCondition(combat[2]);
        if (scaling && condition.op !== "unknown") {
            return { scaling, conditionText: combat[2] };
        }
    }
    const receivedOrEvaded = /^(For every(?:\s+\d+)?\s+attack received or evaded)\s+(as the .+)$/i.exec(text);
    if (receivedOrEvaded) {
        const scaling = parseCombatEventScalingHeader(receivedOrEvaded[1]);
        const condition = parseBooleanCondition(receivedOrEvaded[2]);
        if (scaling && condition.op !== "unknown") {
            return { scaling, conditionText: receivedOrEvaded[2] };
        }
    }
    const kiSphere = /^(For every(?:\s+\d+)?\s+.*?Ki Spheres? obtained)\s+((?:when|if) .+)$/i.exec(text);
    if (kiSphere) {
        const scaling = parseKiSphereScalingHeader(kiSphere[1]);
        const condition = parseBooleanCondition(kiSphere[2]);
        if (scaling && condition.op !== "unknown") {
            return { scaling, conditionText: kiSphere[2] };
        }
    }
    const kiAmount = /^(For every(?:\s+\d+)?\s+Ki)\s+(when receiving an? attack)$/i.exec(text);
    if (kiAmount) {
        const scaling = parseKiAmountScalingHeader(text);
        const condition = parseBooleanCondition(kiAmount[2]);
        if (scaling && condition.op !== "unknown") {
            return { scaling, conditionText: kiAmount[2] };
        }
    }
    return undefined;
}
function parseCategoryAllyScalingHeader(sourceText) {
    const text = sourceText.trim();
    const largestCategory = /^Per (.+?) Category ally (on the team|attacking in the same turn) \(depending on which Category has more members\)(\s*\(self excluded\))?$/i.exec(text);
    if (largestCategory) {
        const categories = parseQuotedValues(largestCategory[1]);
        if (!categories || categories.connector !== "or" || categories.values.length < 2) {
            return undefined;
        }
        const scope = /^on the team$/i.test(largestCategory[2]) ? "team" : "rotation";
        const selfInclusion = largestCategory[3] ? "excluded" : "included";
        return {
            kind: "per_category_ally",
            scope,
            categories: categories.values,
            selfInclusion,
            membersPerIncrement: 1,
            maximumCount: scalingMaximumCount(scope, selfInclusion),
            selection: "largest_category_count",
        };
    }
    const singleCategory = /^Per (.+?) Category ally (?:on the team|attacking in the same turn)(\s*\(self excluded\))?$/i.exec(text);
    if (!singleCategory) {
        return undefined;
    }
    const categories = parseQuotedValues(singleCategory[1]);
    if (!categories || categories.values.length === 0) {
        return undefined;
    }
    const selection = categories.values.length === 1
        ? "single_category"
        : categories.connector === "or"
            ? "union_category_members"
            : undefined;
    if (!selection) {
        return undefined;
    }
    const scope = /on the team/i.test(text) ? "team" : "rotation";
    const selfInclusion = singleCategory[2] ? "excluded" : "included";
    return {
        kind: "per_category_ally",
        scope,
        categories: categories.values,
        selfInclusion,
        membersPerIncrement: 1,
        maximumCount: scalingMaximumCount(scope, selfInclusion),
        selection,
    };
}
function parseClassAllyScalingHeader(sourceText) {
    const text = sourceText.trim();
    const match = /^Per (Super|Extreme) Class ally (on the team|attacking in the same turn)(\s*\(self excluded\))?$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const scope = /^on the team$/i.test(match[2]) ? "team" : "rotation";
    const selfInclusion = match[3] ? "excluded" : "included";
    return {
        kind: "per_class_ally",
        scope,
        classes: [normalizeClass(match[1])],
        selfInclusion,
        membersPerIncrement: 1,
        maximumCount: scalingMaximumCount(scope, selfInclusion),
    };
}
function parseCategoryNameAllyScalingHeader(sourceText) {
    const text = sourceText.trim();
    const match = /^Per (.+?) Category ally whose name includes (.+?) (on the team|attacking in the same turn)(\s*\(self excluded\))?$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const categories = parseQuotedValues(match[1]);
    const names = parseQuotedValues(match[2]);
    if (!categories || !names || categories.connector === "and" || names.connector === "and") {
        return undefined;
    }
    const scope = /^on the team$/i.test(match[3]) ? "team" : "rotation";
    const selfInclusion = match[4] ? "excluded" : "included";
    return {
        kind: "per_category_name_ally",
        scope,
        categories: categories.values,
        names: names.values,
        selfInclusion,
        membersPerIncrement: 1,
        maximumCount: scalingMaximumCount(scope, selfInclusion),
    };
}
function parseNameAllyScalingHeader(sourceText) {
    const text = sourceText.trim();
    const match = /^Per ally whose name includes (.+?) (on the team|attacking in the same turn)(\s*\(self excluded\))?$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const names = parseQuotedValues(match[1]);
    if (!names || names.connector === "and") {
        return undefined;
    }
    const scope = /^on the team$/i.test(match[2]) ? "team" : "rotation";
    const selfInclusion = match[3] ? "excluded" : "included";
    return {
        kind: "per_name_ally",
        scope,
        names: names.values,
        selfInclusion,
        membersPerIncrement: 1,
        maximumCount: scalingMaximumCount(scope, selfInclusion),
    };
}
function parseCategoryOrClassAllyScalingHeader(sourceText) {
    const text = sourceText.trim();
    const match = /^Per (.+?) Category ally or (Super|Extreme) Class ally (on the team|attacking in the same turn) \(depending on which has more members\)(\s*\(self excluded\))?$/i.exec(text)
        ?? /^Per (Super|Extreme) Class ally or (.+?) Category ally (on the team|attacking in the same turn) \(depending on which has more members\)(\s*\(self excluded\))?$/i.exec(text);
    if (!match) {
        return undefined;
    }
    const classFirst = /^(?:Super|Extreme)$/i.test(match[1]);
    const categorySource = classFirst ? match[2] : match[1];
    const classSource = classFirst ? match[1] : match[2];
    const categories = parseQuotedValues(categorySource);
    if (!categories || categories.connector === "and") {
        return undefined;
    }
    const scope = /^on the team$/i.test(match[3]) ? "team" : "rotation";
    const selfInclusion = match[4] ? "excluded" : "included";
    return {
        kind: "per_category_or_class_ally",
        scope,
        categories: categories.values,
        classes: [normalizeClass(classSource)],
        selfInclusion,
        membersPerIncrement: 1,
        maximumCount: scalingMaximumCount(scope, selfInclusion),
    };
}
function scalingMaximumCount(scope, selfInclusion) {
    const capacity = scope === "team" ? 7 : 3;
    return selfInclusion === "excluded" ? capacity - 1 : capacity;
}
function parseTurnPassedScalingHeader(sourceText) {
    const match = /^For every(?: (\d+))? turns? passed(?: from the start of battle)?$/i.exec(sourceText.trim());
    const turnsPerIncrement = match ? Number(match[1] ?? 1) : NaN;
    if (!Number.isInteger(turnsPerIncrement) || turnsPerIncrement < 1) {
        return undefined;
    }
    return {
        kind: "per_turn_passed",
        turnsPerIncrement,
        turnContext: "battle_turn",
    };
}
function parseExistingEnemyScalingHeader(sourceText) {
    const match = /^Per existing(?:(?: (Super|Extreme) Class)?) enemy(?: \(count starts from the (\d+)(?:st|nd|rd|th) enemy\))?$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const countStartsFrom = Number(match[2] ?? 1);
    if (!Number.isInteger(countStartsFrom) || countStartsFrom < 1) {
        return undefined;
    }
    return {
        kind: "per_existing_enemy",
        classes: match[1] ? [normalizeClass(match[1])] : [],
        enemiesPerIncrement: 1,
        countStartsFrom,
    };
}
function parseHpRemainingScalingHeader(sourceText) {
    const match = /^The (more|less) HP remaining$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    return {
        kind: "hp_remaining",
        direction: match[1].toLowerCase(),
        hpContext: "team_hp_percent",
    };
}
function parsePerEventIdentity(sourceText) {
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) performed$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "performed");
    }
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) received$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "landed");
    }
    if (/^attack evaded$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "evaded");
    }
    if (/^final blow delivered$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "final_blow");
    }
    return undefined;
}
function clonePassiveEffectScaling(scaling) {
    if (scaling.kind === "per_ki_sphere") {
        return {
            ...scaling,
            kiSphereTypes: [...scaling.kiSphereTypes],
            ...(scaling.excludedKiSphereTypes
                ? { excludedKiSphereTypes: [...scaling.excludedKiSphereTypes] }
                : {}),
        };
    }
    if (scaling.kind === "per_ki_amount") {
        return { ...scaling };
    }
    if (scaling.kind === "per_category_ally") {
        return { ...scaling, categories: [...scaling.categories] };
    }
    if (scaling.kind === "per_class_ally") {
        return { ...scaling, classes: [...scaling.classes] };
    }
    if (scaling.kind === "per_category_name_ally") {
        return { ...scaling, categories: [...scaling.categories], names: [...scaling.names] };
    }
    if (scaling.kind === "per_name_ally") {
        return { ...scaling, names: [...scaling.names] };
    }
    if (scaling.kind === "per_category_or_class_ally") {
        return { ...scaling, categories: [...scaling.categories], classes: [...scaling.classes] };
    }
    if (scaling.kind === "hp_remaining") {
        return { ...scaling };
    }
    if (scaling.kind === "per_turn_passed") {
        return { ...scaling };
    }
    if (scaling.kind === "per_existing_enemy") {
        return { ...scaling, classes: [...scaling.classes] };
    }
    return {
        ...scaling,
        events: scaling.events.map(event => ({
            ...event,
            provenance: { ...event.provenance },
        })),
    };
}
function parseSlotValues(sourceText) {
    return [...sourceText.matchAll(/\b(1st|2nd|3rd)\b/gi)]
        .map(match => Number(match[1][0]));
}
function parseExactSlotCondition(text, sourceText) {
    const startOfTurnPattern = new RegExp(`^(?:(?:the|this) character is the|As the|attacking as the)\\s+(${SLOT_LIST_PATTERN})\\s+attacker(?: in a turn)? at the start of turn$`, "i");
    const startOfTurnMatch = startOfTurnPattern.exec(text);
    if (startOfTurnMatch) {
        return predicateExpression({
            kind: "battle_slot",
            scope: "self",
            slots: parseSlotValues(startOfTurnMatch[1]),
            evaluationMoment: "start_of_turn",
            sourceText,
        });
    }
    const attackerPattern = new RegExp(`^(?:As the|attacking as the)\\s+(${SLOT_LIST_PATTERN})\\s+attacker in a turn$`, "i");
    const slotPattern = new RegExp(`^attacking in the\\s+(${SLOT_LIST_PATTERN})\\s+slot$`, "i");
    const match = attackerPattern.exec(text) ?? slotPattern.exec(text);
    if (!match) {
        return undefined;
    }
    return predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText,
    });
}
function parsePartialSlotCondition(text) {
    const pattern = new RegExp(`\\b(?:attacking as the|attacking in the|(?:the|this) character is the|as the)\\s+(${SLOT_LIST_PATTERN})\\s+(?:attacker(?:\\s+in a turn)?|slot)\\b`, "i");
    const match = pattern.exec(text);
    if (!match || match.index === undefined) {
        return undefined;
    }
    const prefix = text.slice(0, match.index).replace(/[\s,]+$/g, "");
    const suffix = text.slice(match.index + match[0].length).replace(/^[\s,]+/g, "");
    const slot = predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText: match[0],
    });
    const children = [
        ...(prefix ? [parseBooleanCondition(prefix)] : []),
        slot,
        ...(suffix ? [parseBooleanCondition(suffix)] : []),
    ];
    return children.length === 1 ? children[0] : { op: "all", children };
}
function stripOuterConditionParentheses(sourceText) {
    let text = sourceText.trim();
    while (text.startsWith("(") && matchingOuterParenthesisIndex(text) === text.length - 1) {
        text = text.slice(1, -1).trim();
    }
    return text;
}
function matchingOuterParenthesisIndex(text) {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === "\"") {
            quoted = !quoted;
        }
        else if (!quoted && character === "(") {
            depth += 1;
        }
        else if (!quoted && character === ")") {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}
function splitTopLevelCondition(sourceText, connector) {
    const matches = [...sourceText.matchAll(/\s+,?\s*(and|or)\s+/gi)];
    const parts = [];
    let lastIndex = 0;
    for (const match of matches) {
        const index = match.index ?? -1;
        if (index < 0
            || match[1].toLowerCase() !== connector
            || conditionDepthAt(sourceText, index) !== 0) {
            continue;
        }
        const right = sourceText.slice(index + match[0].length).trim();
        if (!/^(?:when|if|not\b|after\b|before\b|as|attacking|performing|receiving|evading|every\b|your\s+team|with|between|ki\b|\d+\b|there|all|the\s+(?:team|character|enemy|target|attacked|selected|only)|this\s+character|that\s+enemy|an?\s+(?:enemy|["']|(?:Super|Extreme|AGL|TEQ|INT|STR|PHY)\b)|another|no|for\b|starting\b|on the\b|up to the\b|from the\b|HP\b|facing\b|\()/i.test(right)) {
            continue;
        }
        parts.push(sourceText.slice(lastIndex, index).replace(/[\s,]+$/g, "").trim());
        lastIndex = index + match[0].length;
    }
    if (parts.length === 0) {
        return [sourceText];
    }
    parts.push(sourceText.slice(lastIndex).trim());
    return parts.filter(Boolean);
}
function conditionDepthAt(sourceText, targetIndex) {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < targetIndex; index += 1) {
        if (sourceText[index] === "\"") {
            quoted = !quoted;
        }
        else if (!quoted && sourceText[index] === "(") {
            depth += 1;
        }
        else if (!quoted && sourceText[index] === ")") {
            depth -= 1;
        }
    }
    return depth;
}
function buildQuotedPredicateExpression(sourceText, build) {
    const parsed = parseQuotedValues(sourceText);
    if (!parsed) {
        return undefined;
    }
    const children = parsed.values.map(build);
    if (children.length === 1) {
        return children[0];
    }
    return {
        op: parsed.connector === "and" ? "all" : "any",
        children,
    };
}
function parseQuotedValues(sourceText) {
    const values = [...sourceText.matchAll(/"([^"]+)"/g)].map(match => match[1].trim()).filter(Boolean);
    if (values.length === 0) {
        return undefined;
    }
    const separators = sourceText.replace(/"[^"]+"/g, "#").trim();
    if (!/^#(?:\s*(?:,\s*)?(?:and|or)?\s*#)*$/i.test(separators)) {
        return undefined;
    }
    const hasAnd = /\band\b/i.test(separators);
    const hasOr = /\bor\b/i.test(separators);
    if (hasAnd && hasOr) {
        return undefined;
    }
    if (values.length > 1 && !hasAnd && !hasOr) {
        return undefined;
    }
    return {
        values,
        connector: hasAnd ? "and" : hasOr ? "or" : "single",
    };
}
function parseTypeValues(sourceText) {
    const parts = sourceText.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(normalizeType))];
}
function parseEffects(sourceText, context) {
    const resolvedTarget = resolveEffectTarget(sourceText);
    const parsedAtoms = parseEffectAtoms(resolvedTarget.body, context);
    const effects = parsedAtoms.atoms.map(atom => enrichCalculationPhase(applyEffectTarget(context.headerScaling
        && context.headerScaling.kind !== "hp_remaining"
        && atom.kind !== "ki_sphere_change"
        && !atom.scaling
        ? { ...atom, scaling: clonePassiveEffectScaling(context.headerScaling) }
        : atom, resolvedTarget), sourceText, context));
    effects.push(...parsedAtoms.unknownSegments.map(segment => unknownEffect(segment, resolvedTarget.target, resolvedTarget.categories, resolvedTarget.classes, resolvedTarget.types)));
    return {
        effects,
        status: effectListStatus(effects),
    };
}
function resolveEffectTarget(sourceText) {
    let text = sourceText.trim();
    let selfInclusion = "included";
    if (/\(self excluded\)/i.test(text)) {
        selfInclusion = "excluded";
        text = text.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    }
    else if (/\(self included\)/i.test(text)) {
        text = text.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    const allAlliesMatch = /^All allies['’]\s+(.+)$/i.exec(text);
    const categoryAlliesMatch = /^(.+?) Category allies['’]\s+(.+)$/i.exec(text);
    const classTypeAlliesMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type allies['’]\s+(.+)$/i.exec(text);
    const classAlliesMatch = /^(Super|Extreme) Class allies['’]\s+(.+)$/i.exec(text);
    const typeAlliesMatch = /^(.+?) Type allies['’]\s+(.+)$/i.exec(text);
    if (allAlliesMatch) {
        return {
            body: allAlliesMatch[1],
            target: { scope: "team_allies", selfInclusion },
        };
    }
    if (categoryAlliesMatch) {
        const parsedCategories = parseQuotedValues(categoryAlliesMatch[1]);
        if (!parsedCategories || parsedCategories.connector === "and") {
            return { body: text, target: { scope: "unknown" } };
        }
        return {
            body: categoryAlliesMatch[2],
            target: { scope: "category_allies", selfInclusion },
            categories: parsedCategories.values,
        };
    }
    if (classTypeAlliesMatch) {
        return {
            body: classTypeAlliesMatch[3],
            target: { scope: "class_type_allies", selfInclusion },
            classes: [normalizeClass(classTypeAlliesMatch[1])],
            types: [normalizeType(classTypeAlliesMatch[2])],
        };
    }
    if (classAlliesMatch) {
        return {
            body: classAlliesMatch[2],
            target: { scope: "class_allies", selfInclusion },
            classes: [normalizeClass(classAlliesMatch[1])],
        };
    }
    if (typeAlliesMatch) {
        const parsedTypes = parseTypeValues(typeAlliesMatch[1]);
        if (parsedTypes) {
            return {
                body: typeAlliesMatch[2],
                target: { scope: "type_allies", selfInclusion },
                types: parsedTypes,
            };
        }
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:all enemies|all enemies['’])/i.test(text)) {
        return { body: text, target: { scope: "all_enemies" } };
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:(?:the\s+)?attacked\s+enemy|(?:the\s+)?enemy)(?:['’]s)?/i.test(text)) {
        return { body: text, target: { scope: "enemy" } };
    }
    if (/^(?:.+?\s+allies|.+?\s+characters|All enemies|Attacked enemy|Enemy|Target enemy)['’]\s+/i.test(text)) {
        return { body: text, target: { scope: "unknown" } };
    }
    return { body: sourceText.trim(), target: { scope: "self" } };
}
function activationChanceFields(percent, probabilitySource = "explicit_text", qualitativeChanceTerm) {
    return {
        activationChancePercent: percent,
        chancePercent: percent,
        probabilitySource,
        ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
    };
}
function explicitAttackCount(sourceCount) {
    return /^an?$/i.test(sourceCount) ? 1 : Number(sourceCount);
}
function normalizeQualitativeChanceTerm(sourceTerm) {
    if (!sourceTerm) {
        return undefined;
    }
    const normalized = sourceTerm.trim().toLowerCase();
    if (normalized === "a" || normalized === "a chance") {
        return "a chance";
    }
    if (["rare", "medium", "high", "great"].includes(normalized)) {
        return normalized;
    }
    return undefined;
}
function resolveProbability(context, semantic, sourceTerm, sourcePercent) {
    const qualitativeChanceTerm = normalizeQualitativeChanceTerm(sourceTerm);
    if (sourcePercent !== undefined) {
        return {
            percent: Number(sourcePercent),
            ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
            probabilitySource: "explicit_text",
        };
    }
    if (qualitativeChanceTerm) {
        const firstParty = (0, team_analysis_first_party_probabilities_1.resolveFirstPartyProbability)(context.stateKey, context.rawText, context.ruleLineIndex, qualitativeChanceTerm, semantic);
        if (firstParty) {
            return {
                percent: firstParty.percent,
                qualitativeChanceTerm,
                probabilitySource: "first_party_game_db",
            };
        }
        const lexiconPercent = (0, team_analysis_chance_lexicon_1.validatedChancePercent)(qualitativeChanceTerm, semantic);
        if (lexiconPercent !== undefined) {
            return {
                percent: lexiconPercent,
                qualitativeChanceTerm,
                probabilitySource: "qualitative_lexicon",
            };
        }
        return { qualitativeChanceTerm, probabilitySource: "unresolved" };
    }
    return { probabilitySource: "unresolved" };
}
function activationProbabilityFields(probability) {
    return {
        ...(probability.percent !== undefined ? {
            activationChancePercent: probability.percent,
            chancePercent: probability.percent,
        } : {}),
        ...(probability.qualitativeChanceTerm ? { qualitativeChanceTerm: probability.qualitativeChanceTerm } : {}),
        probabilitySource: probability.probabilitySource,
    };
}
function additionalToSuperProbabilityFields(probability) {
    return {
        ...(probability.percent !== undefined ? { additionalToSuperChancePercent: probability.percent } : {}),
        ...(probability.qualitativeChanceTerm
            ? { additionalToSuperQualitativeChanceTerm: probability.qualitativeChanceTerm }
            : {}),
        additionalToSuperProbabilitySource: probability.probabilitySource,
    };
}
function parseEffectAtoms(body, context) {
    const candidates = [];
    const addMatches = (pattern, build, rejectUnknownChancePrefix = false) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            if (rejectUnknownChancePrefix
                && /\bchance of\s+$/i.test(body.slice(Math.max(0, start - 48), start))) {
                continue;
            }
            const atoms = build(match);
            if (atoms.length > 0) {
                candidates.push({ start, end: start + match[0].length, atoms });
            }
        }
    };
    if (context.headerScaling?.kind === "hp_remaining") {
        addMatches(/\bKi\s*\(up to\s+\+(\d+(?:\.\d+)?)\)/gi, match => [{
                kind: "ki",
                value: Number(match[1]),
                unit: "ki",
                scaling: clonePassiveEffectScaling(context.headerScaling),
                sourceText: match[0],
            }]);
        addMatches(/\b((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\(up to\s+(\d+(?:\.\d+)?)%\)/gi, match => {
            const maximumValue = Number(match[2]);
            return (match[1].match(/HP|ATK|DEF/gi) ?? []).map(kind => ({
                kind: kind.toLowerCase(),
                value: maximumValue,
                unit: "percent",
                scaling: clonePassiveEffectScaling(context.headerScaling),
                sourceText: match[0],
            }));
        });
    }
    addMatches(/\b(?:(?:(?<activationTerm>rare|medium|high|great)\s+chance(?:\s*\((?<activationParenPercent>\d+(?:\.\d+)?)%\))?|(?<activationPercent>\d+(?:\.\d+)?)%\s+chance|(?<activationArticle>a)\s+chance|(?<activationBare>chance))\s+of\s+)?launch(?:es|ing)\s+(?<attackCount>an?|\d+)\s+additional attack(?:\(s\)|s)?(?:,?\s*each of which|\s+that|\s+which)\s+(?:has|have)\s+(?:(?<conversionArticle>a)\s+chance|(?:a\s+)?(?:(?<conversionTerm>rare|medium|high|great)\s+chance(?:\s*\((?<conversionParenPercent>\d+(?:\.\d+)?)%\))?|(?<conversionPercent>\d+(?:\.\d+)?)%\s+chance)|(?<conversionBare>chance))\s+of becoming a Super Attack(?:\s+(?<conversionTrailingPercent>\d+(?:\.\d+)?)%)?/gi, match => {
        const groups = match.groups ?? {};
        const hasActivationChance = [groups.activationTerm, groups.activationPercent, groups.activationArticle, groups.activationBare].some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", groups.activationTerm ?? groups.activationArticle, groups.activationParenPercent ?? groups.activationPercent)
            : { percent: 100, probabilitySource: "explicit_text" };
        const conversion = resolveProbability(context, "additional_to_super", groups.conversionTerm ?? groups.conversionArticle, groups.conversionTrailingPercent ?? groups.conversionParenPercent ?? groups.conversionPercent);
        return [{
                kind: "additional_attack",
                count: explicitAttackCount(groups.attackCount),
                ...activationProbabilityFields(activation),
                ...additionalToSuperProbabilityFields(conversion),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional Super Attack(?:\(s\)|s)?(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[7] ?? match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "additional_super_attack",
                count: explicitAttackCount(match[6]),
                ...activationProbabilityFields(activation),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional attack(?:\(s\)|s)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "additional_attack",
                count: explicitAttackCount(match[6]),
                ...activationProbabilityFields(activation),
                sourceText: match[0],
            }];
    });
    const coordinatedPercentEffect = String.raw `(?:Chance of performing a critical hit|(?:Chance of )?evading enemy(?:'s|’s) attack|damage reduction(?: rate)?)`;
    addMatches(new RegExp(String.raw `\b(${coordinatedPercentEffect}(?:\s*(?:,\s*(?:and\s+)?|&|\band\b)\s*${coordinatedPercentEffect})+)\s+(\d+(?:\.\d+)?)%`, "gi"), match => {
        const percent = Number(match[2]);
        return [...match[1].matchAll(/Chance of performing a critical hit|(?:Chance of )?evading enemy(?:'s|’s) attack|damage reduction(?: rate)?/gi)].map(effectMatch => {
            if (/critical hit/i.test(effectMatch[0])) {
                return {
                    kind: "critical_chance",
                    value: percent,
                    unit: "percent",
                    ...activationChanceFields(percent),
                    sourceText: match[0],
                };
            }
            if (/evading/i.test(effectMatch[0])) {
                return {
                    kind: "evade_chance",
                    value: percent,
                    unit: "percent",
                    ...activationChanceFields(percent),
                    sourceText: match[0],
                };
            }
            return {
                kind: "damage_reduction",
                value: percent,
                unit: "percent",
                sourceText: match[0],
            };
        });
    });
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of performing a critical hit(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "critical_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
                kind: "critical_chance",
                ...(probability.percent !== undefined ? { value: probability.percent } : {}),
                unit: "percent",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of performing a critical hit/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
                kind: "critical_chance",
                value: activationChancePercent,
                unit: "percent",
                ...activationChanceFields(activationChancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:Performs a critical hit|All attacks become critical hits)\b/gi, match => [{
            kind: "critical_chance",
            value: 100,
            unit: "percent",
            ...activationChanceFields(100),
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of evading enemy(?:'s|’s) attack(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "evade_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
                kind: "evade_chance",
                ...(probability.percent !== undefined ? { value: probability.percent } : {}),
                unit: "percent",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of evading enemy(?:'s|’s) attack/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
                kind: "evade_chance",
                value: activationChancePercent,
                unit: "percent",
                ...activationChanceFields(activationChancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bEvades enemy(?:'s|’s) attack\b/gi, match => [{
            kind: "evade_chance",
            value: 100,
            unit: "percent",
            ...activationChanceFields(100),
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:stunning|stuns?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy)|all enemies)\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "stun_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "stun_chance",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy))['’]s\s+Super Attack(?:s)?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "super_attack_seal",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+all enemies['’]\s+Super Attacks?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "super_attack_seal",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\bChanges Ki Spheres:\s*(All|(?:(?:AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow))*))\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)\b/gi, match => {
        const sourceSelection = /^All$/i.test(match[1]) ? "all" : "listed_types";
        const sourceTypes = sourceSelection === "listed_types" ? parseConcreteKiSphereTypes(match[1]) : undefined;
        const destinationType = parseKiSphereDestination(match[2]);
        if (!destinationType || (sourceSelection === "listed_types" && !sourceTypes)) {
            return [];
        }
        return [{
                kind: "ki_sphere_change",
                kiSphereChange: {
                    sourceSelection,
                    ...(sourceTypes ? { sourceTypes } : {}),
                    destinationType,
                    kiContext: "board_state",
                },
                sourceText: match[0],
            }];
    });
    addMatches(/\bRandomly changes Ki Spheres of a certain Type(?:\s*\(((?:(?:AGL|TEQ|INT|STR|PHY)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY))*)\s+excluded)\))?\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s+Ki Spheres?)?\b/gi, match => {
        const destinationType = parseKiSphereDestination(match[2]);
        const excludedSourceTypes = match[1] ? parseExcludedKiSphereTypes(match[1]) : undefined;
        if (!destinationType || (match[1] && !excludedSourceTypes)) {
            return [];
        }
        return [{
                kind: "ki_sphere_change",
                kiSphereChange: {
                    sourceSelection: "random_type",
                    ...(excludedSourceTypes ? { excludedSourceTypes } : {}),
                    destinationType,
                    kiContext: "board_state",
                },
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?Ki\s*\+\s*(\d+(?:\.\d+)?)/gi, match => [{
            kind: "ki",
            value: Number(match[1]),
            unit: "ki",
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\+?\s*(\d+(?:\.\d+)?)(%)?/gi, match => {
        const value = Number(match[2]);
        const unit = match[3] ? "percent" : "flat";
        return (match[1].match(/HP|ATK|DEF/gi) ?? []).map(kind => ({
            kind: kind.toLowerCase(),
            value,
            unit,
            sourceText: match[0],
        }));
    });
    addMatches(/\bRecovers\s+(\d+(?:\.\d+)?)%\s+HP\b/gi, match => [{
            kind: "hp",
            value: Number(match[1]),
            unit: "percent",
            sourceText: match[0],
        }]);
    addMatches(/\bDamage reduction rate\s+(\d+(?:\.\d+)?)%/gi, match => [{
            kind: "damage_reduction",
            value: Number(match[1]),
            unit: "percent",
            sourceText: match[0],
        }]);
    addMatches(/\bChance of evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
                kind: "evade_chance",
                value: chancePercent,
                unit: "percent",
                ...activationChanceFields(chancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bChance of performing a critical hit\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
                kind: "critical_chance",
                value: chancePercent,
                unit: "percent",
                ...activationChanceFields(chancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bGuards all attacks\b/gi, match => [{
            kind: "guard",
            value: 1,
            unit: "boolean",
            sourceText: match[0],
        }]);
    addMatches(/\bAttacks are effective against all Types\b/gi, match => [{
            kind: "effective_against_all_types",
            value: 1,
            unit: "boolean",
            sourceText: match[0],
        }]);
    const selected = [];
    for (const candidate of candidates.sort((left, right) => left.start - right.start || right.end - left.end)) {
        if (!selected.some(existing => candidate.start < existing.end && candidate.end > existing.start)) {
            selected.push(candidate);
        }
    }
    selected.sort((left, right) => left.start - right.start);
    const modifiers = applyEffectModifiers(body, selected);
    return {
        atoms: selected.flatMap(candidate => candidate.atoms),
        unknownSegments: unknownSegmentsBetweenAtoms(body, [...selected, ...modifiers]),
    };
}
function applyEffectModifiers(body, atoms) {
    const candidates = [];
    const addModifiers = (pattern, build) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            candidates.push({
                start,
                end: start + match[0].length,
                apply: build(match),
            });
        }
    };
    addModifiers(/\bwithin the turn\b/gi, () => atom => {
        atom.duration = { kind: "within_turn" };
    });
    addModifiers(/\bfor\s+(\d+)\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, match => atom => {
        atom.duration = { kind: "turns", turns: Number(match[1]) };
    });
    addModifiers(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, () => atom => {
        atom.duration = { kind: "battle" };
    });
    addModifiers(/\(\s*up to\s+(\d+(?:\.\d+)?)%\s*\)/gi, match => atom => {
        if (atom.scaling?.kind !== "hp_remaining")
            atom.stackCap = Number(match[1]);
    });
    addModifiers(/\(\s*up to\s+\+(\d+(?:\.\d+)?)\s*\)/gi, match => atom => {
        if (atom.scaling?.kind !== "hp_remaining")
            atom.stackCap = Number(match[1]);
    });
    addModifiers(/\(\s*up to\s+(\d+(?:\.\d+)?)\s*\)/gi, match => atom => {
        if (atom.unit === "flat" && atom.scaling?.kind !== "hp_remaining") {
            atom.stackCap = Number(match[1]);
        }
    });
    // A standalone phase qualifier may sit between a typed value and its cap.
    // Consume only that complete qualifier; longer phrases such as
    // `when attacking as the 3rd attacker` remain evidence for the unsupported
    // portion instead of being silently discarded.
    addModifiers(/\bwhen attacking\b(?=\s*(?:\(\s*up to\b|$))/gi, () => () => undefined);
    addModifiers(/\bat the start of (?:the )?turn\b(?=\s*(?:\(\s*up to\b|$))/gi, () => () => undefined);
    addModifiers(/\bbefore attacking\b(?=\s*(?:\(\s*up to\b|$))/gi, () => () => undefined);
    for (const match of body.matchAll(/\bper\s+(?:(\d+)\s+)?(.*?)\s*Ki Spheres? obtained\b/gi)) {
        const start = match.index ?? 0;
        const spheresPerIncrement = Number(match[1] ?? 1);
        const kiSphereTypes = parseKiSphereTypes(match[2]);
        if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
            continue;
        }
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = {
                    kind: "per_ki_sphere",
                    kiSphereTypes,
                    spheresPerIncrement,
                    kiContext: "collected_ki_spheres",
                };
            },
        });
    }
    for (const match of body.matchAll(/\b(?:per|with each)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)|attack\s+evaded|final blow\s+delivered)\b/gi)) {
        const scaling = parseCombatEventScalingHeader(`For every ${match[1]}`);
        if (!scaling || scaling.kind !== "per_combat_event") {
            continue;
        }
        const start = match.index ?? 0;
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = clonePassiveEffectScaling(scaling);
            },
        });
    }
    const applied = [];
    for (const modifier of candidates.sort((left, right) => left.start - right.start || left.end - right.end)) {
        const preceding = [...atoms]
            .reverse()
            .find(atom => atom.end <= modifier.start && !body.slice(atom.end, modifier.start).includes(";"));
        if (!preceding) {
            continue;
        }
        const bridge = stripKnownModifierText(body.slice(preceding.end, modifier.start))
            .replace(/\bwhen attacking\b/gi, "")
            .replace(/\bwhen receiving (?:an?|the) attack\b/gi, "")
            .replace(/\bat the start of (?:the )?turn\b/gi, "")
            .replace(/\bbefore attacking\b/gi, "")
            .replace(/\bas the (?:1st|2nd|3rd) attacker in a turn\b/gi, "");
        if (!/^[\s,()]*$/.test(bridge)) {
            continue;
        }
        if (/up to/i.test(modifierText(body, modifier))
            && /%/.test(modifierText(body, modifier))
            && preceding.atoms.some(atom => atom.unit !== "percent")) {
            continue;
        }
        if (/^\(\s*up to\s+\d+(?:\.\d+)?\s*\)$/i.test(modifierText(body, modifier))
            && preceding.atoms.some(atom => atom.unit !== "flat")) {
            continue;
        }
        for (const atom of preceding.atoms) {
            modifier.apply(atom);
        }
        applied.push(modifier);
    }
    return applied;
}
function stripKnownModifierText(sourceText) {
    return sourceText
        .replace(/\bwithin the turn\b/gi, "")
        .replace(/\bfor\s+\d+\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, "")
        .replace(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, "")
        .replace(/\(\s*up to\s+\+?\d+(?:\.\d+)?%?\s*\)/gi, "")
        .replace(/\bper\s+(?:\d+\s+)?(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:attack\s+evaded|final blow\s+delivered)\b/gi, "");
}
function modifierText(body, modifier) {
    return body.slice(modifier.start, modifier.end);
}
function unknownSegmentsBetweenAtoms(body, atoms) {
    if (atoms.length === 0) {
        return body.trim() ? [body.trim()] : [];
    }
    const segments = [];
    let cursor = 0;
    for (const atom of [...atoms].sort((left, right) => left.start - right.start || left.end - right.end)) {
        if (atom.start < cursor) {
            cursor = Math.max(cursor, atom.end);
            continue;
        }
        const segment = cleanUnknownEffectSegment(body.slice(cursor, atom.start));
        if (segment) {
            segments.push(segment);
        }
        cursor = atom.end;
    }
    const finalSegment = cleanUnknownEffectSegment(body.slice(cursor));
    if (finalSegment) {
        segments.push(finalSegment);
    }
    return segments;
}
function cleanUnknownEffectSegment(sourceText) {
    let text = sourceText.trim();
    let previous;
    do {
        previous = text;
        text = text
            .replace(/^(?:and|plus)\b\s*/i, "")
            .replace(/\s*\b(?:and|plus)$/i, "")
            .replace(/^[,;&]+\s*/, "")
            .replace(/\s*[,;&]+$/, "")
            .trim();
    } while (text !== previous);
    return text.replace(/\s+/g, " ");
}
const BENEFICIAL_EFFECT_KINDS = new Set([
    "ki", "hp", "atk", "def", "damage_reduction", "guard", "evade_chance",
    "critical_chance", "additional_attack", "additional_super_attack",
    "effective_against_all_types", "ki_sphere_change", "scouter", "revive", "domain",
]);
function applyEffectTarget(atom, resolvedTarget) {
    const target = atom.kind === "ki_sphere_change"
        ? { scope: "self" }
        : { ...resolvedTarget.target };
    const allyTarget = isAllyTarget(target);
    return {
        ...atom,
        target,
        ...(resolvedTarget.categories ? { categories: resolvedTarget.categories } : {}),
        ...(resolvedTarget.classes ? { classes: resolvedTarget.classes } : {}),
        ...(resolvedTarget.types ? { types: resolvedTarget.types } : {}),
        ...(allyTarget && BENEFICIAL_EFFECT_KINDS.has(atom.kind)
            ? { classifications: ["support"] }
            : {}),
    };
}
const CALCULATION_BUCKET_EFFECT_KINDS = new Set(["atk", "def"]);
function enrichCalculationPhase(effect, effectSourceText, context) {
    if (effect.kind === "unknown") {
        return effect;
    }
    const explicitMoment = explicitActivationMoment(effectSourceText)
        ?? explicitActivationMoment(context.phaseContextText ?? "");
    const domainMoment = explicitMoment
        ? undefined
        : domainActivationMoment(context.phaseContextText, effect.scaling ?? context.headerScaling);
    const activationTiming = explicitMoment
        ? { moment: explicitMoment, source: "explicit_text" }
        : domainMoment
            ? { moment: domainMoment, source: "documented_domain_rule" }
            : { moment: "unresolved", source: "unresolved" };
    if (!CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
        return { ...effect, activationTiming };
    }
    return {
        ...effect,
        activationTiming,
        calculationBucket: resolveCalculationBucket(effectSourceText, context.phaseContextText, context.headerScaling),
    };
}
function explicitActivationMoment(sourceText) {
    if (/\bwhen performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(sourceText)) {
        return "when_performing_super_attack";
    }
    if (/\bafter (?:performing (?:a|an|\d+(?:\s+or\s+more)?) (?:Super |Ultra Super )?Attacks?|attacking)\b/i.test(sourceText)
        || /\bfor every (?:Super )?Attack performed\b/i.test(sourceText)) {
        return "after_attacking";
    }
    if (/\bbefore receiving (?:an?|the) attack\b/i.test(sourceText)) {
        return "before_incoming_attack";
    }
    if (/\bwhen receiving (?:an?|the) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attack\b/i.test(sourceText)) {
        return "when_targeted_by_attack";
    }
    if (/\bafter receiving or evading (?:an?|the) attack\b/i.test(sourceText)
        || /\bfor every attack received or evaded\b/i.test(sourceText)) {
        return "after_incoming_attack_resolved";
    }
    if (/\bafter (?:receiving|being hit by) (?:an?|the|\d+(?:\s+or\s+more)?) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attacks?\b/i.test(sourceText)
        || /\bfor every attack received(?!\s+or\s+evaded)\b/i.test(sourceText)) {
        return "after_attack_landed";
    }
    if (/\bwhen evading (?:an?|the) attack\b/i.test(sourceText)) {
        return "when_evading";
    }
    if (/\bafter evading (?:an?|the|\d+(?:\s+or\s+more)?) attacks?\b/i.test(sourceText)
        || /\bfor every attack evaded\b/i.test(sourceText)) {
        return "after_evading";
    }
    if (/\bafter (?:delivering (?:a|the)?\s*final blow|a final blow is delivered)\b/i.test(sourceText)
        || /\bfor every final blow delivered\b/i.test(sourceText)) {
        return "after_final_blow";
    }
    if (/\bbefore attacking\b/i.test(sourceText)) {
        return "before_attacking";
    }
    if (/\bwhen attacking\b/i.test(sourceText)) {
        return "when_attacking";
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(sourceText)) {
        return "start_of_turn";
    }
    return undefined;
}
function activationMomentFromCombatEvent(event) {
    if (event.eventType === "final_blow_delivered") {
        return event.relativeTiming === "after_event" ? "after_final_blow" : "unresolved";
    }
    if (event.eventType === "attack_evaded") {
        return event.relativeTiming === "after_event" ? "after_evading"
            : event.relativeTiming === "during_event" ? "when_evading"
                : "unresolved";
    }
    if (event.eventType === "incoming_attack") {
        return event.relativeTiming === "before_event" ? "before_incoming_attack"
            : event.relativeTiming === "during_event" ? "when_targeted_by_attack"
                : "unresolved";
    }
    if (event.eventType === "attack_landed") {
        return event.relativeTiming === "during_event" ? "when_attack_landed"
            : event.relativeTiming === "after_event" ? "after_attack_landed"
                : "unresolved";
    }
    if (event.attackKind === "super_attack" && event.relativeTiming === "during_event") {
        return "when_performing_super_attack";
    }
    return event.relativeTiming === "before_event" ? "before_attacking"
        : event.relativeTiming === "during_event" ? "when_attacking"
            : event.relativeTiming === "after_event" ? "after_attacking"
                : "unresolved";
}
function domainActivationMoment(phaseContextText, headerScaling) {
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "hp_remaining") {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_combat_event") {
        const events = headerScaling.events;
        if (events.length > 1
            && events.every(event => event.relativeTiming === "after_event")
            && events.some(event => event.eventType === "attack_landed")
            && events.some(event => event.eventType === "attack_evaded")) {
            return "after_incoming_attack_resolved";
        }
        const moments = [...new Set(events.map(activationMomentFromCombatEvent))];
        return moments.length === 1 && moments[0] !== "unresolved" ? moments[0] : undefined;
    }
    return undefined;
}
function resolveCalculationBucket(effectSourceText, phaseContextText, headerScaling) {
    const inlineMoment = explicitActivationMoment(effectSourceText);
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(effectSourceText)) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(effectSourceText)) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (inlineMoment) {
        return { bucket: "unresolved", source: "unresolved" };
    }
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (headerScaling?.kind === "hp_remaining") {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    return { bucket: "unresolved", source: "unresolved" };
}
function combineParseStatuses(conditionStatus, effectStatus) {
    if (conditionStatus === "supported" && effectStatus === "supported") {
        return "supported";
    }
    if (conditionStatus === "unknown" && effectStatus === "unknown") {
        return "unknown";
    }
    return "partial";
}
function confidenceFromStatus(status) {
    return status === "supported" ? "high" : status === "partial" ? "medium" : "low";
}
function unknownEffect(sourceText, target = { scope: "unknown" }, categories, classes, types) {
    return {
        kind: "unknown",
        target: { ...target },
        ...(categories ? { categories } : {}),
        ...(classes ? { classes } : {}),
        ...(types ? { types } : {}),
        sourceText,
    };
}
function unknownStandaloneRule(stateKey, block) {
    const fragment = block.source[block.source.length - 1];
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "unknown", sourceText: block.text },
        conditionStatus: "unknown",
        effects: [unknownEffect(block.text)],
        effectStatus: "unknown",
        source: block.source,
        parseStatus: "unknown",
        confidence: "low",
    };
}
function isStandalonePassiveAction(sourceText) {
    return /^Sneezes and switches personalities$/i.test(sourceText.trim());
}
function standalonePassiveActionRule(stateKey, block) {
    const fragment = block.source[block.source.length - 1];
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "always" },
        conditionStatus: "supported",
        effects: [unknownEffect(block.text, { scope: "self" })],
        effectStatus: "unknown",
        source: block.source,
        parseStatus: "partial",
        confidence: "medium",
    };
}
function trimmedFragment(rawLine, lineIndex) {
    const text = rawLine.trim();
    const start = rawLine.indexOf(text);
    return {
        lineIndex,
        text,
        start,
        end: start + text.length,
    };
}
function ruleIdFromFragment(stateKey, fragment) {
    return `${stateKey}:r${fragment.lineIndex}:${fragment.start ?? 0}:${fragment.end ?? fragment.text.length}`;
}
function uniqueOrderedFragments(fragments) {
    const byPosition = new Map();
    for (const fragment of fragments) {
        const key = `${fragment.lineIndex}:${fragment.start ?? ""}:${fragment.end ?? ""}:${fragment.text}`;
        byPosition.set(key, fragment);
    }
    return [...byPosition.values()].sort(compareFragments);
}
function compareFragments(left, right) {
    return left.lineIndex - right.lineIndex
        || (left.start ?? 0) - (right.start ?? 0)
        || (left.end ?? left.text.length) - (right.end ?? right.text.length)
        || left.text.localeCompare(right.text);
}
function aggregatePassiveStatus(rules) {
    if (rules.length === 0 || rules.every(rule => rule.parseStatus === "unknown")) {
        return "unknown";
    }
    if (rules.every(rule => rule.parseStatus === "supported")) {
        return "supported";
    }
    return "partial";
}
function countRuleStatuses(states) {
    const counts = { supported: 0, partial: 0, unknown: 0 };
    for (const state of states) {
        for (const rule of state.passive?.rules ?? []) {
            counts[rule.parseStatus] += 1;
        }
    }
    return counts;
}
function buildTeamAnalysisCoverageReport(dataset) {
    const passiveStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const ruleStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const conditionStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const effectStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const supportedPredicateCounts = {};
    const supportedEffectCounts = {};
    const probabilitySourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        qualitative_lexicon: 0,
        unresolved: 0,
    };
    const conditionCounts = { always: 0, predicate: 0, unknown: 0, composite: 0 };
    const enemySelectionCounts = {};
    const kiPredicateContextCounts = {};
    const kiSphereTypePredicateCounts = {};
    const scaledEffectSphereTypeCounts = {};
    const combatPredicateKindCounts = {};
    const combatEventTypeCounts = {};
    const combatAttackKindCounts = {};
    const combatAttackStyleCounts = {};
    const combatModeCounts = {};
    const combatCountScopeCounts = {};
    const combatRelativeTimingCounts = {};
    const conversionSourceSelectionCounts = {};
    const conversionDestinationTypeCounts = {};
    const activationMomentCounts = {
        start_of_turn: 0,
        before_attacking: 0,
        when_attacking: 0,
        when_performing_super_attack: 0,
        before_incoming_attack: 0,
        when_targeted_by_attack: 0,
        when_attack_landed: 0,
        after_incoming_attack_resolved: 0,
        after_attacking: 0,
        after_attack_landed: 0,
        when_evading: 0,
        after_evading: 0,
        after_final_blow: 0,
        unresolved: 0,
    };
    const activationSourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        dokkan_fyi_payload: 0,
        dokkan_fyi_structural_marker: 0,
        unresolved: 0,
    };
    const bucketCounts = {
        passive_start_of_turn: 0,
        passive_on_attack: 0,
        unresolved: 0,
    };
    const bucketSourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        dokkan_fyi_payload: 0,
        dokkan_fyi_structural_marker: 0,
        unresolved: 0,
    };
    const enemyStatusEvidenceResolutionCounts = { supported: 0, partial: 0, unresolved: 0 };
    const enemyStatusEvidenceStatusCounts = {};
    const enemyStatusEvidenceSourceCounts = {};
    let enemyStatusEvidenceStateCount = 0;
    let fullyRecoveredEnemyStatusStateCount = 0;
    let partialEnemyStatusStateCount = 0;
    let unresolvedEnemyStatusStateCount = 0;
    let enemyStatusEvidenceCount = 0;
    let passiveStructuralEvidenceCount = 0;
    let superAttackStructuralEvidenceCount = 0;
    let divergentStructuralCorroborationCount = 0;
    let structuralSemanticConflictCount = 0;
    const structuralMarkerCounts = {};
    const structuralResolutionCounts = {};
    const structuralSuperAttackVariantCounts = {};
    const activationLimitKindCounts = {};
    const applicationTriggerKindCounts = {};
    const lifecycleDurationSourceCounts = {};
    const stackingScopeCounts = {};
    let passiveStateCount = 0;
    let unknownEffectCount = 0;
    let unresolvedProbabilityEffectCount = 0;
    let derivedSupportEffectCount = 0;
    let unknownFragmentCount = 0;
    let teamEvaluableRuleCount = 0;
    let placementEvaluableRuleCount = 0;
    let scenarioRuleCount = 0;
    let scenarioEvaluableRuleCount = 0;
    let runtimeOnlyRuleCount = 0;
    let scaledEffectCount = 0;
    let activationEligibleEffectCount = 0;
    let bucketEligibleEffectCount = 0;
    let combatPredicateCount = 0;
    let combatScaledEffectCount = 0;
    let currentEventRuleCount = 0;
    let historyRuleCount = 0;
    const superAttackStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const superAttackConditionStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const superAttackEffectStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const superAttackEffectKindCounts = {};
    const superAttackTargetScopeCounts = {};
    const superAttackDurationKindCounts = {};
    const superAttackStackingKindCounts = {};
    const superAttackProbabilitySourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        qualitative_lexicon: 0,
        unresolved: 0,
    };
    const superAttackCalculationBucketCounts = {};
    const superAttackQualitativeChanceTermCounts = {};
    let superAttackCount = 0;
    let superAttackTypedEffectCount = 0;
    let superAttackNumericStatEffectCount = 0;
    let superAttackCappedStackingEffectCount = 0;
    let superAttackNumericProbabilityEffectCount = 0;
    let superAttackUnparsedFragmentCount = 0;
    for (const state of dataset.states) {
        for (const attack of state.superAttacks ?? []) {
            superAttackCount += 1;
            superAttackStatusCounts[attack.parseStatus] += 1;
            superAttackConditionStatusCounts[attack.condition.parseStatus] += 1;
            superAttackEffectStatusCounts[attack.effectStatus] += 1;
            superAttackUnparsedFragmentCount += attack.unparsedFragments.length;
            for (const evidence of attack.structuralEvidence ?? []) {
                superAttackStructuralEvidenceCount += 1;
                structuralSuperAttackVariantCounts[attack.variant] =
                    (structuralSuperAttackVariantCounts[attack.variant] ?? 0) + 1;
                collectStructuralEvidenceMetrics(evidence, structuralMarkerCounts, structuralResolutionCounts, value => { divergentStructuralCorroborationCount += value; }, value => { structuralSemanticConflictCount += value; });
            }
            for (const effect of attack.effects) {
                superAttackTypedEffectCount += 1;
                if (effect.value !== undefined)
                    superAttackNumericStatEffectCount += 1;
                superAttackEffectKindCounts[effect.kind] = (superAttackEffectKindCounts[effect.kind] ?? 0) + 1;
                superAttackTargetScopeCounts[effect.target.scope] = (superAttackTargetScopeCounts[effect.target.scope] ?? 0) + 1;
                superAttackDurationKindCounts[effect.duration.kind] = (superAttackDurationKindCounts[effect.duration.kind] ?? 0) + 1;
                lifecycleDurationSourceCounts[effect.duration.source] =
                    (lifecycleDurationSourceCounts[effect.duration.source] ?? 0) + 1;
                if (effect.activationLimit) {
                    activationLimitKindCounts[effect.activationLimit.kind] =
                        (activationLimitKindCounts[effect.activationLimit.kind] ?? 0) + 1;
                }
                if (effect.applicationTrigger) {
                    applicationTriggerKindCounts[effect.applicationTrigger.kind] =
                        (applicationTriggerKindCounts[effect.applicationTrigger.kind] ?? 0) + 1;
                }
                if (effect.stacking) {
                    superAttackStackingKindCounts[effect.stacking.kind] =
                        (superAttackStackingKindCounts[effect.stacking.kind] ?? 0) + 1;
                    if (effect.stacking.capPercent !== undefined)
                        superAttackCappedStackingEffectCount += 1;
                    const scope = effect.stacking.scope ?? "unknown";
                    stackingScopeCounts[scope] = (stackingScopeCounts[scope] ?? 0) + 1;
                }
                if (effect.probabilitySource) {
                    superAttackProbabilitySourceCounts[effect.probabilitySource] += 1;
                }
                if (effect.qualitativeChanceTerm) {
                    superAttackQualitativeChanceTermCounts[effect.qualitativeChanceTerm] =
                        (superAttackQualitativeChanceTermCounts[effect.qualitativeChanceTerm] ?? 0) + 1;
                }
                if (effect.activationChancePercent !== undefined)
                    superAttackNumericProbabilityEffectCount += 1;
                if (effect.calculationBucket) {
                    superAttackCalculationBucketCounts[effect.calculationBucket.bucket] =
                        (superAttackCalculationBucketCounts[effect.calculationBucket.bucket] ?? 0) + 1;
                }
            }
        }
        if (!state.passive) {
            continue;
        }
        passiveStateCount += 1;
        passiveStatusCounts[state.passive.parseStatus] += 1;
        unknownFragmentCount += state.passive.unparsedFragments.length;
        const statusEvidence = state.passive.conditionEvidence ?? [];
        for (const evidence of state.passive.structuralEvidence ?? []) {
            passiveStructuralEvidenceCount += 1;
            collectStructuralEvidenceMetrics(evidence, structuralMarkerCounts, structuralResolutionCounts, value => { divergentStructuralCorroborationCount += value; }, value => { structuralSemanticConflictCount += value; });
        }
        if (statusEvidence.length > 0) {
            enemyStatusEvidenceStateCount += 1;
            enemyStatusEvidenceCount += statusEvidence.length;
            statusEvidence.forEach(evidence => {
                enemyStatusEvidenceResolutionCounts[evidence.resolution] += 1;
                enemyStatusEvidenceSourceCounts[evidence.provenance.source] =
                    (enemyStatusEvidenceSourceCounts[evidence.provenance.source] ?? 0) + 1;
                evidence.statuses.forEach(status => {
                    if (status.status) {
                        enemyStatusEvidenceStatusCounts[status.status] =
                            (enemyStatusEvidenceStatusCounts[status.status] ?? 0) + 1;
                    }
                });
            });
            if (statusEvidence.every(evidence => evidence.resolution === "supported")) {
                fullyRecoveredEnemyStatusStateCount += 1;
            }
            else if (statusEvidence.every(evidence => evidence.resolution === "unresolved")) {
                unresolvedEnemyStatusStateCount += 1;
            }
            else {
                partialEnemyStatusStateCount += 1;
            }
        }
        for (const rule of state.passive.rules) {
            ruleStatusCounts[rule.parseStatus] += 1;
            conditionStatusCounts[rule.conditionStatus] += 1;
            effectStatusCounts[rule.effectStatus] += 1;
            const conditionKind = classifyCondition(rule.condition);
            conditionCounts[conditionKind] += 1;
            const hasScenario = hasScenarioPredicate(rule.condition);
            const hasRuntime = hasRuntimePredicate(rule.condition);
            const hasPlacement = hasPlacementPredicate(rule.condition);
            if (hasScenario) {
                scenarioRuleCount += 1;
            }
            if (hasRuntime) {
                runtimeOnlyRuleCount += 1;
            }
            if (rule.conditionStatus === "supported" && !hasRuntime) {
                if (hasScenario) {
                    scenarioEvaluableRuleCount += 1;
                }
                else if (hasPlacement) {
                    placementEvaluableRuleCount += 1;
                }
                else {
                    teamEvaluableRuleCount += 1;
                }
            }
            collectPredicates(rule.condition, supportedPredicateCounts);
            collectEnemySelections(rule.condition, enemySelectionCounts);
            collectKiPredicateMetrics(rule.condition, kiPredicateContextCounts, kiSphereTypePredicateCounts);
            const combatPredicates = collectCombatPredicates(rule.condition);
            let ruleHasCurrentCombatEvent = false;
            let ruleHasCombatHistory = false;
            for (const predicate of combatPredicates) {
                combatPredicateCount += 1;
                combatPredicateKindCounts[predicate.kind] = (combatPredicateKindCounts[predicate.kind] ?? 0) + 1;
                if (predicate.combatEvent) {
                    collectCombatEventMetrics(predicate.combatEvent, combatEventTypeCounts, combatAttackKindCounts, combatAttackStyleCounts, combatModeCounts, combatCountScopeCounts, combatRelativeTimingCounts);
                    ruleHasCurrentCombatEvent ||= predicate.combatEvent.mode === "current_event";
                    ruleHasCombatHistory ||= predicate.combatEvent.mode === "accumulated_count";
                }
            }
            for (const effect of rule.effects) {
                if (effect.kind === "unknown") {
                    unknownEffectCount += 1;
                }
                else {
                    supportedEffectCounts[effect.kind] = (supportedEffectCounts[effect.kind] ?? 0) + 1;
                }
                if (effect.classifications?.includes("support")) {
                    derivedSupportEffectCount += 1;
                }
                if (effect.activationLimit) {
                    activationLimitKindCounts[effect.activationLimit.kind] =
                        (activationLimitKindCounts[effect.activationLimit.kind] ?? 0) + 1;
                }
                if (effect.applicationTrigger) {
                    applicationTriggerKindCounts[effect.applicationTrigger.kind] =
                        (applicationTriggerKindCounts[effect.applicationTrigger.kind] ?? 0) + 1;
                }
                if (effect.duration?.source) {
                    lifecycleDurationSourceCounts[effect.duration.source] =
                        (lifecycleDurationSourceCounts[effect.duration.source] ?? 0) + 1;
                }
                if (effect.stacking) {
                    const scope = effect.stacking.scope ?? "unknown";
                    stackingScopeCounts[scope] = (stackingScopeCounts[scope] ?? 0) + 1;
                }
                const probabilitySources = [effect.probabilitySource, effect.additionalToSuperProbabilitySource]
                    .filter((source) => source !== undefined);
                for (const source of probabilitySources) {
                    probabilitySourceCounts[source] += 1;
                }
                if (probabilitySources.includes("unresolved")) {
                    unresolvedProbabilityEffectCount += 1;
                }
                if (effect.scaling?.kind === "per_ki_sphere") {
                    scaledEffectCount += 1;
                    for (const type of effect.scaling.kiSphereTypes) {
                        scaledEffectSphereTypeCounts[type] = (scaledEffectSphereTypeCounts[type] ?? 0) + 1;
                    }
                }
                if (effect.scaling?.kind === "per_combat_event") {
                    combatScaledEffectCount += 1;
                    ruleHasCombatHistory = true;
                    effect.scaling.events.forEach(event => collectCombatEventMetrics(event, combatEventTypeCounts, combatAttackKindCounts, combatAttackStyleCounts, combatModeCounts, combatCountScopeCounts, combatRelativeTimingCounts));
                }
                if (effect.kiSphereChange) {
                    const selection = effect.kiSphereChange.sourceSelection;
                    const destination = effect.kiSphereChange.destinationType;
                    conversionSourceSelectionCounts[selection] = (conversionSourceSelectionCounts[selection] ?? 0) + 1;
                    conversionDestinationTypeCounts[destination] = (conversionDestinationTypeCounts[destination] ?? 0) + 1;
                }
                if (effect.kind !== "unknown") {
                    activationEligibleEffectCount += 1;
                    activationMomentCounts[effect.activationTiming?.moment ?? "unresolved"] += 1;
                    activationSourceCounts[effect.activationTiming?.source ?? "unresolved"] += 1;
                }
                if (CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
                    bucketEligibleEffectCount += 1;
                    bucketCounts[effect.calculationBucket?.bucket ?? "unresolved"] += 1;
                    bucketSourceCounts[effect.calculationBucket?.source ?? "unresolved"] += 1;
                }
            }
            if (ruleHasCurrentCombatEvent) {
                currentEventRuleCount += 1;
            }
            if (ruleHasCombatHistory) {
                historyRuleCount += 1;
            }
        }
    }
    return {
        generatedAt: dataset.generatedAt,
        sourceCharacterDatasetVersion: dataset.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: dataset.sourceCharacterPayloadSha256,
        sourceStateCount: dataset.stateCount,
        passiveStateCount,
        passiveStatusCounts,
        parsedRuleCount: dataset.supportedRuleCount + dataset.partialRuleCount + dataset.unknownRuleCount,
        ruleStatusCounts,
        conditionStatusCounts,
        effectStatusCounts,
        conditionCounts,
        supportedPredicateCounts: sortedRecord(supportedPredicateCounts),
        supportedEffectCounts: sortedRecord(supportedEffectCounts),
        derivedSupportEffectCount,
        unknownEffectCount,
        unresolvedProbabilityEffectCount,
        probabilitySourceCounts,
        unknownFragmentCount,
        teamEvaluableRuleCount,
        placementEvaluableRuleCount,
        scenarioRuleCount,
        scenarioEvaluableRuleCount,
        enemySelectionCounts: sortedRecord(enemySelectionCounts),
        enemyStatusEvidence: {
            stateCount: enemyStatusEvidenceStateCount,
            evidenceCount: enemyStatusEvidenceCount,
            fullyRecoveredStateCount: fullyRecoveredEnemyStatusStateCount,
            partialStateCount: partialEnemyStatusStateCount,
            unresolvedStateCount: unresolvedEnemyStatusStateCount,
            resolutionCounts: enemyStatusEvidenceResolutionCounts,
            statusCounts: sortedRecord(enemyStatusEvidenceStatusCounts),
            sourceCounts: sortedRecord(enemyStatusEvidenceSourceCounts),
        },
        structuralEvidence: {
            evidenceCount: passiveStructuralEvidenceCount + superAttackStructuralEvidenceCount,
            passiveEvidenceCount: passiveStructuralEvidenceCount,
            superAttackEvidenceCount: superAttackStructuralEvidenceCount,
            markerCounts: sortedRecord(structuralMarkerCounts),
            resolutionCounts: sortedRecord(structuralResolutionCounts),
            superAttackVariantCounts: sortedRecord(structuralSuperAttackVariantCounts),
            divergentCorroborationCount: divergentStructuralCorroborationCount,
            semanticConflictCount: structuralSemanticConflictCount,
        },
        lifecycle: {
            activationLimitKindCounts: sortedRecord(activationLimitKindCounts),
            applicationTriggerKindCounts: sortedRecord(applicationTriggerKindCounts),
            durationSourceCounts: sortedRecord(lifecycleDurationSourceCounts),
            stackingScopeCounts: sortedRecord(stackingScopeCounts),
        },
        kiAnalysis: {
            predicateContextCounts: sortedRecord(kiPredicateContextCounts),
            sphereTypePredicateCounts: sortedRecord(kiSphereTypePredicateCounts),
            scaledEffectCount,
            scaledEffectSphereTypeCounts: sortedRecord(scaledEffectSphereTypeCounts),
            conversionSourceSelectionCounts: sortedRecord(conversionSourceSelectionCounts),
            conversionDestinationTypeCounts: sortedRecord(conversionDestinationTypeCounts),
        },
        calculationPhase: {
            activationEligibleEffectCount,
            activationMomentCounts,
            activationSourceCounts,
            bucketEligibleEffectCount,
            bucketCounts,
            bucketSourceCounts,
        },
        combatEvents: {
            predicateCount: combatPredicateCount,
            scaledEffectCount: combatScaledEffectCount,
            currentEventRuleCount,
            historyRuleCount,
            predicateKindCounts: sortedRecord(combatPredicateKindCounts),
            eventTypeCounts: sortedRecord(combatEventTypeCounts),
            attackKindCounts: sortedRecord(combatAttackKindCounts),
            attackStyleCounts: sortedRecord(combatAttackStyleCounts),
            modeCounts: sortedRecord(combatModeCounts),
            countScopeCounts: sortedRecord(combatCountScopeCounts),
            relativeTimingCounts: sortedRecord(combatRelativeTimingCounts),
        },
        superAttacks: {
            attackCount: superAttackCount,
            attackStatusCounts: superAttackStatusCounts,
            conditionStatusCounts: superAttackConditionStatusCounts,
            effectStatusCounts: superAttackEffectStatusCounts,
            typedEffectCount: superAttackTypedEffectCount,
            numericStatEffectCount: superAttackNumericStatEffectCount,
            effectKindCounts: sortedRecord(superAttackEffectKindCounts),
            targetScopeCounts: sortedRecord(superAttackTargetScopeCounts),
            durationKindCounts: sortedRecord(superAttackDurationKindCounts),
            stackingKindCounts: sortedRecord(superAttackStackingKindCounts),
            cappedStackingEffectCount: superAttackCappedStackingEffectCount,
            probabilitySourceCounts: superAttackProbabilitySourceCounts,
            qualitativeChanceTermCounts: sortedRecord(superAttackQualitativeChanceTermCounts),
            numericProbabilityEffectCount: superAttackNumericProbabilityEffectCount,
            calculationBucketCounts: sortedRecord(superAttackCalculationBucketCounts),
            unparsedFragmentCount: superAttackUnparsedFragmentCount,
        },
        runtimeOnlyRuleCount,
        identity: {
            variantGroupAssignedStateCount: dataset.states.filter(state => Boolean(state.variantGroupId)).length,
            variantGroupOmittedStateCount: dataset.states.filter(state => !state.variantGroupId).length,
            awakeningFamilyAssignedStateCount: dataset.states.filter(state => Boolean(state.awakeningFamilyId)).length,
        },
    };
}
exports.buildTeamAnalysisCoverageReport = buildTeamAnalysisCoverageReport;
function collectStructuralEvidenceMetrics(evidence, markerCounts, resolutionCounts, addDivergence, addConflict) {
    resolutionCounts[evidence.resolution] = (resolutionCounts[evidence.resolution] ?? 0) + 1;
    for (const marker of evidence.markers) {
        markerCounts[marker.markerKind] = (markerCounts[marker.markerKind] ?? 0) + 1;
    }
    addDivergence((evidence.corroboration ?? []).filter(item => item.resolution === "divergent").length);
    addConflict(evidence.semanticConflicts?.length ?? 0);
}
function classifyCondition(condition) {
    if (condition.op === "always" || condition.op === "predicate" || condition.op === "unknown") {
        return condition.op;
    }
    return "composite";
}
const SCENARIO_PREDICATES = new Set([
    "hp_percent", "battle_turn", "turn_from_entry", "next_attacking_turn", "turn_number", "turns_from_entry",
    "enemy_count", "enemy_category",
    "enemy_name", "enemy_class", "enemy_type", "enemy_class_type", "enemy_hp_percent",
    "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
    "all_rotation_allies_obtained_ki_sphere", "giant_form_ended",
]);
const RUNTIME_PREDICATES = new Set([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "ki_sphere_collection_order", "incoming_attack",
    "incoming_super_attack", "incoming_attack_from_enemy_hit_by_self_super_attack", "attacks_performed",
    "attacks_received", "attacks_evaded", "super_attacks_performed", "super_attack_received",
    "final_blow_delivered", "chance_roll",
]);
const PLACEMENT_PREDICATES = new Set([
    "battle_slot", "rotation_assignment", "rotation_partner_present", "floater_assignment",
]);
function hasScenarioPredicate(condition) {
    return conditionHasPredicate(condition, predicate => SCENARIO_PREDICATES.has(predicate.kind));
}
function hasRuntimePredicate(condition) {
    return conditionHasPredicate(condition, predicate => RUNTIME_PREDICATES.has(predicate.kind));
}
function hasPlacementPredicate(condition) {
    return conditionHasPredicate(condition, predicate => PLACEMENT_PREDICATES.has(predicate.kind));
}
function conditionHasPredicate(condition, predicateMatcher) {
    if (condition.op === "predicate") {
        return predicateMatcher(condition.predicate);
    }
    if (condition.op === "not") {
        return conditionHasPredicate(condition.child, predicateMatcher);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.some(child => conditionHasPredicate(child, predicateMatcher));
    }
    return false;
}
function collectPredicates(condition, counts) {
    if (condition.op === "predicate") {
        counts[condition.predicate.kind] = (counts[condition.predicate.kind] ?? 0) + 1;
        return;
    }
    if (condition.op === "not") {
        collectPredicates(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectPredicates(child, counts));
    }
}
function collectEnemySelections(condition, counts) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemySelection) {
            counts[condition.predicate.enemySelection] = (counts[condition.predicate.enemySelection] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectEnemySelections(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectEnemySelections(child, counts));
    }
}
function collectKiPredicateMetrics(condition, contextCounts, sphereTypeCounts) {
    if (condition.op === "predicate") {
        if (condition.predicate.kiContext) {
            contextCounts[condition.predicate.kiContext] = (contextCounts[condition.predicate.kiContext] ?? 0) + 1;
        }
        for (const type of condition.predicate.kiSphereTypes ?? []) {
            sphereTypeCounts[type] = (sphereTypeCounts[type] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectKiPredicateMetrics(condition.child, contextCounts, sphereTypeCounts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectKiPredicateMetrics(child, contextCounts, sphereTypeCounts));
    }
}
function collectCombatPredicates(condition) {
    if (condition.op === "predicate") {
        return condition.predicate.combatEvent ? [condition.predicate] : [];
    }
    if (condition.op === "not") {
        return collectCombatPredicates(condition.child);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.flatMap(collectCombatPredicates);
    }
    return [];
}
function collectCombatEventMetrics(event, eventTypeCounts, attackKindCounts, attackStyleCounts, modeCounts, countScopeCounts, relativeTimingCounts) {
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
    attackKindCounts[event.attackKind] = (attackKindCounts[event.attackKind] ?? 0) + 1;
    if (event.attackStyle) {
        attackStyleCounts[event.attackStyle] = (attackStyleCounts[event.attackStyle] ?? 0) + 1;
    }
    modeCounts[event.mode] = (modeCounts[event.mode] ?? 0) + 1;
    if (event.countScope) {
        countScopeCounts[event.countScope] = (countScopeCounts[event.countScope] ?? 0) + 1;
    }
    relativeTimingCounts[event.relativeTiming] = (relativeTimingCounts[event.relativeTiming] ?? 0) + 1;
}
function sortedRecord(record) {
    return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
function validateTeamAnalysisDataset(dataset, characters, catalogEntries, options = {}) {
    const issues = [];
    const stateKeys = new Set();
    const ruleIds = new Set();
    const expectedStates = expectedStateIdentities(characters, catalogEntries, options.cardIdentityContract);
    const expectedSources = expectedStateSources(characters, options.activeSkillActivationContract, options.transformationActivationContract);
    if (dataset.stateCount !== dataset.states.length) {
        issues.push({ code: "state-count", message: `stateCount ${dataset.stateCount} does not match ${dataset.states.length} states.` });
    }
    const actualRuleCounts = countRuleStatuses(dataset.states);
    for (const status of ["supported", "partial", "unknown"]) {
        const field = `${status}RuleCount`;
        if (dataset[field] !== actualRuleCounts[status]) {
            issues.push({ code: "rule-count", message: `${field} ${dataset[field]} does not match ${actualRuleCounts[status]}.` });
        }
    }
    for (const state of dataset.states) {
        if (stateKeys.has(state.stateKey)) {
            issues.push({ code: "duplicate-state-key", message: `Duplicate state key ${state.stateKey}.`, stateKey: state.stateKey });
        }
        stateKeys.add(state.stateKey);
        const expected = expectedStates.get(state.stateKey);
        if (!expected) {
            issues.push({ code: "missing-reference", message: `State does not reference a character/form/release in the character payload.`, stateKey: state.stateKey });
        }
        else {
            validateStableIdentity(state, expected, issues);
            validateStateSource(state, expectedSources.get(state.stateKey), issues, options.allowExternalActiveSkillConditions ?? false, options.transformationActivationContract !== undefined);
        }
        validatePassive(state, ruleIds, issues);
    }
    for (const stateKey of expectedStates.keys()) {
        if (!stateKeys.has(stateKey)) {
            issues.push({ code: "missing-state", message: `Character payload state ${stateKey} is absent.`, stateKey });
        }
    }
    return issues;
}
exports.validateTeamAnalysisDataset = validateTeamAnalysisDataset;
function assertValidTeamAnalysisDataset(dataset, characters, catalogEntries, options = {}) {
    const issues = validateTeamAnalysisDataset(dataset, characters, catalogEntries, options);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => {
            const location = [issue.stateKey, issue.ruleId].filter(Boolean).join(" / ");
            return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
        }).join("\n");
        throw new Error(`Team analysis validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}
exports.assertValidTeamAnalysisDataset = assertValidTeamAnalysisDataset;
/**
 * Validates a serialized delivery bundle against the exact character payload
 * without requiring the catalog that was used while generating it. Catalog-
 * derived identity values must remain internally consistent for every card;
 * all character/form/release sources are still validated by the normal
 * validator below.
 */
function validateTeamAnalysisDatasetForDelivery(dataset, characters) {
    const issues = [];
    const catalogEntries = [];
    for (const character of characters) {
        const characterStates = dataset.states.filter(state => state.characterId === character.id);
        const firstState = characterStates[0];
        if (!firstState) {
            continue;
        }
        const expectedIdentity = JSON.stringify({
            canonicalId: firstState.canonicalId,
            gameCharacterId: firstState.gameCharacterId,
            baseCharacterId: firstState.baseCharacterId,
            variantGroupId: firstState.variantGroupId,
            awakeningFamilyId: firstState.awakeningFamilyId,
        });
        for (const state of characterStates.slice(1)) {
            const actualIdentity = JSON.stringify({
                canonicalId: state.canonicalId,
                gameCharacterId: state.gameCharacterId,
                baseCharacterId: state.baseCharacterId,
                variantGroupId: state.variantGroupId,
                awakeningFamilyId: state.awakeningFamilyId,
            });
            if (actualIdentity !== expectedIdentity) {
                issues.push({
                    code: "inconsistent-delivery-identity",
                    message: "Catalog-derived identity values differ across states of the same character.",
                    stateKey: state.stateKey,
                });
            }
        }
        catalogEntries.push({
            id: character.id,
            ...(firstState.canonicalId ? { canonicalId: firstState.canonicalId } : {}),
            ...(firstState.gameCharacterId ? { characterId: firstState.gameCharacterId } : {}),
            // The catalog type requires this field, but delivery validation must
            // preserve an actually absent catalog identity as undefined.
            baseCharacterId: firstState.baseCharacterId,
            name: character.name,
            hasEza: false,
            hasSeza: false,
            isReversiblyExchanged: false,
            isFreelyObtainable: false,
            isStageDropReward: false,
            isWorldTournamentReward: false,
            hasBattleMotion: false,
            sourceUrl: "",
        });
    }
    return [
        ...issues,
        ...validateTeamAnalysisDataset(dataset, characters, catalogEntries, {
            allowExternalActiveSkillConditions: true,
        }),
    ];
}
exports.validateTeamAnalysisDatasetForDelivery = validateTeamAnalysisDatasetForDelivery;
function assertValidTeamAnalysisDatasetForDelivery(dataset, characters) {
    const issues = validateTeamAnalysisDatasetForDelivery(dataset, characters);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => {
            const location = [issue.stateKey, issue.ruleId].filter(Boolean).join(" / ");
            return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
        }).join("\n");
        throw new Error(`Team analysis delivery validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}
exports.assertValidTeamAnalysisDatasetForDelivery = assertValidTeamAnalysisDatasetForDelivery;
function expectedStateIdentities(characters, catalogEntries, cardIdentityContract) {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const expected = new Map();
    for (const character of characters) {
        const catalogEntry = catalogById.get(character.id);
        for (const form of [character, ...(character.transformations ?? [])]) {
            for (const releaseSource of analysisReleaseSources(form)) {
                const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState, cardIdentityContract);
                expected.set(buildStateKey(identity.characterId, identity.formId, identity.releaseState), identity);
            }
        }
    }
    return expected;
}
function expectedStateSources(characters, activeSkillActivationContract, transformationActivationContract) {
    const expected = new Map();
    for (const character of characters) {
        for (const form of [character, ...(character.transformations ?? [])]) {
            const releaseSources = analysisReleaseSources(form);
            for (const releaseSource of releaseSources) {
                expected.set(buildStateKey(character.id, form.id, releaseSource.releaseState), {
                    displayName: form.name,
                    passiveText: releaseSource.passiveText,
                    ...(releaseSource.passiveDetails ? { passiveDetails: releaseSource.passiveDetails } : {}),
                    ...(resolvedActiveSkillActivationCondition(form, releaseSource.releaseState, activeSkillActivationContract)
                        ? {
                            activeSkillActivationCondition: resolvedActiveSkillActivationCondition(form, releaseSource.releaseState, activeSkillActivationContract),
                        }
                        : {}),
                    ...(form.id !== character.id && transformationActivationContract?.get(buildTransformationActivationContractKey(character.id, form.id))
                        ? {
                            transformationActivationCondition: transformationActivationContract.get(buildTransformationActivationContractKey(character.id, form.id)),
                        }
                        : {}),
                    superAttacks: analysisSuperAttackSources(form, releaseSource.releaseState, releaseSources.length === 1),
                });
            }
        }
    }
    return expected;
}
function validateStableIdentity(state, expected, issues) {
    const fields = [
        "characterId", "canonicalId", "gameCharacterId", "baseCharacterId", "hardDuplicateGroupId",
        "variantGroupId", "awakeningFamilyId", "formId", "releaseState",
    ];
    for (const field of fields) {
        if (state[field] !== expected[field]) {
            issues.push({
                code: "unstable-identity",
                message: `${field} is ${String(state[field])}; expected ${String(expected[field])} from source IDs.`,
                stateKey: state.stateKey,
            });
        }
    }
    const expectedStateKey = buildStateKey(state.characterId, state.formId, state.releaseState);
    if (state.stateKey !== expectedStateKey) {
        issues.push({ code: "unstable-state-key", message: `Expected ${expectedStateKey}.`, stateKey: state.stateKey });
    }
}
function validateStateSource(state, expected, issues, allowExternalActiveSkillConditions, enforceTransformationActivationCondition) {
    if (!expected) {
        return;
    }
    if (state.displayName !== expected.displayName) {
        issues.push({ code: "display-name-source", message: `Display name does not match the character form.`, stateKey: state.stateKey });
    }
    const activeSkillMatches = JSON.stringify(state.activeSkillActivationCondition)
        === JSON.stringify(expected.activeSkillActivationCondition);
    const validExternalActiveSkill = allowExternalActiveSkillConditions
        && state.activeSkillActivationCondition !== undefined
        && isValidExternalActiveSkillCondition(state.activeSkillActivationCondition);
    if (!activeSkillMatches && !validExternalActiveSkill) {
        issues.push({
            code: "active-skill-condition-source",
            message: "Active Skill activation condition does not exactly match the character payload.",
            stateKey: state.stateKey,
        });
    }
    if (enforceTransformationActivationCondition
        && JSON.stringify(state.transformationActivationCondition)
            !== JSON.stringify(expected.transformationActivationCondition)) {
        issues.push({
            code: "transformation-activation-condition-source",
            message: "Transformation activation condition does not exactly match the first-party contract.",
            stateKey: state.stateKey,
        });
    }
    if (expected.passiveText) {
        if (state.passive?.rawText !== expected.passiveText) {
            issues.push({ code: "passive-text-source", message: `Passive rawText does not exactly match the character form.`, stateKey: state.stateKey });
        }
        if (expected.passiveDetails) {
            const sourceMap = mapPassiveDetailsToSource(expected.passiveText, expected.passiveDetails);
            if (sourceMap.unmappedTexts.length > 0) {
                issues.push({
                    code: "passive-details-source-map",
                    message: `${sourceMap.unmappedTexts.length} PassiveDetails text(s) do not map to rawText offsets.`,
                    stateKey: state.stateKey,
                });
            }
            const sourceEvidence = expected.passiveDetails.conditionEvidence ?? [];
            const validEvidence = validConditionEvidence(state.stateKey, expected.passiveText, sourceMap.sourceFragments, sourceEvidence, {
                characterId: state.characterId,
                formId: state.formId,
                releaseState: state.releaseState,
                ...(expected.passiveDetails.sourceSkillId
                    ? { passiveSkillSetId: expected.passiveDetails.sourceSkillId }
                    : {}),
            });
            if (validEvidence.length !== sourceEvidence.length) {
                issues.push({
                    code: "condition-evidence-source",
                    message: `${sourceEvidence.length - validEvidence.length} condition evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            if (JSON.stringify(state.passive?.conditionEvidence ?? []) !== JSON.stringify(validEvidence)) {
                issues.push({
                    code: "condition-evidence-output",
                    message: `Serialized condition evidence does not match the validated PassiveDetails evidence.`,
                    stateKey: state.stateKey,
                });
            }
            const sourceStructuralEvidence = expected.passiveDetails.structuralSource?.evidence ?? [];
            const validStructural = validStructuralEvidence(state.stateKey, expected.passiveText, expected.passiveDetails.structuralSource, "passive", undefined, expected.passiveDetails.sourceSkillId);
            if (validStructural.length !== sourceStructuralEvidence.length) {
                issues.push({
                    code: "structural-evidence-source",
                    message: `${sourceStructuralEvidence.length - validStructural.length} passive structural evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            const expectedStructuralOutput = parsePassive(state.stateKey, expected.passiveDetails.name, expected.passiveText, expected.passiveDetails, {
                characterId: state.characterId,
                formId: state.formId,
                releaseState: state.releaseState,
                ...(expected.passiveDetails.sourceSkillId
                    ? { passiveSkillSetId: expected.passiveDetails.sourceSkillId }
                    : {}),
            }).structuralEvidence ?? [];
            if (JSON.stringify(state.passive?.structuralEvidence ?? []) !== JSON.stringify(expectedStructuralOutput)) {
                issues.push({
                    code: "structural-evidence-output",
                    message: `Serialized passive structural evidence does not match validated source evidence.`,
                    stateKey: state.stateKey,
                });
            }
        }
    }
    else if (state.passive) {
        issues.push({ code: "unexpected-passive", message: `Analysis contains a passive absent from the character form.`, stateKey: state.stateKey });
    }
    validateSuperAttacks(state, expected.superAttacks, issues);
}
function isValidExternalActiveSkillCondition(condition) {
    const activeSkillSet = condition.provenance.activeSkillSet;
    const causalities = condition.provenance.causalities;
    if (activeSkillSet.table !== "active_skill_sets" || !/^\d+$/.test(activeSkillSet.rowId)) {
        return false;
    }
    if (causalities.length === 0
        || causalities.some(reference => reference.table !== "skill_causalities" || !/^\d+$/.test(reference.rowId))) {
        return false;
    }
    const declaredIds = new Set(causalities.map(reference => reference.rowId));
    const statuses = [];
    const visit = (expression) => {
        if (expression.op === "predicate") {
            statuses.push(expression.predicate.evidenceStatus);
            const provenance = expression.predicate.provenance;
            return provenance.table === "skill_causalities"
                && declaredIds.has(provenance.rowId)
                && Number.isSafeInteger(provenance.causalityType)
                && provenance.causalityType > 0
                && provenance.values.length === 3
                && provenance.values.every(Number.isSafeInteger)
                && isValidActiveSkillPredicateShape(expression.predicate);
        }
        return expression.children.length > 0 && expression.children.every(visit);
    };
    if (!visit(condition.expression))
        return false;
    const expectedStatus = statuses.includes("unknown")
        ? "unknown"
        : statuses.includes("partial")
            ? "partial"
            : "supported";
    return condition.status === expectedStatus;
}
function isValidActiveSkillPredicateShape(predicate) {
    const categories = predicate.categories ?? [];
    const classes = predicate.classes ?? [];
    const hasNoDimensions = categories.length === 0 && classes.length === 0;
    const hasNoThreshold = predicate.comparator === undefined
        && predicate.value === undefined
        && predicate.count === undefined;
    const integerValue = predicate.value !== undefined
        && Number.isSafeInteger(predicate.value);
    const integerCount = predicate.count !== undefined
        && Number.isSafeInteger(predicate.count);
    const supported = predicate.evidenceStatus === "supported";
    switch (predicate.kind) {
        case "battle_turn":
        case "turn_from_entry":
            return supported && hasNoDimensions && predicate.comparator === "gte"
                && integerValue && predicate.value >= 1 && predicate.count === undefined;
        case "next_attacking_turn":
        case "revive_triggered":
        case "runtime_gate":
            return supported && hasNoDimensions && hasNoThreshold;
        case "hp_percent":
        case "enemy_hp_percent":
            return supported && hasNoDimensions
                && (predicate.comparator === "gte" || predicate.comparator === "lte")
                && integerValue && predicate.value > 0 && predicate.value <= 100
                && predicate.count === undefined;
        case "enemy_count":
            return supported && hasNoDimensions && predicate.comparator === "eq"
                && integerCount && predicate.count === 1 && predicate.value === undefined;
        case "rotation_category_count":
        case "team_category_count":
            return supported && categories.length === 1 && classes.length === 0
                && predicate.selfInclusion === "included" && predicate.comparator === "gte"
                && integerCount && predicate.count >= 1 && predicate.count <= 7
                && predicate.value === undefined;
        case "all_team_category":
            return supported && categories.length === 1 && classes.length === 0
                && predicate.selfInclusion === "included" && predicate.comparator === "eq"
                && predicate.count === 7 && predicate.value === undefined;
        case "enemy_category":
            return supported && categories.length === 1 && classes.length === 0
                && predicate.selfInclusion === undefined && hasNoThreshold;
        case "rotation_class_count":
        case "team_class_count":
            return supported && categories.length === 0 && classes.length === 1
                && predicate.selfInclusion === "included" && predicate.comparator === "gte"
                && integerCount && predicate.count >= 1 && predicate.count <= 7
                && predicate.value === undefined;
        case "all_team_class":
            return supported && categories.length === 0 && classes.length === 1
                && predicate.selfInclusion === "included" && predicate.comparator === "eq"
                && predicate.count === 7 && predicate.value === undefined;
        case "attacks_performed":
        case "super_attacks_performed":
        case "attacks_received":
        case "attacks_evaded":
            return supported && hasNoDimensions && predicate.comparator === "gte"
                && integerValue && predicate.value >= 1 && predicate.count === undefined;
        case "unknown":
            return predicate.evidenceStatus === "unknown" && hasNoDimensions && hasNoThreshold;
        default:
            return false;
    }
}
function validateSuperAttacks(state, expectedSources, issues) {
    const attacks = state.superAttacks ?? [];
    if (attacks.length !== expectedSources.length) {
        issues.push({
            code: "super-attack-count",
            message: `State has ${attacks.length} Super Attacks; expected ${expectedSources.length} from the character payload.`,
            stateKey: state.stateKey,
        });
    }
    const ids = new Set();
    attacks.forEach((attack, index) => {
        const expected = expectedSources[index];
        if (ids.has(attack.id)) {
            issues.push({ code: "duplicate-super-attack-id", message: `Duplicate Super Attack ID ${attack.id}.`, stateKey: state.stateKey });
        }
        ids.add(attack.id);
        const expectedId = `${state.stateKey}:super-attack:${attack.variant}:${attack.ordinal}`;
        if (attack.id !== expectedId) {
            issues.push({ code: "unstable-super-attack-id", message: `Expected Super Attack ID ${expectedId}.`, stateKey: state.stateKey });
        }
        if (expected) {
            const fields = [
                ["variant", attack.variant, expected.variant],
                ["ordinal", attack.ordinal, expected.ordinal],
                ["name", attack.name, expected.name],
                ["ki", attack.ki, expected.ki],
                ["attackType", attack.attackType, expected.attackType],
                ["style", attack.style, expected.style],
                ["attackIncrease", JSON.stringify(attack.attackIncrease), JSON.stringify(expected.attackIncrease)],
                ["rawText", attack.rawText, expected.effectText],
                ["condition.rawText", attack.condition.rawText, expected.conditionText],
            ];
            for (const [field, actual, expectedValue] of fields) {
                if (actual !== expectedValue) {
                    issues.push({ code: "super-attack-source", message: `${field} does not match the character payload.`, stateKey: state.stateKey });
                }
            }
            const sourceStructuralEvidence = expected.structuralSource?.evidence ?? [];
            const expectedParsed = parseSuperAttack(state.stateKey, expected);
            if ((expectedParsed.structuralEvidence?.length ?? 0) !== sourceStructuralEvidence.length) {
                issues.push({
                    code: "super-attack-structural-evidence-source",
                    message: `${sourceStructuralEvidence.length - (expectedParsed.structuralEvidence?.length ?? 0)} Super Attack structural evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            if (JSON.stringify(attack.structuralEvidence ?? []) !== JSON.stringify(expectedParsed.structuralEvidence ?? [])) {
                issues.push({
                    code: "super-attack-structural-evidence-output",
                    message: `Serialized Super Attack structural evidence does not match validated source evidence.`,
                    stateKey: state.stateKey,
                });
            }
        }
        validateSuperAttack(attack, state, issues);
    });
}
function validateSuperAttack(attack, state, issues) {
    const variants = ["normal", "ultra", "extra", "unit"];
    if (!variants.includes(attack.variant)) {
        issues.push({ code: "super-attack-variant", message: `Super Attack variant is not recognized.`, stateKey: state.stateKey });
    }
    if (!Number.isInteger(attack.ordinal) || attack.ordinal < 0) {
        issues.push({ code: "super-attack-ordinal", message: `Super Attack ordinal must be a non-negative integer.`, stateKey: state.stateKey });
    }
    if (attack.ki !== undefined && (!Number.isInteger(attack.ki) || attack.ki < 0 || attack.ki > 24)) {
        issues.push({ code: "super-attack-ki", message: `Super Attack Ki must be an integer within 0..24.`, stateKey: state.stateKey });
    }
    if (attack.attackIncrease !== undefined && !validSuperAttackIncrease(attack.attackIncrease)) {
        issues.push({
            code: "super-attack-increase",
            message: "Super Attack increase must contain positive safe integer levels and non-decreasing percentages.",
            stateKey: state.stateKey,
        });
    }
    if (attack.effectOrigin !== "super_attack") {
        issues.push({ code: "super-attack-origin", message: `Super Attack channel cannot contain passive or Active Skill effects.`, stateKey: state.stateKey });
    }
    const rawLines = attack.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(attack.sourceFragments, rawLines, state, undefined, issues);
    validateFragmentList(attack.unparsedFragments, rawLines, state, undefined, issues);
    validateLosslessFragmentCoverage(attack.sourceFragments, rawLines, "super-attack-source-token-loss", state, issues);
    validateLosslessFragmentCoverage(uniqueOrderedFragments([
        ...attack.effects.flatMap(effect => effect.source),
        ...attack.unparsedFragments,
    ]), rawLines, "super-attack-effect-partition-token-loss", state, issues);
    const conditionLines = attack.condition.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(attack.condition.sourceFragments, conditionLines, state, undefined, issues);
    validateFragmentList(attack.condition.unparsedFragments, conditionLines, state, undefined, issues);
    validateLosslessFragmentCoverage(attack.condition.sourceFragments, conditionLines, "super-attack-condition-token-loss", state, issues);
    if (!attack.condition.rawText) {
        if (attack.condition.expression.op !== "always" || attack.condition.parseStatus !== "supported"
            || attack.condition.unparsedFragments.length !== 0) {
            issues.push({ code: "super-attack-condition-empty", message: `An empty Super Attack condition must be explicit always with no residual.`, stateKey: state.stateKey });
        }
    }
    else if (attack.condition.expression.op !== "unknown" || attack.condition.parseStatus !== "unknown") {
        issues.push({ code: "super-attack-condition-unsupported", message: `Unmodeled Super Attack conditions must remain unknown.`, stateKey: state.stateKey });
    }
    const expectedEffectStatus = superAttackEffectListStatus(attack.effects);
    if (attack.effectStatus !== expectedEffectStatus) {
        issues.push({ code: "super-attack-effect-status", message: `Super Attack effectStatus does not match its effects.`, stateKey: state.stateKey });
    }
    const expectedParseStatus = attack.effects.length === 0
        ? "unknown"
        : attack.unparsedFragments.length > 0
            || attack.condition.parseStatus !== "supported"
            || attack.effectStatus !== "supported"
            ? "partial"
            : "supported";
    if (attack.parseStatus !== expectedParseStatus) {
        issues.push({ code: "super-attack-status", message: `Super Attack parseStatus does not match condition/effect/residual status.`, stateKey: state.stateKey });
    }
    attack.effects.forEach(effect => validateSuperAttackEffect(effect, attack, state, issues));
}
function validSuperAttackIncrease(increase) {
    return Number.isSafeInteger(increase.level1Percent)
        && increase.level1Percent > 0
        && Number.isSafeInteger(increase.maxLevelPercent)
        && increase.maxLevelPercent >= increase.level1Percent
        && Number.isSafeInteger(increase.maxLevel)
        && increase.maxLevel > 0;
}
function validateSuperAttackEffect(effect, attack, state, issues) {
    const kinds = [
        "atk_raise", "def_raise", "enemy_atk_lowering", "enemy_def_lowering", "stun", "super_attack_seal", "action_break",
    ];
    const magnitudes = [
        "raise", "greatly_raise", "massively_raise", "lower", "greatly_lower", "massively_lower",
    ];
    const scopes = ["self", "allies", "current_target", "all_enemies", "unknown"];
    const sources = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_payload", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (!kinds.includes(effect.kind)) {
        issues.push({ code: "super-attack-effect-kind", message: `Super Attack effect kind is not recognized.`, stateKey: state.stateKey });
    }
    if (effect.origin !== "super_attack") {
        issues.push({ code: "super-attack-effect-origin", message: `Super Attack effects must retain super_attack origin.`, stateKey: state.stateKey });
    }
    if (!scopes.includes(effect.target.scope)) {
        issues.push({ code: "super-attack-target", message: `Super Attack effect target is not recognized.`, stateKey: state.stateKey });
    }
    if (effect.target.scope === "allies" && effect.target.selfInclusion === undefined) {
        issues.push({ code: "super-attack-target-self-inclusion", message: `Allies target must preserve self-inclusion uncertainty.`, stateKey: state.stateKey });
    }
    if (effect.target.scope !== "allies" && effect.target.selfInclusion !== undefined) {
        issues.push({ code: "super-attack-target-self-inclusion-kind", message: `Self inclusion belongs only to the allies target.`, stateKey: state.stateKey });
    }
    const statRaise = effect.kind === "atk_raise" || effect.kind === "def_raise";
    const enemyLowering = effect.kind === "enemy_atk_lowering" || effect.kind === "enemy_def_lowering";
    const statEffect = statRaise || enemyLowering;
    if (statRaise && !["self", "allies"].includes(effect.target.scope)) {
        issues.push({ code: "super-attack-raise-target", message: `ATK/DEF raises must target self or source-stated allies.`, stateKey: state.stateKey });
    }
    if ((enemyLowering || effect.kind === "stun" || effect.kind === "super_attack_seal" || effect.kind === "action_break")
        && !["current_target", "all_enemies"].includes(effect.target.scope)) {
        issues.push({ code: "super-attack-enemy-target", message: `Enemy effects must target the current target or all enemies.`, stateKey: state.stateKey });
    }
    if (statEffect && effect.magnitude === undefined && effect.value === undefined) {
        issues.push({ code: "super-attack-magnitude", message: `Stat effects require either a recognized magnitude or an exact value.`, stateKey: state.stateKey });
    }
    if (effect.magnitude !== undefined && !magnitudes.includes(effect.magnitude)) {
        issues.push({ code: "super-attack-magnitude-value", message: `Super Attack effect magnitude is not recognized.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.magnitude !== undefined) {
        issues.push({ code: "super-attack-magnitude-kind", message: `Magnitude belongs only to Super Attack stat effects.`, stateKey: state.stateKey });
    }
    if ((effect.value === undefined) !== (effect.unit === undefined)) {
        issues.push({ code: "super-attack-value-unit", message: `Numeric Super Attack values and units must be paired.`, stateKey: state.stateKey });
    }
    if (effect.value !== undefined && (!Number.isFinite(effect.value) || effect.value < 0 || effect.unit !== "percent")) {
        issues.push({ code: "super-attack-value", message: `Numeric Super Attack stat values must be non-negative percentages.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.value !== undefined) {
        issues.push({ code: "super-attack-value-kind", message: `Numeric stat values belong only to raises or lowerings.`, stateKey: state.stateKey });
    }
    validateSuperAttackDuration(effect.duration, state, issues);
    if (effect.provenance) {
        validateDecisionProvenance(effect.provenance.source, effect.provenance, state, issues);
        if ((effect.provenance.source === "dokkan_fyi_payload" || effect.provenance.source === "first_party_game_db")
            && !effect.provenance.evidenceId) {
            issues.push({ code: "super-attack-effect-provenance", message: `Structured Super Attack effect lacks row provenance.`, stateKey: state.stateKey });
        }
    }
    if ((effect.duration.source === "dokkan_fyi_payload" || effect.duration.source === "first_party_game_db")
        && (!effect.provenance || effect.provenance.source !== effect.duration.source)) {
        issues.push({ code: "super-attack-effect-provenance", message: `Structured Super Attack effect lacks matching provenance.`, stateKey: state.stateKey });
    }
    if (statEffect && !effect.stacking) {
        issues.push({ code: "super-attack-stacking-required", message: `Stat effects must explicitly preserve stacking uncertainty.`, stateKey: state.stateKey });
    }
    if (!statEffect && effect.stacking) {
        issues.push({ code: "super-attack-stacking-kind", message: `Stacking metadata belongs only to stat effects.`, stateKey: state.stateKey });
    }
    if (effect.stacking) {
        const stackingKinds = ["stackable", "not_stackable", "unknown"];
        if (!stackingKinds.includes(effect.stacking.kind) || !sources.includes(effect.stacking.source)) {
            issues.push({ code: "super-attack-stacking", message: `Stacking kind/source is not recognized.`, stateKey: state.stateKey });
        }
        if ((effect.stacking.kind === "unknown") !== (effect.stacking.source === "unresolved")) {
            issues.push({ code: "super-attack-stacking-resolution", message: `Unknown stacking and unresolved provenance must be paired.`, stateKey: state.stateKey });
        }
        if (effect.stacking.capPercent !== undefined
            && (effect.stacking.kind !== "stackable" || !Number.isFinite(effect.stacking.capPercent) || effect.stacking.capPercent < 0
                || !effect.stacking.capSource || !sources.includes(effect.stacking.capSource))) {
            issues.push({ code: "super-attack-stacking-cap", message: `A cap requires stackable semantics, a non-negative percentage, and provenance.`, stateKey: state.stateKey });
        }
        if (effect.stacking.capSource !== undefined && effect.stacking.capPercent === undefined) {
            issues.push({ code: "super-attack-stacking-cap-source", message: `Cap provenance requires an explicit cap.`, stateKey: state.stateKey });
        }
        const stackingScopes = ["current_turn", "active_windows", "battle", "unknown"];
        if (effect.stacking.scope !== undefined && !stackingScopes.includes(effect.stacking.scope)) {
            issues.push({ code: "super-attack-stacking-scope", message: `Stacking scope is not recognized.`, stateKey: state.stateKey });
        }
    }
    validateEffectLifecycle(effect.activationLimit, effect.applicationTrigger, state, issues);
    if (statRaise && (effect.applicationTrigger?.kind !== "per_super_attack"
        || effect.stacking?.kind !== "stackable"
        || effect.stacking.scope !== superAttackStackingScope(effect.duration))) {
        issues.push({ code: "super-attack-raise-domain-rule", message: `Canonical stat raises must retain versioned per-Super cumulative window semantics.`, stateKey: state.stateKey });
    }
    validateSuperAttackProbability(effect, state, issues);
    const expectedParseStatus = effect.kind === "action_break" || effect.probabilitySource === "unresolved"
        ? "partial"
        : "supported";
    if (effect.parseStatus !== expectedParseStatus) {
        issues.push({
            code: "super-attack-effect-parse-status",
            message: `Super Attack effect parse status does not match probability resolution.`,
            stateKey: state.stateKey,
        });
    }
    if (effect.activationTiming.moment !== "when_super_attack_effect_resolves"
        || effect.activationTiming.source !== "documented_domain_rule") {
        issues.push({ code: "super-attack-activation-timing", message: `Typed effects must remain in the Super Attack effect-resolution timing channel.`, stateKey: state.stateKey });
    }
    const expectedBucket = statRaise
        ? "super_attack_raise"
        : enemyLowering
            ? "super_attack_enemy_stat_lowering"
            : undefined;
    if (expectedBucket === undefined && effect.calculationBucket !== undefined) {
        issues.push({ code: "super-attack-bucket-kind", message: `Status effects do not receive a mathematical stat bucket.`, stateKey: state.stateKey });
    }
    if (expectedBucket !== undefined
        && (effect.calculationBucket?.bucket !== expectedBucket
            || effect.calculationBucket.source !== "documented_domain_rule")) {
        issues.push({ code: "super-attack-bucket", message: `Stat effect has the wrong future Super Attack calculation bucket.`, stateKey: state.stateKey });
    }
    const rawLines = attack.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(effect.source, rawLines, state, undefined, issues);
    if (effect.source.length === 0
        || effect.source.map(fragment => fragment.text).join("\n").replace(/\s/g, "") !== effect.sourceText.replace(/\s/g, "")) {
        issues.push({ code: "super-attack-effect-source", message: `Effect source fragments must reconstruct sourceText losslessly.`, stateKey: state.stateKey });
    }
}
function validateSuperAttackDuration(duration, state, issues) {
    const kinds = ["current_turn", "turns", "permanent", "unknown"];
    const sources = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_payload", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (!kinds.includes(duration.kind) || !sources.includes(duration.source)) {
        issues.push({ code: "super-attack-duration", message: `Super Attack duration kind/source is not recognized.`, stateKey: state.stateKey });
    }
    if ((duration.kind === "unknown") !== (duration.source === "unresolved")) {
        issues.push({ code: "super-attack-duration-resolution", message: `Unknown duration and unresolved provenance must be paired.`, stateKey: state.stateKey });
    }
    if (duration.kind === "turns") {
        if (!Number.isInteger(duration.turns) || (duration.turns ?? 0) <= 1) {
            issues.push({ code: "super-attack-duration-turns", message: `Multi-turn duration must declare an integer greater than 1.`, stateKey: state.stateKey });
        }
    }
    else if (duration.turns !== undefined) {
        issues.push({ code: "super-attack-duration-turns-kind", message: `Only a multi-turn duration may declare turns.`, stateKey: state.stateKey });
    }
}
function validateEffectLifecycle(activationLimit, applicationTrigger, state, issues, rule) {
    const sources = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_payload", "dokkan_fyi_structural_marker", "unresolved",
    ];
    if (activationLimit) {
        const kinds = ["once", "count", "unknown"];
        if (!kinds.includes(activationLimit.kind) || !sources.includes(activationLimit.source)) {
            issues.push({ code: "activation-limit", message: `Activation limit kind/source is not recognized.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        if (activationLimit.kind === "count") {
            if (!Number.isInteger(activationLimit.count) || (activationLimit.count ?? 0) <= 0) {
                issues.push({ code: "activation-limit-count", message: `Count activation limits require a positive integer.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        }
        else if (activationLimit.count !== undefined) {
            issues.push({ code: "activation-limit-count-kind", message: `Only count activation limits may carry count.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        validateDecisionProvenance(activationLimit.source, activationLimit.provenance, state, issues, rule);
    }
    if (applicationTrigger) {
        const kinds = ["per_super_attack", "per_combat_event", "per_turn", "entry", "unknown"];
        if (!kinds.includes(applicationTrigger.kind) || !sources.includes(applicationTrigger.source)
            || (applicationTrigger.kind === "unknown") !== (applicationTrigger.source === "unresolved")) {
            issues.push({ code: "application-trigger", message: `Application trigger kind/source is invalid.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        validateDecisionProvenance(applicationTrigger.source, applicationTrigger.provenance, state, issues, rule);
    }
}
function validateDecisionProvenance(source, provenance, state, issues, rule) {
    if (!provenance || provenance.source !== source
        || (source === "dokkan_fyi_structural_marker" && !provenance.evidenceId)
        || (source === "documented_domain_rule"
            && !EFFECT_DECISION_DOMAIN_RULE_VERSIONS.has(provenance.ruleVersion ?? ""))) {
        issues.push({ code: "effect-decision-provenance", message: `Effect lifecycle decision lacks matching provenance.`, stateKey: state.stateKey, ruleId: rule?.id });
    }
}
function validateSuperAttackProbability(effect, state, issues) {
    const hasProbability = effect.activationChancePercent !== undefined
        || effect.qualitativeChanceTerm !== undefined
        || effect.probabilitySource !== undefined;
    if (hasProbability && effect.kind !== "stun" && effect.kind !== "super_attack_seal") {
        issues.push({ code: "super-attack-probability-kind", message: `Gate A7 probability belongs only to stun or Super Attack seal.`, stateKey: state.stateKey });
    }
    if ((effect.activationChancePercent !== undefined || effect.qualitativeChanceTerm !== undefined)
        && effect.probabilitySource === undefined) {
        issues.push({ code: "super-attack-probability-source", message: `Probability metadata requires provenance.`, stateKey: state.stateKey });
    }
    if (effect.activationChancePercent !== undefined
        && (!Number.isFinite(effect.activationChancePercent) || effect.activationChancePercent < 0 || effect.activationChancePercent > 100)) {
        issues.push({ code: "super-attack-probability-range", message: `Probability must be within 0..100.`, stateKey: state.stateKey });
    }
    if (effect.probabilitySource === "unresolved" && effect.activationChancePercent !== undefined) {
        issues.push({ code: "super-attack-probability-unresolved-value", message: `Unresolved probability cannot declare a percentage.`, stateKey: state.stateKey });
    }
    if (effect.probabilitySource !== undefined
        && effect.probabilitySource !== "unresolved"
        && effect.activationChancePercent === undefined) {
        issues.push({ code: "super-attack-probability-missing-value", message: `Resolved probability requires an explicit percentage.`, stateKey: state.stateKey });
    }
}
function validateLosslessFragmentCoverage(fragments, rawLines, code, state, issues) {
    const covered = rawLines.map(line => Array.from({ length: line.length }, () => false));
    for (const fragment of fragments) {
        if (fragment.start === undefined || fragment.end === undefined || !covered[fragment.lineIndex])
            continue;
        for (let index = fragment.start; index < fragment.end; index += 1)
            covered[fragment.lineIndex][index] = true;
    }
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        for (let column = 0; column < rawLines[lineIndex].length; column += 1) {
            if (!/\s/.test(rawLines[lineIndex][column]) && !covered[lineIndex][column]) {
                issues.push({ code, message: `Source token at line ${lineIndex}, column ${column} is not referenced.`, stateKey: state.stateKey });
                return;
            }
        }
    }
}
function validatePassive(state, ruleIds, issues) {
    const passive = state.passive;
    if (!passive) {
        return;
    }
    if (passive.parseStatus !== aggregatePassiveStatus(passive.rules)) {
        issues.push({ code: "passive-status", message: `Passive parse status does not match its rules.`, stateKey: state.stateKey });
    }
    const rawLines = passive.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(passive.unparsedFragments, rawLines, state, undefined, issues);
    for (const rule of passive.rules) {
        if (ruleIds.has(rule.id)) {
            issues.push({ code: "duplicate-rule-id", message: `Duplicate rule ID ${rule.id}.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        ruleIds.add(rule.id);
        const positionFragment = rule.source[rule.source.length - 1];
        if (!positionFragment || rule.id !== ruleIdFromFragment(state.stateKey, positionFragment)) {
            issues.push({ code: "unstable-rule-id", message: `Rule ID does not match state key and source position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effects.length === 0) {
            issues.push({ code: "empty-effects", message: `Rule has no effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        const conditionStatus = conditionExpressionStatus(rule.condition);
        const effectStatus = effectListStatus(rule.effects);
        if (rule.conditionStatus !== conditionStatus) {
            issues.push({ code: "condition-status", message: `Condition status does not match its AST.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effectStatus !== effectStatus) {
            issues.push({ code: "effect-status", message: `Effect status does not match its effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.parseStatus !== combineParseStatuses(rule.conditionStatus, rule.effectStatus)) {
            issues.push({ code: "rule-status", message: `Rule status does not match condition/effect status.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateCondition(rule.condition, 1, state, rule, issues);
        validateFragmentList(rule.source, rawLines, state, rule, issues);
        for (const effect of rule.effects) {
            validateFiniteNumbers(effect, state, rule, issues);
            validateEffectContract(effect, state, rule, issues);
            for (const field of ["activationChancePercent", "additionalToSuperChancePercent", "chancePercent"]) {
                const chance = effect[field];
                if (chance !== undefined && (chance < 0 || chance > 100)) {
                    issues.push({ code: "chance-range", message: `${field} is outside 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
                }
            }
            if (effect.activationChancePercent !== undefined
                && effect.chancePercent !== undefined
                && effect.activationChancePercent !== effect.chancePercent) {
                issues.push({ code: "chance-alias", message: `chancePercent must equal activationChancePercent when both are present.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.additionalToSuperChancePercent !== undefined && effect.kind !== "additional_attack") {
                issues.push({ code: "additional-to-super-kind", message: `additionalToSuperChancePercent is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateProbabilityChannel(effect, "activation", state, rule, issues);
            validateProbabilityChannel(effect, "additional_to_super", state, rule, issues);
            if (effect.count !== undefined && (!Number.isInteger(effect.count) || effect.count <= 0)) {
                issues.push({ code: "effect-count", message: `Effect count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.stackCap !== undefined && effect.stackCap < 0) {
                issues.push({ code: "effect-cap", message: `Effect cap cannot be negative.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind === "turns" && (!Number.isInteger(effect.duration.turns) || (effect.duration.turns ?? 0) <= 0)) {
                issues.push({ code: "duration-range", message: `Turn duration must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind !== "turns" && effect.duration?.turns !== undefined) {
                issues.push({ code: "duration-turns-kind", message: `Only a turns duration may declare turns.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.source !== undefined) {
                const durationSources = [
                    "explicit_text", "first_party_game_db", "documented_domain_rule", "dokkan_fyi_payload", "dokkan_fyi_structural_marker", "unresolved",
                ];
                if (!durationSources.includes(effect.duration.source)) {
                    issues.push({ code: "duration-source", message: `Passive duration source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
                }
                if (effect.duration.provenance) {
                    validateDecisionProvenance(effect.duration.source, effect.duration.provenance, state, issues, rule);
                }
            }
            validateEffectLifecycle(effect.activationLimit, effect.applicationTrigger, state, issues, rule);
            if (effect.stacking) {
                const scopes = ["current_turn", "active_windows", "battle", "unknown"];
                if (!scopes.includes(effect.stacking.scope ?? "unknown")
                    || effect.stacking.kind === "unknown" && effect.stacking.source !== "unresolved") {
                    issues.push({ code: "passive-stacking", message: `Passive stacking metadata is invalid.`, stateKey: state.stateKey, ruleId: rule.id });
                }
                if (effect.stacking.capPercent !== undefined && effect.stacking.capPercent !== effect.stackCap) {
                    issues.push({ code: "passive-stacking-cap", message: `Passive stacking cap must match the existing cap channel.`, stateKey: state.stateKey, ruleId: rule.id });
                }
            }
        }
    }
    validateSourceTokenCoverage(passive, rawLines, state, issues);
}
function conditionExpressionStatus(condition) {
    if (condition.op === "always") {
        return "supported";
    }
    if (condition.op === "unknown") {
        return "unknown";
    }
    if (condition.op === "predicate") {
        if (condition.predicate.kind === "unknown") {
            return "unknown";
        }
        return condition.predicate.enemySelection === "unknown"
            || condition.predicate.combatEvent?.countScope === "unknown"
            || condition.predicate.combatEvent?.relativeTiming === "unknown"
            || (NAME_IDENTITY_PREDICATE_KINDS.has(condition.predicate.kind)
                && (!condition.predicate.nameIdentitySetId || !condition.predicate.canonicalIds?.length))
            ? "partial"
            : "supported";
    }
    if (condition.op === "not") {
        return conditionExpressionStatus(condition.child);
    }
    return aggregateStatuses(condition.children.map(conditionExpressionStatus));
}
function effectListStatus(effects) {
    return aggregateStatuses(effects.map(effect => {
        if (effect.kind === "unknown") {
            return "unknown";
        }
        if (effect.probabilitySource === "unresolved"
            || effect.additionalToSuperProbabilitySource === "unresolved") {
            return "partial";
        }
        return "supported";
    }));
}
function validateProbabilityChannel(effect, channel, state, rule, issues) {
    const percent = channel === "activation"
        ? effect.activationChancePercent
        : effect.additionalToSuperChancePercent;
    const term = channel === "activation"
        ? effect.qualitativeChanceTerm
        : effect.additionalToSuperQualitativeChanceTerm;
    const source = channel === "activation"
        ? effect.probabilitySource
        : effect.additionalToSuperProbabilitySource;
    const prefix = channel === "activation" ? "probability" : "additional-to-super-probability";
    if ((percent !== undefined || term !== undefined) && source === undefined) {
        issues.push({ code: `${prefix}-source`, message: `Probability metadata requires a source.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source === "unresolved" && percent !== undefined) {
        issues.push({ code: `${prefix}-unresolved-value`, message: `An unresolved probability cannot declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source !== undefined && source !== "unresolved" && percent === undefined) {
        issues.push({ code: `${prefix}-missing-value`, message: `A resolved probability must declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((source === "first_party_game_db" || source === "qualitative_lexicon") && term === undefined) {
        issues.push({ code: `${prefix}-missing-term`, message: `Non-text numeric resolution requires a qualitative term.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (channel === "additional_to_super" && source !== undefined && effect.kind !== "additional_attack") {
        issues.push({ code: "additional-to-super-kind", message: `Additional-to-Super probability metadata is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function aggregateStatuses(statuses) {
    if (statuses.length === 0 || statuses.every(status => status === "unknown")) {
        return "unknown";
    }
    if (statuses.every(status => status === "supported")) {
        return "supported";
    }
    return "partial";
}
const ALLY_PREDICATE_KINDS = new Set([
    "ally_category_present", "ally_name_present", "ally_category_name_present", "all_rotation_allies_category",
    "rotation_partner_category", "rotation_partner_name", "ally_class_present",
    "ally_type_present", "ally_class_type_present", "ally_category_class_present", "ally_category_or_class_present",
    "all_rotation_allies_class", "team_category_count", "team_class_count", "team_type_count",
]);
const ENEMY_PREDICATE_KINDS = new Set([
    "enemy_category", "enemy_name", "enemy_class", "enemy_type", "enemy_class_type",
    "enemy_hp_percent", "enemy_status",
]);
const ALLY_TARGET_SCOPES = new Set([
    "rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies",
    "class_type_allies",
]);
function isAllyTarget(target) {
    return ALLY_TARGET_SCOPES.has(target.scope);
}
function validateEffectContract(effect, state, rule, issues) {
    validateCalculationPhase(effect, state, rule, issues);
    const allyTarget = isAllyTarget(effect.target);
    if (allyTarget && effect.target.selfInclusion === undefined) {
        issues.push({ code: "target-self-inclusion", message: `Ally target must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope === "category_allies" && (effect.categories?.length ?? 0) === 0) {
        issues.push({ code: "target-categories", message: `Category ally target must name affected categories.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["class_allies", "class_type_allies"].includes(effect.target.scope) && (effect.classes?.length ?? 0) === 0) {
        issues.push({ code: "target-classes", message: `Class ally target must name an affected class.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["type_allies", "class_type_allies"].includes(effect.target.scope) && (effect.types?.length ?? 0) === 0) {
        issues.push({ code: "target-types", message: `Type ally target must name an affected type.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateClassAndTypeValues(effect.classes, effect.types, state, rule, issues);
    if (effect.kind === "support") {
        issues.push({ code: "standalone-support", message: `Support must be a derived classification, not an isolated effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const isDerivedSupport = effect.classifications?.includes("support") === true;
    if (isDerivedSupport && (!allyTarget || !BENEFICIAL_EFFECT_KINDS.has(effect.kind))) {
        issues.push({ code: "invalid-support-classification", message: `Support classification requires a beneficial typed ally effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (allyTarget && BENEFICIAL_EFFECT_KINDS.has(effect.kind) && !isDerivedSupport) {
        issues.push({ code: "missing-support-classification", message: `Beneficial typed ally effect must carry derived support classification.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.scaling) {
        if (effect.scaling.kind === "per_ki_sphere") {
            if (effect.scaling.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.spheresPerIncrement) || effect.scaling.spheresPerIncrement < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(effect.scaling.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
            const excludedTypes = effect.scaling.excludedKiSphereTypes ?? [];
            if (excludedTypes.some(type => !TEAM_ANALYSIS_TYPES.includes(type))
                || (excludedTypes.length > 0
                    && (effect.scaling.kiSphereTypes.length !== 1 || effect.scaling.kiSphereTypes[0] !== "any"))) {
                issues.push({ code: "effect-scaling-excluded-sphere-types", message: `Excluded Ki Sphere scaling requires recognized Types and an any-sphere base.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.countStartsFrom !== undefined
                && (!Number.isInteger(effect.scaling.countStartsFrom) || effect.scaling.countStartsFrom < 1)) {
                issues.push({ code: "effect-scaling-count-start", message: `Ki Sphere scaling count offsets must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.selection !== undefined
                && !["all_obtained", "largest_type_count"].includes(effect.scaling.selection)) {
                issues.push({ code: "effect-scaling-selection", message: `Ki Sphere scaling selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.selection === "largest_type_count"
                && effect.scaling.kiSphereTypes.length < 2) {
                issues.push({ code: "effect-scaling-largest-selection", message: `Largest-type Ki Sphere scaling requires at least two candidate types.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_ki_amount") {
            if (!Number.isInteger(effect.scaling.kiPerIncrement) || effect.scaling.kiPerIncrement < 1) {
                issues.push({ code: "ki-scaling-unit", message: `Ki scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.kiContext !== "final_attack_ki"
                || !["when_attacking", "when_targeted_by_attack"].includes(effect.scaling.evaluationMoment)) {
                issues.push({ code: "ki-scaling-context", message: `Ki scaling requires final attack Ki at an explicit attack phase.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_combat_event") {
            if (!["single", "and", "or"].includes(effect.scaling.connector)) {
                issues.push({ code: "combat-scaling-connector", message: `Combat-event scaling connector is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.eventsPerIncrement) || effect.scaling.eventsPerIncrement < 1) {
                issues.push({ code: "combat-scaling-unit", message: `Combat-event scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.events.length === 0) {
                issues.push({ code: "combat-scaling-events", message: `Combat-event scaling requires at least one event.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if ((effect.scaling.connector === "single") !== (effect.scaling.events.length === 1)) {
                issues.push({ code: "combat-scaling-arity", message: `Single scaling requires one event; logical scaling requires multiple events.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            effect.scaling.events.forEach(event => validateCombatEventDescriptor(event, state, rule, issues, true));
        }
        else if (effect.scaling.kind === "per_category_ally") {
            if (!["team", "rotation"].includes(effect.scaling.scope)) {
                issues.push({ code: "category-scaling-scope", message: `Category ally scaling scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.categories.length === 0 || effect.scaling.categories.some(category => !category.trim())) {
                issues.push({ code: "category-scaling-categories", message: `Category ally scaling requires named categories.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.membersPerIncrement) || effect.scaling.membersPerIncrement < 1) {
                issues.push({ code: "category-scaling-unit", message: `Category ally scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            const expectedMaximum = scalingMaximumCount(effect.scaling.scope, effect.scaling.selfInclusion);
            if (effect.scaling.maximumCount !== expectedMaximum) {
                issues.push({ code: "category-scaling-maximum", message: `Category ally scaling maximum must match its scope.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.selection === "single_category" && effect.scaling.categories.length !== 1) {
                issues.push({ code: "category-scaling-selection", message: `Single-category scaling requires exactly one category.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.selection === "largest_category_count" && effect.scaling.categories.length < 2) {
                issues.push({ code: "category-scaling-selection", message: `Largest-category scaling requires at least two categories.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.selection === "union_category_members" && effect.scaling.categories.length < 2) {
                issues.push({ code: "category-scaling-selection", message: `Category-union scaling requires at least two categories.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_class_ally") {
            if (!["team", "rotation"].includes(effect.scaling.scope)) {
                issues.push({ code: "class-scaling-scope", message: `Class ally scaling scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.classes.length !== 1 || !TEAM_ANALYSIS_CLASSES.includes(effect.scaling.classes[0])) {
                issues.push({ code: "class-scaling-classes", message: `Class ally scaling requires one recognized class.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.membersPerIncrement) || effect.scaling.membersPerIncrement < 1) {
                issues.push({ code: "class-scaling-unit", message: `Class ally scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            const expectedMaximum = scalingMaximumCount(effect.scaling.scope, effect.scaling.selfInclusion);
            if (effect.scaling.maximumCount !== expectedMaximum) {
                issues.push({ code: "class-scaling-maximum", message: `Class ally scaling maximum must match its scope and self-inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_category_name_ally") {
            if (!["team", "rotation"].includes(effect.scaling.scope)) {
                issues.push({ code: "category-name-scaling-scope", message: `Category/name ally scaling scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.categories.length === 0 || effect.scaling.categories.some(category => !category.trim())) {
                issues.push({ code: "category-name-scaling-categories", message: `Category/name ally scaling requires named categories.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.names.length === 0 || effect.scaling.names.some(name => !name.trim())) {
                issues.push({ code: "category-name-scaling-names", message: `Category/name ally scaling requires named characters.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.membersPerIncrement) || effect.scaling.membersPerIncrement < 1) {
                issues.push({ code: "category-name-scaling-unit", message: `Category/name ally scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            const expectedMaximum = scalingMaximumCount(effect.scaling.scope, effect.scaling.selfInclusion);
            if (effect.scaling.maximumCount !== expectedMaximum) {
                issues.push({ code: "category-name-scaling-maximum", message: `Category/name ally scaling maximum must match its scope and self-inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_name_ally") {
            if (!["team", "rotation"].includes(effect.scaling.scope)) {
                issues.push({ code: "name-scaling-scope", message: `Name ally scaling scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.names.length === 0 || effect.scaling.names.some(name => !name.trim())) {
                issues.push({ code: "name-scaling-names", message: `Name ally scaling requires named characters.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.membersPerIncrement) || effect.scaling.membersPerIncrement < 1) {
                issues.push({ code: "name-scaling-unit", message: `Name ally scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            const expectedMaximum = scalingMaximumCount(effect.scaling.scope, effect.scaling.selfInclusion);
            if (effect.scaling.maximumCount !== expectedMaximum) {
                issues.push({ code: "name-scaling-maximum", message: `Name ally scaling maximum must match its scope and self-inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_category_or_class_ally") {
            if (!["team", "rotation"].includes(effect.scaling.scope)) {
                issues.push({ code: "category-class-scaling-scope", message: `Category/class ally scaling scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.categories.length === 0 || effect.scaling.categories.some(category => !category.trim())) {
                issues.push({ code: "category-class-scaling-categories", message: `Category/class ally scaling requires named categories.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.classes.length !== 1 || !TEAM_ANALYSIS_CLASSES.includes(effect.scaling.classes[0])) {
                issues.push({ code: "category-class-scaling-classes", message: `Category/class ally scaling requires one recognized class.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.membersPerIncrement) || effect.scaling.membersPerIncrement < 1) {
                issues.push({ code: "category-class-scaling-unit", message: `Category/class ally scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            const expectedMaximum = scalingMaximumCount(effect.scaling.scope, effect.scaling.selfInclusion);
            if (effect.scaling.maximumCount !== expectedMaximum) {
                issues.push({ code: "category-class-scaling-maximum", message: `Category/class ally scaling maximum must match its scope and self-inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "hp_remaining") {
            if (!(effect.scaling.direction === "more" || effect.scaling.direction === "less")) {
                issues.push({ code: "hp-scaling-direction", message: `HP remaining scaling direction is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.hpContext !== "team_hp_percent") {
                issues.push({ code: "hp-scaling-context", message: `HP remaining scaling must use team_hp_percent context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.value === undefined || effect.unit === undefined) {
                issues.push({ code: "hp-scaling-maximum", message: `Typed HP remaining scaling requires the maximum effect value and unit.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_turn_passed") {
            if (!Number.isInteger(effect.scaling.turnsPerIncrement) || effect.scaling.turnsPerIncrement < 1) {
                issues.push({ code: "turn-scaling-unit", message: `Turn scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.turnContext !== "battle_turn") {
                issues.push({ code: "turn-scaling-context", message: `Turn scaling must use battle-turn context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else if (effect.scaling.kind === "per_existing_enemy") {
            if (!Number.isInteger(effect.scaling.enemiesPerIncrement) || effect.scaling.enemiesPerIncrement < 1
                || !Number.isInteger(effect.scaling.countStartsFrom) || effect.scaling.countStartsFrom < 1) {
                issues.push({ code: "enemy-scaling-unit", message: `Enemy scaling requires positive integer count units.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.classes.some(value => !TEAM_ANALYSIS_CLASSES.includes(value))) {
                issues.push({ code: "enemy-scaling-class", message: `Enemy scaling class is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
        else {
            issues.push({ code: "effect-scaling-kind", message: `Effect scaling kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            const external = effect.scaling;
            if (external.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(external.spheresPerIncrement) || (external.spheresPerIncrement ?? 0) < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(external.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
        }
        if (effect.kind === "unknown" || effect.kind === "ki_sphere_change") {
            issues.push({ code: "effect-scaling-effect-kind", message: `Effect scaling requires a scalable typed effect.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (effect.kind === "ki_sphere_change" && !effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-fields", message: `Ki Sphere change effects require structured conversion fields.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kind !== "ki_sphere_change" && effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-kind", message: `Ki Sphere conversion fields are valid only on ki_sphere_change effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kiSphereChange) {
        validateKiSphereChange(effect.kiSphereChange, effect, state, rule, issues);
    }
}
function validateCalculationPhase(effect, state, rule, issues) {
    const activationMoments = [
        "start_of_turn", "before_attacking", "when_attacking",
        "when_performing_super_attack", "before_incoming_attack", "when_targeted_by_attack",
        "when_attack_landed", "after_incoming_attack_resolved", "after_attacking",
        "after_attack_landed", "when_evading", "after_evading",
        "after_final_blow", "unresolved",
    ];
    const buckets = [
        "passive_start_of_turn", "passive_on_attack", "unresolved",
    ];
    const sources = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved",
    ];
    if (effect.kind === "unknown") {
        if (effect.activationTiming || effect.calculationBucket) {
            issues.push({ code: "unknown-effect-calculation-phase", message: `Unknown effects cannot carry calculation-phase claims.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        return;
    }
    if (!effect.activationTiming) {
        issues.push({ code: "activation-timing-required", message: `Typed effects must preserve a resolved or unresolved activation timing.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    else {
        if (!activationMoments.includes(effect.activationTiming.moment)) {
            issues.push({ code: "activation-moment", message: `Activation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.activationTiming.source)) {
            issues.push({ code: "activation-source", message: `Activation timing source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.activationTiming.moment === "unresolved") !== (effect.activationTiming.source === "unresolved")) {
            issues.push({ code: "activation-resolution", message: `Unresolved activation moment and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    const bucketEligible = CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind);
    if (bucketEligible && !effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-required", message: `ATK and DEF effects must preserve a resolved or unresolved passive calculation bucket.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!bucketEligible && effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-effect-kind", message: `Passive calculation buckets currently apply only to typed ATK and DEF effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.calculationBucket) {
        if (!buckets.includes(effect.calculationBucket.bucket)) {
            issues.push({ code: "calculation-bucket", message: `Passive calculation bucket is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.calculationBucket.source)) {
            issues.push({ code: "calculation-bucket-source", message: `Calculation bucket source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.calculationBucket.bucket === "unresolved") !== (effect.calculationBucket.source === "unresolved")) {
            issues.push({ code: "calculation-bucket-resolution", message: `Unresolved calculation bucket and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateKiSphereChange(change, effect, state, rule, issues) {
    const selections = ["listed_types", "all", "random_type"];
    if (!selections.includes(change.sourceSelection)) {
        issues.push({ code: "ki-sphere-change-source-selection", message: `Ki Sphere conversion source selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.kiContext !== "board_state") {
        issues.push({ code: "ki-sphere-change-context", message: `Ki Sphere conversion must use board_state context.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (![...TEAM_ANALYSIS_TYPES, "rainbow"].includes(change.destinationType)) {
        issues.push({ code: "ki-sphere-change-destination", message: `Ki Sphere conversion destination must be a concrete color or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection === "listed_types") {
        validateKiSphereTypes(change.sourceTypes, "ki-sphere-change-source-types", state, rule, issues);
        if ((change.sourceTypes ?? [])
            .some(type => type === "any" || type === "non_rainbow")) {
            issues.push({ code: "ki-sphere-change-concrete-source", message: `Listed conversion sources must be concrete colors or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (change.excludedSourceTypes !== undefined) {
            issues.push({ code: "ki-sphere-change-listed-exclusions", message: `Listed conversion sources cannot also declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    else if (change.sourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-source-kind", message: `Only listed conversion sources may declare sourceTypes.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection !== "random_type" && change.excludedSourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-exclusion-kind", message: `Only random Type conversion may declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((change.excludedSourceTypes ?? []).some(type => !TEAM_ANALYSIS_TYPES.includes(type))) {
        issues.push({ code: "ki-sphere-change-exclusions", message: `Conversion exclusions must be concrete Type colors.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope !== "self") {
        issues.push({ code: "ki-sphere-change-target", message: `Ki Sphere board conversion must use the self effect channel.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateSourceTokenCoverage(passive, rawLines, state, issues) {
    const fragments = uniqueOrderedFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
    ]);
    const covered = rawLines.map(line => Array.from({ length: line.length }, () => false));
    for (const fragment of fragments) {
        const start = fragment.start ?? rawLines[fragment.lineIndex]?.indexOf(fragment.text) ?? -1;
        const end = fragment.end ?? (start >= 0 ? start + fragment.text.length : -1);
        if (start < 0 || end < start || !covered[fragment.lineIndex]) {
            continue;
        }
        for (let index = start; index < end; index += 1) {
            covered[fragment.lineIndex][index] = true;
        }
    }
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        for (let column = 0; column < rawLines[lineIndex].length; column += 1) {
            if (!/\s/.test(rawLines[lineIndex][column]) && !covered[lineIndex][column]) {
                issues.push({
                    code: "source-token-loss",
                    message: `Source token at line ${lineIndex}, column ${column} is not referenced.`,
                    stateKey: state.stateKey,
                });
                return;
            }
        }
    }
}
function validateFragmentList(fragments, rawLines, state, rule, issues) {
    for (let index = 0; index < fragments.length; index += 1) {
        const fragment = fragments[index];
        if (index > 0 && compareFragments(fragments[index - 1], fragment) > 0) {
            issues.push({ code: "fragment-order", message: `Source fragments are not ordered.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        const line = rawLines[fragment.lineIndex];
        if (line === undefined) {
            issues.push({ code: "fragment-line", message: `Fragment line ${fragment.lineIndex} is outside raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            continue;
        }
        if (fragment.start !== undefined || fragment.end !== undefined) {
            if (fragment.start === undefined || fragment.end === undefined || fragment.start < 0 || fragment.end < fragment.start) {
                issues.push({ code: "fragment-range", message: `Fragment has an invalid range.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
            else if (line.slice(fragment.start, fragment.end) !== fragment.text) {
                issues.push({ code: "fragment-text", message: `Fragment does not point to original raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        }
        else if (!line.includes(fragment.text)) {
            issues.push({ code: "fragment-text", message: `Fragment text is absent from its raw line.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
    }
}
function validateCondition(condition, depth, state, rule, issues) {
    if (depth === 1) {
        validateEnemyReferenceBindings(condition, state, rule, issues);
    }
    if (depth > 16) {
        issues.push({ code: "ast-depth", message: `Condition AST exceeds depth 16.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        if (condition.children.length === 0) {
            issues.push({ code: "empty-ast", message: `${condition.op} condition has no children.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        condition.children.forEach(child => validateCondition(child, depth + 1, state, rule, issues));
        if (condition.op === "all") {
            validateScenarioWindow(condition.children, state, rule, issues);
        }
    }
    else if (condition.op === "not") {
        validateCondition(condition.child, depth + 1, state, rule, issues);
    }
    else if (condition.op === "predicate") {
        validateFiniteNumbers(condition.predicate, state, rule, issues);
        if (ALLY_PREDICATE_KINDS.has(condition.predicate.kind) && condition.predicate.selfInclusion === undefined) {
            issues.push({ code: "condition-self-inclusion", message: `Ally condition must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.count !== undefined
            && (!Number.isInteger(condition.predicate.count) || condition.predicate.count <= 0)) {
            issues.push({ code: "condition-count", message: `Ally count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_category_present", "ally_category_name_present", "ally_category_class_present", "ally_category_or_class_present", "all_rotation_allies_category", "rotation_partner_category", "team_category_count", "character_category", "enemy_category"].includes(condition.predicate.kind)
            && (condition.predicate.categories?.length ?? 0) === 0) {
            issues.push({ code: "condition-categories", message: `Category condition must name at least one category.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_name_present", "ally_category_name_present", "rotation_partner_name", "enemy_name"].includes(condition.predicate.kind)
            && (condition.predicate.names?.length ?? 0) === 0) {
            issues.push({ code: "condition-names", message: `Name condition must name at least one character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_class_present", "ally_class_type_present", "ally_category_class_present", "ally_category_or_class_present", "all_rotation_allies_class", "team_class_count", "character_class", "enemy_class", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.classes?.length ?? 0) === 0) {
            issues.push({ code: "condition-classes", message: `Class condition must name at least one class.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_type_present", "ally_class_type_present", "team_type_count", "character_type", "enemy_type", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.types?.length ?? 0) === 0) {
            issues.push({ code: "condition-types", message: `Type condition must name at least one type.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.kind === "character_category"
            && (condition.predicate.scope !== "self"
                || condition.predicate.selfInclusion !== undefined
                || condition.predicate.comparator !== undefined
                || condition.predicate.count !== undefined)) {
            issues.push({ code: "character-category-contract", message: `Character category conditions require an uncounted self scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.kind === "ally_category_or_class_present"
            && (condition.predicate.scope !== "team"
                || condition.predicate.selfInclusion !== "included"
                || condition.predicate.comparator !== "eq"
                || condition.predicate.count !== 7)) {
            issues.push({ code: "team-category-or-class-contract", message: `Universal category-or-class conditions require all seven team members, including self.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateEnemyPredicate(condition.predicate, state, rule, issues);
        validateNameIdentityPredicate(condition.predicate, state, rule, issues);
        validateKiPredicate(condition.predicate, state, rule, issues);
        validateCombatEventPredicate(condition.predicate, state, rule, issues);
        validateRuntimeFlagPredicate(condition.predicate, state, rule, issues);
        validateClassAndTypeValues(condition.predicate.classes, condition.predicate.types, state, rule, issues);
        validateScenarioPredicate(condition.predicate, state, rule, issues);
        if (["battle_slot", "ki_sphere_collection_order"].includes(condition.predicate.kind)
            && condition.predicate.scope !== "self") {
            issues.push({ code: "slot-scope", message: `Turn-order position must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["battle_slot", "ki_sphere_collection_order"].includes(condition.predicate.kind)
            && (condition.predicate.slots?.length ?? 0) === 0) {
            issues.push({ code: "slot-values", message: `Turn-order predicate must name at least one position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        for (const slot of condition.predicate.slots ?? []) {
            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                issues.push({ code: "slot-range", message: `Turn-order position must be 1, 2, or 3.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}
function validateRuntimeFlagPredicate(predicate, state, rule, issues) {
    if (predicate.kind === "domain_active") {
        if (predicate.scope !== "battle"
            || predicate.domainNames?.length !== 1
            || !predicate.domainNames[0].trim()) {
            issues.push({ code: "domain-condition", message: `Domain conditions require one named battle domain.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    else if (predicate.domainNames !== undefined) {
        issues.push({ code: "domain-condition-kind", message: `Domain names belong only to domain conditions.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "guard_activated") {
        const counted = predicate.value !== undefined || predicate.comparator !== undefined;
        if (predicate.scope !== "self"
            || (counted && (predicate.comparator !== "gte"
                || !Number.isInteger(predicate.value)
                || (predicate.value ?? 0) < 1))) {
            issues.push({ code: "guard-condition", message: `Guard activation requires self scope and an optional positive activation count.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (["finish_effect_activated", "character_ko"].includes(predicate.kind)
        && predicate.scope !== "self") {
        issues.push({ code: "runtime-flag-scope", message: `Character runtime flags must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "revive_triggered" && predicate.scope !== "self" && predicate.scope !== "team") {
        issues.push({ code: "revive-condition-scope", message: `Revival activation must use self or team scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateNameIdentityPredicate(predicate, state, rule, issues) {
    const isNamePredicate = NAME_IDENTITY_PREDICATE_KINDS.has(predicate.kind);
    const hasSetId = predicate.nameIdentitySetId !== undefined;
    const hasCanonicalIds = predicate.canonicalIds !== undefined;
    if (!isNamePredicate && (hasSetId || hasCanonicalIds)) {
        issues.push({ code: "name-identity-kind", message: `Canonical name identity belongs only to name predicates.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!isNamePredicate)
        return;
    if (predicate.nameMatch !== "exact" && predicate.nameMatch !== "includes") {
        issues.push({ code: "name-match", message: `Name predicates require an exact or includes match mode.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (hasSetId !== hasCanonicalIds) {
        issues.push({ code: "name-identity-pair", message: `Canonical name identity set and members must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!hasSetId)
        return;
    if (!/^\d+$/.test(predicate.nameIdentitySetId ?? "")) {
        issues.push({ code: "name-identity-set", message: `Canonical name identity set must be numeric.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const canonicalIds = predicate.canonicalIds ?? [];
    if (canonicalIds.length === 0
        || canonicalIds.some(id => !/^\d+$/.test(id))
        || new Set(canonicalIds).size !== canonicalIds.length) {
        issues.push({ code: "name-identity-members", message: `Canonical name identity members must be non-empty unique numeric IDs.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateEnemyPredicate(predicate, state, rule, issues) {
    const enemySelections = [
        "any_enemy", "all_enemies", "current_target", "only_enemy", "unknown",
    ];
    const enemyStatuses = ["atk_down", "def_down", "stunned", "super_attack_sealed"];
    const nameMatches = ["exact", "includes"];
    const isEnemyPredicate = ENEMY_PREDICATE_KINDS.has(predicate.kind);
    if (isEnemyPredicate && predicate.scope !== "enemy") {
        issues.push({ code: "enemy-scope", message: `Enemy attribute predicates must use enemy scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isEnemyPredicate && predicate.enemySelection === undefined) {
        issues.push({ code: "enemy-selection", message: `Enemy attribute predicates must declare enemy selection.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemySelection !== undefined && !enemySelections.includes(predicate.enemySelection)) {
        issues.push({ code: "enemy-selection-value", message: `Enemy selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!isEnemyPredicate && predicate.enemySelection !== undefined) {
        issues.push({ code: "enemy-selection-kind", message: `Enemy selection is valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && predicate.enemyReference !== "that_enemy") {
        issues.push({ code: "enemy-reference-value", message: `Enemy reference is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && !isEnemyPredicate) {
        issues.push({ code: "enemy-reference-kind", message: `Enemy references are valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference === "that_enemy"
        && predicate.enemySelection !== "unknown"
        && predicate.enemySelection !== "only_enemy") {
        issues.push({ code: "enemy-reference-selection", message: `That-enemy references must be unresolved or bound to the only enemy.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_status"
        && ((predicate.enemyStatuses?.length ?? 0) === 0
            || (predicate.enemyStatuses ?? []).some(status => !enemyStatuses.includes(status)))) {
        issues.push({ code: "enemy-status-value", message: `Enemy status must use a recognized non-empty value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_name") {
        if (predicate.nameMatch === undefined || !nameMatches.includes(predicate.nameMatch)) {
            issues.push({ code: "enemy-name-match", message: `Enemy name predicates require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((predicate.excludedNames?.length ?? 0) > 0
            && (predicate.excludedNameMatch === undefined || !nameMatches.includes(predicate.excludedNameMatch))) {
            issues.push({ code: "enemy-excluded-name-match", message: `Excluded enemy names require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.excludedNameMatch !== undefined && (predicate.excludedNames?.length ?? 0) === 0) {
            issues.push({ code: "enemy-excluded-names", message: `Excluded enemy name match mode requires excluded names.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateKiPredicate(predicate, state, rule, issues) {
    const kiKinds = ["ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained"];
    const isKiPredicate = kiKinds.includes(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isKiPredicate && predicate.scope !== "self") {
        issues.push({ code: "ki-scope", message: `Ki runtime predicates must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && !comparatorAllowed) {
        issues.push({ code: "ki-comparator", message: `Ki runtime predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && predicate.value === undefined) {
        issues.push({ code: "ki-value", message: `Ki runtime predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "ki_amount") {
        if (predicate.value !== undefined && !isKiAmount(predicate.value)) {
            issues.push({ code: "ki-amount-range", message: `Attack Ki must be an integer within 0..24.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "final_attack_ki") {
            issues.push({ code: "ki-amount-context", message: `Attack Ki must use final_attack_ki context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.evaluationMoment !== "when_attacking"
            && predicate.evaluationMoment !== "before_attack"
            && predicate.evaluationMoment !== "when_targeted_by_attack") {
            issues.push({ code: "ki-amount-moment", message: `Attack Ki requires an explicit attack evaluation moment.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiSphereTypes !== undefined) {
            issues.push({ code: "ki-amount-sphere-types", message: `Attack Ki cannot declare Ki Sphere types.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "ki_spheres_obtained" || predicate.kind === "ki_sphere_type_obtained") {
        if (predicate.value !== undefined && !isKiSphereCount(predicate.value)) {
            issues.push({ code: "ki-sphere-count-range", message: `Ki Sphere counts must be non-negative integers.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "collected_ki_spheres") {
            issues.push({ code: "ki-sphere-context", message: `Obtained Ki Sphere predicates must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateKiSphereTypes(predicate.kiSphereTypes, "ki-sphere-types", state, rule, issues);
        if (predicate.kind === "ki_sphere_type_obtained"
            && (predicate.comparator !== "gte" || predicate.value !== 1)) {
            issues.push({ code: "ki-sphere-presence", message: `Ki Sphere type presence must mean at least one obtained sphere.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "ki_sphere_collection_order" && predicate.scope !== "self") {
        issues.push({ code: "ki-collection-order-scope", message: `Ki Sphere collection order must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!isKiPredicate && (predicate.kiContext !== undefined || predicate.kiSphereTypes !== undefined)) {
        issues.push({ code: "ki-fields-kind", message: `Ki context and Ki Sphere types are valid only on Ki predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
const COMBAT_EVENT_PREDICATE_KINDS = new Set([
    "incoming_attack", "incoming_super_attack", "incoming_attack_from_enemy_hit_by_self_super_attack",
    "attacks_performed", "attacks_received",
    "attacks_evaded", "super_attacks_performed", "super_attack_received", "final_blow_delivered",
]);
function validateCombatEventPredicate(predicate, state, rule, issues) {
    const isCombatPredicate = COMBAT_EVENT_PREDICATE_KINDS.has(predicate.kind);
    if (isCombatPredicate && !predicate.combatEvent) {
        issues.push({ code: "combat-event-required", message: `Combat-event predicates require a structured event descriptor.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!isCombatPredicate && predicate.combatEvent) {
        issues.push({ code: "combat-event-kind", message: `Combat-event descriptors are valid only on combat-event predicates.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!predicate.combatEvent) {
        return;
    }
    if (predicate.scope !== "self") {
        issues.push({ code: "combat-event-scope", message: `Combat-event predicates describe the current character and must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateCombatEventDescriptor(predicate.combatEvent, state, rule, issues, false);
    const expectedKind = {
        attack_performed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attacks_performed"] : ["attacks_performed"],
        incoming_attack: predicate.combatEvent.attackKind === "super_attack"
            ? ["incoming_super_attack", "incoming_attack_from_enemy_hit_by_self_super_attack"]
            : ["incoming_attack", "incoming_attack_from_enemy_hit_by_self_super_attack"],
        attack_landed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attack_received"] : ["attacks_received"],
        attack_evaded: ["attacks_evaded"],
        final_blow_delivered: ["final_blow_delivered"],
    };
    if (!(expectedKind[predicate.combatEvent.eventType] ?? []).includes(predicate.kind)) {
        issues.push({ code: "combat-event-predicate-kind", message: `Combat-event descriptor does not match its predicate kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "accumulated_count"
        || predicate.combatEvent.mode === "repeated_threshold") {
        if (!["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator)) {
            issues.push({ code: "combat-event-comparator", message: `Counted combat-event conditions require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value === undefined || !Number.isInteger(predicate.value) || predicate.value < 0) {
            issues.push({ code: "combat-event-count", message: `Counted combat-event conditions require a non-negative integer count.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    else if (predicate.comparator !== undefined || predicate.value !== undefined) {
        issues.push({ code: "combat-current-event-count", message: `Current combat events cannot carry an accumulated comparator or count.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "per_event") {
        issues.push({ code: "combat-predicate-per-event", message: `Per-event repetition belongs to effect scaling, not a condition predicate.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "repeated_threshold" && predicate.comparator !== "gte") {
        issues.push({ code: "combat-repeated-threshold-comparator", message: `Repeated combat-event thresholds require a gte comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateCombatEventDescriptor(event, state, rule, issues, scaling) {
    const eventTypes = ["attack_performed", "incoming_attack", "attack_landed", "attack_evaded", "final_blow_delivered"];
    const actors = ["self", "enemy"];
    const attackKinds = ["normal_attack", "super_attack", "unknown"];
    const attackStyles = ["ki_blast", "unarmed", "physical", "unknown"];
    const modes = ["current_event", "accumulated_count", "repeated_threshold", "per_event"];
    const countScopes = ["current_turn", "battle", "unknown"];
    const relativeTimings = [
        "before_event", "during_event", "after_event",
        "on_next_attacking_turn", "starting_next_attacking_turn", "unknown",
    ];
    const sources = ["explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved"];
    if (!eventTypes.includes(event.eventType))
        issues.push({ code: "combat-event-type", message: `Combat event type is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!actors.includes(event.actor))
        issues.push({ code: "combat-event-actor", message: `Combat event actor is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!attackKinds.includes(event.attackKind))
        issues.push({ code: "combat-attack-kind", message: `Combat attack kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.attackStyle !== undefined && !attackStyles.includes(event.attackStyle))
        issues.push({ code: "combat-attack-style", message: `Combat attack style is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!modes.includes(event.mode))
        issues.push({ code: "combat-event-mode", message: `Combat event mode is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.countScope !== undefined && !countScopes.includes(event.countScope))
        issues.push({ code: "combat-count-scope", message: `Combat count scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!relativeTimings.includes(event.relativeTiming))
        issues.push({ code: "combat-relative-timing", message: `Combat relative timing is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (scaling ? event.mode !== "per_event" : event.mode === "per_event") {
        issues.push({ code: "combat-event-mode-channel", message: `Combat event mode does not match its condition or scaling channel.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode === "current_event" && event.countScope !== undefined) {
        issues.push({ code: "combat-current-count-scope", message: `A current combat event cannot declare a counter scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode !== "current_event" && event.countScope === undefined) {
        issues.push({ code: "combat-history-count-scope", message: `Historical and per-event combat data require an explicit or unknown count scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.mode !== "current_event" && event.mode !== "per_event") {
        issues.push({ code: "combat-targeting-history", message: `Incoming targeting is a pre-resolution current event and cannot increment hit history or effect scaling.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.relativeTiming === "after_event") {
        issues.push({ code: "combat-targeting-timing", message: `Incoming targeting cannot prove a post-resolution outcome.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "attack_landed" || event.eventType === "attack_evaded")
        && event.relativeTiming === "before_event") {
        issues.push({ code: "combat-outcome-timing", message: `A hit or evade outcome cannot be confirmed before resolution.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && event.attackKind !== "super_attack") {
        issues.push({ code: "combat-style-kind", message: `Attack style is valid only for Super Attacks.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "final_blow_delivered" && (event.actor !== "self" || event.attackKind !== "unknown")) {
        issues.push({ code: "combat-final-blow-shape", message: `Final-blow events must be self-authored without an invented attack kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "attack_performed" && event.actor !== "self") {
        issues.push({ code: "combat-performed-actor", message: `Performed attacks must use self as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "incoming_attack" || event.eventType === "attack_landed" || event.eventType === "attack_evaded") && event.actor !== "enemy") {
        issues.push({ code: "combat-incoming-actor", message: `Targeted, landed, or evaded attacks must use enemy as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const provenanceEntries = [
        ["eventType", event.provenance?.eventType], ["actor", event.provenance?.actor],
        ["attackKind", event.provenance?.attackKind], ["mode", event.provenance?.mode],
        ["relativeTiming", event.provenance?.relativeTiming],
        ...(event.attackStyle !== undefined ? [["attackStyle", event.provenance?.attackStyle]] : []),
        ...(event.countScope !== undefined ? [["countScope", event.provenance?.countScope]] : []),
    ];
    for (const [field, source] of provenanceEntries) {
        if (!source || !sources.includes(source)) {
            issues.push({ code: "combat-provenance", message: `Combat ${field} requires recognized provenance.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if ((event.attackKind === "unknown") !== (event.provenance.attackKind === "unresolved")) {
        issues.push({ code: "combat-attack-kind-resolution", message: `Unknown attack kind and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && ((event.attackStyle === "unknown") !== (event.provenance.attackStyle === "unresolved"))) {
        issues.push({ code: "combat-attack-style-resolution", message: `Unknown attack style and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.countScope !== undefined && ((event.countScope === "unknown") !== (event.provenance.countScope === "unresolved"))) {
        issues.push({ code: "combat-count-scope-resolution", message: `Unknown count scope and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.relativeTiming === "unknown") !== (event.provenance.relativeTiming === "unresolved")) {
        issues.push({ code: "combat-relative-timing-resolution", message: `Unknown relative timing and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateEnemyReferenceBindings(condition, state, rule, issues) {
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
        return;
    }
    if (condition.op === "any") {
        condition.children.forEach(child => validateEnemyReferenceBindings(child, state, rule, issues));
        return;
    }
    if (condition.op === "all") {
        validateEnemyReferencesInConjunction(condition, conjunctiveComponentProvesSingleEnemy(condition), state, rule, issues);
        return;
    }
    rejectBoundEnemyReferences(condition, state, rule, issues);
}
function validateEnemyReferencesInConjunction(condition, provesSingleEnemy, state, rule, issues) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy"
            && !provesSingleEnemy) {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "all") {
        condition.children.forEach(child => {
            if (child.op === "all" || child.op === "predicate") {
                validateEnemyReferencesInConjunction(child, provesSingleEnemy, state, rule, issues);
            }
            else {
                validateEnemyReferenceBindings(child, state, rule, issues);
            }
        });
    }
}
function rejectBoundEnemyReferences(condition, state, rule, issues) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy") {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
    }
    else if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => rejectBoundEnemyReferences(child, state, rule, issues));
    }
}
function enemyReferenceBindingIssue(state, rule, issues) {
    issues.push({
        code: "enemy-reference-binding",
        message: `That-enemy reference is bound without an enemy_count eq 1 proof in the same conjunctive branch.`,
        stateKey: state.stateKey,
        ruleId: rule.id,
    });
}
function validateScenarioPredicate(predicate, state, rule, issues) {
    const scalarScenarioKinds = [
        "hp_percent", "battle_turn", "turn_from_entry", "enemy_count", "enemy_hp_percent",
    ];
    const isScalarScenario = scalarScenarioKinds.includes(predicate.kind);
    const isScenario = SCENARIO_PREDICATES.has(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isScalarScenario && !comparatorAllowed) {
        issues.push({ code: "scenario-comparator", message: `HP and turn predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.value === undefined) {
        issues.push({ code: "scenario-value", message: `HP and turn predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.maxValue !== undefined) {
        issues.push({ code: "scenario-max-value", message: `Scenario intervals must use an all AST of scalar bounds.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "hp_percent") {
        if (predicate.scope !== "team") {
            issues.push({ code: "hp-scope", message: `HP is shared team HP and must use team scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
            issues.push({ code: "hp-range", message: `HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "enemy_hp_percent"
        && predicate.value !== undefined
        && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
        issues.push({ code: "enemy-hp-range", message: `Enemy HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_count") {
        if (predicate.scope !== "battle") {
            issues.push({ code: "enemy-count-scope", message: `Enemy count must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && !isEnemyCount(predicate.value)) {
            issues.push({ code: "enemy-count-range", message: `Enemy count must be a non-negative integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "battle_turn" && predicate.scope !== "battle") {
        issues.push({ code: "battle-turn-scope", message: `Battle turn must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "turn_from_entry" && predicate.scope !== "self") {
        issues.push({ code: "entry-turn-scope", message: `Turn from entry must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["battle_turn", "turn_from_entry"].includes(predicate.kind)
        && predicate.value !== undefined
        && (!Number.isInteger(predicate.value) || predicate.value < 1)) {
        issues.push({ code: "turn-index", message: `Turn indexes are 1-based positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const knownMoments = [
        "start_of_turn", "entry_turn", "end_of_turn", "before_attack", "when_attacking",
        "when_targeted_by_attack", "when_obtaining_ki_sphere",
        "on_next_attacking_turn", "starting_next_attacking_turn",
    ];
    if (predicate.evaluationMoment !== undefined && !knownMoments.includes(predicate.evaluationMoment)) {
        issues.push({ code: "evaluation-moment", message: `Evaluation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.evaluationMoment !== undefined
        && !isScenario
        && predicate.kind !== "ki_amount"
        && predicate.kind !== "battle_slot") {
        issues.push({ code: "evaluation-moment-kind", message: `Evaluation moment is valid only on scenario, attack-Ki or battle-slot predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "battle_slot"
        && predicate.evaluationMoment !== undefined
        && predicate.evaluationMoment !== "start_of_turn") {
        issues.push({ code: "slot-evaluation-moment", message: `Battle-slot evaluation moment must be start_of_turn when present.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "next_attacking_turn"
        && (predicate.scope !== "self"
            || !["on_next_attacking_turn", "starting_next_attacking_turn"].includes(predicate.evaluationMoment ?? ""))) {
        issues.push({ code: "next-attacking-turn-contract", message: `Next-attacking-turn predicates require self scope and an explicit next-turn mode.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateScenarioWindow(children, state, rule, issues) {
    for (const kind of ["hp_percent", "enemy_hp_percent", "battle_turn", "turn_from_entry"]) {
        const predicates = children
            .filter((child) => child.op === "predicate")
            .map(child => child.predicate)
            .filter(predicate => predicate.kind === kind && predicate.value !== undefined);
        const lowerValues = predicates
            .filter(predicate => predicate.comparator === "gte" || predicate.comparator === "gt")
            .map(predicate => predicate.value);
        const upperValues = predicates
            .filter(predicate => predicate.comparator === "lte" || predicate.comparator === "lt")
            .map(predicate => predicate.value);
        const lower = lowerValues.length > 0 ? Math.max(...lowerValues) : undefined;
        const upper = upperValues.length > 0 ? Math.min(...upperValues) : undefined;
        if (lower !== undefined && upper !== undefined && lower > upper) {
            issues.push({ code: "condition-window-range", message: `Scenario window lower bound exceeds its upper bound.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateClassAndTypeValues(classes, types, state, rule, issues) {
    if ((classes ?? []).some(value => !TEAM_ANALYSIS_CLASSES.includes(value))) {
        issues.push({ code: "class-value", message: `Class must be Super or Extreme.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((types ?? []).some(value => !TEAM_ANALYSIS_TYPES.includes(value))) {
        issues.push({ code: "type-value", message: `Type must be AGL, TEQ, INT, STR, or PHY.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateKiSphereTypes(types, code, state, rule, issues) {
    if (!types || types.length === 0 || types.some(type => !KI_SPHERE_TYPES.includes(type))) {
        issues.push({ code, message: `Ki Sphere types must use a recognized non-empty selector.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if ((types.includes("any") || types.includes("non_rainbow")) && types.length !== 1) {
        issues.push({ code: `${code}-exclusive`, message: `any and non_rainbow Ki Sphere selectors cannot be combined with other values.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateFiniteNumbers(value, state, rule, issues) {
    for (const [key, fieldValue] of Object.entries(value)) {
        if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
            issues.push({ code: "non-finite-number", message: `${key} must be finite.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
//# sourceMappingURL=team-analysis.js.map