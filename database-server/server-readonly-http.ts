import { createHash } from "crypto";

export interface ServerHttpReceipt {
    url: string;
    fetchedAt: string;
    status: number;
    mediaType?: string;
    sizeBytes: number;
    sha256: string;
    responseHeaders: Record<string, string>;
    attemptCount: number;
}

export interface ServerHttpResponse {
    body: Buffer;
    receipt: ServerHttpReceipt;
}

export interface ServerReadonlyHttpOptions {
    allowedHosts: string[];
    minimumIntervalMs?: number;
    maximumResponseBytes?: number;
    maximumAggregateBytes?: number;
    maximumAttempts?: number;
    fetchImpl?: typeof fetch;
    now?: () => number;
    random?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
}

const SAFE_RESPONSE_HEADERS = ["cache-control", "content-length", "content-type", "date", "etag", "last-modified"];
const FORBIDDEN_QUERY_KEY = /(auth|token|session|cookie|device|user|signature|attestation|password|secret)/i;

export class ServerReadonlyHttpClient {
    private readonly allowedHosts: Set<string>;
    private readonly minimumIntervalMs: number;
    private readonly maximumResponseBytes: number;
    private readonly maximumAggregateBytes: number;
    private readonly maximumAttempts: number;
    private readonly fetchImpl: typeof fetch;
    private readonly now: () => number;
    private readonly random: () => number;
    private readonly sleep: (milliseconds: number) => Promise<void>;
    private tail: Promise<void> = Promise.resolve();
    private lastRequestAt = 0;
    private aggregateBytes = 0;
    private readonly blockedUntilByHost = new Map<string, number>();

    constructor(options: ServerReadonlyHttpOptions) {
        this.allowedHosts = new Set(options.allowedHosts.map(value => value.toLowerCase()));
        this.minimumIntervalMs = options.minimumIntervalMs ?? 1000;
        this.maximumResponseBytes = options.maximumResponseBytes ?? 5 * 1024 * 1024;
        this.maximumAggregateBytes = options.maximumAggregateBytes ?? 50 * 1024 * 1024;
        this.maximumAttempts = options.maximumAttempts ?? 3;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.now = options.now ?? Date.now;
        this.random = options.random ?? Math.random;
        this.sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
        if (this.minimumIntervalMs < 0 || this.maximumResponseBytes <= 0 || this.maximumAggregateBytes <= 0 || this.maximumAttempts < 1 || this.maximumAttempts > 3) throw new Error("Invalid read-only HTTP limits.");
    }

    get totalBytes(): number { return this.aggregateBytes; }

    async get(urlValue: string): Promise<ServerHttpResponse> {
        let release!: () => void;
        const previous = this.tail;
        this.tail = new Promise<void>(resolve => { release = resolve; });
        await previous;
        try {
            return await this.getSerial(urlValue);
        } finally {
            release();
        }
    }

