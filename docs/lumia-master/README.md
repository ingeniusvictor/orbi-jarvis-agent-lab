# LUMIA MASTER — registro canónico de integración (NO es una release)

**Registro:** LM-00 / inventario inicial v0.1 · **Fecha:** 13-11-2026 · **Estado:** DOCUMENTACIÓN + PLANIFICACIÓN; **no se ha generado ni certificado un binario MASTER**.

> **Leer primero antes de continuar LUMIA.** Este directorio separa código instalado, perfil de arranque, laboratorios, ensayos sintéticos y pruebas físicas en ASUS. La palabra MASTER es un **proceso de consolidación**, no una rama estable, un merge, un nuevo modelo ni una afirmación de que todas las mejoras funcionan juntas.

## 1. Identidad verificable de la instalación de referencia

| Campo | Estado verificado |
| --- | --- |
| Equipo | ASUS TUF (Windows), directorio local reportado por el propietario |
| Directorio | `C:\Users\ingvm\LUMIA-ASUS` |
| Rama comprobada en ASUS | `feature/lumia-vi04c1-open-set-calibration-cpu-20261109` |
| Commit comprobado en ASUS | `1580a51` (commit remoto íntegro `1580a5182eba540893e35e37065be77da4ed014c`) |
| Fecha del commit | 09-11-2026 19:44:30 -0300 |
| Arranque cotidiano recomendado, si está operativo | `INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd` → `INICIAR_LUMIA_ASUS_RAPIDA.cmd` |
| Cerebro por defecto de ese lanzador | `qwen3.5:2b-q4_K_M` (Ollama local) |
| STT / TTS seleccionados por lanzador | Whisper local / Kokoro local |
| Visión cotidiana | AUTO conservadora 768 px; 1024 px manual tras autorización |
| Software del repositorio | `package.json` tiene `version: 0.0.0`: **NO es un número de release LUMIA** |
| Estado de `main` | README histórico JARVIS, carece del lanzador ASUS AMR-03.0; **no representa la instalación actual** |

**Inventario Ollama reportado físicamente el 13-11-2026** (`ollama list`): `qwen3.5:2b-q4_K_M`, `qwen3.5:4b-fast`, `qwen3.5:4b-vision4096`, `qwen3.8:4b-gpu`. Son **modelos instalados**, no cuatro modelos simultáneamente cargados, entrenados o usados por el lanzador. Confirmar la lista de nuevo cuando sea necesario.

