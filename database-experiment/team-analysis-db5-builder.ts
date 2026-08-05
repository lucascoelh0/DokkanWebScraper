import { SqliteScalar } from "./contract";
import { Db3Status } from "./team-analysis-db3-contract";
import { DatabaseTeamAnalysisDb4Dataset, Db4ThresholdSeriesProjection } from "./team-analysis-db4-contract";
import {
    DatabaseTeamAnalysisDb5Coverage,
    DatabaseTeamAnalysisDb5Dataset,
    Db5CountedScalingProjection,
    Db5CountedSubject,
} from "./team-analysis-db5-contract";

function integer(value: SqliteScalar): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function identifier(value: SqliteScalar): string | undefined {
    return value === null || value === "" ? undefined : String(value);
}

function decodeClassTypeMask(rawMask: SqliteScalar, scope: "team" | "rotation" | "enemy" | "unknown"): Extract<Db5CountedSubject, { kind: "class_type_mask" }> {
    const mask = integer(rawMask);
    if (mask === null) return { kind: "class_type_mask", scope, rawMask, classes: [], types: [], unknownMask: null, status: "unknown", evidence: "unknown" };
    const classes: Array<"Super" | "Extreme"> = [];
    const types: Array<"INT" | "STR" | "PHY"> = [];
    if ((mask & 4) !== 0) types.push("INT");
    if ((mask & 8) !== 0) types.push("STR");
    if ((mask & 16) !== 0) types.push("PHY");
    if ((mask & 32) !== 0) classes.push("Super");
    if ((mask & 64) !== 0) classes.push("Extreme");
    const knownMask = 4 | 8 | 16 | 32 | 64;
    const unknownMask = mask & ~knownMask;
    const hasKnownBits = classes.length > 0 || types.length > 0;
    const status: Db3Status = unknownMask === 0 && hasKnownBits && scope !== "unknown" ? "supported" : hasKnownBits ? "partial" : "unknown";
    return { kind: "class_type_mask", scope, rawMask, classes, types, unknownMask, status, evidence: hasKnownBits ? "audited-first-party-bitfield" : "unknown" };
}

function normalizedSubject(projection: Db4ThresholdSeriesProjection): Db5CountedSubject {
    const scaling = projection.effect.scaling;
    if (scaling.kind === "per_ki_sphere_threshold_series") {
        return { kind: "ki_sphere", kiSphereTypes: scaling.kiSphereTypes ?? [], status: "supported", evidence: "first-party-row-join" };
    }
    const unit = scaling.qualifyingUnit;
    const scope = unit?.scope ?? "unknown";
    if (projection.source.causalityType === 34) return {
        kind: "category",
        scope,
        categoryId: unit?.selectorId,
        categoryName: unit?.selectorName,
        rawSelector: projection.source.rawSelector,
        status: projection.status,
        evidence: projection.status === "supported" ? "first-party-row-join" : "unknown",
    };
    if (projection.source.causalityType === 41) return {
        kind: "name_match_token",
        scope,
        token: projection.source.rawSelector,
        localizedName: null,
        matchSemantics: "name_includes",
        status: "partial",
        evidence: "audited-first-party-semantics",
    };
    return decodeClassTypeMask(projection.source.rawSelector, scope);
}

