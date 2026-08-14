import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { FileHandle, lstat, open, realpath } from "fs/promises";
import { join, resolve } from "path";
import { gunzipSync } from "zlib";
import { DatabaseCardRecord } from "../database-experiment/contract";
import { parseNativeRuntimeElf, NativeRuntimeElfInspection } from "../database-experiment/native-runtime-elf-adapter";
import { ReadOnlySqliteAdapter, SqliteInspection } from "../database-experiment/sqlite-readonly-adapter";
import { DatabaseCharacterTaxonomyDataset } from "./taxonomy-contract";
import { CharacterSourceInput, readCharacterSourceInput } from "./source";
import { validateCharacterStructuralK2Manifest, validateCharacterStructuralTaxonomy } from "./structural-sidecar-source";
import {
    CARD_SCOPE_FILES,
    CARD_SCOPE_DB1_LAYOUTS,
    CARD_SCOPE_SOURCE_PIN,
    CARD_SCOPE_TABLE_LAYOUTS,
    CardScopeJoinProof,
    CardScopeSchemaProof,
} from "./card-scope-contract";

interface MemberFingerprint { path: string; metadata: Stats; sha256: string; sizeBytes: number }
interface ByteSnapshot extends MemberFingerprint { bytes: Buffer }

export interface CardScopeInputOptions {
    sqliteRoot: string;
    db1Root: string;
    k2Root: string;
    elfRoot: string;
    nativeEvidenceRoot: string;
}

export interface CardScopeLoadedInputs {
    schemaProof: CardScopeSchemaProof;
    db1: CharacterSourceInput;
    taxonomy: DatabaseCharacterTaxonomyDataset;
    nativeInspection: NativeRuntimeElfInspection;
    nativeSha256: string;
    nativeSizeBytes: number;
    nativeLayoutBytes: Buffer;
    revalidate(): Promise<void>;
}

const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

async function regularRoot(value: string, label: string): Promise<string> {
    const path = resolve(value);
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K34 ${label} root must be a regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K34 ${label} root symlink or junction rejected`);
    return canonical;
}

async function openMember(root: string, fileName: string): Promise<{ path: string; handle: FileHandle; metadata: Stats }> {
    if (!fileName || fileName !== join(fileName) || resolve(root, fileName) !== join(root, fileName)) throw new Error(`K34 invalid fixed member ${fileName}`);
    const path = join(root, fileName);
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error(`K34 ${fileName} must be a single-link regular file`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K34 ${fileName} symlink or junction rejected`);
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened)) throw new Error(`K34 ${fileName} identity changed while opening`);
        return { path, handle, metadata: opened };
    } catch (error) {
        await handle.close();
        throw error;
    }
}

async function hashHandle(handle: FileHandle, sizeBytes: number): Promise<string> {
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let position = 0;
    while (position < sizeBytes) {
        const requested = Math.min(buffer.length, sizeBytes - position);
        const { bytesRead } = await handle.read(buffer, 0, requested, position);
        if (bytesRead <= 0) throw new Error("K34 source member ended before its pinned size");
        digest.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
    }
    if ((await handle.read(buffer, 0, 1, sizeBytes)).bytesRead !== 0) throw new Error("K34 source member exceeded its pinned size");
    return digest.digest("hex");
}

async function finishFingerprint(path: string, handle: FileHandle, before: Stats, sha256: string): Promise<MemberFingerprint> {
    const after = await handle.stat();
    const afterPath = await lstat(path);
    if (!sameFile(before, after) || !sameFile(after, afterPath) || after.size !== before.size || afterPath.size !== before.size
        || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error(`K34 ${path} changed while reading`);
    return { path, metadata: after, sha256, sizeBytes: after.size };
}

async function fingerprintMember(root: string, fileName: string): Promise<MemberFingerprint> {
    const member = await openMember(root, fileName);
    try {
        const sha256 = await hashHandle(member.handle, member.metadata.size);
        return await finishFingerprint(member.path, member.handle, member.metadata, sha256);
    } finally {
        await member.handle.close();
    }
}

async function readMember(root: string, fileName: string, maxBytes: number): Promise<ByteSnapshot> {
    const member = await openMember(root, fileName);
    try {
        if (member.metadata.size > maxBytes) throw new Error(`K34 ${fileName} exceeds its read limit`);
        const bytes = await member.handle.readFile();
        const fingerprint = await finishFingerprint(member.path, member.handle, member.metadata, createHash("sha256").update(bytes).digest("hex"));
        return { ...fingerprint, bytes };
    } finally {
        await member.handle.close();
    }
}

function exact(actual: { sha256: string; sizeBytes: number }, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (actual.sha256 !== expected.sha256 || actual.sizeBytes !== expected.sizeBytes) throw new Error(`K34 ${label} identity drift`);
}

async function unchanged(before: MemberFingerprint, root: string, fileName: string): Promise<void> {
    const after = await fingerprintMember(root, fileName);
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || before.sha256 !== after.sha256 || before.sizeBytes !== after.sizeBytes) {
        throw new Error(`K34 ${fileName} changed during report execution`);
    }
}

