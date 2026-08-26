import { deepEqual, equal, ok } from "assert";
import { describe, it } from "mocha";
import { Character, Classes, Rarities, Transformation, Types } from "../character";
import {
    buildTeamAnalysisDataset,
    buildTransformationActivationContractKey,
    validateTeamAnalysisDataset,
} from "../team-analysis";
import { GameDbRow } from "./game-db-source";
import { buildGameDbTransformationActivationContract } from "./game-db-transformation-activation";

function fixtureTables(): Record<string, GameDbRow[]> {
    return {
        cards: [
            {
                id: "100",
                rarity: "4",
                passive_skill_set_id: "10",
                optimal_awakening_grow_type: "900",
            },
            { id: "400", rarity: "4", passive_skill_set_id: "60" },
        ],
        optimal_awakening_growths: [
            { id: "907", optimal_awakening_grow_type: "900", step: "7", passive_skill_set_id: "20" },
            { id: "908", optimal_awakening_grow_type: "900", step: "8", passive_skill_set_id: "" },
        ],
        passive_skill_sets: [{ id: "10" }, { id: "20" }, { id: "60" }],
        passive_skill_set_relations: [
            { id: "1000", passive_skill_set_id: "10", passive_skill_id: "110" },
            { id: "1001", passive_skill_set_id: "10", passive_skill_id: "111" },
            { id: "2000", passive_skill_set_id: "20", passive_skill_id: "210" },
            { id: "2001", passive_skill_set_id: "20", passive_skill_id: "211" },
            { id: "6000", passive_skill_set_id: "60", passive_skill_id: "610" },
        ],
        passive_skills: [
            {
                id: "110",
                efficacy_type: "103",
                eff_value1: "400",
                causality_conditions: '{"compiled":1}',
            },
            { id: "111", efficacy_type: "79", eff_value1: "401", causality_conditions: "" },
            {
                id: "210",
                efficacy_type: "103",
                eff_value1: "400",
                causality_conditions: '{"compiled":2}',
            },
            {
                id: "211",
                efficacy_type: "131",
                eff_value1: "405",
                causality_conditions: '{"compiled":99}',
            },
            {
                id: "610",
                efficacy_type: "103",
                eff_value1: "409",
                causality_conditions: '{"compiled":3}',
            },
        ],
        skill_causalities: [
            { id: "1", causality_type: "5", cau_val1: "2", cau_val2: "0", cau_val3: "0" },
            { id: "2", causality_type: "1", cau_val1: "50", cau_val2: "0", cau_val3: "0" },
            { id: "3", causality_type: "16", cau_val1: "2", cau_val2: "0", cau_val3: "0" },
            { id: "4", causality_type: "5", cau_val1: "4", cau_val2: "0", cau_val3: "0" },
            { id: "5", causality_type: "47", cau_val1: "0", cau_val2: "0", cau_val3: "0" },
            { id: "99", causality_type: "999", cau_val1: "1", cau_val2: "2", cau_val3: "3" },
        ],
        card_categories: [],
        card_active_skills: [{ id: "3000", card_id: "100", active_skill_set_id: "30" }],
        active_skill_sets: [{ id: "30", causality_conditions: '{"compiled":3}' }],
        active_skills: [
            { id: "310", active_skill_set_id: "30", efficacy_type: "103", eff_val1: "402" },
            { id: "311", active_skill_set_id: "30", efficacy_type: "79", eff_val1: "406" },
        ],
        card_standby_skill_set_relations: [{ id: "4000", card_id: "100", standby_skill_set_id: "40" }],
        standby_skill_sets: [{ id: "40", causality_conditions: '{"compiled":4}' }],
        standby_skills: [{
            id: "410",
            standby_skill_set_id: "40",
            efficacy_type: "103",
            efficacy_values: "[403]",
        }],
        card_finish_skill_set_relations: [{ id: "5000", card_id: "100", finish_skill_set_id: "50" }],
        standby_skill_set_finish_skill_set_relations: [
            { id: "4500", standby_skill_set_id: "40", finish_skill_set_id: "51" },
        ],
        finish_skill_sets: [
            { id: "50", causality_conditions: '{"compiled":5}' },
            { id: "51", causality_conditions: '{"compiled":3}' },
        ],
        finish_skills: [
            {
                id: "510",
                finish_skill_set_id: "50",
                efficacy_type: "103",
                efficacy_values: "[404]",
            },
            {
                id: "511",
                finish_skill_set_id: "51",
                efficacy_type: "103",
                efficacy_values: "[407]",
            },
        ],
    };
}

function transformation(id: string): Transformation {
    return {
        id,
        baseCharacterId: "100",
        name: `Form ${id}`,
        characterClass: Classes.Super,
        type: Types.TEQ,
        superAttack: "",
        passive: "",
        domain: "",
        links: [],
        portraitURL: "",
        portraitFilename: "",
        artURL: "",
        artFilename: "",
        finishingMove: [],
    };
}

