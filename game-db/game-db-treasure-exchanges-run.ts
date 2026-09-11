import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve, join } from "path";
import { parseGameDbTableCsvText } from "./game-db-source";
import { buildTreasureExchanges } from "./game-db-treasure-exchanges";

async function main() {
    const args = process.argv.slice(2), opts = new Map<string, string>();
    const allowed = ["--input", "--source-dir", "--source-db-sha", "--source-snapshot", "--asset-base-url", "--output"];
    for (let i = 0; i < args.length; i += 2) {
        if (!allowed.includes(args[i]) || !args[i + 1] || opts.has(args[i])) throw Error("Invalid arguments");
        opts.set(args[i], args[i + 1]);
    }
    if (opts.size !== allowed.length) throw Error("All input, source, provenance, asset and output arguments are required");
    const sourceDir = resolve(opts.get("--source-dir"));
    const meta = JSON.parse(await readFile(join(sourceDir, "metadata.json"), "utf8"));
    if (meta.dbVersion !== opts.get("--source-snapshot") || meta.region !== "global") throw Error("Source metadata mismatch");
    const table = async (name: string) => parseGameDbTableCsvText(await readFile(join(sourceDir, "data", `${name}.csv`), "utf8"));
    const inputText = await readFile(resolve(opts.get("--input")), "utf8");
    if (Buffer.byteLength(inputText) > 8 * 1024 * 1024) throw Error("Source too large");
    const [cards, awakeningItems, treasureItems] = await Promise.all([table("cards"), table("awakening_items"), table("treasure_items")]);
    const result = buildTreasureExchanges(JSON.parse(inputText), {
        cards, awakeningItems, treasureItems, snapshotVersion: opts.get("--source-snapshot"),
        databaseSha256: opts.get("--source-db-sha"), assetBaseUrl: opts.get("--asset-base-url"),
    });
    const output = resolve(opts.get("--output"));
    await mkdir(output, { recursive: false });
    await writeFile(join(output, "treasure-exchanges.json.gz"), result.gzip, { flag: "wx" });
    await writeFile(join(output, "treasure-exchanges-manifest.json"), JSON.stringify(result.manifest, null, 2) + "\n", { flag: "wx" });
    await writeFile(join(output, "coverage.json"), JSON.stringify(result.report, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify(result.report));
}

if (require.main === module) main().catch(() => { console.error("Exchange candidate rejected; no publication performed."); process.exitCode = 1; });
