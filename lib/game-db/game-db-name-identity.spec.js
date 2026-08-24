"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_name_identity_1 = require("./game-db-name-identity");
(0, mocha_1.describe)("buildGameDbCardIdentityContract", function () {
    (0, mocha_1.it)("indexes official card identity independently from the community catalog", () => {
        const contract = (0, game_db_name_identity_1.buildGameDbCardIdentityContract)({
            cards: [
                { id: "1034411", character_id: "1510", card_unique_info_id: "910" },
                { id: "1032391", character_id: "1485", card_unique_info_id: "873" },
            ],
        });
        (0, assert_1.deepEqual)(contract.get("1034411"), {
            canonicalId: "910",
            gameCharacterId: "1510",
        });
        (0, assert_1.deepEqual)(contract.get("1032391"), {
            canonicalId: "873",
            gameCharacterId: "1485",
        });
    });
    (0, mocha_1.it)("fails closed for incomplete official card identity", () => {
        (0, assert_1.throws)(() => (0, game_db_name_identity_1.buildGameDbCardIdentityContract)({
            cards: [{ id: "1034411", character_id: "1510" }],
        }), /canonical ID/);
    });
});
(0, mocha_1.describe)("buildGameDbNameIdentityContract", function () {
    (0, mocha_1.it)("joins nested type-41 causalities to official canonical identity sets", () => {
        const contract = (0, game_db_name_identity_1.buildGameDbNameIdentityContract)({
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
        (0, assert_1.deepEqual)(contract, {
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
    (0, mocha_1.it)("fails closed when a referenced identity set is absent", () => {
        (0, assert_1.throws)(() => (0, game_db_name_identity_1.buildGameDbNameIdentityContract)({
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
    (0, mocha_1.it)("does not promote malformed compiled conditions", () => {
        (0, assert_1.deepEqual)((0, game_db_name_identity_1.buildGameDbNameIdentityContract)({
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
    (0, mocha_1.it)("maps type-45 same-member category and name contracts", () => {
        const contract = (0, game_db_name_identity_1.buildGameDbNameIdentityContract)({
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
        (0, assert_1.deepEqual)(contract.bindings, [{
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
//# sourceMappingURL=game-db-name-identity.spec.js.map