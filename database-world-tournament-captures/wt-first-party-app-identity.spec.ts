import { equal, rejects } from "assert";
import { createHash } from "crypto";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import * as ts from "typescript";
import * as productiveModule from "./wt-first-party-app-identity";

interface TestContract {
    apk: { sizeBytes: number; sha256: string };
    tool: { sizeBytes: number; sha256: string; version: string };
    identity: { sizeBytes: number; sha256: string };
    versionArgs: (privateApk: string) => string[];
    badgingArgs: (privateApk: string) => string[];
    versionTimeoutMs: number;
    badgingTimeoutMs: number;
    versionOutputLimitBytes: number;
    badgingOutputLimitBytes: number;
    stderrLimitBytes: number;
}
interface Fixture {
    root: string;
    sourceRoot: string;
    privateRoot: string;
    apk: string;
    tool: string;
    identity: string;
    contract: TestContract;
}

const digest = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

function sourceFile(): string {
    const colocated = resolve(__dirname, "wt-first-party-app-identity.ts");
    return existsSync(colocated) ? colocated : resolve(__dirname, "..", "..", "database-world-tournament-captures", "wt-first-party-app-identity.ts");
}

function loadInternalHarness(): { extractWithContract: (apk: string, tool: string, privateRoot: string, contract: TestContract, hooks?: Record<string, Function>) => Promise<any> } {
    const path = sourceFile(), instrumented = `${readFileSync(path, "utf8")}\nexport const __wtFirstPartyTest = { extractWithContract };\n`;
    const emitted = ts.transpileModule(instrumented, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path, reportDiagnostics: true });
    const errors = (emitted.diagnostics ?? []).filter(value => value.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0) throw new Error("WT internal test harness did not transpile");
    const loaded = { exports: {} as any };
    new Function("require", "module", "exports", "__filename", "__dirname", emitted.outputText)(require, loaded, loaded.exports, path, dirname(path));
    return loaded.exports.__wtFirstPartyTest;
}

const internal = loadInternalHarness();

function script(identity: string, mode = "normal"): string {
    return [
        `const mode = ${JSON.stringify(mode)};`,
        "const operation = process.argv[2];",
        "if (mode === 'timeout') setInterval(() => undefined, 1000);",
        "else if (mode === 'stdout') process.stdout.write('x'.repeat(4096));",
        "else if (mode === 'stderr') process.stderr.write('x'.repeat(4096));",
        "else if (mode === 'exit') process.exit(23);",
        `else if (operation === 'version') process.stdout.write('synthetic-tool-v1\\n');`,
        `else if (operation === 'badging') process.stdout.write(${JSON.stringify(`package: name='${identity}' versionCode='1'\n`)});`,
        "else process.exit(24);",
        "",
    ].join("\n");
}

function fixture(mode = "normal"): Fixture {
    const root = mkdtempSync(join(tmpdir(), "wt-private-snapshot-test-")), sourceRoot = join(root, "external"), privateRoot = join(root, "private");
    mkdirSync(sourceRoot, { mode: 0o700 }); mkdirSync(privateRoot, { mode: 0o700 });
    const identity = "synthetic.first.party.identity", apk = join(sourceRoot, "source.apk"), tool = join(sourceRoot, "aapt.exe"), apkText = script(identity, mode);
    writeFileSync(apk, apkText, { flag: "wx", mode: 0o500 }); copyFileSync(process.execPath, tool); chmodSync(tool, 0o500);
    const apkBytes = readFileSync(apk), toolBytes = readFileSync(tool);
    return {
        root, sourceRoot, privateRoot, apk, tool, identity,
        contract: {
            apk: { sizeBytes: apkBytes.length, sha256: digest(apkBytes) }, tool: { sizeBytes: toolBytes.length, sha256: digest(toolBytes), version: "synthetic-tool-v1" }, identity: { sizeBytes: Buffer.byteLength(identity), sha256: digest(identity) },
            versionArgs: privateApk => [privateApk, "version"], badgingArgs: privateApk => [privateApk, "badging"], versionTimeoutMs: 250, badgingTimeoutMs: 250, versionOutputLimitBytes: 512, badgingOutputLimitBytes: 1024, stderrLimitBytes: 512,
        },
    };
}

