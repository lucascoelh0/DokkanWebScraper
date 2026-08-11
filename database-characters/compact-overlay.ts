import { createHash } from "crypto";
import type { Character } from "../character";
import type { CharacterCompactProjection } from "./compact-contract";
import {
    CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT,
    CharacterCompactPromotionExample,
} from "./compact-promotion-contract";

const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);

interface ProductiveState {
    id: string;
    rarity: unknown;
    rarityPresent: boolean;
    type: unknown;
    typePresent: boolean;
    sourceRecordPath: string;
    target: any;
}

interface IndexedProductionStates {
    selected: Map<string, ProductiveState>;
    ambiguous: Map<string, string[]>;
}

export interface CharacterCompactOverlayPatch {
    cardId: string;
    stateId: string;
    field: "rarity";
    from: null;
    to: string;
    productionPath: string;
}

export interface CharacterCompactOverlayBlockers {
    total: number;
    missingBindings: number;
    ambiguousBindings: number;
    typeMissing: number;
    typeDifferences: number;
    rarityMissing: number;
    rarityNonNullDifferences: number;
}

export interface CharacterCompactOverlayDecision {
    inventory: {
        k15Records: number;
        productionTopLevelRecords: number;
        selectedProductiveStates: number;
        ambiguousProductiveIds: number;
    };
    evaluation: {
        binding: { selected: number; missing: number; ambiguous: number };
        type: { agreements: number; changes: 0; differences: number; missing: number; ambiguous: number };
        rarity: {
            agreementsBeforeOverlay: number;
            nullFillCandidates: number;
            nonNullDifferences: number;
            missing: number;
            ambiguous: number;
            nonNullOverwrites: 0;
        };
        blockers: CharacterCompactOverlayBlockers;
    };
    candidates: {
        count: number;
        canonicalization: "utf8-json-array-v1";
        sha256: string;
    };
    examples: CharacterCompactPromotionExample[];
    overlayProof: {
        candidatesAppliedToClone: number;
        candidateOnlyMutations: true;
        originalProductionRecordsMutated: 0;
        charactersCreated: 0;
        charactersRemoved: 0;
        postOverlay: {
            recordsEvaluated: number;
            idAgreements: number;
            rarityAgreements: number;
            typeAgreements: number;
            allFieldAgreements: number;
            blockers: number;
        };
    };
    inputIntegrity: {
        originalInputsUnchanged: true;
        overlayCloneIsolated: true;
    };
    readiness: "GO" | "NO-GO";
}

export interface CharacterCompactOverlayResult {
    /** Deep clone of the input. Patches are present only when the decision is GO. */
    characters: Character[];
    /** Complete deterministic proposal inventory; never a generic mutation surface. */
    patches: CharacterCompactOverlayPatch[];
    decision: CharacterCompactOverlayDecision;
}

function normalizeComparableValue(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    return "<non-scalar>";
}

function productiveState(value: any, sourceRecordPath: string): ProductiveState {
    return {
        id: String(value.id),
        rarity: value.rarity,
        rarityPresent: Object.prototype.hasOwnProperty.call(value, "rarity") && value.rarity !== undefined,
        type: value.type,
        typePresent: Object.prototype.hasOwnProperty.call(value, "type") && value.type !== undefined,
        sourceRecordPath,
        target: value,
    };
}

function comparableState(value: ProductiveState): string {
    return JSON.stringify([value.id, normalizeComparableValue(value.rarity), normalizeComparableValue(value.type)]);
}

function indexProductionStates(characters: Character[]): IndexedProductionStates {
    const topLevel = new Map<string, ProductiveState[]>();
    const nested = new Map<string, ProductiveState[]>();
    characters.forEach((value: any, index) => {
        if (!value || value.id === undefined || value.id === null) return;
        const state = productiveState(value, `$[${index}]`);
        topLevel.set(state.id, [...(topLevel.get(state.id) ?? []), state]);
    });

    const visitNested = (value: any, path: string): void => {
        const transformations = Array.isArray(value?.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => {
            const itemPath = `${path}.transformations[${index}]`;
            if (!item || item.id === undefined || item.id === null) return;
            const state = productiveState(item, itemPath);
            nested.set(state.id, [...(nested.get(state.id) ?? []), state]);
            visitNested(item, itemPath);
        });
    };
    characters.forEach((value, index) => visitNested(value, `$[${index}]`));

    const selected = new Map<string, ProductiveState>();
    const ambiguous = new Map<string, string[]>();
    const ids = [...new Set([...topLevel.keys(), ...nested.keys()])].sort(numeric);
    for (const id of ids) {
        const primary = topLevel.get(id) ?? [];
        if (primary.length === 1) {
            selected.set(id, primary[0]);
            continue;
        }
        if (primary.length > 1) {
            ambiguous.set(id, primary.map(item => item.sourceRecordPath).sort());
            continue;
        }
        const alternatives = nested.get(id) ?? [];
        const signatures = new Set(alternatives.map(comparableState));
        if (signatures.size === 1 && alternatives.length) selected.set(id, alternatives[0]);
        else if (alternatives.length) ambiguous.set(id, alternatives.map(item => item.sourceRecordPath).sort());
    }
    return { selected, ambiguous };
}

