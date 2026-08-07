import {
    ServerS2Coverage,
    ServerS2Dataset,
    ServerS2Family,
    ServerS2IdentitySet,
    ServerS2Observation,
    ServerS2Validation,
} from "./server-s2-contract";

function sortedIds(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0);
}

function identitySet(key: string, kind: string, ids: string[], source: string, authority: ServerS2IdentitySet["authority"]): ServerS2IdentitySet {
    return { key, kind, ids: sortedIds(ids), source, authority };
}

export function buildServerS2Dataset(observation: ServerS2Observation): ServerS2Dataset {
    const challengeById = new Map(observation.challengeRoots.map(value => [value.id, value]));
    const sbrRootIds = ["710", "720"];
    const databaseSbrRoots = sbrRootIds.filter(id => observation.areaIds.includes(id));
    const shadowSbrRoots = sbrRootIds.filter(id => challengeById.get(id)?.type === "challenge");
    const shadowStageIds = sortedIds(sbrRootIds.flatMap(id => challengeById.get(id)?.stageIds ?? []));
    const databaseStageIds = sortedIds(sbrRootIds.flatMap(id => observation.questLevelsByArea[id] ?? []));
    const matchedStages = shadowStageIds.filter(id => databaseStageIds.includes(id));
    const e7Challenge = observation.e7Families.find(value => value.family === "challenge");
    const e7SdBattle = observation.e7Families.find(value => value.family === "sdbattle");
    const hasBurstCandidates = ["genkai_gimmick_sub_categories", "score_benefits", "special_bonuses"].every(table => observation.unrootedTables.some(value => value.table === table));

    const families: ServerS2Family[] = [
        {
            key: "super_battle_road",
            productLabel: "Super Battle Road and Extreme Super Battle Road",
            semanticStatus: shadowSbrRoots.length === 2 ? "supported" : "partial",
            rootStatus: databaseSbrRoots.length === 2 ? "supported" : "partial",
            resolution: "already_database_rooted",
            identitySets: [
                identitySet("sbr_database_areas", "area", databaseSbrRoots, "events-e1-catalog.json catalog[kind=area]", "sqlite_first_party"),
                identitySet("sbr_shadow_challenge_roots", "dokkaninfo_challenge", shadowSbrRoots, "DokkanInfo cache challenge-{710,720}.json", "community_shadow"),
                identitySet("sbr_database_quest_levels", "quest_level", databaseStageIds, "events-e2-topology.json questStages[areaId=710|720].levels", "sqlite_first_party"),
                identitySet("sbr_shadow_stage_roots", "dokkaninfo_stage", shadowStageIds, "DokkanInfo cache challenge-{710,720}.json event.stages", "community_shadow"),
            ],
            joins: [
                { key: "sbr_root_id_join", leftSet: "sbr_shadow_challenge_roots", rightSet: "sbr_database_areas", joinKey: "event.id == area.id", status: databaseSbrRoots.length === 2 && shadowSbrRoots.length === 2 ? "supported" : "unjoinable", matchedCount: databaseSbrRoots.filter(id => shadowSbrRoots.includes(id)).length, unmatchedCount: shadowSbrRoots.filter(id => !databaseSbrRoots.includes(id)).length, boundary: "The community title is presentation evidence only; the equality of numeric IDs performs the join." },
                { key: "sbr_stage_id_join", leftSet: "sbr_shadow_stage_roots", rightSet: "sbr_database_quest_levels", joinKey: "event.stage.id == quest_level.id", status: matchedStages.length === shadowStageIds.length && shadowStageIds.length > 0 ? "supported" : "unjoinable", matchedCount: matchedStages.length, unmatchedCount: shadowStageIds.length - matchedStages.length, boundary: "Stage titles, ordinal levels and difficulty strings are never keys." },
            ],
            evidence: [
                { source: "events-e7-shadow-parity.json", locator: "eventFamilies[family=challenge]", observation: `All ${e7Challenge?.joinedRootCount ?? 0} cached challenge roots join SQLite areas; ${e7Challenge?.joinedStageCount ?? 0} stages join.`, status: e7Challenge?.rootClassification === "agreement" ? "supported" : "partial" },
                { source: "DokkanInfo family cache", locator: "challenge-710.json:event.id,type,name; challenge-720.json:event.id,type,name", observation: "IDs 710 and 720 are challenge-family presentation records for SBR and ESBR.", status: "supported" },
            ],
            missing: ["current_server_schedule", "current_server_availability"],
        },
        {
            key: "ultimate_clash",
            productLabel: "Virtual Dokkan Ultimate Clash",
            semanticStatus: "supported",
            rootStatus: "partial",
            resolution: "candidate_ids_without_root",
            identitySets: [identitySet("rmbattle_mission_refs", "rmbattle_id", observation.rmbattleCandidateIds, "events-e1-catalog.json opaqueRootFamilies[rmbattle]", "sqlite_first_party")],
            joins: [{ key: "rmbattle_root_join", leftSet: "rmbattle_mission_refs", rightSet: null, joinKey: null, status: "unjoinable", matchedCount: 0, unmatchedCount: observation.rmbattleCandidateIds.length, boundary: "Mission references prove candidate IDs, but no SQLite root table or collected server payload establishes root records." }],
            evidence: [
                { source: "SQLite and native static evidence", locator: "rmbattle_missions.rmbattle_id; native paths rmbattles/{id}", observation: "First-party mission strings identify the product family as Ultimate Clash; runtime path strings prove a separate server root concept.", status: "supported" },
            ],
            missing: ["root_records", "titles", "schedule", "runtime_topology", "reward_root_relation"],
        },
        {
            key: "world_tournament",
            productLabel: "World Tournament",
            semanticStatus: "supported",
            rootStatus: observation.budokaiIds.length > 0 ? "supported" : "unknown",
            resolution: "database_rooted_runtime_unknown",
            identitySets: [identitySet("budokai_database_roots", "budokai", observation.budokaiIds, "events-e1-catalog.json catalog[kind=budokai]", "sqlite_first_party")],
            joins: [{ key: "budokai_static_root", leftSet: "budokai_database_roots", rightSet: null, joinKey: null, status: "not_applicable", matchedCount: observation.budokaiIds.length, unmatchedCount: 0, boundary: "The SQLite root is authoritative for static identity; no remote schedule payload was collected in S2." }],
            evidence: [{ source: "events-e1-catalog.json", locator: "catalog[kind=budokai]", observation: `${observation.budokaiIds.length} first-party static roots are present.`, status: observation.budokaiIds.length > 0 ? "supported" : "unknown" }],
            missing: ["current_server_schedule", "current_server_availability", "server_match_topology", "ranking_reward_identity"],
        },
        {
            key: "burst_mode",
            productLabel: "Burst Mode",
            semanticStatus: hasBurstCandidates ? "partial" : "unknown",
            rootStatus: "unknown",
            resolution: "root_unknown",
            identitySets: [],
            joins: [{ key: "genkai_score_root_join", leftSet: "genkai_and_score_candidate_tables", rightSet: null, joinKey: null, status: "unjoinable", matchedCount: 0, unmatchedCount: observation.unrootedTables.filter(value => ["genkai_gimmick_sub_categories", "score_benefits", "special_bonuses"].includes(value.table)).reduce((sum, value) => sum + value.rowCount, 0), boundary: "The candidate tables expose no genkai_battle_id/FK in the contracted inputs; semantic proximity cannot create a join." }],
            evidence: [{ source: "SQLite first-party strings and schema", locator: "genkai_battle help/mission fields; score_benefits and genkai_gimmick_sub_categories columns", observation: "The product label is supported only at family level; score and gimmick rows have no proven root relation.", status: "partial" }],
            missing: ["root_ids", "root_records", "score_benefit_foreign_key", "schedule", "availability"],
        },
        {
            key: "pettan_battle",
            productLabel: "Pettan Battle / Sticker Battle",
            semanticStatus: observation.sdbattleRootIds.length > 0 && observation.sdMapIds.length > 0 ? "supported" : "partial",
            rootStatus: "partial",
            resolution: "community_roots_without_database_join",
            identitySets: [
                identitySet("pettan_shadow_series", "dokkaninfo_sdbattle_series", observation.sdbattleRootIds, "DokkanInfo cache sdbattle-{id}.json", "community_shadow"),
                identitySet("pettan_database_maps", "sd_map", observation.sdMapIds, "events-e2-topology.json sdTopologies", "sqlite_first_party"),
            ],
            joins: [{ key: "pettan_series_to_sd_map", leftSet: "pettan_shadow_series", rightSet: "pettan_database_maps", joinKey: null, status: "unjoinable", matchedCount: 0, unmatchedCount: observation.sdbattleRootIds.length, boundary: "Series IDs and sd_map IDs occupy different namespaces. Numeric overlap is not a relation and titles are forbidden as keys." }],
            evidence: [
                { source: "events-e2-topology.json", locator: "sdTopologies", observation: `${observation.sdMapIds.length} sd_map roots carry arena/stage topology.`, status: observation.sdMapIds.length > 0 ? "supported" : "unknown" },
                { source: "events-e7-shadow-parity.json", locator: "eventFamilies[family=sdbattle]", observation: `${e7SdBattle?.eventCount ?? 0} cached sdbattle series roots remain unjoinable to SQLite roots.`, status: e7SdBattle?.rootClassification === "unjoinable" ? "supported" : "partial" },
            ],
            missing: ["series_to_sd_map_relation", "current_server_schedule", "current_server_availability"],
        },
    ];

    return {
        schemaVersion: 1,
        contract: "dokkan-server-root-resolution",
        contractVersion: "0.3.0",
        generatedAt: "2026-08-07T00:00:00.000Z",
        generatedAtPolicy: "pinned_to_static_evidence_checkpoint",
        sourceSnapshotVersion: observation.sourceSnapshotVersion,
        collectionMode: "local_static_and_cached_evidence_no_network",
        identityPolicy: { structuralIdsOnly: true, titleJoinAllowed: false, overlappingNumericNamespacesJoinAutomatically: false, remotePresentationAuthority: false },
        sourceLineage: observation.sourceLineage,
        families,
        semanticCorrections: [{
            priorClaim: "The 25 DokkanInfo sdbattle roots represent Super Battle Road roots missing from SQLite.",
            correctedClaim: "DokkanInfo sdbattle and SQLite sd_* represent Pettan/Sticker Battle. SBR and ESBR are challenge-family roots 710 and 720, already rooted as SQLite areas.",
            impact: "The E7 structural result for sdbattle remains unjoinable, but its former product label is superseded. No sdbattle-to-area or sdbattle-to-SBR join is allowed.",
        }],
    };
}

