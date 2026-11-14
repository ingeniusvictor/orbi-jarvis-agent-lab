# LUMIA VQ-03.5 — Error Whisper «avatar BRM» y respuestas repetidas (14-11-2026)

**Estado:** corrección acotada en el clon QA de PR #83; no instalada en `LUMIA-ASUS` ni fusionada a MASTER. Modelo diario Qwen 3.5 2B y voz local Whisper/Kokoro permanecen sin cambio de versión.

## Evidencia física del propietario (01:55–01:57)

| Pregunta / texto recibido por Whisper | Primer texto | Primer audio | Diagnóstico |
| --- | ---: | ---: | --- |
| «Lumi, explícame en dos frases que es un avatar BRM.» | **1,90 s** | **5,65 s** | Whisper detectó BRM, no VRM; Qwen afirmó «Base de Recursos Meteorológicos», definición sin sustento para ese contexto. **FAIL factual** |
| «Lumi como podrías mejorar tus animaciones para que se vea más natural.» | **2,64 s** | **6,13 s** | Contenido sobre transiciones/interpolación correcto en términos generales, pero **ofreció una simulación inmediata** cuya capacidad real no está verificada |
| «Lumi como podrías controlar mejor tus animaciones mientras conversamos.» | **1,25 s** | **4,13 s** | Repitió casi las mismas sugerencias y la invitación a simulación; no desarrolló un controlador de estados de conversación |

Ambos últimos turnos tienen STT `whisper-local`. Kokoro hizo pausas internas **1.110 ms, 1.088 ms y 1.554 ms**, respectivamente, sin espera de texto adicional del modelo (0 ms). El mayor silencio previo total observado fue **1.561 ms**. No confundirlo con latencia Qwen. Los silencios de Kokoro se analizarán en QA A/B independiente: este PR **no modifica síntesis, colas ni chunking**.

## Reparación VQ-03.5

1. **ASR:** añadir el término `VRM` al vocabulario de **modo comando Whisper** junto a `VRAM`; mantener ambas opciones y no corregir ni sobreescribir el transcript. Esto solo puede *favorecer* reconocimiento, no garantiza que desaparezca BRM.
2. **Clarificación de BRM:** cuando la transcripción contiene **«avatar BRM»** dentro de una consulta definitoria sin pistas de GPU, ofrecer la pregunta «Whisper entendió BRM. ¿Querías decir VRM, el formato de avatar humanoide 3D?». No inventar expansión de BRM. No alterar consultas reales BRM empresariales/meteorológicas ni dudas explícitas de VRAM hardware. No cambiar texto del usuario/historial.
3. **Diferenciar intención:**
   - «mejorar mis/tus animaciones para que se vean naturales» → naturalidad: interpolación, mezclas, mirada, respiración, micromovimientos como **recomendaciones**, no cambios aplicados.
   - «controlar mis/tus animaciones mientras conversamos» → orquestación: eventos `escucha → pensamiento → habla → reposo`, selección y mezcla acotada Motion R8, gestos y visemas sincronizados con Kokoro. No reciclar respuesta de naturalidad anterior.
4. **Veracidad:** consejo del modelo sobre «probar una simulación de esos ajustes ahora mismo» se considera **oferta no verificada** y se intenta una sola regeneración mediante el guard de respuestas genéricas/repetidas existente en `bridge/ollama.mjs`. Si el reintento continúa siendo poco confiable, se aplica la aclaración segura ya existente en lugar de pronunciar la promesa. No ampliar acceso a sistema, modelo, archivos ni dispositivos. No hacerlo con mensajes de otros temas ni órdenes directas del usuario.
5. **Cambios limitados:** `speech-vocabulary.mjs` (un término), `vrm-tech-grounding-vq03.mjs` (clasificación/hint/guard), `bridge/ollama.mjs` (reintento acotado tras respuesta), `certify-lumia-vq03-vrm-clarity.ts` (frases exactas y negaciones).

## Comparación de resultados con objetivos de QA

- **Respuesta correcta a «avatar BRM» tras escuchar:** aceptar duda semántica, preguntar por VRM; no declarar falsamente «Base de Recursos Meteorológicos».
- **Naturalidad:** respuesta distinta y técnicamente relevante; no prometer modificar animaciones en vivo desde una consulta de opinión.
- **Control conversacional:** explicar quién controla las transiciones del avatar; no repetir sugerencia genérica ni ofrecer una simulación no implementada.
- **Negativos:** pregunta explícita VRAM/GPU continúa sobre memoria gráfica; pregunta genuina sobre BRM en gestión de recursos permanece libre; gestos/vistas y 17 FBX se mantienen; sin cambios de estado no autorizados.
- **Límites:** una prueba sintética puede confirmar clasificación y reintento, no exactitud real del Qwen ni que Whisper deje de escribir BRM. Se exige QA hablado con micro activo por petición explícita del propietario.
- **Rendimiento:** registrar primer texto/audio, repetición y pausas `Kokoro/WAV`; no comparar la latencia de una aclaración prefabricada con inferencia Qwen. No certificar audio hasta que Kokoro produzca WAV local en la sesión.

## Conservación

La ASUS original permanece en el commit protegido `1580a5182eba540893e35e37065be77da4ed014c` con respaldo LM-01 parcial verificado; PR #83 es `draft` y no debe fusionarse por CI solamente. Uso de terminal separado `LUMIA-VQ03-QA`, preflight VRM +17 FBX y rutas de voz locales existentes en lectura mediante lanzador VQ-03.3; no ejecutar instalador de voz dentro del clon.
