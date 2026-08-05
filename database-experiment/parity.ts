import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { DatabaseCardRecord, DatabaseCharacterExperimentDataset, DatabaseExperimentCoverage } from "./contract";

export interface SiteAuditFixtures {
    schemaVersion: 1,
    auditedAt: string,
    entries: Array<{
        cardId: string,
        url: string,
        finding: "local-leader-text-stale" | "local-character-snapshot-stale" | "collection-cards-omission" | "z-awakened-form-projection",
        note: string,
    }>,
    formProjectionAliases: Array<{
        databaseCardId: string,
        projectedCardId: string,
        url: string,
        evidence: string,
    }>,
}

export interface ParitySummary {
    currentCharacterCount: number,
    currentNestedStateCount: number,
    databaseCardCount: number,
    databaseStateCount: number,
    currentIdsMissingInDatabase: string[],
    databaseCollectableIdsMissingInCurrent: string[],
    projectedPrimaryCount: number,
    projectedMatchedIdCount: number,
    currentIdsMissingInProjectedCatalog: string[],
    databaseProjectedPrimaryIdsMissingInCurrent: string[],
    catalogConflictDetails: {
        databaseProjectedPrimaryOnly: Array<{ cardId: string, name: string, openAt: string | null }>,
        currentOnlyProjection: Array<{ cardId: string, name: string, collectionListed: boolean, hpInitial: number | null, incomingAwakeningCount: number, outgoingAwakeningCount: number }>,
    },
    matchedIdCount: number,
    exactNameMatches: number,
    exactRarityMatches: number,
    exactTypeMatches: number,
    exactClassMatches: number,
    classApplicableCount: number,
    leaderTextMatches: number,
    leaderPercentageMatches: number,
    linkSetMatches: number,
    categorySetMatches: number,
    currentMechanics: Record<string, number>,
    databaseMechanics: Record<string, number>,
    mechanicParity: Record<string, { matches: number, databaseOnly: number, currentOnly: number }>,
    awakeningGroupsWithMultipleCurrentPrimaryIds: Array<{ groupId: string, cardIds: string[] }>,
    conflicts: Array<{
        cardId: string,
        name: string,
        fields: string[],
        details: Record<string, { database: unknown, current: unknown }>,
    }>,
}

function currentId(value: unknown): string | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    return String(value);
}

function normalizedText(value: unknown): string {
    return typeof value === "string" ? value.trim().split(/\s+/).join(" ") : "";
}

function sortedStrings(values: unknown[]): string[] {
    return [...new Set(values.filter(value => typeof value === "string").map(value => normalizedText(value)).filter(Boolean))].sort();
}

