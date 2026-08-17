import { execFileSync } from "child_process";
import { createHash } from "crypto";

const REQUIRED_SOURCE_CATEGORIES = ["headers", "cookies", "query", "url_credentials", "request_body", "response_body"] as const;
const REQUIRED_GIT_TARGET_CATEGORIES = ["tip", "history_old", "history_new"] as const;
const ZERO_OBJECT_ID = /^0+$/;
const OBJECT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const SECRET_CONTEXT = /(?:auth|token|cookie|credential|device|password|secret|session|sign|user|account|nonce)/i;
const BODY_SENSITIVE_PATH = /(?:participant|rankers|my_ranking|ranking|point|title|supporter|deck|teaming|card|mission|budokai_status|start_at|end_at|updated_at|collecting|result|name|description)/i;

export type WtSensitiveCategory = typeof REQUIRED_SOURCE_CATEGORIES[number];
export type WtAuditTargetCategory = typeof REQUIRED_GIT_TARGET_CATEGORIES[number] | "fixture" | "spec" | "generated" | "other";

export interface WtSensitiveCatalog {
    schemaVersion: 1;
    sourceSha256: string;
    sourceSizeBytes: number;
    entryCount: number;
    sensitiveValueCount: number;
    categoryValueCounts: Record<WtSensitiveCategory, number>;
}

export interface WtAuditTargetInput {
    targetId: string;
    category: WtAuditTargetCategory;
    content: Buffer;
    blobId?: string;
}

export interface WtAuditScanPolicy {
    allowedHistoricalHarTargetFingerprints: readonly string[];
}

export interface WtGitAuditTargets {
    schemaVersion: 1;
    baseCommit: string;
    tipCommit: string;
    commitCount: number;
    targetCount: number;
    uniqueBlobCount: number;
    categoryTargetCounts: Record<typeof REQUIRED_GIT_TARGET_CATEGORIES[number], number>;
    targetIds: string[];
    blobIds: string[];
    pathHashes: string[];
}

export interface WtAuditScanResult {
    schemaVersion: 1;
    valid: boolean;
    targetCount: number;
    uniqueBlobCount: number;
    sensitiveValueCount: number;
    sensitiveMatchCount: number;
    harStructureTargetCount: number;
    tipHarStructureTargetCount: number;
    rawHarTargetCount: number;
    historicalHarAllowlistCount: number;
    historicalHarAllowlistSatisfied: boolean;
    harStructureTargets: Array<{ category: WtAuditTargetCategory; fingerprint: string }>;
    categoryTargetCounts: Record<WtAuditTargetCategory, number>;
    sensitiveMatchCategoryCounts: Record<WtSensitiveCategory, number>;
    matchedTargets: Array<{ targetId: string; blobId?: string; categories: WtSensitiveCategory[]; rawHar: boolean }>;
}

type ScalarKind = "string" | "number" | "boolean" | "null";
interface SensitiveAtom { category: WtSensitiveCategory; kind: ScalarKind; value: string; context: string; }
interface MatcherNode { next: Map<number, number>; failure: number; outputs: number[]; }
interface LongPattern { bytes: Buffer; category: WtSensitiveCategory; anchorLength: number; }
interface CatalogState { atoms: SensitiveAtom[]; longMatcher: MatcherNode[]; longPatterns: LongPattern[]; shortStructured: Map<string, Set<WtSensitiveCategory>>; shortTokens: Map<string, Set<WtSensitiveCategory>>; }
interface GitDescriptor { targetId: string; pathHash: string; blobId: string; category: typeof REQUIRED_GIT_TARGET_CATEGORIES[number]; }
interface GitState { repoRoot: string; descriptors: GitDescriptor[]; }

const catalogStates = new WeakMap<WtSensitiveCatalog, CatalogState>();
const gitStates = new WeakMap<WtGitAuditTargets, GitState>();

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function scalarKind(value: unknown): ScalarKind | null {
    if (value === null) return "null";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    return null;
}
function scalarText(value: unknown, kind: ScalarKind): string {
    if (kind === "null") return "null";
    if (kind === "number") {
        if (!Number.isFinite(value as number)) throw new Error("WT sensitive source contains a non-finite number");
        return JSON.stringify(value);
    }
    return String(value);
}
function normalizeContext(value: string): string { return value.trim().toLowerCase(); }

