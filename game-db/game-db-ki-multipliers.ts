import type { GameDbRow } from "./game-db-source";

/** Card-level reference anchors, not an interpolated combat calculation. */
export interface KiMultipliers {
    schemaVersion: 1,
    points: Array<{ ki: number, percent: number }>,
}

const FIELDS = ["eball_mod_min", "eball_mod_num100", "eball_mod_mid",
    "eball_mod_mid_num", "eball_mod_max", "eball_mod_max_num"] as const;

export function validateKiMultipliers(value: KiMultipliers): void {
    if (value.schemaVersion !== 1 || !Array.isArray(value.points)
        || ![3, 4].includes(value.points.length)) throw new Error("Invalid Ki anchors schema");
    value.points.forEach((point, index) => {
        if (!Number.isSafeInteger(point.ki) || point.ki < 0 || point.ki > 24
            || !Number.isSafeInteger(point.percent) || point.percent < 0 || point.percent > 1000
            || (index > 0 && point.ki <= value.points[index - 1].ki)) {
            throw new Error("Invalid Ki anchor value/order");
        }
    });
    if (value.points[0].ki !== 0 || value.points[1].percent !== 100) {
        throw new Error("Invalid Ki reference anchors");
    }
}

/** Missing old exports remain absent; partially populated/invalid rows fail loudly. */
export function kiMultipliersFromCard(card: GameDbRow): KiMultipliers | undefined {
    const raw = FIELDS.map(field => card[field]);
    if (raw.every(value => value === undefined || value === "")) return undefined;
    if (raw.some(value => typeof value !== "string" || !/^\d+$/.test(value))) {
        throw new Error(`Invalid Ki source fields for card ${card.id}`);
    }
    const [min, num100, mid, midNum, max, maxNum] = raw.map(Number);
    // Official training/presentation rows have no usable reference curve.
    // Preserve absence rather than choosing between conflicting source anchors.
    // Unexpected malformed input still throws below; these two shapes are audited.
    if ([min, num100, mid, midNum, max, maxNum].join(",") === "1,1,0,0,1,1"
        || [min, num100, mid, midNum, max, maxNum].join(",") === "40,3,150,12,200,12") {
        return undefined;
    }
    if (midNum === 0 && mid !== 0) throw new Error(`Unpaired Ki middle anchor for card ${card.id}`);
    const result: KiMultipliers = {
        schemaVersion: 1,
        points: [
            { ki: 0, percent: min },
            { ki: num100, percent: 100 },
            ...(midNum > 0 ? [{ ki: midNum, percent: mid }] : []),
            { ki: maxNum, percent: max },
        ],
    };
    validateKiMultipliers(result);
    return result;
}
