import { equal, throws } from "assert";
import { parseIntegrationStateKey } from "./integration-c1-builder";
import { hasExpectedIntegrationDimensions, isExplicitIntegrationDimension } from "./integration-c1-validator";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("database-first integration C1 contract", () => {
    it("derives card, form and release state only from structural state keys", () => {
        equal(JSON.stringify(parseIntegrationStateKey("1032261:1032261:initial")), JSON.stringify({ cardId: "1032261", formId: "1032261", releaseState: "initial" }));
        equal(JSON.stringify(parseIntegrationStateKey("1006791:1006791:seza")), JSON.stringify({ cardId: "1006791", formId: "1006791", releaseState: "seza" }));
        for (const value of ["Goku:Goku:initial", "1:2:future", "1:2", "1:2:eza:extra"]) throws(() => parseIntegrationStateKey(value), /C1/);
    });
    it("requires a value only for supported dimensions", () => {
        equal(isExplicitIntegrationDimension({ status: "supported", value: 1 }), true);
        equal(isExplicitIntegrationDimension({ status: "unknown", missing: ["native_proof"] }), true);
        equal(isExplicitIntegrationDimension({ status: "partial", missing: ["reset"] }), true);
        equal(isExplicitIntegrationDimension({ status: "unknown", missing: [] }), false);
        equal(isExplicitIntegrationDimension({ status: "supported" } as any), false);
        equal(isExplicitIntegrationDimension({ status: "partial", value: 1, missing: ["reset"] } as any), false);
    });
    it("rejects semantic mutations even when statuses remain supported", () => {
        const expected = { condition: { status: "unknown", missing: ["condition"] }, timing: { status: "supported", value: { raw: 6, event: "event", sequence: "sequence" } }, target: { status: "supported", value: { raw: 1, scope: "self", selfInclusion: "included" } }, operation: { status: "supported", value: { kind: "force_guard", normalGuardFormula: "formula", guardCoefficient: 0.5 } }, valueUnit: { status: "supported", value: { kind: "boolean_presence", value: true } }, lifecycle: { status: "partial", missing: ["reset"] }, probability: { status: "unknown", missing: ["application"] }, calculationBucket: { status: "supported", value: { paths: [{ channel: "enemy_source", bucket: "bucket", formula: "formula" }] } }, attackKind: { status: "unknown", missing: ["partition"] }, finalHpApplication: { status: "unknown", missing: ["application"] } } as any;
        equal(hasExpectedIntegrationDimensions(expected, expected), true);
        for (const mutate of [(value: any) => value.timing.value.event = "other", (value: any) => value.target.value.scope = "enemy", (value: any) => value.operation.value.guardCoefficient = 0.4, (value: any) => value.valueUnit.value.kind = "counter_resist_damage_rate", (value: any) => value.calculationBucket.value.paths[0].bucket = "other"]) {
            const value = clone(expected); mutate(value); equal(hasExpectedIntegrationDimensions(value, expected), false);
        }
    });
});
