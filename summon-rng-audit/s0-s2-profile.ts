import { createHash } from "crypto";
import { parseNativeRuntimeElf } from "../database-experiment/native-runtime-elf-adapter";
import { S0S2Artifact, S0S2Audit } from "./s0-s2-contract";

export const S0_S2_ARTIFACTS: readonly S0S2Artifact[] = [
    {
        id: "global-apk-6-4-0", role: "apk", declared: true,
        sha256: "a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0", sizeBytes: 98_799_013,
        region: "global", gameBuild: "338", version: "6.4.0",
        structuralIdentity: "Android APK; package=com.bandainamcogames.dbzdokkanww; versionCode=338; versionName=6.4.0; nativeCode=arm64-v8a",
    },
    {
        id: "global-elf-6-4-0", role: "elf", declared: true,
        sha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a", sizeBytes: 95_662_296,
        region: "global", gameBuild: "338", version: "6.4.0",
        structuralIdentity: "ELF64 little-endian AArch64; GNU buildId=2d363da04f02f41c226bf9c70966855adefe3d51",
    },
    {
        id: "global-sqlite-current-2026-08-05", role: "sqlite_current", declared: true,
        sha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265", sizeBytes: 95_428_608,
        region: "global", gameBuild: "338", version: "snapshot-2026-08-05",
        structuralIdentity: "SQLite format 3; pageSize=4096; pageCount=23298; tables=232; integrity_check=ok; summon-named-tables=0",
    },
    {
        id: "global-sqlite-backup-2026-08-05", role: "sqlite_backup", declared: true,
        sha256: "18012e59db4a7f7c8c5a1ffd56e676b1950dd94f0d1cc5ed18f4fe5266bf7f2c", sizeBytes: 1_634_304,
        region: "global", gameBuild: "338", version: "snapshot-2026-08-05",
        structuralIdentity: "SQLite format 3; pageSize=4096; pageCount=399; tables=137; integrity_check=ok; summon-named-tables=0",
    },
] as const;

export interface NativeCodePin { id: string; symbol?: string; vma: number; sizeBytes: number; sha256: string; }
export interface NativeStringPin { id: string; vma: number; value: string; }

export const S0_S2_NATIVE_CODE_PINS: readonly NativeCodePin[] = [
    { id: "gashas-draw-api-constructor", symbol: "_ZN13GashasDrawAPIC1ERKNSt6__ndk112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi", vma: 0x49c8e00, sizeBytes: 316, sha256: "07a77f5947785de573eee3592c22282d274f091522374629c3f363eef3a692d9" },
    { id: "gasha-model-draw-entry", symbol: "_ZN10GashaModel9drawGashaENSt6__ndk110shared_ptrI5GashaEE13GashaDrawType", vma: 0x331c050, sizeBytes: 452, sha256: "51939cb9656335408f44c564ae9d4018813d5b3aea25e85b51cabcd4b86b9138" },
    { id: "gasha-model-send", symbol: "_ZN10GashaModel9drawGashaEP10WebAPIBaseNSt6__ndk110shared_ptrI5GashaEE13GashaDrawType", vma: 0x331bc24, sizeBytes: 644, sha256: "9ed18e74673f2516bedc4c87b6501f72e252d0ff4704cdbfe1e73ad38734e76f" },
    { id: "draw-success-callback", vma: 0x331ff80, sizeBytes: 1728, sha256: "6f8731357500b9a3a3827148a9a2ec7017651ccf055f36d63fff067fbe648933" },
    { id: "construct-gasha-result-helper", vma: 0x3320668, sizeBytes: 280, sha256: "617c00290d5cd171ac0e66ec17d4b98a495677869e96d1bbe1b6fbe027cb1e78" },
    { id: "gasha-result-constructor", symbol: "_ZN11GashaResultC1ENSt6__ndk110shared_ptrI5GashaEE13GashaDrawTypeRKN4Json5ValueE", vma: 0x3328730, sizeBytes: 332, sha256: "c678f9f3215cab778c6120b5d714769a6b8afe046a438444457e916b5c2da3cc" },
    { id: "gasha-result-cards", symbol: "_ZN11GashaResult13setGashaCardsERKN4Json5ValueE", vma: 0x332887c, sizeBytes: 520, sha256: "26ebe74cf8578358943efe6d3bd9c6821048146c4633b378ffe322cfc2228eee" },
    { id: "acquired-items-each", symbol: "_ZNK13AcquiredItems4eachERKN4Json5ValueENSt6__ndk18functionIFvS1_S1_NS4_10shared_ptrI8UserCardEEEEE", vma: 0x418e0cc, sizeBytes: 1244, sha256: "6b6a0f347be43e1ea22d068b6a8d188a8af00fc17e05d52be92a2401913141dc" },
    { id: "retrieve-acquired-characters", symbol: "_ZNK13AcquiredItems26retrieveAcquiredCharactersERKN4Json5ValueE", vma: 0x418e850, sizeBytes: 240, sha256: "832acfd0cfd13cdf886bdcf7019f627551db8bec8b1c57fbc429f72046464f91" },
    { id: "gasha-result-movie-info", symbol: "_ZN11GashaResult14parseMovieInfoERKN4Json5ValueE", vma: 0x3328c3c, sizeBytes: 1820, sha256: "30ecdce17333544a84c27071f4caa0e8caab6e03e2b1cee022f0eebf1ba9cb05" },
    { id: "gasha-draw-movie-init", symbol: "_ZN19GashaDrawMovieScene4initERKNSt6__ndk110shared_ptrI11GashaResultEE", vma: 0x409906c, sizeBytes: 476, sha256: "7d3eb9811a2bc8eea62d511c7be97f14d5b3d76965d2d6cc65444db945be79ee" },
    { id: "gasha-result-list", symbol: "_ZN16GashaResultScene12initListViewI24LayoutGashaGasha05ResultEEvv", vma: 0x40be138, sizeBytes: 1368, sha256: "b780b1cb20efdba27e10a112ae7ac342c86aa4be22c9f05fffb36753798c76cb" },
    { id: "movie-lottery-proc", symbol: "_ZN14gashaMovieProc11lotteryProcERKNSt6__ndk112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEERKN4Json5ValueE", vma: 0x483a4ec, sizeBytes: 716, sha256: "b1c74920cc15984f218a2b7befa0a71d2f866b0830820e1b4beefc84803db6e0" },
    { id: "movie-lottery-draw", symbol: "_ZN17GashaMovieLottery4drawINSt6__ndk123mersenne_twister_engineImLm32ELm624ELm397ELm31ELm2567483615ELm11ELm4294967295ELm7ELm2636928640ELm15ELm4022730752ELm18ELm1812433253EEEEENS1_6vectorINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS8_ISA_EEEERT_RKSA_", vma: 0x4099f14, sizeBytes: 396, sha256: "77d6bd5f5c03cc4716c004d7afe3b65dad2266575ca3eb3d891bb4c77d9ed960" },
] as const;

