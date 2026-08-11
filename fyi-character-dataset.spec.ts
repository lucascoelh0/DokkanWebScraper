import { deepEqual, equal, rejects, throws } from "assert";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { FyiCharacterCatalogDataset } from "./fyi-character-catalog";
import {
    buildFyiCharacterDatasetRunReport,
    parseFyiCharacterDatasetCli,
    runDokkanFyiCharacterDataset,
} from "./fyi-character-dataset";
import { Character, Classes, Rarities, Types } from "./character";
import { buildCharacterDatasetArtifact } from "./dataset-artifacts";
import { collectFyiPortraitTargets, localizeCharacterPortraitUrls } from "./fyi-character-portraits";
import {
    FYI_CHARACTER_CANDIDATE_FILES,
    FYI_CHARACTER_CANDIDATE_READY_FILE,
    resolveFyiCandidateDirectory,
    scopeCharacterCompactProjectionToTarget,
    writeFyiCharacterCandidateDirectory,
} from "./fyi-character-candidate";

const catalog: FyiCharacterCatalogDataset = {
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

function character(id: string, options: Partial<Character> = {}): Character {
    return {
        name: id,
        title: "",
        maxLevel: 1,
        maxSALevel: 1,
        rarity: Rarities.UR,
        characterClass: Classes.Super,
        type: Types.AGL,
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
    let temporaryDirectory: string;

    beforeEach(async () => { temporaryDirectory = await mkdtemp(join(tmpdir(), "dokkan-fyi-k19-")); });
    afterEach(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

    it("marks a complete, unique scrape as publishable", () => {
        const report = buildFyiCharacterDatasetRunReport(
            catalog,
            ["1", "2"],
            [character("1", { activeSkill: "Active" }), character("2", { isFreeToPlay: true })],
            [],
        );

        equal(report.publishable, true);
        equal(report.fullCatalog, true);
        equal(report.mechanicCoverage.activeSkillCount, 1);
        equal(report.mechanicCoverage.freeToPlayCount, 1);
    });

    it("keeps partial or failed runs non-publishable and reports missing IDs", () => {
        const report = buildFyiCharacterDatasetRunReport(
            catalog,
            ["1"],
            [character("1")],
            ["2"],
        );

        equal(report.publishable, false);
        equal(report.fullCatalog, false);
        deepEqual(report.failedCharacterIds, ["2"]);
        deepEqual(report.missingCharacterIds, []);
    });

    it("keeps the default mode K15-free and writes only latest", async () => {
        let k15Reads = 0;
        let candidateWrites = 0;
        const writes: string[] = [];
        let writtenArtifact: any;
        const latest = join(temporaryDirectory, "latest");
        const result = await runDokkanFyiCharacterDataset({ mode: "latest" }, {
            getCatalog: async () => catalog,
            getDataWithReport: async () => ({ characters: [character("1"), character("2")], failedCharacterIds: [] }),
            mirrorPortraits: async () => ({ targetCount: 0, downloadedCount: 0 }),
            localizePortraitUrls: values => JSON.parse(JSON.stringify(values)),
            validateK15: async () => { k15Reads++; throw new Error("must not read K15"); },
            writeLatestReport: async path => { writes.push(path); },
            writeLatestBundle: async (path, artifact) => { writes.push(path); writtenArtifact = artifact; },
            writeCandidate: async () => { candidateWrites++; return "unused"; },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: latest,
        } as any);

        equal(k15Reads, 0);
        equal(candidateWrites, 0);
        equal(writes.length, 2);
        equal(writes.every(path => path.startsWith(latest)), true);
        equal(result.candidateReport, undefined);
        const expected = buildCharacterDatasetArtifact(result.characters, {
            datasetVersion: result.report.generatedAt,
            generatedAt: result.report.generatedAt,
            fileName: "characters.json.gz",
        });
        equal(writtenArtifact.jsonText, expected.jsonText);
        equal(writtenArtifact.gzipBuffer.equals(expected.gzipBuffer), true);
        deepEqual(writtenArtifact.manifest, expected.manifest);
    });

    it("scopes K15 to FYI structural IDs and writes only the candidate directory", async () => {
        const targetCatalog = { ...catalog, candidateCount: 1, characterCount: 1, awakeningLineCount: 1, characters: [catalog.characters[0]] };
        const target = character("1", { rarity: null as any, transformations: [character("3") as any] });
        const projection = {
            records: [
                { cardId: "1", stateId: "10", rarity: Rarities.UR, type: Types.AGL },
                { cardId: "2", stateId: "20", rarity: Rarities.UR, type: Types.AGL },
            ],
        } as any;
        const scope = scopeCharacterCompactProjectionToTarget(projection, [target]);
        equal(scope.targetStateCount, 2);
        equal(scope.targetScopedK15Records, 1);
        equal(scope.excludedByTargetCatalog, 1);
        equal(scope.targetStatesNotCovered, 1);
        deepEqual(scope.targetStatesNotCoveredSample, ["3"]);

        let k15Reads = 0;
        let latestWrites = 0;
        let candidateWrites = 0;
        let portraitDestination = "";
        const candidatePath = join(temporaryDirectory, "candidate-k19");
        const validation = {
            projection,
            manifest: {
                generatedAt: "2026-08-05T00:00:00.000Z", datasetVersion: "k15",
                fileName: "k15.json.gz", sha256: "k15-sha",
            },
        } as any;
        const result = await runDokkanFyiCharacterDataset({ mode: "candidate-k19", optInK19: true }, {
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
                equal(name, "candidate-k19");
                deepEqual(files.map(file => file.name), [
                    "baseline-characters.json.gz", "baseline-characters-manifest.json",
                    "characters.json.gz", "characters-manifest.json", "run-report.json", "candidate-k19-report.json",
                ]);
                await populate!(candidatePath);
                return candidatePath;
            },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: join(temporaryDirectory, "latest"),
        } as any);

        equal(k15Reads, 2);
        equal(latestWrites, 0);
        equal(candidateWrites, 1);
        equal(portraitDestination, candidatePath);
        equal(result.characters[0].rarity, Rarities.UR);
        equal(result.candidateReport!.targetScope.excludedByTargetCatalog, 1);
        equal(result.candidateReport!.targetScope.targetStatesNotCovered, 1);
    });

    it("rejects blockers before candidate writes or portrait work", async () => {
        let writes = 0;
        let mirrors = 0;
        const targetCatalog = { ...catalog, candidateCount: 1, characterCount: 1, awakeningLineCount: 1, characters: [catalog.characters[0]] };
        await rejects(runDokkanFyiCharacterDataset({ mode: "candidate-k19", optInK19: true }, {
            getCatalog: async () => targetCatalog,
            getDataWithReport: async () => ({ characters: [character("1", { type: Types.STR })], failedCharacterIds: [] }),
            localizePortraitUrls: values => JSON.parse(JSON.stringify(values)),
            validateK15: async () => ({ projection: { records: [{ cardId: "1", stateId: "10", rarity: Rarities.UR, type: Types.AGL }] }, manifest: {} } as any),
            mirrorPortraits: async () => { mirrors++; return { targetCount: 0, downloadedCount: 0 }; },
            writeCandidate: async () => { writes++; return "unused"; },
            fyiDataRoot: temporaryDirectory,
            latestOutputDir: join(temporaryDirectory, "latest"),
        } as any), /target-scoped overlay blocked/);
        equal(writes, 0);
        equal(mirrors, 0);
    });

    it("requires explicit candidate CLI opt-in and allowlisted directory names", () => {
        deepEqual(parseFyiCharacterDatasetCli([]), { mode: "latest" });
        throws(() => parseFyiCharacterDatasetCli(["--candidate-dir", "candidate-k19"]), /exactly one/);
        throws(() => parseFyiCharacterDatasetCli(["--candidate-k19", "--candidate-dir", "../candidate-k19"]), /not allowed/);
        throws(() => parseFyiCharacterDatasetCli(["--candidate-k19", "--k15-dir", "C:\\compact"]), /not allowed/);
        throws(() => parseFyiCharacterDatasetCli(["--candidate-k19", "--candidate-k19"]), /exactly one/);
    });

    it("rejects malicious portrait filenames before localization or mirroring", () => {
        const unsafe = character("1", {
            portraitFilename: "../latest/portrait_1",
            portraitSpec: { iconId: 1, frameColorId: 1, rarity: Rarities.UR, elementCode: "11" },
        });
        throws(() => localizeCharacterPortraitUrls([unsafe]), /canonical/);
        throws(() => collectFyiPortraitTargets([unsafe]), /canonical/);
    });

    it("rejects candidate path traversal and absolute/UNC forms", async () => {
        await mkdir(join(temporaryDirectory, "root"));
        for (const value of ["../candidate-k19", join(temporaryDirectory, "candidate-k19"), "\\\\server\\candidate-k19"]) {
            await rejects(resolveFyiCandidateDirectory(join(temporaryDirectory, "root"), value, true));
        }
    });

    it("commits only the fixed candidate inventory and never replaces it", async () => {
        const root = join(temporaryDirectory, "root");
        await mkdir(root);
        const files = FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        const output = await writeFyiCharacterCandidateDirectory(root, "candidate-k19", files);
        deepEqual((await readdir(output)).sort(), [...FYI_CHARACTER_CANDIDATE_FILES, FYI_CHARACTER_CANDIDATE_READY_FILE].sort());
        equal((await readFile(join(output, "candidate-k19-report.json"))).toString(), "candidate-k19-report.json");
        await rejects(writeFyiCharacterCandidateDirectory(root, "candidate-k19", files), /already exists/);
    });

    it("allows only one concurrent candidate reservation", async () => {
        const root = join(temporaryDirectory, "root");
        await mkdir(root);
        const files = FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        const attempts = await Promise.allSettled([
            writeFyiCharacterCandidateDirectory(root, "candidate-k19", files),
            writeFyiCharacterCandidateDirectory(root, "candidate-k19", files),
        ]);
        equal(attempts.filter(result => result.status === "fulfilled").length, 1);
        equal(attempts.filter(result => result.status === "rejected").length, 1);
        const output = join(root, "candidate-k19");
        deepEqual((await readdir(output)).sort(), [...FYI_CHARACTER_CANDIDATE_FILES, FYI_CHARACTER_CANDIDATE_READY_FILE].sort());
    });

    it("removes its reserved candidate after nested portrait work fails", async () => {
        const root = join(temporaryDirectory, "root");
        await mkdir(root);
        const files = FYI_CHARACTER_CANDIDATE_FILES.map(name => ({ name, bytes: Buffer.from(name) }));
        await rejects(writeFyiCharacterCandidateDirectory(root, "candidate-k19", files, async destination => {
            await mkdir(join(destination, "images", "v2"), { recursive: true });
            throw new Error("portrait failure");
        }), /portrait failure/);
        await rejects(readFile(join(root, "candidate-k19", FYI_CHARACTER_CANDIDATE_READY_FILE)), /ENOENT/);
    });

    it("rejects an escaping candidate directory junction", async () => {
        const root = join(temporaryDirectory, "root");
        const outside = join(temporaryDirectory, "outside");
        await mkdir(root);
        await mkdir(outside);
        await symlink(outside, join(root, "candidate-k19"), "junction");
        await rejects(resolveFyiCandidateDirectory(root, "candidate-k19", false), /rejected/);
    });
});
