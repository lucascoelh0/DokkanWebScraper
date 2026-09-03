"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const sharp = require("sharp");
const game_db_equipment_ui_assets_1 = require("./game-db-equipment-ui-assets");
(0, mocha_1.describe)("official equipment level asset compositor", () => {
    async function fixtures() {
        const dual = await sharp({ create: { width: 81, height: 62, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const single = await sharp({ create: { width: 80, height: 45, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const renderNumber = async (_font, _value, node) => sharp({ create: { width: node.width, height: node.height, channels: 4, background: "orange" } }).png().toBuffer();
        return { font: "unused.otf", single, dual, renderNumber };
    }
    (0, mocha_1.it)("renders native simple and dual layouts deterministically", async () => {
        const { font, single, dual, renderNumber } = await fixtures();
        const simpleA = await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [7], renderNumber);
        const simpleB = await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [7], renderNumber);
        (0, assert_1.deepEqual)(simpleA, simpleB);
        (0, assert_1.equal)((await sharp(simpleA).metadata()).width, 132);
        (0, assert_1.equal)((await sharp(simpleA).metadata()).height, 58);
        const dualA = await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [7, 3], renderNumber);
        const dualB = await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [7, 3], renderNumber);
        (0, assert_1.deepEqual)(dualA, dualB);
        (0, assert_1.equal)((await sharp(dualA).metadata()).width, 124);
        (0, assert_1.equal)((await sharp(dualA).metadata()).height, 84);
    });
    (0, mocha_1.it)("uses the native two-digit nodes and fails closed outside their range", async () => {
        const { font, single, dual, renderNumber } = await fixtures();
        (0, assert_1.equal)((await sharp(await (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [10, 11], renderNumber)).metadata()).width, 124);
        await (0, assert_1.rejects)(() => (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [100, 3], renderNumber), /cannot represent/);
        await (0, assert_1.rejects)(() => (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, single, dual, [7, 3, 1], renderNumber), /cannot represent/);
    });
    (0, mocha_1.it)("fails closed when an official base asset has drifted dimensions", async () => {
        const { font, dual, renderNumber } = await fixtures();
        const wrongSingle = await sharp({ create: { width: 79, height: 45, channels: 4, background: "transparent" } }).png().toBuffer();
        await (0, assert_1.rejects)(() => (0, game_db_equipment_ui_assets_1.renderEquipmentLevelAsset)(font, wrongSingle, dual, [7], renderNumber), /expected 80x45/);
    });
});
//# sourceMappingURL=game-db-equipment-ui-assets.spec.js.map