/**
 * O.R.B.I.A. deterministic Tool Engine.
 *
 * C1-D ports the useful guarantees from the mature ORBI ChatBox IA Core:
 * explicit registry, input validation, allowlist permissions, bounded timeout,
 * bounded result size and structured failures.
 *
 * This module does not let the model execute arbitrary JavaScript, shell, file
 * writes or browser actions. Those remain outside the C1 read-only boundary.
 */

import {
  createPermissionDecision,
  createToolResult,
} from './contracts.mjs'

const TOOL_NAME = /^[a-z0-9_-]{1,80}$/
const MAX_RESULT_CHARS = 4000
const DEFAULT_TIMEOUT_MS = 1000

export class ToolRegistry {
  #tools = new Map()

  register(tool) {
    const name = String(tool?.name ?? '')
    if (!TOOL_NAME.test(name) || this.#tools.has(name)) {
      throw new Error('Invalid or duplicate tool.')
    }
    if (typeof tool.description !== 'string' || !tool.description.trim()) {
      throw new Error('Tool description is required.')
    }
    if (typeof tool.validate !== 'function' || typeof tool.execute !== 'function') {
      throw new Error('Tool validate/execute functions are required.')
    }

    this.#tools.set(
      name,
      Object.freeze({
        name,
        description: tool.description,
        risk: tool.risk ?? 'read-only',
        validate: tool.validate,
        execute: tool.execute,
        timeoutMs: Math.max(50, Number(tool.timeoutMs) || DEFAULT_TIMEOUT_MS),
      }),
    )
    return this
  }

  get(name) {
    return this.#tools.get(name)
  }

  list() {
    return Object.freeze(
      [...this.#tools.values()].map((tool) =>
        Object.freeze({
          name: tool.name,
          description: tool.description,
          risk: tool.risk,
        }),
      ),
    )
  }
}

export class ToolExecutor {
  constructor(registry) {
    this.registry = registry
  }

  async execute(request, { allowed = [] } = {}) {
    const started = Date.now()
    const tool = this.registry.get(request?.name)

    if (!tool) {
      return Object.freeze({
        permission: createPermissionDecision({
          toolName: request?.name,
          allowed: false,
          reason: 'tool unknown',
          risk: 'unknown',
        }),
        result: createToolResult({
          requestId: request?.id,
          name: request?.name,
          ok: false,
          errorCode: 'TOOL_UNKNOWN',
          durationMs: 0,
        }),
      })
    }

    const permitted = allowed.includes(tool.name)
    const permission = createPermissionDecision({
      toolName: tool.name,
      allowed: permitted,
      reason: permitted ? 'explicit C1 allowlist' : 'not present in explicit C1 allowlist',
      risk: tool.risk,
    })

    if (!permitted) {
      return Object.freeze({
        permission,
        result: createToolResult({
          requestId: request?.id,
          name: tool.name,
          ok: false,
          errorCode: 'TOOL_DENIED',
          durationMs: 0,
        }),
      })
    }

    let valid = false
    try {
      valid = Boolean(tool.validate(request?.input))
    } catch {
      valid = false
    }

    if (!valid) {
      return Object.freeze({
        permission,
        result: createToolResult({
          requestId: request?.id,
          name: tool.name,
          ok: false,
          errorCode: 'TOOL_INVALID_INPUT',
          durationMs: 0,
        }),
      })
    }

    let timer
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('TOOL_TIMEOUT')), tool.timeoutMs)
      })

      const value = await Promise.race([
        Promise.resolve(
          tool.execute(request.input, {
            conversationId: request.conversationId,
          }),
        ),
        timeout,
      ])

      const text =
        typeof value === 'string'
          ? value
          : JSON.stringify(value ?? null)

      return Object.freeze({
        permission,
        result: createToolResult({
          requestId: request.id,
          name: tool.name,
          ok: true,
          value: text.slice(0, MAX_RESULT_CHARS),
          durationMs: Date.now() - started,
        }),
      })
    } catch (error) {
      return Object.freeze({
        permission,
        result: createToolResult({
          requestId: request?.id,
          name: tool.name,
          ok: false,
          errorCode:
            error instanceof Error && error.message === 'TOOL_TIMEOUT'
              ? 'TOOL_TIMEOUT'
              : 'TOOL_FAILED',
          durationMs: Date.now() - started,
        }),
      })
    } finally {
      clearTimeout(timer)
    }
  }
}
