"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectWtGitAuditTargets = exports.scanWtAuditTargets = exports.buildWtSensitiveCatalog = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const ts = require("typescript");
const REQUIRED_SOURCE_CATEGORIES = ["headers", "cookies", "url_path", "query", "url_credentials", "request_body", "response_body"];
const REQUIRED_GIT_TARGET_CATEGORIES = ["tip", "history_old", "history_new"];
const ZERO_OBJECT_ID = /^0+$/;
const OBJECT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const JSON_MIME = /^(?:application|text)\/(?:[^;]+\+)?json(?:\s*;|$)/i;
const URL_TOKEN = /https?:\/\/[^\s"'`<>]+/g;
const catalogStates = new WeakMap();
const gitStates = new WeakMap();
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null; }
function scalarKind(value) {
    if (value === null)
        return "null";
    if (typeof value === "string")
        return "string";
    if (typeof value === "number")
        return "number";
    if (typeof value === "boolean")
        return "boolean";
    return null;
}
function canonicalScalar(value, kind) {
    if (kind === "number" && !Number.isFinite(value))
        throw new Error("WT sensitive source contains a non-finite number");
    const encoded = JSON.stringify(value);
    if (typeof encoded !== "string")
        throw new Error("WT sensitive source scalar canonicalization failed");
    return encoded;
}
function normalizedName(value) { return value.trim().toLowerCase(); }
function childJsonPath(parent, key) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`; }
function jsonShapeFingerprint(value) {
    const visit = (current) => {
        const kind = scalarKind(current);
        if (kind)
            return kind;
        if (Array.isArray(current))
            return `[${current.map(visit).join(",")}]`;
        const row = record(current);
        if (!row)
            throw new Error("WT JSON shape contains an unsupported value");
        return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${visit(row[key])}`).join(",")}}`;
    };
    return sha256(visit(value));
}
function decodedComponent(value) { try {
    return decodeURIComponent(value);
}
catch {
    throw new Error("WT sensitive source URL component decoding failed");
} }
function sanitizeEndpoint(url) {
    const route = url.pathname.split("/").map(segment => {
        if (!segment)
            return "";
        const decoded = decodedComponent(segment);
        return /^\d+$/.test(decoded) || /^[0-9a-f]{24,}$/i.test(decoded) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(decoded) ? "{id}" : encodeURIComponent(decoded);
    }).join("/");
    return `${url.protocol}//${url.host}${route}`;
}
function scopedCaptureContext(capture, structuralContext) { return `${capture.origin}\0${capture.method}\0${capture.endpoint}\0${structuralContext}`; }
function addAtom(target, category, structuralCategory, value, path, capture, matcherContext = path) {
    const kind = scalarKind(value);
    if (!kind)
        throw new Error("WT sensitive source contains an unsupported scalar");
    target.push({ category, structuralCategory, origin: capture.origin, method: capture.method, endpoint: capture.endpoint, path, context: matcherContext, kind, canonicalValue: canonicalScalar(value, kind) });
}
function collectBodyAtoms(value, category, target, context, shapeFingerprint, path = "$") {
    const kind = scalarKind(value);
    if (kind) {
        addAtom(target, category, "json_body", value, path, context, `${shapeFingerprint}\0${path}`);
        return;
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++)
            collectBodyAtoms(value[index], category, target, context, shapeFingerprint, `${path}[${index}]`);
        return;
    }
    const row = record(value);
    if (!row)
        throw new Error("WT sensitive source contains an unsupported body value");
    for (const [key, child] of Object.entries(row))
        collectBodyAtoms(child, category, target, context, shapeFingerprint, childJsonPath(path, key));
}
function decodeBody(raw, encoding) {
    if (encoding === undefined || encoding === null || encoding === "")
        return raw;
    if (encoding !== "base64" || raw.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))
        throw new Error("WT sensitive source body decoding failed");
    return Buffer.from(raw, "base64").toString("utf8");
}
function collectBodyText(containerValue, category, target, context) {
    if (containerValue === undefined)
        return;
    const container = record(containerValue);
    if (!container)
        throw new Error("WT sensitive source body container is malformed");
    if (container.text === undefined)
        return;
    if (typeof container.text !== "string" || (container.mimeType !== undefined && typeof container.mimeType !== "string"))
        throw new Error("WT sensitive source body text is malformed");
    const bodyText = decodeBody(container.text, container.encoding);
    try {
        const parsed = JSON.parse(bodyText);
        collectBodyAtoms(parsed, category, target, context, jsonShapeFingerprint(parsed));
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        if (typeof container.mimeType === "string" && JSON_MIME.test(container.mimeType.trim()))
            throw new Error("WT sensitive source JSON body is malformed");
        addAtom(target, category, "text_body", bodyText, "$text", context, "text_exact");
    }
}
function collectCookiePairs(value, headerName, target, context, path) {
    const parts = value.split(";");
    const selected = normalizedName(headerName) === "set-cookie" ? parts.slice(0, 1) : parts;
    for (let index = 0; index < selected.length; index++) {
        const equals = selected[index].indexOf("=");
        if (equals <= 0)
            continue;
        const name = selected[index].slice(0, equals).trim(), cookieValue = selected[index].slice(equals + 1).trim();
        if (name)
            addAtom(target, "cookies", "cookie", cookieValue, `${path}[${index}].${name}`, context, name);
    }
}
function collectHeaders(value, target, context, path) {
    if (value === undefined)
        return;
    if (!Array.isArray(value))
        throw new Error("WT sensitive source headers are malformed");
    for (let index = 0; index < value.length; index++) {
        const row = record(value[index]);
        if (!row || typeof row.name !== "string" || typeof row.value !== "string" || !row.name.trim())
            throw new Error("WT sensitive source header is malformed");
        addAtom(target, "headers", "header", row.value, `${path}[${index}].${normalizedName(row.name)}`, context, normalizedName(row.name));
        if (/^(?:cookie|set-cookie)$/i.test(row.name.trim()))
            collectCookiePairs(row.value, row.name, target, context, `${path}[${index}]`);
    }
}
function collectCookies(value, target, context, path) {
    if (value === undefined)
        return;
    if (!Array.isArray(value))
        throw new Error("WT sensitive source cookies are malformed");
    for (let index = 0; index < value.length; index++) {
        const row = record(value[index]);
        if (!row || typeof row.name !== "string" || !row.name.trim() || !scalarKind(row.value))
            throw new Error("WT sensitive source cookie is malformed");
        addAtom(target, "cookies", "cookie", row.value, `${path}[${index}].${row.name.trim()}`, context, row.name.trim());
    }
}
function collectUrl(url, target, context, path) {
    const segments = url.pathname.split("/").filter(Boolean);
    for (let index = 0; index < segments.length; index++)
        addAtom(target, "url_path", "url_path_segment", decodedComponent(segments[index]), `${path}.path[${index}]`, context, `${url.origin}${url.pathname}\0${index}`);
    let queryIndex = 0;
    for (const [name, value] of url.searchParams) {
        addAtom(target, "query", "query_name", name, `${path}.query[${queryIndex}].name`, context, `${url.origin}${url.pathname}\0${name}`);
        addAtom(target, "query", "query_value", value, `${path}.query[${queryIndex}].value:${name}`, context, `${url.origin}${url.pathname}\0${name}`);
        queryIndex += 1;
    }
    if (url.username)
        addAtom(target, "url_credentials", "url_username", decodedComponent(url.username), `${path}.username`, context);
    if (url.password)
        addAtom(target, "url_credentials", "url_password", decodedComponent(url.password), `${path}.password`, context);
}
function collectQuery(value, target, context, path, urlPath) {
    if (value === undefined)
        return;
    if (!Array.isArray(value))
        throw new Error("WT sensitive source query is malformed");
    for (let index = 0; index < value.length; index++) {
        const row = record(value[index]);
        if (!row || typeof row.name !== "string" || !row.name.trim() || !scalarKind(row.value))
            throw new Error("WT sensitive source query item is malformed");
        addAtom(target, "query", "query_name", row.name, `${path}[${index}].name`, context, `${urlPath}\0${row.name}`);
        addAtom(target, "query", "query_value", row.value, `${path}[${index}].value:${row.name}`, context, `${urlPath}\0${row.name}`);
    }
}
function deduplicateAtoms(atoms) {
    const unique = new Map();
    for (const atom of atoms)
        unique.set(`${atom.category}\0${atom.structuralCategory}\0${atom.origin}\0${atom.method}\0${atom.endpoint}\0${atom.path}\0${atom.context}\0${atom.kind}\0${atom.canonicalValue}`, atom);
    return [...unique.values()];
}
function addCategory(target, key, category) { const values = target.get(key) ?? new Set(); values.add(category); target.set(key, values); }
function contextualKey(structuralCategory, kind, canonicalValue, context) {
    switch (structuralCategory) {
        case "json_body": return `${structuralCategory}\0${kind}\0${context}\0${canonicalValue}`;
        case "header": return `${structuralCategory}\0${normalizedName(context)}\0${kind}\0${canonicalValue}`;
        case "cookie": return `${structuralCategory}\0${context}\0${kind}\0${canonicalValue}`;
        case "query_value":
        case "query_name":
        case "url_path_segment":
        case "text_body": return `${structuralCategory}\0${context}\0${kind}\0${canonicalValue}`;
        case "url_username":
        case "url_password": return `${structuralCategory}\0${kind}\0${canonicalValue}`;
        default: throw new Error("WT sensitive source category has no matcher");
    }
}
function decodedCanonical(atom) {
    if (atom.kind !== "string")
        return atom.canonicalValue;
    const parsed = JSON.parse(atom.canonicalValue);
    if (typeof parsed !== "string")
        throw new Error("WT sensitive string canonicalization failed");
    return parsed;
}
function distinctiveLiteral(atom, value) {
    if (/\s/.test(value) || Buffer.byteLength(value) > 4096 || atom.structuralCategory === "query_name" || atom.structuralCategory === "url_path_segment")
        return false;
    const minimum = atom.kind === "string" ? 16 : 8;
    if (Buffer.byteLength(value) < minimum || new Set([...value]).size < 4)
        return false;
    const classes = [/[a-z]/.test(value), /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    return atom.kind !== "string" || classes >= 3;
}
function distinctivePathSegment(value) { return /[0-9]/.test(value) || /[^A-Za-z_-]/.test(value); }
function buildMatchers(atoms) {
    const nodes = [{ next: new Map(), failure: 0, outputs: [] }], patterns = [], contextualMatchers = new Map(), scopedMatchers = new Map(), seenPatterns = new Set(), matcherCategories = new Set();
    const add = (pattern, atom) => {
        const identity = `${atom.category}\0${atom.structuralCategory}\0${sha256(pattern)}`;
        if (seenPatterns.has(identity))
            return;
        seenPatterns.add(identity);
        matcherCategories.add(atom.category);
        const patternId = patterns.length, anchorLength = Math.min(16, pattern.length), anchor = pattern.subarray(0, anchorLength);
        patterns.push({ bytes: pattern, category: atom.category, structuralCategory: atom.structuralCategory, anchorLength });
        let node = 0;
        for (const byte of anchor) {
            let next = nodes[node].next.get(byte);
            if (next === undefined) {
                next = nodes.length;
                nodes[node].next.set(byte, next);
                nodes.push({ next: new Map(), failure: 0, outputs: [] });
            }
            node = next;
        }
        nodes[node].outputs.push(patternId);
    };
    for (const atom of atoms) {
        const literal = decodedCanonical(atom);
        if (atom.structuralCategory !== "url_path_segment" || distinctivePathSegment(literal)) {
            addCategory(contextualMatchers, contextualKey(atom.structuralCategory, atom.kind, atom.canonicalValue, atom.context), atom.category);
            addCategory(scopedMatchers, contextualKey(atom.structuralCategory, atom.kind, atom.canonicalValue, scopedCaptureContext(atom, atom.context)), atom.category);
            matcherCategories.add(atom.category);
        }
        if (distinctiveLiteral(atom, literal)) {
            add(Buffer.from(literal, "utf8"), atom);
            if (atom.kind === "string")
                add(Buffer.from(atom.canonicalValue, "utf8"), atom);
            if (atom.structuralCategory === "query_name" || atom.structuralCategory === "query_value" || atom.structuralCategory === "url_path_segment" || atom.structuralCategory === "url_username" || atom.structuralCategory === "url_password")
                add(Buffer.from(encodeURIComponent(literal), "utf8"), atom);
        }
    }
    const queue = [];
    for (const child of nodes[0].next.values()) {
        nodes[child].failure = 0;
        queue.push(child);
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        for (const [byte, child] of nodes[current].next) {
            let failure = nodes[current].failure;
            while (failure !== 0 && !nodes[failure].next.has(byte))
                failure = nodes[failure].failure;
            const fallback = nodes[failure].next.get(byte);
            nodes[child].failure = fallback !== undefined && fallback !== child ? fallback : 0;
            nodes[child].outputs.push(...nodes[nodes[child].failure].outputs);
            queue.push(child);
        }
    }
    if (atoms.length === 0 || contextualMatchers.size === 0)
        throw new Error("WT sensitive source catalog is empty");
    for (const category of new Set(atoms.map(atom => atom.category)))
        if (!matcherCategories.has(category))
            throw new Error("WT sensitive source category has no matcher");
    return { longMatcher: nodes, longPatterns: patterns, contextualMatchers, scopedMatchers };
}
function matchLongValues(content, matcher, patterns) {
    const matchedPatterns = new Set();
    let node = 0;
    for (let index = 0; index < content.length; index++) {
        const byte = content[index];
        while (node !== 0 && !matcher[node].next.has(byte))
            node = matcher[node].failure;
        node = matcher[node].next.get(byte) ?? 0;
        for (const patternId of matcher[node].outputs) {
            const pattern = patterns[patternId], start = index - pattern.anchorLength + 1, end = start + pattern.bytes.length;
            if (start >= 0 && end <= content.length && content.subarray(start, end).equals(pattern.bytes))
                matchedPatterns.add(patternId);
        }
    }
    return [...matchedPatterns].map(patternId => ({ category: patterns[patternId].category, structuralCategory: "literal", foundPath: `$literal:${patterns[patternId].structuralCategory}` }));
}
function buildWtSensitiveCatalog(harText) {
    let parsed;
    try {
        parsed = JSON.parse(harText);
    }
    catch {
        throw new Error("WT sensitive source is not valid JSON");
    }
    const root = record(parsed), log = record(root?.log), entries = log?.entries;
    if (!Array.isArray(entries) || entries.length === 0)
        throw new Error("WT sensitive source is not a HAR entry collection");
    const atoms = [];
    for (const rawEntry of entries) {
        const entry = record(rawEntry), request = record(entry?.request), response = record(entry?.response);
        if (!entry || !request || !response || typeof request.url !== "string" || typeof request.method !== "string" || !request.method.trim())
            throw new Error("WT sensitive source contains a malformed entry");
        let url;
        try {
            url = new URL(request.url);
        }
        catch {
            throw new Error("WT sensitive source contains an invalid URL");
        }
        const method = request.method.trim().toUpperCase(), endpoint = sanitizeEndpoint(url), requestContext = { origin: "request", method, endpoint }, responseContext = { origin: "response", method, endpoint };
        collectHeaders(request.headers, atoms, requestContext, "$.request.headers");
        collectHeaders(response.headers, atoms, responseContext, "$.response.headers");
        collectCookies(request.cookies, atoms, requestContext, "$.request.cookies");
        collectCookies(response.cookies, atoms, responseContext, "$.response.cookies");
        collectUrl(url, atoms, requestContext, "$.request.url");
        collectQuery(request.queryString, atoms, requestContext, "$.request.queryString", `${url.origin}${url.pathname}`);
        collectBodyText(request.postData, "request_body", atoms, requestContext);
        collectBodyText(response.content, "response_body", atoms, responseContext);
    }
    const unique = deduplicateAtoms(atoms);
    const categoryValueCounts = Object.fromEntries(REQUIRED_SOURCE_CATEGORIES.map(category => [category, unique.filter(atom => atom.category === category).length]));
    if (Object.keys(categoryValueCounts).length !== REQUIRED_SOURCE_CATEGORIES.length)
        throw new Error("WT sensitive source category coverage failed");
    if (unique.length === 0)
        throw new Error("WT sensitive source catalog is empty");
    const matchers = buildMatchers(unique);
    const catalog = Object.freeze({ schemaVersion: 1, sourceSha256: sha256(harText), sourceSizeBytes: Buffer.byteLength(harText), entryCount: entries.length, sensitiveValueCount: unique.length, categoryValueCounts: Object.freeze(categoryValueCounts) });
    catalogStates.set(catalog, { atoms: unique, ...matchers });
    return catalog;
}
exports.buildWtSensitiveCatalog = buildWtSensitiveCatalog;
function addTargetObservation(target, structuralCategory, value, path, context = path, capture) {
    const kind = scalarKind(value);
    if (!kind)
        throw new Error("WT audit target contains an unsupported scalar");
    target.push({ structuralCategory, path, context: capture ? scopedCaptureContext(capture, context) : context, kind, canonicalValue: canonicalScalar(value, kind), ...(capture ? { captureScoped: true } : {}) });
}
function collectTargetJsonScalars(value, target, path = "$", matcherPath = path, shapeFingerprint = jsonShapeFingerprint(value), capture) {
    const kind = scalarKind(value);
    if (kind) {
        const structuralContext = `${shapeFingerprint}\0${matcherPath}`;
        addTargetObservation(target, "json_body", value, path, structuralContext, capture);
        return;
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++)
            collectTargetJsonScalars(value[index], target, `${path}[${index}]`, `${matcherPath}[${index}]`, shapeFingerprint, capture);
        return;
    }
    const row = record(value);
    if (!row)
        throw new Error("WT audit target JSON contains an unsupported value");
    for (const [key, child] of Object.entries(row))
        collectTargetJsonScalars(child, target, childJsonPath(path, key), childJsonPath(matcherPath, key), shapeFingerprint, capture);
}
function collectTargetCookiePairs(value, headerName, target, path, capture) {
    const parts = value.split(";"), selected = normalizedName(headerName) === "set-cookie" ? parts.slice(0, 1) : parts;
    for (let index = 0; index < selected.length; index++) {
        const equals = selected[index].indexOf("=");
        if (equals <= 0)
            continue;
        const name = selected[index].slice(0, equals).trim(), cookieValue = selected[index].slice(equals + 1).trim();
        if (name)
            addTargetObservation(target, "cookie", cookieValue, `${path}[${index}]`, name, capture);
    }
}
function collectTargetUrl(value, target, path, strict = false, capture) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        if (strict)
            throw new Error("WT audit target contains an invalid URL structure");
        return false;
    }
    if (!/^https?:$/.test(url.protocol)) {
        if (strict)
            throw new Error("WT audit target URL scheme is unsupported");
        return false;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    for (let index = 0; index < segments.length; index++)
        addTargetObservation(target, "url_path_segment", decodedComponent(segments[index]), `${path}.path[${index}]`, `${url.origin}${url.pathname}\0${index}`, capture);
    let queryIndex = 0;
    for (const [name, queryValue] of url.searchParams) {
        addTargetObservation(target, "query_name", name, `${path}.query[${queryIndex}].name`, `${url.origin}${url.pathname}\0${name}`, capture);
        addTargetObservation(target, "query_value", queryValue, `${path}.query[${queryIndex}].value`, `${url.origin}${url.pathname}\0${name}`, capture);
        queryIndex += 1;
    }
    if (url.username)
        addTargetObservation(target, "url_username", decodedComponent(url.username), `${path}.username`, "username", capture);
    if (url.password)
        addTargetObservation(target, "url_password", decodedComponent(url.password), `${path}.password`, "password", capture);
    return true;
}
function collectTargetNamedArray(value, kind, target, path, urlPath = "", capture) {
    if (!Array.isArray(value))
        return;
    for (let index = 0; index < value.length; index++) {
        const row = record(value[index]);
        if (!row || typeof row.name !== "string" || !row.name.trim() || !scalarKind(row.value))
            throw new Error(`WT audit target ${kind} structure is malformed`);
        const itemPath = `${path}[${index}]`;
        if (kind === "headers") {
            if (typeof row.value !== "string")
                throw new Error("WT audit target headers structure is malformed");
            addTargetObservation(target, "header", row.value, `${itemPath}.value`, normalizedName(row.name), capture);
            if (/^(?:cookie|set-cookie)$/i.test(row.name.trim()))
                collectTargetCookiePairs(row.value, row.name, target, `${itemPath}.cookie`, capture);
        }
        else if (kind === "cookies")
            addTargetObservation(target, "cookie", row.value, `${itemPath}.value`, row.name.trim(), capture);
        else {
            addTargetObservation(target, "query_name", row.name, `${itemPath}.name`, `${urlPath}\0${row.name}`, capture);
            addTargetObservation(target, "query_value", row.value, `${itemPath}.value`, `${urlPath}\0${row.name}`, capture);
        }
    }
}
function recognizedHeaderName(value) {
    const name = normalizedName(value);
    return name.includes("-") || /^(?:accept|authorization|cache-control|connection|content-length|content-type|cookie|date|etag|expires|host|if-match|if-none-match|location|origin|pragma|referer|set-cookie|user-agent|vary)$/.test(name);
}
function targetCaptureContext(value) {
    const hasCaptureField = Object.prototype.hasOwnProperty.call(value, "origin") || (Object.prototype.hasOwnProperty.call(value, "body") && Object.prototype.hasOwnProperty.call(value, "url"));
    if (!hasCaptureField)
        return null;
    if ((value.origin !== "request" && value.origin !== "response") || typeof value.method !== "string" || !value.method.trim() || typeof value.url !== "string")
        throw new Error("WT audit target capture context is malformed");
    let url;
    try {
        url = new URL(value.url);
    }
    catch {
        throw new Error("WT audit target capture context contains an invalid URL");
    }
    if (!/^https?:$/.test(url.protocol))
        throw new Error("WT audit target capture context URL scheme is unsupported");
    return { origin: value.origin, method: value.method.trim().toUpperCase(), endpoint: sanitizeEndpoint(url) };
}
function collectTargetStructures(value, target, path = "$", parentKey = "", inheritedCapture) {
    const kind = scalarKind(value);
    if (kind) {
        if (kind === "string") {
            const text = JSON.parse(canonicalScalar(value, kind));
            if (/^https?:\/\//.test(text))
                collectTargetUrl(text, target, path, normalizedName(parentKey) === "url", inheritedCapture);
        }
        return;
    }
    if (Array.isArray(value)) {
        const normalized = normalizedName(parentKey);
        if (normalized === "headers")
            collectTargetNamedArray(value, "headers", target, path, "", inheritedCapture);
        else if (normalized === "cookies")
            collectTargetNamedArray(value, "cookies", target, path, "", inheritedCapture);
        else if (normalized === "querystring" || normalized === "query")
            collectTargetNamedArray(value, "query", target, path, "", inheritedCapture);
        for (let index = 0; index < value.length; index++)
            collectTargetStructures(value[index], target, `${path}[${index}]`, parentKey, inheritedCapture);
        return;
    }
    const row = record(value);
    if (!row)
        throw new Error("WT audit target structure is unsupported");
    const capture = targetCaptureContext(row) ?? inheritedCapture;
    if (capture && Object.prototype.hasOwnProperty.call(row, "body"))
        collectTargetJsonScalars(row.body, target, childJsonPath(path, "body"), "$", jsonShapeFingerprint(row.body), capture);
    if (typeof row.name === "string" && typeof row.value === "string" && recognizedHeaderName(row.name)) {
        addTargetObservation(target, "header", row.value, childJsonPath(path, "value"), normalizedName(row.name), capture);
        if (/^(?:cookie|set-cookie)$/i.test(row.name.trim()))
            collectTargetCookiePairs(row.value, row.name, target, `${path}.cookie`, capture);
    }
    if (typeof row.url === "string" && Array.isArray(row.queryString)) {
        let requestUrl;
        try {
            requestUrl = new URL(row.url);
        }
        catch {
            throw new Error("WT audit target contains an invalid URL structure");
        }
        collectTargetNamedArray(row.queryString, "query", target, childJsonPath(path, "queryString"), `${requestUrl.origin}${requestUrl.pathname}`, capture);
    }
    if (typeof row.text === "string" && (normalizedName(parentKey) === "postdata" || normalizedName(parentKey) === "content")) {
        let embedded, parsed = false;
        try {
            embedded = JSON.parse(row.text);
            parsed = true;
        }
        catch {
            if (typeof row.mimeType === "string" && JSON_MIME.test(row.mimeType.trim()))
                throw new Error("WT audit target JSON body is malformed");
        }
        if (parsed)
            collectTargetJsonScalars(embedded, target, `${path}.text$body`, "$");
        else
            addTargetObservation(target, "text_body", row.text, `${path}.text$body`, "text_exact");
    }
    for (const [key, child] of Object.entries(row)) {
        if (capture && key === "body")
            continue;
        collectTargetStructures(child, target, childJsonPath(path, key), key, capture);
    }
}
function staticPropertyName(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node))
        return node.text;
    return null;
}
function unwrapStaticExpression(node) {
    let current = node;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current))
        current = current.expression;
    return current;
}
function evaluateStaticExpression(node) {
    const current = unwrapStaticExpression(node);
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))
        return { ok: true, value: current.text };
    if (ts.isNumericLiteral(current))
        return { ok: true, value: Number(current.text) };
    if (current.kind === ts.SyntaxKind.TrueKeyword)
        return { ok: true, value: true };
    if (current.kind === ts.SyntaxKind.FalseKeyword)
        return { ok: true, value: false };
    if (current.kind === ts.SyntaxKind.NullKeyword)
        return { ok: true, value: null };
    if (ts.isPrefixUnaryExpression(current) && (current.operator === ts.SyntaxKind.MinusToken || current.operator === ts.SyntaxKind.PlusToken)) {
        const operand = evaluateStaticExpression(current.operand);
        if (!operand.ok || typeof operand.value !== "number")
            return { ok: false };
        return { ok: true, value: current.operator === ts.SyntaxKind.MinusToken ? -operand.value : operand.value };
    }
    if (ts.isArrayLiteralExpression(current)) {
        const values = [];
        for (const element of current.elements) {
            if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
                return { ok: false };
            const result = evaluateStaticExpression(element);
            if (!result.ok)
                return { ok: false };
            values.push(result.value);
        }
        return { ok: true, value: values };
    }
    if (ts.isObjectLiteralExpression(current)) {
        const value = {};
        for (const property of current.properties) {
            if (!ts.isPropertyAssignment(property))
                return { ok: false };
            const name = staticPropertyName(property.name), result = evaluateStaticExpression(property.initializer);
            if (name === null || !result.ok)
                return { ok: false };
            value[name] = result.value;
        }
        return { ok: true, value };
    }
    return { ok: false };
}
function staticRootExpression(node) {
    if (ts.isVariableDeclaration(node) && node.initializer)
        return node.initializer;
    if (ts.isPropertyDeclaration(node) && node.initializer)
        return node.initializer;
    if (ts.isExportAssignment(node))
        return node.expression;
    if (ts.isReturnStatement(node) && node.expression)
        return node.expression;
    return null;
}
function staticRootName(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        return node.name.text;
    if (ts.isPropertyDeclaration(node) && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)))
        return node.name.text;
    if (ts.isExportAssignment(node))
        return "exportedJson";
    if (ts.isReturnStatement(node)) {
        let parent = node.parent;
        while (parent && !ts.isFunctionDeclaration(parent) && !ts.isMethodDeclaration(parent) && !ts.isFunctionExpression(parent) && !ts.isArrowFunction(parent))
            parent = parent.parent;
        if (parent && (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isFunctionExpression(parent)) && parent.name && ts.isIdentifier(parent.name))
            return parent.name.text;
    }
    return "";
}
function permitsStaticPrimitive(name) { return /(?:body|payload|fixture|json|leak)/i.test(name); }
function collectTargetTypeScript(text, target) {
    const source = ts.createSourceFile("audit-target.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let rootIndex = 0;
    const visit = (node) => {
        const expression = staticRootExpression(node);
        if (expression) {
            const unwrapped = unwrapStaticExpression(expression), result = evaluateStaticExpression(unwrapped);
            const parentKey = staticRootName(node), composite = Array.isArray(result.ok ? result.value : undefined) || record(result.ok ? result.value : undefined) !== null;
            if (result.ok && (composite || permitsStaticPrimitive(parentKey))) {
                const rootPath = `$typescript[${rootIndex}]`;
                collectTargetJsonScalars(result.value, target, rootPath, "$", jsonShapeFingerprint(result.value));
                collectTargetStructures(result.value, target, rootPath, parentKey);
                rootIndex += 1;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}
function collectTargetText(text, target) {
    const headerLine = /^\s*([A-Za-z][A-Za-z0-9-]*)\s*:\s*([^\r\n]*)\s*$/gm;
    let headerIndex = 0;
    for (const match of text.matchAll(headerLine)) {
        const name = match[1], value = match[2].trim(), path = `$text.headers[${headerIndex}]`;
        addTargetObservation(target, "header", value, path, normalizedName(name));
        if (/^(?:cookie|set-cookie)$/i.test(name))
            collectTargetCookiePairs(value, name, target, `${path}.cookie`);
        headerIndex += 1;
    }
    let urlIndex = 0;
    for (const match of text.matchAll(URL_TOKEN)) {
        const candidate = match[0].replace(/[),.;\]}]+$/, "");
        if (collectTargetUrl(candidate, target, `$text.urls[${urlIndex}]`))
            urlIndex += 1;
    }
    const trimmed = text.trim();
    if (trimmed && trimmed.length <= 4096 && !/[\r\n]/.test(trimmed) && !/^[A-Za-z][A-Za-z0-9-]*\s*:/.test(trimmed) && !/^https?:\/\//.test(trimmed))
        addTargetObservation(target, "text_body", trimmed, "$text.exact", "text_exact");
}
function deduplicateTargetObservations(values) {
    const unique = new Map();
    for (const value of values)
        unique.set(`${value.structuralCategory}\0${value.path}\0${value.context}\0${value.captureScoped ? "scoped" : "unscoped"}\0${value.kind}\0${value.canonicalValue}`, value);
    return [...unique.values()];
}
function isHarBuffer(content) {
    let parsed;
    try {
        parsed = JSON.parse(content.toString("utf8"));
    }
    catch {
        return false;
    }
    const root = record(parsed), log = record(root?.log);
    return Array.isArray(log?.entries);
}
function scanContent(content, state) {
    const matches = matchLongValues(content, state.longMatcher, state.longPatterns), text = content.toString("utf8"), observations = [];
    let parsed, json = false;
    try {
        parsed = JSON.parse(text);
        json = true;
    }
    catch { /* arbitrary non-JSON versioned blobs are scanned literally and as conservative text */ }
    if (json) {
        collectTargetJsonScalars(parsed, observations);
        collectTargetStructures(parsed, observations);
    }
    else {
        collectTargetText(text, observations);
        collectTargetTypeScript(text, observations);
    }
    for (const observation of deduplicateTargetObservations(observations)) {
        const key = contextualKey(observation.structuralCategory, observation.kind, observation.canonicalValue, observation.context);
        const matcher = observation.captureScoped ? state.scopedMatchers : state.contextualMatchers;
        for (const category of matcher.get(key) ?? [])
            matches.push({ category, structuralCategory: observation.structuralCategory, foundPath: observation.path });
    }
    const unique = new Map();
    for (const match of matches)
        unique.set(`${match.category}\0${match.structuralCategory}\0${match.foundPath}`, match);
    const rows = [...unique.values()].sort((left, right) => `${left.category}\0${left.structuralCategory}\0${left.foundPath}`.localeCompare(`${right.category}\0${right.structuralCategory}\0${right.foundPath}`));
    return { categories: [...new Set(rows.map(value => value.category))].sort(), matches: rows, rawHar: isHarBuffer(content) };
}
function emptyCategoryCounts() {
    return { tip: 0, history_old: 0, history_new: 0, fixture: 0, spec: 0, generated: 0, other: 0 };
}
function emptyMatchCounts() {
    return { headers: 0, cookies: 0, url_path: 0, query: 0, url_credentials: 0, request_body: 0, response_body: 0 };
}
function scanTargetSequence(catalog, sequence, policy, cacheByBlobIdentity = false, preScannedBlobs = new Map()) {
    const state = catalogStates.get(catalog);
    if (!state)
        throw new Error("WT sensitive catalog is not an active catalog");
    const allowedHistoricalHarTargets = new Set(policy.allowedHistoricalHarTargetFingerprints);
    if (allowedHistoricalHarTargets.size !== policy.allowedHistoricalHarTargetFingerprints.length || [...allowedHistoricalHarTargets].some(value => !/^[0-9a-f]{64}$/.test(value)))
        throw new Error("WT historical HAR allowlist is invalid");
    const categoryTargetCounts = emptyCategoryCounts(), sensitiveMatchCategoryCounts = emptyMatchCounts(), matchedTargets = [], blobs = new Set();
    const harStructureTargets = [], observedAllowedHistoricalHarTargets = new Set();
    const scannedBlobs = new Map(preScannedBlobs);
    let targetCount = 0, sensitiveMatchCount = 0, harStructureTargetCount = 0, tipHarStructureTargetCount = 0, rawHarTargetCount = 0;
    for (const target of sequence) {
        targetCount += 1;
        categoryTargetCounts[target.category] += 1;
        let contentIdentity = target.blobId, scanned = contentIdentity && cacheByBlobIdentity ? scannedBlobs.get(contentIdentity) : undefined;
        if (!scanned) {
            let content;
            try {
                content = target.content();
            }
            catch {
                throw new Error("WT audit target blob is unreadable");
            }
            if (!Buffer.isBuffer(content))
                throw new Error("WT audit target is not a buffer");
            contentIdentity = target.blobId ?? sha256(content);
            scanned = scanContent(content, state);
            if (cacheByBlobIdentity && target.blobId)
                scannedBlobs.set(target.blobId, scanned);
        }
        blobs.add(contentIdentity);
        const categories = scanned.categories, harStructure = scanned.rawHar;
        const structuralFingerprint = target.pathHash && target.blobId ? sha256(`${target.category}\0${target.pathHash}\0${target.blobId}`) : sha256(`${target.category}\0${target.targetId}\0${contentIdentity}`);
        const isHistorical = target.category === "history_old" || target.category === "history_new";
        const allowedHistoricalHar = harStructure && isHistorical && allowedHistoricalHarTargets.has(structuralFingerprint);
        const rawHar = harStructure && !allowedHistoricalHar;
        if (harStructure) {
            harStructureTargetCount += 1;
            harStructureTargets.push({ category: target.category, fingerprint: structuralFingerprint });
        }
        if (harStructure && target.category === "tip")
            tipHarStructureTargetCount += 1;
        if (allowedHistoricalHar)
            observedAllowedHistoricalHarTargets.add(structuralFingerprint);
        if (rawHar)
            rawHarTargetCount += 1;
        sensitiveMatchCount += scanned.matches.length;
        for (const category of categories)
            sensitiveMatchCategoryCounts[category] += 1;
        if (rawHar || categories.length)
            matchedTargets.push({ targetId: sha256(target.targetId), ...(target.blobId ? { blobId: target.blobId } : {}), categories, rawHar, matches: scanned.matches.map(match => ({ category: match.category, structuralCategory: match.structuralCategory, foundPathHash: sha256(match.foundPath) })) });
    }
    if (targetCount === 0)
        throw new Error("WT audit target collection is empty");
    harStructureTargets.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
    const historicalHarAllowlistSatisfied = observedAllowedHistoricalHarTargets.size === allowedHistoricalHarTargets.size;
    return { schemaVersion: 1, valid: sensitiveMatchCount === 0 && rawHarTargetCount === 0 && tipHarStructureTargetCount === 0 && historicalHarAllowlistSatisfied, targetCount, uniqueBlobCount: blobs.size, sensitiveValueCount: state.atoms.length, sensitiveMatchCount, harStructureTargetCount, tipHarStructureTargetCount, rawHarTargetCount, historicalHarAllowlistCount: allowedHistoricalHarTargets.size, historicalHarAllowlistSatisfied, harStructureTargets, categoryTargetCounts, sensitiveMatchCategoryCounts, matchedTargets };
}
function scanWtAuditTargets(catalog, targets, policy = { allowedHistoricalHarTargetFingerprints: [] }) {
    const gitState = gitStates.get(targets);
    if (gitState) {
        const catalogState = catalogStates.get(catalog);
        if (!catalogState)
            throw new Error("WT sensitive catalog is not an active catalog");
        const scanned = scanGitBlobs(gitState.repoRoot, [...new Set(gitState.descriptors.map(value => value.blobId))], catalogState);
        return scanTargetSequence(catalog, gitState.descriptors.map(descriptor => ({ targetId: descriptor.targetId, category: descriptor.category, blobId: descriptor.blobId, pathHash: descriptor.pathHash, content: () => { throw new Error("WT git audit pre-scan omitted a blob"); } })), policy, true, scanned);
    }
    if (!Array.isArray(targets))
        throw new Error("WT audit target collection is invalid");
    return scanTargetSequence(catalog, targets.map(target => {
        if (!target || typeof target.targetId !== "string" || !target.targetId || !Buffer.isBuffer(target.content) || !emptyCategoryCounts().hasOwnProperty(target.category))
            throw new Error("WT audit target descriptor is invalid");
        return { targetId: target.targetId, category: target.category, blobId: target.blobId, content: () => target.content };
    }), policy);
}
exports.scanWtAuditTargets = scanWtAuditTargets;
function git(repoRoot, args, encoding) {
    try {
        return (0, child_process_1.execFileSync)("git", args, { cwd: repoRoot, encoding: encoding === "buffer" ? undefined : "utf8", maxBuffer: 1024 * 1024 * 1024, timeout: 30000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    }
    catch {
        throw new Error("WT git audit command failed");
    }
}
function commitId(repoRoot, revision) {
    const result = git(repoRoot, ["rev-parse", "--verify", `${revision}^{commit}`], "utf8").trim();
    if (!OBJECT_ID.test(result))
        throw new Error("WT git audit revision is invalid");
    return result;
}
function splitNull(buffer) {
    const result = [];
    let start = 0;
    for (let index = 0; index < buffer.length; index++)
        if (buffer[index] === 0) {
            result.push(buffer.subarray(start, index));
            start = index + 1;
        }
    if (start !== buffer.length)
        throw new Error("WT git audit output is malformed");
    return result;
}
function gitWithInput(repoRoot, args, input, maxBuffer) {
    try {
        return (0, child_process_1.execFileSync)("git", args, { cwd: repoRoot, input, encoding: undefined, maxBuffer, timeout: 30000, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    }
    catch {
        throw new Error("WT git audit blob batch is unreadable");
    }
}
function scanGitBlobs(repoRoot, blobIds, state) {
    if (blobIds.length === 0 || blobIds.some(value => !OBJECT_ID.test(value)))
        throw new Error("WT git audit blob collection is invalid");
    const ordered = [...blobIds].sort(), input = `${ordered.join("\n")}\n`;
    const check = gitWithInput(repoRoot, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], input, Math.max(1024 * 1024, ordered.length * 128)).toString("ascii").trim().split(/\r?\n/);
    if (check.length !== ordered.length)
        throw new Error("WT git audit blob inventory is incomplete");
    const sizes = new Map();
    for (let index = 0; index < check.length; index++) {
        const fields = check[index].split(" "), size = Number(fields[2]);
        if (fields.length !== 3 || fields[0] !== ordered[index] || fields[1] !== "blob" || !Number.isSafeInteger(size) || size < 0)
            throw new Error("WT git audit blob inventory is malformed");
        sizes.set(fields[0], size);
    }
    const chunks = [];
    let current = [], currentBytes = 0;
    for (const blobId of ordered) {
        const size = sizes.get(blobId);
        if (size > 512 * 1024 * 1024)
            throw new Error("WT git audit blob exceeds the bounded scanner size");
        if (current.length && currentBytes + size > 32 * 1024 * 1024) {
            chunks.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(blobId);
        currentBytes += size;
    }
    if (current.length)
        chunks.push(current);
    const result = new Map();
    for (const chunk of chunks) {
        const expectedBytes = chunk.reduce((sum, value) => sum + sizes.get(value), 0), output = gitWithInput(repoRoot, ["cat-file", "--batch"], `${chunk.join("\n")}\n`, expectedBytes + chunk.length * 256 + 1024 * 1024);
        let offset = 0;
        for (const expectedId of chunk) {
            const newline = output.indexOf(10, offset);
            if (newline < 0)
                throw new Error("WT git audit blob batch header is missing");
            const fields = output.subarray(offset, newline).toString("ascii").split(" "), size = Number(fields[2]);
            if (fields.length !== 3 || fields[0] !== expectedId || fields[1] !== "blob" || size !== sizes.get(expectedId))
                throw new Error("WT git audit blob batch header is malformed");
            const start = newline + 1, end = start + size;
            if (end >= output.length || output[end] !== 10)
                throw new Error("WT git audit blob batch body is truncated");
            const content = output.subarray(start, end);
            result.set(expectedId, scanContent(content, state));
            offset = end + 1;
        }
        if (offset !== output.length)
            throw new Error("WT git audit blob batch has trailing bytes");
    }
    if (result.size !== ordered.length)
        throw new Error("WT git audit blob scan is incomplete");
    return result;
}
function addDescriptor(target, path, blobId, category, commit, side) {
    if (!OBJECT_ID.test(blobId))
        throw new Error("WT git audit object identity is malformed");
    const pathHash = sha256(path), targetId = sha256(`${category}\0${commit}\0${side}\0${pathHash}\0${blobId}`);
    target.push({ targetId, pathHash, blobId, category });
}
function collectWtGitAuditTargets(repoRoot, base, tip) {
    if (!repoRoot || !base || !tip)
        throw new Error("WT git audit range is invalid");
    const baseCommit = commitId(repoRoot, base), tipCommit = commitId(repoRoot, tip);
    try {
        git(repoRoot, ["merge-base", "--is-ancestor", baseCommit, tipCommit], "buffer");
    }
    catch {
        throw new Error("WT git audit range is invalid");
    }
    if (baseCommit === tipCommit)
        throw new Error("WT git audit range is empty");
    const commits = git(repoRoot, ["rev-list", "--reverse", `${baseCommit}..${tipCommit}`], "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (commits.length === 0 || commits.some(value => !OBJECT_ID.test(value)))
        throw new Error("WT git audit range is invalid");
    const descriptors = [];
    const tipTree = splitNull(git(repoRoot, ["ls-tree", "-r", "-z", "--full-tree", tipCommit], "buffer"));
    for (const item of tipTree) {
        if (item.length === 0)
            continue;
        const tab = item.indexOf(9);
        if (tab < 0)
            throw new Error("WT git audit tree output is malformed");
        const metadata = item.subarray(0, tab).toString("ascii").split(" "), path = item.subarray(tab + 1);
        if (metadata.length !== 3)
            throw new Error("WT git audit tree output is malformed");
        if (metadata[1] === "blob")
            addDescriptor(descriptors, path, metadata[2], "tip", tipCommit, "tip");
    }
    for (const commit of commits) {
        const parts = splitNull(git(repoRoot, ["diff-tree", "-r", "--root", "-m", "--raw", "-z", "--no-abbrev", "--no-commit-id", commit], "buffer"));
        for (let index = 0; index < parts.length;) {
            if (parts[index].length === 0) {
                index += 1;
                continue;
            }
            const metadata = parts[index++].toString("ascii");
            if (!metadata.startsWith(":"))
                throw new Error("WT git audit diff output is malformed");
            if (index >= parts.length)
                throw new Error("WT git audit diff path is missing");
            const oldPath = parts[index++], fields = metadata.slice(1).split(" ");
            if (fields.length !== 5)
                throw new Error("WT git audit diff metadata is malformed");
            const [oldMode, newMode, oldId, newId, status] = fields;
            if (!/^[ACDMRTUXB][0-9]*$/.test(status))
                throw new Error("WT git audit diff status is unsupported");
            const newPath = /^[RC]/.test(status) ? (index < parts.length ? parts[index++] : (() => { throw new Error("WT git audit renamed path is missing"); })()) : oldPath;
            if (oldMode !== "000000" && oldMode !== "160000" && !ZERO_OBJECT_ID.test(oldId))
                addDescriptor(descriptors, oldPath, oldId, "history_old", commit, "old");
            if (newMode !== "000000" && newMode !== "160000" && !ZERO_OBJECT_ID.test(newId))
                addDescriptor(descriptors, newPath, newId, "history_new", commit, "new");
        }
    }
    if (descriptors.length === 0)
        throw new Error("WT git audit target collection is empty");
    const categoryTargetCounts = Object.fromEntries(REQUIRED_GIT_TARGET_CATEGORIES.map(category => [category, descriptors.filter(value => value.category === category).length]));
    if (Object.keys(categoryTargetCounts).length !== REQUIRED_GIT_TARGET_CATEGORIES.length || categoryTargetCounts.tip === 0)
        throw new Error("WT git audit category coverage failed");
    const result = Object.freeze({ schemaVersion: 1, baseCommit, tipCommit, commitCount: commits.length, targetCount: descriptors.length, uniqueBlobCount: new Set(descriptors.map(value => value.blobId)).size, categoryTargetCounts: Object.freeze(categoryTargetCounts), targetIds: Object.freeze(descriptors.map(value => value.targetId).sort()), blobIds: Object.freeze([...new Set(descriptors.map(value => value.blobId))].sort()), pathHashes: Object.freeze([...new Set(descriptors.map(value => value.pathHash))].sort()) });
    gitStates.set(result, { repoRoot, descriptors });
    return result;
}
exports.collectWtGitAuditTargets = collectWtGitAuditTargets;
//# sourceMappingURL=wt-campaign-scanner.js.map