function addAtom(target: SensitiveAtom[], category: WtSensitiveCategory, value: unknown, context: string): void {
    const kind = scalarKind(value);
    if (!kind) return;
    const text = scalarText(value, kind);
    if (kind === "string" && text.length === 0) return;
    target.push({ category, kind, value: text, context: normalizeContext(context) });
}

function collectBodyAtoms(value: unknown, category: "request_body" | "response_body", target: SensitiveAtom[], context = "$"): void {
    const kind = scalarKind(value);
    if (kind) { if (context === "$" || SECRET_CONTEXT.test(context) || BODY_SENSITIVE_PATH.test(context)) addAtom(target, category, value, context); return; }
    if (Array.isArray(value)) {
        for (const child of value) collectBodyAtoms(child, category, target, `${context}[]`);
        return;
    }
    const row = record(value);
    if (!row) throw new Error("WT sensitive source contains an unsupported body value");
    for (const [key, child] of Object.entries(row)) collectBodyAtoms(child, category, target, `${context}.${key}`);
}

function collectBodyText(raw: unknown, encoding: unknown, category: "request_body" | "response_body", target: SensitiveAtom[]): void {
    if (typeof raw !== "string") return;
    let bodyText = raw;
    if (encoding === "base64") {
        try { bodyText = Buffer.from(raw, "base64").toString("utf8"); }
        catch { throw new Error("WT sensitive source body decoding failed"); }
    }
    try { collectBodyAtoms(JSON.parse(bodyText), category, target); }
    catch (error) {
        if (error instanceof SyntaxError) addAtom(target, category, bodyText, "$");
        else throw error;
    }
}

function collectHeaders(value: unknown, category: "headers", atoms: SensitiveAtom[]): void {
    if (value === undefined) return;
    if (!Array.isArray(value)) throw new Error("WT sensitive source headers are malformed");
    for (const item of value) {
        const row = record(item);
        if (!row || typeof row.name !== "string" || typeof row.value !== "string") throw new Error("WT sensitive source header is malformed");
        addAtom(atoms, category, row.value, row.name);
        if (/^(?:cookie|set-cookie)$/i.test(row.name)) collectCookieHeader(row.value, atoms);
    }
}

function collectCookieHeader(value: string, atoms: SensitiveAtom[]): void {
    for (const part of value.split(";")) {
        const equals = part.indexOf("=");
        if (equals <= 0) continue;
        addAtom(atoms, "cookies", part.slice(equals + 1).trim(), part.slice(0, equals));
    }
}

function collectCookies(value: unknown, atoms: SensitiveAtom[]): void {
    if (value === undefined) return;
    if (!Array.isArray(value)) throw new Error("WT sensitive source cookies are malformed");
    for (const item of value) {
        const row = record(item);
        if (!row || typeof row.name !== "string" || !(typeof row.value === "string" || typeof row.value === "number" || typeof row.value === "boolean")) throw new Error("WT sensitive source cookie is malformed");
        addAtom(atoms, "cookies", row.value, row.name);
    }
}

function collectQuery(value: unknown, url: URL, atoms: SensitiveAtom[]): void {
    if (value !== undefined) {
        if (!Array.isArray(value)) throw new Error("WT sensitive source query is malformed");
        for (const item of value) {
            const row = record(item);
            if (!row || typeof row.name !== "string" || !(typeof row.value === "string" || typeof row.value === "number" || typeof row.value === "boolean")) throw new Error("WT sensitive source query item is malformed");
            addAtom(atoms, "query", row.value, row.name);
        }
    }
    for (const [name, queryValue] of url.searchParams) addAtom(atoms, "query", queryValue, name);
}

