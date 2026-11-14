# LUMIA MASTER — plan de certificación, integración y reversión

**LM-00 — plan propuesto el 13-11-2026.** La rama actual de este registro solo añade documentos/herramientas de inspección, no es una release. La versión de código real que el propietario mantiene en ASUS es `1580a51`. **NO ejecutar merges, checkout, pull, reinstalación, reconocimiento de personas o modificaciones del sistema en ASUS por la publicación de este plan.**

## Política de seguridad y entregas

- **Una sola línea base protegida**: registrar SHA exacto, rama, lanzador elegido, cuatro modelos Ollama instalados, configuración de privacidad y estado de QA.
- **Toda evolución ocurre en worktree nuevo** y rama hija trazable, sin cambiar el checkout actual `C:\Users\ingvm\LUMIA-ASUS`. Antes de trabajar en una función, clasificar y seleccionar el PR que la incorpora.
- **Integración incremental**: una familia funcional por PR (VQ-02/voz → UI/avatar → visión/fotos → cámara/sentinel → detector facial → diarización). Medir regresiones inmediatamente después de cada paso. No fusionar toda la pila #68–#79 de un golpe.
- **Sin manipular LUMIA en vivo** al introducir módulos de laboratorio; ningún acceso de audio/cámara/archivos ni privilegio de herramientas debe activarse tácitamente.
- **QA física ≠ CI**. Un pipeline verde con mocks no demuestra que Whisper reconozca correctamente, Kokoro hable sin pausas, un fotograma esté fresco ni que un rostro pertenezca a alguien.
- **Una release MASTER** requiere nombre, tag inmutable, commit, matriz de funciones, pruebas PASS comprobadas en ASUS, procedimiento de rollback ensayado y decisión explícita del propietario. No llamar «MASTER estable» antes.

## Fase 0 — Congelación descriptiva (realizada)

- [x] Estado ASUS recibido: branch VI-04C.1, SHA `1580a51`; `ollama list` con 4 modelos, entre ellos 2B y tres 4B.
- [x] Mapa de 13 lanzadores y sus llamadas anidadas, separando los que preservan 2B y los que arrancan 4B.
- [x] PR #68–#77 y #79 revisados: abiertos, draft, no fusionados a main al 13-11-2026; PR #69 es rama hermana de visión, #79 es laboratorio hijo de #77.
- [x] Riesgos pendientes explicitados: VQ-02 sin confirmación ASUS posterior; pausas Kokoro; avatar/visión; detector facial sin QA; bóveda sin registro; diarización sin integración.
- [ ] **Validar localmente** estado limpio (o registrar cambios si los hay) y ejecutar el inventario *solo lectura* del equipo con consentimiento del propietario.
- [x] **Rama de recuperación de GitHub creada**: `recovery/lumia-asus-1580a51-20261113` apunta al commit físico reportado, sin publicar los activos privados.
- [x] **LM-01 implementado y probado sintéticamente en Windows/Linux**: `scripts/lumia-master-protect.mjs` verifica 18 recursos privados, bloquea un backup de checkout distinto/sucio y guarda bundle + hashes solo con ejecución explícita. [Evidencia CI](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43545261253).
- [x] **Backup real LM-01 en ASUS y verificación SHA — PASS (salida física aportada 13-11-2026).** `ok=true`, commit `1580a51`, 19 archivos verificados (18 obligatorios), Git bundle SHA-256 coincide; `original_modified=false` según herramienta. [Protocolo](LM01-RESPALDO-SEGURO-ASUS.md). **PARCIAL**: NO incluye pesos Ollama, runtimes Whisper/Kokoro ni protección comprobada frente a pérdida física del equipo.
- [ ] **Segunda copia en disco externo/cifrado y respaldo ampliado** de pesos/modelos locales, runtimes y assets 3D adicionales, con hash y ensayo de restauración independiente.


## Fase 1 — Gate de seguridad y prueba diaria (P0, primera en ASUS)

**Sin actualizar código ni abrir webcam al principio.** Arrancar con `INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd` cuando el propietario decida. Registrar:

