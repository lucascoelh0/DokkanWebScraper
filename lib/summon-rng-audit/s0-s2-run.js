"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const path_1 = require("path");
const s0_s2_contract_1 = require("./s0-s2-contract");
const s0_s2_profile_1 = require("./s0-s2-profile");
function arg(name) {
    const index = process.argv.indexOf(name);
    if (index < 0 || !process.argv[index + 1])
        throw new Error(`Missing required ${name}`);
    return (0, path_1.resolve)(process.argv[index + 1]);
}
async function readRegularFile(path) {
    const handle = await (0, promises_1.open)(path, "r");
    try {
        const stat = await handle.stat();
        if (!stat.isFile())
            throw new Error(`Not a regular file: ${path}`);
        return await handle.readFile();
    }
    finally {
        await handle.close();
    }
}
async function run() {
    const paths = {
        "global-apk-6-4-0": arg("--apk"),
        "global-elf-6-4-0": arg("--elf"),
        "global-sqlite-current-2026-08-05": arg("--sqlite-current"),
        "global-sqlite-backup-2026-08-05": arg("--sqlite-backup"),
    };
    const failures = [];
    for (const artifact of s0_s2_profile_1.S0_S2_ARTIFACTS) {
        const bytes = await readRegularFile(paths[artifact.id]);
        failures.push(...(0, s0_s2_profile_1.validatePinnedArtifactBytes)(artifact, bytes));
        if (artifact.role === "elf")
            failures.push(...(0, s0_s2_profile_1.validatePinnedElf)(bytes));
    }
    const audit = (0, s0_s2_profile_1.buildS0S2Audit)();
    const contract = (0, s0_s2_contract_1.validateS0S2Audit)(audit);
    failures.push(...contract.failures.map(value => `contract: ${value}`));
    if (failures.length > 0)
        throw new Error([...new Set(failures)].join("; "));
    process.stdout.write(`${JSON.stringify({ audit, validation: contract }, null, 2)}\n`);
}
if (require.main === module)
    run().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
//# sourceMappingURL=s0-s2-run.js.map