export function validateCardScopeSchema(inspection: SqliteInspection): CardScopeSchemaProof {
    if (inspection.tableCount !== CARD_SCOPE_SOURCE_PIN.sqlite.tableCount) throw new Error("K34 SQLite table-count drift");
    const required = Object.entries(CARD_SCOPE_TABLE_LAYOUTS) as Array<[keyof typeof CARD_SCOPE_TABLE_LAYOUTS, readonly string[]]>;
    for (const [table, columns] of required) {
        const matches = inspection.tables.filter(value => value.name === table);
        if (matches.length !== 1 || JSON.stringify(matches[0].columns) !== JSON.stringify(columns)) throw new Error(`K34 SQLite layout drift: ${table}`);
    }
    const cards = inspection.tables.find(value => value.name === "cards")!;
    const categoryRelations = inspection.tables.find(value => value.name === "card_card_categories")!;
    const growth = inspection.tables.find(value => value.name === "optimal_awakening_growths")!;
    return {
        status: "supported",
        tableCount: inspection.tableCount,
        cardsColumns: [...cards.columns],
        categoryRelationColumns: [...categoryRelations.columns],
        optimalAwakeningGrowthColumns: [...growth.columns],
        replacementColumns: { characterClass: [], categories: [], links: [] },
    };
}

async function inspectSqlite(root: string): Promise<{ proof: CardScopeSchemaProof; fingerprint: MemberFingerprint }> {
    const member = await openMember(root, CARD_SCOPE_FILES.sqlite);
    try {
        if (member.metadata.size !== CARD_SCOPE_SOURCE_PIN.sqlite.sizeBytes) throw new Error("K34 SQLite size drift");
        const beforeHash = await hashHandle(member.handle, member.metadata.size);
        exact({ sha256: beforeHash, sizeBytes: member.metadata.size }, CARD_SCOPE_SOURCE_PIN.sqlite, "SQLite");
        const adapter = ReadOnlySqliteAdapter.fromDescriptorBoundHandle(
            CARD_SCOPE_FILES.sqlite,
            member.handle,
            member.metadata.size,
            beforeHash,
            { inputLimitBytes: 112 * 1024 * 1024, stdoutLimitBytes: 2 * 1024 * 1024, stderrLimitBytes: 1024 * 1024, timeoutMs: 120_000 },
        );
        const inspection = await adapter.inspect();
        const afterHash = await hashHandle(member.handle, member.metadata.size);
        if (afterHash !== beforeHash) throw new Error("K34 SQLite changed during schema inspection");
        const fingerprint = await finishFingerprint(member.path, member.handle, member.metadata, afterHash);
        return { proof: validateCardScopeSchema(inspection), fingerprint };
    } finally {
        await member.handle.close();
    }
}

