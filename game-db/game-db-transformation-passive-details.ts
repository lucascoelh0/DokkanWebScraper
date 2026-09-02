import type { PassiveDetails } from "../character";

function rebindPassiveDetailsEvidence(
    details: PassiveDetails,
    baseCharacterId: string,
    formId: string,
): void {
    for (const evidence of details.structuralSource?.evidence ?? []) {
        const expectedStateKey = `${formId}:${formId}:${evidence.releaseState}`;
        const expectedEvidenceId = [
            expectedStateKey,
            evidence.channel,
            evidence.passiveSkillId ?? "unknown",
            evidence.anchor.sourceSpan.start,
        ].join(":");
        if (evidence.characterId !== formId || evidence.formId !== formId
            || evidence.stateKey !== expectedStateKey || evidence.id !== expectedEvidenceId
            || evidence.channel !== "passive") {
            throw new Error(`related form ${formId} has mismatched structural passive evidence`);
        }
        evidence.characterId = baseCharacterId;
        evidence.stateKey = `${baseCharacterId}:${evidence.formId}:${evidence.releaseState}`;
        evidence.id = [
            evidence.stateKey,
            evidence.channel,
            evidence.passiveSkillId ?? "unknown",
            evidence.anchor.sourceSpan.start,
        ].join(":");
    }
    for (const evidence of details.conditionEvidence ?? []) {
        const expectedStateKey = `${formId}:${formId}:${evidence.releaseState}`;
        if (evidence.characterId !== formId || evidence.formId !== formId
            || evidence.stateKey !== expectedStateKey) {
            throw new Error(`related form ${formId} has mismatched passive condition evidence`);
        }
        evidence.characterId = baseCharacterId;
        evidence.stateKey = `${baseCharacterId}:${evidence.formId}:${evidence.releaseState}`;
    }
}

export function rebindTransformationPassiveDetails(
    details: PassiveDetails | undefined,
    baseCharacterId: string,
    formId: string,
): PassiveDetails | undefined {
    if (!details) return undefined;
    const rebound = JSON.parse(JSON.stringify(details)) as PassiveDetails;
    rebindPassiveDetailsEvidence(rebound, baseCharacterId, formId);
    for (const mode of rebound.modes ?? []) {
        rebindPassiveDetailsEvidence(mode, baseCharacterId, formId);
    }
    return rebound;
}