| Prueba | Criterio PASS observable | Estado |
| --- | --- | --- |
| Git | SHA `1580a51`, misma rama, conocer si checkout está limpio; ningún cambio inesperado | PENDIENTE |
| Ollama | El lanzador muestra realmente `qwen3.5:2b-q4_K_M`; no se invoca 4B por accidente | PENDIENTE |
| Texto | 3–5 preguntas, 2B responde, coherencia y latencias registradas | PENDIENTE |
| Voz de entrada | 3–5 órdenes a micrófono autorizado; STT, wake/follow-up y recuperación tras error | PENDIENTE |
| Voz de salida | Primer audio, pausas entre fragmentos Kokoro, interrupción, final de turno | PENDIENTE |
| VQ-02 inventario | «Lumi, ¿cuántas IA locales tienes?» indica modelos Ollama realmente instalados (4 en último reporte, releer en tiempo real) | PENDIENTE |
| VQ-02 cambio modelo | «Lumia, cambia a Qwen 2B» usa modelo instalado exacto; una prueba opcional 4B y vuelta a 2B con autorización | PENDIENTE |
| VQ-02 avatar | «Lumia, usa la vista de medio cuerpo» mueve la vista, no solicita cambio de modelo; «¿cuáles son tus tres vistas?» enumera sin mover | PENDIENTE |
| Negaciones | «No cambies de modelo» y preguntas informativas no disparan cambios de estado | PENDIENTE |
| Imagen puntual | Foto expresamente seleccionada, sin confundir objeto/fecha/cantidad; reconocer incertidumbre | PENDIENTE |
| Seguridad | Realtime pago OFF, escrituras OFF; cámara/micrófono solo con permiso explícito | PENDIENTE |
| Reinicio | Cerrar LUMIA, confirmar puertos libres y arrancar de nuevo sin reinstalar pesos | PENDIENTE |

No tratar `npm run lint` ni `npm run build` como prueba de conversación real; son puertas adicionales, y no deben correrse si el propietario está haciendo una sesión de voz y no desea detenerla. **VQ-02 y Kokoro son los dos bloqueos prioritarios.**

## Fase 2 — QA separada por familia de funciones

| Área | QA requerida antes de la consolidación | Decisión |
| --- | --- | --- |
| PH-04 / avatar | Ver tres vistas, escuchar y ver respuesta, 17 movimientos; probar comandos VQ-02 mal transcritos | Pendiente de regresión completa |
| VISIÓN AUTO | Foto única con 768 y 1024 manual en mismo entorno; contraste de respuestas y coherencia; no afirmar identidad por VLM | Pendiente |
| VI-03 activa | Autorizar cámara, recapturar escena nueva por turno, TTL 3 min, cerrar; comprobar CPU sin segundo modelo | Pendiente |
| VI-03 Sentinel | Cambio real/no cambio de escena, evitar falsos eventos, comprobar cámara cerrada después | Pendiente |
| VI-04A BlazeFace | 0/1/2 rostros con consentimiento, overlay en cámara autorizada; no nombre ni embeddings | Pendiente |
| VI-04B SFace CLI | Reproducir un par positivo y un negativo voluntarios, evidencia sin datos personales | QA acotada ya reportada; no integrar reconocimiento |
| VI-04C.0 DPAPI | **NO ejecutar sin solicitud expresa**; vault `false` se considera normal | Bloqueado por consentimiento |
| VI-04C.1 open-set | Registro voluntario previo, muestras independientes de 3 desconocidos adultos y holdout, estimar error | Bloqueado; no afirmar precisión poblacional |
| VOICE-01P | Laboratorio AMI en CPU: códigos y pruebas acotadas sí; no conectado a micrófono ni al runtime | Aislado; evaluar arquitectura antes de integrar |
| AMR-03.1 Kokoro | A/B de latencias por fragmento, sin texto, sin exportar audio ni cambiar voz | Requiere análisis e integración selectiva |
| Mint / FBX | QA rig/cráneo/cuello/ojos/render/animaciones aparte; proteger avatar VRM actual | Aislado |
| Memoria/identidades | Consentimiento, cifrado, borrado, políticas de menores y seguridad de uso | Bloqueado |

## Fase 3 — Arquitectura candidata de MASTER, sin implementarla aún

```text
                      LUMIA MASTER (candidato)
                               |
          +--------------------+--------------------+
          |                    |                    |
   CORE ASISTENTE         PRESENCIA VISUAL      LABORATORIOS AISLADOS
   Qwen 2B/Ollama         Foto / cámara         AMR-03.1 (diagnóstico)
   Whisper/Kokoro         VI-03 Sentinel        VOICE-01P (AMIs)
   PH-04 avatar           VI-04A caras          VI-04B/C SFace/DPAPI
   Seguridad/UX           opt-in por usuario    Mint / 3D offline
          |                    |                    |
          +--------------------+--------------------+
                    Feature flags explícitas
                    QA por módulo / no biometría
```

