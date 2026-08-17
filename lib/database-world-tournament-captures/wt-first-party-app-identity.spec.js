"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const ts = require("typescript");
const productiveModule = require("./wt-first-party-app-identity");
const digest = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function sourceFile() {
    const colocated = (0, path_1.resolve)(__dirname, "wt-first-party-app-identity.ts");
    return (0, fs_1.existsSync)(colocated) ? colocated : (0, path_1.resolve)(__dirname, "..", "..", "database-world-tournament-captures", "wt-first-party-app-identity.ts");
}
function loadInternalHarness() {
    const path = sourceFile(), instrumented = `${(0, fs_1.readFileSync)(path, "utf8")}\nexport const __wtFirstPartyTest = { extractWithContract };\n`;
    const emitted = ts.transpileModule(instrumented, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path, reportDiagnostics: true });
    const errors = (emitted.diagnostics ?? []).filter(value => value.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0)
        throw new Error("WT internal test harness did not transpile");
    const loaded = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", emitted.outputText)(require, loaded, loaded.exports, path, (0, path_1.dirname)(path));
    return loaded.exports.__wtFirstPartyTest;
}
const internal = loadInternalHarness();
function script(identity, mode = "normal") {
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
function fixture(mode = "normal") {
    const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-private-snapshot-test-")), sourceRoot = (0, path_1.join)(root, "external"), privateRoot = (0, path_1.join)(root, "private");
    (0, fs_1.mkdirSync)(sourceRoot, { mode: 0o700 });
    (0, fs_1.mkdirSync)(privateRoot, { mode: 0o700 });
    const identity = "synthetic.first.party.identity", apk = (0, path_1.join)(sourceRoot, "source.apk"), tool = (0, path_1.join)(sourceRoot, "aapt.exe"), apkText = script(identity, mode);
    (0, fs_1.writeFileSync)(apk, apkText, { flag: "wx", mode: 0o500 });
    (0, fs_1.copyFileSync)(process.execPath, tool);
    (0, fs_1.chmodSync)(tool, 0o500);
    const apkBytes = (0, fs_1.readFileSync)(apk), toolBytes = (0, fs_1.readFileSync)(tool);
    return {
        root, sourceRoot, privateRoot, apk, tool, identity,
        contract: {
            apk: { sizeBytes: apkBytes.length, sha256: digest(apkBytes) }, tool: { sizeBytes: toolBytes.length, sha256: digest(toolBytes), version: "synthetic-tool-v1" }, identity: { sizeBytes: Buffer.byteLength(identity), sha256: digest(identity) },
            versionArgs: privateApk => [privateApk, "version"], badgingArgs: privateApk => [privateApk, "badging"], versionTimeoutMs: 250, badgingTimeoutMs: 250, versionOutputLimitBytes: 512, badgingOutputLimitBytes: 1024, stderrLimitBytes: 512,
        },
    };
}
function dispose(value) { (0, fs_1.rmSync)(value.root, { recursive: true, force: true }); }
async function succeeds(value, hooks) { return internal.extractWithContract(value.apk, value.tool, value.privateRoot, value.contract, hooks); }
describe("WT first-party private snapshot boundary", function () {
    this.timeout(10000);
    it("does not export productive test hooks or the generic extractor", () => {
        (0, assert_1.equal)(Object.prototype.hasOwnProperty.call(productiveModule, "extractWithContract"), false);
        (0, assert_1.equal)(Object.keys(productiveModule).some(name => /hook|test/i.test(name)), false);
    });
    it("uses opened APK bytes when the external pathname changes A to B", async () => {
        const value = fixture(), held = (0, path_1.join)(value.sourceRoot, "apk-a-held");
        let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => { (0, fs_1.renameSync)(value.apk, held); (0, fs_1.writeFileSync)(value.apk, "B"); }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof)
                (0, assert_1.equal)(proof.packageIdentity, value.identity);
            else
                (0, assert_1.equal)(materialized, false);
        }
        finally {
            dispose(value);
        }
    });
    it("executes opened aapt bytes when the external pathname changes A to B", async () => {
        const value = fixture(), held = (0, path_1.join)(value.sourceRoot, "tool-a-held");
        let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => { (0, fs_1.renameSync)(value.tool, held); (0, fs_1.writeFileSync)(value.tool, "B"); }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof)
                (0, assert_1.equal)(proof.packageIdentity, value.identity);
            else
                (0, assert_1.equal)(materialized, false);
        }
        finally {
            dispose(value);
        }
    });
    it("does not inspect external A-B-A bytes", async () => {
        const value = fixture(), apkHeld = (0, path_1.join)(value.sourceRoot, "apk-a-held"), toolHeld = (0, path_1.join)(value.sourceRoot, "tool-a-held");
        let materialized = false;
        try {
            const proof = await succeeds(value, { afterSourcesOpened: () => {
                    (0, fs_1.renameSync)(value.apk, apkHeld);
                    (0, fs_1.writeFileSync)(value.apk, "B");
                    (0, fs_1.unlinkSync)(value.apk);
                    (0, fs_1.renameSync)(apkHeld, value.apk);
                    (0, fs_1.renameSync)(value.tool, toolHeld);
                    (0, fs_1.writeFileSync)(value.tool, "B");
                    (0, fs_1.unlinkSync)(value.tool);
                    (0, fs_1.renameSync)(toolHeld, value.tool);
                }, afterSnapshotsMaterialized: () => { materialized = true; } }).catch(() => undefined);
            if (proof)
                (0, assert_1.equal)(proof.packageIdentity, value.identity);
            else
                (0, assert_1.equal)(materialized, false);
        }
        finally {
            dispose(value);
        }
    });
    it("rejects a pathname swap before either pinned source is opened", async () => {
        const apk = fixture(), tool = fixture();
        try {
            (0, fs_1.chmodSync)(apk.apk, 0o600);
            (0, fs_1.writeFileSync)(apk.apk, `${(0, fs_1.readFileSync)(apk.apk, "utf8")}B`);
            await (0, assert_1.rejects)(succeeds(apk), /private snapshot extraction failed/);
            (0, fs_1.chmodSync)(tool.tool, 0o600);
            (0, fs_1.writeFileSync)(tool.tool, Buffer.from("B"));
            await (0, assert_1.rejects)(succeeds(tool), /private snapshot extraction failed/);
        }
        finally {
            dispose(apk);
            dispose(tool);
        }
    });
    it("rejects snapshot byte changes before and after execution", async () => {
        const before = fixture(), after = fixture();
        try {
            await (0, assert_1.rejects)(succeeds(before, { afterSnapshotsMaterialized: ({ apkSnapshot }) => { (0, fs_1.chmodSync)(apkSnapshot, 0o600); const bytes = (0, fs_1.readFileSync)(apkSnapshot); bytes[0] ^= 1; (0, fs_1.writeFileSync)(apkSnapshot, bytes); } }), /private snapshot extraction failed/);
            await (0, assert_1.rejects)(succeeds(after, { afterExecution: ({ apkSnapshot }) => { (0, fs_1.chmodSync)(apkSnapshot, 0o600); const bytes = (0, fs_1.readFileSync)(apkSnapshot); bytes[0] ^= 1; (0, fs_1.writeFileSync)(apkSnapshot, bytes); } }), /private snapshot extraction failed/);
        }
        finally {
            dispose(before);
            dispose(after);
        }
    });
    it("rejects junction sources and junction destinations", async () => {
        const source = fixture(), destination = fixture(), junction = (0, path_1.join)(source.root, "source-junction");
        try {
            (0, fs_1.symlinkSync)(source.sourceRoot, junction, "junction");
            await (0, assert_1.rejects)(internal.extractWithContract((0, path_1.join)(junction, "source.apk"), (0, path_1.join)(junction, "aapt.exe"), source.privateRoot, source.contract), /private snapshot extraction failed/);
            await (0, assert_1.rejects)(succeeds(destination, { afterPrivateDirectoryCreated: ({ apkSnapshot }) => (0, fs_1.symlinkSync)(destination.sourceRoot, apkSnapshot, "junction") }), /private snapshot extraction failed/);
        }
        finally {
            dispose(source);
            dispose(destination);
        }
    });
    it("rejects relative sources and unexpected source hard links", async () => {
        const relativeSource = fixture(), hardLinked = fixture();
        try {
            await (0, assert_1.rejects)(internal.extractWithContract("relative-source.apk", relativeSource.tool, relativeSource.privateRoot, relativeSource.contract), /private snapshot extraction failed/);
            (0, fs_1.linkSync)(hardLinked.apk, (0, path_1.join)(hardLinked.sourceRoot, "apk-hard-link"));
            await (0, assert_1.rejects)(succeeds(hardLinked), /private snapshot extraction failed/);
        }
        finally {
            dispose(relativeSource);
            dispose(hardLinked);
        }
    });
    it("rejects preexisting destinations", async () => {
        const value = fixture();
        try {
            await (0, assert_1.rejects)(succeeds(value, { afterPrivateDirectoryCreated: ({ apkSnapshot }) => (0, fs_1.writeFileSync)(apkSnapshot, "occupied", { flag: "wx" }) }), /private snapshot extraction failed/);
            const residue = (0, fs_1.readdirSync)(value.privateRoot);
            (0, assert_1.equal)(residue.length, 1);
            (0, assert_1.equal)(residue[0].startsWith(".wt-first-party-quarantine-"), true);
        }
        finally {
            dispose(value);
        }
    });
    it("rejects a same-byte regular-file replacement by material identity", async () => {
        const value = fixture();
        try {
            await (0, assert_1.rejects)(succeeds(value, { afterSnapshotsMaterialized: ({ apkSnapshot }) => {
                    const bytes = (0, fs_1.readFileSync)(apkSnapshot), displaced = `${apkSnapshot}.displaced`;
                    (0, fs_1.renameSync)(apkSnapshot, displaced);
                    (0, fs_1.writeFileSync)(apkSnapshot, bytes, { flag: "wx", mode: 0o400 });
                } }), /private snapshot extraction failed/);
            const residue = (0, fs_1.readdirSync)(value.privateRoot);
            (0, assert_1.equal)(residue.length, 1);
            (0, assert_1.equal)(residue[0].startsWith(".wt-first-party-quarantine-"), true);
        }
        finally {
            dispose(value);
        }
    });
    it("rejects snapshot hash, size, timestamp, type and hard-link divergence", async () => {
        const mutations = [
            ({ apkSnapshot }) => { (0, fs_1.chmodSync)(apkSnapshot, 0o600); const bytes = (0, fs_1.readFileSync)(apkSnapshot); bytes[0] ^= 1; (0, fs_1.writeFileSync)(apkSnapshot, bytes); },
            ({ apkSnapshot }) => { (0, fs_1.chmodSync)(apkSnapshot, 0o600); (0, fs_1.writeFileSync)(apkSnapshot, Buffer.concat([(0, fs_1.readFileSync)(apkSnapshot), Buffer.from("x")])); },
            ({ apkSnapshot }) => (0, fs_1.utimesSync)(apkSnapshot, new Date(1000), new Date(1000)),
            ({ apkSnapshot }) => { (0, fs_1.renameSync)(apkSnapshot, `${apkSnapshot}.held`); (0, fs_1.mkdirSync)(apkSnapshot); },
            ({ directory, apkSnapshot }) => (0, fs_1.linkSync)(apkSnapshot, (0, path_1.join)(directory, "unexpected-hard-link")),
        ];
        for (const mutate of mutations) {
            const value = fixture();
            try {
                await (0, assert_1.rejects)(succeeds(value, { afterSnapshotsMaterialized: mutate }), /private snapshot extraction failed/);
            }
            finally {
                dispose(value);
            }
        }
    });
    it("rejects timeout, stdout/stderr overflow and nonzero exit", async () => {
        for (const mode of ["timeout", "stdout", "stderr", "exit"]) {
            const value = fixture(mode);
            try {
                await (0, assert_1.rejects)(succeeds(value), /private snapshot extraction failed/);
            }
            finally {
                dispose(value);
            }
        }
    });
    it("cleans a normal namespace and refuses cleanup after ownership changes", async () => {
        const normal = fixture(), raced = fixture();
        let owned = "", replacement = "";
        try {
            await succeeds(normal);
            (0, assert_1.equal)((0, fs_1.readdirSync)(normal.privateRoot).length, 0);
            await (0, assert_1.rejects)(succeeds(raced, { beforeCleanup: ({ directory }) => { owned = `${directory}.owned`; replacement = directory; (0, fs_1.renameSync)(directory, owned); (0, fs_1.mkdirSync)(replacement); } }), /private snapshot cleanup failed/);
            (0, assert_1.equal)((0, fs_1.existsSync)(owned), true);
            (0, assert_1.equal)((0, fs_1.existsSync)(replacement), true);
        }
        finally {
            dispose(normal);
            dispose(raced);
        }
    });
});
//# sourceMappingURL=wt-first-party-app-identity.spec.js.map