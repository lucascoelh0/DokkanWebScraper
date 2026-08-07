import { DatabaseCardRecord, DatabaseSkillState, SourcedRow } from "../database-experiment/contract";
import { IntegrationC1Dataset } from "../database-integration/integration-c1-contract";
import { countForbiddenConsumerFields } from "../database-integration/integration-c2-builder";
import { IntegrationC2Dataset, IntegrationC2Rule } from "../database-integration/integration-c2-contract";
import { CharacterSourceInput, streamDb1Cards } from "./source";
import { CharacterActionSkills, CharacterSkillRowRef, CharacterStateSkills, CharacterSupportedMechanic, DatabaseCharacterSkillsCoverage, DatabaseCharacterSkillsDataset } from "./skills-contract";

export const characterStateId = (cardId: string, state: DatabaseSkillState): string => state.growthStep ? `card-state:${cardId}:growth:${state.growthStep.provenance.rowId}` : `card-state:${cardId}:initial`;
const supportedKey = (rule: IntegrationC2Rule): string => `${rule.identity.stateKey}|${rule.identity.ruleKey}|${rule.identity.efficacyType}|${rule.identity.effectOrdinal}`;
export function stateContainsPassiveSkill(state: CharacterStateSkills, passiveSkillId: string): boolean {
    return state.passiveSkill?.relations.some(item => item.skill?.table === "passive_skills" && item.skill.rowId === passiveSkillId) ?? false;
}

function latestReleasedState(states: CharacterStateSkills[]): CharacterStateSkills | undefined {
    return states.filter(state => state.releaseState !== "unknown" && state.release.availableAtSnapshot !== false).sort((a, b) => (b.growthStepNumber ?? 0) - (a.growthStepNumber ?? 0))[0];
}

export async function buildDatabaseCharacterSkillsDataset(options: {
    source: CharacterSourceInput;
    c1: IntegrationC1Dataset;
    c2: IntegrationC2Dataset;
    c1Artifact: DatabaseCharacterSkillsDataset["source"]["c1AuditArtifact"];
    c2Artifact: DatabaseCharacterSkillsDataset["source"]["c2SupportedArtifact"];
    cardsInput?: AsyncIterable<DatabaseCardRecord>;
}): Promise<DatabaseCharacterSkillsDataset> {
    if (options.c1.sourceSnapshotVersion !== options.source.snapshotVersion || options.c1.sourceDatabaseSha256 !== options.source.databaseSha256) throw new Error("C1 source identity does not match DB1");
    if (options.c2.sourceSnapshotVersion !== options.source.snapshotVersion || options.c2.sourceDatabaseSha256 !== options.source.databaseSha256 || options.c2.auditSidecar.sha256 !== options.c1Artifact.sha256) throw new Error("C2 source identity does not match DB1/C1");
    const stateSkills: CharacterStateSkills[] = [];
    const actionSkills: CharacterActionSkills[] = [];
    const rawRows = new Map<string, SourcedRow>();
    const ref = (row: SourcedRow | undefined): CharacterSkillRowRef | undefined => {
        if (!row) return undefined;
        const key = `${row.provenance.table}:${row.provenance.rowId}`, previous = rawRows.get(key);
        if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error(`Conflicting source rows for ${key}`);
        rawRows.set(key, row);
        return { table: row.provenance.table, rowId: row.provenance.rowId };
    };
    for await (const card of options.cardsInput ?? streamDb1Cards(options.source.artifactPath)) {
        for (const state of card.skillStates) stateSkills.push({ stateId: characterStateId(card.cardId, state), sourceStateKey: state.stateKey, cardId: card.cardId, releaseState: state.releaseState,
            release: { availableAt: state.release.availableAt, availableAtSnapshot: state.release.availableAtSnapshot, routes: state.release.routes.map(row => ref(row)!) }, growthStep: ref(state.growthStep), growthStepNumber: state.growthStep ? Number(state.growthStep.values.step) : undefined, maxLevel: state.maxLevel, maxSuperAttackLevel: state.maxSuperAttackLevel,
            leaderSkill: state.leaderSkill ? { set: ref(state.leaderSkill.set)!, effects: state.leaderSkill.effects.map(row => ref(row)!), targetRows: state.leaderSkill.targetRows.map(row => ref(row)!), structuredPercentValues: state.leaderSkill.structuredPercentValues } : undefined,
            passiveSkill: state.passiveSkill ? { set: ref(state.passiveSkill.set)!, relations: state.passiveSkill.relations.map(item => ({ relation: ref(item.relation)!, skill: ref(item.skill), effect: ref(item.effect), causalities: item.causalities.map(row => ref(row)!) })) } : undefined,
            attacks: state.attacks.map(item => ({ cardSpecial: ref(item.cardSpecial)!, specialSet: ref(item.specialSet), effects: item.effects.map(row => ref(row)!), extraOption: ref(item.extraOption), variant: item.variant, availableFromSuperAttackLevel: item.availableFromSuperAttackLevel })) });
        if (card.activeSkills.length || card.standbySkills.length || card.finishSkills.length) actionSkills.push({ cardId: card.cardId,
            activeSkills: card.activeSkills.map(item => ({ relation: ref(item.relation)!, set: ref(item.set), effects: item.effects.map(row => ref(row)!) })),
            standbySkills: card.standbySkills.map(item => ({ relation: ref(item.relation)!, set: ref(item.set), effects: item.effects.map(row => ref(row)!), finishSkillSetIds: item.finishSkillSetIds })),
            finishSkills: card.finishSkills.map(item => ({ relation: ref(item.relation), set: ref(item.set), effects: item.effects.map(row => ref(row)!), standbySkillSetIds: item.standbySkillSetIds })) });
    }
    stateSkills.sort((a, b) => a.stateId.localeCompare(b.stateId, undefined, { numeric: true }));
    actionSkills.sort((a, b) => Number(a.cardId) - Number(b.cardId));
    const statesByCard = new Map<string, CharacterStateSkills[]>();
    for (const state of stateSkills) statesByCard.set(state.cardId, [...(statesByCard.get(state.cardId) ?? []), state]);
    const supportedMechanics: CharacterSupportedMechanic[] = options.c2.rules.map(rule => {
        const state = latestReleasedState(statesByCard.get(rule.identity.formId) ?? []);
        if (!state) throw new Error(`C2 state does not structurally join: ${rule.identity.stateKey}`);
        const projectedReleaseState = rule.identity.formId === rule.identity.cardId ? state.releaseState : "initial";
        if (projectedReleaseState !== rule.identity.releaseState) throw new Error(`C2 release-state projection does not join: ${rule.identity.stateKey}`);
        if (!stateContainsPassiveSkill(state, rule.identity.passiveSkillId)) throw new Error(`C2 passive skill does not join selected state: ${supportedKey(rule)}`);
        return { stateId: state.stateId, sourceTeamAnalysisStateKey: rule.identity.stateKey, sourceReleaseState: state.releaseState, identity: rule.identity, supported: rule.supported };
    });
    return { schemaVersion: 1, contract: "dokkan-database-characters-skills", contractVersion: "1.0.0", generatedAt: options.source.generatedAt,
        source: { snapshotVersion: options.source.snapshotVersion, databaseSha256: options.source.databaseSha256, db1ArtifactSha256: options.source.artifactSha256, c1AuditArtifact: options.c1Artifact, c2SupportedArtifact: options.c2Artifact },
        policy: { rawSkillRowsAreAuditOnly: true, rawRowsNormalizedByTableAndRowId: true, supportedMechanicsAreC2ExactProjection: true, partialOrUnknownMechanicsInConsumerChannel: false, textUsedAsIdentity: false },
        rawRows: [...rawRows.values()].sort((a, b) => `${a.provenance.table}:${a.provenance.rowId}`.localeCompare(`${b.provenance.table}:${b.provenance.rowId}`, undefined, { numeric: true })), stateSkills, actionSkills, supportedMechanics };
}

