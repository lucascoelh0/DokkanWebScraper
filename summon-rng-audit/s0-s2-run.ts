import { open } from "fs/promises";
import { resolve } from "path";
import { validateS0S2Audit } from "./s0-s2-contract";
import { buildS0S2Audit, S0_S2_ARTIFACTS, validatePinnedArtifactBytes, validatePinnedElf } from "./s0-s2-profile";

function arg(name: string): string {
    const index = process.argv.indexOf(name);
    if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required ${name}`);
    return resolve(process.argv[index + 1]);
}

async function readRegularFile(path: string): Promise<Buffer> {
    const handle = await open(path, "r");
    try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error(`Not a regular file: ${path}`);
        return await handle.readFile();
    } finally { await handle.close(); }
}

async function run(): Promise<void> {
    const paths: Record<string, string> = {
        "global-apk-6-4-0": arg("--apk"),
        "global-elf-6-4-0": arg("--elf"),
        "global-sqlite-current-2026-08-05": arg("--sqlite-current"),
        "global-sqlite-backup-2026-08-05": arg("--sqlite-backup"),
    };
    const failures: string[] = [];
    for (const artifact of S0_S2_ARTIFACTS) {
        const bytes = await readRegularFile(paths[artifact.id]);
        failures.push(...validatePinnedArtifactBytes(artifact, bytes));
        if (artifact.role === "elf") failures.push(...validatePinnedElf(bytes));
    }
    const audit = buildS0S2Audit();
    const contract = validateS0S2Audit(audit);
    failures.push(...contract.failures.map(value => `contract: ${value}`));
    if (failures.length > 0) throw new Error([...new Set(failures)].join("; "));
    process.stdout.write(`${JSON.stringify({ audit, validation: contract }, null, 2)}\n`);
}

if (require.main === module) run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
