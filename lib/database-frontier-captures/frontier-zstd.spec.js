"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const frontier_zstd_1 = require("./frontier-zstd");
function dictionary(id, tail = "synthetic") { const bytes = buffer_1.Buffer.alloc(8 + buffer_1.Buffer.byteLength(tail)); bytes.writeUInt32LE(0xec30a437, 0); bytes.writeUInt32LE(id, 4); bytes.write(tail, 8); return bytes; }
function frame(id, outputBytes) { const bytes = buffer_1.Buffer.alloc(11); bytes.writeUInt32LE(0xfd2fb528, 0); bytes[4] = 0x63; bytes.writeUInt32LE(id, 5); bytes.writeUInt16LE(outputBytes - 256, 9); return bytes; }
describe("Frontier Zstd fail-closed decoder", () => {
    it("parses the four-byte dictionary ID and content size from the frame", () => { const value = (0, frontier_zstd_1.parseZstdFrameHeader)(frame(315060143, 300)); assert_1.strict.equal(value.dictionaryId, 315060143); assert_1.strict.equal(value.dictionaryIdFieldBytes, 4); assert_1.strict.equal(value.frameContentSize, 300); });
    it("rejects invalid frame and dictionary headers", () => { assert_1.strict.throws(() => (0, frontier_zstd_1.parseZstdFrameHeader)(buffer_1.Buffer.alloc(12)), /magic/); assert_1.strict.throws(() => (0, frontier_zstd_1.parseZstdDictionaryHeader)(buffer_1.Buffer.alloc(8)), /magic/); });
    it("keeps the body unknown when no dictionary is proved", () => { assert_1.strict.deepEqual((0, frontier_zstd_1.decodeFrontierZstdBody)(frame(7, 300), null, () => buffer_1.Buffer.alloc(300)), { disposition: "compressed_unknown", reason: "dictionary_not_proved" }); });
    it("rejects dictionary ID and hash drift before invoking decompression", () => { const bytes = dictionary(8), proof = { bytes, sizeBytes: bytes.length, sha256: (0, crypto_1.createHash)("sha256").update(bytes).digest("hex"), dictionaryId: 8 }; let called = false; assert_1.strict.throws(() => (0, frontier_zstd_1.decodeFrontierZstdBody)(frame(7, 300), proof, () => { called = true; return buffer_1.Buffer.alloc(300); }), /proof mismatch/); assert_1.strict.equal(called, false); assert_1.strict.throws(() => (0, frontier_zstd_1.decodeFrontierZstdBody)(frame(8, 300), { ...proof, sha256: "0".repeat(64) }, () => buffer_1.Buffer.alloc(300)), /proof mismatch/); });
    it("fails closed on provider failure and output-size mismatch", () => { const bytes = dictionary(7), proof = { bytes, sizeBytes: bytes.length, sha256: (0, crypto_1.createHash)("sha256").update(bytes).digest("hex"), dictionaryId: 7 }; assert_1.strict.throws(() => (0, frontier_zstd_1.decodeFrontierZstdBody)(frame(7, 300), proof, () => { throw new Error("synthetic"); }), /failed closed/); assert_1.strict.throws(() => (0, frontier_zstd_1.decodeFrontierZstdBody)(frame(7, 300), proof, () => buffer_1.Buffer.alloc(299)), /output validation/); });
});
//# sourceMappingURL=frontier-zstd.spec.js.map