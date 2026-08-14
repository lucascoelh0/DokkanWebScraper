import { createHash } from "crypto";
import { NativeRuntimeElfInspection } from "../database-experiment/native-runtime-elf-adapter";
import { CARD_SCOPE_SOURCE_PIN, CardScopeDimension, CardScopeNativeProof } from "./card-scope-contract";

interface CodeRegion { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
interface DirectCall {
    role: string;
    kind: "b" | "bl";
    callVma: number;
    callHex: string;
    pltVma: number;
    pltHex: string;
    relocation: { offset: number; type: 1026; symbol: string; symbolValue: number; addend: 0 };
}

const CODE_REGIONS: CodeRegion[] = [
    { role: "card_constructor", symbol: "_ZN4CardC1EPN7SQLite33RowE", vma: 46_412_436, sizeBytes: 5_752, codeSha256: "a590c18aa6563abe6debcc42b8e549f2023c8f701af2866119db724c2c53da31" },
    { role: "card_link_getter", symbol: "_ZNK4Card15getLinkSkillIdsEv", vma: 46_420_852, sizeBytes: 8, codeSha256: "e655bb4cbaea53147d6f8c2cb97548fc8e2024849f40c76a195ce36bf0feb1ec" },
    { role: "card_category_getter", symbol: "_ZNK4Card17getCardCategoriesEv", vma: 46_422_528, sizeBytes: 56, codeSha256: "5a2869a6a3daf25884103e0a4b186d8eb0ccfbbe4be3343a05d89f9b07aa1a67" },
    { role: "card_element_getter", symbol: "_ZNK4Card10getElementEv", vma: 46_427_172, sizeBytes: 8, codeSha256: "7a2c484f16193ad2c5617bbe6704b2ccbdcc31004cfa1370a3ba4533f12de7f9" },
    { role: "user_card_constructor", symbol: "_ZN8UserCardC1ERKNSt6__ndk110shared_ptrI4CardEE", vma: 46_657_368, sizeBytes: 880, codeSha256: "636f3ef15a175232c94a1f47f62cf8c6c24c7794092365563a97868c0b2cc904" },
    { role: "user_card_link_forwarder", symbol: "_ZNK8UserCard21getLinkSkillIdAtIndexEi", vma: 46_672_384, sizeBytes: 8, codeSha256: "cde31b4cd8f86ba97a540932dab1b075019a4dbbb6456b753c6245b314ee7739" },
    { role: "user_card_growth_step_lookup", symbol: "_ZNK8UserCard29getOptimalAwakeningGrowthStepEv", vma: 46_672_616, sizeBytes: 504, codeSha256: "948d9cbbad98e6e2f59ca9bf5546a46077a8764155cd8b582df45842316d4b6d" },
    { role: "user_card_set_growth_step", symbol: "_ZN8UserCard23setOptimalAwakeningStepEi", vma: 46_687_492, sizeBytes: 120, codeSha256: "bff23b6ad85ca2d922da7c20ee8d402ea15c159bb522c8ebcf506e39cf13d76d" },
    { role: "growth_constructor", symbol: "_ZN22OptimalAwakeningGrowthC1Ei", vma: 47_099_324, sizeBytes: 712, codeSha256: "12563841104212f0239b05a39202f0c91629a4a16e4bca1beebd560c4873cec1" },
    { role: "growth_step_constructor", symbol: "_ZN22OptimalAwakeningGrowth4StepC1EPN7SQLite33RowE", vma: 47_101_092, sizeBytes: 736, codeSha256: "338f527dcd1f6aca662131ca2d79477f73f6e82b82d2f8ea5d1b08379636fea3" },
    { role: "element_consumer", symbol: "_ZNK15QuestLimitation17hasMatchedElementERKNSt6__ndk110shared_ptrI8UserCardEE", vma: 49_116_360, sizeBytes: 188, codeSha256: "bb652ef3e13af1a8041acb4f47a3e2e8560cb2031787d8b9879126915dd9913d" },
    { role: "category_consumer", symbol: "_ZN15QuestLimitation18hasMatchedCategoryERKNSt6__ndk110shared_ptrI8UserCardEERK9FiniteSetIiNS0_4lessIiEENS0_9allocatorIiEEE", vma: 49_116_548, sizeBytes: 360, codeSha256: "d795e9144a30a74a456c1000c0ca35efd0b62046418694bb033f4f57549213bc" },
    { role: "card_model_row_lookup", symbol: "_ZNK9CardModel7getCardEPN7SQLite33RowE", vma: 52_307_304, sizeBytes: 324, codeSha256: "81a3264aa3a8975f5eb77c76b4255cc8d109de04539da6d9bfcbf82ec17360f8" },
    { role: "growth_lookup", symbol: "_ZNK9CardModel35getOptimalAwakeningGrowthByGrowTypeEi", vma: 52_340_132, sizeBytes: 576, codeSha256: "23a8e2b535744076ed7655d46e293ccb5d40544ea1b476a9693a76f59a0c1918" },
    { role: "category_lookup", symbol: "_ZNK9CardModel17getCardCategoriesEi", vma: 52_343_184, sizeBytes: 288, codeSha256: "2b806f0e8d0154c094fad8e5d41d6c9f22d277a18c4f6389e40d1026b67fc2b1" },
    { role: "link_consumer", symbol: "_ZNK15LinkSkillFilter10isValidANDERKNSt6__ndk110shared_ptrI8UserCardEE", vma: 67_205_104, sizeBytes: 420, codeSha256: "57381f0f3d6941a458a558cfe19dfe68bb30f8be4ddcacebc3f75ee467679e50" },
];

const FRAGMENTS = [
    { role: "cards_element_read", vma: 46_412_848, sizeBytes: 52, codeSha256: "76511ef0784163bb80097d7afbe77420561c6460eb940e1a95b5f9b60dfb105d" },
    { role: "cards_link_skill1_read", vma: 46_415_756, sizeBytes: 64, codeSha256: "12f3b14fbe71d12f647ff82cabde960c40cf65f3e96d8970beb9e9b3d86de6ee" },
    { role: "cards_link_skill2_read", vma: 46_415_820, sizeBytes: 48, codeSha256: "ebfe1ea8cf9a98bd41f0c8ff0be99d97a1c329bf44851b9e8c8a3af8f6391be8" },
    { role: "cards_link_skill3_read", vma: 46_415_868, sizeBytes: 48, codeSha256: "a87dbb1713ae5a1d9ba39a2a0468bbf5411fb61c845471a143b9d8ab0b0afde7" },
    { role: "cards_link_skill4_read", vma: 46_415_916, sizeBytes: 48, codeSha256: "247555a8aa5fd2894dfa791f51d2a6b599a182bf5f123f4a2b4584d374c78456" },
    { role: "cards_link_skill5_read", vma: 46_415_964, sizeBytes: 48, codeSha256: "22b5b0fee1a25be7b80d94e7f56371bc5b0a85454e110389a5eb4439dd1ad6c6" },
    { role: "cards_link_skill6_read", vma: 46_416_012, sizeBytes: 48, codeSha256: "2570429b1fa125b25119d3e022ce700388f1828b72e4ca21c32de44c39edddb0" },
    { role: "cards_link_skill7_read", vma: 46_416_064, sizeBytes: 48, codeSha256: "a3c066a3ac8a09338c0a6d74808a39425205746fb027773fd785f08336cd6b9b" },
    { role: "cards_id_category_lookup", vma: 46_416_224, sizeBytes: 52, codeSha256: "3a051ce67fe6ea82f9d827865f99188b0cb42cdcd5d08e962b09cd5adb032be5" },
    { role: "cards_optimal_growth_lookup", vma: 46_416_348, sizeBytes: 92, codeSha256: "eeb874524c2c728d26bff498bdbb07446de3468617af274682e7f5810beb499e" },
] as const;

const SQLITE_GET_INT = {
    pltVma: 88_506_256,
    pltHex: "303300d0113a47f910c2399120021fd6",
    relocation: { offset: 95_215_216, type: 1026 as const, symbol: "_ZNK7SQLite33Row6getIntERKNSt6__ndk112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE", symbolValue: 68_910_588, addend: 0 as const },
};

const callsToSqlite = [
    ["cards_element_get_int", 46_412_896, "cc92a094"],
    ["cards_link_skill1_get_int", 46_415_816, "f28fa094"],
    ["cards_link_skill2_get_int", 46_415_864, "e68fa094"],
    ["cards_link_skill3_get_int", 46_415_912, "da8fa094"],
    ["cards_link_skill4_get_int", 46_415_960, "ce8fa094"],
    ["cards_link_skill5_get_int", 46_416_008, "c28fa094"],
    ["cards_link_skill6_get_int", 46_416_056, "b68fa094"],
    ["cards_link_skill7_get_int", 46_416_108, "a98fa094"],
    ["cards_id_for_category_get_int", 46_416_252, "858fa094"],
    ["cards_optimal_growth_type_get_int", 46_416_400, "608fa094"],
] as const;

const DIRECT_CALLS: DirectCall[] = [
    ...callsToSqlite.map(([role, callVma, callHex]) => ({ role, kind: "bl" as const, callVma, callHex, ...SQLITE_GET_INT })),
    { role: "card_constructor_to_category_lookup", kind: "bl", callVma: 46_416_272, callHex: "5c42a194", pltVma: 88_689_408, pltHex: "90320090111642f910a2109120021fd6", relocation: { offset: 95_306_792, type: 1026, symbol: "_ZNK9CardModel17getCardCategoriesEi", symbolValue: 52_343_184, addend: 0 } },
    { role: "card_constructor_to_growth_lookup", kind: "bl", callVma: 46_416_436, callHex: "3742a194", pltVma: 88_689_424, pltHex: "90320090111a42f910c2109120021fd6", relocation: { offset: 95_306_800, type: 1026, symbol: "_ZNK9CardModel35getOptimalAwakeningGrowthByGrowTypeEi", symbolValue: 52_340_132, addend: 0 } },
    { role: "user_card_link_forwarder_to_card", kind: "b", callVma: 46_672_388, callHex: "87859f14", pltVma: 88_490_016, pltHex: "303300f0115e47f910e23a9120021fd6", relocation: { offset: 95_207_096, type: 1026, symbol: "_ZN4Card21getLinkSkillIdAtIndexEi", symbolValue: 46_420_824, addend: 0 } },
    { role: "user_card_growth_lookup_to_step", kind: "bl", callVma: 46_672_836, callHex: "2b899f94", pltVma: 88_494_192, pltHex: "303300f0117243f910821b9120021fd6", relocation: { offset: 95_209_184, type: 1026, symbol: "_ZNK22OptimalAwakeningGrowth7getStepEi", symbolValue: 47_100_188, addend: 0 } },
    { role: "category_consumer_to_card", kind: "bl", callVma: 49_116_640, callHex: "c4329694", pltVma: 88_490_224, pltHex: "303300f0119247f910823c9120021fd6", relocation: { offset: 95_207_200, type: 1026, symbol: "_ZNK4Card17getCardCategoriesEv", symbolValue: 46_422_528, addend: 0 } },
    { role: "link_consumer_to_card", kind: "bl", callVma: 67_205_176, callHex: "fe315194", pltVma: 88_490_032, pltHex: "303300f0116247f910023b9120021fd6", relocation: { offset: 95_207_104, type: 1026, symbol: "_ZNK4Card15getLinkSkillIdsEv", symbolValue: 46_420_852, addend: 0 } },
];

const LITERAL_READS = [
    { column: "link_skill1_id", loadVma: 46_415_756, literalVma: 32_769_972 },
    { column: "link_skill2_id", loadVma: 46_415_820, literalVma: 32_837_614 },
    { column: "link_skill3_id", loadVma: 46_415_868, literalVma: 32_906_558 },
    { column: "link_skill4_id", loadVma: 46_415_916, literalVma: 32_559_487 },
    { column: "link_skill5_id", loadVma: 46_415_964, literalVma: 32_211_637 },
    { column: "link_skill6_id", loadVma: 46_416_012, literalVma: 32_804_442 },
    { column: "link_skill7_id", loadVma: 46_416_064, literalVma: 32_906_573 },
    { column: "optimal_awakening_grow_type", loadVma: 46_416_348, literalVma: 32_490_796 },
] as const;

const INLINE_COLUMN_READS = [
    { column: "element", byteLength: 7, chunks: [
        { offset: 0, vmas: [46_412_852, 46_412_868] },
        { offset: 3, vmas: [46_412_864, 46_412_872] },
    ] },
    { column: "id", byteLength: 2, chunks: [{ offset: 0, vmas: [46_416_228] }] },
] as const;

const ROLE_REQUIREMENTS: Record<CardScopeDimension, string[]> = {
    characterClass: ["card_constructor", "cards_element_read", "user_card_constructor", "element_consumer", "card_element_vtable_slot", "cards_optimal_growth_lookup", "user_card_growth_step_lookup", "user_card_set_growth_step"],
    categories: ["card_constructor", "cards_id_category_lookup", "category_lookup", "user_card_constructor", "category_consumer_to_card", "cards_optimal_growth_lookup", "user_card_growth_step_lookup", "user_card_set_growth_step"],
    links: ["card_constructor", "cards_link_columns", "user_card_constructor", "user_card_link_forwarder_to_card", "link_consumer_to_card", "cards_optimal_growth_lookup", "user_card_growth_step_lookup", "user_card_set_growth_step"],
};

export const CARD_SCOPE_NATIVE_REQUIRED_ROLES: Readonly<Record<CardScopeDimension, readonly string[]>> = ROLE_REQUIREMENTS;

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function signed(value: number, bits: number): number {
    const sign = 2 ** (bits - 1);
    return value >= sign ? value - 2 ** bits : value;
}

function branchTarget(bytes: Buffer, vma: number, kind: "b" | "bl"): number | null {
    if (bytes.length !== 4) return null;
    const word = bytes.readUInt32LE(0);
    if (word >>> 26 !== (kind === "bl" ? 0x25 : 0x05)) return null;
    return vma + signed(word & 0x03ffffff, 26) * 4;
}

function literalTarget(inspection: NativeRuntimeElfInspection, vma: number): number | null {
    const bytes = inspection.readVirtualBytes(vma, 8);
    const adrp = bytes.readUInt32LE(0); const add = bytes.readUInt32LE(4);
    if (((adrp & 0x9f000000) >>> 0) !== 0x90000000 || ((add & 0xff000000) >>> 0) !== 0x91000000) return null;
    const register = adrp & 31;
    if (((add >>> 5) & 31) !== register || (add & 31) !== register) return null;
    const page = (vma & ~0xfff) + signed((((adrp >>> 5) & 0x7ffff) << 2) | ((adrp >>> 29) & 3), 21) * 4096;
    return page + ((add >>> 10) & 0xfff) * ((add & (1 << 22)) ? 4096 : 1);
}

function inlineMovWideBytes(instructions: readonly Buffer[]): Buffer {
    let register: number | null = null;
    let value = 0;
    for (let index = 0; index < instructions.length; index++) {
        if (instructions[index].length !== 4) throw new Error("K34 native inline column instruction-size drift");
        const word = instructions[index].readUInt32LE(0);
        const opcode = word & 0x7f800000;
        if (opcode !== (index === 0 ? 0x52800000 : 0x72800000)) throw new Error("K34 native inline column opcode drift");
        const currentRegister = word & 31;
        if (register !== null && currentRegister !== register) throw new Error("K34 native inline column register drift");
        register = currentRegister;
        const shift = ((word >>> 21) & 3) * 16;
        const immediate = (word >>> 5) & 0xffff;
        value = index === 0 ? immediate << shift : (value & ~(0xffff << shift)) | (immediate << shift);
    }
    const bytes = Buffer.allocUnsafe(4);
    bytes.writeUInt32LE(value >>> 0);
    return bytes;
}

export function decodeCardScopeInlineColumn(
    chunks: readonly { offset: number; instructions: readonly Buffer[] }[],
    byteLength: number,
): string {
    if (!Number.isInteger(byteLength) || byteLength <= 0) throw new Error("K34 native inline column length drift");
    const value = Buffer.alloc(byteLength);
    for (const chunk of chunks) {
        if (!Number.isInteger(chunk.offset) || chunk.offset < 0 || chunk.offset >= byteLength) throw new Error("K34 native inline column offset drift");
        inlineMovWideBytes(chunk.instructions).copy(value, chunk.offset);
    }
    return value.toString("utf8");
}

function validateRegion(inspection: NativeRuntimeElfInspection, region: CodeRegion): void {
    const symbols = inspection.symbols.filter(value => value.name === region.symbol);
    if (symbols.length !== 1 || symbols[0].value !== region.vma || symbols[0].size !== region.sizeBytes
        || hash(inspection.readVirtualBytes(region.vma, region.sizeBytes)) !== region.codeSha256) {
        throw new Error(`K34 native code-region drift: ${region.role}`);
    }
}

function validateCall(inspection: NativeRuntimeElfInspection, call: DirectCall): void {
    const bytes = inspection.readVirtualBytes(call.callVma, 4);
    const relocations = inspection.relocations.filter(value => value.offset === call.relocation.offset && value.type === call.relocation.type
        && value.symbolName === call.relocation.symbol && value.symbolValue === call.relocation.symbolValue && value.addend === call.relocation.addend);
    if (bytes.toString("hex") !== call.callHex || branchTarget(bytes, call.callVma, call.kind) !== call.pltVma
        || inspection.readVirtualBytes(call.pltVma, 16).toString("hex") !== call.pltHex || relocations.length !== 1) {
        throw new Error(`K34 native call/relocation drift: ${call.role}`);
    }
}

export function buildCardScopeNativeProof(options: {
    sourceSha256: string;
    sourceSizeBytes: number;
    layoutSha256: string;
    validatedRoles: ReadonlySet<string>;
    codeRegionCount: number;
    directCallCount: number;
    relocationCount: number;
}): CardScopeNativeProof {
    const dimensions = {} as CardScopeNativeProof["dimensions"];
    for (const dimension of Object.keys(ROLE_REQUIREMENTS) as CardScopeDimension[]) {
        const requirements = ROLE_REQUIREMENTS[dimension];
        const proofRoles = requirements.filter(role => options.validatedRoles.has(role));
        const missing = requirements.filter(role => !options.validatedRoles.has(role));
        const status = missing.length === 0 ? "supported" : proofRoles.length === 0 ? "unknown" : "partial";
        dimensions[dimension] = {
            status,
            reasons: missing.length === 0 ? [] : [`native path missing required roles: ${missing.join(",")}`],
            proofRoles,
        };
    }
    const statuses = Object.values(dimensions).map(value => value.status);
    return {
        status: statuses.every(value => value === "supported") ? "supported" : statuses.every(value => value === "unknown") ? "unknown" : "partial",
        sourceSha256: options.sourceSha256,
        sourceSizeBytes: options.sourceSizeBytes,
        layoutSha256: options.layoutSha256,
        codeRegionCount: options.codeRegionCount,
        directCallCount: options.directCallCount,
        relocationCount: options.relocationCount,
        dimensions,
    };
}

export function validateCardScopeNativeEvidence(options: {
    inspection: NativeRuntimeElfInspection;
    nativeSha256: string;
    nativeSizeBytes: number;
    layoutBytes: Buffer;
}): CardScopeNativeProof {
    const { inspection } = options;
    if (options.nativeSha256 !== CARD_SCOPE_SOURCE_PIN.elf.sha256 || options.nativeSizeBytes !== CARD_SCOPE_SOURCE_PIN.elf.sizeBytes
        || inspection.elfClass !== 64 || inspection.endian !== "little" || inspection.machine !== 183) throw new Error("K34 native runtime identity/layout drift");
    const layoutSha256 = hash(options.layoutBytes);
    if (options.layoutBytes.length !== CARD_SCOPE_SOURCE_PIN.nativeLayout.sizeBytes || layoutSha256 !== CARD_SCOPE_SOURCE_PIN.nativeLayout.sha256) {
        throw new Error("K34 native evidence layout identity drift");
    }
    const layout = JSON.parse(options.layoutBytes.toString("utf8"));
    if (layout?.schemaVersion !== 1 || layout.sourceSha256 !== options.nativeSha256 || layout.sourceSizeBytes !== options.nativeSizeBytes
        || layout.architecture !== "elf64-little-aarch64") throw new Error("K34 native evidence layout content drift");

    const roles = new Set<string>();
    for (const region of CODE_REGIONS) { validateRegion(inspection, region); roles.add(region.role); }
    for (const fragment of FRAGMENTS) {
        if (hash(inspection.readVirtualBytes(fragment.vma, fragment.sizeBytes)) !== fragment.codeSha256) throw new Error(`K34 native fragment drift: ${fragment.role}`);
        roles.add(fragment.role);
    }
    for (const literal of LITERAL_READS) {
        const value = inspection.readVirtualBytes(literal.literalVma, literal.column.length + 1);
        if (literalTarget(inspection, literal.loadVma) !== literal.literalVma || value.toString("utf8") !== `${literal.column}\0`) {
            throw new Error(`K34 native column-literal drift: ${literal.column}`);
        }
    }
    for (const inline of INLINE_COLUMN_READS) {
        const value = decodeCardScopeInlineColumn(inline.chunks.map(chunk => ({
            offset: chunk.offset,
            instructions: chunk.vmas.map(vma => inspection.readVirtualBytes(vma, 4)),
        })), inline.byteLength);
        if (value !== inline.column) throw new Error(`K34 native inline column drift: ${inline.column}`);
    }
    for (const call of DIRECT_CALLS) { validateCall(inspection, call); roles.add(call.role); }

    const cardVtable = inspection.symbols.filter(value => value.name === "_ZTV4Card");
    const elementRelocations = inspection.relocations.filter(value => value.offset === 89_247_176 && value.type === 257
        && value.symbolName === "_ZNK4Card10getElementEv" && value.symbolValue === 46_427_172 && value.addend === 0);
    if (cardVtable.length !== 1 || cardVtable[0].value !== 89_247_104 || cardVtable[0].size !== 296 || elementRelocations.length !== 1) {
        throw new Error("K34 Card element vtable drift");
    }
    roles.add("card_element_vtable_slot");
    roles.add("cards_link_columns");

    return buildCardScopeNativeProof({
        sourceSha256: options.nativeSha256,
        sourceSizeBytes: options.nativeSizeBytes,
        layoutSha256,
        validatedRoles: roles,
        codeRegionCount: CODE_REGIONS.length + FRAGMENTS.length,
        directCallCount: DIRECT_CALLS.length,
        relocationCount: DIRECT_CALLS.length + 1,
    });
}
