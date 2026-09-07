"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAwakeningRoutePortraitAssets = exports.probeOfficialDevice = exports.buildHistoricalCaptureIndex = exports.deriveAwakeningRouteFallbackScope = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const PACKAGE_NAME = "com.bandainamcogames.dbzdokkanww";
const ASSET_ROOT = `/data/user/0/${PACKAGE_NAME}/files/assets`;
const CPK_READER_COMMIT = "169b001c748dfffc28c9fc14fcec269dd45e6eec";
const CPK_EXTRACTOR_SHA256 = "aa3bc37266de5fb0c169b3c217b00fc9dcf5300ccbcb73328a77969dc0d3e898";
const CPK_READER_BINARY_SHA256 = "fd917ef4cb67681fd30e6e12e1119b93a0b239d5e75b5b2c36b9c5e8c6524c94";
const CPK_DEFINITIONS_BINARY_SHA256 = "c3420ba142d182c65c5feb78a586351fbe8f9fcd62778060d2099879c39d7cad";
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function contained(root, ...parts) {
    const canonicalRoot = (0, path_1.resolve)(root);
    const target = (0, path_1.resolve)(canonicalRoot, ...parts);
    const child = (0, path_1.relative)(canonicalRoot, target);
    if (!child || child === ".." || child.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(child)) {
        throw new Error("Awakening Route portrait asset path escaped its root");
    }
    return target;
}
function assertId(value, label) {
    const id = String(value ?? "");
    if (!/^\d+$/.test(id))
        throw new Error(`${label} is not a decimal ID`);
    return id;
}
function flattenCharacters(characters) {
    return characters.flatMap(character => [character, ...(character.transformations ?? [])]);
}
function deriveAwakeningRouteFallbackScope(routeCards, characters) {
    const characterIds = new Set(flattenCharacters(characters).map(character => assertId(character.id, "Character ID")));
    const fallbackFormsByThumbId = new Map();
    let resolved = 0;
    const seenCardIds = new Set();
    for (const card of routeCards) {
        const cardId = assertId(card.id, "Awakening Route card ID");
        if (seenCardIds.has(cardId))
            throw new Error(`Duplicate Awakening Route card ${cardId}`);
        seenCardIds.add(cardId);
        if (characterIds.has(cardId)) {
            resolved += 1;
            continue;
        }
        const iconId = assertId(card.portraitSpec?.iconId, `Awakening Route card ${cardId} icon ID`);
        if (!iconId.endsWith("0"))
            throw new Error(`Awakening Route card ${cardId} has an unnormalized icon ID`);
        fallbackFormsByThumbId.set(iconId, (fallbackFormsByThumbId.get(iconId) ?? 0) + 1);
    }
    return {
        routeFormCount: routeCards.length,
        charactersResolvedFormCount: resolved,
        fallbackFormCount: routeCards.length - resolved,
        requiredThumbIds: [...fallbackFormsByThumbId.keys()].sort((left, right) => Number(left) - Number(right)),
        fallbackFormsByThumbId,
    };
}
exports.deriveAwakeningRouteFallbackScope = deriveAwakeningRouteFallbackScope;
function buildHistoricalCaptureIndex(report, captureCharacters, captureRoot) {
    const installed = report.source?.installedGame;
    if (installed?.contract !== "dokkan-official-installed-portrait-source"
        || installed.packageName !== PACKAGE_NAME
        || installed.cpkReader?.commit !== CPK_READER_COMMIT) {
        throw new Error("Historical portrait capture does not have the pinned official provenance");
    }
    const cpkIds = new Set(report.source.cpkInventory.entries.map(entry => /^thumbs\/card_(\d+)_thumb\.cpk$/.exec(entry.path)?.[1]).filter((id) => Boolean(id)));
    const extractedIds = new Set(report.source.extractedLayerInventory.entries.map(entry => /^thumb\/card_(\d+)_thumb\.png$/.exec(entry.path)?.[1]).filter((id) => Boolean(id)));
    const layerByObjectKey = new Map(report.portraitLayers.entries
        .filter(entry => entry.kind === "thumb")
        .map(entry => [entry.objectKey, entry]));
    const result = new Map();
    for (const character of flattenCharacters(captureCharacters)) {
        const iconId = character.portraitSpec?.iconId == null ? undefined : assertId(character.portraitSpec.iconId, "Capture icon ID");
        const objectKey = character.portraitLayers?.thumbURL;
        if (!iconId || !objectKey)
            continue;
        if (!cpkIds.has(iconId) || !extractedIds.has(iconId)) {
            throw new Error(`Historical thumb ${iconId} is not backed by the captured CPK inventories`);
        }
        const layer = layerByObjectKey.get(objectKey);
        if (!layer || !/^staging\/v2\/images\/v5\/layers\/thumb\.[a-f0-9]{64}\.png$/.test(objectKey)) {
            throw new Error(`Historical thumb ${iconId} has no audited derived layer`);
        }
        const previous = result.get(iconId);
        if (previous && previous.sha256 !== layer.sha256)
            throw new Error(`Historical thumb ${iconId} is ambiguous`);
        result.set(iconId, {
            iconId,
            localPath: contained(captureRoot, ...layer.localPath.split("/")),
            sizeBytes: layer.sizeBytes,
            sha256: layer.sha256,
        });
    }
    return result;
}
exports.buildHistoricalCaptureIndex = buildHistoricalCaptureIndex;
function run(executable, args, maxBuffer = 16 * 1024 * 1024) {
    const result = (0, child_process_1.spawnSync)(executable, args, { encoding: "utf8", maxBuffer });
    if (result.error)
        throw result.error;
    return { status: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
function probeOfficialDevice(adbPath, serial) {
    if (!serial.trim())
        throw new Error("An explicit ADB serial is required");
    const devices = run(adbPath, ["devices", "-l"]);
    if (devices.status !== 0 || !devices.stdout.split(/\r?\n/).some(line => {
        const [listedSerial, state] = line.trim().split(/\s+/, 2);
        return listedSerial === serial && state === "device";
    })) {
        throw new Error(`ADB serial ${serial} is not a connected device`);
    }
    const shell = (...args) => run(adbPath, ["-s", serial, "shell", ...args]);
    const packageInfo = shell("dumpsys", "package", PACKAGE_NAME);
    const versionName = /^\s*versionName=(\S+)/m.exec(packageInfo.stdout)?.[1];
    const versionCode = /^\s*versionCode=(\d+)/m.exec(packageInfo.stdout)?.[1];
    if (packageInfo.status !== 0 || !versionName || !versionCode) {
        throw new Error(`Official Global package ${PACKAGE_NAME} is not installed on ${serial}`);
    }
    const packagePathResult = shell("pm", "path", PACKAGE_NAME);
    const apkPath = /^package:(\S+)/m.exec(packagePathResult.stdout)?.[1];
    let baseApk;
    if (apkPath) {
        const sizeResult = shell("stat", "-c", "%s", apkPath);
        const hashResult = shell("sha256sum", apkPath);
        const sizeBytes = Number(sizeResult.stdout.trim());
        const apkSha256 = /^([a-f0-9]{64})\s/.exec(hashResult.stdout)?.[1];
        if (sizeResult.status === 0 && hashResult.status === 0 && Number.isSafeInteger(sizeBytes) && apkSha256) {
            baseApk = { path: apkPath, sizeBytes, sha256: apkSha256 };
        }
    }
    const access = shell("ls", "-ld", `${ASSET_ROOT}/character/thumb`);
    const readable = access.status === 0;
    return {
        serial,
        packageName: PACKAGE_NAME,
        versionName,
        versionCode,
        ...(baseApk ? { baseApk } : {}),
        assetRoot: ASSET_ROOT,
        readable,
        ...(!readable ? { blockedReason: `${access.stderr || access.stdout}`.trim() || "asset root is not readable" } : {}),
    };
}
exports.probeOfficialDevice = probeOfficialDevice;
async function readJsonPayload(path) {
    const bytes = await (0, promises_1.readFile)(path);
    return JSON.parse((path.endsWith(".gz") ? (0, zlib_1.gunzipSync)(bytes) : bytes).toString("utf8"));
}
function inventoryDigest(entries) {
    return sha256(Buffer.from(entries.map(entry => `${entry.path}\0${entry.sizeBytes}\0${entry.sha256}`).join("\n"), "utf8"));
}
async function validateExtractor(path) {
    const directory = (0, path_1.dirname)(path);
    const [extractor, reader, definitions] = await Promise.all([
        (0, promises_1.readFile)(path),
        (0, promises_1.readFile)((0, path_1.resolve)(directory, "CriFsV2Lib.dll")),
        (0, promises_1.readFile)((0, path_1.resolve)(directory, "CriFsV2Lib.Definitions.dll")),
    ]);
    if (sha256(extractor) !== CPK_EXTRACTOR_SHA256
        || sha256(reader) !== CPK_READER_BINARY_SHA256
        || sha256(definitions) !== CPK_DEFINITIONS_BINARY_SHA256) {
        throw new Error("CPK extractor does not match the pinned CriFsV2Lib toolchain");
    }
}
async function acquireDeviceThumbs(options) {
    if (!options.probe.readable)
        return { entries: [], absentIds: [] };
    await validateExtractor(options.extractorPath);
    const entries = [];
    const absentIds = [];
    for (const iconId of options.iconIds) {
        const archiveName = `card_${iconId}_thumb.cpk`;
        const archivePath = contained(options.outputDir, ".source", "archives", archiveName);
        await (0, promises_1.mkdir)((0, path_1.dirname)(archivePath), { recursive: true });
        const pull = run(options.adbPath, [
            "-s", options.probe.serial, "pull",
            `${ASSET_ROOT}/character/thumb/${archiveName}`,
            archivePath,
        ]);
        if (pull.status !== 0) {
            const message = `${pull.stdout}\n${pull.stderr}`;
            if (/No such file or directory/i.test(message)) {
                absentIds.push(iconId);
                continue;
            }
            throw new Error(`ADB could not pull official thumb ${iconId}: ${message.trim()}`);
        }
        const archive = await (0, promises_1.readFile)(archivePath);
        if (archive.byteLength < 16 || archive.subarray(0, 4).toString("ascii") !== "CPK ") {
            throw new Error(`Official thumb archive ${iconId} is not a CPK`);
        }
        const extractedRoot = contained(options.outputDir, ".source", "extracted", iconId);
        const extractor = options.extractorPath.toLowerCase().endsWith(".dll")
            ? run("dotnet", [options.extractorPath, archivePath, extractedRoot])
            : run(options.extractorPath, [archivePath, extractedRoot]);
        if (extractor.status !== 0) {
            throw new Error(`Pinned CPK extractor failed for thumb ${iconId}: ${extractor.stderr.trim()}`);
        }
        const extractedPath = contained(extractedRoot, `card_${iconId}_thumb.png`);
        const bytes = await (0, promises_1.readFile)(extractedPath);
        if (bytes.byteLength < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            throw new Error(`Official thumb ${iconId} did not extract to a PNG`);
        }
        const path = `character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`;
        const destination = contained(options.outputDir, ...path.split("/"));
        await (0, promises_1.mkdir)((0, path_1.dirname)(destination), { recursive: true });
        await (0, promises_1.copyFile)(extractedPath, destination, 1);
        entries.push({ path, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
    }
    return { entries, absentIds };
}
async function requireMissing(path) {
    try {
        await (0, promises_1.stat)(path);
        throw new Error(`Awakening Route portrait output already exists: ${path}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
async function buildAwakeningRoutePortraitAssets(options) {
    await requireMissing(options.outputDir);
    const [awakeningBytes, awakening, characters, captureReportBytes, captureReport, captureCharacters] = await Promise.all([
        (0, promises_1.readFile)(options.awakeningPayloadPath),
        readJsonPayload(options.awakeningPayloadPath),
        readJsonPayload(options.charactersPayloadPath),
        (0, promises_1.readFile)(options.captureReportPath),
        readJsonPayload(options.captureReportPath),
        readJsonPayload(options.captureCharactersPayloadPath),
    ]);
    if (awakening.sourceSnapshotVersion !== options.sourceSnapshotVersion
        || awakening.sourceDatabaseSha256 !== options.sourceDatabaseSha256) {
        throw new Error("Awakening Route payload does not match the requested first-party snapshot");
    }
    const routeCards = awakening.routeGraph?.cards;
    if (!Array.isArray(routeCards) || !Array.isArray(characters) || !Array.isArray(captureCharacters)) {
        throw new Error("Awakening Route or Character input has an invalid shape");
    }
    const scope = deriveAwakeningRouteFallbackScope(routeCards, characters);
    const historical = buildHistoricalCaptureIndex(captureReport, captureCharacters, options.captureRoot);
    const historicalIds = scope.requiredThumbIds.filter(id => historical.has(id));
    const deviceCandidateIds = scope.requiredThumbIds.filter(id => !historical.has(id));
    await (0, promises_1.mkdir)(options.outputDir, { recursive: false });
    await (0, promises_1.writeFile)(contained(options.outputDir, ".gitignore"), "*\n", { flag: "wx" });
    const inventory = [];
    for (const iconId of historicalIds) {
        const source = historical.get(iconId);
        const bytes = await (0, promises_1.readFile)(source.localPath);
        if (bytes.byteLength !== source.sizeBytes || sha256(bytes) !== source.sha256) {
            throw new Error(`Historical official thumb layer ${iconId} failed size/SHA-256 validation`);
        }
        const path = `character/thumb/card_${iconId}_thumb/card_${iconId}_thumb.png`;
        const destination = contained(options.outputDir, ...path.split("/"));
        await (0, promises_1.mkdir)((0, path_1.dirname)(destination), { recursive: true });
        await (0, promises_1.copyFile)(source.localPath, destination, 1);
        inventory.push({ path, sizeBytes: bytes.byteLength, sha256: source.sha256 });
    }
    let deviceEntries = [];
    let deviceAbsentIds = [];
    if (options.deviceProbe?.readable) {
        if (!options.adbPath || !options.cpkExtractorPath) {
            throw new Error("A readable official asset root requires explicit ADB and pinned CPK extractor paths");
        }
        const acquired = await acquireDeviceThumbs({
            adbPath: options.adbPath,
            probe: options.deviceProbe,
            extractorPath: options.cpkExtractorPath,
            iconIds: deviceCandidateIds,
            outputDir: options.outputDir,
        });
        deviceEntries = acquired.entries;
        deviceAbsentIds = acquired.absentIds;
        inventory.push(...deviceEntries);
    }
    inventory.sort((left, right) => left.path.localeCompare(right.path));
    const deviceIds = new Set(deviceEntries.map(entry => /card_(\d+)_thumb/.exec(entry.path)[1]));
    const foundIds = scope.requiredThumbIds.filter(id => historical.has(id) || deviceIds.has(id));
    const missingIds = scope.requiredThumbIds.filter(id => !historical.has(id) && !deviceIds.has(id));
    const fallbackFormsCovered = foundIds.reduce((sum, id) => sum + (scope.fallbackFormsByThumbId.get(id) ?? 0), 0);
    const installed = captureReport.source.installedGame;
    const report = {
        schemaVersion: 1,
        contract: "dokkan-awakening-route-portrait-assets",
        contractVersion: "1.0.0",
        status: !missingIds.length
            ? "complete"
            : options.deviceProbe?.readable && deviceAbsentIds.length === missingIds.length
                ? "incomplete-source-missing"
                : "incomplete-source-inaccessible",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        counts: {
            routeForms: scope.routeFormCount,
            charactersResolvedForms: scope.charactersResolvedFormCount,
            fallbackForms: scope.fallbackFormCount,
            requiredThumbIds: scope.requiredThumbIds.length,
            foundThumbIds: foundIds.length,
            extractedThumbIds: inventory.length,
            missingThumbIds: missingIds.length,
            fallbackFormsCovered,
            fallbackFormsMissing: scope.fallbackFormCount - fallbackFormsCovered,
        },
        requiredThumbIds: scope.requiredThumbIds,
        foundThumbIds: foundIds,
        missingThumbIds: missingIds,
        source: {
            historicalCapture: {
                reportSha256: sha256(captureReportBytes),
                packageName: installed.packageName,
                versionName: installed.packageVersionName,
                versionCode: installed.packageVersionCode,
                assetArchive: installed.assetArchive,
                cpkReader: installed.cpkReader,
            },
            ...(options.deviceProbe ? { currentDevice: options.deviceProbe } : {}),
        },
        inventory: {
            fileCount: inventory.length,
            totalBytes: inventory.reduce((sum, entry) => sum + entry.sizeBytes, 0),
            sha256: inventoryDigest(inventory),
            entries: inventory,
        },
    };
    await (0, promises_1.writeFile)(contained(options.outputDir, "awakening-route-portrait-assets-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    await (0, promises_1.writeFile)(contained(options.outputDir, "awakening-route-payload.sha256"), `${sha256(awakeningBytes)}  ${(0, path_1.basename)(options.awakeningPayloadPath)}\n`, { flag: "wx" });
    return report;
}
exports.buildAwakeningRoutePortraitAssets = buildAwakeningRoutePortraitAssets;
function parseArgs(args) {
    const values = {};
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token.startsWith("--"))
            throw new Error(`Unexpected argument ${token}`);
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(2, separator) : token.slice(2);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values[key])
            throw new Error(`Missing or duplicate --${key}`);
        values[key] = value;
    }
    return values;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const required = ["awakening-payload", "characters-payload", "capture-report", "capture-characters-payload", "capture-root", "output-dir", "source-snapshot-version", "source-database-sha256"];
    for (const key of required)
        if (!args[key])
            throw new Error(`Missing --${key}`);
    const deviceProbe = args["device-serial"]
        ? probeOfficialDevice(args["adb-path"] ?? "adb", args["device-serial"])
        : undefined;
    const report = await buildAwakeningRoutePortraitAssets({
        awakeningPayloadPath: (0, path_1.resolve)(args["awakening-payload"]),
        charactersPayloadPath: (0, path_1.resolve)(args["characters-payload"]),
        captureReportPath: (0, path_1.resolve)(args["capture-report"]),
        captureCharactersPayloadPath: (0, path_1.resolve)(args["capture-characters-payload"]),
        captureRoot: (0, path_1.resolve)(args["capture-root"]),
        outputDir: (0, path_1.resolve)(args["output-dir"]),
        sourceSnapshotVersion: args["source-snapshot-version"],
        sourceDatabaseSha256: args["source-database-sha256"],
        ...(deviceProbe ? { deviceProbe } : {}),
        ...(args["adb-path"] ? { adbPath: args["adb-path"] } : { adbPath: "adb" }),
        ...(args["cpk-extractor"] ? { cpkExtractorPath: (0, path_1.resolve)(args["cpk-extractor"]) } : {}),
    });
    console.log(JSON.stringify({ outputDir: (0, path_1.resolve)(args["output-dir"]), status: report.status, counts: report.counts }, null, 2));
    if (report.status !== "complete")
        process.exitCode = 2;
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=awakening-route-portrait-assets.js.map