function character(): Character {
    return {
        id: "100",
        name: "Base",
        title: "Fixture",
        maxLevel: 120,
        maxSALevel: 10,
        rarity: Rarities.UR,
        characterClass: Classes.Super,
        type: Types.TEQ,
        cost: 1,
        portraitURL: "",
        portraitFilename: "",
        leaderSkill: "",
        superAttack: "",
        passive: "",
        transformationCondition: "",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "",
        baseHP: 0,
        maxLevelHP: 0,
        freeDupeHP: 0,
        rainbowHP: 0,
        baseAttack: 0,
        maxLevelAttack: 0,
        freeDupeAttack: 0,
        rainbowAttack: 0,
        baseDefence: 0,
        maxDefence: 0,
        freeDupeDefence: 0,
        rainbowDefence: 0,
        kiMultiplier: "",
        standbySkill: "",
        transformations: ["400", "401", "402", "403", "404", "405", "406", "407", "409"].map(transformation),
    };
}

describe("buildGameDbTransformationActivationContract", () => {
    it("preserves passive alternatives with exact initial/EZA/SEZA bindings", () => {
        const contract = buildGameDbTransformationActivationContract(fixtureTables());
        const condition = contract.get(buildTransformationActivationContractKey("100", "400"));
        ok(condition);
        equal(condition.status, "supported");
        equal(condition.paths.length, 2);
        deepEqual(
            condition.paths.map(path => path.sourceReleaseStates.join(",")).sort(),
            ["eza,seza", "initial"],
        );
        deepEqual(condition.paths.map(path => path.stateBindingStatus), ["supported", "supported"]);
        deepEqual(condition.paths.map(path => path.condition.expression.op), ["predicate", "predicate"]);
    });

    it("treats an empty passive condition as always and an unproved predicate as unknown", () => {
        const contract = buildGameDbTransformationActivationContract(fixtureTables());
        deepEqual(
            contract.get(buildTransformationActivationContractKey("100", "401"))?.paths[0].condition,
            { status: "supported", expression: { op: "always" } },
        );
        const unknown = contract.get(buildTransformationActivationContractKey("100", "405"));
        equal(unknown?.status, "unknown");
        const expression = unknown?.paths[0].condition.expression;
        equal(expression?.op, "predicate");
        if (expression?.op !== "predicate") throw new Error("expected an unknown predicate");
        equal(expression.predicate.kind, "unknown");
        equal(expression.predicate.provenance.rowId, "99");
    });

    it("keeps Active, giant, Standby and Finish paths partial instead of making them universal", () => {
        const contract = buildGameDbTransformationActivationContract(fixtureTables());
        const expected = [
            ["402", "active_skill_transformation"],
            ["406", "active_skill_giant_rage"],
            ["403", "standby_transformation"],
            ["404", "finish_transformation"],
        ] as const;
        for (const [target, channel] of expected) {
            const condition = contract.get(buildTransformationActivationContractKey("100", target));
            equal(condition?.status, "partial");
            equal(condition?.paths[0].channel, channel);
            equal(condition?.paths[0].stateBindingStatus, "partial");
            deepEqual(condition?.paths[0].sourceReleaseStates, ["initial", "eza", "seza"]);
        }
        const linkedFinish = contract.get(buildTransformationActivationContractKey("100", "407"));
        equal(linkedFinish?.status, "partial");
        equal(linkedFinish?.paths[0].condition.expression.op, "all");
        ok(linkedFinish?.paths[0].provenance.some(reference =>
            reference.table === "standby_skill_set_finish_skill_set_relations" && reference.rowId === "4500"));
    });

    it("builds deterministic acyclic chains back to the base card", () => {
        const contract = buildGameDbTransformationActivationContract(fixtureTables());
        const chained = contract.get(buildTransformationActivationContractKey("100", "409"));
        equal(chained?.status, "partial");
        equal(chained?.paths.length, 2);
        deepEqual(chained?.paths.map(path => path.channel), ["transformation_chain", "transformation_chain"]);
        ok(chained?.paths.every(path =>
            path.stateBindingStatus === "partial" && path.condition.expression.op === "all"));
        ok(chained?.paths.every(path => path.provenance.some(reference =>
            reference.table === "passive_skills" && reference.rowId === "610")));
        equal(
            contract.get(buildTransformationActivationContractKey("409", "100")),
            undefined,
        );
    });

    it("attaches the contract only to its transformed form and validates it fail-closed", () => {
        const source = character();
        const contract = buildGameDbTransformationActivationContract(fixtureTables());
        const options = {
            generatedAt: "2026-08-25T00:00:00.000Z",
            sourceCharacterDatasetVersion: "fixture",
            sourceCharacterPayloadSha256: "0".repeat(64),
            transformationActivationContract: contract,
        };
        const dataset = buildTeamAnalysisDataset([source], [], options);
        equal(dataset.states.find(state => state.formId === "100")?.transformationActivationCondition, undefined);
        ok(dataset.states.find(state => state.formId === "400")?.transformationActivationCondition);
        equal(
            buildTeamAnalysisDataset([source], [], {
                ...options,
                transformationActivationContract: undefined,
            }).states.some(state => state.transformationActivationCondition !== undefined),
            false,
        );

        const transformed = dataset.states.find(state => state.formId === "400");
        if (!transformed?.transformationActivationCondition) throw new Error("missing transformed state contract");
        transformed.transformationActivationCondition = {
            ...transformed.transformationActivationCondition,
            status: "unknown",
        };
        ok(validateTeamAnalysisDataset(dataset, [source], [], {
            transformationActivationContract: contract,
        }).some(issue => issue.code === "transformation-activation-condition-source"));
    });
});