function deduplicateAtoms(atoms: SensitiveAtom[]): SensitiveAtom[] {
    const unique = new Map<string, SensitiveAtom>();
    for (const atom of atoms) unique.set(`${atom.category}\0${atom.kind}\0${atom.context}\0${atom.value}`, atom);
    return [...unique.values()];
}

function addCategory(target: Map<string, Set<WtSensitiveCategory>>, key: string, category: WtSensitiveCategory): void { const values = target.get(key) ?? new Set<WtSensitiveCategory>(); values.add(category); target.set(key, values); }

function globallySensitive(atom: SensitiveAtom): boolean { return atom.context === "$" || atom.category === "cookies" || atom.category === "url_credentials" || SECRET_CONTEXT.test(atom.context); }

function buildMatchers(atoms: SensitiveAtom[]): Pick<CatalogState, "longMatcher" | "longPatterns" | "shortStructured" | "shortTokens"> {
    const nodes: MatcherNode[] = [{ next: new Map(), failure: 0, outputs: [] }], patterns: LongPattern[] = [], shortStructured = new Map<string, Set<WtSensitiveCategory>>(), shortTokens = new Map<string, Set<WtSensitiveCategory>>(), seenPatterns = new Set<string>();
    const add = (pattern: Buffer, category: WtSensitiveCategory): void => {
        const identity = `${category}\0${sha256(pattern)}`; if (seenPatterns.has(identity)) return; seenPatterns.add(identity);
        const patternId = patterns.length, anchorLength = Math.min(16, pattern.length), anchor = pattern.subarray(0, anchorLength); patterns.push({ bytes: pattern, category, anchorLength });
        let node = 0;
        for (const byte of anchor) {
            let next = nodes[node].next.get(byte);
            if (next === undefined) { next = nodes.length; nodes[node].next.set(byte, next); nodes.push({ next: new Map(), failure: 0, outputs: [] }); }
            node = next;
        }
        nodes[node].outputs.push(patternId);
    };
    for (const atom of atoms) {
        addCategory(shortStructured, `${atom.kind}\0${atom.context}\0${atom.value}`, atom.category);
        if (atom.kind === "string" && globallySensitive(atom)) {
            const size = Buffer.byteLength(atom.value), shortCredential = atom.category === "cookies" || atom.category === "url_credentials" || (atom.category === "headers" && /authorization/i.test(atom.context));
            if (size >= 8) { addCategory(shortTokens, atom.value, atom.category); add(Buffer.from(atom.value, "utf8"), atom.category); add(Buffer.from(JSON.stringify(atom.value), "utf8"), atom.category); }
            else if (shortCredential) addCategory(shortTokens, atom.value, atom.category);
        }
    }
    const queue: number[] = [];
    for (const child of nodes[0].next.values()) { nodes[child].failure = 0; queue.push(child); }
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        for (const [byte, child] of nodes[current].next) {
            let failure = nodes[current].failure;
            while (failure !== 0 && !nodes[failure].next.has(byte)) failure = nodes[failure].failure;
            const fallback = nodes[failure].next.get(byte);
            nodes[child].failure = fallback !== undefined && fallback !== child ? fallback : 0;
            nodes[child].outputs.push(...nodes[nodes[child].failure].outputs);
            queue.push(child);
        }
    }
    return { longMatcher: nodes, longPatterns: patterns, shortStructured, shortTokens };
}

function matchLongValues(content: Buffer, matcher: MatcherNode[], patterns: LongPattern[]): Set<WtSensitiveCategory> {
    const matched = new Set<WtSensitiveCategory>(); let node = 0;
    for (let index = 0; index < content.length; index++) { const byte = content[index];
        while (node !== 0 && !matcher[node].next.has(byte)) node = matcher[node].failure;
        node = matcher[node].next.get(byte) ?? 0;
        for (const patternId of matcher[node].outputs) { const pattern = patterns[patternId], start = index - pattern.anchorLength + 1, end = start + pattern.bytes.length; if (start >= 0 && end <= content.length && content.subarray(start, end).equals(pattern.bytes)) matched.add(pattern.category); }
    }
    return matched;
}

