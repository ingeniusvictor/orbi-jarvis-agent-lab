#!/usr/bin/env node
/**
 * LUMIA unified platform contract (documentation-only gate).
 * Prevent accidental loss of the ASUS/HP/CPU profiles, release policy,
 * physical QA caveats and model alias drift. No hardware probing, downloads,
 * camera, Ollama request, credential handling, or runtime mutations.
 */
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve,join} from 'node:path'

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const file=(p)=>join(root,p)
const matrix=JSON.parse(readFileSync(file('LUMIA_PLATFORM_MATRIX.json'),'utf8'))
const docs=readFileSync(file(matrix.source_of_truth.architecture),'utf8')
const readme=readFileSync(file('README.md'),'utf8')
const qa=JSON.parse(readFileSync(file('LUMIA_NEXT_MANIFEST.json'),'utf8'))

assert.equal(matrix.schema_version,1)
assert.equal(matrix.architecture_id,'LUMIA-ONE-CORE-THREE-RUNTIMES')
assert.equal(matrix.canonical_repository,'ingeniusvictor/orbi-jarvis-agent-lab')
assert.deepEqual(matrix.profiles.map(p=>p.id),['asus-gpu4','hp-gpu6','cpu-only'])
assert.equal(new Set(matrix.profiles.map(p=>p.id)).size,3)
assert.equal(matrix.same_across_profiles.app_code,true)
assert.equal(matrix.same_across_profiles.ui,true)
assert.equal(matrix.same_across_profiles.qa_spec,true)
assert.equal(matrix.same_across_profiles.release_semver_and_git_sha,true)
assert.equal(matrix.release_policy.one_release_sha_for_all_devices,true)
assert.equal(matrix.release_policy.allow_model_specific_adapters_only_not_code_forks,true)
assert.equal(matrix.release_policy.do_not_merge_experimental_stack_to_main_automatically,true)
assert.equal(matrix.release_policy.do_not_modify_protected_asus,true)
assert.equal(matrix.release_policy.no_claim_of_validated_parity_until_all_gates_pass,true)
assert.deepEqual(matrix.release_policy.field_qa_required,['asus-gpu4','hp-gpu6','cpu-only'])
assert.equal(matrix.safety_and_privacy.camera_off_by_default,true)
assert.equal(matrix.safety_and_privacy.requires_explicit_session_consent,true)
assert.equal(matrix.safety_and_privacy.camera_session_max_seconds,180)
assert.equal(matrix.protected_asus_production.expected_sha,'1580a5182eba540893e35e37065be77da4ed014c')
assert.equal(matrix.protected_asus_production.do_not_change_without_explicit_owner_approval,true)
assert.equal(qa.protected_original.expected_commit,matrix.protected_asus_production.expected_sha)
assert.equal(matrix.profiles[0].brain.primary_exact_local_tag,'qwen3.5:2b-q4_K_M')
assert.equal(matrix.profiles[1].brain.proposed_primary_exact_local_tag,'qwen3.5:4b-q4_K_M')
assert.equal(matrix.profiles[1].brain.fallback_exact_local_tag,'qwen3.5:2b-q4_K_M')
assert.ok(matrix.profiles[1].brain.additional_candidate_exact_local_tag.includes('Nemotron'))
assert.equal(matrix.profiles[2].brain.proposed_primary_ollama_tag,'qwen3.5:0.8b')
assert.match(matrix.profiles[2].brain.status,/not-yet-validated/)
assert.equal(matrix.profiles[1].benchmarks.qwen_2b_vs_nemotron_cohort.qwen2b.generation_tps,19.74)
assert.equal(matrix.profiles[1].benchmarks.qwen_2b_vs_4b_cohort.qwen2b.generation_tps,98.48)
assert.match(matrix.profiles[1].benchmarks.qwen_2b_vs_nemotron_cohort.observation,/aún no tiene causa demostrada/)
assert.ok(matrix.canonical_feature_ledger.some(x=>x.id==='VI-05B'&&x.status==='specification'))
assert.ok(matrix.canonical_feature_ledger.some(x=>x.id==='Eufy-Multicam'&&x.status==='backlog'))
assert.match(docs,/Perfil Escritorio/)
assert.match(docs,/C220/)
assert.match(docs,/E220/)
assert.match(docs,/NO SON TRES APPS/)
assert.match(docs,/NO es|NO una inferencia|NO prueba|NO es un clasificador/i)
assert.match(readme,/41-LUMIA-UNIFICADA-TRES-ENTORNOS-20261124\.md/)
assert.ok(existsSync(file(matrix.source_of_truth.legacy_asus_continuity)))
assert.ok(existsSync(file(matrix.source_of_truth.live_qa_manifest)))
console.log('LUMIA 3-PERFILES PASS: 1 repo/1 release, ASUS=2B, HP=4B candidate + alternatives, CPU=0.8B candidate; ASUS protected; QA limitations explicit')
