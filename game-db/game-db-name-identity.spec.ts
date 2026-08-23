import { deepEqual, throws } from "assert";
import { describe, it } from "mocha";
import { buildGameDbNameIdentityContract } from "./game-db-name-identity";

describe("buildGameDbNameIdentityContract", function () {
    it("joins nested type-41 causalities to official canonical identity sets", () => {
        const contract = buildGameDbNameIdentityContract({
            card_unique_infos: [
                { id: "3", name: "Goku" },
                { id: "305", name: "Goku Black" },
                { id: "1", name: "Goku" },
            ],
            card_unique_info_set_relations: [
                { id: "2", card_unique_info_set_id: "13", card_unique_info_id: "3" },
                { id: "1", card_unique_info_set_id: "13", card_unique_info_id: "1" },
            ],
            card_categories: [],
            passive_skill_set_relations: [
                { id: "10", passive_skill_set_id: "900", passive_skill_id: "100" },
            ],
            passive_skills: [{
                id: "100",
                causality_conditions: '{"compiled":["&",1,["|",41,42]]}',
            }],
            skill_causalities: [
                { id: "1", causality_type: "5" },
                { id: "41", causality_type: "41", cau_val1: "0", cau_val2: "13", cau_val3: "1" },
                { id: "42", causality_type: "41", cau_val1: "2", cau_val2: "13", cau_val3: "2" },
            ],
        });

        deepEqual(contract, {
            source: "first_party_game_db",
            bindings: [
                {
                    passiveSkillSetId: "900",
                    scope: "rotation",
                    count: 2,
                    identitySetId: "13",
                    canonicalIds: ["1", "3"],
                    canonicalNames: ["Goku"],
                },
                {
                    passiveSkillSetId: "900",
                    scope: "team",
                    count: 1,
                    identitySetId: "13",
                    canonicalIds: ["1", "3"],
                    canonicalNames: ["Goku"],
                },
            ],
        });
    });

    it("fails closed when a referenced identity set is absent", () => {
        throws(() => buildGameDbNameIdentityContract({
            card_unique_infos: [{ id: "3", name: "Goku" }],
            card_unique_info_set_relations: [],
            card_categories: [],
            passive_skill_set_relations: [
                { id: "10", passive_skill_set_id: "900", passive_skill_id: "100" },
            ],
            passive_skills: [{ id: "100", causality_conditions: '{"compiled":41}' }],
            skill_causalities: [
                { id: "41", causality_type: "41", cau_val1: "0", cau_val2: "13", cau_val3: "1" },
            ],
        }), /missing identity set 13/);
    });

    it("does not promote malformed compiled conditions", () => {
        deepEqual(buildGameDbNameIdentityContract({
            card_unique_infos: [{ id: "3", name: "Goku" }],
            card_unique_info_set_relations: [
                { id: "1", card_unique_info_set_id: "13", card_unique_info_id: "3" },
            ],
            card_categories: [],
            passive_skill_set_relations: [
                { id: "10", passive_skill_set_id: "900", passive_skill_id: "100" },
            ],
            passive_skills: [{ id: "100", causality_conditions: '{"compiled":["?",41]}' }],
            skill_causalities: [
                { id: "41", causality_type: "41", cau_val1: "0", cau_val2: "13", cau_val3: "1" },
            ],
        }).bindings, []);
    });

    it("maps type-45 same-member category and name contracts", () => {
        const contract = buildGameDbNameIdentityContract({
            card_unique_infos: [{ id: "113", name: "Trunks (Future)" }],
            card_unique_info_set_relations: [
                { id: "1", card_unique_info_set_id: "12", card_unique_info_id: "113" },
            ],
            card_categories: [{ id: "19", name: "Future Saga" }],
            passive_skill_set_relations: [
                { id: "10", passive_skill_set_id: "2683", passive_skill_id: "4002683" },
            ],
            passive_skills: [{ id: "4002683", causality_conditions: '{"compiled":1221}' }],
            skill_causalities: [
                { id: "1221", causality_type: "45", cau_val1: "2", cau_val2: "19", cau_val3: "12" },
            ],
        });

        deepEqual(contract.bindings, [{
            passiveSkillSetId: "2683",
            scope: "rotation",
            count: 1,
            identitySetId: "12",
            canonicalIds: ["113"],
            canonicalNames: ["Trunks (Future)"],
            categories: ["Future Saga"],
        }]);
    });
});