export function buildServerS2Coverage(dataset: ServerS2Dataset): ServerS2Coverage {
    const joins = dataset.families.flatMap(value => value.joins);
    return {
        schemaVersion: 1,
        familyCount: dataset.families.length,
        supportedRootFamilyCount: dataset.families.filter(value => value.rootStatus === "supported").length,
        partialOrUnknownRootFamilyCount: dataset.families.filter(value => value.rootStatus !== "supported").length,
        supportedJoinCount: joins.filter(value => value.status === "supported").length,
        unjoinableJoinCount: joins.filter(value => value.status === "unjoinable").length,
        structurallyMatchedIdentityCount: joins.filter(value => value.status === "supported").reduce((sum, value) => sum + value.matchedCount, 0),
        titleJoinCount: 0,
        networkRequestCount: 0,
    };
}

export function validateServerS2Dataset(dataset: ServerS2Dataset): ServerS2Validation {
    const failures: string[] = [];
    if (dataset.contract !== "dokkan-server-root-resolution" || dataset.contractVersion !== "0.3.0") failures.push("contract identity");
    if (dataset.collectionMode !== "local_static_and_cached_evidence_no_network") failures.push("network collection enabled");
    if (!dataset.identityPolicy.structuralIdsOnly || dataset.identityPolicy.titleJoinAllowed || dataset.identityPolicy.overlappingNumericNamespacesJoinAutomatically || dataset.identityPolicy.remotePresentationAuthority) failures.push("identity policy weakened");
    if (new Set(dataset.families.map(value => value.key)).size !== dataset.families.length) failures.push("duplicate family key");
    const expectedLineage = new Map<string, ServerS2Dataset["sourceLineage"][number]["authority"]>([["events_e1", "sqlite_first_party"], ["events_e2", "sqlite_first_party"], ["events_e7", "community_shadow"], ["dokkaninfo_family_cache", "community_shadow"]]);
    const lineageKeys = dataset.sourceLineage.map(value => value.key);
    if (dataset.sourceLineage.length !== expectedLineage.size || new Set(lineageKeys).size !== expectedLineage.size || [...expectedLineage.keys()].some(key => !lineageKeys.includes(key as ServerS2Dataset["sourceLineage"][number]["key"])) || dataset.sourceLineage.some(value => expectedLineage.get(value.key) !== value.authority || !/^[a-f0-9]{64}$/.test(value.sha256) || value.sizeBytes <= 0 || !value.path.trim())) failures.push("invalid source lineage");
    for (const family of dataset.families) {
        const setKeys = new Set(family.identitySets.map(value => value.key));
        if (setKeys.size !== family.identitySets.length) failures.push(`duplicate identity set ${family.key}`);
        for (const set of family.identitySets) {
            if (new Set(set.ids).size !== set.ids.length || set.ids.some(id => !/^\d+$/.test(id))) failures.push(`non-structural identity ${set.key}`);
        }
        for (const join of family.joins) {
            if (join.leftSet !== "genkai_and_score_candidate_tables" && !setKeys.has(join.leftSet)) failures.push(`unknown left set ${join.key}`);
            if (join.rightSet !== null && !setKeys.has(join.rightSet)) failures.push(`unknown right set ${join.key}`);
            if (join.status === "supported" && (!join.joinKey || join.matchedCount === 0 || join.unmatchedCount !== 0)) failures.push(`unsupported supported join ${join.key}`);
            if (join.status === "unjoinable" && join.matchedCount !== 0) failures.push(`unjoinable join has matches ${join.key}`);
            if (join.joinKey && /title|name/i.test(join.joinKey)) failures.push(`text join ${join.key}`);
        }
    }
    const sbr = dataset.families.find(value => value.key === "super_battle_road"), pettan = dataset.families.find(value => value.key === "pettan_battle");
    if (sbr?.rootStatus !== "supported" || sbr.identitySets.find(value => value.key === "sbr_database_areas")?.ids.join(",") !== "710,720") failures.push("SBR database roots unresolved");
    const pettanJoin = pettan?.joins.find(value => value.key === "pettan_series_to_sd_map");
    if (pettanJoin?.status !== "unjoinable" || pettanJoin.joinKey !== null || pettanJoin.matchedCount !== 0) failures.push("Pettan namespace isolation lost");
    const expectedIdentityAuthorities = new Map<string, ServerS2IdentitySet["authority"]>([
        ["sbr_database_areas", "sqlite_first_party"], ["sbr_shadow_challenge_roots", "community_shadow"], ["sbr_database_quest_levels", "sqlite_first_party"], ["sbr_shadow_stage_roots", "community_shadow"],
        ["rmbattle_mission_refs", "sqlite_first_party"], ["budokai_database_roots", "sqlite_first_party"], ["pettan_shadow_series", "community_shadow"], ["pettan_database_maps", "sqlite_first_party"],
    ]);
    const identitySets = dataset.families.flatMap(value => value.identitySets);
    const sqliteAuthorityPreserved = identitySets.length === expectedIdentityAuthorities.size && identitySets.every(value => expectedIdentityAuthorities.get(value.key) === value.authority);
    if (!sqliteAuthorityPreserved) failures.push("community identity promoted to database authority");
    return { schemaVersion: 1, valid: failures.length === 0, deterministic: true, structuralIdsOnly: dataset.identityPolicy.structuralIdsOnly && !dataset.identityPolicy.titleJoinAllowed, sqliteAuthorityPreserved, numericNamespaceIsolationPreserved: pettanJoin?.status === "unjoinable" && pettanJoin.joinKey === null && pettanJoin.matchedCount === 0, failures };
}
