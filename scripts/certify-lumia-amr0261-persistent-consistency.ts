import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createVisionCountLedger,explicitGroupCount} from '../bridge/orbia/vision-trace-amr026.mjs'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const group='p94935aca-8ab5-479d-b65b-a1f474371dcc'
const other='p129b11cb-25db-44d9-aeed-55229dc7fd4b'
const ledger=createVisionCountLedger()
const t=10000

// Exact physical ASUS regression: a1 eight, a2 seven (scene),
// a3 seven (count), a4 seven (count) on the SAME authorized JPEG.
const a1=ledger.review({photoId:group,answer:'Veo ocho hombres en una foto de grupo al aire libre.',intent:'scene',now:t})
assert.equal(a1.status,'first')
assert.equal(a1.text,'Veo ocho hombres en una foto de grupo al aire libre.')

const a2=ledger.review({photoId:group,answer:'Veo siete hombres en una foto de grupo al aire libre.',intent:'scene',now:t+1})
assert.equal(a2.status,'count-discrepancy','A description cannot silently overwrite the first count')
assert.match(a2.text,/conteos diferentes/)
assert.doesNotMatch(a2.text,/\b(?:siete|ocho)\b/,'No arbitrarily choose 7 or 8')
assert.equal(a2.previous,8)

const a3=ledger.review({photoId:group,answer:'Veo siete figuras humanas y seis están de pie.',intent:'count',now:t+2})
assert.equal(a3.status,'conflict-persisted','Repeated seven cannot clear prior eight-vs-seven conflict')
assert.match(a3.text,/No puedo confirmar la cantidad exacta/)
assert.equal(a3.previous,8,'The immutable initial observation stays eight')

const a4=ledger.review({photoId:group,answer:'Veo siete hombres visibles en la foto.',intent:'count',now:t+3})
assert.equal(a4.status,'conflict-persisted','8 -> 7 -> 7 -> 7 must warn throughout the session')
assert.match(a4.text,/conteos diferentes/)
assert.equal(a4.previous,8)

// Repeating eight also must not reset the contradiction after seven was seen.
const a5=ledger.review({photoId:group,answer:'Hay ocho hombres.',intent:'count',now:t+4})
assert.equal(a5.status,'conflict-persisted')
assert.equal(a5.previous,8)
assert.doesNotMatch(a5.text,/\b(?:siete|ocho)\b/)

// If model cannot count at all, do not fabricate numbers or overwrite its
// already uncertain answer; preserve conflict internally.
const uncertainty='No puedo distinguir el total con suficiente certeza.'
const a6=ledger.review({photoId:group,answer:uncertainty,intent:'count',now:t+5})
assert.equal(a6.status,'conflict-held-no-count')
assert.equal(a6.text,uncertainty)
assert.equal(ledger.review({photoId:group,answer:'Veo ocho hombres.',intent:'count',now:t+6}).status,'conflict-persisted')

// New JPEG has a fresh reference, even when visually similar.
const newPhoto=ledger.review({photoId:other,answer:'Hay siete personas.',intent:'count',now:t+7})
assert.equal(newPhoto.status,'first')
assert.equal(ledger.review({photoId:other,answer:'Veo siete personas.',intent:'count',now:t+8}).status,'consistent')
assert.equal(ledger.size,2)

// A subgroup is not the total. Prefer an explicit total later in the sentence.
assert.equal(explicitGroupCount('Hay seis personas de pie y un total de siete personas en la imagen.'),7)
assert.equal(explicitGroupCount('Se ven seis personas sentadas.'),null)
assert.equal(explicitGroupCount('Hay seis personas agachadas.'),null)
assert.equal(explicitGroupCount('Veo ocho hombres, y seis están de pie.'),8)
assert.equal(explicitGroupCount('Veo siete figuras humanas en la foto y seis están de pie.'),7)
assert.equal(explicitGroupCount('Peligro 800 Volts. Consulte la placa.'),null)
assert.equal(explicitGroupCount('En la foto hay una persona.'),null)

// Expiry applies to each photo's most recent numeric observation. A new
// photo within the same WebSocket must never inherit another image's count.
const afterTTL=t+6+300001
assert.equal(ledger.review({photoId:group,answer:'Veo ocho hombres.',intent:'count',now:afterTTL}).status,'first')
assert.equal(ledger.review({photoId:other,answer:'Hay siete personas.',intent:'count',now:afterTTL}).status,'first')
ledger.clear()
assert.equal(ledger.size,0)
assert.equal(ledger.review({photoId:group,answer:'Veo siete hombres.',intent:'count',now:afterTTL+1}).status,'first')

// Bounded to 16 ephemeral photo IDs, no image bytes, OCR or user utterance
// retained in the ledger. No second inference is initiated.
for(let i=0;i<20;i++){
  const id='p'+(i+100).toString().padStart(9,'0')
  ledger.review({photoId:id,answer:'Veo ocho personas.',intent:'count',now:afterTTL+2+i})
}
assert.ok(ledger.size<=16)
const guard=read('bridge/orbia/vision-trace-amr026.mjs')
assert.match(guard,/firstCount:old\.firstCount,lastCount:count,conflicted,at:now/)
assert.match(guard,/old\.conflicted \|\| count!==old\.firstCount/)
assert.match(guard,/conflict-persisted/)
assert.doesNotMatch(guard,/\b(?:writeFile|localStorage|indexedDB|createHash|toDataURL|getUserMedia)\s*\(/)
const bridge=read('bridge/ollama.mjs')
assert.match(bridge,/const finalAnswer=typeof onVisualAnswer==='function'\?onVisualAnswer\(answer\):answer/)
assert.match(bridge,/onText\(finalAnswer\)/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/doneReason=/)
const prompt=read('src/lib/vision-context-amr025.ts')
assert.match(prompt,/contar figuras visibles de identificar personas/)
assert.match(prompt,/puedes reconocer visualmente personas sin saber quiénes son/)
assert.match(prompt,/No invoques privacidad como explicación automática/)
assert.match(prompt,/sin ambigüedades/)
const launcher=read('INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd')
assert.match(launcher,/call "%~dp0INICIAR_LUMIA_ASUS_VISION_TRAZA.cmd"/)
assert.doesNotMatch(launcher,/ollama\s+(?:rm|pull|create|stop)|num_gpu|num_batch/i)

console.log('AMR-02.6.1 PASS: persistent 8→7→7→7 mismatch, no silent baseline overwrite, independent photos, TTL, subgroup counts, calibrated personhood and unchanged Ollama path')
