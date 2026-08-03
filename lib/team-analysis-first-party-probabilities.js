"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFirstPartyProbability = exports.FIRST_PARTY_PROBABILITY_EVIDENCE = void 0;
const crypto_1 = require("crypto");
// This is a checked-in evidence snapshot rather than a live game-DB join. That
// keeps output deterministic for a fixed character payload and parser version.
exports.FIRST_PARTY_PROBABILITY_EVIDENCE = [
    evidence("1002210:1002210:initial", "a25d825d802e18fccc007ba60bc115b867d9f406ba0b70ee3a580d3649e0d3f8", 1, "stun_activation", 7, "198", ["198"], 9, "probability"),
    evidence("1011211:1011211:eza", "30f64923d2ddc138e4e8a15c2358aa7c66fbfc6977011c39f6c8ab3536b8a5e6", 2, "evade_activation", 15, "4108", ["3004108"], 91, "eff_value1"),
    evidence("1013341:1013341:eza", "049ac6a535d19399689a124ceefc0eb415d7d2566445aa0f2f312ada58d30321", 3, "additional_to_super", 15, "3909", ["4003909"], 81, "eff_value3"),
    evidence("1013831:1013831:eza", "e8546e5d048a8efa4a79d22dc1f84384e2dccc3fe0123690bc244011a38dc364", 3, "additional_to_super", 15, "3405", ["1003405"], 81, "eff_value3"),
    evidence("1015031:1015031:eza", "6b173c22274af6ad562e9695e6fcf8e08520b257917e21d06f429733a3eab035", 8, "additional_to_super", 15, "2837", ["4002837"], 81, "eff_value3"),
    evidence("1015841:1015841:eza", "ad65469640c296848250d5bd084f3aaa908422e64fbdc4368372323e873cba87", 6, "critical_activation", 15, "3916", ["7003916"], 90, "eff_value1"),
    evidence("1017511:1017511:initial", "26ed02868a3c04f1e1db24457e48df19b0a076ae40abcc1abffafd4fa08f9122", 2, "evade_activation", 15, "1599", ["2001599"], 91, "eff_value1"),
    evidence("1019531:1019531:eza", "5c29f38da5ba3315b3e08886d424e372f08041108880f135cfa9ed5ac7a7db98", 11, "additional_to_super", 15, "3453", ["6003453"], 81, "eff_value3"),
    evidence("1025111:4025121:initial", "eb2593df420f65233ec5f776043af03c80a0b641438063a63b2dbf8aa5b8de60", 6, "additional_to_super", 15, "2916", ["3002916"], 81, "eff_value3"),
    evidence("1028281:4028291:initial", "6e2a983efbdecbd5e574381a58365fae72f6053551e8a62443249b2a1157bae2", 10, "additional_to_super", 15, "3998", ["6003998", "7003998", "8003998", "9003998", "10003998"], 81, "eff_value3"),
];
function evidence(stateKey, passiveTextSha256, ruleLineIndex, semantic, percent, passiveSkillSetId, passiveSkillIds, efficacyType, valueField) {
    return {
        stateKey,
        passiveTextSha256,
        ruleLineIndex,
        qualitativeChanceTerm: "rare",
        semantic,
        percent,
        passiveSkillSetId,
        passiveSkillIds,
        efficacyType,
        valueField,
    };
}
function resolveFirstPartyProbability(stateKey, rawText, ruleLineIndex, qualitativeChanceTerm, semantic) {
    const passiveTextSha256 = (0, crypto_1.createHash)("sha256").update(rawText).digest("hex");
    return exports.FIRST_PARTY_PROBABILITY_EVIDENCE.find(item => item.stateKey === stateKey
        && item.passiveTextSha256 === passiveTextSha256
        && item.ruleLineIndex === ruleLineIndex
        && item.qualitativeChanceTerm === qualitativeChanceTerm
        && item.semantic === semantic);
}
exports.resolveFirstPartyProbability = resolveFirstPartyProbability;
//# sourceMappingURL=team-analysis-first-party-probabilities.js.map