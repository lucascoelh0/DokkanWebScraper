import { deepEqual, equal, rejects } from "assert";
import { describe, it } from "mocha";
import sharp = require("sharp");
import { renderEquipmentLevelAsset } from "./game-db-equipment-ui-assets";

describe("official equipment level asset compositor", () => {
    async function fixtures() {
        const dual = await sharp({ create: { width: 81, height: 62, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const single = await sharp({ create: { width: 80, height: 45, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const renderNumber = async (_font: string, _value: number, node: { width: number, height: number }) =>
            sharp({ create: { width: node.width, height: node.height, channels: 4, background: "orange" } }).png().toBuffer();
        return { font: "unused.otf", single, dual, renderNumber };
    }

    it("renders native simple and dual layouts deterministically", async () => {
        const { font, single, dual, renderNumber } = await fixtures();
        const simpleA = await renderEquipmentLevelAsset(font, single, dual, [7], renderNumber);
        const simpleB = await renderEquipmentLevelAsset(font, single, dual, [7], renderNumber);
        deepEqual(simpleA, simpleB);
        equal((await sharp(simpleA).metadata()).width, 132);
        equal((await sharp(simpleA).metadata()).height, 58);
        const dualA = await renderEquipmentLevelAsset(font, single, dual, [7, 3], renderNumber);
        const dualB = await renderEquipmentLevelAsset(font, single, dual, [7, 3], renderNumber);
        deepEqual(dualA, dualB);
        equal((await sharp(dualA).metadata()).width, 124);
        equal((await sharp(dualA).metadata()).height, 84);
    });

    it("uses the native two-digit nodes and fails closed outside their range", async () => {
        const { font, single, dual, renderNumber } = await fixtures();
        equal((await sharp(await renderEquipmentLevelAsset(font, single, dual, [10, 11], renderNumber)).metadata()).width, 124);
        await rejects(() => renderEquipmentLevelAsset(font, single, dual, [100, 3], renderNumber), /cannot represent/);
        await rejects(() => renderEquipmentLevelAsset(font, single, dual, [7, 3, 1], renderNumber), /cannot represent/);
    });

    it("fails closed when an official base asset has drifted dimensions", async () => {
        const { font, dual, renderNumber } = await fixtures();
        const wrongSingle = await sharp({ create: { width: 79, height: 45, channels: 4, background: "transparent" } }).png().toBuffer();
        await rejects(() => renderEquipmentLevelAsset(font, wrongSingle, dual, [7], renderNumber), /expected 80x45/);
    });
});