async function loadK2(root: string): Promise<{ taxonomy: DatabaseCharacterTaxonomyDataset; snapshots: MemberFingerprint[] }> {
    const pin = CARD_SCOPE_SOURCE_PIN.k2;
    const values = await Promise.all([
        readMember(root, CARD_SCOPE_FILES.k2Manifest, 4 * 1024),
        readMember(root, CARD_SCOPE_FILES.k2Payload, 1024 * 1024),
        readMember(root, CARD_SCOPE_FILES.k2Coverage, 4 * 1024),
        readMember(root, CARD_SCOPE_FILES.k2Validation, 4 * 1024),
    ]);
    exact(values[0], { sha256: pin.manifestSha256, sizeBytes: pin.manifestSizeBytes }, "K2 manifest");
    exact(values[1], { sha256: pin.payloadSha256, sizeBytes: pin.payloadSizeBytes }, "K2 payload");
    exact(values[2], { sha256: pin.coverageSha256, sizeBytes: pin.coverageSizeBytes }, "K2 coverage");
    exact(values[3], { sha256: pin.validationSha256, sizeBytes: pin.validationSizeBytes }, "K2 validation");
    validateCharacterStructuralK2Manifest(JSON.parse(values[0].bytes.toString("utf8")));
    const coverage = JSON.parse(values[2].bytes.toString("utf8"));
    const validation = JSON.parse(values[3].bytes.toString("utf8"));
    if (coverage?.cardCount !== pin.cardCount || coverage.categoryAssignmentCount !== pin.categoryAssignmentCount
        || coverage.linkAssignmentCount !== pin.linkAssignmentCount || validation?.valid !== true
        || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error("K34 K2 coverage/validation drift");
    const raw = gunzipSync(values[1].bytes);
    if (raw.length !== pin.uncompressedSizeBytes) throw new Error("K34 K2 uncompressed-size drift");
    const taxonomy = JSON.parse(raw.toString("utf8")) as DatabaseCharacterTaxonomyDataset;
    validateCharacterStructuralTaxonomy(taxonomy);
    return { taxonomy, snapshots: values };
}

function scalar(value: unknown): string { return value === null ? "null" : `${typeof value}:${String(value)}`; }
function numeric(left: string, right: string): number { return Number(left) - Number(right); }

export async function buildCardScopeJoinProof(
    taxonomy: DatabaseCharacterTaxonomyDataset,
    cardsInput: AsyncIterable<DatabaseCardRecord>,
): Promise<CardScopeJoinProof> {
    const taxonomyByCard = new Map<string, DatabaseCharacterTaxonomyDataset["cards"][number]>();
    const categoryRows = new Set<string>();
    const categoryIds = new Set(taxonomy.categories.map(value => value.id));
    const linkIds = new Set(taxonomy.links.map(value => value.id));
    if (categoryIds.size !== taxonomy.categories.length) throw new Error("K34 duplicate K2 category dictionary identity");
    if (linkIds.size !== taxonomy.links.length) throw new Error("K34 duplicate K2 link dictionary identity");
    for (const card of taxonomy.cards) {
        if (taxonomyByCard.has(card.cardId)) throw new Error(`K34 duplicate K2 card identity ${card.cardId}`);
        taxonomyByCard.set(card.cardId, card);
        for (const assignment of card.categoryAssignments) {
            if (categoryRows.has(assignment.relationRowId)) throw new Error(`K34 duplicate K2 category relation identity ${assignment.relationRowId}`);
            if (!categoryIds.has(assignment.categoryId)) throw new Error(`K34 missing K2 category dictionary join ${assignment.categoryId}`);
            categoryRows.add(assignment.relationRowId);
        }
        if (new Set(card.links.map(value => value.slot)).size !== card.links.length) throw new Error(`K34 duplicate K2 link slot for card ${card.cardId}`);
        for (const link of card.links) if (!linkIds.has(link.linkSkillId)) throw new Error(`K34 missing K2 link dictionary join ${link.linkSkillId}`);
    }

    const db1Cards = new Set<string>();
    const db1CategoryRows = new Set<string>();
    const stateKeys = new Set<string>();
    const growthRows = new Map<string, string>();
    let categoryAssignmentCount = 0;
    let linkAssignmentCount = 0;
    let growthStateCount = 0;
    const cardColumns = [...CARD_SCOPE_DB1_LAYOUTS.cards];
    const categoryRelationColumns = [...CARD_SCOPE_DB1_LAYOUTS.card_card_categories];
    const categoryColumns = [...CARD_SCOPE_DB1_LAYOUTS.card_categories];
    const linkColumns = [...CARD_SCOPE_DB1_LAYOUTS.link_skills];
    const growthColumns = [...CARD_SCOPE_DB1_LAYOUTS.optimal_awakening_growths];

    for await (const card of cardsInput) {
        if (db1Cards.has(card.cardId)) throw new Error(`K34 duplicate DB1 card identity ${card.cardId}`);
        db1Cards.add(card.cardId);
        const projected = taxonomyByCard.get(card.cardId);
        if (!projected) throw new Error(`K34 missing K2 card join ${card.cardId}`);
        if (card.card?.provenance.table !== "cards" || card.card.provenance.rowId !== card.cardId
            || scalar(card.card.values.id) !== scalar(Number(card.cardId)) && scalar(card.card.values.id) !== scalar(card.cardId)
            || JSON.stringify(card.card.provenance.columns) !== JSON.stringify(cardColumns)) throw new Error(`K34 malformed DB1 card provenance ${card.cardId}`);
        if (scalar(card.characterClass.raw) !== scalar(projected.characterClass.raw) || card.characterClass.value !== projected.characterClass.value
            || projected.characterClass.status !== "supported") throw new Error(`K34 characterClass join mismatch ${card.cardId}`);

        const actualCategories = card.categories.map(item => {
            const relation = item.relation;
            if (relation.provenance.table !== "card_card_categories" || relation.provenance.rowId !== String(relation.values.id)
                || JSON.stringify(relation.provenance.columns) !== JSON.stringify(categoryRelationColumns)
                || scalar(relation.values.card_id) !== scalar(Number(card.cardId)) && scalar(relation.values.card_id) !== scalar(card.cardId)
                || !item.category || item.category.provenance.table !== "card_categories"
                || JSON.stringify(item.category.provenance.columns) !== JSON.stringify(categoryColumns)
                || item.category.provenance.rowId !== String(relation.values.card_category_id)
                || item.category.provenance.rowId !== String(item.category.values.id)) throw new Error(`K34 missing category join ${card.cardId}`);
            if (db1CategoryRows.has(relation.provenance.rowId)) throw new Error(`K34 duplicate DB1 category relation identity ${relation.provenance.rowId}`);
            db1CategoryRows.add(relation.provenance.rowId);
            return { categoryId: String(relation.values.card_category_id), relationRowId: relation.provenance.rowId };
        }).sort((left, right) => numeric(left.relationRowId, right.relationRowId));
        const expectedCategories = projected.categoryAssignments.map(value => ({ categoryId: value.categoryId, relationRowId: value.relationRowId }))
            .sort((left, right) => numeric(left.relationRowId, right.relationRowId));
        if (JSON.stringify(actualCategories) !== JSON.stringify(expectedCategories) || projected.categoryAssignments.some(value => value.status !== "supported")) {
            throw new Error(`K34 category structural join mismatch ${card.cardId}`);
        }
        categoryAssignmentCount += actualCategories.length;

        const seenSlots = new Set<number>();
        const actualLinks = card.links.map(item => {
            if (seenSlots.has(item.slot)) throw new Error(`K34 duplicate DB1 link slot ${card.cardId}:${item.slot}`);
            seenSlots.add(item.slot);
            const linkId = String(card.card.values[`link_skill${item.slot}_id`] ?? "");
            if (!linkId || !item.skill || item.skill.provenance.table !== "link_skills" || item.skill.provenance.rowId !== linkId
                || JSON.stringify(item.skill.provenance.columns) !== JSON.stringify(linkColumns)
                || item.skill.provenance.rowId !== String(item.skill.values.id)) throw new Error(`K34 missing DB1 link join ${card.cardId}:${item.slot}`);
            return { slot: item.slot, linkSkillId: linkId, sourceColumn: `link_skill${item.slot}_id` };
        });
        const expectedLinks = projected.links.map(value => ({ slot: value.slot, linkSkillId: value.linkSkillId, sourceColumn: value.sourceColumn }));
        if (JSON.stringify(actualLinks) !== JSON.stringify(expectedLinks) || projected.links.some(value => value.status !== "supported")) {
            throw new Error(`K34 link structural join mismatch ${card.cardId}`);
        }
        linkAssignmentCount += actualLinks.length;

        for (const state of card.skillStates) {
            if (stateKeys.has(state.stateKey)) throw new Error(`K34 duplicate DB1 state identity ${state.stateKey}`);
            stateKeys.add(state.stateKey);
            if (!state.growthStep) continue;
            growthStateCount++;
            const row = state.growthStep;
            if (row.provenance.table !== "optimal_awakening_growths" || JSON.stringify(row.provenance.columns) !== JSON.stringify(growthColumns)
                || row.provenance.rowId !== String(row.values.id)
                || scalar(row.values.optimal_awakening_grow_type) !== scalar(card.card.values.optimal_awakening_grow_type)) {
                throw new Error(`K34 malformed optimal-awakening row join ${card.cardId}:${row.provenance.rowId}`);
            }
            const signature = JSON.stringify(growthColumns.map(column => row.values[column]));
            const existing = growthRows.get(row.provenance.rowId);
            if (existing !== undefined && existing !== signature) throw new Error(`K34 ambiguous optimal-awakening row identity ${row.provenance.rowId}`);
            growthRows.set(row.provenance.rowId, signature);
        }
    }
    const missing = [...taxonomyByCard.keys()].filter(cardId => !db1Cards.has(cardId));
    if (missing.length > 0 || db1Cards.size !== taxonomyByCard.size) throw new Error(`K34 missing DB1/K2 card joins: ${missing.slice(0, 5).join(",")}`);
    return {
        status: "supported",
        db1CardCount: db1Cards.size,
        k2CardCount: taxonomyByCard.size,
        joinedCardCount: db1Cards.size,
        growthStateCount,
        distinctGrowthRowCount: growthRows.size,
        categoryAssignmentCount,
        linkAssignmentCount,
        duplicateCardIdCount: 0,
        missingCardJoinCount: 0,
        duplicateCategoryRelationIdCount: 0,
        missingCategoryJoinCount: 0,
        duplicateLinkSlotCount: 0,
        missingLinkJoinCount: 0,
        identityPolicy: "structural_ids_only_no_names_or_labels",
    };
}

export async function loadCardScopeInputs(options: CardScopeInputOptions): Promise<CardScopeLoadedInputs> {
    const roots = {
        sqlite: await regularRoot(options.sqliteRoot, "SQLite"),
        db1: await regularRoot(options.db1Root, "DB1"),
        k2: await regularRoot(options.k2Root, "K2"),
        elf: await regularRoot(options.elfRoot, "ELF"),
        nativeEvidence: await regularRoot(options.nativeEvidenceRoot, "native evidence"),
    };
    const sqlite = await inspectSqlite(roots.sqlite);

    const db1Snapshots = await Promise.all([
        fingerprintMember(roots.db1, CARD_SCOPE_FILES.db1Manifest),
        fingerprintMember(roots.db1, CARD_SCOPE_FILES.db1SourceManifest),
        fingerprintMember(roots.db1, CARD_SCOPE_FILES.db1Payload),
    ]);
    const db1 = await readCharacterSourceInput(roots.db1);
    exact(db1Snapshots[2], { sha256: CARD_SCOPE_SOURCE_PIN.db1.sha256, sizeBytes: CARD_SCOPE_SOURCE_PIN.db1.sizeBytes }, "DB1 payload");

    const k2 = await loadK2(roots.k2);
    const elf = await readMember(roots.elf, CARD_SCOPE_FILES.elf, 96 * 1024 * 1024);
    exact(elf, CARD_SCOPE_SOURCE_PIN.elf, "ELF");
    const nativeLayout = await readMember(roots.nativeEvidence, CARD_SCOPE_FILES.nativeLayout, 4 * 1024);
    exact(nativeLayout, CARD_SCOPE_SOURCE_PIN.nativeLayout, "native evidence layout");
    const nativeInspection = parseNativeRuntimeElf(elf.bytes);

    return {
        schemaProof: sqlite.proof,
        db1,
        taxonomy: k2.taxonomy,
        nativeInspection,
        nativeSha256: elf.sha256,
        nativeSizeBytes: elf.sizeBytes,
        nativeLayoutBytes: nativeLayout.bytes,
        revalidate: async () => {
            await unchanged(sqlite.fingerprint, roots.sqlite, CARD_SCOPE_FILES.sqlite);
            await Promise.all(db1Snapshots.map((snapshot, index) => unchanged(snapshot, roots.db1, [CARD_SCOPE_FILES.db1Manifest, CARD_SCOPE_FILES.db1SourceManifest, CARD_SCOPE_FILES.db1Payload][index])));
            const db1After = await readCharacterSourceInput(roots.db1);
            if (db1After.artifactSha256 !== db1.artifactSha256 || db1After.databaseSha256 !== db1.databaseSha256 || db1After.cardCount !== db1.cardCount) throw new Error("K34 DB1 lineage changed during report execution");
            await Promise.all(k2.snapshots.map((snapshot, index) => unchanged(snapshot, roots.k2, [CARD_SCOPE_FILES.k2Manifest, CARD_SCOPE_FILES.k2Payload, CARD_SCOPE_FILES.k2Coverage, CARD_SCOPE_FILES.k2Validation][index])));
            await unchanged(elf, roots.elf, CARD_SCOPE_FILES.elf);
            await unchanged(nativeLayout, roots.nativeEvidence, CARD_SCOPE_FILES.nativeLayout);
        },
    };
}
