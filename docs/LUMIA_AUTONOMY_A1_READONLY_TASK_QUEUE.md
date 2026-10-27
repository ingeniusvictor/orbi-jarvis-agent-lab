# L.U.M.I.A. Autonomy A1 — Persisted Read-only Tasks

Status: **isolated runtime foundation / not user-facing / not running in the background**.

Branch: feature/lumia-autonomy-foundation-a1
Baseline: feature/lumia-voice-gate-v1

## Why this exists

Grok Bot can keep tasks, routines and per-agent context on a persistent cloud
computer. L.U.M.I.A. must acquire those capabilities in reviewed steps without
giving a language model authority to act, bypassing the Voice Gate or replacing
the already developed local-first brain, audio, meeting or visual subsystems.

A1 adds the FIRST executable primitive: a durable, bounded, **read-only task
queue** in bridge/orbia/read-only-task-queue.mjs. It is not connected to the
bridge or installed as a system service. It cannot run while the app is closed.

## Interface and guarantees

Create the queue from owner-controlled Node.js code:

    const queue = createReadOnlyTaskQueue({
      filePath: '/absolute/owner-controlled/private/queue.json',
      registry: trustedToolRegistry,
    })
    const job = await queue.enqueue({
      label: 'Check runtime status',
      toolName: 'orbi_runtime_status',
      input: {},
      runAt: '2026-10-30T13:00:00.000Z',
    })
    const pending = await queue.list()
    const results = await queue.tick({
      allowed: ['orbi_runtime_status'],
      limit: 1,
    })

The illustrative absolute path above is for POSIX systems. On Windows use an
absolute local Windows path under the user's private application-data area.
Only a reviewed, trusted owner-side component may supply the allowlist.
Model-generated allowlists or confirmation flags are not authoritative.

- Task creation accepts only tools whose registered risk is exactly read-only.
- ToolExecutor performs an additional registry, allowlist and input check.
- Nothing executes on enqueue, listing, startup, or with an empty allowlist.
- Tick is an explicit one-time call; no polling or scheduler exists in A1.
- Scheduled times are ISO strings with explicit timezone, normalized to UTC.
- 128 jobs maximum, 4 KiB per input and up to five jobs per manual tick.
- Persists status, input, scheduled time and minimal result metadata.
- Actual tool result strings are returned to the immediate caller but are not
  saved in the queue; this avoids persistent storage of arbitrary tool outputs.
- Storage uses a temp file and rename; interrupted running jobs become
  interrupted and are NOT automatically retried.
- Cancellation applies to queued and interrupted tasks. There is no automatic
  retry, timed loop, write action or cross-machine coordination.
- In-process calls are serialized. MULTI-PROCESS access to the same file is
  unsupported. File locking, concurrency fencing and idempotency are required
  before scaling to persistent cloud workers.

## Security limits

This is intentionally NOT a permissions upgrade. The existing Voice Gate,
provider secrets, speaker identity, tool registry, C1 ToolExecutor and bridge
default-deny behavior remain the authority.

- Do not pass passwords, API keys, cookies, biometric data, private transcripts
  or sensitive household material as job input.
- The input IS persisted locally as plaintext JSON (file created with 0600 mode
  on compatible filesystems); never place the store inside a Git worktree.
- Do not treat the risk label as proof a registered tool is safe. Only register
  reviewed read-only handlers.
- Never configure an unrestricted shell, write-capable browser, process runner,
  paid API or email sender as a read-only tool.
- Treat filesystem paths, symbolic links and multi-process access as separate
  security review topics before a user-facing background service is enabled.
- A1 does not start a browser or connect to accounts.

## Certification

    node scripts/certify-lumia-read-only-task-queue.mjs

Checks the denied write tool, unknown tool, bounded payloads, empty allowlist,
manual scheduling, tool validation, restart persistence, interrupted-job
non-replay, cancellation and corrupt-store fail-closed behavior.

Existing repository gates must continue passing. CI passing does not certify
hardware, speech, privacy behavior or any always-on/cloud deployment.

## Next steps, in dependency order

A2: owner-visible task dashboard and explicit review/approval state. Requires
authoritative human approval; never treat speaker similarity as approval.

A3: reviewed browser use, network isolation, URL/SSRF policy, domain permissions
and human takeover. Any write remains outside A1.

A4: controlled scheduler and lifecycle manager with durable leases,
idempotency and recovery; never retry external writes blindly.

A5: encrypted scoped memory (per principal/project/agent), export and deletion
with retention rules. Never let memory become authority.

A6: agent delegation with roles, budgets, audit trails, max iterations and
separate tool grants. No hidden subagent expansion.

A7: Android-friendly authenticated client, approvals and task monitoring.

A8: worker-host deployment (always-on local mini-PC or isolated cloud VM)
with backups, alerts, hardened auth and secrets; only then claim tasks can
continue while the laptop is shut down.

The mobile client and cloud computer are product-delivery phases, not
properties of A1.
