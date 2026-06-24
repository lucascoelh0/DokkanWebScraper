"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const publish_r2_1 = require("./publish-r2");
(0, mocha_1.describe)("collectReferencedPortraitKeys", function () {
    (0, mocha_1.it)("collects unique portrait keys from base cards, transformations and awakening references", () => {
        const portraitKeys = (0, publish_r2_1.collectReferencedPortraitKeys)([
            {
                portraitURL: "images/portrait_100.png",
                transformations: [
                    { portraitURL: "images/portrait_101.png" },
                    { portraitURL: "images/portrait_101.png" },
                ],
                awakeningCards: [
                    { portraitURL: "images/portrait_102.png" },
                ],
                previousAwakenings: [
                    { portraitURL: "/images/portrait_103.png" },
                ],
                nextAwakenings: [
                    { portraitURL: ".\\images\\portrait_104.png" },
                ],
            },
        ]);
        (0, assert_1.deepEqual)(portraitKeys, [
            "images/portrait_100.png",
            "images/portrait_101.png",
            "images/portrait_102.png",
            "images/portrait_103.png",
            "images/portrait_104.png",
        ]);
    });
});
(0, mocha_1.describe)("buildPortraitPublishPlan", function () {
    (0, mocha_1.it)("uploads only new or changed portraits and deletes removed ones", () => {
        const currentPortraits = [
            {
                objectKey: "images/portrait_100.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
                sha256: "same-hash",
            },
            {
                objectKey: "images/portrait_101.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
                sha256: "new-hash",
            },
        ];
        const previousState = {
            schemaVersion: 1,
            bucket: "dokkanpanion-data",
            target: "remote",
            datasetVersion: "2026-06-24T00:00:00.000Z",
            manifestSha256: "manifest-hash",
            publishedAt: "2026-06-24T00:00:00.000Z",
            portraits: {
                "images/portrait_100.png": "same-hash",
                "images/portrait_101.png": "old-hash",
                "images/portrait_099.png": "removed-hash",
            },
        };
        const plan = (0, publish_r2_1.buildPortraitPublishPlan)(currentPortraits, previousState);
        (0, assert_1.deepEqual)(plan.toUpload.map(entry => entry.objectKey), ["images/portrait_101.png"]);
        (0, assert_1.deepEqual)(plan.toDelete, ["images/portrait_099.png"]);
    });
    (0, mocha_1.it)("forces all current portraits when requested", () => {
        const currentPortraits = [
            {
                objectKey: "images/portrait_100.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
                sha256: "same-hash",
            },
            {
                objectKey: "images/portrait_101.png",
                filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
                sha256: "new-hash",
            },
        ];
        const previousState = {
            schemaVersion: 1,
            bucket: "dokkanpanion-data",
            target: "remote",
            datasetVersion: "2026-06-24T00:00:00.000Z",
            manifestSha256: "manifest-hash",
            publishedAt: "2026-06-24T00:00:00.000Z",
            portraits: {
                "images/portrait_100.png": "same-hash",
                "images/portrait_101.png": "new-hash",
            },
        };
        const plan = (0, publish_r2_1.buildPortraitPublishPlan)(currentPortraits, previousState, { forcePortraits: true });
        (0, assert_1.equal)(plan.toUpload.length, 2);
        (0, assert_1.deepEqual)(plan.toDelete, []);
    });
});
//# sourceMappingURL=publish-r2.spec.js.map