export function buildWtSensitiveCatalog(harText: string): WtSensitiveCatalog {
    let parsed: unknown;
    try { parsed = JSON.parse(harText); }
    catch { throw new Error("WT sensitive source is not valid JSON"); }
    const root = record(parsed), log = record(root?.log), entries = log?.entries;
    if (!Array.isArray(entries) || entries.length === 0) throw new Error("WT sensitive source is not a HAR entry collection");
    const atoms: SensitiveAtom[] = [];
    for (const rawEntry of entries) {
        const entry = record(rawEntry), request = record(entry?.request), response = record(entry?.response);
        if (!entry || !request || !response || typeof request.url !== "string") throw new Error("WT sensitive source contains a malformed entry");
        let url: URL;
        try { url = new URL(request.url); }
        catch { throw new Error("WT sensitive source contains an invalid URL"); }
        collectHeaders(request.headers, "headers", atoms);
        collectHeaders(response.headers, "headers", atoms);
        collectCookies(request.cookies, atoms);
        collectCookies(response.cookies, atoms);
        collectQuery(request.queryString, url, atoms);
        if (url.username) addAtom(atoms, "url_credentials", decodeURIComponent(url.username), "username");
        if (url.password) addAtom(atoms, "url_credentials", decodeURIComponent(url.password), "password");
        const postData = record(request.postData), content = record(response.content);
        collectBodyText(postData?.text, postData?.encoding, "request_body", atoms);
        collectBodyText(content?.text, content?.encoding, "response_body", atoms);
    }
    const unique = deduplicateAtoms(atoms);
    const categoryValueCounts = Object.fromEntries(REQUIRED_SOURCE_CATEGORIES.map(category => [category, unique.filter(atom => atom.category === category).length])) as Record<WtSensitiveCategory, number>;
    if (Object.keys(categoryValueCounts).length !== REQUIRED_SOURCE_CATEGORIES.length) throw new Error("WT sensitive source category coverage failed");
    const catalog: WtSensitiveCatalog = Object.freeze({ schemaVersion: 1, sourceSha256: sha256(harText), sourceSizeBytes: Buffer.byteLength(harText), entryCount: entries.length, sensitiveValueCount: unique.length, categoryValueCounts: Object.freeze(categoryValueCounts) });
    catalogStates.set(catalog, { atoms: unique, ...buildMatchers(unique) });
    return catalog;
}

function parseJsonScalars(text: string): Map<string, Set<string>> {
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { return new Map(); }
    const values = new Map<string, Set<string>>();
    const visit = (value: unknown, context = "$"): void => {
        const kind = scalarKind(value);
        if (kind) {
            const key = `${kind}\0${normalizeContext(context)}`;
            const set = values.get(key) ?? new Set<string>();
            set.add(scalarText(value, kind)); values.set(key, set); return;
        }
        if (Array.isArray(value)) { for (const child of value) visit(child, `${context}[]`); return; }
        const row = record(value); if (row) { const siblingContext = typeof row.name === "string" && scalarKind(row.value) ? row.name : null; for (const [key, child] of Object.entries(row)) visit(child, key === "value" && siblingContext ? siblingContext : `${context}.${key}`); }
    };
    visit(parsed);
    return values;
}

