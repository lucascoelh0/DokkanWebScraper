export type CharacterSidecarGate = "k0" | "k1" | "k2" | "k3" | "k4" | "k5" | "k6" | "k7";

export interface PinnedFileIdentity {
    fileName: string;
    sha256: string;
    sizeBytes: number;
}

export interface CharacterSidecarProfile {
    gate: CharacterSidecarGate;
    contractVersion: string;
    artifact: PinnedFileIdentity & { uncompressedSizeBytes: number };
    manifest: PinnedFileIdentity;
    coverage: PinnedFileIdentity;
    validation: PinnedFileIdentity;
    consumerScopes: string[];
    auditScopes: string[];
}

export const CHARACTER_REFRESH_PROFILE = {
    profileId: "global-6.4.0-v338-2026-08-05-character-sidecars-v1",
    snapshotVersion: "global-6.4.0-v338-2026-08-05",
    generatedAt: "2026-08-05T00:00:00.000Z",
    sqlite: { sha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265", sizeBytes: 95_428_608 },
    db1: { sha256: "0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547", sizeBytes: 11_217_031, uncompressedSizeBytes: 233_969_863, cardCount: 5_759 },
    elf: { sha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a", sizeBytes: 95_662_296, format: "ELF64-LE-AArch64" },
    semanticFiles: [
        { fileName: "team-analysis-database-first-sidecar-c1.json.gz", sha256: "973650e1a61de30f6262d19b8d437ef1caa0583a07119365d506865c3cb29cc4", sizeBytes: 175_107 },
        { fileName: "team-analysis-database-first-sidecar-c1-manifest.json", sha256: "a127854834ad2af8a0552853a78ba81c0284978d14e4a788cecbc4988026fa21", sizeBytes: 1_152 },
        { fileName: "team-analysis-database-first-sidecar-c1-coverage.json", sha256: "7adc305248b3a68cddf6fe646a3f6cc48f43c2be2b77b412a8d7e4795b312716", sizeBytes: 1_150 },
        { fileName: "team-analysis-database-first-sidecar-c1-validation.json", sha256: "8a8593029da8c9d93b45225d63df2e925990761838261718be3765500ec3acb3", sizeBytes: 156 },
        { fileName: "team-analysis-database-first-supported-c2.json.gz", sha256: "e2d1ab66d1bbcd122b208c8a42d41525986ceb5f3fd665ea7f6698e3ec1c9bfb", sizeBytes: 50_280 },
        { fileName: "team-analysis-database-first-supported-c2-manifest.json", sha256: "7a1bb2168cd27e68a63ce2e6cefaf537500293210dff31392f2b002189548208", sizeBytes: 687 },
        { fileName: "team-analysis-database-first-supported-c2-coverage.json", sha256: "9a13249a2ac8d359b60b4797bb313861bc03d5252dbe7c0eabea5cbbd98738c7", sizeBytes: 516 },
        { fileName: "team-analysis-database-first-supported-c2-validation.json", sha256: "16b287557edd9d6afc72d0d1a0cf60e8074f9a734c2976955648cb2bd93d74b7", sizeBytes: 149 },
        { fileName: "team-analysis-database-first-shadow-c3.json.gz", sha256: "96a5066d8015cb8c4a0bd84895f630a30e84e453f2a30d6e5fef73c354ad29fe", sizeBytes: 89_015 },
        { fileName: "team-analysis-database-first-shadow-c3-manifest.json", sha256: "0fd2155d8a4b13f59bb47c1487386b2d98f004a0caea791da022c89033a78ff2", sizeBytes: 799 },
        { fileName: "team-analysis-database-first-shadow-c3-coverage.json", sha256: "ec3857a2895c876fbf17291d694348cac1d2221dd38efdd0b5f76c23dac7845f", sizeBytes: 633 },
        { fileName: "team-analysis-database-first-shadow-c3-validation.json", sha256: "6fe7d34d3785906e1a7fb62db862d30685f09fa468fd58c7d86d27055d683ad5", sizeBytes: 201 },
    ],
    sidecars: [
        { gate: "k0", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k0-identity.json.gz", sha256: "c084075d1b8d89814a5c6245097812e7102440670b547b87d8e555d65cf010d9", sizeBytes: 1_526_194, uncompressedSizeBytes: 32_196_636 }, manifest: { fileName: "database-characters-k0-manifest.json", sha256: "1389f628583d438065176735cdc7df60745215031c03abd12f4ec041f0d88587", sizeBytes: 999 }, coverage: { fileName: "database-characters-k0-coverage.json", sha256: "ad3da8b1793e3fadbe9490b41307bd342dd8f74891da6eaa68041addd41dfc2d", sizeBytes: 541 }, validation: { fileName: "database-characters-k0-validation.json", sha256: "8ea85baddd50f3267b8c806e87019565cc812899bf3ead4f140686cebc8f600b", sizeBytes: 143 }, consumerScopes: ["identity", "ui_grouping"], auditScopes: ["relation_coverage"] },
        { gate: "k1", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k1-state-graph.json.gz", sha256: "babe3061921a886271bceeb189bdc2f519e9dcf75104c9c759d8213300c6439e", sizeBytes: 329_730, uncompressedSizeBytes: 6_306_654 }, manifest: { fileName: "database-characters-k1-manifest.json", sha256: "4a36b355b88fecc7aff078f178cda2b733e80daaad0d8c65af0acf5d422b5e76", sizeBytes: 981 }, coverage: { fileName: "database-characters-k1-coverage.json", sha256: "80dd0f0fab406864bc702b12409f0d7fef177e2f76cfbe2aeb2b373c1fee9789", sizeBytes: 777 }, validation: { fileName: "database-characters-k1-validation.json", sha256: "50c9e2c6a5663815be890f742e3651fffdd9aba68b1fd4ee885a9db1f8aaa14f", sizeBytes: 111 }, consumerScopes: ["state_graph", "awakenings", "form_relations"], auditScopes: ["partial_state_bindings"] },
        { gate: "k2", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k2-taxonomy.json.gz", sha256: "af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37", sizeBytes: 511_837, uncompressedSizeBytes: 12_566_626 }, manifest: { fileName: "database-characters-k2-manifest.json", sha256: "c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24", sizeBytes: 927 }, coverage: { fileName: "database-characters-k2-coverage.json", sha256: "f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9", sizeBytes: 687 }, validation: { fileName: "database-characters-k2-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: ["rarity_type_class", "categories", "links"], auditScopes: ["locale_gaps"] },
        { gate: "k3", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k3-skills.json.gz", sha256: "6a9c18ae74e5e5e052615d75abbfa900337ea9eebfe0262d0943213f6afd03e0", sizeBytes: 2_707_309, uncompressedSizeBytes: 81_356_220 }, manifest: { fileName: "database-characters-k3-manifest.json", sha256: "83fe9ae4ed563772d7f0d7aa66fa4c916dc1c8a713135088a4194caeed0dea7b", sizeBytes: 1_116 }, coverage: { fileName: "database-characters-k3-coverage.json", sha256: "36f79c5266dc05e48663bd6f756e561c16e680867a24754d5de2641dccb5f019", sizeBytes: 651 }, validation: { fileName: "database-characters-k3-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: ["supported_mechanics"], auditScopes: ["raw_skill_rows", "unsupported_mechanics"] },
        { gate: "k4", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k4-progression.json.gz", sha256: "9d40af1da053f008730992537d0a349e94ca36d88a6584d7e7086faa9ee82c0e", sizeBytes: 3_486_645, uncompressedSizeBytes: 90_774_310 }, manifest: { fileName: "database-characters-k4-manifest.json", sha256: "c613fefc5324339f1459f469ea2c923623394f956c5e731e4a65964e560c777a", sizeBytes: 1_504 }, coverage: { fileName: "database-characters-k4-coverage.json", sha256: "82a711d2402df82a953024c4c08c044d9a3e9f2a9c3239b1a35cc58bbb290129", sizeBytes: 1_268 }, validation: { fileName: "database-characters-k4-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: ["card_stats", "state_caps", "awakening_requirements"], auditScopes: ["potential_raw", "equipment_limitations"] },
        { gate: "k5", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k5-acquisition.json.gz", sha256: "f7b3bb6a59d66868aa83dae3396bd9af76907af15b39c2d48dfef789fcd73623", sizeBytes: 581_649, uncompressedSizeBytes: 21_296_298 }, manifest: { fileName: "database-characters-k5-manifest.json", sha256: "fd556467b184977dfd1b0e8dc964151e81b26423e8fce39305a927645b8646f6", sizeBytes: 1_242 }, coverage: { fileName: "database-characters-k5-coverage.json", sha256: "bca3c06deb9a5165774d17550a6003f6fb9a06abf71e225e075bb4f56b5adddf", sizeBytes: 601 }, validation: { fileName: "database-characters-k5-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: ["static_drop_evidence", "reversible_exchange_relations"], auditScopes: ["unknown_f2p", "derived_training_candidates"] },
        { gate: "k6", contractVersion: "1.0.0", artifact: { fileName: "database-characters-k6-assets.json.gz", sha256: "743b9128ba3b708a4ead6b436c7f6aa71f6885f29f7336fb91972bf7e09089a1", sizeBytes: 901_984, uncompressedSizeBytes: 27_373_521 }, manifest: { fileName: "database-characters-k6-manifest.json", sha256: "b6fa5300399a81ad8687631cd04dee14fb41fb1d6d2ee2979869cd1cfe5eabae", sizeBytes: 1_268 }, coverage: { fileName: "database-characters-k6-coverage.json", sha256: "8a3de274c1969dd1530257060be81e6a30d1515df3775ee9ba376d88d80f1892", sizeBytes: 858 }, validation: { fileName: "database-characters-k6-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: [], auditScopes: ["static_asset_references", "delivery_unknown"] },
        { gate: "k7", contractVersion: "1.1.0", artifact: { fileName: "database-characters-k7-parity.json.gz", sha256: "ff2528f1057c2cd8d7edec0b57a0c7dcc64f955b282f31d124b7d0dad80cd7d5", sizeBytes: 121_529, uncompressedSizeBytes: 6_578_877 }, manifest: { fileName: "database-characters-k7-manifest.json", sha256: "e42b4b052a39e1f580536a1b97023177dc4d9c218565647ee9e6cf6bcc79c94e", sizeBytes: 2_004 }, coverage: { fileName: "database-characters-k7-coverage.json", sha256: "b7efcc6cb8da0224e70750ab8de56fe7f290798813e47f24171c5368882c0584", sizeBytes: 563 }, validation: { fileName: "database-characters-k7-validation.json", sha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac", sizeBytes: 60 }, consumerScopes: [], auditScopes: ["shadow_parity", "historical_issues"] },
    ] as CharacterSidecarProfile[],
} as const;

export interface DatabaseCharacterRefreshReceipt {
    schemaVersion: 1;
    contract: "dokkan-database-character-refresh-receipt";
    contractVersion: "1.0.0";
    generatedAt: string;
    profileId: string;
    source: {
        snapshotVersion: string;
        sqlite: { sha256: string; sizeBytes: number };
        db1: { sha256: string; sizeBytes: number; cardCount: number };
        nativeRuntime: { sha256: string; sizeBytes: number; format: string };
        semanticFiles: PinnedFileIdentity[];
    };
    sidecars: Array<CharacterSidecarProfile & { schemaVersion: 1; sourceDb1ArtifactSha256: string; validationValid: true; absenceBehavior: "preserve_production" }>;
    totals: { sidecarCount: number; consumerSidecarCount: number; auditSidecarCount: number; compressedBytes: number; uncompressedBytes: number };
    policy: { optional: true; enabledByDefault: false; productionImportCount: 0; productionReplacement: false; r2Publication: false; androidConsumption: false; absenceBehavior: "preserve_production"; consumerChannel: "supported_only_scopes"; auditChannelSeparate: true };
    execution: { mode: "focused_profile_verification"; db0Db50Replay: false; sidecarsRegenerated: false; receiptWrittenAfterCompatibility: true };
}

export interface DatabaseCharacterRefreshCoverage {
    schemaVersion: 1;
    sidecarCount: number;
    consumerSidecarCount: number;
    auditSidecarCount: number;
    compressedBytes: number;
    uncompressedBytes: number;
    semanticFileCount: number;
    invalidSidecarCount: number;
    productionImportCount: number;
}

export interface DatabaseCharacterRefreshValidation { schemaVersion: 1; valid: boolean; failures: string[] }
