import { deepStrictEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { dispatchSlots, parseNativeRuntimeElf } from "./native-runtime-elf-adapter";

describe("native runtime ELF adapter", function () {
    it("projects ABS64 symbol relocations into indexed slots", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
            { offset: 0x1008, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
        ] } as any;
        deepStrictEqual(dispatchSlots(inspection, 0x1000, 3), [
            { enumValue: 0, slotVma: 0x1000, status: "null", symbol: undefined, symbolAddress: undefined },
            { enumValue: 1, slotVma: 0x1008, status: "identified", symbol: "handler", symbolAddress: 0x2000 },
            { enumValue: 2, slotVma: 0x1010, status: "null", symbol: undefined, symbolAddress: undefined },
        ]);
    });
    it("rejects unsupported relocations instead of misclassifying them as null", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
            { offset: 0x1010, type: 1027, addend: 0 },
        ] } as any;
        throws(() => dispatchSlots(inspection, 0x1000, 3), /Unsupported relocation type 1027/);
    });
    it("rejects a relocation that overlaps the table without targeting a slot", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
            { offset: 0x1009, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
        ] } as any;
        throws(() => dispatchSlots(inspection, 0x1000, 3), /Misaligned relocation overlaps dispatch table/);
    });
    it("rejects a relocation that starts before and overlaps the first slot", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
            { offset: 0x0fff, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
        ] } as any;
        throws(() => dispatchSlots(inspection, 0x1000, 3), /Misaligned relocation overlaps dispatch table/);
    });
    it("rejects an unrelocated non-zero slot instead of calling it null", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], relocations: [], readVirtualUint64: (vma: number) => vma === 0x1008 ? 1n : 0n } as any;
        throws(() => dispatchSlots(inspection, 0x1000, 3), /is not null on disk/);
    });
    it("rejects non-ELF input", () => { throws(() => parseNativeRuntimeElf(Buffer.alloc(64)), /not an ELF/); equal(true, true); });
});