function sameArray(left: unknown[], right: unknown[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function latestReleasedState(card: DatabaseCardRecord) {
    return card.skillStates.filter(state => state.release.availableAtSnapshot === true).at(-1) ?? card.skillStates[0];
}

function logicalAttacks(card: DatabaseCardRecord) {
    const attacks = latestReleasedState(card).attacks;
    const byKey = new Map<string, typeof attacks[number]>();
    for (const attack of attacks) {
        const set = attack.specialSet?.values;
        const cardSpecial = attack.cardSpecial.values;
        const key = JSON.stringify([
            attack.variant.value,
            attack.availableFromSuperAttackLevel,
            cardSpecial.eball_num_start,
            cardSpecial.causality_conditions,
            normalizedText(set?.name),
            normalizedText(set?.description),
            normalizedText(set?.causality_description),
        ]);
        if (!byKey.has(key)) byKey.set(key, attack);
    }
    return [...byKey.values()];
}

function sourcedText(row: { values: Record<string, unknown> } | undefined, column: string): string {
    return normalizedText(row?.values[column]);
}

function databaseLinks(card: DatabaseCardRecord): string[] {
    return sortedStrings(card.links.map(link => link.skill?.values.name));
}

function databaseCategories(card: DatabaseCardRecord): string[] {
    return sortedStrings(card.categories.map(category => category.category?.values.name));
}

function currentLeaderPercentages(character: any): number[] {
    const clauses = Array.isArray(character?.leaderSkillDetails?.clauses) ? character.leaderSkillDetails.clauses : [];
    const values: number[] = clauses.flatMap((clause: any) => [clause.hp, clause.atk, clause.def])
        .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value !== 0);
    return Array.from(new Set<number>(values)).sort((a, b) => a - b);
}

function databaseTransformationClosure(card: DatabaseCardRecord, cardsById: Map<string, DatabaseCardRecord>): string[] {
    const visited = new Set<string>();
    const pending = card.formRelations.flatMap(relation => relation.targetCardId ?? []);
    while (pending.length > 0) {
        const targetId = pending.shift()!;
        if (visited.has(targetId) || targetId === card.cardId) continue;
        visited.add(targetId);
        const target = cardsById.get(targetId);
        if (target) pending.push(...target.formRelations.flatMap(relation => relation.targetCardId ?? []));
    }
    return [...visited].sort((left, right) => Number(left) - Number(right));
}

export async function readCurrentCharacters(gzipPath: string): Promise<any[]> {
    const compressed = await readFile(gzipPath);
    const parsed = JSON.parse(gunzipSync(compressed).toString("utf8"));
    if (!Array.isArray(parsed)) throw new Error(`Current character payload is not an array: ${gzipPath}`);
    return parsed;
}

export async function readSiteAuditFixtures(
    fixturePath = existsSync(resolve(__dirname, "site-audit-fixtures.json"))
        ? resolve(__dirname, "site-audit-fixtures.json")
        : resolve(__dirname, "..", "..", "database-experiment", "site-audit-fixtures.json"),
): Promise<SiteAuditFixtures> {
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as SiteAuditFixtures;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries) || !Array.isArray(parsed.formProjectionAliases)) {
        throw new Error("Unsupported database experiment site-audit fixture contract");
    }
    return parsed;
}