export const S0_S2_NATIVE_STRING_PINS: readonly NativeStringPin[] = [
    { id: "draw-route", vma: 0x1e8bdd2, value: "gashas/{0}/courses/{1}/draw" },
    { id: "response-user-items", vma: 0x1efca10, value: "user_items" },
    { id: "response-gasha-items", vma: 0x1f524c7, value: "gasha_items" },
    { id: "response-movie", vma: 0x1ef4f5f, value: "movie" },
    { id: "movie-lr-seed-cards", vma: 0x1e77faa, value: "lr_seed_cards" },
    { id: "movie-limited-cards", vma: 0x1f288e7, value: "limited_cards" },
    { id: "movie-carnival-cards", vma: 0x1efda7b, value: "carnival_only_cards" },
    { id: "draw-success-event", vma: 0x1f06110, value: "EVENT_GASHA_MODEL_DRAW_SUCCESS" },
] as const;

function hash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function cstring(bytes: Buffer): string { const end = bytes.indexOf(0); return bytes.subarray(0, end < 0 ? bytes.length : end).toString("utf8"); }

export function validatePinnedArtifactBytes(artifact: S0S2Artifact, bytes: Buffer): string[] {
    const failures: string[] = [];
    if (bytes.length !== artifact.sizeBytes) failures.push(`${artifact.id}: size changed`);
    if (hash(bytes) !== artifact.sha256) failures.push(`${artifact.id}: SHA-256 changed`);
    if (artifact.role === "apk" && bytes.subarray(0, 4).toString("hex") !== "504b0304") failures.push(`${artifact.id}: APK ZIP header changed`);
    if ((artifact.role === "sqlite_current" || artifact.role === "sqlite_backup") && bytes.subarray(0, 16).toString("ascii") !== "SQLite format 3\0") failures.push(`${artifact.id}: SQLite header changed`);
    return failures;
}

