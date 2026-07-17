import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { promisify } from "util";
import { DokkanInfoItemCatalogManifest } from "./dokkaninfo-item-catalog";

const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_CATALOG_PATH = "data/dokkaninfo-items/latest/item-catalog.json";
const DEFAULT_MANIFEST_PATH = "data/dokkaninfo-items/latest/item-catalog-manifest.json";
const MAX_DEFAULT_UPLOAD_BYTES = 50 * 1024 * 1024;
const execFileAsync = promisify(execFile);

export interface ItemCatalogPublishOptions {
    bucket: string,
    catalogPath: string,
    manifestPath: string,
    dryRun: boolean,
    target: "remote" | "local",
    maxUploadBytes: number,
}

export interface ItemCatalogPublishPlan {
    bucket: string,
    target: "remote" | "local",
    catalogPath: string,
    manifestPath: string,
    catalogObjectKey: string,
    manifestObjectKey: string,
    catalogBytes: number,
    manifestBytes: number,
    totalBytes: number,
    datasetVersion: string,
    sha256: string,
}

export function parseItemCatalogPublishArgs(argv: string[]): ItemCatalogPublishOptions {
    const values = new Map<string, string>();
    const flags = new Set<string>();

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }

        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }

        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            flags.add(name);
            continue;
        }

        values.set(name, nextToken);
        index += 1;
    }

    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET;
    const target = flags.has("--local") ? "local" : "remote";
    if (flags.has("--local") && flags.has("--remote")) {
        throw new Error("Choose only one of --local or --remote.");
    }

    return {
        bucket,
        catalogPath: resolve(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        dryRun: flags.has("--dry-run"),
        target,
        maxUploadBytes: parsePositiveNumber(
            values.get("--max-upload-bytes"),
            MAX_DEFAULT_UPLOAD_BYTES,
        ),
    };
}

export function buildItemCatalogPublishPlan(
    options: ItemCatalogPublishOptions,
    manifest: DokkanInfoItemCatalogManifest,
    catalogBytes: number,
    manifestBytes: number,
): ItemCatalogPublishPlan {
    if (manifest.fileName !== "item-catalog.json") {
        throw new Error(`Unexpected item catalog file name in manifest: ${manifest.fileName}`);
    }

    const totalBytes = catalogBytes + manifestBytes;
    if (totalBytes > options.maxUploadBytes) {
        throw new Error(
            `Item catalog upload is ${totalBytes} bytes, above the configured limit of ${options.maxUploadBytes} bytes.`,
        );
    }

    return {
        bucket: options.bucket,
        target: options.target,
        catalogPath: options.catalogPath,
        manifestPath: options.manifestPath,
        catalogObjectKey: manifest.fileName,
        manifestObjectKey: "item-catalog-manifest.json",
        catalogBytes,
        manifestBytes,
        totalBytes,
        datasetVersion: manifest.datasetVersion,
        sha256: manifest.sha256,
    };
}

async function main(): Promise<void> {
    const options = parseItemCatalogPublishArgs(process.argv.slice(2));
    const plan = await readPublishPlan(options);
    printPlan(plan);

    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects were changed.");
        return;
    }

    await uploadObject(
        plan.bucket,
        plan.catalogObjectKey,
        plan.catalogPath,
        "application/json",
        "public, max-age=31536000, immutable",
        plan.target,
    );
    await uploadObject(
        plan.bucket,
        plan.manifestObjectKey,
        plan.manifestPath,
        "application/json",
        "no-store",
        plan.target,
    );
    console.log("Item catalog R2 publish complete.");
}

async function readPublishPlan(options: ItemCatalogPublishOptions): Promise<ItemCatalogPublishPlan> {
    if (!existsSync(options.catalogPath)) {
        throw new Error(`Catalog not found: ${options.catalogPath}`);
    }
    if (!existsSync(options.manifestPath)) {
        throw new Error(`Manifest not found: ${options.manifestPath}`);
    }

    const catalogBuffer = await readFile(options.catalogPath);
    const manifestBuffer = await readFile(options.manifestPath);
    const manifest = JSON.parse(manifestBuffer.toString("utf8")) as DokkanInfoItemCatalogManifest;

    if (manifest.sizeBytes !== catalogBuffer.byteLength) {
        throw new Error(
            `Catalog size ${catalogBuffer.byteLength} does not match manifest size ${manifest.sizeBytes}.`,
        );
    }

    const actualSha256 = createHash("sha256").update(catalogBuffer).digest("hex");
    if (actualSha256.toLowerCase() !== manifest.sha256.toLowerCase()) {
        throw new Error("Catalog SHA-256 does not match the manifest.");
    }

    return buildItemCatalogPublishPlan(
        options,
        manifest,
        catalogBuffer.byteLength,
        manifestBuffer.byteLength,
    );
}

function printPlan(plan: ItemCatalogPublishPlan): void {
    console.log(`Target: ${plan.target}`);
    console.log(`Bucket: ${plan.bucket}`);
    console.log(`Catalog: ${plan.catalogBytes} bytes -> ${plan.catalogObjectKey}`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${plan.manifestObjectKey}`);
    console.log(`Total upload: ${plan.totalBytes} bytes`);
    console.log(`Dataset version: ${plan.datasetVersion}`);
    console.log(`SHA-256: ${plan.sha256}`);
}

async function uploadObject(
    bucket: string,
    objectKey: string,
    filePath: string,
    contentType: string,
    cacheControl: string,
    target: "remote" | "local",
): Promise<void> {
    const args = [
        "r2",
        "object",
        "put",
        `${bucket}/${objectKey}`,
        "--file",
        filePath,
        "--content-type",
        contentType,
        "--cache-control",
        cacheControl,
        target === "remote" ? "--remote" : "--local",
    ];

    if (process.platform === "win32") {
        await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
        return;
    }

    await execFileAsync("npx", ["wrangler", ...args]);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid positive number: ${value}`);
    }
    return parsed;
}

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
