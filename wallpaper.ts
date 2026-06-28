export interface WallpaperDataset {
    generatedAt: string,
    source: string,
    count: number,
    wallpapers: WallpaperEntry[],
}

export interface WallpaperEntry {
    id: string,
    name: string,
    description: string,
    schedules: WallpaperSchedule[],
}

export interface WallpaperSchedule {
    id: string,
    startsAt?: string,
    endsAt?: string,
}
