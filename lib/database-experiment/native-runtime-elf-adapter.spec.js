"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const native_runtime_elf_adapter_1 = require("./native-runtime-elf-adapter");
(0, mocha_1.describe)("native runtime ELF adapter", function () {
    (0, mocha_1.it)("projects ABS64 symbol relocations into indexed slots", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
                { offset: 0x1008, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
            ] };
        (0, assert_1.deepStrictEqual)((0, native_runtime_elf_adapter_1.dispatchSlots)(inspection, 0x1000, 3), [
            { enumValue: 0, slotVma: 0x1000, status: "null", symbol: undefined, symbolAddress: undefined },
            { enumValue: 1, slotVma: 0x1008, status: "identified", symbol: "handler", symbolAddress: 0x2000 },
            { enumValue: 2, slotVma: 0x1010, status: "null", symbol: undefined, symbolAddress: undefined },
        ]);
    });
    (0, mocha_1.it)("rejects unsupported relocations instead of misclassifying them as null", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
                { offset: 0x1010, type: 1027, addend: 0 },
            ] };
        (0, assert_1.throws)(() => (0, native_runtime_elf_adapter_1.dispatchSlots)(inspection, 0x1000, 3), /Unsupported relocation type 1027/);
    });
    (0, mocha_1.it)("rejects a relocation that overlaps the table without targeting a slot", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
                { offset: 0x1009, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
            ] };
        (0, assert_1.throws)(() => (0, native_runtime_elf_adapter_1.dispatchSlots)(inspection, 0x1000, 3), /Misaligned relocation overlaps dispatch table/);
    });
    (0, mocha_1.it)("rejects a relocation that starts before and overlaps the first slot", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [
                { offset: 0x0fff, type: 257, symbolName: "handler", symbolValue: 0x2000, addend: 0 },
            ] };
        (0, assert_1.throws)(() => (0, native_runtime_elf_adapter_1.dispatchSlots)(inspection, 0x1000, 3), /Misaligned relocation overlaps dispatch table/);
    });
    (0, mocha_1.it)("rejects an unrelocated non-zero slot instead of calling it null", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], relocations: [], readVirtualUint64: (vma) => vma === 0x1008 ? 1n : 0n };
        (0, assert_1.throws)(() => (0, native_runtime_elf_adapter_1.dispatchSlots)(inspection, 0x1000, 3), /is not null on disk/);
    });
    (0, mocha_1.it)("rejects non-ELF input", () => { (0, assert_1.throws)(() => (0, native_runtime_elf_adapter_1.parseNativeRuntimeElf)(Buffer.alloc(64)), /not an ELF/); (0, assert_1.equal)(true, true); });
});
//# sourceMappingURL=native-runtime-elf-adapter.spec.js.map