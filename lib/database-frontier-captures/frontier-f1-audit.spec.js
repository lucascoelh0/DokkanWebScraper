"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const frontier_f1_audit_1 = require("./frontier-f1-audit");
describe("Frontier F1 dictionary proof policy", () => { it("never promotes bridge discovery into dictionary identity", () => { const forged = [{ artifactRole: "pinned_apk", source: "archive_entry", archiveEntry: "synthetic.dict", offset: 0, dictionaryId: 315060143, identityStatus: "whole_archive_entry_dictionary", sizeBytes: 64, sha256: "a".repeat(64) }]; assert_1.strict.equal((0, frontier_f1_audit_1.selectFrontierDictionaryProofFromDiscovery)(forged, 315060143), null); }); });
//# sourceMappingURL=frontier-f1-audit.spec.js.map