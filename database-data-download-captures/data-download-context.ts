import { readFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { Dd0SourceLock } from "./data-download-contract";
import { buildDd0, loadDdCaptures, loadDdExternalSources } from "./data-download-core";
import { buildDd1 } from "./data-download-dd1";
import { buildDd2 } from "./data-download-dd2";

export const DD_CAPTURE_ROOT = "D:\\Dokkan\\har logs\\08-10";
export function loadDdContext() {
    if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("DD campaign requires a Node heap below 1 GiB");
    const root = resolve(process.cwd()), lock = JSON.parse(readFileSync(resolve(root, "database-data-download-captures/data-download-source-lock.json"), "utf8")) as Dd0SourceLock, loaded = loadDdCaptures(DD_CAPTURE_ROOT, lock), external = loadDdExternalSources(DD_CAPTURE_ROOT, lock), dd0 = buildDd0(lock, loaded, external), dd1 = buildDd1(loaded, lock, dd0), dd2 = buildDd2(loaded, external, lock, dd0, dd1);
    return { root, lock, loaded, external, dd0, dd1, dd2 };
}