export function compareWithCurrentDataset(dataset: DatabaseCharacterExperimentDataset, current: any[], siteAudit?: SiteAuditFixtures): ParitySummary {
    const databaseById = new Map(dataset.cards.map(card => [card.cardId, card]));
    const currentById = new Map(current.flatMap(character => {
        const characterId = currentId(character.id);
        return characterId ? [[characterId, character] as const] : [];
    }));
    const currentIdsMissingInDatabase = [...currentById.keys()].filter(cardId => !databaseById.has(cardId)).sort((a, b) => Number(a) - Number(b));
    const databaseCollectableIdsMissingInCurrent = dataset.cards
        .filter(card => card.recordKind === "collectable" && !currentById.has(card.cardId))
        .map(card => card.cardId)
        .sort((a, b) => Number(a) - Number(b));
    const projectedPrimaryIds = dataset.cards.filter(card => card.catalog.isProjectedPrimary).map(card => card.cardId);
    const projectedPrimaryIdSet = new Set(projectedPrimaryIds);
    const currentIdsMissingInProjectedCatalog = [...currentById.keys()].filter(cardId => !projectedPrimaryIdSet.has(cardId)).sort((a, b) => Number(a) - Number(b));
    const databaseProjectedPrimaryIdsMissingInCurrent = projectedPrimaryIds.filter(cardId => !currentById.has(cardId)).sort((a, b) => Number(a) - Number(b));
    let exactNameMatches = 0; let exactRarityMatches = 0; let exactTypeMatches = 0; let exactClassMatches = 0; let classApplicableCount = 0;
    let leaderTextMatches = 0; let leaderPercentageMatches = 0; let linkSetMatches = 0; let categorySetMatches = 0;
    const conflicts: ParitySummary["conflicts"] = [];
    const mechanicParity: ParitySummary["mechanicParity"] = {};
    const recordMechanic = (name: string, databaseValue: unknown, currentValue: unknown) => {
        const entry = mechanicParity[name] ?? { matches: 0, databaseOnly: 0, currentOnly: 0 };
        const present = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(value);
        const matches = JSON.stringify(databaseValue) === JSON.stringify(currentValue);
        if (matches) entry.matches += 1;
        else if (present(databaseValue) && !present(currentValue)) entry.databaseOnly += 1;
        else entry.currentOnly += 1;
        mechanicParity[name] = entry;
        return matches;
    };

    for (const [cardId, character] of currentById) {
        const card = databaseById.get(cardId);
        if (!card) continue;
        const state = latestReleasedState(card);
        const fields: string[] = [];
        const details: Record<string, { database: unknown, current: unknown }> = {};
        const mismatch = (field: string, databaseValue: unknown, currentValue: unknown) => {
            fields.push(field);
            details[field] = { database: databaseValue, current: currentValue };
        };
        if (normalizedText(card.localizedText.name) === normalizedText(character.name)) exactNameMatches += 1; else mismatch("name", card.localizedText.name, character.name);
        if (card.rarity.value === character.rarity) exactRarityMatches += 1; else mismatch("rarity", card.rarity, character.rarity);
        if (card.type.value === character.type) exactTypeMatches += 1; else mismatch("type", card.type, character.type);
        if (card.characterClass.value !== "unawakened") {
            classApplicableCount += 1;
            if (card.characterClass.value === character.characterClass) exactClassMatches += 1; else mismatch("characterClass", card.characterClass, character.characterClass);
        }
        const dbLeaderText = sourcedText(state?.leaderSkill?.set, "description");
        const currentLeaderText = normalizedText(character.leaderSkill);
        if (dbLeaderText === currentLeaderText) leaderTextMatches += 1; else if (dbLeaderText || character.leaderSkill) mismatch("leaderSkillText", dbLeaderText, currentLeaderText);
        const dbLeaderPercentages = state?.leaderSkill?.structuredPercentValues ?? [];
        const currentPercentages = currentLeaderPercentages(character);
        if (sameArray(dbLeaderPercentages, currentPercentages)) leaderPercentageMatches += 1; else mismatch("leaderPercentages", dbLeaderPercentages, currentPercentages);
        const dbLinks = databaseLinks(card); const currentLinks = sortedStrings(Array.isArray(character.links) ? character.links : []);
        if (sameArray(dbLinks, currentLinks)) linkSetMatches += 1; else mismatch("links", dbLinks, currentLinks);
        const dbCategories = databaseCategories(card); const currentCategories = sortedStrings(Array.isArray(character.categories) ? character.categories : []);
        if (sameArray(dbCategories, currentCategories)) categorySetMatches += 1; else mismatch("categories", dbCategories, currentCategories);

        const currentTransformIds = sortedStrings((character.transformations ?? []).map((form: any) => currentId(form.id)));
        const databaseTransformIds = databaseTransformationClosure(card, databaseById);
        if (!recordMechanic("transformationTargetSet", databaseTransformIds, currentTransformIds)) mismatch("transformationTargets", databaseTransformIds, currentTransformIds);
        const missingCurrentTransformIds = currentTransformIds.filter(targetId => !databaseTransformIds.includes(targetId));
        recordMechanic("transformationCurrentTargetCoverage", missingCurrentTransformIds.length === 0, true);
        const auditedDatabaseTransformIds = [...new Set([
            ...databaseTransformIds,
            ...(siteAudit?.formProjectionAliases ?? [])
                .filter(alias => databaseTransformIds.includes(alias.databaseCardId))
                .map(alias => alias.projectedCardId),
        ])];
        const missingAuditedTransformIds = currentTransformIds.filter(targetId => !auditedDatabaseTransformIds.includes(targetId));
        recordMechanic("transformationAuditedProjectionCoverage", missingAuditedTransformIds.length === 0, true);
        const activeValues = [card.activeSkills.length > 0, Boolean(character.activeSkill)];
        if (!recordMechanic("active", activeValues[0], activeValues[1])) mismatch("activePresence", activeValues[0], activeValues[1]);
        const standbyValues = [card.standbySkills.length > 0, Boolean(character.standby)];
        if (!recordMechanic("standby", standbyValues[0], standbyValues[1])) mismatch("standbyPresence", standbyValues[0], standbyValues[1]);
        const finishValues = [card.finishSkills.length > 0, Array.isArray(character.finishSkills) && character.finishSkills.length > 0];
        if (!recordMechanic("finish", finishValues[0], finishValues[1])) mismatch("finishPresence", finishValues[0], finishValues[1]);
        const exchangeValues = [card.formRelations.some(relation => relation.kind.value === "reversible-exchange"), Boolean(character.reversibleExchange) || (character.transformations ?? []).some((form: any) => form.transformationSource === "reversible-exchange")];
        if (!recordMechanic("reversibleExchange", exchangeValues[0], exchangeValues[1])) mismatch("reversibleExchange", exchangeValues[0], exchangeValues[1]);
        const unitValues = [logicalAttacks(card).filter(attack => attack.variant.value === "unit").length, Array.isArray(character.unitSuperAttacks) ? character.unitSuperAttacks.length : 0];
        if (!recordMechanic("unitAttackCount", unitValues[0], unitValues[1])) mismatch("unitAttackCount", unitValues[0], unitValues[1]);
        const exValues = [state.attacks.some(attack => attack.variant.value === "ex"), Boolean(character.exSuperAttack)];
        if (!recordMechanic("exAttack", exValues[0], exValues[1])) mismatch("exAttack", exValues[0], exValues[1]);
        if (fields.length > 0) conflicts.push({ cardId, name: card.localizedText.name, fields, details });
    }

    const currentMechanics = {
        active: current.filter(character => Boolean(character.activeSkill)).length,
        standby: current.filter(character => Boolean(character.standby)).length,
        finish: current.filter(character => Array.isArray(character.finishSkills) && character.finishSkills.length > 0).length,
        reversibleExchange: current.filter(character => Boolean(character.reversibleExchange) || (character.transformations ?? []).some((form: any) => form.transformationSource === "reversible-exchange")).length,
        transformations: current.reduce((sum, character) => sum + (Array.isArray(character.transformations) ? character.transformations.length : 0), 0),
        unitAttacks: current.reduce((sum, character) => sum + (Array.isArray(character.unitSuperAttacks) ? character.unitSuperAttacks.length : 0), 0),
        exAttacks: current.filter(character => Boolean(character.exSuperAttack)).length,
    };
    const databaseMechanics = {
        active: dataset.cards.filter(card => card.activeSkills.length > 0).length,
        standby: dataset.cards.filter(card => card.standbySkills.length > 0).length,
        finish: dataset.cards.filter(card => card.finishSkills.length > 0).length,
        reversibleExchange: dataset.cards.filter(card => card.formRelations.some(relation => relation.kind.value === "reversible-exchange")).length,
        transformations: dataset.cards.reduce((sum, card) => sum + card.formRelations.filter(relation => relation.kind.value !== "unknown").length, 0),
        unitAttacks: dataset.cards.reduce((sum, card) => sum + logicalAttacks(card).filter(attack => attack.variant.value === "unit").length, 0),
        exAttacks: dataset.cards.filter(card => logicalAttacks(card).some(attack => attack.variant.value === "ex")).length,
    };

    const currentIdsByAwakeningGroup = new Map<string, string[]>();
    for (const cardId of currentById.keys()) {
        const card = databaseById.get(cardId);
        if (!card) continue;
        const values = currentIdsByAwakeningGroup.get(card.grouping.awakeningFamilyId) ?? [];
        values.push(cardId);
        currentIdsByAwakeningGroup.set(card.grouping.awakeningFamilyId, values);
    }
    const fieldPriority: Record<string, number> = { transformationTargets: 11, leaderSkillText: 10, unitAttackCount: 10, standbyPresence: 10, finishPresence: 10, reversibleExchange: 10, exAttack: 10, links: 9, categories: 9, name: 8, rarity: 8, type: 8, leaderPercentages: 6, characterClass: 3 };
    return {
        currentCharacterCount: current.length,
        currentNestedStateCount: current.reduce((sum, character) => sum + 1 + (Array.isArray(character.transformations) ? character.transformations.length : 0), 0),
        databaseCardCount: dataset.cards.length,
        databaseStateCount: dataset.cards.reduce((sum, card) => sum + card.skillStates.length, 0),
        currentIdsMissingInDatabase,
        databaseCollectableIdsMissingInCurrent,
        projectedPrimaryCount: projectedPrimaryIds.length,
        projectedMatchedIdCount: projectedPrimaryIds.length - databaseProjectedPrimaryIdsMissingInCurrent.length,
        currentIdsMissingInProjectedCatalog,
        databaseProjectedPrimaryIdsMissingInCurrent,
        catalogConflictDetails: {
            databaseProjectedPrimaryOnly: databaseProjectedPrimaryIdsMissingInCurrent.map(cardId => {
                const card = databaseById.get(cardId)!;
                return { cardId, name: card.localizedText.name, openAt: card.dates.openAt };
            }),
            currentOnlyProjection: currentIdsMissingInProjectedCatalog.flatMap(cardId => {
                const card = databaseById.get(cardId);
                return card ? [{
                    cardId,
                    name: card.localizedText.name,
                    collectionListed: card.catalog.isCollectionListed,
                    hpInitial: card.stats.hpInitial,
                    incomingAwakeningCount: card.awakeningPaths.incoming.length,
                    outgoingAwakeningCount: card.awakeningPaths.outgoing.length,
                }] : [];
            }),
        },
        matchedIdCount: current.length - currentIdsMissingInDatabase.length,
        exactNameMatches,
        exactRarityMatches,
        exactTypeMatches,
        exactClassMatches,
        classApplicableCount,
        leaderTextMatches,
        leaderPercentageMatches,
        linkSetMatches,
        categorySetMatches,
        currentMechanics,
        databaseMechanics,
        mechanicParity,
        awakeningGroupsWithMultipleCurrentPrimaryIds: [...currentIdsByAwakeningGroup.entries()]
            .filter(([, cardIds]) => cardIds.length > 1)
            .map(([groupId, cardIds]) => ({ groupId, cardIds: cardIds.sort((a, b) => Number(a) - Number(b)) }))
            .sort((left, right) => Number(left.cardIds[0]) - Number(right.cardIds[0])),
        conflicts: conflicts.sort((left, right) => Math.max(...right.fields.map(field => fieldPriority[field] ?? 0)) - Math.max(...left.fields.map(field => fieldPriority[field] ?? 0)) || right.fields.length - left.fields.length || Number(left.cardId) - Number(right.cardId)),
    };
}

