"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlayGameDbCharacterPassiveModes = exports.selectDeliveredPassiveModeFormIds = void 0;
const game_db_source_1 = require("./game-db-source");
const game_db_transformation_passive_details_1 = require("./game-db-transformation-passive-details");
const PASSIVE_STATE_FIELDS = [
    { releaseState: "initial", field: "passiveDetails", textField: "passive" },
    { releaseState: "eza", field: "ezaPassiveDetails", textField: "ezaPassive" },
    { releaseState: "seza", field: "sezaPassiveDetails", textField: "sezaPassive" },
];
function hasText(value) {
    return Boolean(value?.trim());
}
/**
 * Selects delivered forms whose initial, EZA or SEZA passive skill set exposes
 * the first-party Standard or Survival description channels.
 */
function selectDeliveredPassiveModeFormIds(characters, tables) {
    const modePassiveSkillSetIds = new Set();
    for (const row of tables.passive_skill_sets ?? []) {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (id && (hasText(row.sougou_only_itemized_description) || hasText(row.kobetu_only_itemized_description))) {
            modePassiveSkillSetIds.add(id);
        }
    }
    const modeGrowthTypes = new Set();
    for (const row of tables.optimal_awakening_growths ?? []) {
        const growType = (0, game_db_source_1.normalizeDbId)(row.optimal_awakening_grow_type);
        const passiveSkillSetId = (0, game_db_source_1.normalizeDbId)(row.passive_skill_set_id);
        if (growType && passiveSkillSetId && modePassiveSkillSetIds.has(passiveSkillSetId)) {
            modeGrowthTypes.add(growType);
        }
    }
    const cardById = new Map();
    for (const row of tables.cards ?? []) {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        if (!id)
            continue;
        if (cardById.has(id))
            throw new Error(`duplicate game DB card ${id}`);
        cardById.set(id, row);
    }
    const deliveredFormIds = new Set();
    for (const character of characters) {
        if (deliveredFormIds.has(character.id))
            throw new Error(`duplicate delivered form ${character.id}`);
        deliveredFormIds.add(character.id);
        for (const transformation of character.transformations ?? []) {
            if (deliveredFormIds.has(transformation.id)) {
                throw new Error(`duplicate delivered form ${transformation.id}`);
            }
            deliveredFormIds.add(transformation.id);
        }
    }
    const selected = [...deliveredFormIds].filter(formId => {
        const card = cardById.get(formId);
        if (!card)
            return false;
        const passiveSkillSetId = (0, game_db_source_1.normalizeDbId)(card.passive_skill_set_id);
        const growType = (0, game_db_source_1.normalizeDbId)(card.optimal_awakening_grow_type);
        return Boolean((passiveSkillSetId && modePassiveSkillSetIds.has(passiveSkillSetId))
            || (growType && modeGrowthTypes.has(growType)));
    });
    return selected.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}
