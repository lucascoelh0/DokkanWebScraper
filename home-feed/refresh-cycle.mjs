import assert from 'node:assert/strict';

export const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_WRITE_BYTES = 16 * 1024 * 1024;
const STORAGE_CEILING = 8_000_000_000;

/** Provider-neutral coordination. lease must fence all state/publication writes.
 * The provider owns a durable single-flight lease, not an in-process mutex.
 * plan is read-only; publish must verify objects and conditionally promote last.
 * No scheduler or credentials are configured by importing this module.
 */
export async function refreshCycle({ acquireLease, collect, prepare, plan, publish, now = Date.now }) {
  const lease = await acquireLease();
  if (!lease) return { status: 'already_running' };
  let phase = 'state';
  try {
    const startedAt = now();
    assert(Number.isSafeInteger(startedAt) && startedAt > 0);
    const state = await lease.readState();
    if (state?.disabled === true) return { status: 'disabled' };
    if (state?.nextAttemptAt !== undefined) {
      assert(Number.isSafeInteger(state.nextAttemptAt) && state.nextAttemptAt > 0);
      if (startedAt < state.nextAttemptAt) return { status: 'not_due' };
    }
    // Reserve the interval before login: process death must not create a login loop.
    await lease.writeState({ ...state, lastAttemptAt: startedAt,
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'running' });
    phase = 'collection';
    const observation = await collect();
    phase = 'preparation';
    const candidate = await prepare(observation);
    assert(Number.isSafeInteger(candidate.validUntil) && candidate.validUntil > now());
    phase = 'preflight';
    const proposal = await plan(candidate);
    assert(proposal.conflicts === 0 && proposal.target === 'staging/v2/home/');
    for (const field of ['writeBytes', 'newBytes', 'bucketBytes'])
      assert(Number.isSafeInteger(proposal[field]) && proposal[field] >= 0);
    assert(proposal.newBytes <= proposal.writeBytes);
    assert(proposal.writeBytes <= MAX_WRITE_BYTES);
    assert(proposal.bucketBytes + proposal.newBytes < STORAGE_CEILING);
    await lease.writeState({ ...state, lastAttemptAt: startedAt,
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'preflight_passed',
      projectedWriteBytes: proposal.writeBytes, projectedNewBytes: proposal.newBytes });
    phase = 'publication';
    await lease.assertOwned();
    assert(candidate.validUntil > now());
    // Adapter must bind proposal to candidate digest and expected previous manifest.
    const receipt = await publish(candidate, proposal, lease);
    assert(receipt?.verified === true && /^[a-f0-9]{64}$/.test(receipt.manifestSha256));
    phase = 'receipt';
    await lease.writeState({ lastAttemptAt: startedAt, lastSuccessAt: now(),
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'success',
      validUntil: candidate.validUntil, manifestSha256: receipt.manifestSha256 });
    return { status: 'success', validUntil: candidate.validUntil };
  } catch {
    // Never serialize exception messages: API errors can echo private material.
    // A receipt failure can occur AFTER publication: do not claim rollback.
    try { await lease.recordFailure({ status: 'failed', phase, at: now() }); } catch { /* lease lost */ }
    return { status: 'failed', phase };
  } finally {
    await lease.release();
  }
}
