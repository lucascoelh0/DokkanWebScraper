import { Rarities, Types } from "../character";
import { CharacterFieldProjection, CharacterShadowProjection } from "./shadow-contract";
import {
    CHARACTER_COMPACT_CONTRACT_VERSION,
    CHARACTER_COMPACT_EXPECTATIONS,
    CHARACTER_COMPACT_POLICY_ID,
    CHARACTER_COMPACT_POLICY_VERSION,
    CharacterCompactCoverage,
    CharacterCompactProjection,
    CharacterCompactRecord,
    CharacterCompactSourceLineage,
} from "./compact-contract";

type CompactField = "id" | "rarity" | "type";
type Exclusion = keyof CharacterCompactCoverage["exclusions"];

interface CardAccumulator {
    binding?: string;
    ambiguousBinding: boolean;
    fields: Partial<Record<CompactField, CharacterFieldProjection>>;
}

const compactFields = new Set<CompactField>(["id", "rarity", "type"]);
const rarities = new Set<string>(Object.values(Rarities));
const types = new Set<string>(Object.values(Types));
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);

export class CharacterCompactProjectionBuilder {
    private readonly cards = new Map<string, CardAccumulator>();

    constructor(
        private readonly source: CharacterCompactSourceLineage,
        private readonly generatedAt: string,
        private readonly datasetVersion: string,
    ) {}

    accept(item: CharacterFieldProjection): void {
        if (!item || !compactFields.has(item.field as CompactField)) return;
        const field = item.field as CompactField;
        const card = this.cards.get(item.cardId) ?? { ambiguousBinding: false, fields: {} };
        if (card.fields[field]) throw new Error(`duplicate K11 compact source field ${item.cardId}:${field}`);
        if (!item.stateId) card.ambiguousBinding = true;
        else if (card.binding !== undefined && card.binding !== item.stateId) card.ambiguousBinding = true;
        else card.binding = item.stateId;
        card.fields[field] = item;
        this.cards.set(item.cardId, card);
    }

    finish(enforcePinnedSnapshot = false): { projection: CharacterCompactProjection; coverage: CharacterCompactCoverage } {
        const records: CharacterCompactRecord[] = [];
        const exclusions: CharacterCompactCoverage["exclusions"] = {
            unjoinable: 0, partial: 0, unknown: 0, mismatch: 0, conflict: 0,
            invalidEnum: 0, ambiguousBinding: 0, incomplete: 0,
        };
        const comparisons: CharacterCompactCoverage["comparisons"] = {
            id: { agreements: 0, representationGains: 0 },
            rarity: { agreements: 0, representationGains: 0 },
            type: { agreements: 0, representationGains: 0 },
        };

        for (const [cardId, card] of [...this.cards].sort(([left], [right]) => numeric(left, right))) {
            const exclusion = classifyExclusion(card);
            if (exclusion) {
                exclusions[exclusion]++;
                continue;
            }
            const id = card.fields.id!;
            const rarity = card.fields.rarity!;
            const type = card.fields.type!;
            if (String(id.databaseValue) !== cardId) throw new Error(`K11 id binding changed for ${cardId}`);
            records.push({ cardId, stateId: card.binding!, rarity: rarity.databaseValue as Rarities, type: type.databaseValue as Types });
            for (const [field, item] of [["id", id], ["rarity", rarity], ["type", type]] as const) {
                if (item.comparison === "agreement") comparisons[field].agreements++;
                else comparisons[field].representationGains++;
            }
        }

        const coverage: CharacterCompactCoverage = {
            schemaVersion: 1,
            contract: "dokkan-database-character-compact-shadow-coverage",
            contractVersion: CHARACTER_COMPACT_CONTRACT_VERSION,
            databaseCardCount: this.cards.size,
            recordCount: records.length,
            excludedCardCount: this.cards.size - records.length,
            exclusions,
            comparisons,
            catalogImpact: { charactersCreated: 0, charactersRemoved: 0, productionModified: false },
        };
        if (enforcePinnedSnapshot) assertPinnedCoverage(coverage);

        return {
            projection: {
                schemaVersion: 1,
                contract: "dokkan-database-character-compact-shadow",
                contractVersion: CHARACTER_COMPACT_CONTRACT_VERSION,
                generatedAt: this.generatedAt,
                datasetVersion: this.datasetVersion,
                source: this.source,
                policy: {
                    id: CHARACTER_COMPACT_POLICY_ID,
                    version: CHARACTER_COMPACT_POLICY_VERSION,
                    approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
                    records: "supported_only",
                    fields: ["id", "rarity", "type"],
                    allowedComparisons: ["agreement", "representation_gain"],
                    structuralJoinOnly: true,
                    externalFallbackIncluded: false,
                    auditFieldsIncluded: false,
                    productionModified: false,
                    consumerImplemented: false,
                    publisherEnabled: false,
                    androidEnabled: false,
                },
                records,
            },
            coverage,
        };
    }
}

