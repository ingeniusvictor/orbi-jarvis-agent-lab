# LUMIA VI-04B — laboratorio aislado DeepFace SFace / ONNX CPU

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
