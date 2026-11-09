# LUMIA VISION-04C.0 — Registro facial voluntario protegido (laboratorio, sin cámara)

## Alcance implementado

Se agrega un CLI experimental para **una sola persona adulta con consentimiento explícito**. Lo llamamos `VISION-04C.0`, no `VISION-04C final`, porque todavía faltan las pruebas de reconocimiento reales, calibración de desconocidos y enlace controlado con la webcam de LUMIA.

**No se modifica** Qwen3.5 2B, 4B, Ollama, Whisper, Kokoro, avatar, `src/App.tsx`, `src/lib/hands.ts` ni cámara compartida. No existe identificación por webcam en esta versión. El script nunca arranca solo.

La ejecución tiene tres partes:

- `adult_enrollment.py enroll` exige **tres fotografías distintas de un mismo adulto** previamente autorizadas, cada una con exactamente un rostro; pide una confirmación explícita escrita en consola. DeepFace SFace/ONNX se ejecuta en CPU.
- `adult_vault.py` guarda únicamente las tres representaciones faciales de 128 dimensiones, más una etiqueta y fecha, dentro de **un único archivo cifrado por Windows DPAPI ligado al usuario local**: `%LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B\adult-vault.dpapi`. Las fotografías originales no se copian y nunca se graban nuevas imágenes.
- `adult_enrollment.py probe` compara una fotografía autorizada contra los tres vectores, devuelve tres distancias de coseno y SIEMPRE `known_identity:false`, `needs_calibration`. **Nadie será identificado automáticamente** hasta completar calibración y controles anti-falsos positivos.

## Pasos ASUS

Primero, instalar VI-04B con su `labs/vision-04b/setup-asus.ps1`, en una terminal normal de PowerShell, sin privilegios de administrador y sin modificar el Python de Whisper/Kokoro. El sistema operativo debe ser Windows y la cuenta con DPAPI disponible.

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
$labpy = "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe"
& $labpy ".\labs\vision-04b\adult_enrollment.py" doctor
& $labpy ".\labs\vision-04b\adult_enrollment.py" status
```

Después, **únicamente cuando el adulto haya autorizado el registro**, selecciona tres fotos distintas de buena calidad, con un rostro por fotografía, tomadas con luz y ángulos moderadamente diferentes. Guárdalas fuera de GitHub, de carpetas sincronizadas públicamente y del propio repositorio. Introduce el consentimiento manualmente en la consola. Ejemplo con rutas ficticias:

```powershell
& $labpy ".\labs\vision-04b\adult_enrollment.py" enroll --label "Adulto piloto" --photos "C:\PRIVADO\a.jpg" "C:\PRIVADO\b.jpg" "C:\PRIVADO\c.jpg"
```

Comprueba una foto separada (no una de entrenamiento):

```powershell
& $labpy ".\labs\vision-04b\adult_enrollment.py" probe --photo "C:\PRIVADO\prueba.jpg"
```

Resultado experimental con `distance_min`, `distance_median`, `distance_max`, sin etiqueta de identidad ni imágenes. Compara distancias entre fotos propias distintas y fotografías de otros adultos consentidas: **enviar solo métricas agregadas, nunca fotos o embeddings a GitHub o chat**. Si una prueba presenta un falso positivo no se avanza al reconocimiento activo.

El registro local se puede eliminar mediante:

```powershell
& $labpy ".\labs\vision-04b\adult_enrollment.py" forget
```

Se solicitará confirmación escrita. Esto elimina el archivo de registro, no las fotos originales ni garantiza borrado físico irreversible de bloques anteriores en SSD o copias de respaldo. DPAPI protege en reposo frente a otros usuarios y archivos copiados, pero **no** frente a malware que ejecute código en la misma sesión Windows ni ante una cuenta comprometida.

## Regla sobre menores

El laboratorio **no está diseñado para registrar menores** y su primer QA físico debe utilizar solamente adultos con consentimiento explícito. No se infieren parentescos, identidades ni edades a partir de rostros. Para una eventual fase familiar se necesitan protección adicional y autorización apropiada, además de calibración.

## Criterios para avanzar a reconocimiento real

1. VISION-04A reconoce por **detección** uno y dos rostros en la webcam física ASUS; medir CPU y latencia de Kokoro.
2. VISION-04B/SFace compara imágenes de distintos adultos con rechazo de desconocidos; calibrar umbral con pruebas positivas y negativas, no heredar un umbral genérico como prueba de identidad.
3. VISION-04C.0 carga y borra el registro cifrado correctamente en ASUS, nunca almacena fotos, y toda prueba biométrica es voluntaria.
4. Probar cara parcial, iluminación baja, gafas, cambios de ángulo, fotografía presentada a cámara y casos de identidad incierta. Anti-spoofing deberá tratarse como señal probabilística, no una garantía de vivacidad.
5. Solo entonces proponer VI-04C.1 con comparación visual bajo demanda e identidad **no confirmada por defecto**, limitación de recursos y aviso al usuario.

## Pruebas de software (no son precisión biométrica)

```powershell
py -3.11 -m unittest discover -s labs/vision-04b/tests -p "test_*.py" -v
```

Las pruebas son sintéticas, con un cifrador simulado en Linux y pruebas reales de DPAPI en los runners Windows. Ninguna incluye fotografías reales de usuarios. La compilación `npm run build` comprueba que LUMIA sigue compilando.

## Rollback y control de cambios

Rama aparte `feature/lumia-vi04c0-adult-enrollment-vault-20261109`, PR borrador apilado sobre VI-04B. Para volver a LUMIA estable no necesitas cambiar ninguna configuración de lanzamiento: no hay cambios de runtime en este incremento. No fusionar PR hasta completar aceptación física.
