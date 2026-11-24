#!/usr/bin/env node
/** Auditable documentation-gate only: no camera, Ollama, Git mutation or network. */
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve,join} from 'node:path'

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const read=(p)=>readFileSync(join(root,p),'utf8')
const ledger=JSON.parse(read('LUMIA_IMPROVEMENTS_LEDGER.json'))
const matrix=JSON.parse(read('LUMIA_PLATFORM_MATRIX.json'))
const manifest=JSON.parse(read('LUMIA_NEXT_MANIFEST.json'))
const doc=read(ledger.source_of_truth)
const readme=read('README.md')
const workflow=read('.github/workflows/lumia-next-integration.yml')
const spec=new Set(matrix.profiles.map(p=>p.id))
const expected=new Set(['asus-gpu4','hp-gpu6','cpu-only'])
const allowed={
  implementation:new Set(['idea','specified','implemented_draft','released']),
  ci:new Set(['not_applicable','pending','passed','failed']),
  qa:new Set(['not_tested','partial','passed','failed']),
}
const sameSet=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x))

assert.equal(ledger.schema_version,1)
assert.equal(ledger.repo,'ingeniusvictor/orbi-jarvis-agent-lab')
assert.ok(sameSet(spec,expected))
assert.ok(sameSet(new Set(ledger.profiles),expected))
assert.equal(ledger.profiles.length,3)
assert.equal(ledger.release.three_profile_parity_certified,false)
assert.equal(ledger.release.current_shared_release,null)
assert.equal(ledger.release.owner_authorization,false)
assert.equal(ledger.protected_baseline.commit,manifest.protected_original.expected_commit)
assert.equal(ledger.protected_baseline.commit,matrix.protected_asus_production.expected_sha)
assert.equal(ledger.protected_baseline.no_auto_merge,true)
assert.ok(Array.isArray(ledger.items)&&ledger.items.length>=10)

const ids=new Set()
const required=[
  'LUM-VI-04.2A','LUM-VI-04.2B.3','LUM-VI-05A.1','LUM-VI-05B',
  'LUM-CORE-3HW','LUM-BRAIN-HP6','LUM-BRAIN-CPU0',
  'LUM-LAUNCHER-UNIFIED','LUM-VI-MULTICAM','LUM-RELEASE-TRANSITION',
]
for(const row of ledger.items){
  assert.match(row.id,/^LUM-[A-Z0-9][A-Z0-9.-]*$/)
  assert.ok(!ids.has(row.id),'Duplicate feature ID: '+row.id)
  ids.add(row.id)
  assert.ok(typeof row.title==='string'&&row.title.trim().length>=8)
  assert.ok(typeof row.area==='string'&&row.area.length>0)
  assert.ok(allowed.implementation.has(row.implementation),row.id+' implementation')
  assert.ok(allowed.ci.has(row.ci),row.id+' ci')
  assert.ok(sameSet(new Set(row.profiles),expected),row.id+' profiles')
  assert.equal(row.profiles.length,3,row.id+' duplicate profiles')
  assert.deepEqual(Object.keys(row.field_qa).sort(),[...expected].sort(),row.id+' field_qa keys')
  for(const profile of row.profiles){
    assert.ok(allowed.qa.has(row.field_qa[profile]),row.id+'/'+profile+' field_qa')
  }
  assert.ok(Array.isArray(row.links)&&row.links.length>0,row.id+' missing references')
  for(const link of row.links)assert.match(link,/^https:\/\/github\.com\/ingeniusvictor\/orbi-jarvis-agent-lab\/(?:pull|issues)\/\d+$/)
  assert.ok(Array.isArray(row.evidence)&&row.evidence.length>0,row.id+' missing evidence')
  for(const e of row.evidence){
    assert.match(e.date,/^20\d{2}-\d\d-\d\d$/)
    assert.ok(['owner_report','owner_f12','owner_decision','owner_benchmark','code_ci','source_review'].includes(e.type))
    assert.ok(typeof e.detail==='string'&&e.detail.length>35)
  }
  assert.ok(typeof row.next==='string'&&row.next.trim().length>25)
  assert.equal(typeof row.owner_production_approved,'boolean')
  assert.ok(['released','not_released'].includes(row.release_status))
  assert.equal(row.implementation==='released',row.release_status==='released',row.id+' release fields mismatch')
  if(row.release_status==='released'){
    assert.equal(row.ci,'passed',row.id+' release must pass CI')
    assert.equal(row.owner_production_approved,true,row.id+' release needs authorization')
    for(const p of row.profiles)assert.equal(row.field_qa[p],'passed',row.id+' release missing hardware QA on '+p)
    assert.equal(ledger.release.owner_authorization,true,'Release header must have owner authorization')
    assert.ok(typeof ledger.release.current_shared_release==='string'&&/^[0-9a-f]{40}$/.test(ledger.release.current_shared_release),'Release must pin a single SHA')
  }
}
for(const id of required)assert.ok(ids.has(id),'Missing critical milestone '+id)
assert.match(doc,/PR DE IMPLEMENTACIÓN/)
assert.match(doc,/no se convierte en «funciona en todos los equipos»/)
assert.match(readme,/42-LUMIA-CONTROL-MEJORAS-20261124\.md/)
assert.match(readme,/43-TRANSICION-NEXT-A-ACTUALIZACIONES-20261124\.md/)
const transition=read('docs/lumia-convergence/43-TRANSICION-NEXT-A-ACTUALIZACIONES-20261124.md')
assert.match(transition,/1\.483 commits/)
assert.match(transition,/NO.*promover|no se promueve/i)
assert.match(transition,/aprobaci[oó]n expresa/i)
assert.match(matrix.release_policy.current_release_transition,/no_main_merge/)
assert.equal(ledger.items.find(x=>x.id==='LUM-RELEASE-TRANSITION')?.implementation,'specified')

assert.match(workflow,/node scripts\/certify-lumia-improvements-ledger\.mjs/)
assert.ok(existsSync(join(root,'LUMIA_PLATFORM_MATRIX.json')))
console.log('LUMIA LEDGER PASS: '+ledger.items.length+' distinct initiatives; physical QA tracked by 3 hardware profiles; protected original; no unapproved common release')
