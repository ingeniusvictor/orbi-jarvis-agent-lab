# AMR-02.3 · LUMIA Vision — ensayo de resolución 512 / 768 / 1024

**Fecha:** 2026-11-07
**Base:** PR #59 AMR-02.2; cerebro local `qwen3.5:4b-vision4096` ya probado por el propietario.
**Alcance:** control manual para comparar latencia y exactitud visual. **Todavía NO activar adaptación automática** sin datos empíricos.

## Medición que motivó el piloto

Del puente ASUS:
```text
[lumia] visual local model=qwen3.5:4b-vision4096 context=4096
total=30191ms input=28636ms load=11ms inputTokens=1433
outputTokens=49 generate=1503ms speed=32.6tok/s doneReason=stop
```
La entrada representa 94.85 % de Ollama, en esa imagen. No permite deducir una curva de 512/768/1024 ni garantizar 1-3 segundos con 512px.

## Implementación

- El propietario elige **512 / 768 / 1024 px** mediante botones discretos en el visor (cámara y archivo) o en el pie de una fotografía adjunta del compositor.
- **1024 px por defecto**, que es el tamaño máximo anterior. No cambia la configuración global del asistente. No hay persistencia entre reinicios.
- Un solo estado `visionResolution` compartido por el compositor, el visor y la captura de voz autorizada `captureLumiaAuthorizedStill`.
- Se usa siempre la **fuente original** para cada redimensionado. En el visor de archivo, cambiar la resolución antes de analizar re-encodifica el `File` seleccionado, nunca se redimensiona a partir del JPEG anterior.
- El visor no abre cámara ni envía a Ollama al cambiar de resolución; el usuario todavía debe pulsar **Capturar y analizar** o **Analizar imagen**. El seguimiento de una imagen congelada reutiliza exactamente el mismo JPEG autorizado (no altera su resolución silenciosamente).
- No hay reintento automático de imágenes, procesamiento paralelo ni exposición de binarios JPEG en los logs.
- El navegador registra solo metadatos para diagnóstico:
  `[lumia:vision-amr023] prepared source=file limit=512px actual=512x384 encodedChars=...`.
- El puente registra `inputTokens`, `input` (ms), `total`, `outputTokens`, `doneReason`; el resultado de la imagen se ve en la conversación, pero sus bytes no se copian a transcript ni diagnóstico.
- Los 4.096 tokens y el reparto del modelo híbrido 4B (32 capas GPU y batch 128 en Modelfile) siguen sin cambios.
- Whisper, Kokoro, VRM, animaciones, cámara temporal y selector AMR-02 siguen intactos.

## Benchmark local de una fotografía

Con el PR instalado, desde PowerShell:
```powershell
cd C:\Users\ingvm\LUMIA-ASUS
.\scripts\benchmark-lumia-amr023-vision.ps1 -ImagePath "C:\ruta\mi-foto.jpg"
```
El script solo envía el JPEG temporal a `http://127.0.0.1:11434/api/chat`, con la misma pregunta y mismo modelo en las tres pruebas secuenciales (contexto 4096, thinking off, 256 tokens). No modifica los modelos ni guarda fotografías. Se recomienda comparar la misma foto también desde el visor para medir la sobrecarga de LUMIA/Whisper/Kokoro. La codificación Windows System.Drawing no es necesariamente idéntica a la del canvas web (p.ej., color/transparencia/EXIF), por lo que los resultados del script son comparativos, no una réplica perfecta.

Registro deseado:
| Máx. lado | Entrada tokens | Procesar entrada (s) | Total (s) | Calidad de conteo | Colores / ubicación | Texto pequeño |
|---|---|---|---|---|---|---|
| 1024 | | | | | | |
| 768 | | | | | | |
| 512 | | | | | | |

## Criterios GO / NO-GO para futura selección automática

**GO:** 512 o 768 reducen consistentemente `inputTokens` y `input` al menos con 3 fotos distintas; mantienen calidad aceptable para escenas, colores y posiciones; 1024 continúa disponible para OCR; el 4B no se cae.

**NO-GO:** el modelo pierde personas u objetos, alucina más, no baja `input`, recorta texto, falla con fotos no cuadradas o altera la privacidad de cámara.

Hasta acumular datos, no activar selector automático por heurística. Las fotos reales deben ser evaluadas con el mismo prompt, contexto y semilla/configuración posibles, sin afirmar que una única prueba es prueba estadística.