export function normalizeDb4ThresholdSeriesProjection(projection: Db4ThresholdSeriesProjection): Db5CountedScalingProjection {
    const subject = normalizedSubject(projection);
    const thresholds = projection.effect.scaling.thresholdValues.slice();
    const numericValue = projection.effect.value;
    const observedMaximumContribution = typeof numericValue === "number" ? numericValue * thresholds.length : undefined;
    const { scaling: _db4Scaling, ...effect } = projection.effect;
    const unknowns = projection.unknowns.filter(value => value !== "class_type_mask_unknown" && value !== "name_selector_domain_unknown");
    if (subject.kind === "name_match_token") unknowns.push("name_token_dictionary_unavailable");
    if (subject.kind === "class_type_mask" && subject.unknownMask) unknowns.push("class_type_mask_contains_unmapped_bits");
    if (subject.kind === "class_type_mask" && subject.status === "unknown") unknowns.push("class_type_mask_unknown");
    const status: Db3Status = subject.status === "supported" && projection.status !== "unknown" ? "supported"
        : subject.status === "unknown" && projection.status === "unknown" ? "unknown" : "partial";
    return {
        ...projection,
        sourceDb4ProjectionKey: projection.projectionKey,
        status,
        effect: {
            ...effect,
            scaling: {
                kind: "per_counted_subject",
                contributionPerSubject: 1,
                subject,
                observedThresholdValues: thresholds,
                observedSeriesLength: thresholds.length,
                ...(observedMaximumContribution === undefined ? {} : { observedMaximumContribution }),
                semanticCap: { status: "unknown", value: null, reason: "series_boundary_is_not_a_proven_semantic_cap" },
            },
        },
        unknowns: [...new Set(unknowns)],
    };
}

export function buildDatabaseTeamAnalysisDb5Dataset(db4: DatabaseTeamAnalysisDb4Dataset): DatabaseTeamAnalysisDb5Dataset {
    return {
        schemaVersion: 1,
        contract: "dokkan-team-analysis-database-experiment",
        contractVersion: "0.4.0",
        generatedAt: db4.generatedAt,
        sourceDb4ContractVersion: "0.3.0",
        sourceSnapshotVersion: db4.sourceSnapshotVersion,
        sourceSha256: db4.sourceSha256,
        states: db4.states.map(state => {
            if (!state.passive) {
                const { passive: _passive, ...withoutPassive } = state;
                return withoutPassive;
            }
            return { ...state, passive: {
                ...state.passive,
                countedScaling: state.passive.thresholdSeries.map(normalizeDb4ThresholdSeriesProjection),
            } };
        }),
    };
}

export function buildDatabaseTeamAnalysisDb5Coverage(dataset: DatabaseTeamAnalysisDb5Dataset): DatabaseTeamAnalysisDb5Coverage {
    const projections = dataset.states.flatMap(state => state.passive?.countedScaling ?? []);
    const statusCounts = (values: Db3Status[]): Record<Db3Status, number> => ({
        supported: values.filter(value => value === "supported").length,
        partial: values.filter(value => value === "partial").length,
        unknown: values.filter(value => value === "unknown").length,
    });
    const selectorKindCounts: Record<string, number> = {};
    const observedSeriesLengthCounts: Record<string, number> = {};
    let fullyDecoded = 0; let partiallyDecoded = 0; let unknown = 0;
    for (const projection of projections) {
        const subject = projection.effect.scaling.subject;
        selectorKindCounts[subject.kind] = (selectorKindCounts[subject.kind] ?? 0) + 1;
        const length = String(projection.effect.scaling.observedSeriesLength);
        observedSeriesLengthCounts[length] = (observedSeriesLengthCounts[length] ?? 0) + 1;
        if (subject.kind === "class_type_mask") {
            if (subject.status === "supported") fullyDecoded += 1;
            else if (subject.status === "partial") partiallyDecoded += 1;
            else unknown += 1;
        }
    }
    return {
        schemaVersion: 1,
        stateCount: dataset.states.length,
        projectionCount: projections.length,
        projectionStatusCounts: statusCounts(projections.map(value => value.status)),
        selectorKindCounts: Object.fromEntries(Object.entries(selectorKindCounts).sort(([left], [right]) => left.localeCompare(right))),
        selectorStatusCounts: statusCounts(projections.map(value => value.effect.scaling.subject.status)),
        classTypeMaskCounts: { fullyDecoded, partiallyDecoded, unknown },
        observedSeriesLengthCounts: Object.fromEntries(Object.entries(observedSeriesLengthCounts).sort(([left], [right]) => Number(left) - Number(right))),
        projectionsWithObservedMaximumContribution: projections.filter(value => value.effect.scaling.observedMaximumContribution !== undefined).length,
        projectionsWithProvenSemanticCap: 0,
    };
}
