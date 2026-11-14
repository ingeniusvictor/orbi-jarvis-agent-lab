# LUMIA MASTER — matriz de módulos, activación y evidencia

**Corte:** 13-11-2026 · **Commit base ASUS:** `1580a5182eba540893e35e37065be77da4ed014c`. Inventario verificable en GitHub, no certificación de producto. **«PRESENTE» no significa «activo»; «CI» no significa «QA física integral».**

## A. Matriz funcional

| Área / ID | Existencia en checkout ASUS `1580a51` | Activación / situación | Evidencia y gate pendiente |
| --- | --- | --- | --- |
| **Cerebro Qwen 2B** | Lanzador `RAPIDA`, `AMR030`; modelo instalado según `ollama list` | ACTIVO al lanzar ASUS RÁPIDA o AMR-03.0 | Pruebas reales de respuesta/latencia previas. Repetir QA extremo a extremo VQ-02 |
| **Selector de cerebro AMR-02** | Código y comandos de la rama acumulativa / PR #57 | ACTIVO según configuración de UI/bridge en el lanzador | Cambio 2B/4B observado en ASUS, pero parser VQ-02 tuvo fallos; parche solo CI pendiente de retest físico |
| **Modelo 4B / Vision4096** | Tags instalados y lanzadores `VISION4096`, `GRUPOS` | NO predeterminado con AMR-03.0; opt-in vía otro lanzador o selector | Memoria/VRAM y latencia exigen QA propia; no activarlo como predeterminado |
| **Whisper STT local** | Rutas y adaptadores en `RAPIDA.cmd` | Configurado local; servidor Whisper residente desactivado | QA histórica de voz, pero falta revalidación de sesión VQ-02 y falsa activación con dos personas |
| **Kokoro TTS local** | Residente local + prefetch + recuperación WAV; AMR-03.0 compacta frases | Configurado local en sesión | Pausas 3–6 s observadas en QA real; gate de latencia audio abierto |
| **AMR-03.1** | NO existe lanzador específico en `1580a51`; sí en PR [#69](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/69) | AISLADO — telemetría de WAV/Kokoro, no parte de AMR-03.0 | Medir A/B, decidir si integrar métricas sin afectar audio |
| **Compositor multimodal / LT / RC** | Activados en `RAPIDA.cmd`: texto, voz, foto, traducción seleccionada y grounding | Configuración de piloto ASUS | Confirmar comandos de dominio; no asumir lectura automática de WhatsApp, correo o escritorio |
| **Avatar VRM PH-04** | `RAPIDA.cmd` activa PH-04; tres vistas y 17 Motion R8 | Integrado en el perfil | 3 vistas funcionaron históricamente; parsers VQ-02 corregidos pero falta QA física posterior |
| **Mint / avatar adulto FBX** | No se acredita como parte del runtime ASUS ni de este SHA con la evidencia del repositorio | DESARROLLO 3D APARTE | No reemplazar VRM funcional sin validar cráneo, cuello, ojos, rig y animaciones |
| **Fotografía y cámara VI-01/02** | Código y flags en `RAPIDA.cmd` | Foto seleccionada o cámara autorizada por usuario | La capacidad visual no implica observación continua ni reconocimiento de personas |
| **AMR-02.4–03.0 visión AUTO** | Flags de AMR-03.0; 768 px AUTO, 1024 manual | ACTIVO solo en arranque AMR-03.0 | Conteos de personas fallaron en fotos reales; no declarar OCR/conteo infalible |
| **VI-03.0 ojos temporales** | Lanzador propio presente | OPT-IN | Diferenciar foto pasada de escena actual; no equivale a stream continuo autónomo |
| **VI-03.1 visión activa** | Lanzador propio presente | OPT-IN tras botón de cámara, TTL 3 minutos | Consentimiento y refresco; respuesta visual puede inventar detalles |
| **VI-03.2A Sentinel CPU** | Lanzador propio presente | OPT-IN; detector de cambios 96×54/750 ms | No identifica personas ni activa IA por sí mismo; validar carga CPU y falsos eventos |
| **VI-03.2B nueva captura por turno** | Lanzador propio presente | OPT-IN, encadenado a VI-03.2A | QA física específica pendiente de certificar dentro de LUMIA consolidada |
| **VI-04A detección de rostros** | Lanzador y código presentes; PR [#74](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/74) | OPT-IN; instala BlazeFace público y requiere clic de usuario | CI OK; **QA físico de 0/1/2 rostros con overlays aún pendiente**. SOLO DETECCIÓN, NO identidad |
| **VI-04.1 fotograma/rostros QA** | **NO incluido** en el checkout ASUS `1580a51`; rama hija aislada PR [#82](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/82) | OPT-IN en lanzador experimental distinto, correlaciona por fecha la captura VI-03.2B con conteo estable VI-04A sin tocar el prompt | CI Windows/Linux en evaluación; **QA física ASUS pendiente**. Cuenta **rostros**, no personas, no identidades ni detección infalible |
| **VI-04B SFace/DeepFace CPU** | `labs/vision-04b` en rama acumulativa; PR [#75](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/75) | AISLADO, fotos consentidas bajo CLI | Prueba física 1 par positivo válido (0.27631) y 1 negativo válido (1.00394); demasiado poco para FAR/FRR o identidad |
| **VI-04C.0 bóveda DPAPI** | Código laboratorio en el checkout; PR [#76](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/76) | AISLADO; `vault_exists=false` en último QA físico conocido | Alta adulta voluntaria NO realizada; no matricular sin consentimiento explícito |
| **VI-04C.1 open-set** | Código laboratorio y rama actual; PR [#77](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/77) | AISLADO; nunca reconocimiento en vivo | CI sintética PASS; falta dataset de adultos consentidos y calibración real, métricas FAR/FRR |
| **VOICE-01M/N/O/P** | NO están en checkout ASUS `1580a51` (PR [#79](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79) es rama hija aparte) | Laboratorio CPU local bajo `%LOCALAPPDATA%\ORBI\LUMIA-VOICE-LAB` | 2 corpus AMI / 4 evaluaciones físicas por fase; CAM++ mejor que ERes2Net en ambas, pero error tipo DER NO oficial; no integrado al enrutamiento de voz de LUMIA |
| **Reconocimiento de familiares / menores** | No verificado ni aprobado | BLOQUEADO | Sin inscripción automática, sin identificación de menores; requiere seguridad, política y validación independiente |
| **Memoria persistente MEM-01** | El propio `RAPIDA.cmd` la señala como pendiente | PENDIENTE | No afirmar memoria de perfiles ni registros persistentes |
| **Acciones sobre PC/correos/web** | `JARVIS_ALLOW_WRITES=0` en lanzador ASUS, Realtime desactivado | NO AUTORIZADAS por este perfil | No asumir privilegios de herramienta solo por origen histórico JARVIS/Claude |

## B. Árbol real de arranque ASUS

La cadena termina siempre en `INICIAR_LUMIA_ASUS_RAPIDA.cmd`, que configura Ollama/Whisper/Kokoro y ejecuta `npm.cmd run start:lumia`.

```text
AMR030 (2B diario) ---------------------------------> RAPIDA -> start:lumia
OJOS_TEMPORALES_VI030 ------------------------------> AMR030 -> RAPIDA
VISION_ACTIVA_VI031 -------------------------------> AMR030 -> RAPIDA
SENTINEL_CPU_2B_VI032 -----------------------------> VISION_ACTIVA -> AMR030 -> RAPIDA
VISION_REVISAR_VI032B -----------------------------> SENTINEL -> VISION_ACTIVA -> AMR030 -> RAPIDA
ROSTROS_VI040A (+ instalador BlazeFace bajo opt-in) -> VI032B -> SENTINEL -> ... -> RAPIDA

VISION4096 (Qwen 4B por defecto) ------------------> RAPIDA
VISION_AUTO ----------------------------------------> VISION4096 -> RAPIDA
VISION_CONTEXTUAL ---------------------------------> VISION_AUTO -> VISION4096 -> RAPIDA
VISION_TRAZA --------------------------------------> VISION_CONTEXTUAL -> VISION_AUTO -> VISION4096 -> RAPIDA
VISION_CONSISTENTE --------------------------------> VISION_TRAZA -> ... -> VISION4096 -> RAPIDA
VISION_GRUPOS -------------------------------------> VISION_CONSISTENTE -> ... -> VISION4096 -> RAPIDA
```

### Decisiones de arranque

| Objetivo | Lanzador presente en ASUS | Condiciones |
| --- | --- | --- |
| Conversación cotidiana / texto / voz / imagen puntual | `INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd` | **Preferido como perfil de ensayo**, no certificación de release |
| Base de menor complejidad | `INICIAR_LUMIA_ASUS_RAPIDA.cmd` | Qwen 2B; menor cantidad de flags AMR |
| Ensayar cámara que ve cambios | `INICIAR_LUMIA_ASUS_VISION_ACTIVA_VI031.cmd` | Opt-in + clic, sin cámara espontánea |
| Ensayar Sentinel | `INICIAR_LUMIA_ASUS_SENTINEL_CPU_2B_VI032.cmd` | Opt-in; 2B permanece por defecto |
| Ensayar recaptura visual por voz | `INICIAR_LUMIA_ASUS_VISION_REVISAR_VI032B.cmd` | Opt-in; no confianza automática en escena |
| Ensayar presencia de 0/1/2 caras | `INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd` | Opt-in y posible descarga de detector público; **no reconocimiento** |
| Benchmark 4B de visión | `INICIAR_LUMIA_ASUS_VISION4096.cmd` o `VISION_GRUPOS.cmd` | Opt-in, **sustituye cerebro predeterminado** por 4B |
| Medir pausas Kokoro AMR-03.1 | **NO instalado en este commit** | Rama [PR #69](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/69), no ejecutar por nombre hasta integrar de forma segura |
| Probar diarización VOICE-01P | No hay lanzador LUMIA integrado | Ejecutar solo laboratorio CLI de PR #79, no enlazar al micrófono de producción |

**Atención:** encadenar flags en un .cmd significa que un programa **intenta habilitar** esa función, no que todos sus requisitos de hardware, modelos o permisos estén satisfechos. Los .cmd de VI-04A no deben utilizarse solo para comprobar cuántos modelos Ollama hay.

## C. Dependencias de ramas / PR (NO son merges)

```text
AMR-03.0 PR #68
   +-- AMR-03.1 PR #69 [rama aparte, telemetría Kokoro]
   +-- VI-03.0 #70 -> VI-03.1 #71 -> VI-03.2A #72
                                   -> VI-03.2B #73 -> VI-04A #74
                                   -> VI-04B #75 -> VI-04C.0 #76 -> VI-04C.1 #77
                                                                          |
                                                                          +-- VOICE-01 lab PR #79
```

La cadena #70–#77 es **apilada**: las ramas hijas tienen de base a la anterior, no a `main`. PR #79 parte del HEAD de #77, pero permanece como laboratorio aislado; no asumir su integración. En la auditoría del 13-11-2026 los PR #68–#77 y #79 examinados estaban **abiertos, draft y no fusionados**.

## D. Resumen de deuda concreta

1. **P0 / VQ-02:** parser de «cuántas IA locales», «Qwen 2B» y «medio cuerpo» corregido por CI, pero **no existe QA física posterior confirmada**. Consultar [VQ-02](../lumia-convergence/40-VQ02-COMPRENSION-COMANDOS-ASUS-20261109.md).
2. **P0 / Kokoro-WAV:** pausas audibles de ~3–6 s reportadas; no resueltas por simplemente cambiar de cerebro ni confirmar la primera respuesta textual.
3. **P1 / visión:** verificar en ASUS que el fotograma es reciente, permisos de cámara y errores de descripción bajo condiciones reales.
4. **P1 / avatar:** separar parser de comandos, estado de vista y renderizado visual de PH-04; preservar 17 movimientos y tres vistas.
5. **P2 / facial:** terminar gate 0/1/2 caras de VI-04A antes de considerar identidad; C0/C1 siguen bloqueados por ausencia de datos de calibración real.
6. **P2 / diarización:** laboratorio AMI muestra problemas de agrupamiento y solapamiento; los errores no equivalen a DER oficial, no instalar silenciosamente en LUMIA.
7. **P3 / Mint y memoria:** proyectos distintos; no integrar assets 3D ni memoria persistente sin QA/consentimiento.

**Fuente principal:** [handoff VISION-04](../lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md), [VQ-02](../lumia-convergence/40-VQ02-COMPRENSION-COMANDOS-ASUS-20261109.md), lanzadores/archivos de la rama VI-04C.1 y PR/Issue públicos del mismo repositorio. Donde se desconoce el resultado físico, permanece PENDIENTE.