    private async getSerial(urlValue: string): Promise<ServerHttpResponse> {
        const url = new URL(urlValue);
        if (url.protocol !== "https:" || url.username || url.password || !this.allowedHosts.has(url.hostname.toLowerCase())) throw new Error(`URL is outside the read-only allowlist: ${url.origin}`);
        const blockedUntil = this.blockedUntilByHost.get(url.hostname.toLowerCase()) ?? 0;
        if (blockedUntil > this.now()) throw new Error(`Endpoint family remains blocked by Retry-After until ${new Date(blockedUntil).toISOString()}`);
        for (const key of url.searchParams.keys()) if (FORBIDDEN_QUERY_KEY.test(key)) throw new Error(`Sensitive query key is prohibited: ${key}`);
        if (this.aggregateBytes + this.maximumResponseBytes > this.maximumAggregateBytes) throw new Error(`S1 projected response ceiling exceeds aggregate limit: ${this.aggregateBytes} + ${this.maximumResponseBytes} > ${this.maximumAggregateBytes}`);

        let lastStatus = 0;
        for (let attempt = 1; attempt <= this.maximumAttempts; attempt += 1) {
            const waitMs = Math.max(0, this.minimumIntervalMs - (this.now() - this.lastRequestAt));
            if (waitMs > 0) await this.sleep(waitMs);
            this.lastRequestAt = this.now();
            const response = await this.fetchImpl(url.toString(), {
                method: "GET",
                redirect: "manual",
                credentials: "omit",
                headers: {
                    "Accept": "text/html,application/json;q=0.9,*/*;q=0.1",
                    "Accept-Language": "en-US,en;q=0.9",
                    "User-Agent": "Dokkanpanion-readonly-source-research/0.1",
                },
            });
            lastStatus = response.status;
            if (response.status >= 300 && response.status < 400) throw new Error(`Redirects are prohibited for ${url.host}: ${response.status}`);
            if (response.status === 429 || response.status >= 500) {
                const retryAfter = response.headers.get("retry-after"), numericSeconds = retryAfter === null ? NaN : Number(retryAfter), retryDate = retryAfter === null || Number.isFinite(numericSeconds) ? NaN : Date.parse(retryAfter);
                const requestedWait = Number.isFinite(numericSeconds) ? Math.max(0, numericSeconds * 1000) : Number.isFinite(retryDate) ? Math.max(0, retryDate - this.now()) : undefined;
                if (requestedWait !== undefined && requestedWait > 30000) {
                    this.blockedUntilByHost.set(url.hostname.toLowerCase(), this.now() + requestedWait);
                    await response.body?.cancel();
                    throw new Error(`Retry-After exceeds bounded wait; endpoint family stopped: ${requestedWait}ms`);
                }
                if (attempt === this.maximumAttempts) {
                    if (requestedWait !== undefined && requestedWait > 0) this.blockedUntilByHost.set(url.hostname.toLowerCase(), this.now() + requestedWait);
                    await response.body?.cancel();
                    break;
                }
                const backoff = requestedWait === undefined ? Math.min(30000, 1000 * 2 ** (attempt - 1)) : Math.max(1000, requestedWait);
                await response.body?.cancel();
                await this.sleep(backoff + Math.floor(this.random() * 251));
                continue;
            }
            if (!response.ok) throw new Error(`Read-only GET failed for ${url.host}: ${response.status}`);
            const declaredLength = Number(response.headers.get("content-length"));
            if (Number.isFinite(declaredLength) && declaredLength > this.maximumResponseBytes) {
                await response.body?.cancel();
                throw new Error(`Response exceeds per-request limit: ${declaredLength}`);
            }
            const body = await this.readBoundedBody(response);
            this.aggregateBytes += body.length;
            const responseHeaders = Object.fromEntries(SAFE_RESPONSE_HEADERS.flatMap(name => {
                const value = response.headers.get(name);
                return value === null ? [] : [[name, value]];
            }));
            return {
                body,
                receipt: {
                    url: url.toString(),
                    fetchedAt: new Date(this.now()).toISOString(),
                    status: response.status,
                    mediaType: response.headers.get("content-type") ?? undefined,
                    sizeBytes: body.length,
                    sha256: createHash("sha256").update(body).digest("hex"),
                    responseHeaders,
                    attemptCount: attempt,
                },
            };
        }
        throw new Error(`Read-only GET exhausted retries for ${url.host}: ${lastStatus}`);
    }

    private async readBoundedBody(response: Response): Promise<Buffer> {
        if (!response.body) return Buffer.alloc(0);
        const reader = response.body.getReader(), chunks: Buffer[] = [];
        let sizeBytes = 0;
        try {
            while (true) {
                const value = await reader.read();
                if (value.done) break;
                const chunk = Buffer.from(value.value); sizeBytes += chunk.length;
                if (sizeBytes > this.maximumResponseBytes) {
                    await reader.cancel();
                    throw new Error(`Response exceeds per-request limit after streamed bytes: ${sizeBytes}`);
                }
                chunks.push(chunk);
            }
        } finally {
            reader.releaseLock();
        }
        return Buffer.concat(chunks, sizeBytes);
    }
}