export function buildDatabaseCharacterSkillsCoverage(dataset: DatabaseCharacterSkillsDataset): DatabaseCharacterSkillsCoverage {
    const attackCounts = { super: 0, ultra: 0, unit: 0, ex: 0, unknown: 0 };
    for (const state of dataset.stateSkills) for (const attack of state.attacks) attackCounts[attack.variant.value] += 1;
    const supportedKeys = dataset.supportedMechanics.map(rule => supportedKey(rule));
    return { schemaVersion: 1, rawRowCount: dataset.rawRows.length, stateCount: dataset.stateSkills.length, leaderSkillStateCount: dataset.stateSkills.filter(state => state.leaderSkill).length, passiveSkillStateCount: dataset.stateSkills.filter(state => state.passiveSkill).length,
        attackCounts, activeSkillCardCount: dataset.actionSkills.filter(card => card.activeSkills.length).length, standbySkillCardCount: dataset.actionSkills.filter(card => card.standbySkills.length).length, finishSkillCardCount: dataset.actionSkills.filter(card => card.finishSkills.length).length,
        supportedMechanicRuleCount: dataset.supportedMechanics.length, supportedMechanicStateCount: new Set(dataset.supportedMechanics.map(rule => rule.stateId)).size, supportedMechanicPassiveSkillCount: new Set(dataset.supportedMechanics.map(rule => rule.identity.passiveSkillId)).size,
        supportedTimingCount: dataset.supportedMechanics.filter(rule => rule.supported.timing).length, unjoinedSupportedRuleCount: 0,
        forbiddenConsumerFieldCount: countForbiddenConsumerFields(dataset.supportedMechanics.map(({ stateId, sourceTeamAnalysisStateKey, sourceReleaseState, ...rule }) => rule)), duplicateStateIdentityCount: dataset.stateSkills.length - new Set(dataset.stateSkills.map(state => state.stateId)).size,
        duplicateSupportedRuleIdentityCount: supportedKeys.length - new Set(supportedKeys).size };
}
