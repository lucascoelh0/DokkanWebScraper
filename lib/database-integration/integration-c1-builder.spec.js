"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const integration_c1_builder_1 = require("./integration-c1-builder");
const integration_c1_validator_1 = require("./integration-c1-validator");
const clone = (value) => JSON.parse(JSON.stringify(value));
describe("database-first integration C1 contract", () => {
    it("derives card, form and release state only from structural state keys", () => {
        (0, assert_1.equal)(JSON.stringify((0, integration_c1_builder_1.parseIntegrationStateKey)("1032261:1032261:initial")), JSON.stringify({ cardId: "1032261", formId: "1032261", releaseState: "initial" }));
        (0, assert_1.equal)(JSON.stringify((0, integration_c1_builder_1.parseIntegrationStateKey)("1006791:1006791:seza")), JSON.stringify({ cardId: "1006791", formId: "1006791", releaseState: "seza" }));
        for (const value of ["Goku:Goku:initial", "1:2:future", "1:2", "1:2:eza:extra"])
            (0, assert_1.throws)(() => (0, integration_c1_builder_1.parseIntegrationStateKey)(value), /C1/);
    });
    it("requires a value only for supported dimensions", () => {
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "supported", value: 1 }), true);
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "unknown", missing: ["native_proof"] }), true);
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "partial", missing: ["reset"] }), true);
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "unknown", missing: [] }), false);
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "supported" }), false);
        (0, assert_1.equal)((0, integration_c1_validator_1.isExplicitIntegrationDimension)({ status: "partial", value: 1, missing: ["reset"] }), false);
    });
    it("rejects semantic mutations even when statuses remain supported", () => {
        const expected = { condition: { status: "unknown", missing: ["condition"] }, timing: { status: "supported", value: { raw: 6, event: "event", sequence: "sequence" } }, target: { status: "supported", value: { raw: 1, scope: "self", selfInclusion: "included" } }, operation: { status: "supported", value: { kind: "force_guard", normalGuardFormula: "formula", guardCoefficient: 0.5 } }, valueUnit: { status: "supported", value: { kind: "boolean_presence", value: true } }, lifecycle: { status: "partial", missing: ["reset"] }, probability: { status: "unknown", missing: ["application"] }, calculationBucket: { status: "supported", value: { paths: [{ channel: "enemy_source", bucket: "bucket", formula: "formula" }] } }, attackKind: { status: "unknown", missing: ["partition"] }, finalHpApplication: { status: "unknown", missing: ["application"] } };
        (0, assert_1.equal)((0, integration_c1_validator_1.hasExpectedIntegrationDimensions)(expected, expected), true);
        for (const mutate of [(value) => value.timing.value.event = "other", (value) => value.target.value.scope = "enemy", (value) => value.operation.value.guardCoefficient = 0.4, (value) => value.valueUnit.value.kind = "counter_resist_damage_rate", (value) => value.calculationBucket.value.paths[0].bucket = "other"]) {
            const value = clone(expected);
            mutate(value);
            (0, assert_1.equal)((0, integration_c1_validator_1.hasExpectedIntegrationDimensions)(value, expected), false);
        }
    });
});
//# sourceMappingURL=integration-c1-builder.spec.js.map