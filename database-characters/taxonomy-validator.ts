import { DatabaseCharacterTaxonomyCoverage, DatabaseCharacterTaxonomyDataset, DatabaseCharacterTaxonomyValidation } from "./taxonomy-contract";
export function validateDatabaseCharacterTaxonomyDataset(dataset: DatabaseCharacterTaxonomyDataset, coverage: DatabaseCharacterTaxonomyCoverage): DatabaseCharacterTaxonomyValidation {
    const failures: string[] = [];
    if (dataset.localeAudit.presentationTextAsIdentity !== false || dataset.localeAudit.otherLocales !== "unknown") failures.push("locale/text identity policy changed");
    if (coverage.cardCount !== 5759 || coverage.categoryCount !== 98 || coverage.linkCount !== 133 || coverage.linkLevelCount !== 1330 || coverage.linkEffectRowCount !== 2064) failures.push("taxonomy source counts changed");
    if (coverage.categoryAssignmentCount !== 54_072 || coverage.linkAssignmentCount !== 34_018 || coverage.unresolvedCategoryAssignmentCount || coverage.unresolvedLinkAssignmentCount) failures.push("card taxonomy assignments changed or became unresolved");
    if (coverage.missingCardLabelCount || coverage.missingCategoryLabelCount || coverage.missingLinkLabelCount) failures.push("required snapshot-default label missing");
    if (coverage.duplicateCategoryIdentityCount || coverage.duplicateLinkIdentityCount || coverage.duplicateLinkLevelSourceRowCount || coverage.duplicateLinkEfficacySourceRowCount) failures.push("duplicate taxonomy/source identity");
    if (coverage.unjoinedLinkLevelRowCount || coverage.unjoinedLinkEfficacyRowCount) failures.push("orphaned link level/effect source row");
    if (coverage.originalRarityCycleCount) failures.push("Z-Awakening original-rarity cycle");
    if (dataset.cards.some(card => card.categoryAssignments.some(item => !dataset.categories.some(category => category.id === item.categoryId)))) failures.push("dangling category assignment");
    if (dataset.cards.some(card => card.links.some(link => !dataset.links.some(item => item.id === link.linkSkillId)))) failures.push("dangling link assignment");
    return { schemaVersion: 1, valid: failures.length === 0, failures };
}
