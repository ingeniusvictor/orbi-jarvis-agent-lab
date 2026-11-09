# LUMIA — CONTINUIDAD CANÓNICA / HANDOFF VISION-04 (2026-11-09)

> **Leer primero en un chat nuevo o antes de modificar LUMIA.** Este documento fija lo realmente implementado, probado y pendiente al cierre de la sesión del 9 de noviembre de 2026, hora de Chile. Se redactó con la evidencia aportada por el usuario en la ASUS, los scripts del repositorio y las ejecuciones de GitHub Actions. No contiene fotos, rutas privadas de fotos, embeddings, etiquetas personales ni secretos.
>
> **REGLA:** No confundir CI sintética, ejecución real de comparación de pares y QA del sistema completo. No afirmar identidad confirmada, reconocimiento en vivo ni calidad biométrica certificada.

## 0. Punto de recuperación del proyecto

- Repositorio: https://github.com/ingeniusvictor/orbi-jarvis-agent-lab
- Rama de continuidad **NO fusionada**: feature/lumia-vi04c1-open-set-calibration-cpu-20261109
- Último commit funcional conocido y probado en la rama al redactar este documento: **5cca408dfcbd793423f3f69d31a451771674ed2c**. Este documento es posterior y añadirá commits de **solo documentación**; antes de trabajar, usar el HEAD de la rama y consultar historial.
- PR apilados: [#74 VISION-04A](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/74) → [#75 VISION-04B](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/75) → [#76 VISION-04C.0](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/76) → [#77 VISION-04C.1](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/77). **Todos abiertos en borrador y sin merge** al 2026-11-09. #77 tiene como base la rama de #76, NO main.
- main no se modificó en esta sesión; la rama es acumulativa y no es una release. No fusionar, publicar ni cambiar el lanzador habitual por el solo hecho de que CI pasó.
- Instalación ASUS conocida: C:\Users\ingvm\LUMIA-ASUS; Node v24.20.0, npm 11.19.0; entorno Python de laboratorio aislado en %LOCALAPPDATA%\ORBI\LUMIA-FACE-LAB-VI04B\.venv.
- El usuario actualizó correctamente por fast-forward desde 5005880 a **5cca408** y ejecutó npm run lint: **0 errores, 9 advertencias, exit 0**. Antes del pull, git status --short no mostraba cambios; comprobar estado de nuevo antes de cualquier otra edición.

### Evidencia CI, último código 5cca408

| Flujo | GitHub Actions | Resultado |
| --- | --- | --- |
| PH-01: build, lint, RC-02/RC-03, avatar | https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42711209737 | SUCCESS |
| VISION-04A Face Detection CPU, Windows + Linux | https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42711209781 | SUCCESS |
| VISION-04B SFace isolated lab, Windows + Linux | https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42711209617 | SUCCESS |
| VISION-04C.0 DPAPI, Windows + Linux | https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42711209857 | SUCCESS |
| VISION-04C.1 calibration, Windows + Linux | https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42711209717 | SUCCESS |

Estos cinco flujos pasaron **después de la corrección de sintaxis de 5cca408**. PH-01 había fallado antes por un error de lint. La validación Windows del laboratorio incluye comprobación DPAPI real con datos sintéticos; NO imágenes biométricas reales.

## 1. LUMIA diaria: baseline que no debe perderse

- En ASUS, el lanzador habitual es **INICIAR_LUMIA_ASUS_RAPIDA.cmd**; establece por proceso Ollama y **qwen3.5:2b-q4_K_M** como cerebro local, Whisper CLI/local como STT y Kokoro local como TTS. No cambiar Qwen, Modelfile, VRAM, configuración global de Windows ni el pipeline de audio por el trabajo facial.
- El lanzador mantiene JARVIS_ALLOW_WRITES=0 y Realtime experimental de pago desactivado, sin consentimiento implícito de cámara. El proyecto tiene alternativas experimentales de modelo 4B, pero 2B es el baseline ASUS; ver [AMR-03.0](38-AMR030-DAILY-2B-VOICE-VISUAL-20261108.md).
- **Un diagnóstico directo desde PowerShell NO representa el entorno del lanzador.** En el QA, node scripts/brain-doctor.mjs mostró proveedor Claude (configuración por defecto de esa consola), no prueba que el lanzador ASUS use Claude. node scripts/voice-doctor.mjs mostró STT auto→browser y TTS auto→system fuera de la sesión del lanzador; sin embargo, Whisper executable/model/server, Kokoro Python/adapter/model/voices y local STT/TTS figuraron READY. Whisper hot runtime estaba STOPPED en esa consola inactiva, no es evidencia de fallo de producción.
- sherpa-onnx y los modelos de diarización multivoz figuraron **MISSING/NOT READY**. Es una capacidad separada pendiente; no confundirla con Whisper/Kokoro funcionales o inventar una instalación.
- El preflight de voz offline resultó PASS (Windows Node 24, writes OFF, Realtime OFF), **sin acreditar hardware de sonido**. En GitHub RC-02/RC-03 y PH-01 pasan; el usuario ejecutó también RC-02 y RC-03 localmente: ambos PASS.

## 2. VISION-04A — Detección facial CPU, distinta de reconocimiento de personas

- Código: src/lib/vision-faces-vi04.ts, src/lib/vision-face-worker-vi04.ts, src/ui/LumiaCameraViewfinder.tsx; instalador de pesos scripts/install-lumia-face-model-vi04.mjs.
- Usa MediaPipe BlazeFace en Worker CPU, toma cuadros solo de la cámara ya autorizada, opt-in explícito y ventana de visión activa. Busca/recuadra/cuenta rostros; **no identifica a nadie**, no genera una galería de personas, no guarda imágenes.
- La ruta habitual no activa el detector por sí sola. El lanzador opt-in INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd instala solo pesos públicos cuando el usuario lo ejecuta y luego exige consentimiento/interacción en la interfaz.
- **Incidencia corregida:** scripts/install-lumia-face-model-vi04.mjs tenía una anotación TypeScript en un archivo .mjs: «async function main():Promise<void>{». Oxlint produjo «Expected function body» y falló PH-01. Commit **5cca408** cambió exclusivamente a «async function main(){»; CI PH-01 y VISION-04A revalidaron SUCCESS; en ASUS lint terminó 0 errores.
- **Pendiente de comprobar físicamente:** detección 0/1/2 rostros con consentimiento en webcam ASUS, funcionamiento de overlays, modelo local accesible, estabilidad, CPU y convivencia con Whisper/Kokoro. No declarar este gate validado por el éxito de CI.

## 3. VISION-04B — DeepFace/SFace, laboratorio separado

- Fork DeepFace: https://github.com/ingeniusvictor/deepface, commit fijado **a8cee7b3949d6d9fbba53c82eeca6956e233d623**; SFace/ONNX CPU, 128 dimensiones, métrica coseno. Archivos: labs/vision-04b/verify_pair.py, face_crop_gui.py, setup-asus.ps1, tests/.
- Funciona bajo demanda por CLI; sin webcam propia, Ollama, Whisper, Kokoro, TTS, avatar ni integración con runtime. Detector OpenCV/Haar y alternativa YuNet. Siempre exige **exactamente un rostro detectado** por imagen, enforce_detection=True y max_faces=None. Prohibido «skip» o convertir a enforce_detection=False para forzar éxitos.
- Fotos seleccionadas por el titular; recorte manual A/B opcional con interfaz local Tk; el recorte BGR existe solo en RAM. La GUI muestra FOTO A/B + nombre original en pantalla local para evitar confundir archivos, pero el resultado no imprime nombres/rutas, embeddings ni píxeles.
- Previos diagnósticos reales: Haar reportó MULTIPLE_FACES para foto A; YuNet reportó NO_FACE_DETECTED para A; otras pruebas fallaron con NO_FACE_DETECTED en B. Son falsos positivos/negativos de detección posibles, no prueba de varias personas o de avería de SFace. Los recortes manuales permitieron completar el procesamiento.
- **Error de QA descubierto y corregido:** dos rutas/ficheros distintos resultaron tener exactamente los mismos bytes. Se comparó la imagen consigo misma, dando distancia **0.04711** y match_candidate=true; se declaró **PRUEBA POSITIVA INVÁLIDA**. Se implementó validación SHA-256 de contenido de origen antes de crop/modelo: SAME_IMAGE_CONTENT, sin mostrar hashes/rutas. El usuario verificó físicamente que el nuevo guard bloqueó las copias duplicadas.
- **PRUEBA NEGATIVA REAL VÁLIDA:** dos adultos/personas diferentes, con recorte A+B OpenCV; distance **1.00394**, threshold genérico **0.593**, match_candidate=false, exit=0, tiempo **539 ms** en aquella ejecución. Etiquetado correcto por el usuario.
- **PRUEBA POSITIVA REAL VÁLIDA:** dos tomas independientes del mismo adulto/persona, contenido SHA distinto, recorte A+B OpenCV; distance **0.27631**, threshold genérico **0.593**, match_candidate=true, exit=0, tiempo **1575 ms** en aquella ejecución. El usuario confirmó que ambas fotos pertenecían a la misma persona.
- Conclusión limitada: el modelo emitió la decisión esperada en **un par positivo y uno negativo**, suficiente para validar la ejecución local, **NO** para estimar FAR/FRR, certificar seguridad, confirmar identidad o detectar vida real. Aún no se ha calibrado el umbral 0.593 en ASUS.
- Prueba de regresión sintética en ASUS: **41 tests OK / exit 0** con python -B -m unittest discover -s labs/vision-04b/tests -p test_*.py -q. Los test automatizados no usan rostros reales. El 9/11, git status --short estaba limpio antes del fast-forward.
- Reconstrucción detallada: [README del laboratorio](../../labs/vision-04b/README.md).

## 4. VISION-04C.0 — DPAPI opcional; todavía NO se ha inscrito a nadie

- Implementados labs/vision-04b/adult_enrollment.py y adult_vault.py. Un perfil adulto, tres fotos **independientes** para generar plantillas de 128 valores; solo se persisten tres embeddings normalizados y etiqueta dentro de archivo cifrado Windows DPAPI/current user. No se guardan fotos nuevas ni galerías múltiples.
- Registro exige consentimiento interactivo explícito; solo adultos voluntarios. Protección contra rutas iguales o contenido SHA-256 idéntico; abortar al cancelar. El CLI admite **--manual-crop --detector-backend opencv|yunet** (opt-in) en el alta, precisamente porque en QA real el recorte fue necesario.
- Resultado de la ASUS: adult_enrollment.py doctor => encryption_test:PASS, deepface_installed:true, **vault_exists:false**, webcam_enabled:false, identity_recognition_enabled:false. adult_enrollment.py status => **vault_exists:false**, identity_recognition_enabled:false. Esto NO es fallo: se acordó **no registrar todavía**.
- probe devuelve distancias sin confirmar identidades; forget requiere consentimiento y elimina el archivo lógico DPAPI (no garantiza limpieza física irreversible del SSD).
- Referencia: [registro y borrado](../../labs/vision-04b/VISION-04C0-ADULT-VAULT.md).
- **PENDIENTE / NO EJECUTADO FÍSICAMENTE:** alta consentida de un perfil real, verificación del almacenamiento/borrado real en ASUS; no automatizar ni presionar este paso.

## 5. VISION-04C.1 — Calibración open-set lista en código, NO ejecutada con dataset real

- Scripts: labs/vision-04b/calibrate_open_set.py y open_set_calibration.py; usa solo CPU y el perfil DPAPI creado voluntariamente. Nuevo soporte opt-in de --manual-crop y --detector-backend opencv|yunet para trabajar con recorte en RAM sin guardar imágenes.
- Requisitos mínimos: **6 fotos NUEVAS** del adulto inscrito, **3 adultos desconocidos diferentes** con permiso, al menos **4 fotos por cada uno** (12); separar los 3 retratos usados para alta; directorios privados **fuera del repo**. No reutilizar copias de una misma toma ni considerar versiones recomprimidas como muestras independientes.
- Divisor alterno de muestras para calibración/holdout; compara distancia coseno mínima contra 3 plantillas; heurística experimental de separación ≥ 0.06, candidato de umbral intermedio, métricas agregadas de falsos aceptados/rechazados. Siempre production_approved:false, recognition_enabled_in_lumia:false e identity_confirmed:false. Nunca persiste scores individuales, fotos o nuevo umbral.
- CI y tests sintéticos aprobados. **NO** existen todavía fotos/dataset real analizados para esta fase y no se conoce una tasa de error representativa.
- Referencia: [plan de calibración](../../labs/vision-04b/VISION-04C1-CALIBRATION-QA.md).

## 6. Auditoría cruzada ASUS/GitHub, 9 de noviembre

Evidencia informada desde consola ASUS:

- git pull --ff-only origin <rama> actualizó limpiamente 5005880 → **5cca408**, cambiando **solo una línea** del instalador BlazeFace.
- npm run lint reportó **Found 9 warnings and 0 errors**, código **0**. Antes de corregir, el error estaba en scripts/install-lumia-face-model-vi04.mjs:14, código lint 1.
- 41 pruebas Python de laboratorio: OK. RC-02: PASS/0. RC-03: PASS/0. DPAPI doctor/status: PASS sin vault. Node v24.20.0; npm 11.19.0. Whisper/Kokoro assets READY; multivoice no instalado.
- En CI, PH-01 compiló, hizo lint y pasó RC-02, RC-03, routing de cabeza y prueba del avatar GLB; 04A/B/C0/C1 también pasaron después de 5cca408.
- **9 advertencias lint no bloqueantes**: cleanup/ref React en src/ui/LumiaCameraViewfinder.tsx y src/App.tsx; regexp de control y escape en bridge/orbia/local-translate.mjs; regexp de control en scripts/benchmark-lumia-amr029-config.ts y scripts/certify-lumia-amr029-model-comparison.ts; símbolos sin utilizar en bridge/orbia/vision-trace-amr026.mjs, scripts/certify-lumia-ph047-owner-motions.ts y scripts/certify-lumia-avatar-ph042.ts. No se ocultaron con flags; revisar más adelante en cambios pequeños y con regresiones.
- **No ejecutado después de la última corrección:** sesión integrada y audible en ASUS con cerebro 2B, Whisper, Kokoro, cámara y avatar juntos. No declarar esta auditoría como certificado funcional del hardware.

## 7. PRIORIDADES PENDIENTES — orden estricto

### P0 — Cerrar regresión integral en ASUS SIN registrar caras

1. Confirmar git status limpio y branch/HEAD. No cambiar modelos ni reinstalar dependencias a ciegas.
2. Ejecutar npm run build y npm run lint (CI ya pasó; falta registrar la ejecución local de build tras 5cca408).
3. Iniciar LUMIA con **INICIAR_LUMIA_ASUS_RAPIDA.cmd** y comprobar en la ventana del lanzador que se selecciona Ollama + **qwen3.5:2b-q4_K_M**; NO interpretar el brain-doctor fuera de ese entorno como prueba del modelo usado en sesión.
4. En Chrome/Edge real: texto → respuesta; voz de usuario → Whisper STT; Kokoro TTS audible sin bloqueo; recuperación del micrófono, interrupción y siguiente turno; imagen/foto seleccionada → respuesta de visión y atribución sin inventos; avatar y animaciones sin degradación; cámara solo al solicitar permiso. Registrar si el primer texto y audio tienen latencias anómalas.
5. Ejecutar preflight --live SOLO con LUMIA activa y verificar puente local, flags de escrituras apagados y rutas de voz; confirmar que no consumió servicios pagos.
6. Repetir un ciclo de 3–5 turnos y un reinicio limpio; verificar recursos CPU/RAM y que Qwen 2B/Whisper/Kokoro siguen disponibles. Guardar solo resultados técnicos redactados sin información personal.
7. Ante fallo: capturar error, versión y módulo concreto; NO cambiar a Qwen 4B, modificar todo el pipeline o tocar main como reacción inicial.

### P1 — Gate físico VISION-04A (solo presencia)

Con consentimiento, probar 0, 1 y 2 rostros visibles con BlazeFace CPU, overlay estable, conteos coherentes, sesión de cámara cerrándose y consumo aceptable; no reconocimiento de nombres. Vigilar convivencia con voz y prevenir múltiples capturas simultáneas. Si falla, diagnosticar los cuadros, su orientación y los falsos positivos antes de añadir ML adicional.

### P2 — Registro C0 voluntario (NO desbloqueado por esta documentación)

Solo si un adulto decide registrarse expresamente: 3 capturas independientes, revisión de consentimiento, cifrado DPAPI en la ASUS, status/probe/forget bajo control. El estado actual vault_exists:false es el esperado. No usar fotos de menores ni asumir consentimiento de terceros.

### P3 — Calibración C1 y seguridad de falsos positivos

Tras P2: 6 fotos nuevas genuinas y 12 desconocidas de 3 adultos consentidos, recortes manuales solo si el usuario los solicita; calibración holdout. Medir errores y distancias individuales únicamente en memoria; documentar agregados. Cero errores en pocas muestras NO valida FAR/FRR poblacional. Incorporar más sesiones, iluminación, ángulos, gafas, calidad de captura, replay con foto/video, presentación real y detección anti-spoofing con múltiples cuadros ANTES de nombrar personas.

### P4 — Futuro VISION-04D (no autorizado para comenzar todavía)

Diseñar un adaptador opcional que **reutilice el stream de cámara ya autorizado**, no abra otra webcam, desactive identificación por defecto, use unknown por defecto y solo identifique con alta confianza calibrada + presencia corroborada. No enlazar rostro a permisos de herramientas ni a autenticación de alto impacto. No reconocer menores de manera experimental. Priorizar no degradar latencia del 2B, Kokoro, avatar, memoria o seguridad.

### Mantenimiento (no prioritario)

Revisar 9 advertencias lint sin silenciar reglas; añadir comprobación sintáctica node --check para scripts .mjs si corresponde (la anotación TS ya quedó corregida); QA EXIF/orientación y legibilidad de crops; revisión de licencias de pesos/modelos antes de comercializar. No rediseñar todo LUMIA si el sistema ya funciona.

## 8. Comandos de verificación NO destructivos (PowerShell)

~~~powershell
cd C:\Users\ingvm\LUMIA-ASUS
git status --short
git branch --show-current
git log -1 --oneline

node --version
npm --version
npm run lint
npm run build

node scripts/certify-lumia-response-relevance-rc02.mjs
node scripts/certify-lumia-grounded-claims-rc03.mjs
node scripts/brain-doctor.mjs
node scripts/voice-doctor.mjs
node scripts/lumia-voice-preflight.mjs

$labPython = "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe"
if (Test-Path -LiteralPath $labPython) {
  & $labPython -B -m unittest discover -s labs/vision-04b/tests -p "test_*.py" -q
  & $labPython ".\labs\vision-04b\adult_enrollment.py" doctor
  & $labPython ".\labs\vision-04b\adult_enrollment.py" status
}
~~~

Nota: npm run build genera artefactos de dist/, no modifica por sí mismo el código fuente; comprobar git status al terminar. No ejecutar enrolamiento, calibración ni instalación de pesos sin decisión expresa. Los comandos doctor lanzados en PowerShell normal pueden reflejar el proveedor de entorno por defecto (Claude) y las rutas de voz por defecto; abrir el lanzador ASUS para evaluar el modo local real.

## 9. Protocolo de continuidad para un CHAT NUEVO

1. Leer este documento primero: docs/lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md.
2. Consultar HEAD actual, PR #74–#77 y últimos CI; el commit conocido 5cca408 es el snapshot **anterior a los commits de documentación**.
3. Distinguir siempre: **verificado por CI**, **verificado físicamente en ASUS**, **pendiente**; no transformar tests sintéticos en fiabilidad biométrica real.
4. Preservar por defecto Qwen3.5 2B, Whisper, Kokoro, el lanzador diario, la webcam compartida, avatar y seguridad. No mezclar otro proyecto de LUMIA ni fusionar ramas sin autorización.
5. Retomar primero **P0 (QA integrada ASUS)**. Si el usuario no puede probar hardware, se puede mejorar documentación/test sintéticos, pero no afirmar que la prueba física ocurrió.
6. Seguridad: los resultados de reconocimiento son **candidatos**, no identidad confirmada. Ninguna foto, hash biométrico, plantilla, nombre personal, dataset, voz o secreto debe subirse al repositorio o imprimirse en logs compartidos.
7. Si se va a cambiar código, explicar el motivo, aislar el parche, ejecutar tests/CI y registrar nuevo SHA y evidencia aquí. No eliminar avances certificados ni reescribir el baseline.

**Prompt sugerido para reanudar:** «Continuemos LUMIA desde docs/lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md en la rama del PR #77. No reinicies ni dupliques tareas. Revisa HEAD y CI, identifica P0 pendiente y protege el baseline ASUS Qwen3.5 2B/Whisper/Kokoro. No hagas enrollment ni merge sin autorización.»

## 10. Archivos a consultar para detalles

- [README DeepFace/SFace y recorte](../../labs/vision-04b/README.md)
- [QA de registro DPAPI](../../labs/vision-04b/VISION-04C0-ADULT-VAULT.md)
- [QA de calibración C1](../../labs/vision-04b/VISION-04C1-CALIBRATION-QA.md)
- [AMR-03.0 uso diario ASUS](38-AMR030-DAILY-2B-VOICE-VISUAL-20261108.md)
- [Código del par](../../labs/vision-04b/verify_pair.py)
- [Alta voluntaria](../../labs/vision-04b/adult_enrollment.py)
- [Calibración offline](../../labs/vision-04b/calibrate_open_set.py)

Este handoff es deliberadamente conservador: conserva los resultados reales, las incertidumbres y las tareas no realizadas. **No afirma que toda LUMIA está certificada en hardware ni que existen perfiles faciales inscritos.**