function classifyExclusion(card: CardAccumulator): Exclusion | null {
    if (card.ambiguousBinding || !card.binding) return "ambiguousBinding";
    const values = [card.fields.id, card.fields.rarity, card.fields.type];
    if (values.some(item => !item)) return "incomplete";
    const fields = values as CharacterFieldProjection[];
    if (fields.some(item => item.productionJoin?.status !== "joined" || item.comparison === "unjoinable")) return "unjoinable";
    if (fields.some(item => item.evidenceStatus === "partial")) return "partial";
    if (fields.some(item => item.evidenceStatus !== "supported" || item.comparison === "unknown")) return "unknown";
    if (fields.some(item => item.comparison === "confirmed_conflict" || item.sourceComparisons?.production === "confirmed_conflict")) return "conflict";
    if (fields.some(item => !["agreement", "representation_gain"].includes(item.comparison))) return "mismatch";
    if (fields.some(item => item.authority !== "database_candidate" || item.characterField !== item.field)) return "mismatch";
    if (!rarities.has(String(card.fields.rarity!.databaseValue)) || !types.has(String(card.fields.type!.databaseValue))) return "invalidEnum";
    return null;
}

function assertPinnedCoverage(coverage: CharacterCompactCoverage): void {
    const expected = CHARACTER_COMPACT_EXPECTATIONS;
    const failures: string[] = [];
    if (coverage.databaseCardCount !== expected.databaseCardCount) failures.push(`database cards ${coverage.databaseCardCount} != ${expected.databaseCardCount}`);
    if (coverage.recordCount !== expected.recordCount) failures.push(`records ${coverage.recordCount} != ${expected.recordCount}`);
    if (coverage.exclusions.unjoinable !== expected.productionUnjoinableCount) failures.push(`unjoinables ${coverage.exclusions.unjoinable} != ${expected.productionUnjoinableCount}`);
    if (Object.entries(coverage.exclusions).some(([key, value]) => key !== "unjoinable" && value !== 0)) failures.push(`unexpected exclusions ${JSON.stringify(coverage.exclusions)}`);
    if (coverage.comparisons.id.agreements !== expected.idAgreements || coverage.comparisons.id.representationGains !== 0) failures.push(`id comparison inventory ${JSON.stringify(coverage.comparisons.id)}`);
    if (coverage.comparisons.rarity.agreements !== expected.rarityAgreements || coverage.comparisons.rarity.representationGains !== expected.rarityRepresentationGains) failures.push(`rarity comparison inventory ${JSON.stringify(coverage.comparisons.rarity)}`);
    if (coverage.comparisons.type.agreements !== expected.typeAgreements || coverage.comparisons.type.representationGains !== 0) failures.push(`type comparison inventory ${JSON.stringify(coverage.comparisons.type)}`);
    if (failures.length) throw new Error(`K15 pinned snapshot expectations changed: ${failures.join("; ")}`);
}

export function buildCharacterCompactProjection(
    projection: Pick<CharacterShadowProjection, "fields">,
    source: CharacterCompactSourceLineage,
    generatedAt: string,
    datasetVersion: string,
    enforcePinnedSnapshot = false,
): { projection: CharacterCompactProjection; coverage: CharacterCompactCoverage } {
    const builder = new CharacterCompactProjectionBuilder(source, generatedAt, datasetVersion);
    projection.fields.forEach(item => builder.accept(item));
    return builder.finish(enforcePinnedSnapshot);
}
