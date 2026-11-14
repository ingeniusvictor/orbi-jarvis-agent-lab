import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const read = path => readFileSync(fileURLToPath(new URL('../'+path,import.meta.url)),'utf8')
const script=read('scripts/lumia-host-health-va024.ps1')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const qa=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const originalSha='1580a5182eba540893e35e37065be77da4ed014c'
assert.match(script,/LUMIA-VQ03-QA/)
assert.match(script,/LUMIA-ASUS/)
assert.ok(script.includes(originalSha))
assert.match(script,/ONLY_QA_CLONE_ALLOWED/)
assert.match(script,/BASELINE_CHANGED/)
assert.match(script,/WRONG_QA_BRANCH/)
assert.match(script,/Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ProcessorInformation/)
assert.match(script,/Get-CimInstance -ClassName Win32_Processor/)
assert.match(script,/Get-CimInstance -ClassName Win32_OperatingSystem/)
assert.match(script,/powercfg \/getactivescheme/)
assert.match(script,/PowerLineStatus/)
assert.match(script,/for \(\$i = 1; \$i -le 8; \$i\+\+\)/)
assert.match(script,/Start-Sleep -Seconds 1/)
assert.match(script,/ND significa contador no disponible/)
assert.match(script,/NO certifica temperatura CPU/)
assert.doesNotMatch(script,/Set-CimInstance|Set-ItemProperty|New-ItemProperty|Remove-Item|Stop-Process|Start-Process|Restart-Service|Stop-Service|powercfg \/set|powercfg \/change|powercfg \/s |sfc \/|dism \/|git (reset|clean|checkout|pull)|pip install|npm install|Set-ExecutionPolicy|Out-File|Set-Content|Add-Content/)
assert.doesNotMatch(daily,/VA024|lumia-host-health-va024/)
assert.doesNotMatch(qa,/VA024|lumia-host-health-va024/)
console.log('VA-02.4 PASS: read-only short Windows CPU/power observation, original SHA guard, no stress/temperature claims or daily changes')
