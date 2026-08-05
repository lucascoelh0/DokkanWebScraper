import { readFile } from "fs/promises";

export interface ElfSymbol { name: string, value: number, size: number }
export interface ElfRelocation { offset: number, type: number, symbolName?: string, symbolValue?: number, addend: number }
export interface NativeRuntimeElfInspection { elfClass: 64, endian: "little", machine: 183, symbols: ElfSymbol[], relocations: ElfRelocation[], readVirtualBytes(vma: number, size: number): Buffer, readVirtualUint64(vma: number): bigint }

function number(value: bigint, label: string): number {
    const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds JavaScript safe integer range`); return parsed;
}
function cstring(buffer: Buffer, offset: number, limit: number): string {
    if (offset < 0 || offset >= limit || limit > buffer.length) throw new Error("Invalid ELF string offset");
    const end = buffer.indexOf(0, offset); return buffer.toString("utf8", offset, end < 0 || end >= limit ? limit : end);
}

export function parseNativeRuntimeElf(buffer: Buffer): NativeRuntimeElfInspection {
    if (buffer.length < 64 || buffer.subarray(0, 4).toString("hex") !== "7f454c46") throw new Error("Native runtime is not an ELF file");
    if (buffer[4] !== 2 || buffer[5] !== 1) throw new Error("Native runtime must be ELF64 little-endian");
    const machine = buffer.readUInt16LE(18); if (machine !== 183) throw new Error(`Native runtime must be AArch64, got machine ${machine}`);
    const sectionOffset = number(buffer.readBigUInt64LE(40), "section offset"); const sectionSize = buffer.readUInt16LE(58); const sectionCount = buffer.readUInt16LE(60); const nameSectionIndex = buffer.readUInt16LE(62);
    if (sectionSize < 64 || sectionOffset + sectionSize * sectionCount > buffer.length || nameSectionIndex >= sectionCount) throw new Error("Invalid ELF section table");
    const sections = Array.from({ length: sectionCount }, (_, index) => {
        const base = sectionOffset + index * sectionSize;
        return { index, nameOffset: buffer.readUInt32LE(base), type: buffer.readUInt32LE(base + 4), address: number(buffer.readBigUInt64LE(base + 16), "section address"), offset: number(buffer.readBigUInt64LE(base + 24), "section file offset"), size: number(buffer.readBigUInt64LE(base + 32), "section size"), link: buffer.readUInt32LE(base + 40), entrySize: number(buffer.readBigUInt64LE(base + 56), "section entry size") };
    });
    for (const section of sections) if (section.type !== 8 && (section.offset > buffer.length || section.size > buffer.length - section.offset)) throw new Error(`Invalid ELF section range at index ${section.index}`);
    const names = sections[nameSectionIndex];
    const named = sections.map(section => ({ ...section, name: cstring(buffer, names.offset + section.nameOffset, names.offset + names.size) }));
    const dynsym = named.find(section => section.name === ".dynsym"); if (!dynsym || dynsym.entrySize < 24 || dynsym.size % dynsym.entrySize !== 0 || dynsym.link >= named.length) throw new Error("ELF .dynsym is missing or invalid");
    const dynstr = named[dynsym.link]; if (dynstr.name !== ".dynstr") throw new Error("ELF .dynsym does not reference .dynstr");
    const symbols: ElfSymbol[] = [];
    for (let offset = dynsym.offset; offset + dynsym.entrySize <= dynsym.offset + dynsym.size; offset += dynsym.entrySize) {
        const nameOffset = buffer.readUInt32LE(offset); symbols.push({ name: nameOffset === 0 ? "" : cstring(buffer, dynstr.offset + nameOffset, dynstr.offset + dynstr.size), value: number(buffer.readBigUInt64LE(offset + 8), "symbol value"), size: number(buffer.readBigUInt64LE(offset + 16), "symbol size") });
    }
    const relocations: ElfRelocation[] = [];
    for (const section of named.filter(value => value.type === 4)) {
        if (section.entrySize < 24 || section.size % section.entrySize !== 0) throw new Error(`Invalid ELF RELA section ${section.name}`);
        if (section.link !== dynsym.index) throw new Error(`ELF RELA section ${section.name} does not reference .dynsym`);
        for (let offset = section.offset; offset + section.entrySize <= section.offset + section.size; offset += section.entrySize) {
            const relocationOffset = number(buffer.readBigUInt64LE(offset), "relocation offset"); const info = buffer.readBigUInt64LE(offset + 8); const type = Number(info & 0xffffffffn); const symbolIndex = Number(info >> 32n); const symbol = symbols[symbolIndex];
            relocations.push({ offset: relocationOffset, type, symbolName: symbol?.name || undefined, symbolValue: symbol?.value, addend: number(buffer.readBigInt64LE(offset + 16), "relocation addend") });
        }
    }
    const readVirtualBytes = (vma: number, size: number): Buffer => {
        if (!Number.isSafeInteger(vma) || !Number.isSafeInteger(size) || size < 0) throw new Error("Invalid virtual byte range");
        const section = named.find(value => value.type !== 8 && vma >= value.address && vma + size <= value.address + value.size);
        if (!section) throw new Error(`Native VMA range 0x${vma.toString(16)}+${size} is not file-backed`);
        return buffer.subarray(section.offset + vma - section.address, section.offset + vma - section.address + size);
    };
    const readVirtualUint64 = (vma: number): bigint => readVirtualBytes(vma, 8).readBigUInt64LE();
    return { elfClass: 64, endian: "little", machine: 183, symbols, relocations, readVirtualBytes, readVirtualUint64 };
}

export async function inspectNativeRuntimeElf(path: string): Promise<NativeRuntimeElfInspection> {
    return parseNativeRuntimeElf(await readFile(path));
}

export function dispatchSlots(inspection: NativeRuntimeElfInspection, baseVma: number, slotCount: number) {
    const byOffset = new Map<number, ElfRelocation>();
    for (const relocation of inspection.relocations.filter(value => value.offset < baseVma + slotCount * 8 && value.offset + 8 > baseVma)) {
        if ((relocation.offset - baseVma) % 8 !== 0) throw new Error(`Misaligned relocation overlaps dispatch table at 0x${relocation.offset.toString(16)}`);
        if (byOffset.has(relocation.offset)) throw new Error(`Multiple relocations target dispatch slot 0x${relocation.offset.toString(16)}`);
        if (relocation.type !== 257) throw new Error(`Unsupported relocation type ${relocation.type} at dispatch slot 0x${relocation.offset.toString(16)}`);
        if (!relocation.symbolName) throw new Error(`ABS64 relocation without a named symbol at dispatch slot 0x${relocation.offset.toString(16)}`);
        byOffset.set(relocation.offset, relocation);
    }
    return Array.from({ length: slotCount }, (_, enumValue) => {
        const slotVma = baseVma + enumValue * 8; const relocation = byOffset.get(slotVma);
        if (!relocation && inspection.readVirtualUint64(slotVma) !== 0n) throw new Error(`Unrelocated dispatch slot 0x${slotVma.toString(16)} is not null on disk`);
        return { enumValue, slotVma, status: relocation?.symbolName ? "identified" as const : "null" as const, symbol: relocation?.symbolName, symbolAddress: relocation?.symbolValue };
    });
}
