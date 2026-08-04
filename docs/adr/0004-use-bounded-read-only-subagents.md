# ADR-0004: Use bounded read-only subagents

**Date**: 2026-08-04
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

Dokkanpanion benefits from independent source audits and fresh review of
high-risk contracts, but most work is concentrated in shared parser, generated
output, and Gradle files. General parallel implementation would duplicate
context, increase token usage, and create write or build conflicts. The project
therefore needs selective delegation rather than an agent for every activity.

## Decision

We enable project-scoped subagents with a maximum of two concurrent threads,
while keeping the primary session solo by default. Custom roles are narrow and
read-only: Dokkan source auditing, high-risk contract review, and Android UX
verification. The primary session retains all edits, generation, tests,
integration, Git operations, and publication.

## Alternatives Considered

### Alternative 1: Keep subagents disabled

- **Pros**: Minimum token usage and no coordination overhead.
- **Cons**: No independent evidence audit or fresh review for difficult work.
- **Why not**: A few bounded tasks benefit enough from independent attention to
  justify controlled extra usage.

### Alternative 2: Delegate exploration and implementation by default

- **Pros**: More parallel throughput.
- **Cons**: Repeated context, higher token consumption, conflicting edits, and
  contention over generated outputs and Gradle.
- **Why not**: The repository's work is usually coupled rather than safely
  parallel.

### Alternative 3: Use generic global agents

- **Pros**: Less project configuration.
- **Cons**: Weaker domain boundaries and a greater chance of unnecessary
  delegation.
- **Why not**: Project-scoped descriptions and instructions make routing more
  predictable and conservative.

## Consequences

### Positive

- Ambiguous game mechanics can receive a focused evidence audit.
- High-risk contracts and completed Android flows can receive independent
  review without granting write access.
- A two-thread ceiling and concise output contracts bound token growth.

### Negative

- Delegated tasks consume additional tokens and require parent integration.
- Some work remains sequential even when parallel execution looks attractive.

### Risks

- Agents may be invoked for marginal work. Mitigate this with solo-by-default
  routing, explicit role criteria, and no implementer or commit agent.
- Parallel tools may contend for shared resources. Mitigate this by forbidding
  subagent builds, generation, tests, Git, and publication.
