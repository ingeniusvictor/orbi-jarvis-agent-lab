# LUM-ECC-P3 — Evidence-backed Agent Sort

Status: CLASSIFICATION-ONLY / NON-AUTHORIZING  
Repository snapshot: `79a8abcd9bebda10b2640d9ef6150f29bd964caf`  
ECC reference: `2.2.2 @ 91ba9b4cf6c47c8130829004f8bb64762a76ccbb`

## Repository evidence

At the audited snapshot the L.U.M.I.A. Voice Gate line contains approximately:

- 163 tracked files;
- 66 `.mjs`;
- 23 `.ts`;
- 17 `.tsx`;
- 21 Markdown documents;
- 35 files under `scripts/`;
- 35 files under `bridge/`;
- 41 files under `src/`;
- 17 files under `docs/`;
- 4 GitHub Actions workflows;
- no conventional `tests/` tree.

Quality is primarily expressed through deterministic certification scripts rather than a conventional unit-test directory.

## DAILY agents

| Agent | Evidence | Decision |
|---|---|---|
| `planner` | phased voice/provider/runtime development with explicit certifications | DAILY |
| `architect` | brain routing, bridge, tools, voice runtimes and privacy boundaries | DAILY |
| `code-reviewer` | TypeScript/ESM + multiple trust boundaries | DAILY |
| `security-reviewer` | secrets, browser/tools, camera/mic, speaker profiles, writes | DAILY |
| `tdd-guide` | contract/certification-first development even without a `tests/` tree | DAILY |
| `doc-updater` | architecture and certification state are heavily documented | DAILY |
| `typescript-reviewer` | 40 TS/TSX files plus TypeScript build | DAILY |

## LIBRARY agents

Load only when matching evidence exists:

| Agent | Trigger | Decision |
|---|---|---|
| `react-reviewer` | UI/TSX changes | LIBRARY |
| `react-build-resolver` | React/Vite-specific failures | LIBRARY |
| `build-error-resolver` | failed build/certification preserving original evidence | LIBRARY |
| `performance-optimizer` | STT/TTS latency, queue depth, runtime throughput | LIBRARY |
| `silent-failure-hunter` | fallback, provider, async voice/tool failures | LIBRARY |
| `mle-reviewer` | local model/runtime quality or inference changes | LIBRARY |
| `python-reviewer` | the small Python local-runtime adapter surface | LIBRARY |
| `e2e-runner` | real UI/voice/browser integration flows | LIBRARY |
| `harness-optimizer` | after project skills/agent harness are materially active | LIBRARY |

## EXCLUDED / DEFERRED agents

- `cpp-reviewer`, `cpp-build-resolver`: no first-party C++ source is owned by this repo; native engines are external runtime boundaries.
- `rag-pipeline-reviewer`: no recurring RAG pipeline surface is evidenced in this branch.
- `loop-operator`: deferred because autonomous loops must not gain voice/tool/write authority implicitly.

## DAILY skills

These are justified by recurring repository evidence:

- `architecture-decision-records`
- `coding-standards`
- `contract-first`
- `tdd-workflow`
- `verification-loop`
- `security-review`
- `context-budget`
- `error-handling`
- `agent-harness-construction`

The important difference from Creative Studio is `agent-harness-construction`: L.U.M.I.A. itself is an agent/tool harness, so action-space quality, observation shape, recovery contracts and context control are core product concerns.

## LIBRARY skills

Load on demand:

- `agent-sort`
- `codebase-onboarding`
- `ai-regression-testing`
- `eval-harness`
- `benchmark`
- `benchmark-methodology`
- `cost-aware-llm-pipeline`
- `react-patterns`
- `react-testing`
- `react-performance`
- `vite-patterns`
- `deployment-patterns`
- `browser-qa`
- `e2e-testing`

## DEFERRED skills

Remain disabled:

- `continuous-learning-v2`
- `continuous-agent-loop`
- `unified-memory`
- `strategic-compact` as an automatic policy
- autonomous-loop skills
- MCP-based memory/tooling additions

Reasons:

1. project-local voice/tool permissions are safety-sensitive;
2. continuous-learning-v2 relies on hooks and its observer has a documented native-Windows limitation;
3. unified-memory requires additional runtime/MCP and must remain non-authoritative;
4. one-variable-at-a-time diagnosis is still required.

## Verification implications

For L.U.M.I.A. a certification script is evidence only for its contract.

P3 preserves:

- engine readiness vs enrollment vs anti-replay separation;
- diarization vs authentication separation;
- CI contract evidence vs workstation audio/hardware evidence;
- model output vs tool/write authority separation.

## Next controlled step

Materialize ORBI-owned, L.U.M.I.A.-adapted skills rather than copying ECC raw skills:

1. `orbi-lumia-verification-loop`
2. `orbi-lumia-security-review`
3. `orbi-lumia-agent-harness`
4. `orbi-lumia-context-budget`

Each must remain instruction-only unless a later phase explicitly adds deterministic tooling.