function stringTokens(text: string): Set<string> {
    const result = new Set<string>();
    const quoted = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gs;
    for (const match of text.matchAll(quoted)) {
        const token = match[0];
        if (token.startsWith("\"") ) {
            try { const parsed = JSON.parse(token); if (typeof parsed === "string") result.add(parsed); } catch { /* not a JSON string literal */ }
        } else result.add(token.slice(1, -1).replace(/\\([\\'"`])/g, "$1"));
    }
    const headerLine = /(?:^|[\r\n])\s*[A-Za-z][A-Za-z0-9-]*\s*:\s*([^\r\n]+)/g;
    for (const match of text.matchAll(headerLine)) result.add(match[1].trim());
    return result;
}

function isHarBuffer(content: Buffer): boolean {
    let parsed: unknown;
    try { parsed = JSON.parse(content.toString("utf8")); }
    catch { return false; }
    const root = record(parsed), log = record(root?.log);
    return Array.isArray(log?.entries);
}

function scanContent(content: Buffer, state: CatalogState): Set<WtSensitiveCategory> {
    const matched = matchLongValues(content, state.longMatcher, state.longPatterns), text = content.toString("utf8"), structured = parseJsonScalars(text), tokens = stringTokens(text);
    for (const [kindAndContext, values] of structured) for (const value of values) for (const category of state.shortStructured.get(`${kindAndContext}\0${value}`) ?? []) matched.add(category);
    for (const token of tokens) for (const category of state.shortTokens.get(token) ?? []) matched.add(category);
    return matched;
}

function emptyCategoryCounts(): Record<WtAuditTargetCategory, number> {
    return { tip: 0, history_old: 0, history_new: 0, fixture: 0, spec: 0, generated: 0, other: 0 };
}
function emptyMatchCounts(): Record<WtSensitiveCategory, number> {
    return { headers: 0, cookies: 0, query: 0, url_credentials: 0, request_body: 0, response_body: 0 };
}

function scanTargetSequence(catalog: WtSensitiveCatalog, sequence: Iterable<{ targetId: string; category: WtAuditTargetCategory; content: () => Buffer; blobId?: string; pathHash?: string }>, policy: WtAuditScanPolicy, cacheByBlobIdentity = false, preScannedBlobs = new Map<string, { categories: WtSensitiveCategory[]; rawHar: boolean }>()): WtAuditScanResult {
    const state = catalogStates.get(catalog);
    if (!state) throw new Error("WT sensitive catalog is not an active catalog");
    const allowedHistoricalHarTargets = new Set(policy.allowedHistoricalHarTargetFingerprints);
    if (allowedHistoricalHarTargets.size !== policy.allowedHistoricalHarTargetFingerprints.length || [...allowedHistoricalHarTargets].some(value => !/^[0-9a-f]{64}$/.test(value))) throw new Error("WT historical HAR allowlist is invalid");
    const categoryTargetCounts = emptyCategoryCounts(), sensitiveMatchCategoryCounts = emptyMatchCounts(), matchedTargets: WtAuditScanResult["matchedTargets"] = [], blobs = new Set<string>();
    const harStructureTargets: WtAuditScanResult["harStructureTargets"] = [], observedAllowedHistoricalHarTargets = new Set<string>();
    const scannedBlobs = new Map(preScannedBlobs);
    let targetCount = 0, sensitiveMatchCount = 0, harStructureTargetCount = 0, tipHarStructureTargetCount = 0, rawHarTargetCount = 0;
    for (const target of sequence) {
        targetCount += 1; categoryTargetCounts[target.category] += 1;
        let contentIdentity = target.blobId, scanned = contentIdentity && cacheByBlobIdentity ? scannedBlobs.get(contentIdentity) : undefined;
        if (!scanned) {
            let content: Buffer;
            try { content = target.content(); }
            catch { throw new Error("WT audit target blob is unreadable"); }
            if (!Buffer.isBuffer(content)) throw new Error("WT audit target is not a buffer");
            contentIdentity = target.blobId ?? sha256(content);
            scanned = { rawHar: isHarBuffer(content), categories: [...scanContent(content, state)].sort() };
            if (cacheByBlobIdentity && target.blobId) scannedBlobs.set(target.blobId, scanned);
        }
        blobs.add(contentIdentity!);
        const categories = scanned.categories, harStructure = scanned.rawHar;
        const structuralFingerprint = target.pathHash && target.blobId ? sha256(`${target.category}\0${target.pathHash}\0${target.blobId}`) : sha256(`${target.category}\0${target.targetId}\0${contentIdentity}`);
        const isHistorical = target.category === "history_old" || target.category === "history_new";
        const allowedHistoricalHar = harStructure && isHistorical && allowedHistoricalHarTargets.has(structuralFingerprint);
        const rawHar = harStructure && !allowedHistoricalHar;
        if (harStructure) { harStructureTargetCount += 1; harStructureTargets.push({ category: target.category, fingerprint: structuralFingerprint }); }
        if (harStructure && target.category === "tip") tipHarStructureTargetCount += 1;
        if (allowedHistoricalHar) observedAllowedHistoricalHarTargets.add(structuralFingerprint);
        if (rawHar) rawHarTargetCount += 1;
        sensitiveMatchCount += categories.length;
        for (const category of categories) sensitiveMatchCategoryCounts[category] += 1;
        if (rawHar || categories.length) matchedTargets.push({ targetId: sha256(target.targetId), ...(target.blobId ? { blobId: target.blobId } : {}), categories, rawHar });
    }
    if (targetCount === 0) throw new Error("WT audit target collection is empty");
    harStructureTargets.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
    const historicalHarAllowlistSatisfied = observedAllowedHistoricalHarTargets.size === allowedHistoricalHarTargets.size;
    return { schemaVersion: 1, valid: sensitiveMatchCount === 0 && rawHarTargetCount === 0 && tipHarStructureTargetCount === 0 && historicalHarAllowlistSatisfied, targetCount, uniqueBlobCount: blobs.size, sensitiveValueCount: state.atoms.length, sensitiveMatchCount, harStructureTargetCount, tipHarStructureTargetCount, rawHarTargetCount, historicalHarAllowlistCount: allowedHistoricalHarTargets.size, historicalHarAllowlistSatisfied, harStructureTargets, categoryTargetCounts, sensitiveMatchCategoryCounts, matchedTargets };
}

export function scanWtAuditTargets(catalog: WtSensitiveCatalog, targets: readonly WtAuditTargetInput[] | WtGitAuditTargets, policy: WtAuditScanPolicy = { allowedHistoricalHarTargetFingerprints: [] }): WtAuditScanResult {
    const gitState = gitStates.get(targets as WtGitAuditTargets);
    if (gitState) {
        const catalogState = catalogStates.get(catalog);
        if (!catalogState) throw new Error("WT sensitive catalog is not an active catalog");
        const scanned = scanGitBlobs(gitState.repoRoot, [...new Set(gitState.descriptors.map(value => value.blobId))], catalogState);
        return scanTargetSequence(catalog, gitState.descriptors.map(descriptor => ({ targetId: descriptor.targetId, category: descriptor.category, blobId: descriptor.blobId, pathHash: descriptor.pathHash, content: () => { throw new Error("WT git audit pre-scan omitted a blob"); } })), policy, true, scanned);
    }
    if (!Array.isArray(targets)) throw new Error("WT audit target collection is invalid");
    return scanTargetSequence(catalog, targets.map(target => {
        if (!target || typeof target.targetId !== "string" || !target.targetId || !Buffer.isBuffer(target.content) || !emptyCategoryCounts().hasOwnProperty(target.category)) throw new Error("WT audit target descriptor is invalid");
        return { targetId: target.targetId, category: target.category, blobId: target.blobId, content: () => target.content };
    }), policy);
}

function git(repoRoot: string, args: string[], encoding: "buffer"): Buffer;
function git(repoRoot: string, args: string[], encoding: "utf8"): string;
function git(repoRoot: string, args: string[], encoding: "buffer" | "utf8"): Buffer | string {
    try { return execFileSync("git", args, { cwd: repoRoot, encoding: encoding === "buffer" ? undefined : "utf8", maxBuffer: 1024 * 1024 * 1024, timeout: 30000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }) as Buffer | string; }
    catch { throw new Error("WT git audit command failed"); }
}
function commitId(repoRoot: string, revision: string): string {
    const result = git(repoRoot, ["rev-parse", "--verify", `${revision}^{commit}`], "utf8").trim();
    if (!OBJECT_ID.test(result)) throw new Error("WT git audit revision is invalid");
    return result;
}
function splitNull(buffer: Buffer): Buffer[] {
    const result: Buffer[] = []; let start = 0;
    for (let index = 0; index < buffer.length; index++) if (buffer[index] === 0) { result.push(buffer.subarray(start, index)); start = index + 1; }
    if (start !== buffer.length) throw new Error("WT git audit output is malformed");
    return result;
}
function gitWithInput(repoRoot: string, args: string[], input: string, maxBuffer: number): Buffer {
    try { return execFileSync("git", args, { cwd: repoRoot, input, encoding: undefined, maxBuffer, timeout: 30000, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }) as unknown as Buffer; }
    catch { throw new Error("WT git audit blob batch is unreadable"); }
}

function scanGitBlobs(repoRoot: string, blobIds: string[], state: CatalogState): Map<string, { categories: WtSensitiveCategory[]; rawHar: boolean }> {
    if (blobIds.length === 0 || blobIds.some(value => !OBJECT_ID.test(value))) throw new Error("WT git audit blob collection is invalid");
    const ordered = [...blobIds].sort(), input = `${ordered.join("\n")}\n`;
    const check = gitWithInput(repoRoot, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], input, Math.max(1024 * 1024, ordered.length * 128)).toString("ascii").trim().split(/\r?\n/);
    if (check.length !== ordered.length) throw new Error("WT git audit blob inventory is incomplete");
    const sizes = new Map<string, number>();
    for (let index = 0; index < check.length; index++) {
        const fields = check[index].split(" "), size = Number(fields[2]);
        if (fields.length !== 3 || fields[0] !== ordered[index] || fields[1] !== "blob" || !Number.isSafeInteger(size) || size < 0) throw new Error("WT git audit blob inventory is malformed");
        sizes.set(fields[0], size);
    }
    const chunks: string[][] = []; let current: string[] = [], currentBytes = 0;
    for (const blobId of ordered) {
        const size = sizes.get(blobId)!;
        if (size > 512 * 1024 * 1024) throw new Error("WT git audit blob exceeds the bounded scanner size");
        if (current.length && currentBytes + size > 32 * 1024 * 1024) { chunks.push(current); current = []; currentBytes = 0; }
        current.push(blobId); currentBytes += size;
    }
    if (current.length) chunks.push(current);
    const result = new Map<string, { categories: WtSensitiveCategory[]; rawHar: boolean }>();
    for (const chunk of chunks) {
        const expectedBytes = chunk.reduce((sum, value) => sum + sizes.get(value)!, 0), output = gitWithInput(repoRoot, ["cat-file", "--batch"], `${chunk.join("\n")}\n`, expectedBytes + chunk.length * 256 + 1024 * 1024);
        let offset = 0;
        for (const expectedId of chunk) {
            const newline = output.indexOf(10, offset);
            if (newline < 0) throw new Error("WT git audit blob batch header is missing");
            const fields = output.subarray(offset, newline).toString("ascii").split(" "), size = Number(fields[2]);
            if (fields.length !== 3 || fields[0] !== expectedId || fields[1] !== "blob" || size !== sizes.get(expectedId)) throw new Error("WT git audit blob batch header is malformed");
            const start = newline + 1, end = start + size;
            if (end >= output.length || output[end] !== 10) throw new Error("WT git audit blob batch body is truncated");
            const content = output.subarray(start, end);
            result.set(expectedId, { rawHar: isHarBuffer(content), categories: [...scanContent(content, state)].sort() });
            offset = end + 1;
        }
        if (offset !== output.length) throw new Error("WT git audit blob batch has trailing bytes");
    }
    if (result.size !== ordered.length) throw new Error("WT git audit blob scan is incomplete");
    return result;
}

function addDescriptor(target: GitDescriptor[], path: Buffer, blobId: string, category: GitDescriptor["category"], commit: string, side: string): void {
    if (!OBJECT_ID.test(blobId)) throw new Error("WT git audit object identity is malformed");
    const pathHash = sha256(path), targetId = sha256(`${category}\0${commit}\0${side}\0${pathHash}\0${blobId}`);
    target.push({ targetId, pathHash, blobId, category });
}

export function collectWtGitAuditTargets(repoRoot: string, base: string, tip: string): WtGitAuditTargets {
    if (!repoRoot || !base || !tip) throw new Error("WT git audit range is invalid");
    const baseCommit = commitId(repoRoot, base), tipCommit = commitId(repoRoot, tip);
    try { git(repoRoot, ["merge-base", "--is-ancestor", baseCommit, tipCommit], "buffer"); }
    catch { throw new Error("WT git audit range is invalid"); }
    if (baseCommit === tipCommit) throw new Error("WT git audit range is empty");
    const commits = git(repoRoot, ["rev-list", "--reverse", `${baseCommit}..${tipCommit}`], "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (commits.length === 0 || commits.some(value => !OBJECT_ID.test(value))) throw new Error("WT git audit range is invalid");
    const descriptors: GitDescriptor[] = [];
    const tipTree = splitNull(git(repoRoot, ["ls-tree", "-r", "-z", "--full-tree", tipCommit], "buffer"));
    for (const item of tipTree) {
        if (item.length === 0) continue;
        const tab = item.indexOf(9); if (tab < 0) throw new Error("WT git audit tree output is malformed");
        const metadata = item.subarray(0, tab).toString("ascii").split(" "), path = item.subarray(tab + 1);
        if (metadata.length !== 3) throw new Error("WT git audit tree output is malformed");
        if (metadata[1] === "blob") addDescriptor(descriptors, path, metadata[2], "tip", tipCommit, "tip");
    }
    for (const commit of commits) {
        const parts = splitNull(git(repoRoot, ["diff-tree", "-r", "--root", "-m", "--raw", "-z", "--no-abbrev", "--no-commit-id", commit], "buffer"));
        for (let index = 0; index < parts.length;) {
            if (parts[index].length === 0) { index += 1; continue; }
            const metadata = parts[index++].toString("ascii");
            if (!metadata.startsWith(":")) throw new Error("WT git audit diff output is malformed");
            if (index >= parts.length) throw new Error("WT git audit diff path is missing");
            const oldPath = parts[index++], fields = metadata.slice(1).split(" ");
            if (fields.length !== 5) throw new Error("WT git audit diff metadata is malformed");
            const [oldMode, newMode, oldId, newId, status] = fields;
            if (!/^[ACDMRTUXB][0-9]*$/.test(status)) throw new Error("WT git audit diff status is unsupported");
            const newPath = /^[RC]/.test(status) ? (index < parts.length ? parts[index++] : (() => { throw new Error("WT git audit renamed path is missing"); })()) : oldPath;
            if (oldMode !== "000000" && oldMode !== "160000" && !ZERO_OBJECT_ID.test(oldId)) addDescriptor(descriptors, oldPath, oldId, "history_old", commit, "old");
            if (newMode !== "000000" && newMode !== "160000" && !ZERO_OBJECT_ID.test(newId)) addDescriptor(descriptors, newPath, newId, "history_new", commit, "new");
        }
    }
    if (descriptors.length === 0) throw new Error("WT git audit target collection is empty");
    const categoryTargetCounts = Object.fromEntries(REQUIRED_GIT_TARGET_CATEGORIES.map(category => [category, descriptors.filter(value => value.category === category).length])) as Record<typeof REQUIRED_GIT_TARGET_CATEGORIES[number], number>;
    if (Object.keys(categoryTargetCounts).length !== REQUIRED_GIT_TARGET_CATEGORIES.length || categoryTargetCounts.tip === 0) throw new Error("WT git audit category coverage failed");
    const result: WtGitAuditTargets = Object.freeze({ schemaVersion: 1, baseCommit, tipCommit, commitCount: commits.length, targetCount: descriptors.length, uniqueBlobCount: new Set(descriptors.map(value => value.blobId)).size, categoryTargetCounts: Object.freeze(categoryTargetCounts), targetIds: Object.freeze(descriptors.map(value => value.targetId).sort()) as unknown as string[], blobIds: Object.freeze([...new Set(descriptors.map(value => value.blobId))].sort()) as unknown as string[], pathHashes: Object.freeze([...new Set(descriptors.map(value => value.pathHash))].sort()) as unknown as string[] });
    gitStates.set(result, { repoRoot, descriptors });
    return result;
}
