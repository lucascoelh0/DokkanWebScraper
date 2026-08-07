"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const events_artifact_path_1 = require("./events-artifact-path");
const events_e0_run_1 = require("./events-e0-run");
const events_e1_run_1 = require("./events-e1-run");
const events_e2_run_1 = require("./events-e2-run");
const events_e3_run_1 = require("./events-e3-run");
const events_e4_run_1 = require("./events-e4-run");
const events_e5_run_1 = require("./events-e5-run");
const events_e6_run_1 = require("./events-e6-run");
const events_e8_run_1 = require("./events-e8-run");
function argument(name) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1])
    throw Error(`Missing ${name}`); return (0, path_1.resolve)(process.argv[index + 1]); }
async function main() {
    const gate = Number(process.argv[process.argv.indexOf("--gate") + 1]), databasePath = argument("--database"), elfPath = argument("--elf"), apkPath = argument("--apk"), outputDir = argument("--output"), profilePath = argument("--profile"), profile = JSON.parse(await (0, promises_1.readFile)(profilePath, "utf8")), profileDirectory = (0, path_1.dirname)(profilePath), baselineNames = { e0_inventory: "events-e0-baseline.json", e3_goldens: "events-e3-baseline.json", e4_native_evidence: "events-e4-native-enemy-efficacy-map.json", e6_apk: "events-e6-apk-baseline.json" }, baselines = new Map(await Promise.all(profile.baselineFiles.map(async (value) => [value.role, await (0, events_artifact_path_1.resolveEventsInputFile)(profileDirectory, value.fileName, baselineNames[value.role])]))), required = (role) => { const value = baselines.get(role); if (!value)
        throw Error(`Missing explicit refresh baseline ${role}`); return value; };
    const baselinePath = required("e0_inventory"), e3BaselinePath = required("e3_goldens"), nativeEvidencePath = required("e4_native_evidence"), apkBaselinePath = required("e6_apk");
    let result;
    if (gate === 0)
        result = await (0, events_e0_run_1.runEventsE0)({ databasePath, outputDir, baselinePath });
    else if (gate === 1)
        result = await (0, events_e1_run_1.runEventsE1)({ databasePath, outputDir, e0Dir: outputDir, baselinePath });
    else if (gate === 2)
        result = await (0, events_e2_run_1.runEventsE2)({ databasePath, outputDir, e1Dir: outputDir, baselinePath });
    else if (gate === 3)
        result = await (0, events_e3_run_1.runEventsE3)({ databasePath, outputDir, e2Dir: outputDir, baselinePath, e3BaselinePath });
    else if (gate === 4)
        result = await (0, events_e4_run_1.runEventsE4)({ databasePath, elfPath, outputDir, e3Dir: outputDir, e2Dir: outputDir, baselinePath, e3BaselinePath, nativeEvidencePath });
    else if (gate === 5)
        result = await (0, events_e5_run_1.runEventsE5)({ databasePath, outputDir, e4Dir: outputDir, e2Dir: outputDir, e1Dir: outputDir, baselinePath });
    else if (gate === 6)
        result = await (0, events_e6_run_1.runEventsE6)({ databasePath, apkPath, outputDir, e5Dir: outputDir, baselinePath, apkBaselinePath });
    else if (gate === 8)
        result = await (0, events_e8_run_1.runEventsE8)({ inputDir: outputDir, outputDir, refreshProfilePath: profilePath });
    else
        throw Error(`Unsupported refresh gate ${gate}`);
    const manifestBytes = result.manifest ? `${JSON.stringify(result.manifest, null, 2)}\n` : "";
    console.log(JSON.stringify({ gate: `E${gate}`, peakWorkingSetBytes: result.peakWorkingSetBytes, manifestSha256: (0, crypto_1.createHash)("sha256").update(manifestBytes).digest("hex") }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-refresh-step.js.map