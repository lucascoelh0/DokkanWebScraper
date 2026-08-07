import { ProgressionRawRow } from "./progression-contract";
export type CharacterAssetRole = "card_resource_bundle" | "card_motion" | "super_view" | "super_asset" | "super_script" | "animation_script" | "active_view" | "active_costume_view" | "standby_view" | "standby_costume_view" | "standby_icon" | "finish_view" | "finish_costume_view" | "bgm" | "form_resource_bundle";
export interface CharacterAssetReference {
    referenceId: string; cardId: string; role: CharacterAssetRole; firstPartyValue: string; source: { table: string; rowId: string; column: string; columns?: string[] }; relationSource?: { table: string; rowId: string; columns: string[] };
    assetKey: { value: string; kind: "first_party_path_or_script" | "derived_from_first_party_id" };
    localFile: { status: "unknown_no_compatible_local_asset_catalog" };
    delivery: "unknown_owned_by_server_campaign";
}
export interface CharacterAssetGap { gapId: string; cardId: string; targetCardId?: string; role: "card_resource_bundle" | "form_resource_bundle"; reason: "missing_resource_id" | "target_card_outside_corpus"; source: { table: string; rowId: string; column?: string; columns: string[] }; relationSource?: { table: string; rowId: string; columns: string[] } }
export interface DatabaseCharacterAssetsDataset {
    schemaVersion: 1; contract: "dokkan-database-characters-assets"; contractVersion: "1.0.0"; generatedAt: string;
    source: { snapshotVersion: string; databaseSha256: string; db1ArtifactSha256: string };
    policy: { endpointsDiscovered: false; catalogsDownloaded: false; resourceBundleNotClaimedAsPortraitOrCardArt: true; rarityTypeFrameMapping: "unknown"; entranceAnimationGrouping: "unknown"; domainAnimationGrouping: "unknown"; deliveryOwnedElsewhere: true };
    rawRows: ProgressionRawRow[]; references: CharacterAssetReference[]; gaps: CharacterAssetGap[]; formResourceAudit: { relationTargetCount: number; unresolvedTargetCount: number };
}
export interface DatabaseCharacterAssetsCoverage {
    schemaVersion: 1; rawRowCount: number; referenceCount: number; referencedCardCount: number; roleCounts: Record<CharacterAssetRole, number>; firstPartyPathOrScriptCount: number; derivedKeyCount: number; provedLocalFileCount: number; unknownDeliveryCount: number; missingCardResourceCount: number; missingFormTargetCount: number; missingActionSetCount: number; missingSpecialViewCount: number; duplicateReferenceIdentityCount: number; duplicateRawRowIdentityCount: number;
}
export interface DatabaseCharacterAssetsValidation { schemaVersion: 1; valid: boolean; failures: string[] }
