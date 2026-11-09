# LUMIA VISION-04C.1 — Calibración real de desconocidos (solo laboratorio)

## Objetivo

Medir si DeepFace SFace/CPU realmente diferencia a una persona adulta previamente inscrita en el registro DPAPI de **personas adultas desconocidas que han autorizado la prueba**, usando fotografías NUEVAS y sin reutilizar las tres fotos de registro.

La herramienta **no reconoce nombres**, no se conecta a la cámara, no abre LUMIA, no cambia Qwen3.5 2B, no ejecuta Qwen 4B, ni modifica Whisper, Kokoro, avatar o manos. Se ejecuta **solo mediante orden expresa en PowerShell**.

## Muestras que requiere

- Ya debe existir **un perfil adulto voluntario** registrado mediante `adult_enrollment.py enroll`, cifrado con Windows DPAPI.
- Al menos **seis fotos nuevas** del mismo adulto registrado, distintas de las tres de entrenamiento. Idealmente tomadas en sesiones, posiciones e iluminaciones distintas.
- Al menos **tres adultos no registrados**, con permiso individual de participar. Cada uno aporta **cuatro fotos** como mínimo, para un total mínimo de doce fotos desconocidas.
- Una sola cara visible en cada archivo; sin menores y sin datos de identidad real en los nombres de directorios si puede evitarse.
- Guardar todo **fuera de Git** y de carpetas públicas/sincronizadas, por ejemplo bajo `C:\LUMIA-QA-PRIVADO`.

Estructura local ilustrativa:

```text
C:\LUMIA-QA-PRIVADO\
  registrado\
    nuevo01.jpg
    nuevo02.jpg
    nuevo03.jpg
    nuevo04.jpg
    nuevo05.jpg
    nuevo06.jpg
  desconocidos\
    adulto_A\
      01.jpg
      02.jpg
      03.jpg
      04.jpg
    adulto_B\
      01.jpg
      02.jpg
      03.jpg
      04.jpg
    adulto_C\
      01.jpg
      02.jpg
      03.jpg
      04.jpg
```

Las etiquetas de subcarpeta solo agrupan pruebas; **NO son nombres de personas reconocidas**. El programa no imprime nombres de carpetas, fotografías, vectores o la etiqueta del registro.

## Comandos ASUS

Instalar previamente VISION-04B, comprobar VISION-04C.0 con `adult_enrollment.py doctor` y registrar voluntariamente al adulto cuando esté listo. Usa la misma instalación aislada de DeepFace.

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
$py = "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe"
& $py ".\labs\vision-04b\adult_enrollment.py" status
& $py ".\labs\vision-04b\calibrate_open_set.py" `
  --genuine-dir "C:\LUMIA-QA-PRIVADO\registrado" `
  --unknown-dir "C:\LUMIA-QA-PRIVADO\desconocidos"
```

Antes de leer fotografías o consultar DeepFace aparece una confirmación interactiva **ACEPTO CALIBRAR ROSTROS ADULTOS**. Si no se escribe exactamente, no se procesa ninguna imagen.

## Cómo calcula el resultado

1. Verifica formatos/tamaño, que los archivos sean diferentes (hashes solo en RAM) y que haya suficientes adultos y fotografías.
2. Carga solo la plantilla ya cifrada para el adulto registrado; ejecuta DeepFace SFace con **ONNX CPU**, no GPU.
3. Para cada foto calcula la distancia coseno mínima frente a los tres vectores del perfil.
4. Separa imágenes alternas de cada grupo en **calibración** y **comprobación retenida**, para no decidir un umbral y medir sus errores sobre las mismas muestras.
5. Solo si el intervalo entre muestras de calibración auténticas y desconocidas supera **0,06 de distancia** (heurística experimental, NO umbral comercial), propone el punto medio como **candidate_threshold_only**.
6. Cuenta `held_out_false_accepts` (desconocidos que darían coincidencia) y `held_out_false_rejects` (adulto registrado rechazado) sobre las imágenes retenidas. Si hay cualquier error, `pilot_separation_observed` será falso.
7. **SIEMPRE** devuelve `recognition_enabled_in_lumia:false`, `production_approved:false`, `identity_confirmed:false` y no guarda el umbral en archivo.

Una muestra pequeña y muy correlacionada puede aparentar cero errores; eso NO establece fiabilidad poblacional. Deben incluirse condiciones reales y personas diferentes y repetir después con una muestra independiente antes de permitir identificación por nombre.

## Qué esperamos observar

- Distancia de fotos auténticas generalmente menor que la de otros adultos, pero no está garantizada.
- Cero coincidencias erróneas en la comprobación retenida para considerar **seguir investigando**. No se interpreta como certificación de precisión.
- Tiempo de ejecución, CPU, RAM y VRAM registrados físicamente en ASUS sin alterar Qwen 2B.
- Fotografías de frente/perfil, gafas, luz variable; y pruebas de reproducción en pantalla/fotografía como parte de una evaluación futura de presencia real.
- Si no hay una separación clara, **se descarta el umbral candidato**, no se cambia automáticamente al 4B ni se oculta la incertidumbre.

## Controles de privacidad y reversión

- Se utiliza únicamente el conjunto local que el dueño del ordenador preparó, con permisos de adultos. El programa **no almacena imágenes, embeddings, rutas, nombres ni resultados en archivos**. Imprime solo métricas agregadas.
- No usa webcam, servidor, red ni Ollama. Los pesos del modelo fueron descargados previamente por DeepFace, en su propia carpeta local.
- El registro de tres templates sigue cifrado con DPAPI y puede eliminarse mediante `adult_enrollment.py forget`, con confirmación en consola. No garantiza borrado físico irreversible en SSD.
- No guardar salidas de consola con información sensible en repositorios ni utilizar esta etapa para autenticar, abrir puertas o hacer vigilancia.
- Si no hay adultos voluntarios suficientes, **no se salta la prueba** y VI-04C.1 permanece pendiente de validación física.
- Para volver a la LUMIA diaria, inicia tu lanzador de AMR-03.0 o VISION-04A. La calibración no cambia ninguno de ellos.

## Gates para la siguiente versión

VI-04A detecta 1 y 2 rostros en ASUS; VI-04B confirma funcionamiento de SFace en fotos consentidas; VI-04C.0 cifra/desencripta correctamente un perfil adulto; VI-04C.1 reúne muestras auténticas y desconocidas de adultos diferentes, sin falsas aceptaciones en sus controles físicos y con latencia tolerable. Solo entonces considerar **VI-04D**: conexión opcional a la webcam bajo petición, desconocido por defecto, no nombres automáticos y preservación del 2B nativo.
