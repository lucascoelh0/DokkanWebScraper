import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { relative, resolve } from "path";
import { Wt5SourceLock, Wt5Sources, Wt5SqliteEvidence } from "./wt5-contract";

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

function safeFile(root: string, path: string): string {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(path) || path.includes("..") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) throw new Error("WT5 unsafe source path");
    const rootReal = realpathSync(root), candidate = resolve(rootReal, path), inside = relative(rootReal, candidate);
    if (!inside || inside.startsWith("..") || resolve(rootReal, inside) !== candidate) throw new Error("WT5 source escaped root");
    let cursor = rootReal;
    for (const part of inside.split(/[\\/]/)) {
        cursor = resolve(cursor, part);
        if (lstatSync(cursor).isSymbolicLink()) throw new Error("WT5 source path contains link");
    }
    return candidate;
}

function validateArtifact(files: Map<string, any>, lock: Wt5SourceLock, key: "e1" | "e5" | "e9" | "s2" | "s7", contract: string, version: string): void {
    const payload = files.get(`${key}_payload`), manifest = files.get(`${key}_manifest`), validation = files.get(`${key}_validation`);
    const payloadLock = lock.files.find(value => value.key === `${key}_payload`), validationLock = lock.files.find(value => value.key === `${key}_validation`);
    if (!payloadLock || !validationLock || payload?.contract !== contract || payload?.contractVersion !== version || validation?.valid !== true || manifest?.contractVersion !== version || manifest?.fileName !== payloadLock.path.split("/").at(-1) || manifest?.sizeBytes !== payloadLock.sizeBytes || manifest?.sha256 !== payloadLock.sha256 || manifest?.validation?.fileName !== validationLock.path.split("/").at(-1) || manifest?.validation?.sizeBytes !== validationLock.sizeBytes || manifest?.validation?.sha256 !== validationLock.sha256) throw new Error(`WT5 ${key} contract mismatch`);
}

