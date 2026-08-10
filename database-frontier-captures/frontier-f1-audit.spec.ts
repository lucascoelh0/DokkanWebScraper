import { strict as assert } from "assert";
import { selectFrontierDictionaryProofFromDiscovery } from "./frontier-f1-audit";
describe("Frontier F1 dictionary proof policy", () => { it("never promotes bridge discovery into dictionary identity", () => { const forged = [{ artifactRole: "pinned_apk", source: "archive_entry" as const, archiveEntry: "synthetic.dict", offset: 0, dictionaryId: 315060143, identityStatus: "whole_archive_entry_dictionary" as const, sizeBytes: 64, sha256: "a".repeat(64) }]; assert.equal(selectFrontierDictionaryProofFromDiscovery(forged, 315060143), null); }); });