function dispose(value: Fixture): void { rmSync(value.root, { recursive: true, force: true }); }
async function succeeds(value: Fixture, hooks?: Record<string, Function>): Promise<any> { return internal.extractWithContract(value.apk, value.tool, value.privateRoot, value.contract, hooks); }

describe("WT first-party private snapshot boundary", function () {
    this.timeout(10000);

    it("does not export productive test hooks or the generic extractor", () => {
        equal(Object.prototype.hasOwnProperty.call(productiveModule, "extractWithContract"), false);
        equal(Object.keys(productiveModule).some(name => /hook|test/i.test(name)), false);
    });

    it("uses opened APK bytes when the external pathname changes A to B", async () => {
        const value = fixture(), held = join(value.sourceRoot, "apk-a-held"); let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => { renameSync(value.apk, held); writeFileSync(value.apk, "B"); }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof) equal(proof.packageIdentity, value.identity); else equal(materialized, false);
        } finally { dispose(value); }
    });

    it("executes opened aapt bytes when the external pathname changes A to B", async () => {
        const value = fixture(), held = join(value.sourceRoot, "tool-a-held"); let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => { renameSync(value.tool, held); writeFileSync(value.tool, "B"); }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof) equal(proof.packageIdentity, value.identity); else equal(materialized, false);
        } finally { dispose(value); }
    });

    it("does not inspect external A-B-A bytes", async () => {
        const value = fixture(), apkHeld = join(value.sourceRoot, "apk-a-held"), toolHeld = join(value.sourceRoot, "tool-a-held"); let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => {
                renameSync(value.apk, apkHeld); writeFileSync(value.apk, "B"); unlinkSync(value.apk); renameSync(apkHeld, value.apk);
                renameSync(value.tool, toolHeld); writeFileSync(value.tool, "B"); unlinkSync(value.tool); renameSync(toolHeld, value.tool);
            }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof) equal(proof.packageIdentity, value.identity); else equal(materialized, false);
        } finally { dispose(value); }
    });

    it("rejects a pathname swap before either pinned source is opened", async () => {
        const apk = fixture(), tool = fixture();
        try {
            chmodSync(apk.apk, 0o600); writeFileSync(apk.apk, `${readFileSync(apk.apk, "utf8")}B`);
            await rejects(succeeds(apk), /private snapshot extraction failed/);
            chmodSync(tool.tool, 0o600); writeFileSync(tool.tool, Buffer.from("B"));
            await rejects(succeeds(tool), /private snapshot extraction failed/);
        } finally { dispose(apk); dispose(tool); }
    });

    it("rejects snapshot byte changes before and after execution", async () => {
        const before = fixture(), after = fixture();
        try {
            await rejects(succeeds(before, { afterSnapshotsMaterialized: ({ apkSnapshot }: any) => { chmodSync(apkSnapshot, 0o600); const bytes = readFileSync(apkSnapshot); bytes[0] ^= 1; writeFileSync(apkSnapshot, bytes); } }), /private snapshot extraction failed/);
            await rejects(succeeds(after, { afterExecution: ({ apkSnapshot }: any) => { chmodSync(apkSnapshot, 0o600); const bytes = readFileSync(apkSnapshot); bytes[0] ^= 1; writeFileSync(apkSnapshot, bytes); } }), /private snapshot extraction failed/);
        } finally { dispose(before); dispose(after); }
    });

    it("rejects junction sources and junction destinations", async () => {
        const source = fixture(), destination = fixture(), junction = join(source.root, "source-junction");
        try {
            symlinkSync(source.sourceRoot, junction, "junction");
            await rejects(internal.extractWithContract(join(junction, "source.apk"), join(junction, "aapt.exe"), source.privateRoot, source.contract), /private snapshot extraction failed/);
            await rejects(succeeds(destination, { afterPrivateDirectoryCreated: ({ apkSnapshot }: any) => symlinkSync(destination.sourceRoot, apkSnapshot, "junction") }), /private snapshot extraction failed/);
        } finally { dispose(source); dispose(destination); }
    });

    it("rejects relative sources and unexpected source hard links", async () => {
        const relativeSource = fixture(), hardLinked = fixture();
        try {
            await rejects(internal.extractWithContract("relative-source.apk", relativeSource.tool, relativeSource.privateRoot, relativeSource.contract), /private snapshot extraction failed/);
            linkSync(hardLinked.apk, join(hardLinked.sourceRoot, "apk-hard-link"));
            await rejects(succeeds(hardLinked), /private snapshot extraction failed/);
        } finally { dispose(relativeSource); dispose(hardLinked); }
    });

    it("rejects preexisting destinations", async () => {
        const value = fixture();
        try {
            await rejects(succeeds(value, { afterPrivateDirectoryCreated: ({ apkSnapshot }: any) => writeFileSync(apkSnapshot, "occupied", { flag: "wx" }) }), /private snapshot extraction failed/);
            const residue = readdirSync(value.privateRoot);
            equal(residue.length, 1); equal(residue[0].startsWith(".wt-first-party-quarantine-"), true);
        }
        finally { dispose(value); }
    });

    it("rejects a same-byte regular-file replacement by material identity", async () => {
        const value = fixture();
        try {
            await rejects(succeeds(value, { afterSnapshotsMaterialized: ({ apkSnapshot }: any) => {
                const bytes = readFileSync(apkSnapshot), displaced = `${apkSnapshot}.displaced`;
                renameSync(apkSnapshot, displaced); writeFileSync(apkSnapshot, bytes, { flag: "wx", mode: 0o400 });
            } }), /private snapshot extraction failed/);
            const residue = readdirSync(value.privateRoot);
            equal(residue.length, 1); equal(residue[0].startsWith(".wt-first-party-quarantine-"), true);
        } finally { dispose(value); }
    });

    it("rejects snapshot hash, size, timestamp, type and hard-link divergence", async () => {
        const mutations: Array<(context: any) => void> = [
            ({ apkSnapshot }) => { chmodSync(apkSnapshot, 0o600); const bytes = readFileSync(apkSnapshot); bytes[0] ^= 1; writeFileSync(apkSnapshot, bytes); },
            ({ apkSnapshot }) => { chmodSync(apkSnapshot, 0o600); writeFileSync(apkSnapshot, Buffer.concat([readFileSync(apkSnapshot), Buffer.from("x")])); },
            ({ apkSnapshot }) => utimesSync(apkSnapshot, new Date(1000), new Date(1000)),
            ({ apkSnapshot }) => { renameSync(apkSnapshot, `${apkSnapshot}.held`); mkdirSync(apkSnapshot); },
            ({ directory, apkSnapshot }) => linkSync(apkSnapshot, join(directory, "unexpected-hard-link")),
        ];
        for (const mutate of mutations) {
            const value = fixture();
            try { await rejects(succeeds(value, { afterSnapshotsMaterialized: mutate }), /private snapshot extraction failed/); }
            finally { dispose(value); }
        }
    });

    it("rejects timeout, stdout/stderr overflow and nonzero exit", async () => {
        for (const mode of ["timeout", "stdout", "stderr", "exit"]) {
            const value = fixture(mode);
            try { await rejects(succeeds(value), /private snapshot extraction failed/); }
            finally { dispose(value); }
        }
    });

    it("cleans a normal namespace and refuses cleanup after ownership changes", async () => {
        const normal = fixture(), raced = fixture(); let owned = "", replacement = "";
        try {
            await succeeds(normal); equal(readdirSync(normal.privateRoot).length, 0);
            await rejects(succeeds(raced, { beforeCleanup: ({ directory }: any) => { owned = `${directory}.owned`; replacement = directory; renameSync(directory, owned); mkdirSync(replacement); } }), /private snapshot cleanup failed/);
            equal(existsSync(owned), true); equal(existsSync(replacement), true);
        } finally { dispose(normal); dispose(raced); }
    });
});