export function validatePinnedElf(bytes: Buffer): string[] {
    const failures: string[] = [];
    let elf: ReturnType<typeof parseNativeRuntimeElf>;
    try { elf = parseNativeRuntimeElf(bytes); } catch (error) { return [`ELF structure: ${(error as Error).message}`]; }
    for (const pin of S0_S2_NATIVE_CODE_PINS) {
        if (pin.symbol) {
            const symbol = elf.symbols.find(value => value.name === pin.symbol);
            if (!symbol || symbol.value !== pin.vma || symbol.size !== pin.sizeBytes) failures.push(`${pin.id}: symbol identity changed`);
        }
        try {
            if (hash(elf.readVirtualBytes(pin.vma, pin.sizeBytes)) !== pin.sha256) failures.push(`${pin.id}: code bytes changed`);
        } catch (error) { failures.push(`${pin.id}: ${(error as Error).message}`); }
    }
    for (const pin of S0_S2_NATIVE_STRING_PINS) {
        try {
            if (cstring(elf.readVirtualBytes(pin.vma, Buffer.byteLength(pin.value) + 1)) !== pin.value) failures.push(`${pin.id}: string changed`);
        } catch (error) { failures.push(`${pin.id}: ${(error as Error).message}`); }
    }
    return failures;
}

