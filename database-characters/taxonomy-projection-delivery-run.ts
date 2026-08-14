import { createHash } from "crypto";
import {
    TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH,
} from "./taxonomy-projection-delivery-contract";
import {
    TaxonomyProjectionDeliveryRunOptions,
    runTaxonomyProjectionDelivery,
} from "./taxonomy-projection-delivery";

const ROOT_ARGUMENTS = [
    "--k35-root",
    "--k32-root",
    "--k2-root",
    "--productive-root",
    "--sqlite-root",
    "--db1-root",
    "--elf-root",
    "--native-evidence-root",
    "--output-root",
] as const;

function argumentValue(args: string[], name: string): string {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

export function parseTaxonomyProjectionDeliveryCli(args: string[]): TaxonomyProjectionDeliveryRunOptions {
    const allowed = new Set<string>(["--opt-in-k36", ...ROOT_ARGUMENTS]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K36 unsupported argument ${argument.slice(0, 128)}`);
        if (argument !== "--opt-in-k36") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k36").length !== 1) {
        throw new Error("K36 requires exactly one --opt-in-k36");
    }
    return {
        optIn: true,
        k35Root: argumentValue(args, "--k35-root"),
        k32Root: argumentValue(args, "--k32-root"),
        k2Root: argumentValue(args, "--k2-root"),
        productiveRoot: argumentValue(args, "--productive-root"),
        sqliteRoot: argumentValue(args, "--sqlite-root"),
        db1Root: argumentValue(args, "--db1-root"),
        elfRoot: argumentValue(args, "--elf-root"),
        nativeEvidenceRoot: argumentValue(args, "--native-evidence-root"),
        outputRoot: argumentValue(args, "--output-root"),
    };
}

async function run(): Promise<void> {
    const result = await runTaxonomyProjectionDelivery(parseTaxonomyProjectionDeliveryCli(process.argv.slice(2)));
    const json = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
    process.stdout.write(`${JSON.stringify({
        releaseDirectory: result.releaseDirectory,
        releaseId: result.releaseId,
        receiptSha256: sha256(json(result.receipt)),
        markerSha256: sha256(json(result.marker)),
        sourceBoundK35Validation: result.sourceBoundK35Validation,
        twoConstructionByteIdentical: result.twoConstructionByteIdentical,
        deliveryState: result.receipt.deliveryState,
        readiness: result.receipt.readiness,
        peakRssBytes: result.peakRssBytes,
    }, null, 2)}\n`);
}

if (require.main === module) run().catch(error => {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH);
    console.error(`K36 failed: ${message}`);
    process.exitCode = 1;
});
