import assert from 'node:assert/strict';

export const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_WRITE_BYTES = 16 * 1024 * 1024;
const STORAGE_CEILING = 8_000_000_000;

/** Provider-neutral coordination. lease must fence all state/publication writes.
 * The provider owns a durable single-flight lease, not an in-process mutex.
 * plan is read-only; publish must verify objects and conditionally promote last.
 * No scheduler or credentials are configured by importing this module.
 */
export async function refreshCycle({ acquireLease, collect, prepare, plan, publish, refreshCampaigns, refreshNews, publicationRecovery = false, now = Date.now }) {
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
    const checkProposal = proposal => {
      assert(proposal.conflicts === 0 && proposal.target === 'staging/v2/home/');
      for (const field of ['writeBytes', 'newBytes', 'bucketBytes'])
        assert(Number.isSafeInteger(proposal[field]) && proposal[field] >= 0);
      assert(proposal.newBytes <= proposal.writeBytes);
      assert(proposal.writeBytes <= MAX_WRITE_BYTES);
      assert(proposal.bucketBytes + proposal.newBytes < STORAGE_CEILING);
    };
    let proposal = await plan(candidate, lease);
    checkProposal(proposal);
    await lease.writeState({ ...state, lastAttemptAt: startedAt,
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'preflight_passed',
      projectedWriteBytes: proposal.writeBytes, projectedNewBytes: proposal.newBytes });
    phase = 'publication';
    await lease.assertOwned();
    assert(candidate.validUntil > now());
    // Adapter must bind proposal to candidate digest and expected previous manifest.
    let receipt;
    try { receipt = await publish(candidate, proposal, lease); }
    catch {
      if(!publicationRecovery)throw Error('publication_failed');
      // A consumed/uncertain plan cannot be reused. Re-read remote objects and
      // report a new preflight; never collect again or extend the source TTL.
      await lease.assertOwned();
      assert(candidate.validUntil > now());
      phase = 'preflight';
      proposal = await plan(candidate, lease);
      checkProposal(proposal);
      phase = 'publication';
      await lease.assertOwned();
      assert(candidate.validUntil > now());
      receipt = await publish(candidate, proposal, lease);
    }
    assert(receipt?.verified === true && /^[a-f0-9]{64}$/.test(receipt.manifestSha256));
    // Preserve verified Home completion before optional campaigns/news can consume
    // the remaining lease. Their later failure must not erase this durable receipt.
    await lease.writeState({ lastAttemptAt: startedAt, lastSuccessAt: now(),
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'success',
      validUntil: candidate.validUntil, manifestSha256: receipt.manifestSha256 });
    // An optional campaign step shares this slot, after successful Home publication.
    // Its failure does not relabel the already verified Home feed as unpublished.
    let campaigns;
    if (refreshCampaigns !== undefined) {
      phase = 'campaigns';
      await lease.assertOwned();
      try {
        const result = await refreshCampaigns({ lease });
        if (result?.status === 'published' && /^[a-f0-9]{64}$/.test(result.manifestSha256))
          campaigns = { status: 'published', manifestSha256: result.manifestSha256 };
        else if (['disabled', 'already_attempted'].includes(result?.status))
          campaigns = { status: result.status };
        else campaigns = { status: 'failed',
          ...(['configuration','ownership','collection','publication'].includes(result?.phase)
            ? { phase: result.phase } : {}) };
      } catch { campaigns = { status: 'failed' }; }
    }
    let news;
    if (refreshNews !== undefined) {
      phase = 'news';
      await lease.assertOwned();
      try {
        const result = await refreshNews({ lease });
        news = result?.status === 'published' && /^[a-f0-9]{64}$/.test(result.manifestSha256)
          ? { status: 'published', manifestSha256: result.manifestSha256 }
          : { status: 'failed',
            ...(['configuration','collection','publication'].includes(result?.phase)
              ? { phase: result.phase } : {}) };
      } catch { news = { status: 'failed' }; }
    }
    phase = 'receipt';
    await lease.writeState({ lastAttemptAt: startedAt, lastSuccessAt: now(),
      nextAttemptAt: startedAt + REFRESH_INTERVAL_MS, status: 'success',
      validUntil: candidate.validUntil, manifestSha256: receipt.manifestSha256,
      ...(campaigns ? { campaigns } : {}), ...(news ? { news } : {}) });
    return { status: 'success', validUntil: candidate.validUntil, ...(campaigns ? { campaigns } : {}), ...(news ? { news } : {}) };
  } catch {
    // Never serialize exception messages: API errors can echo private material.
    // A receipt failure can occur AFTER publication: do not claim rollback.
    try { await lease.recordFailure({ status: 'failed', phase, at: now() }); } catch { /* lease lost */ }
    return { status: 'failed', phase };
  } finally {
    await lease.release();
  }
}
