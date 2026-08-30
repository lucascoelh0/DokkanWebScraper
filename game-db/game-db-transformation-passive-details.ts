import type { PassiveDetails } from "../character";

export function rebindTransformationPassiveDetails(
    details: PassiveDetails | undefined,
    baseCharacterId: string,
    formId: string,
): PassiveDetails | undefined {
    if (!details) return undefined;
    const rebound = JSON.parse(JSON.stringify(details)) as PassiveDetails;
    for (const evidence of rebound.structuralSource?.evidence ?? []) {
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
    for (const evidence of rebound.conditionEvidence ?? []) {
        const expectedStateKey = `${formId}:${formId}:${evidence.releaseState}`;
        if (evidence.characterId !== formId || evidence.formId !== formId
            || evidence.stateKey !== expectedStateKey) {
            throw new Error(`related form ${formId} has mismatched passive condition evidence`);
        }
        evidence.characterId = baseCharacterId;
        evidence.stateKey = `${baseCharacterId}:${evidence.formId}:${evidence.releaseState}`;
    }
    return rebound;
}
