import { DatabaseCardRecord } from "../database-experiment/contract";
import {
    CharacterIdentityRecord,
    CharacterRelationAssignment,
    CharacterRelationInventory,
    CharacterStateIdentityRecord,
    DatabaseCharacterIdentityCoverage,
    DatabaseCharacterIdentityDataset,
} from "./identity-contract";
import { CharacterSourceInput, streamDb1Cards } from "./source";

function relation(
    name: string,
    table: string,
    assignments: CharacterRelationAssignment[],
    note?: string,
): CharacterRelationInventory {
    const present = assignments.filter(item => Boolean(item.targetId));
    const danglingAssignments = assignments.filter(item => item.missing.some(value => value === "target_not_in_selected_identity_payload" || value === "target_id_or_join_missing"));
    const danglingTargetIds = [...new Set(danglingAssignments.flatMap(item => item.targetId ?? []))]
        .sort((left, right) => Number(left) - Number(right));
    const status = assignments.some(item => item.status === "unknown") ? "unknown"
        : assignments.some(item => item.status === "partial") ? "partial"
            : "supported";
    return {
        relation: name,
        status,
        sourceTable: table,
        rowCount: assignments.length,
        distinctSourceCount: new Set(assignments.map(item => item.sourceId)).size,
        distinctTargetCount: new Set(present.map(item => item.targetId!)).size,
        danglingTargetCount: danglingAssignments.length,
        partialAssignmentCount: assignments.filter(item => item.status === "partial").length,
        unknownAssignmentCount: assignments.filter(item => item.status === "unknown").length,
        danglingTargetIds,
        note,
        assignments,
    };
}

function assignment(options: {
    relation: string;
    sourceId: string;
    targetId?: string;
    table: string;
    rowId: string;
    resolved: boolean;
    partialWhenMissing?: boolean;
    columns: string[];
}): CharacterRelationAssignment {
    const status = options.resolved ? "supported" : options.partialWhenMissing ? "partial" : "unknown";
    return {
        assignmentId: `${options.relation}:${options.table}:${options.rowId}:${options.sourceId}:${options.targetId ?? "missing"}`,
        sourceId: options.sourceId,
        targetId: options.targetId,
        status,
        missing: options.resolved ? [] : [options.targetId ? "target_not_in_selected_identity_payload" : "target_id_or_join_missing"],
        source: { table: options.table, rowId: options.rowId, columns: options.columns },
    };
}

function stateIdentity(card: DatabaseCardRecord): CharacterStateIdentityRecord[] {
    return card.skillStates.map(state => {
        const growthRowId = state.growthStep?.provenance.rowId;
        return {
            stateId: growthRowId ? `card-state:${card.cardId}:growth:${growthRowId}` : `card-state:${card.cardId}:initial`,
            sourceStateKey: state.stateKey,
            cardId: card.cardId,
            formId: card.cardId,
            releaseState: state.releaseState,
            growthRowId,
            evidenceStatus: state.releaseState === "unknown" ? "unknown" : "supported",
        };
    });
}

