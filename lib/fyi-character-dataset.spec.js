"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const fyi_character_dataset_1 = require("./fyi-character-dataset");
const character_1 = require("./character");
const dataset_artifacts_1 = require("./dataset-artifacts");
const fyi_character_portraits_1 = require("./fyi-character-portraits");
const fyi_character_candidate_1 = require("./fyi-character-candidate");
const catalog = {
    generatedAt: "2026-07-18T00:00:00.000Z",
    source: "dokkan.fyi",
    request: { compact: true, fullyAwakened: true },
    pageSize: 96,
    pageCount: 1,
    isComplete: true,
    candidateCount: 2,
    characterCount: 2,
    awakeningLineCount: 2,
    duplicateGroupCount: 0,
    failedPages: [],
    characters: [
        { id: "1", baseCharacterId: "1", name: "A", hasEza: false, hasSeza: false, isReversiblyExchanged: false, isFreelyObtainable: false, isStageDropReward: false, isWorldTournamentReward: false, hasBattleMotion: false, sourceUrl: "" },
        { id: "2", baseCharacterId: "2", name: "B", hasEza: false, hasSeza: false, isReversiblyExchanged: false, isFreelyObtainable: false, isStageDropReward: false, isWorldTournamentReward: false, hasBattleMotion: false, sourceUrl: "" },
    ],
};
function character(id, options = {}) {
    return {
        name: id,
        title: "",
        maxLevel: 1,
        maxSALevel: 1,
        rarity: character_1.Rarities.UR,
        characterClass: character_1.Classes.Super,
        type: character_1.Types.AGL,
        cost: 1,
        id,
        portraitURL: "",
        portraitFilename: "",
        leaderSkill: "",
        superAttack: "",
        passive: "",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "",
        baseHP: 1,
        maxLevelHP: 1,
        freeDupeHP: 1,
        rainbowHP: 1,
        baseAttack: 1,
        maxLevelAttack: 1,
        freeDupeAttack: 1,
        rainbowAttack: 1,
        baseDefence: 1,
        maxDefence: 1,
        freeDupeDefence: 1,
        rainbowDefence: 1,
        kiMultiplier: "",
        standbySkill: "",
        ...options,
    };
}
describe("dokkan.fyi character dataset runner", () => {
    let temporaryDirectory;
    beforeEach(async () => { temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-fyi-k19-")); });
    afterEach(async () => { await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true }); });
    it("marks a complete, unique scrape as publishable", () => {
        const report = (0, fyi_character_dataset_1.buildFyiCharacterDatasetRunReport)(catalog, ["1", "2"], [character("1", { activeSkill: "Active" }), character("2", { isFreeToPlay: true })], []);
        (0, assert_1.equal)(report.publishable, true);
        (0, assert_1.equal)(report.fullCatalog, true);
        (0, assert_1.equal)(report.mechanicCoverage.activeSkillCount, 1);
        (0, assert_1.equal)(report.mechanicCoverage.freeToPlayCount, 1);
    });
    it("keeps partial or failed runs non-publishable and reports missing IDs", () => {
        const report = (0, fyi_character_dataset_1.buildFyiCharacterDatasetRunReport)(catalog, ["1"], [character("1")], ["2"]);
        (0, assert_1.equal)(report.publishable, false);
        (0, assert_1.equal)(report.fullCatalog, false);
        (0, assert_1.deepEqual)(report.failedCharacterIds, ["2"]);
        (0, assert_1.deepEqual)(report.missingCharacterIds, []);
    });
    it("keeps the default mode K15-free and writes only latest", async () => {
        let k15Reads = 0;
        let candidateWrites = 0;
        const writes = [];
        let writtenArtifact;
        const latest = (0, path_1.join)(temporaryDirectory, "latest");
        const result = await (0, fyi_character_dataset_1.runDokkanFyiCharacterDataset)({ mode: "latest" }, {
            getCatalog: async () => catalog,
            getDataWithReport: async () => ({ characters: [character("1"), character("2")], failedCharacterIds: [] }),
            mirrorPortraits: async () => ({ targetCount: 0, downloadedCount: 0 }),
            localizePortraitUrls: values => JSON.parse(JSON.stringify(values)),
            validateK15: async () => { k15Reads++; throw new Error("must not read K15"); },
            writeLatestReport: async (path) => { writes.push(path); },
            writeLatestBundle: async (path, artifact) => { writes.push(path); writtenArtifact = artifact; },
            writeCandidate: async () => { candidateWrites++; return "unused"; },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: latest,
        });
        (0, assert_1.equal)(k15Reads, 0);
        (0, assert_1.equal)(candidateWrites, 0);
        (0, assert_1.equal)(writes.length, 2);
        (0, assert_1.equal)(writes.every(path => path.startsWith(latest)), true);
        (0, assert_1.equal)(result.candidateReport, undefined);
        const expected = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(result.characters, {
            datasetVersion: result.report.generatedAt,
            generatedAt: result.report.generatedAt,
            fileName: "characters.json.gz",
        });
        (0, assert_1.equal)(writtenArtifact.jsonText, expected.jsonText);
        (0, assert_1.equal)(writtenArtifact.gzipBuffer.equals(expected.gzipBuffer), true);
        (0, assert_1.deepEqual)(writtenArtifact.manifest, expected.manifest);
    });
    it("scopes K15 to FYI structural IDs and writes only the candidate directory", async () => {
        const targetCatalog = { ...catalog, candidateCount: 1, characterCount: 1, awakeningLineCount: 1, characters: [catalog.characters[0]] };
        const target = character("1", { rarity: null, transformations: [character("3")] });
        const projection = {
            records: [
                { cardId: "1", stateId: "10", rarity: character_1.Rarities.UR, type: character_1.Types.AGL },
                { cardId: "2", stateId: "20", rarity: character_1.Rarities.UR, type: character_1.Types.AGL },
            ],
        };
        const scope = (0, fyi_character_candidate_1.scopeCharacterCompactProjectionToTarget)(projection, [target]);
        (0, assert_1.equal)(scope.targetStateCount, 2);
        (0, assert_1.equal)(scope.targetScopedK15Records, 1);
        (0, assert_1.equal)(scope.excludedByTargetCatalog, 1);
        (0, assert_1.equal)(scope.targetStatesNotCovered, 1);
        (0, assert_1.deepEqual)(scope.targetStatesNotCoveredSample, ["3"]);
        let k15Reads = 0;
        let latestWrites = 0;
        let candidateWrites = 0;
        let portraitDestination = "";
        const candidatePath = (0, path_1.join)(temporaryDirectory, "candidate-k19");
        const validation = {
            projection,
            manifest: {
                generatedAt: "2026-08-05T00:00:00.000Z", datasetVersion: "k15",
                fileName: "k15.json.gz", sha256: "k15-sha",
            },
        };
        const result = await (0, fyi_character_dataset_1.runDokkanFyiCharacterDataset)({ mode: "candidate-k19", optInK19: true }, {
            getCatalog: async () => targetCatalog,
            getDataWithReport: async () => ({ characters: [target], failedCharacterIds: [] }),
            mirrorPortraits: async (_values, destination) => {
                portraitDestination = destination;
                return { targetCount: 0, downloadedCount: 0 };
            },
            localizePortraitUrls: values => JSON.parse(JSON.stringify(values)),
            validateK15: async () => { k15Reads++; return JSON.parse(JSON.stringify(validation)); },
            writeLatestReport: async () => { latestWrites++; },
            writeLatestBundle: async () => { latestWrites++; },
            writeCandidate: async (_root, name, files, populate) => {
                candidateWrites++;
                (0, assert_1.equal)(name, "candidate-k19");
                (0, assert_1.deepEqual)(files.map(file => file.name), [
                    "baseline-characters.json.gz", "baseline-characters-manifest.json",
                    "characters.json.gz", "characters-manifest.json", "run-report.json", "candidate-k19-report.json",
                ]);
                await populate(candidatePath);
                return candidatePath;
            },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: (0, path_1.join)(temporaryDirectory, "latest"),
        });
        (0, assert_1.equal)(k15Reads, 2);
        (0, assert_1.equal)(latestWrites, 0);
        (0, assert_1.equal)(candidateWrites, 1);
        (0, assert_1.equal)(portraitDestination, candidatePath);
        (0, assert_1.equal)(result.characters[0].rarity, character_1.Rarities.UR);
        (0, assert_1.equal)(result.candidateReport.targetScope.excludedByTargetCatalog, 1);
        (0, assert_1.equal)(result.candidateReport.targetScope.targetStatesNotCovered, 1);
    });
    it("rejects blockers before candidate writes or portrait work", async () => {
        let writes = 0;
        let mirrors = 0;
        const targetCatalog = { ...catalog, candidateCount: 1, characterCount: 1, awakeningLineCount: 1, characters: [catalog.characters[0]] };
        await (0, assert_1.rejects)((0, fyi_character_dataset_1.runDokkanFyiCharacterDataset)({ mode: "candidate-k19", optInK19: true }, {
            getCatalog: async () => targetCatalog,
            getDataWithReport: async () => ({ characters: [character("1", { type: character_1.Types.STR })], failedCharacterIds: [] }),
            localizePortraitUrls: values => JSON.parse(JSON.stringify(values)),
            validateK15: async () => ({ projection: { records: [{ cardId: "1", stateId: "10", rarity: character_1.Rarities.UR, type: character_1.Types.AGL }] }, manifest: {} }),
            mirrorPortraits: async () => { mirrors++; return { targetCount: 0, downloadedCount: 0 }; },
            writeCandidate: async () => { writes++; return "unused"; },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: (0, path_1.join)(temporaryDirectory, "latest"),
        }), /target-scoped overlay blocked/);
        (0, assert_1.equal)(writes, 0);
        (0, assert_1.equal)(mirrors, 0);
    });
    it("requires explicit candidate CLI opt-in and allowlisted directory names", () => {
        (0, assert_1.deepEqual)((0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)([]), { mode: "latest" });
        (0, assert_1.throws)(() => (0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)(["--candidate-dir", "candidate-k19"]), /exactly one/);
        (0, assert_1.throws)(() => (0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)(["--candidate-k19", "--candidate-dir", "../candidate-k19"]), /not allowed/);
        (0, assert_1.throws)(() => (0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)(["--candidate-k19", "--k15-dir", "C:\\compact"]), /not allowed/);
        (0, assert_1.throws)(() => (0, fyi_character_dataset_1.parseFyiCharacterDatasetCli)(["--candidate-k19", "--candidate-k19"]), /exactly one/);
    });
    it("rejects malicious portrait filenames before localization or mirroring", () => {
        const unsafe = character("1", {
            portraitFilename: "../latest/portrait_1",
            portraitSpec: { iconId: 1, frameColorId: 1, rarity: character_1.Rarities.UR, elementCode: "11" },
        });
        (0, assert_1.throws)(() => (0, fyi_character_portraits_1.localizeCharacterPortraitUrls)([unsafe]), /canonical/);
        (0, assert_1.throws)(() => (0, fyi_character_portraits_1.collectFyiPortraitTargets)([unsafe]), /canonical/);
    });
    it("rejects candidate path traversal and absolute/UNC forms", async () => {
        await (0, promises_1.mkdir)((0, path_1.join)(temporaryDirectory, "root"));
        for (const value of ["../candidate-k19", (0, path_1.join)(temporaryDirectory, "candidate-k19"), "\\\\server\\candidate-k19"]) {
            await (0, assert_1.rejects)((0, fyi_character_candidate_1.resolveFyiCandidateDirectory)((0, path_1.join)(temporaryDirectory, "root"), value, true));
        }
    });
    it("commits only the fixed candidate inventory and never replaces it", async () => {
        const root = (0, path_1.join)(temporaryDirectory, "root");
        await (0, promises_1.mkdir)(root);
        const files = fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        const output = await (0, fyi_character_candidate_1.writeFyiCharacterCandidateDirectory)(root, "candidate-k19", files);
        (0, assert_1.deepEqual)((await (0, promises_1.readdir)(output)).sort(), [...fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_FILES, fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_READY_FILE].sort());
        (0, assert_1.equal)((await (0, promises_1.readFile)((0, path_1.join)(output, "candidate-k19-report.json"))).toString(), "candidate-k19-report.json");
        await (0, assert_1.rejects)((0, fyi_character_candidate_1.writeFyiCharacterCandidateDirectory)(root, "candidate-k19", files), /already exists/);
    });
    it("allows only one concurrent candidate reservation", async () => {
        const root = (0, path_1.join)(temporaryDirectory, "root");
        await (0, promises_1.mkdir)(root);
        const files = fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        const attempts = await Promise.allSettled([
            (0, fyi_character_candidate_1.writeFyiCharacterCandidateDirectory)(root, "candidate-k19", files),
            (0, fyi_character_candidate_1.writeFyiCharacterCandidateDirectory)(root, "candidate-k19", files),
        ]);
        (0, assert_1.equal)(attempts.filter(result => result.status === "fulfilled").length, 1);
        (0, assert_1.equal)(attempts.filter(result => result.status === "rejected").length, 1);
        const output = (0, path_1.join)(root, "candidate-k19");
        (0, assert_1.deepEqual)((await (0, promises_1.readdir)(output)).sort(), [...fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_FILES, fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_READY_FILE].sort());
    });
    it("removes its reserved candidate after nested portrait work fails", async () => {
        const root = (0, path_1.join)(temporaryDirectory, "root");
        await (0, promises_1.mkdir)(root);
        const files = fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        await (0, assert_1.rejects)((0, fyi_character_candidate_1.writeFyiCharacterCandidateDirectory)(root, "candidate-k19", files, async (destination) => {
            await (0, promises_1.mkdir)((0, path_1.join)(destination, "images", "v2"), { recursive: true });
            throw new Error("portrait failure");
        }), /portrait failure/);
        await (0, assert_1.rejects)((0, promises_1.readFile)((0, path_1.join)(root, "candidate-k19", fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_READY_FILE)), /ENOENT/);
    });
    it("rejects an escaping candidate directory junction", async () => {
        const root = (0, path_1.join)(temporaryDirectory, "root");
        const outside = (0, path_1.join)(temporaryDirectory, "outside");
        await (0, promises_1.mkdir)(root);
        await (0, promises_1.mkdir)(outside);
        await (0, promises_1.symlink)(outside, (0, path_1.join)(root, "candidate-k19"), "junction");
        await (0, assert_1.rejects)((0, fyi_character_candidate_1.resolveFyiCandidateDirectory)(root, "candidate-k19", false), /rejected/);
    });
});
//# sourceMappingURL=fyi-character-dataset.spec.js.map