function candidateOrder(left: CharacterCompactOverlayPatch, right: CharacterCompactOverlayPatch): number {
    return numeric(left.cardId, right.cardId)
        || numeric(left.stateId, right.stateId)
        || left.productionPath.localeCompare(right.productionPath);
}

function targetAtProductionPath(characters: Character[], path: string): any {
    const match = /^\$\[(\d+)\]((?:\.transformations\[\d+\])*)$/.exec(path);
    if (!match) throw new Error(`K18 invalid candidate path ${path}`);
    let target: any = characters[Number(match[1])];
    const nested = /\.transformations\[(\d+)\]/g;
    let part: RegExpExecArray | null;
    while ((part = nested.exec(match[2])) !== null) target = target?.transformations?.[Number(part[1])];
    if (!target) throw new Error(`K18 candidate path missing ${path}`);
    return target;
}

function addExample(examples: CharacterCompactPromotionExample[], example: CharacterCompactPromotionExample): void {
    if (examples.length < CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT) examples.push(example);
}

function blocker(counts: CharacterCompactOverlayBlockers, key: Exclude<keyof CharacterCompactOverlayBlockers, "total">): void {
    counts.total++;
    counts[key]++;
}

/**
 * K18 field-scoped overlay. The caller must supply a projection already
 * validated by K15. This function performs no I/O and never mutates either
 * input. One blocker suppresses the complete patch set.
 */
