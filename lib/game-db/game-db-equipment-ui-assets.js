"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEquipmentUiAssets = exports.renderEquipmentLevelAsset = exports.renderOfficialLevelNumber = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const sharp = require("sharp");
const format_json_1 = require("../format-json");
const UI_ROOT = "layout/en/image/charamenu/potential";
const FONT_PATH = "fonts/en/black.otf";
const SINGLE_LEVEL_PATH = "layout/en/image/common/label/com_label_lv_02.png";
const DUAL_LEVEL_PATH = `${UI_ROOT}/equ_Lv_two.png`;
const SOURCE_FILES = [
    FONT_PATH,
    SINGLE_LEVEL_PATH,
    DUAL_LEVEL_PATH,
    `${UI_ROOT}/equ_icon_category.png`,
    `${UI_ROOT}/equ_icon_same_chara.png`,
    `${UI_ROOT}/equ_icon_specific_chara.png`,
    `${UI_ROOT}/equ_infinite_icon_bronze.png`,
    `${UI_ROOT}/equ_infinite_icon_silver.png`,
    `${UI_ROOT}/equ_infinite_icon_gold.png`,
    ...["00", "01", "02", "03", "04", "10", "11", "12", "13", "14", "20", "21", "22", "23", "24"]
        .map(code => `layout/en/image/character/cha_type_icon_${code}.png`),
];
// Recovered from LayoutCharactermenuChaItemEquItemIcon in the installed arm64
// client. Coordinates use the native layout's bottom-left origin.
const SINGLE_LAYOUT = {
    canvas: { width: 132, height: 58, x: 26, y: 38 },
    base: { width: 80, height: 45, x: 26, y: 47 },
    number: { width: 57, height: 58, x: 101, y: 38, fontSize: 40, effectiveKerning: 3, shadowX: 2, shadowDown: 2 },
};
const DUAL_LAYOUT = {
    canvas: { width: 124, height: 84, x: 23, y: 36 },
    base: { width: 81, height: 62, x: 31, y: 45 },
    top: {
        oneDigit: { width: 55, height: 51, x: 32, y: 69, fontSize: 38, effectiveKerning: 8, shadowX: 2, shadowDown: 2 },
        twoDigits: { width: 64, height: 46, x: 23, y: 70, fontSize: 30, effectiveKerning: 3, shadowX: 1, shadowDown: 2 },
    },
    bottom: {
        oneDigit: { width: 55, height: 51, x: 90, y: 38, fontSize: 38, effectiveKerning: 8, shadowX: 2, shadowDown: 2 },
        twoDigits: { width: 64, height: 47, x: 83, y: 36, fontSize: 30, effectiveKerning: 3, shadowX: 1, shadowDown: 2 },
    },
};
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function contained(root, path) {
    const target = (0, path_1.resolve)(root, ...path.split("/"));
    if (!target.toLowerCase().startsWith(`${(0, path_1.resolve)(root)}${path_1.sep}`.toLowerCase()))
        throw new Error(`Equipment UI path escapes root: ${path}`);
    return target;
}
function validateLevel(level) {
    if (!Number.isSafeInteger(level) || level < 0 || level > 99)
        throw new Error(`Official equipment level layout cannot represent ${level}`);
}
async function renderTextGlyphs(fontFile, value, node) {
    return sharp({
        text: {
            text: `<span foreground="#ffffff" size="${node.fontSize * 1024}" letter_spacing="${node.effectiveKerning * 1024}">${value}</span>`,
            font: "Helvetica Neue LT W1G 97 Black Condensed",
            fontfile: fontFile,
            rgba: true,
            dpi: 72,
        },
    }).png().toBuffer();
}
async function colorizeGlyphs(mask, width, height, color) {
    return sharp({ create: { width, height, channels: 4, background: color } })
        .composite([{ input: mask, blend: "dest-in" }])
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
}
async function renderOfficialLevelNumber(fontFile, value, node) {
    validateLevel(value);
    const text = String(value);
    const glyphMask = await renderTextGlyphs(fontFile, text, node);
    const metadata = await sharp(glyphMask).metadata();
    if (!metadata.width || !metadata.height)
        throw new Error(`Official equipment level font could not render ${text}`);
    const [outlineGlyphs, fillGlyphs] = await Promise.all([
        colorizeGlyphs(glyphMask, metadata.width, metadata.height, "#000000"),
        colorizeGlyphs(glyphMask, metadata.width, metadata.height, "#e38235"),
    ]);
    const outlineSize = 4;
    const width = metadata.width + outlineSize * 2;
    const height = metadata.height + outlineSize * 2;
    if (width + node.shadowX > node.width || height + node.shadowDown > node.height)
        throw new Error(`Official equipment level ${text} exceeds its native ${node.width}x${node.height} node`);
    const outlineLayers = [];
    for (let y = -outlineSize; y <= outlineSize; y++) {
        for (let x = -outlineSize; x <= outlineSize; x++) {
            if (x * x + y * y > outlineSize * outlineSize)
                continue;
            outlineLayers.push({ input: outlineGlyphs, left: outlineSize + x, top: outlineSize + y });
        }
    }
    const silhouette = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(outlineLayers)
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
    const outlined = await sharp(silhouette)
        .composite([{ input: fillGlyphs, left: outlineSize, top: outlineSize }])
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
    const left = Math.floor((node.width - width) / 2);
    const top = Math.floor((node.height - height) / 2);
    return sharp({ create: { width: node.width, height: node.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
        { input: silhouette, left: left + node.shadowX, top: top + node.shadowDown },
        { input: outlined, left, top },
    ])
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
}
exports.renderOfficialLevelNumber = renderOfficialLevelNumber;
function topInCanvas(canvas, node) {
    return canvas.y + canvas.height - node.y - node.height;
}
async function compositeNativeLayout(canvas, layers) {
    for (const { input, rect } of layers) {
        const metadata = await sharp(input).metadata();
        if (metadata.width !== rect.width || metadata.height !== rect.height) {
            throw new Error(`Official equipment level source has ${metadata.width}x${metadata.height}; expected ${rect.width}x${rect.height}`);
        }
    }
    return sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(layers.map(({ input, rect }) => ({ input, left: rect.x - canvas.x, top: topInCanvas(canvas, rect) })))
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
        .toBuffer();
}
async function renderEquipmentLevelAsset(fontFile, singleBase, dualBase, levels, renderNumber = renderOfficialLevelNumber) {
    levels.forEach(validateLevel);
    if (levels.length === 1) {
        const number = await renderNumber(fontFile, levels[0], SINGLE_LAYOUT.number);
        return compositeNativeLayout(SINGLE_LAYOUT.canvas, [
            { input: singleBase, rect: SINGLE_LAYOUT.base },
            { input: number, rect: SINGLE_LAYOUT.number },
        ]);
    }
    if (levels.length !== 2)
        throw new Error(`Official equipment level layout cannot represent ${levels.join("/")}`);
    const top = String(levels[0]).length === 1 ? DUAL_LAYOUT.top.oneDigit : DUAL_LAYOUT.top.twoDigits;
    const bottom = String(levels[1]).length === 1 ? DUAL_LAYOUT.bottom.oneDigit : DUAL_LAYOUT.bottom.twoDigits;
    // Pango registers fontfile inputs globally; keep the two native Text nodes
    // serial so repeated full-bundle generation cannot race in Fontconfig.
    const first = await renderNumber(fontFile, levels[0], top);
    const second = await renderNumber(fontFile, levels[1], bottom);
    return compositeNativeLayout(DUAL_LAYOUT.canvas, [
        { input: dualBase, rect: DUAL_LAYOUT.base },
        { input: first, rect: top },
        { input: second, rect: bottom },
    ]);
}
exports.renderEquipmentLevelAsset = renderEquipmentLevelAsset;
async function buildEquipmentUiAssets(options) {
    const sourceDir = (0, path_1.resolve)(options.sourceDir);
    const outputDir = (0, path_1.resolve)(options.outputDir);
    try {
        await (0, promises_1.stat)(outputDir);
        throw new Error(`Equipment UI output must not already exist: ${outputDir}`);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const manifest = options.sourceManifest;
    const native = manifest.nativeLevelRenderer;
    if (manifest.schemaVersion !== 2 || manifest.packageName !== "com.bandainamcogames.dbzdokkanww"
        || manifest.databaseSnapshotVersion !== options.dataset.sourceSnapshotVersion
        || !/^\d+$/.test(manifest.assetVersion)
        || manifest.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib"
        || !/^[a-f0-9]{40}$/.test(manifest.cpkReader.commit)
        || native?.logicalFontName !== "OT-PShinGoPr6N-Heavy.otf"
        || native.englishHeavyFontCandidatePath !== FONT_PATH
        || native.fontResolution !== "first-party-supported-inference"
        || native.fillColor !== "#e38235" || native.outlineColor !== "#000000" || native.outlineSize !== 4
        || native.shadowColor !== "#000000" || native.shadowBlur !== 0
        || native.evidenceClientVersionName !== "6.5.5"
        || native.libraryPath !== "lib/arm64-v8a/libcocos2dcpp.so"
        || native.librarySizeBytes !== 78005320
        || native.librarySha256 !== "a1592e635bad24ef270fa3a28383a3032effd5f4709c17dd2acde1f7fd7e38f7"
        || Object.keys(native.getters ?? {}).length !== 7
        || Object.values(native.getters ?? {}).some(address => !/^0x[a-f0-9]+$/.test(address))) {
        throw new Error("Invalid or mismatched official equipment UI source manifest");
    }
    const manifestFiles = new Map(manifest.files.map(file => [file.path, file]));
    for (const archive of manifest.archives) {
        const bytes = await (0, promises_1.readFile)(contained(sourceDir, archive.path));
        if (bytes.byteLength !== archive.sizeBytes || sha256(bytes) !== archive.sha256)
            throw new Error(`Official equipment UI archive drifted: ${archive.path}`);
    }
    const sourceBytes = new Map();
    for (const path of SOURCE_FILES) {
        const expected = manifestFiles.get(path);
        if (!expected)
            throw new Error(`Official equipment UI manifest is missing ${path}`);
        const bytes = await (0, promises_1.readFile)(contained(sourceDir, path));
        if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256)
            throw new Error(`Official equipment UI source drifted: ${path}`);
        sourceBytes.set(path, bytes);
    }
    await (0, promises_1.mkdir)(outputDir, { recursive: false });
    const requested = new Set();
    for (const reward of [
        ...options.dataset.entries.flatMap(stage => [...(stage.bossDrops ?? []), ...(stage.dropPreviews ?? []).flatMap(preview => preview.items)]),
        ...(options.dataset.zBattles ?? []).flatMap(stage => [...(stage.checkpoints ?? []).flatMap(point => point.repeatRewards), ...(stage.firstRewards ?? []).flatMap(point => point.rewards)]),
        ...(options.dataset.eventMissions ?? []).flatMap(mission => mission.rewards),
    ]) {
        const equipment = reward.equipmentSkill;
        if (!equipment)
            continue;
        requested.add(equipment.levelAssetPath);
        if (equipment.infinityAssetPath)
            requested.add(equipment.infinityAssetPath);
        for (const condition of equipment.restriction.conditions) {
            for (const path of condition.presentation.badgeAssetPaths ?? (condition.presentation.badgeAssetPath ? [condition.presentation.badgeAssetPath] : []))
                requested.add(path);
        }
    }
    const assets = [];
    const fontFile = contained(sourceDir, FONT_PATH);
    for (const path of [...requested].sort((left, right) => left.localeCompare(right, "en", { numeric: true }))) {
        const levelMatch = /^derived\/equipment\/levels\/lv-(\d+)(?:-(\d+))?\.png$/.exec(path);
        const sourceFiles = levelMatch ? [FONT_PATH, levelMatch[2] ? DUAL_LEVEL_PATH : SINGLE_LEVEL_PATH] : [path];
        const bytes = levelMatch
            ? await renderEquipmentLevelAsset(fontFile, sourceBytes.get(SINGLE_LEVEL_PATH), sourceBytes.get(DUAL_LEVEL_PATH), [Number(levelMatch[1]), ...(levelMatch[2] ? [Number(levelMatch[2])] : [])])
            : sourceBytes.get(path);
        if (!bytes)
            throw new Error(`Equipment UI request is not backed by the official source: ${path}`);
        const target = contained(outputDir, `game-assets/${path}`);
        await (0, promises_1.mkdir)((0, path_1.dirname)(target), { recursive: true });
        await (0, promises_1.writeFile)(target, bytes, { flag: "wx" });
        assets.push({
            path,
            sourceUrl: levelMatch ? `official-cpk-derived://${path}` : `official-cpk-extract://${path}`,
            sha256: sha256(bytes),
            sizeBytes: bytes.byteLength,
            sourceFiles,
        });
    }
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(outputDir, "equipment-ui-assets-manifest.json"), { schemaVersion: 1, assets, source: manifest });
    return { assets, source: manifest };
}
exports.buildEquipmentUiAssets = buildEquipmentUiAssets;
async function main() {
    const values = new Map();
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 2)
        values.set(args[index], args[index + 1]);
    for (const key of ["--dataset", "--source-dir", "--source-manifest", "--output-dir"])
        if (!values.get(key))
            throw new Error(`Missing ${key}`);
    const dataset = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--dataset")), "utf8"));
    const sourceManifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(values.get("--source-manifest")), "utf8"));
    const result = await buildEquipmentUiAssets({ dataset, sourceDir: values.get("--source-dir"), sourceManifest, outputDir: values.get("--output-dir") });
    console.log(JSON.stringify({ assetCount: result.assets.length, outputDir: (0, path_1.resolve)(values.get("--output-dir")) }, null, 2));
}
if (require.main === module)
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
//# sourceMappingURL=game-db-equipment-ui-assets.js.map