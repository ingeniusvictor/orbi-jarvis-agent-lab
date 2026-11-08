# AMR-02.6.1 — Corrección de coherencia visual persistente

**Fecha:** 2026-11-08. **Base:** AMR-02.6 trazabilidad visual (PR #63). **Estado:** piloto aislado de `main`; QA ASUS pendiente.

## Evidencia física que originó la corrección

El usuario analizó **exactamente un mismo JPEG** (`photoId=p94935aca-8ab5-479d-b65b-a1f474371dcc`, archivo de **576 × 768 px**) en cuatro consultas sucesivas:

| Consulta | Respuesta observada | Registro AMR-02.6 |
|---|---|---|
| a1 | 8 hombres | first |
| a2 | 7 hombres | changed-observation |
| a3 | 7 personas; 6 de pie y una agachada | consistent |
| a4 | 7 hombres | consistent |

No se ha demostrado desde la foto fuente si ocho o siete era el total correcto. El problema de ingeniería consiste en que AMR-02.6 **sobrescribía** el conteo anterior por la última observación, de modo que perdió la primera contradicción tras el segundo turno.

## Corrección

`bridge/orbia/vision-trace-amr026.mjs` conserva por `photoId` solamente:
- `firstCount`: **primera observación**, inmutable y **nunca tratada como verdad verificada**.
- `lastCount`: último número extraído, útil para auditoría del estado.
- `conflicted`: indicador que se activa si cualquier nuevo conteo del mismo JPEG difiere de `firstCount` y **no vuelve a false** hasta que ese registro caduque o se limpie.
- `at`: hora del último conteo, para TTL de **5 minutos**.

Un conflicto cambia la respuesta *antes de entregarla a texto/voz* por una explicación honesta y no numerada. No se escoge arbitrariamente ocho o siete. La primera discrepancia, incluso en una descripción general, recibe `status=count-discrepancy`. Repetir después siete, ocho u otra cifra recibe `status=conflict-persisted` y conserva la advertencia. Una respuesta sin cifra explícita se mantiene sin modificación (`conflict-held-no-count` si había conflicto), para no inventar datos.

El detector distingue **totales de grupo** de subgrupos: `Hay seis personas de pie y un total de siete personas` usa siete; `Hay seis personas sentadas` no se interpreta como un total del grupo. Es todavía una heurística sencilla de texto, no un detector de objetos ni una certificación de exactitud. No se realiza segunda inferencia ni captura.

## Lenguaje visual más preciso

El prompt visual de AMR-02.5 (heredado por AMR-02.6) se calibra para reconocer personas visibles sin afirmar conocer sus identidades. Evita declaraciones como «no puedo confirmar si son personas reales» ante una pregunta de conteo normal y no usa la privacidad como disculpa cuando el problema es la nitidez o la resolución. Si el usuario pregunta expresamente por autenticidad de una fotografía, la incertidumbre continúa siendo válida.

Se preservan instrucciones para OCR legible/no legible, consentimiento de webcam, distinción entre personas y nombres, y preguntas ambiguas.

## Aislamiento, privacidad y reversión

- Lanzador nuevo: `INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd`, que delega en `INICIAR_LUMIA_ASUS_VISION_TRAZA.cmd` (AMR-02.6).
- Mismas etiquetas de modelo y configuración: `qwen3.5:4b-vision4096`, Q4_K_M, 4096 tokens, GPU32, batch128. Sin instalación, recuantización, cambio de GPU ni flags globales.
- Registro máximo de **16 fotos** por WebSocket; se descartan tras cinco minutos de inactividad, al cerrar el socket o al superar el límite. No se conservan JPEG, texto completo, nombres, OCR ni rutas. No hay persistencia ni telemetría.
- Preguntas posteriores reutilizan exactamente el JPEG autorizado mientras exista la sesión. Nuevo JPEG implica nuevo `photoId` y nueva referencia.
- `main`, PR #63 y los lanzadores anteriores no se modifican. Para revertir realmente el comportamiento del detector a AMR-02.6, cambiar a la rama `feature/lumia-amr026-vision-trace-consistency-20261108` y utilizar su lanzador; ejecutar solo el lanzador anterior **sobre la rama nueva** no restaura el código anterior.

## Pruebas automatizadas y aceptación física

La nueva certificación `scripts/certify-lumia-amr0261-persistent-consistency.ts` reproduce **8 → 7 → 7 → 7**, además de 8 → 7 → 8, respuestas sin conteo, subgrupos de pie/sentados, aislamiento entre fotografías, límite 16, TTL, limpieza de conexión, instrucciones de identidad y continuidad del camino único Ollama.

En ASUS comprobar con **la misma fotografía**:
1. Nueva foto: `first`; pregunta de conteo de seguimiento: `consistent` si la cifra coincide.
2. Ante discrepancia: `count-discrepancy` y respuesta verbal reconociendo la diferencia sin elegir un número ganador.
3. Repetir la cifra contradictoria: `conflict-persisted`, sin presentar la cifra como verdad.
4. Repetir la primera cifra: el conflicto debe persistir; si cambia la foto, inicia de nuevo con `first`.
5. Sin HTTP 500, sin nuevas capturas automáticas, sin cambios de voz/VRM. Verificar que los tiempos de `input`, `total` y `doneReason` conservan sus medidas reales.

No se puede forzar al Qwen a equivocarse de manera reproducible sin un proveedor de pruebas: **la secuencia 8→7→7→7 queda probada por un test unitario inyectando las cuatro respuestas**, no se garantiza que la IA la genere cada vez físicamente. No atribuir a esta fase ganancias de velocidad que no se hayan medido.
