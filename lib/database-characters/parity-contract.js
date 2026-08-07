"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_PARITY_UPSTREAM_PROFILE = exports.CHARACTER_PARITY_AUDIT_ISSUES = void 0;
exports.CHARACTER_PARITY_AUDIT_ISSUES = [
    "z_awakened_duplicates",
    "original_rarity",
    "portraits_incomplete_or_incorrect",
    "leader_or_vs_sum",
    "flat_boost_vs_percent",
    "name_tag_transformation_linking",
    "standby_finish_transformation_chains",
    "ex_attacks",
    "entrance_animation_grouping",
    "eza_seza_base_selection",
    "ids_forms_without_join",
    "auxiliary_states",
];
exports.CHARACTER_PARITY_UPSTREAM_PROFILE = {
    k1: {
        artifactSha256: "babe3061921a886271bceeb189bdc2f519e9dcf75104c9c759d8213300c6439e",
        artifactSizeBytes: 329730,
        coverageSha256: "80dd0f0fab406864bc702b12409f0d7fef177e2f76cfbe2aeb2b373c1fee9789",
        stateCount: 10654,
        zAwakenTransitionCount: 1487,
        formTransitionCount: 558,
    },
    k2: {
        artifactSha256: "af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37",
        artifactSizeBytes: 511837,
        coverageSha256: "f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9",
        cardCount: 5759,
    },
    k3: {
        artifactSha256: "6a9c18ae74e5e5e052615d75abbfa900337ea9eebfe0262d0943213f6afd03e0",
        artifactSizeBytes: 2707309,
        coverageSha256: "36f79c5266dc05e48663bd6f756e561c16e680867a24754d5de2641dccb5f019",
        exAttackCount: 20,
    },
    k6: {
        artifactSha256: "743b9128ba3b708a4ead6b436c7f6aa71f6885f29f7336fb91972bf7e09089a1",
        artifactSizeBytes: 901984,
        coverageSha256: "8a3de274c1969dd1530257060be81e6a30d1515df3775ee9ba376d88d80f1892",
        firstPartyResourceIdCount: 75,
        missingCardResourceCount: 5684,
    },
};
//# sourceMappingURL=parity-contract.js.map