# LUMIA VI-04B — laboratorio aislado DeepFace SFace / ONNX CPU

> **CONTINUIDAD OFICIAL (09-11-2026):** [Resumen completo de resultados reales en ASUS, estado de PR #74–#77, CI, límites de seguridad y tareas pendientes](../../docs/lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md). **Leer antes de reanudar o abrir otro chat.** El par positivo real y el negativo ya fueron medidos; C0/C1 siguen sin registro/calibración físicos y la última auditoría del runtime ASUS aún está pendiente.


**Estado:** piloto de comparación de dos fotografías adultas autorizadas, NO reconocimiento en vivo ni registro de identidades. No fusionar con main sin validar en ASUS.

## Origen y modelos

Fork: https://github.com/ingeniusvictor/deepface, commit fijado `a8cee7b3949d6d9fbba53c82eeca6956e233d623`, versión `0.0.104`. Se usan `DeepFace.represent` y `DeepFace.verify` con SFace ONNX, representación de 128 dimensiones; se solicita `DEEPFACE_BACKEND_ENGINE=onnx` y `DEEPFACE_ONNX_PROVIDERS=cpu`.

El código DeepFace declara MIT. El peso SFace de OpenCV Zoo se ofrece bajo Apache-2.0, pero su procedencia de entrenamiento para determinadas aplicaciones comerciales sigue bajo consulta pública. **Este laboratorio no supone autorización comercial ni redistribuye pesos.**

## Qué se implementó

1. Compara dos fotos distintas, máximo 12 MB cada una, JPG/PNG/WebP. No las copia ni modifica.
2. Exige exactamente **un rostro** en cada fotografía, detectado por OpenCV de DeepFace; no elige aleatoriamente entre varios.
3. Genera embeddings alineados en memoria y ejecuta verificación SFace/coseno.
4. Devuelve solo coincidencia *candidata*, distancia, umbral y duración. **No imprime identidades, nombres, fotografías ni vectores**.
5. La comprobación todavía no está calibrada en ASUS y **no acredita identidad**, presencia física o vivacidad.
6. No accede a webcam, micrófono, Qwen, Whisper, Kokoro ni avatar; no añade modelos a VRAM.
7. Los pesos se pueden descargar en primer uso y se guardan en `%LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B\.deepface\weights` (sin imágenes personales).

## Cómo instalarlo y probarlo en ASUS

Requiere Python 3.11 o 3.12 de 64 bits y conexión para la instalación inicial. El instalador crea un entorno virtual bajo `%LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B\.venv` sin alterar el Python de voz de LUMIA. No ocurre ningún cambio en LUMIA por solo abrir su aplicación.

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
powershell -NoProfile -ExecutionPolicy Bypass -File .\labs\vision-04b\setup-asus.ps1
& "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe" ".\labs\vision-04b\verify_pair.py" --doctor
```

Ejemplo de prueba con **dos fotos diferentes de un adulto que haya consentido**, guardadas FUERA del repositorio:

```powershell
& "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe" ".\labs\vision-04b\verify_pair.py" --image-a "C:\FOTOS-PRIVADAS\foto_a.jpg" --image-b "C:\FOTOS-PRIVADAS\foto_b.jpg"
```

Repetir con un par de adultos distintos y consentimiento para medir falsas coincidencias. **No usar fotos de menores** en el piloto inicial ni compartir fotos/resultados biométricos en GitHub.

## Pruebas automáticas

```powershell
py -3.11 -m unittest discover -s labs/vision-04b/tests -p "test_*.py" -v
```

Estas pruebas usan un DeepFace simulado: no prueban precisión de reconocimiento real. También deben pasar las regresiones de LUMIA y la compilación de TypeScript.

## Puertas para VISION-04C

- VI-04A funciona con uno y dos rostros físicos en webcam, sin degradar Kokoro.
- VI-04B valida tanto coincidencias positivas como negativas con fotografías consentidas y sin falsos positivos graves.
- Se mide CPU, RAM, respuesta del primer token, TTS y VRAM con laboratorio apagado/encendido.
- Se calibra alineación, umbrales, política de desconocidos y confirmación entre fotogramas.
- Antes de cualquier galería persistente deben existir cifrado, permiso, consulta y borrado efectivo.
- Comenzar registro voluntario solo de adultos; no desbloquear equipo con un resultado facial experimental.

## Reversión

El runtime de LUMIA no cambia. Ejecutar el lanzador VI-04A o AMR-03.0 normalmente. Para retirar el laboratorio, cerrar el proceso Python y eliminar la carpeta local `%LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B` si ya no deseas conservar el venv ni sus pesos; no se tocan fotografías externas.

## Open Source Hands

El repositorio `ingeniusvictor/open-source-hands` ya tiene un plan `docs/PLAN-LUMIA-GESTURE.md` (MEMORY → VISION → GESTURE) y LUMIA ya dispone de hand tracking propio. No sustituir `src/lib/hands.ts` ni abrir otra webcam: el futuro adaptador solo debe consumir landmarks existentes. Este incremento no realiza esa integración.

## Diagnóstico privado de primera comparación (FIX-VI04B-01)

Al probar dos fotos reales, `verify_pair.py` antes ocultaba **todos** los errores como `LabError`. Ahora indica `error_code` y `photo: "A"|"B"` sin revelar rutas, caras, nombres ni vectores:

- `NO_FACE_DETECTED`: Haar/OpenCV no detectó una cara suficientemente frontal en la fotografía indicada. No confundir con que SFace no funciona. Intenta otra foto con buena luz o el detector alternativo `yunet`.
- `MULTIPLE_FACES`: hay dos o más caras detectadas; utiliza una imagen con una sola persona.
- `PHOTO_NOT_FOUND`, `PHOTO_UNSUPPORTED`, `PHOTO_SIZE_INVALID` o `SAME_IMAGE`: problema local con la selección de archivos.
- `BAD_EMBEDDING`: SFace devolvió un vector no finito o de dimensión distinta de 128.
- `MODEL_RUNTIME_ERROR` o `VERIFY_RUNTIME_ERROR`: error del modelo o de la verificación; no se imprime el mensaje original porque DeepFace puede incluir rutas privadas.

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
$labPython = "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe"
& $labPython ".\labs\vision-04b\verify_pair.py" --image-a $foto1 --image-b $foto2
```

El programa sigue rechazando cualquier foto sin cara o con varias. **NO usar `enforce_detection=False` ni `detector_backend=skip`**, pues permitirían comparar la imagen completa en lugar de una cara detectada.

Si el resultado acusa `NO_FACE_DETECTED`, el fork DeepFace revisado ofrece una alternativa con YuNet, usando ONNX en CPU. Se activa solo al solicitarla y puede descargar pesos oficiales adicionales en la primera prueba:

```powershell
& $labPython ".\labs\vision-04b\verify_pair.py" --image-a $foto1 --image-b $foto2 --detector-backend yunet
```

No se instaló otro cerebro ni se cambió el servidor LUMIA. Un resultado `match_candidate` es solo diagnóstico experimental, **no una identidad real confirmada**.

## FIX-VI04B-02: recorte de una cara con el mouse, sin guardar nueva imagen

Un caso real en ASUS dio `MULTIPLE_FACES` en A con Haar/OpenCV y `NO_FACE_DETECTED` en A con YuNet. Son diagnósticos divergentes de los detectores, no una prueba de que exista más de una persona.

**Si la fotografía A sí muestra una sola persona**, el piloto puede abrir una ventana nativa Windows para que el usuario delimite manualmente la región de la cara. Esto no selecciona una cara automáticamente: el usuario debe arrastrar un recuadro y pulsar `Usar recorte`. Es importante incluir frente, ojos, nariz, mentón y margen alrededor, sin caras adicionales.

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
$labPython = "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe"
& $labPython ".\labs\vision-04b\verify_pair.py" `
   --image-a $foto1 --image-b $foto2 --manual-crop-a --detector-backend yunet
```

- La selección de la imagen se muestra con Tkinter; los píxeles se recortan con OpenCV en RAM y se entregan como array BGR compatible con DeepFace. **No se guarda otra fotografía ni un recorte temporal**.
- DeepFace sigue exigiendo `enforce_detection=True`, `max_faces=None`, vector válido SFace 128d y **exactamente una cara en el recorte**. No se acepta un recorte sin detección facial ni se salta el modelo.
- Si también falla la foto B, se puede añadir `--manual-crop-b`. Si se rechaza el recuadro, seleccionar una fotografía nueva, frontal y bien iluminada es la opción preferida.
- El botón `Cancelar`, cerrar la ventana o un recorte demasiado pequeño no generan resultados de identidad.
- Errores adicionales: `CROP_CANCELLED`, `CROP_TOO_SMALL`, `CROP_INVALID`, `GUI_UNAVAILABLE`, `PHOTO_READ_ERROR`, `PHOTO_TOO_LARGE`. Las salidas no contienen rutas privadas, nombres o fotos.
- La GUI solo existe en la prueba bajo demanda del script `verify_pair.py`; **no afecta** el visor LUMIA, la webcam, la voz ni el registro encriptado.
- La funcionalidad es un instrumento de diagnóstico manual de fotos, NO una vía para usar reconocimiento automático sin pruebas de seguridad.

## FIX-VI04B-03: evitar coincidencias falsas por comparar dos veces la misma foto

En QA físico el usuario vio **la misma fotografía en las dos ventanas**, y SFace obtuvo `match_candidate:true` con distancia `0.04711`. Ese resultado **NO se acepta como prueba positiva**, porque se desconoce si las imágenes de origen eran realmente diferentes.

El laboratorio ahora calcula hashes SHA-256 de ambos archivos **solo en memoria** antes de abrir ventanas o llamar al modelo. Si los contenidos son exactamente iguales, rechaza la comparación con `SAME_IMAGE_CONTENT`, incluso si los archivos tienen nombres o rutas diferentes. No imprime hashes, rutas ni fotos.

Las ventanas de recorte muestran `FOTO A` / `FOTO B` y el **nombre original del archivo exclusivamente en la pantalla local**, para verificar que se eligieron las fotografías deseadas. Ese nombre no se imprime en logs, CI ni stdout. No se modifican fotos, modelos ni el vault DPAPI.

Verificación independiente en PowerShell (sin compartir rutas ni hashes):

```powershell
$mismaRuta = (Resolve-Path -LiteralPath $foto1).Path -eq (Resolve-Path -LiteralPath $foto2).Path
$mismosBytes = (Get-FileHash -LiteralPath $foto1 -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $foto2 -Algorithm SHA256).Hash
Write-Host "Misma ruta:" $mismaRuta
Write-Host "Mismos bytes:" $mismosBytes
```

Si `Mismos bytes: True`, selecciona una **segunda captura genuinamente distinta de la misma persona adulta**; es inválido usar la misma imagen dos veces. Si aparece `False` pero las dos ventanas muestran la misma escena, inspecciona por separado los dos archivos originales: el hash solo detecta duplicados exactos, no imágenes recomprimidas o capturas equivalentes. En ese caso tampoco se valida la prueba positiva hasta confirmar dos fotografías independientes.

Después del control, repetir `--manual-crop-a --manual-crop-b` con la selección correcta. El objetivo es comparar dos tomas realmente diferentes, no demostrar que una imagen coincide consigo misma.

## VI-04C.0/VI-04C.1 en ASUS: recorte manual opcional para registro y calibración

Tras completar dos ensayos físicos de comparación con **recortes manuales** (misma persona, dos capturas diferentes: distancia 0.27631; personas diferentes: 1.00394), se habilitó el mismo recorte **opt-in** en los comandos de registro cifrado y calibración.

**El registro sigue apagado por defecto.** Los comandos no se ejecutan al iniciar LUMIA. No se usa webcam ni se envían fotografías a GitHub. Solo adultos con consentimiento expreso; los controles no prueban identidad ni presencia real.

Para una prueba de registro privado **voluntaria** en la ASUS:

1. Preparar tres fotografías realmente distintas, tomadas en momentos/ángulos diferentes, de un mismo adulto que consiente. Mantenerlas **fuera del repositorio Git**. No incluir niños ni otras personas en esos recortes.
2. Revisar si existe ya un perfil: 
   `& $labPython ".\labs\vision-04b\adult_enrollment.py" status`
3. Si no existe y el adulto consiente, usar:
   `& $labPython ".\labs\vision-04b\adult_enrollment.py" enroll --label "Adulto piloto" --photos $f1 $f2 $f3 --manual-crop --detector-backend opencv`
4. Confirmar interactiva y literalmente `ACEPTO REGISTRAR MI ROSTRO`. Recién entonces aparecerán las **tres** ventanas de selección manual. Cancelar aborta la operación sin guardar el registro.
5. Si hay éxito, únicamente se almacenan 3 embeddings normalizados cifrados con DPAPI/current user en `%LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B\adult-vault.dpapi`. Los archivos originales no son copiados ni modificados. Se requiere permiso de adulto real, no solo una cadena escrita por otra persona.
6. El registro nunca informa `identity_confirmed=true` ni habilita reconocimiento en vivo.
7. Si el titular desea borrarlo: `& $labPython ".\labs\vision-04b\adult_enrollment.py" forget`, aceptar la frase exacta `ELIMINAR REGISTRO FACIAL`. El borrado lógico no garantiza borrado seguro de los bloques SSD.

La extracción de SFace sigue requiriendo un rostro real, exactamente uno, aun después del recorte. `enforce_detection=True`, `max_faces=None`. El flag de recorte no implica detección automática.

Para la **calibración experimental**, solo después del registro voluntario, preparar un conjunto distinto: carpeta `genuine` con al menos seis fotos nuevas del adulto registrado y carpeta `unknown` con al menos **tres subcarpetas de otros adultos distintos**, cada una con mínimo cuatro fotografías con consentimiento. Ninguna imagen debe coincidir con las tres usadas en el registro. Guardar todo fuera de Git:

```powershell
& $labPython ".\labs\vision-04b\calibrate_open_set.py" `
   --genuine-dir $directorioConocido `
   --unknown-dir $directorioDesconocidos `
   --manual-crop --detector-backend opencv
```

Se pide una nueva frase de autorización: `ACEPTO CALIBRAR ROSTROS ADULTOS`. La interfaz recortará las fotos **una por una en RAM**; el proceso no genera copias nuevas ni un dataset dentro de Git. Solo salen métricas agregadas, un umbral candidato y el indicador experimental de separación. La cantidad mínima de fotografías **no prueba precisión poblacional**. Nada se activa automáticamente en LUMIA.

**Puertas restantes:** validar el registro y calibración *real* en ASUS; calibrar detección automática sin recortes, evaluar condiciones de luz/movimiento, falsas aceptaciones/rechazos, anti-spoofing/liveness y CPU frente a la voz. Mantener PR en borrador y `main` intacta hasta superar esas pruebas.
