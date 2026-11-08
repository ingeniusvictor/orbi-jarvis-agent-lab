import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {visualOptionsForModel} from '../bridge/orbia/vision-profile-amr021.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const question='Lumi, cuenta las personas visibles y dime cuántas están de pie.'
const result=spawnSync(process.execPath,['--import','tsx',join(root,'scripts/benchmark-lumia-amr028-prompt.ts'),question],{
  cwd:root,encoding:'utf8',timeout:20000
})
assert.equal(result.status,0,'Cannot load model profile: '+result.stderr)
const cfg=JSON.parse(result.stdout)
assert.equal(cfg.model,'qwen3.5:4b-vision4096')
assert.deepEqual(cfg.options,visualOptionsForModel('qwen3.5:4b-vision4096'))
assert.equal(cfg.keepAlive,'30m')
assert.match(cfg.system,/Estás examinando una foto/)
assert.match(cfg.system,/L\.U\.M\.I\.A\./)
assert.match(cfg.request,/cuenta las personas visibles/i)
assert.match(cfg.request,/revisa cada figura una sola vez/)
assert.match(cfg.request,/sin ambigüedades/)
assert.match(cfg.request,/distingue claramente las categorías solicitadas/)
assert.match(cfg.request,/frases completas/)
assert.doesNotMatch(result.stdout,/images|base64|data:image/)
const bad=spawnSync(process.execPath,['--import','tsx',join(root,'scripts/benchmark-lumia-amr028-prompt.ts')],{
  cwd:root,encoding:'utf8',timeout:20000
})
assert.equal(bad.status,2)

const ps=read('scripts/benchmark-lumia-amr028-controlled.ps1')
assert.match(ps,/\[Parameter\(Mandatory=\$true\)\]\[string\]\$ImagePath/)
assert.match(ps,/\[ValidateRange\(1,6\)\]\[int\]\$Cycles=3/)
assert.match(ps,/768,1024,1024,768/)
assert.match(ps,/1024,768,768,1024/)
assert.match(ps,/\$Question='Lumi, observa cuidadosamente/)
assert.match(ps,/\$config\.request;images=@\(\$frame\.data\)/)
assert.match(ps,/Invoke-RestMethod -Method Post -Uri \$endpoint/)
assert.match(ps,/http:\/\/127\.0\.0\.1:11434\/api\/chat/)
assert.match(ps,/\$response\.PSObject\.Properties\['prompt_eval_cached_count'\]/)
assert.match(ps,/Export-Csv -LiteralPath \$csv/)
assert.match(ps,/if \(\$SummaryCsv\.Trim\(\)\)/)
assert.match(ps,/Get-Median/)
assert.match(ps,/Get-ExplicitPeopleTotal/)
assert.match(ps,/\[math\]::Round/)
assert.match(ps,/System\.Drawing/)
assert.match(ps,/Quality, \[long\]76/)
assert.match(ps,/images=@\(\$frame\.data\)/)
assert.match(ps,/keep_alive=\$config\.keepAlive/)
assert.match(ps,/stream=\$false/)
assert.match(ps,/think=\$false/)
assert.match(ps,/num_predict=\[int\]\$config\.options\.num_predict/)
assert.match(ps,/MedianaEntradaS=/)
assert.doesNotMatch(ps,/ollama\s+(?:create|pull|rm|stop|run)|JARVIS_ALLOW_WRITES=1|Out-File|Set-Content|Copy-Item|GetUserMedia|Invoke-WebRequest/)
assert.doesNotMatch(ps,/https:\/\//)
const old=read('scripts/benchmark-lumia-amr023-vision.ps1')
assert.match(old,/@\(512,768,1024\)/,'AMR-02.3 old exploratory benchmark untouched')
const launcher=read('INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd')
assert.match(launcher,/set "VITE_LUMIA_VISION_ADAPTIVE_AMR027=1"/)
assert.doesNotMatch(launcher,/benchmark-lumia-amr028/,'Never launch photo inferences when starting LUMIA')
const bridge=read('bridge/ollama.mjs')
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/formatVisionCacheMetrics\(packet\)/)
console.log('AMR-02.8 PASS: fixed same-question ABBA benchmark, real LUMIA prompt/model settings, no image upload or files by default, opt-in numeric CSV only')
