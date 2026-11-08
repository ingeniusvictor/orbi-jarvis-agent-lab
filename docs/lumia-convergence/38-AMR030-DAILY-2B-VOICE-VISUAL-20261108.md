# LUMIA AMR-03.0 — Piloto diario ASUS 2B, continuidad Kokoro y revisión de conteos

**Fecha:** 2026-11-08. **Base:** AMR-02.9 / PR #67. **Estado:** piloto opcional; las mejoras de rendimiento no están demostradas en hardware ASUS hasta que el propietario haga la prueba real.

## Evidencia que motiva esta fase

En la ASUS el usuario probó Qwen3.5 `2b-q4_K_M` y `4b-vision4096` con las mismas consultas. Para texto sencillo el primer texto llegó tras **2,86 s con 2B** versus **4,78 s con 4B**. Para una fotografía grupal el primer texto tardó **8,70 s con 2B** versus **27,04 s con 4B**; las descripciones erraron la cantidad de personas en ambos casos (8 reales para la foto de referencia, descripción 7 por 4B, y 6 por 2B, contradiciéndose este último con sus propias subcategorías 3+4=7). En otra foto de cámara el 2B respondió más rápido pero era un **seguimiento con 447 tokens de caché**, no una comparación de fotografías independientes.

Al escuchar la salida real, el registro atribuyó silencios de **6,336 s** y **11,731 s** antes de frases del 2B a la ruta Kokoro/WAV; no al modelo de texto. La implementación existente ya tiene **prefetch de un segmento por delante** y un trabajador residente Kokoro serializado. No sabemos todavía si fragmentos más cortos mejoran la experiencia en esta ASUS y no debe prometerse.

## Cambios aislados

1. `INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd`: nuevo lanzador opcional que activa el modelo existente `qwen3.5:2b-q4_K_M` como predeterminado *solo en esa sesión*. Invoca directamente el lanzador base `INICIAR_LUMIA_ASUS_RAPIDA.cmd` para no atravesar `INICIAR_LUMIA_ASUS_VISION4096.cmd`, que reemplaza expresamente el modelo por 4B. El selector **CEREBRO LOCAL** puede seguir activando el 4B. El inicio requiere solo Ollama y el modelo instalado, sin modificar pesos, Modelfile, capas GPU o configuración persistente.
2. Preserva AUTO conservador AMR-02.4 (768 px para escenas generales), contexto consentido AMR-02.5, rastreo y coherencia entre turnos AMR-02.6 y métricas de tokens AMR-02.7. **No activa en el piloto diario el salto automático a 1024 px para preguntas de grupo**: se mantiene manual y siempre con autorización del propietario. El lanzador `INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd` de 4B sigue intacto.
3. `src/lib/kokoro-compact-phrases-amr030.ts`: divide solo frases *mayores de 112 caracteres* en fragmentos alrededor de 86 caracteres cuando es posible, respetando palabras y puntuación. `src/lib/tts.ts` lo habilita solamente cuando `VITE_LUMIA_KOKORO_COMPACT_PHRASES=1` **y** la salida de voz es Kokoro local. El flujo de generación serializado, prefetch siguiente, WAV, cancelaciones y límites se conservan. Esta segmentación no garantiza eliminar silencios; el objetivo es medir si la generación más corta y adelantada los reduce sin perder naturalidad. No se guardan WAV, preguntas ni voz del usuario.
4. `bridge/orbia/vision-posture-selfcheck-amr030.mjs` y un guard opcional en `bridge/ollama.mjs`: si el propio texto visual afirma un total de personas y además dos o más categorías posturales *disjuntas* cuya suma **excede** ese total (ejemplo observado: «seis personas, tres sentadas y cuatro de pie»), se sustituye la respuesta antes de publicarla por una admisión de contradicción y solicitud de nueva inspección. No crea una cifra correcta ni hace otra inferencia. Si la suma es menor, no infiere error porque puede haber otras posturas. No comprueba visualmente las cifras ni evita errores consistentes (por ejemplo, 7 personas en lugar de 8). Sin activación, la respuesta es idéntica a la anterior.
5. Los tests verifican preservación textual del segmentador, opt-in, compatibilidad de los lanzadores, prioridades y seguimiento, sin acceso a fotos ni hardware. CI completa, build y lint.

## Cómo ejecutar en la ASUS

Cierra **solo LUMIA**, no Ollama. En PowerShell:

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
git status --short
git fetch origin refs/heads/feature/lumia-amr030-daily-2b-voice-continuity-20261108:refs/remotes/origin/feature/lumia-amr030-daily-2b-voice-continuity-20261108
git switch -c feature/lumia-amr030-daily-2b-voice-continuity-20261108 origin/feature/lumia-amr030-daily-2b-voice-continuity-20261108
npx.cmd tsx scripts/certify-lumia-amr030-daily-2b.ts
.\INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd
```

**No ejecutarlo si `git status --short` indica cambios no guardados.** El bloque anterior es para la primera instalación de la rama en ASUS. Si la rama ya existe, `git switch` a ella y `git merge --ff-only` del remoto. Si falla `npm ci`, no sobrescribir archivos manualmente.

## Criterios de prueba y rollback

1. Verificar que el launcher indica `Brain: qwen3.5:2b-q4_K_M` y que el selector permite cambiar manualmente al 4B. No modificar la etiqueta ni el modelo por adelantado.
2. Preguntar a LUMIA dos veces una misma frase de voz de ~120–160 caracteres. Registrar **espera a primer texto**, **primer audio**, pausas `Kokoro/WAV`, número de segmentos, finalización completa y si la respuesta suena menos natural. La segmentación podría generar más fragmentos y una latencia total superior: medirlo.
3. Para evaluar seguridad de conteos, pedir una descripción grupal y comprobar que no se afirma un total imposible *si se declara explícitamente otra suma por posturas*. El guard no conoce el conteo verdadero. Evitar crear una cámara o fotografía de forma automática.
4. Si se perciben nuevas pausas o cambios de timbre, revertir usando `INICIAR_LUMIA_ASUS_RAPIDA.cmd` para el 2B sin opt-in, o `INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd` para la ruta 4B certificada. No cambiar variables de entorno del sistema ni borrar modelos.

**Importante:** no se promete mejorar la velocidad de Qwen en preguntas nuevas ni resolver todos los errores de visión; la mejora principal medida hasta ahora es la preferencia por 2B en la ASUS.
