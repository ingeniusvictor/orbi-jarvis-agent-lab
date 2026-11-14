# VQ-05 — Expresiones faciales cuando LUMIA habla

**14-11-2026. Estado:** implementación experimental, aislada en `LUMIA-VQ03-QA`. El propietario informó «se ve bien» tras observar VQ-04 (parpadeo no periódico y micro-mirada), por lo que se registra **aprobación visual subjetiva de VQ-04**; ello no valida todavía VQ-05 ni significa prueba instrumental de todos los visemas o clips R8. Se deja el rendimiento de Kokoro y las investigaciones VA-02 en pausa a petición del propietario, sin cambios de hilos, voz o pesos. El original `LUMIA-ASUS` se conserva en commit `1580a5182eba540893e35e37065be77da4ed014c`.

## Mejora nueva observable

LUMIA usa los propios presets VRM0 del avatar Vita. La demostración guiada anterior ya mostraba `joy`, `sorrow`, `angry`, `fun` y `neutral`, pero en una conversación normal no estaban ligados al texto **realmente pronunciado**.

VQ-05 añade `src/scene/lumia-head/speech-expressions-vq05.ts` con reacción suave a expresiones explícitas en español:

- **Alegría `joy`:** «Me alegra», «felicidades», «lo logramos», «qué buena noticia».
- **Empatía `sorrow`:** «lo siento mucho», «lamento lo ocurrido», «qué pena».
- **Diversión/sorpresa `fun`:** «vaya sorpresa», «no me lo esperaba», «qué divertido».

Se eligen únicamente desde `portalSpeechPhrase`, que indica un fragmento cuyo audio ya empieza a reproducirse. No lee lo dicho por el usuario para adivinar su emoción, ni interpreta cámara o rostro. Las preguntas técnicas o definiciones de palabras no se consideran expresiones emocionales. Una frase neutra no dispara una reacción nueva. Amplitudes intencionalmente reducidas `joy <= 0.28`, `sorrow <= 0.20`, `fun <= 0.24`; interpolación suave entre frases, regreso a neutro cuando el audio termina o se interrumpe.

## Integración y protecciones

- `LumiaPortalHead.tsx` conserva los visemas aproximados según texto/tiempo de Kokoro, micro-mirada/parpadeo VQ-04 y todos los controles de `R8BodyCompanion`. Se suma exclusivamente el peso facial a morphs existentes con binds reales y se evita inventar shape keys ausentes. El `setHeadExpressions` original sigue siendo el único compositor final de morphs.
- En cualquier demostración guiada, sus expresiones tienen prioridad; el motor VQ-05 se amortigua en segundo plano.
- Ante cambio de vista durante una frase, el nuevo componente consulta `portalSpeechSnapshot` para recuperar el fragmento que está realmente en reproducción. No activa micrófono, modelo adicional ni voz distinta.
- El flag `VITE_LUMIA_SPEECH_EXPRESSIONS_VQ05=1` solo está en `INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd`, **nunca en el lanzador diario**. Deshabilitarlo restaura la cara original sin alterar archivos FBX.
- Instrumentación de laboratorio: `[lumia:vq03-avatar]` con evento `natural-expression-observed` y únicamente preset/valor numéricos; no textos, fotografías ni audio. Una señal procesada no equivale a verificar visualmente una sonrisa.

`scripts/certify-lumia-vq05-speech-expressions.ts` verifica casos positivos/negativos, ausencia de activación sin audio, transiciones graduales, cambios de emoción, cancelación, prioridad de demo, clamps y preservación de VQ-04/R8. Corre mediante GitHub Actions en Windows y Ubuntu junto a los controles de voz y VRM existentes.

## Prueba física del propietario

Solo tras CI PASS y actualización por fast-forward del clon QA (original protegido):

1. Iniciar el laboratorio de voz local desde `node scripts/lumia-vq03-local-voice-qa.mjs`, abrir Chrome, pulsar INITIALISE y seleccionar **solo rostro**.
2. Pedir a LUMIA un mensaje corto de felicitación, por ejemplo «Lumi, felicítame por haber terminado una tarea». Mientras diga «Felicidades» o «Me alegra...», observar una sonrisa leve; si usa otra expresión verbal, la cara puede quedar neutra porque el clasificador es intencionalmente conservador.
3. Pedir «Lumi, dime una frase de apoyo que empiece por “Lo siento mucho”». Observar la expresión sutil de empatía mientras se pronuncia, no antes.
4. Pedir «Lumi, di “Vaya sorpresa, no me lo esperaba”». Comprobar reacción de diversión/sorpresa, sin saltos, con labios que sigan a Kokoro.
5. Probar «Lumi, explícame qué es un inversor» como control neutro. Cambiar a medio cuerpo/cuerpo completo, saludar y comprobar que no se interrumpe Motion R8.
6. En consola F12, filtrar `lumia:vq03-avatar`: observar `natural-expression-observed` al menos en una frase expresiva, pero **la aprobación definitiva es visual y auditiva del usuario**. No hace falta repetir benchmarks VA-02.

Si las expresiones son demasiado fuertes o inapropiadas, apagar solo el flag VQ-05 en el launcher QA y continuar con VQ-04 aprobado. No promover cambios de PR #83 a la carpeta original antes de comprobarlos.
