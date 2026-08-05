"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchSlots = exports.inspectNativeRuntimeElf = exports.parseNativeRuntimeElf = void 0;
const promises_1 = require("fs/promises");
function number(value, label) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed))
        throw new Error(`${label} exceeds JavaScript safe integer range`);
    return parsed;
}
function cstring(buffer, offset, limit) {
    if (offset < 0 || offset >= limit || limit > buffer.length)
        throw new Error("Invalid ELF string offset");
    const end = buffer.indexOf(0, offset);
    return buffer.toString("utf8", offset, end < 0 || end >= limit ? limit : end);
}
function parseNativeRuntimeElf(buffer) {
    if (buffer.length < 64 || buffer.subarray(0, 4).toString("hex") !== "7f454c46")
        throw new Error("Native runtime is not an ELF file");
    if (buffer[4] !== 2 || buffer[5] !== 1)
        throw new Error("Native runtime must be ELF64 little-endian");
    const machine = buffer.readUInt16LE(18);
    if (machine !== 183)
        throw new Error(`Native runtime must be AArch64, got machine ${machine}`);
    const sectionOffset = number(buffer.readBigUInt64LE(40), "section offset");
    const sectionSize = buffer.readUInt16LE(58);
    const sectionCount = buffer.readUInt16LE(60);
    const nameSectionIndex = buffer.readUInt16LE(62);
    if (sectionSize < 64 || sectionOffset + sectionSize * sectionCount > buffer.length || nameSectionIndex >= sectionCount)
        throw new Error("Invalid ELF section table");
    const sections = Array.from({ length: sectionCount }, (_, index) => {
        const base = sectionOffset + index * sectionSize;
        return { index, nameOffset: buffer.readUInt32LE(base), type: buffer.readUInt32LE(base + 4), address: number(buffer.readBigUInt64LE(base + 16), "section address"), offset: number(buffer.readBigUInt64LE(base + 24), "section file offset"), size: number(buffer.readBigUInt64LE(base + 32), "section size"), link: buffer.readUInt32LE(base + 40), entrySize: number(buffer.readBigUInt64LE(base + 56), "section entry size") };
    });
    for (const section of sections)
        if (section.type !== 8 && (section.offset > buffer.length || section.size > buffer.length - section.offset))
            throw new Error(`Invalid ELF section range at index ${section.index}`);
    const names = sections[nameSectionIndex];
    const named = sections.map(section => ({ ...section, name: cstring(buffer, names.offset + section.nameOffset, names.offset + names.size) }));
    const dynsym = named.find(section => section.name === ".dynsym");
    if (!dynsym || dynsym.entrySize < 24 || dynsym.size % dynsym.entrySize !== 0 || dynsym.link >= named.length)
        throw new Error("ELF .dynsym is missing or invalid");
    const dynstr = named[dynsym.link];
    if (dynstr.name !== ".dynstr")
        throw new Error("ELF .dynsym does not reference .dynstr");
    const symbols = [];
    for (let offset = dynsym.offset; offset + dynsym.entrySize <= dynsym.offset + dynsym.size; offset += dynsym.entrySize) {
        const nameOffset = buffer.readUInt32LE(offset);
        symbols.push({ name: nameOffset === 0 ? "" : cstring(buffer, dynstr.offset + nameOffset, dynstr.offset + dynstr.size), value: number(buffer.readBigUInt64LE(offset + 8), "symbol value"), size: number(buffer.readBigUInt64LE(offset + 16), "symbol size") });
    }
    const relocations = [];
    for (const section of named.filter(value => value.type === 4)) {
        if (section.entrySize < 24 || section.size % section.entrySize !== 0)
            throw new Error(`Invalid ELF RELA section ${section.name}`);
        if (section.link !== dynsym.index)
            throw new Error(`ELF RELA section ${section.name} does not reference .dynsym`);
        for (let offset = section.offset; offset + section.entrySize <= section.offset + section.size; offset += section.entrySize) {
            const relocationOffset = number(buffer.readBigUInt64LE(offset), "relocation offset");
            const info = buffer.readBigUInt64LE(offset + 8);
            const type = Number(info & 0xffffffffn);
            const symbolIndex = Number(info >> 32n);
            const symbol = symbols[symbolIndex];
            relocations.push({ offset: relocationOffset, type, symbolName: symbol?.name || undefined, symbolValue: symbol?.value, addend: number(buffer.readBigInt64LE(offset + 16), "relocation addend") });
        }
    }
    const readVirtualUint64 = (vma) => {
        const section = named.find(value => value.type !== 8 && vma >= value.address && vma + 8 <= value.address + value.size);
        if (!section)
            throw new Error(`Dispatch slot VMA 0x${vma.toString(16)} is not file-backed`);
        return buffer.readBigUInt64LE(section.offset + vma - section.address);
    };
    return { elfClass: 64, endian: "little", machine: 183, symbols, relocations, readVirtualUint64 };
}
exports.parseNativeRuntimeElf = parseNativeRuntimeElf;
async function inspectNativeRuntimeElf(path) {
    return parseNativeRuntimeElf(await (0, promises_1.readFile)(path));
}
exports.inspectNativeRuntimeElf = inspectNativeRuntimeElf;
function dispatchSlots(inspection, baseVma, slotCount) {
    const byOffset = new Map();
    for (const relocation of inspection.relocations.filter(value => value.offset < baseVma + slotCount * 8 && value.offset + 8 > baseVma)) {
        if ((relocation.offset - baseVma) % 8 !== 0)
            throw new Error(`Misaligned relocation overlaps dispatch table at 0x${relocation.offset.toString(16)}`);
        if (byOffset.has(relocation.offset))
            throw new Error(`Multiple relocations target dispatch slot 0x${relocation.offset.toString(16)}`);
        if (relocation.type !== 257)
            throw new Error(`Unsupported relocation type ${relocation.type} at dispatch slot 0x${relocation.offset.toString(16)}`);
        if (!relocation.symbolName)
            throw new Error(`ABS64 relocation without a named symbol at dispatch slot 0x${relocation.offset.toString(16)}`);
        byOffset.set(relocation.offset, relocation);
    }
    return Array.from({ length: slotCount }, (_, enumValue) => {
        const slotVma = baseVma + enumValue * 8;
        const relocation = byOffset.get(slotVma);
        if (!relocation && inspection.readVirtualUint64(slotVma) !== 0n)
            throw new Error(`Unrelocated dispatch slot 0x${slotVma.toString(16)} is not null on disk`);
        return { enumValue, slotVma, status: relocation?.symbolName ? "identified" : "null", symbol: relocation?.symbolName, symbolAddress: relocation?.symbolValue };
    });
}
exports.dispatchSlots = dispatchSlots;
//# sourceMappingURL=native-runtime-elf-adapter.js.map