import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    buildWallpaperDataset,
    mapWallpaperFromFyi,
    mapWallpaperScheduleFromFyi,
} from "./fyi-wallpapers";

describe("mapWallpaperScheduleFromFyi", function () {
    it("maps wallpaper availability windows into ISO timestamps", () => {
        const schedule = mapWallpaperScheduleFromFyi({
            id: 4,
            starts_at: "2026-04-01T00:00:00.000000Z",
            ends_at: "2026-04-10T14:59:59.000000Z",
        } as any);

        equal(schedule.id, "4");
        equal(schedule.startsAt, "2026-04-01T00:00:00.000Z");
        equal(schedule.endsAt, "2026-04-10T14:59:59.000Z");
    });
});

describe("mapWallpaperFromFyi", function () {
    it("maps wallpaper descriptions and schedules", () => {
        const wallpaper = mapWallpaperFromFyi({
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
        } as any);

        equal(wallpaper.id, "86");
        equal(wallpaper.name, "Saibaiman Outbreak");
        equal(wallpaper.schedules.length, 1);
    });
});

describe("buildWallpaperDataset", function () {
    it("sorts wallpapers and wraps them with dataset metadata", () => {
        const dataset = buildWallpaperDataset([
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

        equal(dataset.count, 2);
        deepEqual(dataset.wallpapers.map(wallpaper => wallpaper.name), ["A Wallpaper", "B Wallpaper"]);
    });
});
