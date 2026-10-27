/**
 * L.U.M.I.A. A1 — bounded, opt-in, READ-ONLY task queue.
 *
 * Not wired to bridge startup. Does not create autonomous loops, browser
 * control, external writes, agents, credentials, or background processes.
 * Model output and a stored job never grant execution authority.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { ToolExecutor } from './tool-engine.mjs'

const MAX_TASKS = 128
const MAX_INPUT_BYTES = 4096
const MAX_LABEL_CHARS = 120
const TOOL_NAME = /^[a-z0-9_-]{1,80}$/
const STORE_VERSION = 1

function assertDate(value) {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value)) {
    throw new TypeError('runAt must be an ISO timestamp with timezone.')
  }
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) throw new TypeError('Invalid runAt.')
  return new Date(milliseconds).toISOString()
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createReadOnlyTaskQueue({
  filePath,
  registry,
  now = () => Date.now(),
} = {}) {
  if (typeof filePath !== 'string' || !isAbsolute(filePath)) {
    throw new TypeError('An absolute, owner-controlled filePath is required.')
  }
  if (!registry || typeof registry.get !== 'function') {
    throw new TypeError('A ToolRegistry is required.')
  }
  if (typeof now !== 'function') throw new TypeError('Invalid clock.')

  const executor = new ToolExecutor(registry)
  let pending = Promise.resolve()
  // Serialize reads and writes within a process. A1 does not support multiple
  // queue processes sharing the same storage file.
  function locked(fn) {
    const next = pending.then(fn, fn)
    pending = next.catch(() => {})
    return next
  }

  async function save(tasks) {
    const dir = dirname(filePath)
    await mkdir(dir, { recursive: true, mode: 0o700 })
    const temp = join(dir, '.' + basename(filePath) + '.' + randomUUID() + '.tmp')
    try {
      await writeFile(temp, JSON.stringify({ version: STORE_VERSION, tasks }, null, 2), {
        mode: 0o600,
        flag: 'wx',
      })
      await rename(temp, filePath)
    } catch (error) {
      await unlink(temp).catch(() => {})
      throw error
    }
  }

  async function load() {
    let data
    try {
      data = await readFile(filePath, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch {
      throw new Error('Task store is corrupt; refusing to execute jobs.')
    }
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.tasks) ||
      parsed.tasks.length > MAX_TASKS || parsed.tasks.some((task) =>
        !task || typeof task.id !== 'string' || typeof task.status !== 'string')) {
      throw new Error('Invalid task store; refusing to execute jobs.')
    }
    let recovered = false
    for (const task of parsed.tasks) {
      if (task.status === 'running') {
        // Never replay an interrupted task automatically, even if read-only.
        task.status = 'interrupted'
        task.errorCode = 'INTERRUPTED_REQUIRES_REVIEW'
        recovered = true
      }
    }
    if (recovered) await save(parsed.tasks)
    return parsed.tasks
  }

  function ensureReadOnly(name) {
    if (typeof name !== 'string' || !TOOL_NAME.test(name)) {
      throw new TypeError('Invalid tool name.')
    }
    const tool = registry.get(name)
    if (!tool || tool.risk !== 'read-only') {
      throw new Error('Only registered read-only tools can be queued.')
    }
  }

  async function enqueue({ label, toolName, input = {}, runAt } = {}) {
    return locked(async () => {
      ensureReadOnly(toolName)
      if (typeof label !== 'string' || !label.trim() ||
          label.length > MAX_LABEL_CHARS) {
        throw new TypeError('Task label is missing or too long.')
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Task input must be an object.')
      }
      let serialized
      try { serialized = JSON.stringify(input) } catch {
        throw new TypeError('Task input must be JSON-serializable.')
      }
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_INPUT_BYTES) {
        throw new TypeError('Task input is too large.')
      }
      const time = Number(now())
      if (!Number.isFinite(time)) throw new TypeError('Invalid clock.')
      const tasks = await load()
      if (tasks.length >= MAX_TASKS) throw new Error('Queue capacity reached.')
      const task = {
        id: randomUUID(),
        label: label.trim(),
        toolName,
        input: JSON.parse(serialized),
        runAt: runAt === undefined ? new Date(time).toISOString() : assertDate(runAt),
        createdAt: new Date(time).toISOString(),
        status: 'queued',
        errorCode: null,
        resultMeta: null,
      }
      tasks.push(task)
      await save(tasks)
      return copy(task)
    })
  }

  async function list() {
    return locked(async () => copy(await load()))
  }

  async function cancel(id) {
    return locked(async () => {
      const tasks = await load()
      const task = tasks.find((item) => item.id === id)
      if (!task || !['queued', 'interrupted'].includes(task.status)) return false
      task.status = 'cancelled'
      await save(tasks)
      return true
    })
  }

  /**
   * Explicit one-shot tick. A1 has NO timer or startup hook.
   * Allowed names must come from trusted owner configuration, never the model.
   * The C1 ToolExecutor performs a second permission and validation check.
   * Results stay in the call response; only minimal metadata is persisted.
   */
  async function tick({ allowed = [], limit = 1 } = {}) {
    return locked(async () => {
      if (!Array.isArray(allowed) || allowed.some((name) => typeof name !== 'string')) {
        throw new TypeError('Invalid trusted allowlist.')
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
        throw new TypeError('Tick limit must be between 1 and 5.')
      }
      const tasks = await load()
      const outcomes = []
      const timestamp = Number(now())
      if (!Number.isFinite(timestamp)) throw new TypeError('Invalid clock.')
      for (const task of tasks) {
        if (outcomes.length >= limit) break
        if (task.status !== 'queued' || Date.parse(task.runAt) > timestamp) continue
        if (!allowed.includes(task.toolName)) continue
        const tool = registry.get(task.toolName)
        if (!tool || tool.risk !== 'read-only') {
          task.status = 'blocked'
          task.errorCode = 'TOOL_PERMISSION_CHANGED'
          await save(tasks)
          outcomes.push({ id: task.id, status: 'blocked' })
          continue
        }
        task.status = 'running'
        await save(tasks)
        let result
        try {
          const execution = await executor.execute({
            id: task.id,
            name: task.toolName,
            input: task.input,
            conversationId: 'lumia-agent-a1',
          }, { allowed: [task.toolName] })
          result = execution.result
        } catch {
          result = { ok: false, errorCode: 'EXECUTOR_FAILURE', durationMs: 0 }
        }
        task.status = result.ok ? 'succeeded' : 'failed'
        task.errorCode = result.ok ? null : (result.errorCode || 'TOOL_FAILED')
        task.resultMeta = {
          ok: Boolean(result.ok),
          durationMs: Number(result.durationMs) || 0,
        }
        await save(tasks)
        outcomes.push({
          id: task.id,
          status: task.status,
          errorCode: task.errorCode,
          value: result.ok ? result.value : null,
        })
      }
      return outcomes
    })
  }

  return Object.freeze({ enqueue, list, cancel, tick })
}