function pct(value: number, total: number): string {
    return total === 0 ? "0.00%" : `${(100 * value / total).toFixed(2)}%`;
}

function idExamples(ids: string[]): string {
    return ids.length === 0 ? "none" : ids.slice(0, 50).join(", ") + (ids.length > 50 ? ` … (+${ids.length - 50})` : "");
}

export function renderParityReport(summary: ParitySummary, coverage: DatabaseExperimentCoverage, siteAudit?: SiteAuditFixtures): string {
    const total = summary.matchedIdCount;
    const db1Go = summary.currentIdsMissingInDatabase.length === 0
        && coverage.projectedPrimaryUnknownReleaseStateCount === 0;
    const compact = (value: unknown) => JSON.stringify(value).replaceAll("|", "\\|").slice(0, 180);
    const conflictRows = summary.conflicts.slice(0, 20).map(conflict => {
        const preferredFields = ["transformationTargets", "leaderSkillText", "unitAttackCount", "standbyPresence", "finishPresence", "reversibleExchange", "exAttack"];
        const field = preferredFields.find(candidate => conflict.fields.includes(candidate)) ?? conflict.fields[0];
        const detail = conflict.details[field];
        return `| ${conflict.cardId} | ${conflict.name.replaceAll("|", "\\|")} | ${conflict.fields.join(", ")} | ${detail ? `${compact(detail.database)} → ${compact(detail.current)}` : "—"} |`;
    }).join("\n");
    const mechanicRows = Object.entries(summary.mechanicParity).map(([mechanic, values]) => `| ${mechanic} | ${values.matches} | ${values.databaseOnly} | ${values.currentOnly} |`).join("\n");
    const duplicateExamples = summary.awakeningGroupsWithMultipleCurrentPrimaryIds.slice(0, 20).map(group => `${group.groupId}=[${group.cardIds.join(", ")}]`).join("; ") || "none";
    const enumRows = Object.entries(coverage.enumEvidence).map(([name, evidence]) => {
        const unknown = evidence.unknown.slice(0, 30).join(", ") + (evidence.unknown.length > 30 ? ` … (+${evidence.unknown.length - 30})` : "");
        return `| ${name} | ${evidence.confirmed.join(", ") || "none"} | ${unknown || "none"} | ${evidence.note.replaceAll("|", "\\|")} |`;
    }).join("\n");
    const projectedOnlyRows = summary.catalogConflictDetails.databaseProjectedPrimaryOnly
        .map(item => `| ${item.cardId} | ${item.name.replaceAll("|", "\\|")} | first-party projected only | open_at=${item.openAt ?? "unknown"} |`);
    const currentOnlyRows = summary.catalogConflictDetails.currentOnlyProjection
        .map(item => `| ${item.cardId} | ${item.name.replaceAll("|", "\\|")} | current projection only | collection=${item.collectionListed}; hp_init=${item.hpInitial}; awakening in/out=${item.incomingAwakeningCount}/${item.outgoingAwakeningCount} |`);
    const catalogConflictRows = [...projectedOnlyRows, ...currentOnlyRows].join("\n");
    const siteAuditRows = (siteAudit?.entries ?? []).map(entry => `| ${entry.cardId} | ${entry.finding} | [source](${entry.url}) | ${entry.note.replaceAll("|", "\\|")} |`).join("\n");
    return `# Gate DB1 identity and release-state report

## Recommendation

**NO-GO** for replacing the production HTML source today; **${db1Go ? "GO" : "NO-GO"}** to proceed to DB2.

DB1 proves a deterministic first-party catalog projection and labels EZA/SEZA states from first-party route enums with localized first-party corroboration. Production cutover remains unsafe until DB2 validates the structured Team Analysis mechanics and the ${summary.currentIdsMissingInProjectedCatalog.length} current-only catalog exceptions receive an explicit compatibility policy.

The comparison target is a local FYI snapshot. A versioned site audit dated ${siteAudit?.auditedAt ?? "unknown"} confirms that some reported differences are snapshot lag or display projection, not first-party data loss.

## Scope and identity

| Metric | Database | Current dataset |
| --- | ---: | ---: |
| Full experimental corpus | ${summary.databaseCardCount} | ${summary.currentCharacterCount} |
| State records (including growth/nested forms) | ${summary.databaseStateCount} | ${summary.currentNestedStateCount} |
| Projected primary catalog | ${summary.projectedPrimaryCount} | ${summary.currentCharacterCount} |
| Projected primary IDs joined | ${summary.projectedMatchedIdCount} | ${summary.currentCharacterCount} |
| Projected IDs absent from the other source | ${summary.databaseProjectedPrimaryIdsMissingInCurrent.length} | ${summary.currentIdsMissingInProjectedCatalog.length} |

- Current IDs missing anywhere in the database corpus: ${idExamples(summary.currentIdsMissingInDatabase)}
- Projected first-party IDs missing in current dataset: ${idExamples(summary.databaseProjectedPrimaryIdsMissingInCurrent)}
- Current IDs outside the projected first-party catalog: ${idExamples(summary.currentIdsMissingInProjectedCatalog)}
- The broad diagnostic corpus retains ${summary.databaseCollectableIdsMissingInCurrent.length} collectable-looking rows absent from current for provenance; they are not all projected as primaries.
- Projection rule: a card must be listed in \`collection_cards\` and have no reachable downstream \`collection_cards\` record through first-party awakening routes. It yields ${summary.projectedMatchedIdCount}/${summary.currentCharacterCount} current IDs without names, ID-suffix heuristics, or site data.
- Awakening/hard-duplicate identity is derived only from first-party route and confirmed form edges. Display-name equality is never used.
- Awakening families containing multiple current primary IDs: ${summary.awakeningGroupsWithMultipleCurrentPrimaryIds.length}; examples: ${duplicateExamples}.

## Release states

- Confirmed EZA states: ${coverage.confirmedEzaStateCount}; confirmed SEZA states: ${coverage.confirmedSezaStateCount}; unknown growth states: ${coverage.unknownReleaseStateCount}.
- Projected-primary unknown states: ${coverage.projectedPrimaryUnknownReleaseStateCount}.
- Future/preloaded states at the snapshot cutoff: ${coverage.futureReleaseStateCount} total, ${coverage.projectedPrimaryFutureReleaseStateCount} on projected primaries. They remain in the artifact with \`availableAtSnapshot=false\` and are excluded from parity projection.
- Type \`1\` is corroborated as EZA and type \`2\` as SEZA by preserved first-party help/mission rows. Dates come from the exact matching \`card_awakening_routes.open_at\`; transformed forms inherit only through structured form edges.

## Catalog projection conflicts

| Card ID | Database name | Side | First-party evidence |
| --- | --- | --- | --- |
${catalogConflictRows || "| — | — | none | — |"}

The terminal \`collection_cards\` projection is high-confidence but not exhaustive: valid cards can exist in \`cards\` and on the current site without a \`collection_cards\` row. It must therefore remain one catalog signal rather than the sole inclusion authority.

## Post-snapshot site audit

| Card ID | Finding | Evidence | Resolution |
| --- | --- | --- | --- |
${siteAuditRows || "| — | none | — | — |"}

## Exact-ID parity

| Field | Matches | Coverage |
| --- | ---: | ---: |
| Name | ${summary.exactNameMatches} | ${pct(summary.exactNameMatches, total)} |
| Rarity | ${summary.exactRarityMatches} | ${pct(summary.exactRarityMatches, total)} |
| Type | ${summary.exactTypeMatches} | ${pct(summary.exactTypeMatches, total)} |
| Class (Z-Awakened and above) | ${summary.exactClassMatches} | ${pct(summary.exactClassMatches, summary.classApplicableCount)} of ${summary.classApplicableCount} applicable cards |
| Pre-Z class state | ${total - summary.classApplicableCount} unawakened | 100.00% structurally classified |
| Leader text (latest released structured state) | ${summary.leaderTextMatches} | ${pct(summary.leaderTextMatches, total)} |
| Leader percentage set (structured rows only) | ${summary.leaderPercentageMatches} | ${pct(summary.leaderPercentageMatches, total)} |
| Link set | ${summary.linkSetMatches} | ${pct(summary.linkSetMatches, total)} |
| Category set | ${summary.categorySetMatches} | ${pct(summary.categorySetMatches, total)} |

Leader percentage comparison uses \`leader_skills.efficacy_values\` only for the exact-ID-validated efficacy family; it does not parse either description. Links and categories use first-party IDs and relation tables.

Element values \`0..4\` are explicitly \`unawakened\`: the card has a type but no Super/Extreme class yet. First-party Z-Awakening routes preserve the type digit and move these cards to \`1x\` (Super) or \`2x\` (Extreme). Site hero/villain alignment on a pre-Z card is not compared as an in-game class.

## Mechanic coverage

| Mechanic | Database | Current dataset |
| --- | ---: | ---: |
| Active Skill cards | ${summary.databaseMechanics.active} | ${summary.currentMechanics.active} |
| Standby cards | ${summary.databaseMechanics.standby} | ${summary.currentMechanics.standby} |
| Finish cards | ${summary.databaseMechanics.finish} | ${summary.currentMechanics.finish} |
| Reversible exchange cards | ${summary.databaseMechanics.reversibleExchange} | ${summary.currentMechanics.reversibleExchange} |
| Confirmed form relations / nested transformations | ${summary.databaseMechanics.transformations} | ${summary.currentMechanics.transformations} |
| Unit Attack rows | ${summary.databaseMechanics.unitAttacks} | ${summary.currentMechanics.unitAttacks} |
| EX Attack cards | ${summary.databaseMechanics.exAttacks} | ${summary.currentMechanics.exAttacks} |

### Exact-ID mechanic parity

| Mechanic | Matches | Database only | Current only/different |
| --- | ---: | ---: | ---: |
${mechanicRows}

Super, Ultra, Unit, and EX variants are projected from the first-party string enum in \`card_specials.style\` (\`Normal\`, \`Hyper\`, \`Condition\`, \`Extra\`). Active, standby, finish, and attack conditions retain their localized descriptions plus structured condition/effect rows. Passive relations retain timing, target, calculation option, duration, one-time, probability, effect values, JSON causalities, and joined \`skill_causalities\` rows.

## Important concrete conflicts

| Card ID | Database name | Divergent fields | Database → current example |
| --- | --- | --- | --- |
${conflictRows || "| — | — | No exact-ID conflicts | — |"}

The detailed artifact preserves the exact values behind every row above. Transformation set differences distinguish first-party reachable intermediate states from the current display projection; \`transformationCurrentTargetCoverage\` reports whether every current target is reconstructable. Unit Attack comparison collapses only rows whose structured fields and localized strings are exactly identical, while preserving every raw row in the artifact.

## Database-only fields

- first-party card, character, card-unique-info, resource, potential-board, skill-set, skill, relation, causality, and view IDs;
- raw numeric timing, target, efficacy, calculation, duration, probability, and effect values;
- complete awakening routes and every optimal-awakening growth step;
- first-party collection membership, collection identity, terminal projection, release date, and released/future status;
- structured passive/active/standby/finish effects and causalities;
- attack style, Ki threshold, level threshold, priority, EX probability/type, and special effect rows;
- row-level table/ID/column provenance.

## Enum evidence

| Family | Confirmed raw values | Unknown raw values | Scope/evidence |
| --- | --- | --- | --- |
${enumRows}

## Still requires site, assets, or policy

- portrait/card-art extraction and presentation assets;
- obtainability, summonability/free-to-play classification, and acquisition locations;
- any display-only text absent from localized tables;
- compatibility policy for ${summary.currentIdsMissingInProjectedCatalog.length} current-only IDs and validation of ${summary.databaseProjectedPrimaryIdsMissingInCurrent.length} first-party-only primaries;
- enum labels not corroborated by exact first-party rows or exact-ID parity.

## Incremental plan

1. **DB1 — complete:** terminal collection projection, EZA/SEZA enum proof, release dates, future-state filtering, and identity goldens.
2. **DB2 — Team Analysis mechanics:** map passive/leader/attack enums family by family from structured rows, attach calculation/timing provenance, and compare generated Team Analysis states without replacing the current payload.
3. **DB3 — assets and shadow production:** extract first-party portraits/art, run repeatable shadow builds across snapshots, require manifest/hash parity and zero identity regressions, then propose a separately authorized production cutover.
`;
}
