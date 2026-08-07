import { DatabaseCardRecord, DatabaseSkillState, SourcedRow } from "../database-experiment/contract";
import { CharacterAwakeningKind, CharacterAwakeningTransition, CharacterFormKind, CharacterFormTransition, CharacterGraphState, CharacterReleaseStateTransition, DatabaseCharacterStateGraphCoverage, DatabaseCharacterStateGraphDataset } from "./state-graph-contract";
import { CharacterSourceInput, streamDb1Cards } from "./source";

function numeric(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function stateId(cardId: string, state: DatabaseSkillState): string {
    const growthRowId = state.growthStep?.provenance.rowId;
    return growthRowId ? `card-state:${cardId}:growth:${growthRowId}` : `card-state:${cardId}:initial`;
}

function awakeningKind(route: SourcedRow): CharacterAwakeningKind {
    if (route.values.type === "CardAwakeningRoute::Zet") return "z_awaken";
    if (route.values.type === "CardAwakeningRoute::Dokkan") return "dokkan_awaken";
    if (route.values.type === "CardAwakeningRoute::Optimal" && route.values.optimal_awakening_type === 1) return "eza";
    if (route.values.type === "CardAwakeningRoute::Optimal" && route.values.optimal_awakening_type === 2) return "seza";
    return "unknown";
}

function formKind(value: string): CharacterFormKind {
    if (value === "transformation") return "transformation";
    if (value === "giant-or-rage") return "giant_or_rage";
    if (value === "reversible-exchange") return "reversible_exchange";
    return "unknown";
}

export async function buildDatabaseCharacterStateGraphDataset(
    source: CharacterSourceInput,
    cardsInput: AsyncIterable<DatabaseCardRecord> = streamDb1Cards(source.artifactPath),
): Promise<DatabaseCharacterStateGraphDataset> {
    const cards: DatabaseCardRecord[] = [];
    for await (const card of cardsInput) cards.push(card);
    const knownCards = new Set(cards.map(card => card.cardId));
    const states: CharacterGraphState[] = cards.flatMap(card => card.skillStates.map(state => ({
        stateId: stateId(card.cardId, state),
        sourceStateKey: state.stateKey,
        cardId: card.cardId,
        releaseState: state.releaseState,
        growthRowId: state.growthStep?.provenance.rowId,
        growthStep: numeric(state.growthStep?.values.step),
        hardDuplicateGroupId: card.grouping.hardDuplicateGroupId,
    }))).sort((left, right) => left.stateId.localeCompare(right.stateId, undefined, { numeric: true }));
    const statesByCard = new Map<string, CharacterGraphState[]>();
    for (const state of states) statesByCard.set(state.cardId, [...(statesByCard.get(state.cardId) ?? []), state]);
    const awakeningTransitions: CharacterAwakeningTransition[] = [];
    const releaseStateTransitions: CharacterReleaseStateTransition[] = [];
    const seenRoutes = new Set<string>();
    for (const card of cards) {
        const orderedStates = [...(statesByCard.get(card.cardId) ?? [])].sort((left, right) => (left.growthStep ?? 0) - (right.growthStep ?? 0));
        const sourceStates = [...card.skillStates].sort((left, right) => (numeric(left.growthStep?.values.step) ?? 0) - (numeric(right.growthStep?.values.step) ?? 0));
        sourceStates.forEach((state, index) => {
            if (!state.growthStep || index === 0) return;
            const releaseState = state.releaseState === "eza" || state.releaseState === "seza" ? state.releaseState : "unknown";
            releaseStateTransitions.push({
                transitionId: `release-state:${card.cardId}:${state.growthStep.provenance.rowId}`,
                cardId: card.cardId,
                sourceStateId: stateId(card.cardId, sourceStates[index - 1]),
                targetStateId: stateId(card.cardId, state),
                releaseState,
                growthRowId: state.growthStep.provenance.rowId,
                growthStep: numeric(state.growthStep.values.step)!,
                evidenceStatus: releaseState === "unknown" ? "unknown" : "supported",
                routeRowIds: state.release.routes.map(route => route.provenance.rowId).sort((a, b) => Number(a) - Number(b)),
            });
        });
        for (const route of card.awakeningPaths.outgoing) {
            if (seenRoutes.has(route.provenance.rowId)) continue;
            seenRoutes.add(route.provenance.rowId);
            const kind = awakeningKind(route);
            const targetCardId = String(route.values.awaked_card_id ?? "");
            const step = numeric(route.values.optimal_awakening_step);
            const targetState = kind === "eza" || kind === "seza" ? orderedStates.find(state => state.growthStep === step) : undefined;
            const sourceState = targetState ? orderedStates[Math.max(0, orderedStates.indexOf(targetState) - 1)] : undefined;
            awakeningTransitions.push({
                transitionId: `awakening-route:${route.provenance.rowId}`,
                kind,
                sourceCardId: card.cardId,
                targetCardId,
                sourceStateId: sourceState?.stateId,
                targetStateId: targetState?.stateId,
                targetStatus: knownCards.has(targetCardId) ? "supported" : "partial",
                cardIdentityPolicy: kind === "z_awaken" ? "collapse_z_awakened_ui_duplicate"
                    : kind === "dokkan_awaken" ? "preserve_distinct_card_identity"
                        : kind === "eza" || kind === "seza" ? "same_card_release_progression" : "unknown",
                route: { table: "card_awakening_routes", rowId: route.provenance.rowId, rawType: route.values.type, optimalAwakeningType: route.values.optimal_awakening_type, optimalAwakeningStep: route.values.optimal_awakening_step },
            });
        }
    }
    const formTransitions: CharacterFormTransition[] = [];
    for (const card of cards) for (const item of card.formRelations) {
        if (!item.targetCardId) continue;
        const sourceStateIds = item.channel === "passive" && item.sourceSkillSetId
            ? card.skillStates.filter(state => state.passiveSkill?.set.provenance.rowId === item.sourceSkillSetId).map(state => stateId(card.cardId, state))
            : [];
        formTransitions.push({
            transitionId: `form:${item.channel}:${item.sourceSkillId}:${card.cardId}:${item.targetCardId}`,
            kind: formKind(item.kind.value),
            channel: item.channel,
            sourceCardId: card.cardId,
            targetCardId: item.targetCardId,
            sourceSkillId: item.sourceSkillId,
            sourceSkillSetId: item.sourceSkillSetId,
            sourceStateIds,
            stateBindingStatus: sourceStateIds.length > 0 ? "supported" : "partial",
            reversible: item.kind.value === "reversible-exchange",
            source: { table: item.provenance.table, rowId: item.provenance.rowId, columns: item.provenance.columns },
        });
    }
    awakeningTransitions.sort((left, right) => Number(left.route.rowId) - Number(right.route.rowId));
    formTransitions.sort((left, right) => left.transitionId.localeCompare(right.transitionId, undefined, { numeric: true }));
    return {
        schemaVersion: 1,
        contract: "dokkan-database-characters-state-graph",
        contractVersion: "1.0.0",
        generatedAt: source.generatedAt,
        source: { snapshotVersion: source.snapshotVersion, databaseSha256: source.databaseSha256, db1ArtifactSha256: source.artifactSha256, lineage: "validated-db1-stream-no-db0-db50-replay" },
        policy: { numericIdProximityInference: false, cardIdentitySeparateFromPlayableState: true, uiGroupingSeparateFromCardIdentity: true, originalRarityOwnedByTaxonomySidecar: true },
        states, releaseStateTransitions, awakeningTransitions, formTransitions,
    };
}

export function buildDatabaseCharacterStateGraphCoverage(dataset: DatabaseCharacterStateGraphDataset): DatabaseCharacterStateGraphCoverage {
    const awakeningTransitionCounts: Record<CharacterAwakeningKind, number> = { z_awaken: 0, dokkan_awaken: 0, eza: 0, seza: 0, unknown: 0 };
    const formTransitionCounts: Record<CharacterFormKind, number> = { transformation: 0, giant_or_rage: 0, reversible_exchange: 0, unknown: 0 };
    const formChannelCounts = { passive: 0, active: 0, standby: 0, finish: 0 };
    const releaseStateTransitionCounts = { eza: 0, seza: 0, unknown: 0 };
    dataset.releaseStateTransitions.forEach(item => releaseStateTransitionCounts[item.releaseState] += 1);
    dataset.awakeningTransitions.forEach(item => awakeningTransitionCounts[item.kind] += 1);
    dataset.formTransitions.forEach(item => { formTransitionCounts[item.kind] += 1; formChannelCounts[item.channel] += 1; });
    const transitionIds = [...dataset.releaseStateTransitions.map(item => item.transitionId), ...dataset.awakeningTransitions.map(item => item.transitionId), ...dataset.formTransitions.map(item => item.transitionId)];
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        releaseStateTransitionCounts,
        awakeningTransitionCounts,
        formTransitionCounts,
        formChannelCounts,
        supportedFormStateBindingCount: dataset.formTransitions.filter(item => item.stateBindingStatus === "supported").length,
        partialFormStateBindingCount: dataset.formTransitions.filter(item => item.stateBindingStatus === "partial").length,
        unknownFormStateBindingCount: dataset.formTransitions.filter(item => item.stateBindingStatus === "unknown").length,
        danglingAwakeningTargetIds: [...new Set(dataset.awakeningTransitions.filter(item => item.targetStatus !== "supported").map(item => item.targetCardId))].sort((a, b) => Number(a) - Number(b)),
        duplicateTransitionIdentityCount: transitionIds.length - new Set(transitionIds).size,
        duplicateStateIdentityCount: dataset.states.length - new Set(dataset.states.map(item => item.stateId)).size,
    };
}
