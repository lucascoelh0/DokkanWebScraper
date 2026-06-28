"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_wallpapers_1 = require("./fyi-wallpapers");
(0, mocha_1.describe)("mapWallpaperScheduleFromFyi", function () {
    (0, mocha_1.it)("maps wallpaper availability windows into ISO timestamps", () => {
        const schedule = (0, fyi_wallpapers_1.mapWallpaperScheduleFromFyi)({
            id: 4,
            starts_at: "2026-04-01T00:00:00.000000Z",
            ends_at: "2026-04-10T14:59:59.000000Z",
        });
        (0, assert_1.equal)(schedule.id, "4");
        (0, assert_1.equal)(schedule.startsAt, "2026-04-01T00:00:00.000Z");
        (0, assert_1.equal)(schedule.endsAt, "2026-04-10T14:59:59.000Z");
    });
});
(0, mocha_1.describe)("mapWallpaperFromFyi", function () {
    (0, mocha_1.it)("maps wallpaper descriptions and schedules", () => {
        const wallpaper = (0, fyi_wallpapers_1.mapWallpaperFromFyi)({
            id: 86,
            name: "Saibaiman Outbreak",
            description: "Reward for logging in during a campaign.",
            schedules: [
                {
                    id: 4,
                    starts_at: "2026-04-01T00:00:00.000000Z",
                    ends_at: "2026-04-10T14:59:59.000000Z",
                },
            ],
        });
        (0, assert_1.equal)(wallpaper.id, "86");
        (0, assert_1.equal)(wallpaper.name, "Saibaiman Outbreak");
        (0, assert_1.equal)(wallpaper.schedules.length, 1);
    });
});
(0, mocha_1.describe)("buildWallpaperDataset", function () {
    (0, mocha_1.it)("sorts wallpapers and wraps them with dataset metadata", () => {
        const dataset = (0, fyi_wallpapers_1.buildWallpaperDataset)([
            {
                id: "2",
                name: "B Wallpaper",
                description: "",
                schedules: [],
            },
            {
                id: "1",
                name: "A Wallpaper",
                description: "",
                schedules: [],
            },
        ]);
        (0, assert_1.equal)(dataset.count, 2);
        (0, assert_1.deepEqual)(dataset.wallpapers.map(wallpaper => wallpaper.name), ["A Wallpaper", "B Wallpaper"]);
    });
});
//# sourceMappingURL=fyi-wallpapers.spec.js.map