export async function buildDatabaseCharacterIdentityDataset(
    source: CharacterSourceInput,
    cardsInput: AsyncIterable<DatabaseCardRecord> = streamDb1Cards(source.artifactPath),
): Promise<DatabaseCharacterIdentityDataset> {
    const cards: DatabaseCharacterIdentityDataset["cards"] = [];
    const states: CharacterStateIdentityRecord[] = [];
    const characterCards = new Map<string, string[]>();
    const characterUniqueInfos = new Map<string, Set<string>>();
    const characterRows = new Map<string, string>();
    const linkAssignments: CharacterRelationAssignment[] = [];
    const categoryAssignments: CharacterRelationAssignment[] = [];
    const awakeningAssignments: CharacterRelationAssignment[] = [];
    const formAssignments: CharacterRelationAssignment[] = [];
    const activeAssignments: CharacterRelationAssignment[] = [];
    const standbyAssignments: CharacterRelationAssignment[] = [];
    const finishAssignments: CharacterRelationAssignment[] = [];

    for await (const card of cardsInput) {
        if (!card.ids.characterId || !card.ids.cardUniqueInfoId || !card.character || !card.cardUniqueInfo) {
            throw new Error(`DB1 card ${card.cardId} lacks a supported character or unique-info identity`);
        }
        cards.push({
            cardId: card.cardId,
            recordKind: card.recordKind,
            characterId: card.ids.characterId,
            cardUniqueInfoId: card.ids.cardUniqueInfoId,
            resourceId: card.ids.resourceId,
            potentialBoardId: card.ids.potentialBoardId,
            hardDuplicateGroupId: card.grouping.hardDuplicateGroupId,
            awakeningFamilyId: card.grouping.awakeningFamilyId,
            variantGroupId: card.grouping.variantGroupId,
            uiGrouping: {
                collectionListed: card.catalog.isCollectionListed,
                projectedPrimary: card.catalog.isProjectedPrimary,
                downstreamCollectionCardIds: [...card.catalog.downstreamCollectionCardIds],
            },
            source: { table: "cards", rowId: card.card.provenance.rowId },
        });
        states.push(...stateIdentity(card));
        const characterCardIds = characterCards.get(card.ids.characterId) ?? [];
        characterCardIds.push(card.cardId);
        characterCards.set(card.ids.characterId, characterCardIds);
        const uniqueInfos = characterUniqueInfos.get(card.ids.characterId) ?? new Set<string>();
        uniqueInfos.add(card.ids.cardUniqueInfoId);
        characterUniqueInfos.set(card.ids.characterId, uniqueInfos);
        characterRows.set(card.ids.characterId, card.character.provenance.rowId);
        for (const item of card.links) {
            const targetId = String(card.card.values[`link_skill${item.slot}_id`] ?? "") || undefined;
            linkAssignments.push(assignment({ relation: `card_link:${item.slot}`, sourceId: card.cardId, targetId, table: "cards", rowId: card.cardId, columns: [`link_skill${item.slot}_id`], resolved: Boolean(item.skill) }));
        }
        for (const item of card.categories) {
            const targetId = String(item.relation.values.card_category_id ?? "") || undefined;
            categoryAssignments.push(assignment({ relation: "card_category", sourceId: card.cardId, targetId, table: "card_card_categories", rowId: item.relation.provenance.rowId, columns: item.relation.provenance.columns, resolved: Boolean(item.category) }));
        }
        for (const route of card.awakeningPaths.outgoing) {
            const targetId = String(route.values.awaked_card_id ?? "") || undefined;
            awakeningAssignments.push(assignment({ relation: "awakening", sourceId: card.cardId, targetId, table: "card_awakening_routes", rowId: route.provenance.rowId, columns: route.provenance.columns, resolved: false, partialWhenMissing: true }));
        }
        for (const item of card.formRelations) formAssignments.push(assignment({ relation: "form", sourceId: card.cardId, targetId: item.targetCardId, table: item.provenance.table, rowId: item.provenance.rowId, columns: item.provenance.columns, resolved: false }));
        for (const item of card.activeSkills) {
            const targetId = String(item.relation.values.active_skill_set_id ?? "") || undefined;
            activeAssignments.push(assignment({ relation: "active_skill_set", sourceId: card.cardId, targetId, table: "card_active_skills", rowId: item.relation.provenance.rowId, columns: item.relation.provenance.columns, resolved: Boolean(item.set) }));
        }
        for (const item of card.standbySkills) {
            const targetId = String(item.relation.values.standby_skill_set_id ?? "") || undefined;
            standbyAssignments.push(assignment({ relation: "standby_skill_set", sourceId: card.cardId, targetId, table: "card_standby_skill_set_relations", rowId: item.relation.provenance.rowId, columns: item.relation.provenance.columns, resolved: Boolean(item.set) }));
        }
        for (const item of card.finishSkills) {
            const targetId = item.set?.provenance.rowId;
            const relationRowId = item.relation?.provenance.rowId ?? `standby-derived:${targetId ?? "missing"}`;
            const finishAssignment = assignment({ relation: "finish_skill_set", sourceId: card.cardId, targetId, table: item.relation?.provenance.table ?? "standby_skill_set_finish_skill_set_relations", rowId: relationRowId, columns: item.relation?.provenance.columns ?? ["standby_skill_set_id", "finish_skill_set_id"], resolved: Boolean(item.set) });
            if (!item.relation) {
                finishAssignment.status = "partial";
                finishAssignment.missing = ["standby_derived_relation_row_not_retained_by_db1"];
            }
            finishAssignments.push(finishAssignment);
        }
    }

    cards.sort((left, right) => Number(left.cardId) - Number(right.cardId));
    states.sort((left, right) => left.stateId.localeCompare(right.stateId, undefined, { numeric: true }));
    const knownCardIds = new Set(cards.map(card => card.cardId));
    const characters: CharacterIdentityRecord[] = [...characterCards].map(([characterId, cardIds]) => ({
        characterId,
        cardIds: cardIds.sort((left, right) => Number(left) - Number(right)),
        cardUniqueInfoIds: [...(characterUniqueInfos.get(characterId) ?? [])].sort((left, right) => Number(left) - Number(right)),
        source: { table: "characters" as const, rowId: characterRows.get(characterId)! },
    })).sort((left, right) => Number(left.characterId) - Number(right.characterId));
    const knownCharacterIds = new Set(characters.map(item => item.characterId));
    const knownUniqueIds = new Set(cards.map(card => card.cardUniqueInfoId));
    for (const item of awakeningAssignments) item.status = item.targetId && knownCardIds.has(item.targetId) ? "supported" : "partial";
    for (const item of awakeningAssignments) item.missing = item.status === "supported" ? [] : ["target_not_in_selected_identity_payload"];
    for (const item of formAssignments) item.status = item.targetId && knownCardIds.has(item.targetId) ? "supported" : "unknown";
    for (const item of formAssignments) item.missing = item.status === "supported" ? [] : [item.targetId ? "target_not_in_selected_identity_payload" : "target_id_or_join_missing"];
    const cardCharacterAssignments = cards.map(card => assignment({ relation: "card_character", sourceId: card.cardId, targetId: card.characterId, table: "cards", rowId: card.cardId, columns: ["character_id"], resolved: knownCharacterIds.has(card.characterId) }));
    const cardUniqueAssignments = cards.map(card => assignment({ relation: "card_unique_info", sourceId: card.cardId, targetId: card.cardUniqueInfoId, table: "cards", rowId: card.cardId, columns: ["card_unique_info_id"], resolved: knownUniqueIds.has(card.cardUniqueInfoId) }));
    const relations = [
        relation("card_character", "cards", cardCharacterAssignments),
        relation("card_unique_info", "cards", cardUniqueAssignments),
        relation("card_link", "cards", linkAssignments),
        relation("card_category", "card_card_categories", categoryAssignments),
        relation("awakening", "card_awakening_routes", awakeningAssignments, "Targets outside the selected DB1 corpus remain explicit partial assignments."),
        relation("form", "passive/active/standby/finish_skills", formAssignments),
        relation("active_skill_set", "card_active_skills", activeAssignments),
        relation("standby_skill_set", "card_standby_skill_set_relations", standbyAssignments),
        relation("finish_skill_set", "card_finish_skill_set_relations", finishAssignments),
    ];
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-identity",
        contractVersion: "1.0.0",
        generatedAt: source.generatedAt,
        source: {
            snapshotVersion: source.snapshotVersion,
            databaseSha256: source.databaseSha256,
            db1DatasetVersion: source.datasetVersion,
            db1ArtifactSha256: source.artifactSha256,
            lineage: "validated-db1-stream-no-db0-db50-replay",
        },
        identityPolicy: {
            presentationTextAsJoinKey: false,
            cardIdentity: "cards.id",
            characterIdentity: "characters.id",
            formIdentity: "form-card cards.id",
            stateIdentity: "card id plus initial or optimal-awakening growth row id",
            uiGroupingSeparateFromCardIdentity: true,
        },
        characters,
        cards,
        states,
        relations,
    };
}