export function loadWt5Sources(roots: Record<"main" | "capture" | "database", string>, lock: Wt5SourceLock): Wt5Sources {
    const expected = ["e1_manifest","e1_payload","e1_validation","e5_manifest","e5_payload","e5_validation","e9_manifest","e9_payload","e9_validation","h11_payload","h11_source_lock","h11_validation","h12_payload","h12_source_lock","h12_validation","h13_payload","h13_validation","h3_payload","h3_validation","h7_payload","h7_source_lock","h7_validation","s2_manifest","s2_payload","s2_validation","s7_manifest","s7_payload","s7_validation"].sort();
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-world-tournament-shadow-source-lock" || lock.contractVersion !== "0.6.0" || JSON.stringify(lock.files.map(value => value.key).sort()) !== JSON.stringify(expected)) throw new Error("WT5 source lock mismatch");
    const files = new Map<string, any>(), lineage: Wt5Sources["lineage"] = [];
    for (const item of lock.files) {
        if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error("WT5 source lock identity invalid");
        const path = safeFile(roots[item.root], item.path), before = statSync(path);
        if (!before.isFile() || before.size !== item.sizeBytes) throw new Error(`WT5 size mismatch ${item.key}`);
        const bytes = readFileSync(path), after = statSync(path);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || sha256(bytes) !== item.sha256) throw new Error(`WT5 hash or stability mismatch ${item.key}`);
        files.set(item.key, JSON.parse(bytes.toString("utf8")));
        lineage.push({ key: item.key, sourceKind: "validated_artifact", contractVersion: String(files.get(item.key)?.contractVersion ?? "validation"), sizeBytes: item.sizeBytes, sha256: item.sha256 });
    }
    validateArtifact(files, lock, "e1", "dokkan-events-database-first-catalog", "0.2.0");
    validateArtifact(files, lock, "e5", "dokkan-events-database-first-rewards", "0.6.0");
    validateArtifact(files, lock, "e9", "dokkan-events-database-first-readiness", "1.0.0");
    validateArtifact(files, lock, "s2", "dokkan-server-root-resolution", "0.3.0");
    validateArtifact(files, lock, "s7", "dokkan-server-readiness", "0.8.0");
    if (files.get("e1_payload")?.sourceDatabaseSha256 !== lock.database.sha256 || files.get("e5_payload")?.sourceDatabaseSha256 !== lock.database.sha256 || files.get("e9_payload")?.sourceDatabaseSha256 !== lock.database.sha256 || files.get("e5_payload")?.sourceE1?.sha256 !== lock.files.find(value => value.key === "e1_payload")?.sha256) throw new Error("WT5 database/E lineage mismatch");
    if (files.get("h3_payload")?.contract !== "dokkan-official-capture-schedules-availability" || files.get("h3_payload")?.contractVersion !== "0.4.0" || files.get("h3_validation")?.valid !== true) throw new Error("WT5 H3 mismatch");
    const h7 = files.get("h7_payload"), h7Lock = files.get("h7_source_lock"), h7Keys = h7?.sourceLineage?.map((value: any) => value.key).sort();
    if (h7?.contract !== "dokkan-official-capture-shadow-readiness" || h7?.contractVersion !== "0.8.0" || files.get("h7_validation")?.valid !== true || h7Lock?.contract !== "dokkan-official-capture-h7-external-source-lock" || h7Lock?.contractVersion !== "1.0.0" || h7?.externalSourceLockSha256 !== lock.files.find(value => value.key === "h7_source_lock")?.sha256 || JSON.stringify(h7Keys) !== JSON.stringify(["e1","e2","e5","e6","e7","e9","h0","h3","h4","h5","h6","s0","s1","s2","s3","s4","s5","s6","s7"])) throw new Error("WT5 H0-H7 closure mismatch");
    const h11 = files.get("h11_payload"), h11Lock = files.get("h11_source_lock"), h11LockKeys = h11Lock?.artifacts?.map((value: any) => value.key).sort(), h11Coverage = new Map((h11?.sourceCoverage ?? []).map((value: any) => [value.series, value.status])), h12Lock = files.get("h12_source_lock"), h12LockKeys = h12Lock?.artifacts?.map((value: any) => value.key).sort();
    if (h11?.contract !== "dokkan-official-capture-extension-shadow-parity" || h11?.contractVersion !== "0.12.1" || files.get("h11_validation")?.valid !== true || h11Lock?.contract !== "dokkan-official-capture-h11-source-lock" || h11Lock?.contractVersion !== "0.12.1" || JSON.stringify(h11LockKeys) !== JSON.stringify(["h10","h13","h7","h8","h9"]) || h11?.sourceLockSha256 !== lock.files.find(value => value.key === "h11_source_lock")?.sha256 || h11Coverage.get("H0-H7") !== "via_h7_pinned_lineage" || h11Coverage.get("H8-H10") !== "direct_pinned" || h12Lock?.contract !== "dokkan-official-capture-h12-source-lock" || h12Lock?.contractVersion !== "0.13.1" || JSON.stringify(h12LockKeys) !== JSON.stringify(["h10","h11","h13","h8","h9"])) throw new Error("WT5 H8-H12 closure mismatch");
    const artifact = (source: any, key: string): any => source.artifacts.find((value: any) => value.key === key), h7LockItem = lock.files.find(value => value.key === "h7_payload")!, h13LockItemForH = lock.files.find(value => value.key === "h13_payload")!;
    if (artifact(h11Lock, "h7")?.sha256 !== h7LockItem.sha256 || artifact(h11Lock, "h7")?.sizeBytes !== h7LockItem.sizeBytes || artifact(h11Lock, "h13")?.sha256 !== h13LockItemForH.sha256 || ["h8","h9","h10","h13"].some(key => JSON.stringify(artifact(h11Lock, key)) !== JSON.stringify(artifact(h12Lock, key)))) throw new Error("WT5 H lock chain mismatch");
    if (files.get("h12_payload")?.contract !== "dokkan-official-capture-extension-readiness" || files.get("h12_payload")?.contractVersion !== "0.13.1" || files.get("h12_validation")?.valid !== true) throw new Error("WT5 H12 mismatch");
    if (files.get("h13_payload")?.contract !== "dokkan-official-capture-gasha-conflict-audit" || files.get("h13_payload")?.contractVersion !== "0.14.0" || files.get("h13_validation")?.valid !== true) throw new Error("WT5 H13 mismatch");
    const h12 = files.get("h12_payload"), h11LockItem = lock.files.find(value => value.key === "h11_payload")!, h13LockItem = lock.files.find(value => value.key === "h13_payload")!;
    if (h12?.sourceLockSha256 !== lock.files.find(value => value.key === "h12_source_lock")?.sha256 || h12?.h11ArtifactSha256 !== h11LockItem.sha256 || h12?.h11ArtifactSizeBytes !== h11LockItem.sizeBytes || h12?.h13ArtifactSha256 !== h13LockItem.sha256 || h12?.h13ArtifactSizeBytes !== h13LockItem.sizeBytes) throw new Error("WT5 H12 pinned lineage mismatch");
    if (JSON.stringify(files.get("e9_payload")?.checkpoint?.gatesComplete) !== JSON.stringify(["E0","E1","E2","E3","E4","E5","E6","E7","E8","E9"])) throw new Error("WT5 E closure mismatch");
    const s7Gates = files.get("s7_payload")?.sourceLineage?.map((value: any) => value.gate);
    if (JSON.stringify(s7Gates) !== JSON.stringify(["s0","s1","s2","s3","s4","s5","s6"])) throw new Error("WT5 S closure mismatch");
    const databaseRoot = realpathSync(roots.database), databasePath = resolve(databaseRoot, lock.database.fileName), inside = relative(databaseRoot, databasePath);
    if (!inside || inside.startsWith("..") || lstatSync(databasePath).isSymbolicLink()) throw new Error("WT5 database path boundary");
    const before = readFileSync(databasePath);
    if (before.length !== lock.database.sizeBytes || sha256(before) !== lock.database.sha256) throw new Error("WT5 database identity mismatch");
    const bridge = resolve(process.cwd(), "database-world-tournament-captures", "wt5-sqlite-readonly-bridge.py");
    const logs = resolve(process.cwd(), ".agent-logs"); mkdirSync(logs, { recursive: true }); const logsReal = realpathSync(logs), snapshotRoot = mkdtempSync(resolve(logsReal, "wt5-sqlite-")), snapshotPath = resolve(snapshotRoot, "pinned.db"); let sqlite: Wt5SqliteEvidence;
    try {
        const snapshotInside = relative(logsReal, snapshotPath); if (!snapshotInside || snapshotInside.startsWith("..")) throw new Error("WT5 private snapshot boundary");
        writeFileSync(snapshotPath, before, { flag: "wx", mode: 0o600 }); const snapshotBefore = readFileSync(snapshotPath);
        if (lstatSync(snapshotPath).isSymbolicLink() || snapshotBefore.length !== lock.database.sizeBytes || sha256(snapshotBefore) !== lock.database.sha256) throw new Error("WT5 private snapshot identity mismatch");
        sqlite = JSON.parse(execFileSync(process.platform === "win32" ? "python" : "python3", [bridge, "--database", snapshotPath], { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 15000, killSignal: "SIGKILL", windowsHide: true })) as Wt5SqliteEvidence;
        const snapshotAfter = readFileSync(snapshotPath), sourceAfter = readFileSync(databasePath);
        if (lstatSync(snapshotPath).isSymbolicLink() || snapshotAfter.length !== snapshotBefore.length || sha256(snapshotAfter) !== lock.database.sha256 || sourceAfter.length !== before.length || sha256(sourceAfter) !== lock.database.sha256) throw new Error("WT5 snapshot/source changed during read");
    } finally {
        const snapshotRootReal = realpathSync(snapshotRoot), cleanupInside = relative(logsReal, snapshotRootReal);
        if (!cleanupInside || cleanupInside.startsWith("..") || resolve(snapshotRootReal, "pinned.db") !== snapshotPath || lstatSync(snapshotPath).isSymbolicLink()) throw new Error("WT5 private snapshot cleanup refused");
        unlinkSync(snapshotPath); rmdirSync(snapshotRootReal);
    }
    if (sqlite!.contract !== "dokkan-world-tournament-sqlite-structural-evidence" || sqlite!.contractVersion !== "0.6.0" || sqlite!.collectionMode !== "private_pinned_snapshot_sqlite_uri_mode_ro_query_only" || sqlite!.identityPolicy !== "numeric_structural_ids_only_no_text_columns") throw new Error("WT5 database read-only receipt mismatch");
    lineage.push({ key: "sqlite", sourceKind: "sqlite_snapshot", contractVersion: sqlite.contractVersion, sizeBytes: lock.database.sizeBytes, sha256: lock.database.sha256 });
    return { files, sqlite, lineage: lineage.sort((left, right) => left.key.localeCompare(right.key)) };
}
