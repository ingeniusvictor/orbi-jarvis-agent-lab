# AMR-02.8 — Benchmark visual controlado ASUS (sin optimizaciones prematuras)

**Fecha:** 2026-11-08. **Base:** AMR-02.7 / PR #65. **Estado:** laboratorio local; NO afirma resultados de ASUS hasta ejecutarse físicamente.

## Propósito y evidencia anterior

La fotografía que el usuario compartió muestra **8 personas, 7 de pie y 1 agachada**. En AMR-02.7, las preguntas genéricas a 768 px dieron 7, mientras el reanálisis consentido a 1024 px dio 8. Las preguntas y la cantidad de tokens diferían, por lo que **no se podía concluir causalidad solamente por resolución**. El mismo bridge midió un procesamiento con `cachedTokens=336` en ambos casos, sin demostrar caché de imagen. Este benchmark aísla la **pregunta** y alterna el orden para reducir efectos de calentamiento.

## Qué entrega

- `scripts/benchmark-lumia-amr028-controlled.ps1` se ejecuta en **PowerShell Windows en la ASUS** y recibe por parámetro la **ruta de una foto local elegida por el usuario**.
- Lee exclusivamente la fotografía indicada (JPG/PNG/BMP; máx. 12 MiB, 100 megapíxeles), prepara en memoria dos JPEG a calidad 76 y resolución máxima de lado largo **768** y **1024**. Usa System.Drawing con interpolación de calidad; se preserva la fuente original, sin escalar el JPEG de 768.
- Ejecuta ciclos alternados **ABBA (768→1024→1024→768)** y **BAAB (1024→768→768→1024)**, 3 ciclos por defecto = **6 inferencias por resolución**. Cada consulta lleva idéntico texto de usuario, idéntico prompt de visión construido a partir de los componentes de LUMIA AMR-02.7, mismo modelo y opciones (temperatura 0, contexto 4096, 256 tokens, `think:false`, `stream:false`). Cada respuesta es **una inferencia real** `/api/chat`.
- Muestra respuesta en terminal y métricas por intento: `total_duration`, `prompt_eval_duration`, `eval_duration`, `prompt_eval_count`, `prompt_eval_cached_count` cuando Ollama lo devuelva, `done_reason`.
- Validador conservador solo extrae un **total explícito de personas** en español. Si no reconoce una cifra, dice `sin evaluar`, **no** convierte el resultado en un error ni inventa precisión. La postura (7 de pie / 1 agachada) **se valida manualmente leyendo cada respuesta**.
- Muestra tabla por resolución con **mediana** de latencia y número de totales explícitos correctos/evaluables.
- No modifica Modelfile, GPU, tensor, `main`, Whisper, Kokoro ni VRM; tampoco ejecuta webcam, navegación, cargas a Internet, migraciones o cambios de modelo.
- Sin `-SummaryCsv`: **no escribe archivos**. Con `-SummaryCsv 'C:\...\metricas.csv'`: guarda **solo datos numéricos y estado**; nunca respuesta completa, fotografía, base64, nombre de archivo o pregunta. Solo a ruta seleccionada explícitamente.
- El JPEG generado por **System.Drawing** no es bit-a-bit idéntico al JPEG generado por **Canvas** del navegador. Por ello, el benchmark es una comparación aislada muy cercana, **no un test end-to-end del mismo codificador**. Reportar esta limitación al evaluar.
- La reutilización de caché, si la hay, puede alterar tiempos. Alternar ABBA/BAAB mitiga sesgos de orden, pero no desactiva la caché ni garantiza ensayos independientes. `prompt_eval_cached_count` mide tokens reutilizados, no certifica caché visual.

## Ejecutar

Cerrar LUMIA si se desea liberar recursos de la GPU, dejando **Ollama encendido**. Desde PowerShell en la ASUS:

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
npx.cmd tsx scripts/certify-lumia-amr028-controlled-benchmark.ts

# Sustituir la ruta por la foto original de ocho personas:
.\scripts\benchmark-lumia-amr028-controlled.ps1 -ImagePath "C:\Ruta\foto-grupo.jpg" -Cycles 3 -ExpectedTotal 8

# Exportar solo cifras (opcional; no guarda fotos ni respuestas):
.\scripts\benchmark-lumia-amr028-controlled.ps1 -ImagePath "C:\Ruta\foto-grupo.jpg" -Cycles 3 -ExpectedTotal 8 -SummaryCsv "C:\Ruta\metricas-amr028.csv"
```

Para seleccionar el archivo con un explorador gráfico sin conocer la ruta, utilizar `System.Windows.Forms.OpenFileDialog` antes de llamar al script con `-ImagePath`.

## Criterios de decisión

- Comparar **porcentajes de totales correctos entre totales explícitos**, y reportar por separado cuántas respuestas fueron `sin evaluar`. No inflar denominadores.
- Comparar medianas de `EntradaS` y `TotalS`, desglosando posibles tokens de caché.
- Confirmar manualmente para cada acierto de total el reparto **7 de pie, 1 agachada**.
- No concluir que 1024 «siempre» mejora el modelo: esta foto es una primera prueba controlada con un solo ejemplo, sin independencia estadística entre repeticiones de la misma escena.
- No cambiar GPU/voz/avatar hasta tener datos de esta ASUS; si hay latencia muy alta considerar optimizar el procesamiento de entrada en una fase separada, nunca mediante recortes de respuesta que aparenten precisión.

## Certificación

`scripts/certify-lumia-amr028-controlled-benchmark.ts` compara el prompt/Modelfile por API de código, verifica defaults, respeto por el modo consentimiento, no-escritura sin opt-in y exige que el launcher AMR-02.7 quede intacto. La CI nueva valida sintaxis del PowerShell en pwsh y ejecuta regresiones completas heredadas. **La CI no puede ejecutar Ollama ni acceder a la fotografía privada en la ASUS**.