**Situación de Git:** la rama ASUS coincide con el HEAD del PR [#77](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/77) al auditar, abierto y en borrador. No hay evidencia en esta auditoría del estado actual de `git status` ni de una sesión de extremo a extremo recién probada. **No cambiar el checkout del propietario como parte de este trabajo.**

## 2. Tres identificadores que no deben confundirse

1. **Código / commit**: la verdad sobre qué archivos están instalados (rama VI-04C.1, SHA `1580a51`).
2. **Lanzador / perfil activo**: especifica qué opciones se habilitan **solo durante esa sesión** (por ejemplo, AMR-03.0 para cerebro 2B y ajustes de voz). El nombre del lanzador **no es** la versión completa del producto.
3. **Laboratorio o PR**: propuesta aislada, con tests y a veces QA física, **NO integrada por estar en GitHub** (AMR-03.1, VOICE-01P, laboratorios faciales C0/C1).

No llamar «LUMIA v3.1» a una sesión AMR-03.1 ni «reconocimiento facial funcional» a un clasificador SFace validado sobre dos pares.

## 3. Guía de estado

| Estado | Significado |
| --- | --- |
| **PRESENTE** | El archivo/código existe en el commit ASUS; no afirma activación ni QA integrada |
| **ACTIVO EN PERFIL** | El lanzador seleccionado activa explícitamente el componente; no afirma resultado físico de la sesión |
| **QA FÍSICA ACOTADA** | El propietario ejecutó una prueba real del módulo y reportó resultados; no equivale a certificar todo LUMIA |
| **CI / SINTÉTICO** | Compila o pasa pruebas automáticas con fixtures, mocks o simulaciones |
| **PENDIENTE DE QA** | Falta ensayo representativo en hardware real |
| **AISLADO** | Experimento en rama, worktree o entorno separado; no activo en LUMIA cotidiana |
| **BLOQUEADO** | No integrar antes de cumplir un requisito de seguridad, consentimiento o calidad |

**Regla:** un módulo puede ser «PRESENTE + CI» y simultáneamente «PENDIENTE DE QA». No convertirlo en «certificado» por el hecho de tener pruebas verdes.

## 4. Línea base protegida

**LUMIA-BASE-ASUS-20261109** = commit `1580a5182eba540893e35e37065be77da4ed014c` de la rama VI-04C.1, **sin promoverlo ni modificarlo**. Es un **punto de recuperación comprobado**, no una release estable certificada.

**Puntero de rescate del código:** rama [`recovery/lumia-asus-1580a51-20261113`](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/tree/recovery/lumia-asus-1580a51-20261113), fijada al mismo commit; no incluye archivos locales ignorados por Git. El respaldo LM-01 en la ASUS **no se ha ejecutado ni certificado aún**.

Preservar:
- `qwen3.5:2b-q4_K_M` por defecto, selector Ollama local y opción manual 4B.
- Whisper CLI/local y Kokoro local con permisos explícitos de micrófono; no habilitar un receptor always-on como efecto lateral.
- Cámara solo con autorización: la detección de rostros no debe abrir la webcam por su cuenta.
- Avatar VRM/PH-04, sus tres vistas y las 17 animaciones R8 sin sustituir por el FBX Mint experimental.
- Escrituras de herramientas desactivadas (`JARVIS_ALLOW_WRITES=0`), Realtime de pago desactivado.
- Sin identificación biométrica en vivo, sin matriculación automática de familia/menores, sin nuevos permisos ni transmisión de fotos, audios, embeddings o transcripciones.
- Puertos principales del lanzador ASUS: 5173 (frontend Vite) y 8787 (bridge). Ollama local normalmente 11434, comprobarlo en vez de asumir disponibilidad.

**No hacer:** `git reset --hard`, checkout automático, `git pull` en la rama ASUS, `npm ci` a ciegas, fusiones de PR apilados, descargas de modelos, cambios de VRAM o integración de nuevos pesos sin gate.

## 5. Qué incluye este registro MASTER

- [MATRIZ-MODULOS.md](MATRIZ-MODULOS.md): inventario, evidencia de integración y mapa real de dependencias de lanzadores.
- [PLAN-QA-Y-PROMOCION.md](PLAN-QA-Y-PROMOCION.md): fases secuenciales, criterios para ascender a una release MASTER y procedimiento de reversión.
- [scripts/lumia-master-inventory.ps1](../../scripts/lumia-master-inventory.ps1): herramienta **solo lectura** para verificar una instalación local antes de cualquier promoción. No necesita ejecutarse hasta que el código sea instalado intencionalmente en un worktree independiente.
- [LM01-RESPALDO-SEGURO-ASUS.md](LM01-RESPALDO-SEGURO-ASUS.md): procedimiento específico para preservar el commit, VRM y 17 animaciones privadas de la ASUS, con SHA-256 y pruebas físicas pendientes.
- [scripts/lumia-master-protect.mjs](../../scripts/lumia-master-protect.mjs): auditoría de solo lectura o **respaldo local autorizado** fuera del repositorio; **no respalda todavía Ollama/Whisper/Kokoro ni los demás recursos locales**.

## 6. Fuentes de verdad — orden de precedencia

1. **Estado físico actual del propietario** (`git log`, `git status`, launchers, servicios y QA reproducible).
2. Código en el SHA exacto; los flags del lanzador prevalecen frente a un README antiguo para el entorno de esa sesión.
3. [Handoff VISION-04 del 09-11-2026](../lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md) y [regresión VQ-02](../lumia-convergence/40-VQ02-COMPRENSION-COMANDOS-ASUS-20261109.md).
4. [Guía AMR-03.0](../lumia-convergence/38-AMR030-DAILY-2B-VOICE-VISUAL-20261108.md).
5. PR/CI para cambios aislados (no reemplazan QA física).
6. Notas de conversación y resultados reportados: siempre etiquetar la fecha, módulo y hardware.

El README de la raíz aún documenta JARVIS/Claude histórico. **No usarlo como manual de arranque de LUMIA ASUS.**

## 7. Semántica futura de versiones

**Por ahora:** `LUMIA MASTER — candidato documental LM-00`. **No existe «LUMIA MASTER 1.0 certificada».**

Al aprobar el plan: emitir un **tag inmutable del commit exacto**, manifest con Git SHA, hashes/configuración no sensible de modelos, lanzador por defecto y evidencia QA reproducible; luego actualizar `README` y crear una release real. Nunca promover una mezcla de funcionalidades no probadas por el hecho de compartir nombre o rama.

## 8. Registro de cambios

| Fecha | Cambio | Evidencia |
| --- | --- | --- |
| 2026-11-09 | Commit activo de ASUS `1580a51`, VQ-02 corregido solo por CI | Consola ASUS + docs 39/40 + PR #77 |
| 2026-11-12/13 | Laboratorio VOICE-01M/N/O/P pasó pruebas físicas acotadas AMI; no integrado a runtime | [PR #79](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79), [Issue #78](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78) |
| 2026-11-13 | Se abrió **inventario/documentación MASTER separado**, sin editar el código vivo | Rama `docs/lumia-master-audit-20261113` |
| 2026-11-13 | Visión **VI-04.1** para auditar captura reciente vs detección CPU, **aislada, sin identidad y sin QA ASUS** | [PR #82](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/82) |
| 2026-11-13 | Voz **VOICE-01Q**: estudio de instrumentación interna antes de atribuir causas; **solo diseño**, laboratorio separado | [Protocolo Q](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/blob/feature/lumia-voice01-offline-diarization-lab-20261109/labs/voice-01/QA-ASUS-VOICE01Q-PROPOSAL-20261113.md) |

**Responsable de promoción:** revisión humana con resultados reales en ASUS y decisión explícita del propietario. Esta documentación no autoriza merges, reconocimiento de identidades ni despliegue.