exports.selectDeliveredPassiveModeFormIds = selectDeliveredPassiveModeFormIds;
function cloneCharacters(characters) {
    return JSON.parse(JSON.stringify(characters));
}
function cloneModes(modes) {
    return JSON.parse(JSON.stringify(modes));
}
function formIndex(characters) {
    const index = new Map();
    for (const character of characters) {
        if (index.has(character.id))
            throw new Error(`duplicate baseline form ${character.id}`);
        index.set(character.id, { characterId: character.id, form: character, pathPrefix: "" });
        for (const transformation of character.transformations ?? []) {
            if (index.has(transformation.id))
                throw new Error(`duplicate baseline form ${transformation.id}`);
            index.set(transformation.id, {
                characterId: character.id,
                form: transformation,
                pathPrefix: `transformations.${transformation.id}.`,
            });
        }
    }
    return index;
}
function stripPassiveModes(characters) {
    const stripped = cloneCharacters(characters);
    for (const { form } of formIndex(stripped).values()) {
        for (const { field } of PASSIVE_STATE_FIELDS) {
            const details = form[field];
            if (details)
                delete details.modes;
        }
    }
    return stripped;
}
function projectionModeStates(projection) {
    return PASSIVE_STATE_FIELDS.flatMap(({ releaseState, field, textField }) => {
        const details = projection[field];
        return details?.modes?.length ? [{ releaseState, field, textField, details }] : [];
    });
}
function validateModeContract(projectionId, releaseState, modes) {
    const modeKinds = modes.map(mode => mode.mode);
    if (new Set(modeKinds).size !== modeKinds.length) {
        throw new Error(`passive-mode state ${projectionId}:${releaseState} contains duplicate modes`);
    }
    for (const mode of modes) {
        const expectedAvailability = mode.mode === "standard" ? "normal" : "dokkan_frontier";
        if (mode.availability !== expectedAvailability) {
            throw new Error(`passive-mode state ${projectionId}:${releaseState} has invalid ${mode.mode} availability`);
        }
    }
}
function deleteMaterializedStateFields(characters, materialized) {
    const forms = formIndex(characters);
    for (const state of materialized) {
        const target = forms.get(state.formId);
        if (!target)
            throw new Error(`materialized passive-mode form ${state.formId} disappeared`);
        delete target.form[state.field];
        if (state.textFieldAdded)
            delete target.form[state.textFieldAdded];
    }
}
function overlayGameDbCharacterPassiveModes(baselineCharacters, projections) {
    const relevantProjections = projections;
    const projectionIds = new Set();
    for (const projection of relevantProjections) {
        if (projectionIds.has(projection.id))
            throw new Error(`duplicate passive-mode projection ${projection.id}`);
        if (projectionModeStates(projection).length === 0) {
            throw new Error(`selected passive-mode form ${projection.id} projected no mode states`);
        }
        projectionIds.add(projection.id);
    }
    const characters = cloneCharacters(baselineCharacters);
    const forms = formIndex(characters);
    const patches = [];
    let expectedStateCount = 0;
    let alreadyPresentStateCount = 0;
    let materializedStateCount = 0;
    let standardStateCount = 0;
    let survivalStateCount = 0;
    const materialized = [];
    for (const projection of relevantProjections) {
        const target = forms.get(projection.id);
        if (!target)
            throw new Error(`passive-mode form ${projection.id} is missing from the baseline catalog`);
        for (const { releaseState, field, textField, details: projectedDetails } of projectionModeStates(projection)) {
            expectedStateCount += 1;
            const reboundDetails = target.characterId === projection.id
                ? projectedDetails
                : (0, game_db_transformation_passive_details_1.rebindTransformationPassiveDetails)(projectedDetails, target.characterId, projection.id);
            const modes = reboundDetails?.modes;
            if (!modes?.length)
                throw new Error(`passive-mode state ${projection.id}:${releaseState} lost its modes`);
            validateModeContract(projection.id, releaseState, modes);
            if (modes.some(mode => mode.mode === "standard"))
                standardStateCount += 1;
            if (modes.some(mode => mode.mode === "survival"))
                survivalStateCount += 1;
            const baselineDetails = target.form[field];
            if (!baselineDetails) {
                const projectedText = reboundDetails?.text?.trim();
                if (!projectedText) {
                    throw new Error(`passive-mode state ${projection.id}:${releaseState} has no material text`);
                }
                const baselineText = target.form[textField]?.trim();
                if (baselineText && baselineText !== projectedText) {
                    throw new Error(`passive-mode state ${projection.id}:${releaseState} conflicts with baseline ${textField}`);
                }
                target.form[field] = JSON.parse(JSON.stringify(reboundDetails));
                const textFieldAdded = baselineText ? undefined : textField;
                if (textFieldAdded)
                    target.form[textFieldAdded] = projectedText;
                materialized.push({ formId: projection.id, field, textFieldAdded });
                materializedStateCount += 1;
                patches.push({
                    characterId: target.characterId,
                    formId: projection.id,
                    releaseState,
                    kind: "passive-state",
                    fields: [
                        `${target.pathPrefix}${field}`,
                        ...(textFieldAdded ? [`${target.pathPrefix}${textFieldAdded}`] : []),
                    ],
                    modes: modes.map(mode => mode.mode),
                });
                continue;
            }
            if (baselineDetails.modes) {
                const comparableModes = (value) => JSON.stringify(value, (key, nestedValue) => key === "sourceVersion" ? "<snapshot-version>" : nestedValue);
                if (comparableModes(baselineDetails.modes) !== comparableModes(modes)) {
                    throw new Error(`passive-mode state ${projection.id}:${releaseState} conflicts with the baseline`);
                }
                alreadyPresentStateCount += 1;
                continue;
            }
            baselineDetails.modes = cloneModes(modes);
            patches.push({
                characterId: target.characterId,
                formId: projection.id,
                releaseState,
                kind: "mode-channels",
                fields: [`${target.pathPrefix}${field}.modes`],
                modes: modes.map(mode => mode.mode),
            });
        }
    }
    const characterOrderPreserved = characters.every((character, index) => character.id === baselineCharacters[index]?.id);
    const strippedCharacters = stripPassiveModes(characters);
    const strippedBaseline = stripPassiveModes(baselineCharacters);
    deleteMaterializedStateFields(strippedCharacters, materialized);
    deleteMaterializedStateFields(strippedBaseline, materialized);
    const unrelatedFieldsPreserved = JSON.stringify(strippedCharacters) === JSON.stringify(strippedBaseline);
    if (characters.length !== baselineCharacters.length || !characterOrderPreserved || !unrelatedFieldsPreserved) {
        throw new Error("passive-mode overlay changed data outside its approved passive fields");
    }
    if (patches.length + alreadyPresentStateCount !== expectedStateCount) {
        throw new Error("passive-mode coverage is incomplete");
    }
    return {
        characters,
        patches: patches.sort((left, right) => left.formId.localeCompare(right.formId, undefined, { numeric: true })
            || left.releaseState.localeCompare(right.releaseState)),
        coverage: {
            selectedFormCount: relevantProjections.length,
            expectedStateCount,
            patchedStateCount: patches.length,
            modeOnlyPatchedStateCount: patches.length - materializedStateCount,
            materializedStateCount,
            alreadyPresentStateCount,
            standardStateCount,
            survivalStateCount,
        },
        checks: {
            characterCountPreserved: true,
            characterOrderPreserved: true,
            unrelatedFieldsPreserved: true,
            everyProjectedFormFoundInBaseline: true,
            everyModeStateBoundOrMaterialized: true,
            noConflictingExistingModes: true,
        },
    };
}
exports.overlayGameDbCharacterPassiveModes = overlayGameDbCharacterPassiveModes;
//# sourceMappingURL=game-db-character-passive-mode-overlay.js.map