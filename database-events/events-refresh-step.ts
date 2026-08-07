import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { runEventsE0 } from "./events-e0-run";
import { runEventsE1 } from "./events-e1-run";
import { runEventsE2 } from "./events-e2-run";
import { runEventsE3 } from "./events-e3-run";
import { runEventsE4 } from "./events-e4-run";
import { runEventsE5 } from "./events-e5-run";
import { runEventsE6 } from "./events-e6-run";
import { EventsE8RefreshProfile } from "./events-e8-contract";
import { runEventsE8 } from "./events-e8-run";

function argument(name: string) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw Error(`Missing ${name}`); return resolve(process.argv[index + 1]); }
async function main() {
    const gate = Number(process.argv[process.argv.indexOf("--gate") + 1]), databasePath = argument("--database"), elfPath = argument("--elf"), apkPath = argument("--apk"), outputDir = argument("--output"), profilePath = argument("--profile"), profile = JSON.parse(await readFile(profilePath, "utf8")) as EventsE8RefreshProfile, profileDirectory = dirname(profilePath), baselines = new Map(profile.baselineFiles.map(value => [value.role, resolve(profileDirectory, value.fileName)])), required = (role: EventsE8RefreshProfile["baselineFiles"][number]["role"]) => { const value = baselines.get(role); if (!value) throw Error(`Missing explicit refresh baseline ${role}`); return value; };
    const baselinePath = required("e0_inventory"), e3BaselinePath = required("e3_goldens"), nativeEvidencePath = required("e4_native_evidence"), apkBaselinePath = required("e6_apk");
    let result: any;
    if (gate === 0) result = await runEventsE0({ databasePath, outputDir, baselinePath });
    else if (gate === 1) result = await runEventsE1({ databasePath, outputDir, e0Dir: outputDir, baselinePath });
    else if (gate === 2) result = await runEventsE2({ databasePath, outputDir, e1Dir: outputDir, baselinePath });
    else if (gate === 3) result = await runEventsE3({ databasePath, outputDir, e2Dir: outputDir, baselinePath, e3BaselinePath });
    else if (gate === 4) result = await runEventsE4({ databasePath, elfPath, outputDir, e3Dir: outputDir, e2Dir: outputDir, baselinePath, e3BaselinePath, nativeEvidencePath });
    else if (gate === 5) result = await runEventsE5({ databasePath, outputDir, e4Dir: outputDir, e2Dir: outputDir, e1Dir: outputDir, baselinePath });
    else if (gate === 6) result = await runEventsE6({ databasePath, apkPath, outputDir, e5Dir: outputDir, baselinePath, apkBaselinePath });
    else if (gate === 8) result = await runEventsE8({ inputDir: outputDir, outputDir, refreshProfilePath: profilePath });
    else throw Error(`Unsupported refresh gate ${gate}`);
    const manifestBytes = result.manifest ? `${JSON.stringify(result.manifest, null, 2)}\n` : "";
    console.log(JSON.stringify({ gate: `E${gate}`, peakWorkingSetBytes: result.peakWorkingSetBytes, manifestSha256: createHash("sha256").update(manifestBytes).digest("hex") }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