export function createCharacterCompactRarityOverlay(
    characters: Character[],
    validatedProjection: CharacterCompactProjection,
): CharacterCompactOverlayResult {
    const productionSnapshot = JSON.stringify(characters);
    const projectionSnapshot = JSON.stringify(validatedProjection);
    const indexed = indexProductionStates(characters);
    const patches: CharacterCompactOverlayPatch[] = [];
    const blockerExamples: CharacterCompactPromotionExample[] = [];
    const candidateExamples: CharacterCompactPromotionExample[] = [];
    const binding = { selected: 0, missing: 0, ambiguous: 0 };
    const type = { agreements: 0, changes: 0 as const, differences: 0, missing: 0, ambiguous: 0 };
    const rarity = {
        agreementsBeforeOverlay: 0, nullFillCandidates: 0, nonNullDifferences: 0,
        missing: 0, ambiguous: 0, nonNullOverwrites: 0 as const,
    };
    const blockers: CharacterCompactOverlayBlockers = {
        total: 0, missingBindings: 0, ambiguousBindings: 0, typeMissing: 0,
        typeDifferences: 0, rarityMissing: 0, rarityNonNullDifferences: 0,
    };

    for (const record of validatedProjection.records) {
        const ambiguousPaths = indexed.ambiguous.get(record.cardId);
        if (ambiguousPaths) {
            binding.ambiguous++;
            type.ambiguous++;
            rarity.ambiguous++;
            blocker(blockers, "ambiguousBindings");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "binding",
                reason: "ambiguous_productive_binding", k15Value: record.cardId, productionValue: null,
                productionPath: null, ambiguousPaths: ambiguousPaths.slice(0, 2),
            });
            continue;
        }
        const state = indexed.selected.get(record.cardId);
        if (!state) {
            binding.missing++;
            type.missing++;
            rarity.missing++;
            blocker(blockers, "missingBindings");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "binding",
                reason: "missing_productive_binding", k15Value: record.cardId, productionValue: null,
                productionPath: null,
            });
            continue;
        }
        binding.selected++;

        const productiveType = normalizeComparableValue(state.type);
        if (!state.typePresent || state.type === null) {
            type.missing++;
            blocker(blockers, "typeMissing");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "type",
                reason: "missing_productive_type", k15Value: String(record.type), productionValue: productiveType,
                productionPath: state.sourceRecordPath,
            });
        } else if (productiveType === String(record.type)) {
            type.agreements++;
        } else {
            type.differences++;
            blocker(blockers, "typeDifferences");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "type",
                reason: "productive_type_difference", k15Value: String(record.type), productionValue: productiveType,
                productionPath: state.sourceRecordPath,
            });
        }

        const productiveRarity = normalizeComparableValue(state.rarity);
        if (state.rarity === undefined || state.rarity === null) {
            rarity.nullFillCandidates++;
            patches.push({
                cardId: record.cardId, stateId: record.stateId, field: "rarity", from: null,
                to: String(record.rarity), productionPath: state.sourceRecordPath,
            });
            addExample(candidateExamples, {
                kind: "null_fill_candidate", cardId: record.cardId, stateId: record.stateId, field: "rarity",
                reason: "productive_null_k15_supported", k15Value: String(record.rarity), productionValue: null,
                productionPath: state.sourceRecordPath,
            });
        } else if (productiveRarity === String(record.rarity)) {
            rarity.agreementsBeforeOverlay++;
        } else {
            rarity.nonNullDifferences++;
            blocker(blockers, "rarityNonNullDifferences");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "rarity",
                reason: "productive_non_null_rarity_difference", k15Value: String(record.rarity),
                productionValue: productiveRarity, productionPath: state.sourceRecordPath,
            });
        }
    }

    patches.sort(candidateOrder);
    const clone = JSON.parse(productionSnapshot) as Character[];
    const cloneIndex = indexProductionStates(clone);
    const patchesToApply = blockers.total === 0 ? patches : [];
    for (const patch of patchesToApply) {
        const state = cloneIndex.selected.get(patch.cardId);
        if (!state || state.sourceRecordPath !== patch.productionPath || normalizeComparableValue(state.target.rarity) !== null) {
            throw new Error(`K18 candidate target changed for ${patch.cardId}`);
        }
        state.target.rarity = patch.to;
    }

    const postOverlay = {
        recordsEvaluated: validatedProjection.records.length,
        idAgreements: 0, rarityAgreements: 0, typeAgreements: 0, allFieldAgreements: 0, blockers: 0,
    };
    for (const record of validatedProjection.records) {
        const state = cloneIndex.selected.get(record.cardId);
        const ambiguousState = cloneIndex.ambiguous.has(record.cardId);
        const idAgreement = !!state && !ambiguousState && String(state.target.id) === record.cardId;
        const rarityAgreement = !!state && !ambiguousState && normalizeComparableValue(state.target.rarity) === String(record.rarity);
        const typeAgreement = !!state && !ambiguousState && normalizeComparableValue(state.target.type) === String(record.type);
        if (idAgreement) postOverlay.idAgreements++;
        if (rarityAgreement) postOverlay.rarityAgreements++;
        if (typeAgreement) postOverlay.typeAgreements++;
        if (idAgreement && rarityAgreement && typeAgreement) postOverlay.allFieldAgreements++;
        else postOverlay.blockers++;
    }

    for (const patch of patchesToApply) {
        const original = indexed.selected.get(patch.cardId);
        if (!original) throw new Error(`K18 proof target missing for ${patch.cardId}`);
        const target = targetAtProductionPath(clone, patch.productionPath);
        if (original.rarityPresent) target.rarity = null;
        else delete target.rarity;
    }
    if (JSON.stringify(clone) !== productionSnapshot) throw new Error("K18 clone changed outside candidate rarity fields");
    for (const patch of patchesToApply) targetAtProductionPath(clone, patch.productionPath).rarity = patch.to;
    if (JSON.stringify(characters) !== productionSnapshot || JSON.stringify(validatedProjection) !== projectionSnapshot) {
        throw new Error("K18 input object mutation detected");
    }

    const examples = [...blockerExamples, ...candidateExamples].slice(0, CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT);
    const ready = blockers.total === 0
        && postOverlay.blockers === 0
        && postOverlay.allFieldAgreements === validatedProjection.records.length;
    return {
        characters: clone,
        patches,
        decision: {
            inventory: {
                k15Records: validatedProjection.records.length,
                productionTopLevelRecords: characters.length,
                selectedProductiveStates: indexed.selected.size,
                ambiguousProductiveIds: indexed.ambiguous.size,
            },
            evaluation: { binding, type, rarity, blockers },
            candidates: { count: patches.length, canonicalization: "utf8-json-array-v1", sha256: hash(JSON.stringify(patches)) },
            examples,
            overlayProof: {
                candidatesAppliedToClone: patchesToApply.length, candidateOnlyMutations: true,
                originalProductionRecordsMutated: 0, charactersCreated: 0, charactersRemoved: 0, postOverlay,
            },
            inputIntegrity: { originalInputsUnchanged: true, overlayCloneIsolated: true },
            readiness: ready ? "GO" : "NO-GO",
        },
    };
}
