import { strict as assert } from "assert";
import { createHash } from "crypto";
import { Buffer } from "buffer";
import { decodeFrontierZstdBody, parseZstdDictionaryHeader, parseZstdFrameHeader } from "./frontier-zstd";

function dictionary(id: number, tail = "synthetic"): Buffer { const bytes = Buffer.alloc(8 + Buffer.byteLength(tail)); bytes.writeUInt32LE(0xec30a437, 0); bytes.writeUInt32LE(id, 4); bytes.write(tail, 8); return bytes; }
function frame(id: number, outputBytes: number): Buffer { const bytes = Buffer.alloc(11); bytes.writeUInt32LE(0xfd2fb528, 0); bytes[4] = 0x63; bytes.writeUInt32LE(id, 5); bytes.writeUInt16LE(outputBytes - 256, 9); return bytes; }
describe("Frontier Zstd fail-closed decoder", () => {
    it("parses the four-byte dictionary ID and content size from the frame", () => { const value = parseZstdFrameHeader(frame(315060143, 300)); assert.equal(value.dictionaryId, 315060143); assert.equal(value.dictionaryIdFieldBytes, 4); assert.equal(value.frameContentSize, 300); });
    it("rejects invalid frame and dictionary headers", () => { assert.throws(() => parseZstdFrameHeader(Buffer.alloc(12)), /magic/); assert.throws(() => parseZstdDictionaryHeader(Buffer.alloc(8)), /magic/); });
    it("keeps the body unknown when no dictionary is proved", () => { assert.deepEqual(decodeFrontierZstdBody(frame(7, 300), null, () => Buffer.alloc(300)), { disposition: "compressed_unknown", reason: "dictionary_not_proved" }); });
    it("rejects dictionary ID and hash drift before invoking decompression", () => { const bytes = dictionary(8), proof = { bytes, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), dictionaryId: 8 }; let called = false; assert.throws(() => decodeFrontierZstdBody(frame(7, 300), proof, () => { called = true; return Buffer.alloc(300); }), /proof mismatch/); assert.equal(called, false); assert.throws(() => decodeFrontierZstdBody(frame(8, 300), { ...proof, sha256: "0".repeat(64) }, () => Buffer.alloc(300)), /proof mismatch/); });
    it("fails closed on provider failure and output-size mismatch", () => { const bytes = dictionary(7), proof = { bytes, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), dictionaryId: 7 }; assert.throws(() => decodeFrontierZstdBody(frame(7, 300), proof, () => { throw new Error("synthetic"); }), /failed closed/); assert.throws(() => decodeFrontierZstdBody(frame(7, 300), proof, () => Buffer.alloc(299)), /output validation/); });
});