export function buildDatabaseCharacterIdentityCoverage(dataset: DatabaseCharacterIdentityDataset): DatabaseCharacterIdentityCoverage {
    const duplicateCount = (values: string[]) => values.length - new Set(values).size;
    return {
        schemaVersion: 1,
        characterCount: dataset.characters.length,
        cardCount: dataset.cards.length,
        collectableCardCount: dataset.cards.filter(card => card.recordKind === "collectable").length,
        formCardCount: dataset.cards.filter(card => card.recordKind === "form").length,
        stateCount: dataset.states.length,
        releaseStateCounts: {
            initial: dataset.states.filter(state => state.releaseState === "initial").length,
            eza: dataset.states.filter(state => state.releaseState === "eza").length,
            seza: dataset.states.filter(state => state.releaseState === "seza").length,
            unknown: dataset.states.filter(state => state.releaseState === "unknown").length,
        },
        projectedPrimaryCardCount: dataset.cards.filter(card => card.uiGrouping.projectedPrimary).length,
        supportedRelationCount: dataset.relations.filter(item => item.status === "supported").length,
        partialRelationCount: dataset.relations.filter(item => item.status === "partial").length,
        unknownRelationCount: dataset.relations.filter(item => item.status === "unknown").length,
        danglingTargetCount: dataset.relations.reduce((sum, item) => sum + item.danglingTargetCount, 0),
        partialAssignmentCount: dataset.relations.reduce((sum, item) => sum + item.partialAssignmentCount, 0),
        unknownAssignmentCount: dataset.relations.reduce((sum, item) => sum + item.unknownAssignmentCount, 0),
        duplicateCardIdentityCount: duplicateCount(dataset.cards.map(card => card.cardId)),
        duplicateStateIdentityCount: duplicateCount(dataset.states.map(state => state.stateId)),
    };
}