**Promoción permitida:** funcionalidades no biométricas con tests y QA física pasan al CORE; laboratorios se mantienen fuera salvo adaptación consentida y certificada. Nunca añadir una llamada a cámara continua ni diarización pasiva por haber compilado.

## Fase 4 — Integración y rollback

1. Crear worktree nuevo desde SHA verificado, con nombre tipo `LUMIA-MASTER-CANDIDATE`, **sin tocar `LUMIA-ASUS`**. Registrar commit de partida y no hacer `git reset --hard`.
2. Integrar selectivamente los mínimos cambios aprobados mediante PRs pequeños. **No** combinar ramas apiladas indiscriminadamente: confirmar bases/commits y resolver conflictos con evidencia, sin duplicar archivos/flags o remover regresiones.
3. Ejecutar build/lint/contratos de comandos/QA de avatar y después pruebas físicas de texto, voz, visión y seguridad. Si falla un gate, detener promoción; conservar antigua versión operativa.
4. Documentar los resultados, enlaces CI y fecha del ensayo en matriz. Considerar pruebas de carga del 2B/4B y GPU por separado.
5. Sólo al aprobar todo, generar tag y manifest de release, guía de arranque y rollback. El propietario decide si cambia el lanzador habitual.
6. **Rollback recomendado:** cerrar candidato con Ctrl+C, verificar puertos 5173/8787, volver a abrir la copia antigua `C:\Users\ingvm\LUMIA-ASUS` con `AMR030.cmd`. Nunca borrar worktrees, pesos, fotos o bóveda como parte de un rollback sin pedirlo.

## Fase 5 — Criterios mínimos de release MASTER

- [ ] Nombre de release/tag del commit candidato, diferente del alias AMR/VI/VOICE.
- [ ] Lista de funciones efectivamente activas en lanzador, matriz actualizada y versiones modelos sin exponer rutas privadas.
- [ ] Tests de Windows y Linux en mismo SHA candidato (no «pasó en rama ancestral»).
- [ ] QA física ASUS P0 completa con ausencia de bloqueos, regresiones VQ-02 resueltas y latencias voz aceptadas por propietario.
- [ ] Privacidad: identificación biométrica OFF por defecto; cámara, micrófono, datos, permisos y red restringidos.
- [ ] Plan de rollback demostrado en máquina real conservando baseline.
- [ ] Evidencia de licencia/atribución de pesos que se pretendan redistribuir.
- [ ] Decisión expresa de promover candidato; PR de integración revisado, no «merge automático de todo».

## Comandos de inventario / QA no destructivos

Para verificar el estado real **sin alterar archivos**, el propietario puede ejecutar PowerShell en `C:\Users\ingvm\LUMIA-ASUS`:

```powershell
cd "$env:USERPROFILE\LUMIA-ASUS"
git log -1 --format="%H | %ci | %s"
git branch --show-current
git status --short
ollama list
```

El script nuevo [`scripts/lumia-master-inventory.ps1`](../../scripts/lumia-master-inventory.ps1) automatiza el resumen de solo lectura, sin inspeccionar fotos, secretos o voz. Está en la **rama documental**, por lo que **no está automáticamente instalado en la ASUS**; no hacer checkout o merge de esta rama solo para ejecutar un diagnóstico.

## Registro de evidencias pendientes

| ID | Responsable y evidencia | Estado |
| --- | --- | --- |
| LM-P0-ASUS | Propietario: arranque diario, VQ-02, Whisper/Kokoro, cuatro modelos disponibles y PH-04 | PENDIENTE |
| LM-VISION | Propietario: permiso cámara, frescura y detector 0/1/2 caras | PENDIENTE |
| LM-VOICE-LAB | QA AMI VOICE-01M–P: aceptada como evidencia **solo de laboratorio** | VERIFICADO ACOTADO, NO INTEGRADO |
| LM-FACE-LAB | SFace par positivo/negativo y C0/C1 sin enrolamiento real | PARCIAL |
| LM-RELEASE | Manifest/tag, pruebas integradas, rollback y decisión de usuario | BLOQUEADO |

**No publicar «MASTER estable» con casillas pendientes; esta fase sólo organiza el trabajo y conserva decisiones.**