export function buildS0S2Audit(): S0S2Audit {
    return {
        schemaVersion: 1,
        contract: "dokkan-summon-rng-audit-s0-s2",
        contractVersion: "0.1.0",
        campaign: "summon_rng",
        collectionMode: "offline_only",
        productionMutation: false,
        defaultEnabled: false,
        artifacts: S0_S2_ARTIFACTS.map(value => ({ ...value })),
        ledger: [
            { id: "apk-identity", kind: "client_side_static", classification: "first_party_supported", summary: "The exact Global 6.4.0 APK identity is pinned by package, build, size and SHA-256.", artifactRefs: ["global-apk-6-4-0"] },
            { id: "elf-draw-flow", kind: "client_side_static", classification: "first_party_supported", summary: "Pinned ELF regions cover draw request creation, response callback, GashaResult construction, gasha_items extraction and result presentation.", artifactRefs: ["global-elf-6-4-0"] },
            { id: "sqlite-inventory", kind: "client_side_static", classification: "first_party_supported", summary: "Both pinned content databases pass integrity_check and contain zero table names matching gasha, summon, lottery or draw.", artifactRefs: ["global-sqlite-current-2026-08-05", "global-sqlite-backup-2026-08-05"] },
            { id: "official-multi-rules", kind: "published_rates", classification: "first_party_supported", summary: "Bandai Namco states that Multi Summons guarantee one SSR, while additional featured guarantees and benefits vary by Summon and must be checked in the in-game News.", sourceAuthority: "bandai_namco_dokkan_faq", sourceRef: "https://bnfaq.channel.or.jp/faq/detail/1625/8602" },
            { id: "official-friend-points", kind: "published_rates", classification: "first_party_supported", summary: "Bandai Namco states that Friend Points are the currency used for Friend Summons; it does not define the campaign's proposed trigger event.", sourceAuthority: "bandai_namco_dokkan_faq", sourceRef: "https://bnfaq.channel.or.jp/faq/detail/1625/2424" },
            { id: "captured-catalog-boundary", kind: "protocol_network", classification: "corroborative_only", summary: "Existing H4/H10/H13 offline captures contain partial gasha pools and rate dimensions, but H4 unions do not preserve per-step association and H13 authorizes corrective comparison only.", sourceAuthority: "repository_local", sourceRef: "repository:docs/game-db/specs/database-server-capture-h13.md" },
            { id: "community-friend-trigger", kind: "community_report", classification: "unknown", summary: "The alleged Friend Summon trigger has not yet been operationally defined and no complete attempt log has been supplied." },
            { id: "observed-clusters", kind: "statistical_observation", classification: "unknown", summary: "Anecdotal duplicate and cluster observations have no preregistered sampling frame, denominator or banner/slot controls yet." },
            { id: "server-state-possibilities", kind: "server_side_inference", classification: "unknown", summary: "Account, session, time, banner-history or cross-banner server conditioning cannot be resolved from the pinned client alone." },
        ],
        findings: [
            { id: "request-shape", kind: "client_side_static", classification: "first_party_supported", claim: "The ordinary draw path is parameterized by gasha and course.", evidenceRefs: ["elf-draw-flow"], conclusion: "GashaModel creates GashasDrawAPI for the literal route gashas/{0}/courses/{1}/draw; no Friend-specific draw API was found in the audited path." },
            { id: "response-card-source", kind: "client_side_static", classification: "first_party_supported", claim: "The displayed acquired-card collection originates in the draw response.", evidenceRefs: ["elf-draw-flow"], conclusion: "The success callback constructs GashaResult from the response JSON, and setGashaCards reads gasha_items through AcquiredItems before the success event and scenes run." },
            { id: "presentation-order", kind: "client_side_static", classification: "first_party_supported", claim: "No card sorting or shuffling is present in the pinned extraction path.", evidenceRefs: ["elf-draw-flow"], conclusion: "AcquiredItems iterates the response collection and retrieves UserCard entries into the result vector; the audited extraction and list setup regions contain no card RNG, sort or shuffle call. This is scoped to the pinned regions, not every possible presentation path." },
            { id: "movie-rng-separation", kind: "client_side_static", classification: "first_party_supported", claim: "Client RNG found in the summon feature is tied to movie-state selection.", evidenceRefs: ["elf-draw-flow"], conclusion: "gashaMovieProc::lotteryProc calls std::random_device and GashaMovieLottery uses a Mersenne Twister after GashaResult has already parsed response cards and movie metadata. This does not show client-side card selection." },
            { id: "selection-boundary", kind: "server_side_inference", classification: "consistent_but_unproven", claim: "Card selection appears to occur before the client presentation path.", evidenceRefs: ["elf-draw-flow", "sqlite-inventory"], conclusion: "The client sends a gasha/course draw request and consumes returned gasha_items; no pool tables or card-selection routine were found in the pinned client path. Server-side selection is the best-supported interpretation, but the complete server algorithm is not recoverable here." },
            { id: "shared-state-hypothesis", kind: "server_side_inference", classification: "unknown", claim: "Friend and ordinary summons may or may not share undisclosed server state.", evidenceRefs: ["elf-draw-flow", "server-state-possibilities"], conclusion: "The generic client API exposes no gasha-specific seed, RNG counter or timestamp argument in the pinned request constructor. That negative client finding neither proves independence nor excludes server state." },
            { id: "exact-rate-model", kind: "published_rates", classification: "unknown", claim: "An exact banner/slot null model is not yet pinned.", evidenceRefs: ["official-multi-rules", "captured-catalog-boundary"], conclusion: "Generic GSSR rules are first-party, while the target banner, version, period, per-slot rates and guarantees remain unspecified. H4/H10 unions cannot fill that gap." },
            { id: "friend-test-readiness", kind: "statistical_observation", classification: "unknown", claim: "The Friend-to-normal conditional test is not yet identifiable.", evidenceRefs: ["community-friend-trigger", "observed-clusters"], conclusion: "The Friend trigger, comparison window, controls, stopping rule and complete negative attempts must be fixed before confirmatory analysis." },
            { id: "duplicate-test-readiness", kind: "statistical_observation", classification: "unknown", claim: "Observed duplicate clusters cannot yet reject independence.", evidenceRefs: ["observed-clusters", "official-multi-rules", "captured-catalog-boundary"], conclusion: "Pool weights, replacement semantics, slot-specific guarantees, repeated multis, multiple comparisons and recall bias remain uncontrolled." },
        ],
        decisions: [
            { id: "go-offline-static", capability: "offline_static_validation", status: "GO", claim: "Validate the pinned source bytes and retain the static reconstruction as an offline checkpoint.", evidenceRefs: ["request-shape", "response-card-source", "movie-rng-separation"], rationale: "The exact byte identities and bounded code regions make these client findings reproducible." },
            { id: "no-go-null-model", capability: "exact_null_model", status: "NO-GO", claim: "Do not treat any current pool union as the exact official null model.", evidenceRefs: ["exact-rate-model"], rationale: "Banner, period, step, slot and guarantee dimensions are not yet pinned together." },
            { id: "no-go-server-algorithm", capability: "server_algorithm_recovery", status: "NO-GO", claim: "Do not claim recovery of the complete server selection algorithm or shared-state behavior.", evidenceRefs: ["selection-boundary", "shared-state-hypothesis"], rationale: "The APK proves a client boundary, not server internals." },
            { id: "no-go-causal-claim", capability: "causal_or_false_rate_claim", status: "NO-GO", claim: "Do not claim that a Friend result causes improved featured odds or that duplicate clusters contradict published rates.", evidenceRefs: ["friend-test-readiness", "duplicate-test-readiness"], rationale: "No preregistered controlled observations or exact banner null model exist yet." },
            { id: "no-go-sensitive-methods", capability: "sensitive_or_live_methods", status: "NO-GO", claim: "Do not use dynamic game modification, authenticated traffic collection, automated draws or experimental spending in this checkpoint.", evidenceRefs: ["server-state-possibilities"], rationale: "Those methods require separate authorization, and spending solely for the experiment is prohibited." },
        ],
        policy: { credentials: false, accountIds: false, deviceIds: false, rawAuthenticatedPayloads: false, spend: false, automation: false, hooking: false, instrumentation: false, predictionOrExploitation: false, production: false, r2: false, android: false },
    };
}
