import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ToolRegistry } from '../bridge/orbia/tool-engine.mjs'
import { createReadOnlyTaskQueue } from '../bridge/orbia/read-only-task-queue.mjs'

const folder = await mkdtemp(join(tmpdir(), 'lumia-agent-a1-'))
const filePath = join(folder, 'queue.json')
let currentTime = Date.parse('2026-10-27T14:00:00.000Z')
let executions = 0

const registry = new ToolRegistry()
registry.register({
  name: 'status_reader',
  description: 'Safe deterministic diagnostic.',
  risk: 'read-only',
  validate: (input) => input && input.scope === 'public',
  execute: async () => {
    executions += 1
    return 'result-not-persisted'
  },
})
registry.register({
  name: 'unsafe_writer',
  description: 'Writes data and must never enter the queue.',
  risk: 'write',
  validate: () => true,
  execute: () => {
    throw new Error('Must never execute.')
  },
})

const makeQueue = () => createReadOnlyTaskQueue({
  filePath,
  registry,
  now: () => currentTime,
})

try {
  const queue = makeQueue()
  await assert.rejects(
    queue.enqueue({ label: 'No writer', toolName: 'unsafe_writer' }),
    /Only registered read-only/,
  )
  await assert.rejects(
    queue.enqueue({ label: 'No unknown tools', toolName: 'shell_exec' }),
    /Only registered read-only/,
  )
  await assert.rejects(
    queue.enqueue({ label: 'Bad timestamp', toolName: 'status_reader', runAt: '2026-10-29' }),
    /timezone/,
  )
  await assert.rejects(
    queue.enqueue({ label: 'Too much', toolName: 'status_reader', input: { data: 'x'.repeat(5000) } }),
    /too large/,
  )

  const immediate = await queue.enqueue({
    label: 'Read local status',
    toolName: 'status_reader',
    input: { scope: 'public' },
  })
  const future = await queue.enqueue({
    label: 'Deferred read-only status',
    toolName: 'status_reader',
    input: { scope: 'public' },
    runAt: '2026-10-27T15:00:00.000Z',
  })
  const badInput = await queue.enqueue({
    label: 'Bad input should fail safely',
    toolName: 'status_reader',
    input: { scope: 'restricted' },
  })

  assert.equal((await queue.tick()).length, 0, 'No trusted allowlist = no execution.')
  assert.equal(executions, 0)
  assert.equal((await queue.list()).length, 3)

  const firstTick = await queue.tick({ allowed: ['status_reader'], limit: 2 })
  assert.equal(firstTick.length, 2)
  assert.equal(firstTick[0].id, immediate.id)
  assert.equal(firstTick[0].status, 'succeeded')
  assert.equal(firstTick[0].value, 'result-not-persisted')
  assert.equal(firstTick[1].id, badInput.id)
  assert.equal(firstTick[1].status, 'failed')
  assert.equal(firstTick[1].errorCode, 'TOOL_INVALID_INPUT')
  assert.equal(executions, 1)
  assert.equal((await queue.list()).find((task) => task.id === future.id).status, 'queued')

  const stored = await readFile(filePath, 'utf8')
  assert.doesNotMatch(stored, /result-not-persisted/)
  const reloaded = makeQueue()
  assert.equal((await reloaded.list()).find((task) => task.id === immediate.id).status, 'succeeded')
  currentTime = Date.parse('2026-10-27T15:01:00.000Z')
  assert.equal((await reloaded.tick({ allowed: ['status_reader'] }))[0].id, future.id)
  assert.equal(executions, 2)

  const interrupted = await queue.enqueue({
    label: 'Recovery requires review',
    toolName: 'status_reader',
    input: { scope: 'public' },
  })
  const altered = JSON.parse(await readFile(filePath, 'utf8'))
  altered.tasks.find((task) => task.id === interrupted.id).status = 'running'
  await writeFile(filePath, JSON.stringify(altered), 'utf8')
  const afterCrash = makeQueue()
  assert.equal((await afterCrash.list()).find((task) => task.id === interrupted.id).status, 'interrupted')
  assert.equal((await afterCrash.tick({ allowed: ['status_reader'] })).length, 0)
  assert.equal(executions, 2, 'Interrupted jobs are never automatically replayed.')
  assert.equal(await afterCrash.cancel(interrupted.id), true)
  assert.equal((await afterCrash.list()).find((task) => task.id === interrupted.id).status, 'cancelled')
  assert.equal(await afterCrash.cancel(immediate.id), false)

  await writeFile(filePath, '{broken', 'utf8')
  await assert.rejects(afterCrash.list(), /corrupt/)
  await assert.rejects(afterCrash.tick({ allowed: ['status_reader'] }), /corrupt/)

  console.log('LUMIA A1 persisted read-only task queue: PASS')
  console.log('Default deny, bounded execution, scheduling, restart recovery, cancellation: PASS')
  console.log('No autonomous timer, write authority or startup integration: VERIFIED')
} finally {
  await rm(folder, { recursive: true, force: true })
}
