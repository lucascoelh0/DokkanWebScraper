"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_STATE_PRODUCT_SCOPE_PIN = exports.CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH = exports.CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES = exports.CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT = exports.CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION = void 0;
exports.CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION = "1.0.0";
exports.CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT = 5;
exports.CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES = 64 * 1024;
exports.CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH = 512;
exports.CHARACTER_STATE_PRODUCT_SCOPE_PIN = {
    states: { included: 10651, excluded: 3 },
    releaseTransitions: { included: 4892, excluded: 3 },
    awakeningTransitions: { included: 6905, excluded: 2 },
    formTransitions: { included: 374, excluded: 184 },
    productionCoverage: { agreement: 4296, unjoinable: 1463 },
};
//# sourceMappingURL=state-product-scope-contract.js.map