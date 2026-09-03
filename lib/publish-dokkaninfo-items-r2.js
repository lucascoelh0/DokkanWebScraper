"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildItemCatalogPublishPlan = exports.parseItemCatalogPublishArgs = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_CATALOG_PATH = "data/dokkaninfo-items/latest/item-catalog.json";
const DEFAULT_MANIFEST_PATH = "data/dokkaninfo-items/latest/item-catalog-manifest.json";
const MAX_DEFAULT_UPLOAD_BYTES = 50 * 1024 * 1024;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function parseItemCatalogPublishArgs(argv) {
    const values = new Map();
    const flags = new Set();
    const valueArguments = new Set([
        "--bucket",
        "--catalog",
        "--manifest",
        "--max-upload-bytes",
        "--channel",
    ]);
    const flagArguments = new Set(["--dry-run", "--local", "--remote"]);
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const [name, inlineValue] = token.split("=", 2);
        if (!valueArguments.has(name) && !flagArguments.has(name)) {
            throw new Error(`Unknown argument: ${name}`);
        }
        if (inlineValue !== undefined) {
            if (!valueArguments.has(name) || inlineValue.trim() === "") {
                throw new Error(`Invalid value for ${name}.`);
            }
            values.set(name, inlineValue);
            continue;
        }
        if (flagArguments.has(name)) {
            flags.add(name);
            continue;
        }
        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            throw new Error(`Missing value for ${name}.`);
        }
        values.set(name, nextToken);
        index += 1;
    }
    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET;
    const channel = parsePublishChannel(values.get("--channel"));
    const target = flags.has("--local") ? "local" : "remote";
    if (flags.has("--local") && flags.has("--remote")) {
        throw new Error("Choose only one of --local or --remote.");
    }
    return {
        bucket,
        channel,
        objectPrefix: channel === "staging" ? "staging/v2" : "",
        catalogPath: (0, path_1.resolve)(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        dryRun: flags.has("--dry-run"),
        target,
        maxUploadBytes: parsePositiveNumber(values.get("--max-upload-bytes"), MAX_DEFAULT_UPLOAD_BYTES),
    };
}
exports.parseItemCatalogPublishArgs = parseItemCatalogPublishArgs;
function buildItemCatalogPublishPlan(options, manifest, catalogBytes, manifestBytes) {
    if (manifest.fileName !== "item-catalog.json") {
        throw new Error(`Unexpected item catalog file name in manifest: ${manifest.fileName}`);
    }
    const totalBytes = catalogBytes + manifestBytes;
    if (totalBytes > options.maxUploadBytes) {
        throw new Error(`Item catalog upload is ${totalBytes} bytes, above the configured limit of ${options.maxUploadBytes} bytes.`);
    }
    return {
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        objectPrefix: options.objectPrefix,
        catalogPath: options.catalogPath,
        manifestPath: options.manifestPath,
        catalogObjectKey: prefixedObjectKey(options.objectPrefix, manifest.fileName),
        manifestObjectKey: prefixedObjectKey(options.objectPrefix, "item-catalog-manifest.json"),
        catalogBytes,
        manifestBytes,
        totalBytes,
        datasetVersion: manifest.datasetVersion,
        sha256: manifest.sha256,
    };
}
exports.buildItemCatalogPublishPlan = buildItemCatalogPublishPlan;
async function main() {
    const options = parseItemCatalogPublishArgs(process.argv.slice(2));
    const plan = await readPublishPlan(options);
    printPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No R2 objects were changed.");
        return;
    }
    await uploadObject(plan.bucket, plan.catalogObjectKey, plan.catalogPath, "application/json", "no-cache", plan.target);
    await uploadObject(plan.bucket, plan.manifestObjectKey, plan.manifestPath, "application/json", "no-store", plan.target);
    console.log("Item catalog R2 publish complete.");
}
async function readPublishPlan(options) {
    if (!(0, fs_1.existsSync)(options.catalogPath)) {
        throw new Error(`Catalog not found: ${options.catalogPath}`);
    }
    if (!(0, fs_1.existsSync)(options.manifestPath)) {
        throw new Error(`Manifest not found: ${options.manifestPath}`);
    }
    const catalogBuffer = await (0, promises_1.readFile)(options.catalogPath);
    const manifestBuffer = await (0, promises_1.readFile)(options.manifestPath);
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    if (manifest.sizeBytes !== catalogBuffer.byteLength) {
        throw new Error(`Catalog size ${catalogBuffer.byteLength} does not match manifest size ${manifest.sizeBytes}.`);
    }
    const actualSha256 = (0, crypto_1.createHash)("sha256").update(catalogBuffer).digest("hex");
    if (actualSha256.toLowerCase() !== manifest.sha256.toLowerCase()) {
        throw new Error("Catalog SHA-256 does not match the manifest.");
    }
    return buildItemCatalogPublishPlan(options, manifest, catalogBuffer.byteLength, manifestBuffer.byteLength);
}
function printPlan(plan) {
    console.log(`Target: ${plan.target}`);
    console.log(`Bucket: ${plan.bucket}`);
    console.log(`Channel: ${plan.channel}`);
    console.log(`Catalog: ${plan.catalogBytes} bytes -> ${plan.catalogObjectKey}`);
    console.log(`Manifest: ${plan.manifestBytes} bytes -> ${plan.manifestObjectKey}`);
    console.log(`Total upload: ${plan.totalBytes} bytes`);
    console.log(`Dataset version: ${plan.datasetVersion}`);
    console.log(`SHA-256: ${plan.sha256}`);
}
function parsePublishChannel(value) {
    if (value === "production" || value === "staging")
        return value;
    if (!value) {
        throw new Error("Choose an explicit item catalog publish channel with --channel production or --channel staging.");
    }
    throw new Error(`Invalid item catalog publish channel: ${value}`);
}
function prefixedObjectKey(prefix, fileName) {
    return prefix ? `${prefix}/${fileName}` : fileName;
}
async function uploadObject(bucket, objectKey, filePath, contentType, cacheControl, target) {
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
function parsePositiveNumber(value, fallback) {
    if (!value)
        return fallback;
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
//# sourceMappingURL=publish-dokkaninfo-items-r2.js.map