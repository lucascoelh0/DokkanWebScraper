"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeFrontierZstdBody = exports.parseZstdDictionaryHeader = exports.parseZstdFrameHeader = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const FRAME_MAGIC = 0xfd2fb528;
const DICTIONARY_MAGIC = 0xec30a437;
const DICTIONARY_ID_BYTES = [0, 1, 2, 4];
function parseZstdFrameHeader(bytes) {
    if (bytes.length < 6 || bytes.readUInt32LE(0) !== FRAME_MAGIC)
        throw new Error("invalid Zstd frame magic");
    const descriptor = bytes[4], frameContentSizeFlag = descriptor >>> 6, singleSegment = (descriptor & 0x20) !== 0, unusedBit = (descriptor & 0x10) !== 0, reservedBit = (descriptor & 0x08) !== 0, checksum = (descriptor & 0x04) !== 0, dictionaryIdFlag = descriptor & 0x03;
    if (unusedBit || reservedBit)
        throw new Error("invalid Zstd frame descriptor reserved bits");
    let offset = 5;
    if (!singleSegment) {
        if (bytes.length <= offset)
            throw new Error("truncated Zstd window descriptor");
        offset += 1;
    }
    const dictionaryIdFieldBytes = DICTIONARY_ID_BYTES[dictionaryIdFlag];
    if (bytes.length < offset + dictionaryIdFieldBytes)
        throw new Error("truncated Zstd dictionary ID");
    const dictionaryId = dictionaryIdFieldBytes === 0 ? 0 : bytes.readUIntLE(offset, dictionaryIdFieldBytes);
    offset += dictionaryIdFieldBytes;
    const frameContentSizeFieldBytes = (frameContentSizeFlag === 0 ? (singleSegment ? 1 : 0) : frameContentSizeFlag === 1 ? 2 : frameContentSizeFlag === 2 ? 4 : 8);
    if (bytes.length < offset + frameContentSizeFieldBytes)
        throw new Error("truncated Zstd frame content size");
    let frameContentSize = null;
    if (frameContentSizeFieldBytes > 0) {
        if (frameContentSizeFieldBytes === 8) {
            const value = bytes.readBigUInt64LE(offset);
            if (value > BigInt(Number.MAX_SAFE_INTEGER))
                throw new Error("Zstd frame content size exceeds safe integer");
            frameContentSize = Number(value);
        }
        else {
            frameContentSize = bytes.readUIntLE(offset, frameContentSizeFieldBytes) + (frameContentSizeFieldBytes === 2 ? 256 : 0);
        }
        offset += frameContentSizeFieldBytes;
    }
    return { magic: "28b52ffd", descriptor, frameContentSizeFlag, singleSegment, checksum, dictionaryIdFlag, dictionaryIdFieldBytes, dictionaryId, frameContentSizeFieldBytes, frameContentSize, headerSizeBytes: offset };
}
exports.parseZstdFrameHeader = parseZstdFrameHeader;
function parseZstdDictionaryHeader(bytes) {
    if (bytes.length < 8 || bytes.readUInt32LE(0) !== DICTIONARY_MAGIC)
        throw new Error("invalid Zstd dictionary magic");
    return { dictionaryId: bytes.readUInt32LE(4) };
}
exports.parseZstdDictionaryHeader = parseZstdDictionaryHeader;
function decodeFrontierZstdBody(compressed, dictionary, provider, maximumOutputBytes = 32 * 1024 * 1024) {
    const frame = parseZstdFrameHeader(compressed);
    if (!dictionary)
        return { disposition: "compressed_unknown", reason: "dictionary_not_proved" };
    if (!Number.isSafeInteger(maximumOutputBytes) || maximumOutputBytes <= 0 || maximumOutputBytes > 64 * 1024 * 1024)
        throw new Error("invalid decompression output gate");
    const parsedDictionary = parseZstdDictionaryHeader(dictionary.bytes), actualHash = (0, crypto_1.createHash)("sha256").update(dictionary.bytes).digest("hex");
    if (dictionary.bytes.length !== dictionary.sizeBytes || actualHash !== dictionary.sha256 || parsedDictionary.dictionaryId !== dictionary.dictionaryId || frame.dictionaryId !== dictionary.dictionaryId)
        throw new Error("Zstd dictionary proof mismatch");
    let decoded;
    try {
        decoded = provider(compressed, dictionary.bytes, maximumOutputBytes);
    }
    catch {
        throw new Error("Zstd decompression failed closed");
    }
    if (!buffer_1.Buffer.isBuffer(decoded) || decoded.length > maximumOutputBytes || frame.frameContentSize !== null && decoded.length !== frame.frameContentSize)
        throw new Error("Zstd decompression output validation failed");
    try {
        return { disposition: "json", value: JSON.parse(decoded.toString("utf8")) };
    }
    catch {
        return { disposition: "non_json", decodedSha256: (0, crypto_1.createHash)("sha256").update(decoded).digest("hex"), decodedSizeBytes: decoded.length };
    }
}
exports.decodeFrontierZstdBody = decodeFrontierZstdBody;
//# sourceMappingURL=frontier-zstd.js.map