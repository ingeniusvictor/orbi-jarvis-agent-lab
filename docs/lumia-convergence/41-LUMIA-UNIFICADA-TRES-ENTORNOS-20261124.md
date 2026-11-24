> **TRANSICIÓN A ACTUALIZACIONES INCREMENTALES:** leer [Documento 43 — retirada del nombre NEXT como rama de producto](43-TRANSICION-NEXT-A-ACTUALIZACIONES-20261124.md). «NEXT» representa una fase de QA; el producto tendrá una sola rama estable de versiones con mejoras incorporadas y rollback, después del primer corte explícitamente autorizado.\n\n# LUMIA UNIFICADA — arquitectura única, tres entornos de ejecución
**Decisión de arquitectura del propietario · 24 de noviembre de 2026 (Chile)**  
**Estado:** norma de desarrollo y documentación aprobada como objetivo; implementación y QA completa multi-equipo pendientes.  
**Lección principal:** no volver a perder mejoras porque cada avance quedó en una rama o computador diferente.

> **CONTROL DE CAMBIOS OBLIGATORIO:** [Documento 42 — estados, evidencia, QA y promoción](42-LUMIA-CONTROL-MEJORAS-20261124.md) y [Registro auditable](../../LUMIA_IMPROVEMENTS_LEDGER.json). Todo desarrollo debe crear/actualizar un expediente en el registro; CI no equivale a QA física ni release.\n\n> **LEER PRIMERO EN CADA NUEVA CONVERSACIÓN, SESIÓN DE CODEX/CLAUDE O ANTES DE EDITAR EL REPOSITORIO.**
> El archivo de datos vinculante es [`LUMIA_PLATFORM_MATRIX.json`](../../LUMIA_PLATFORM_MATRIX.json). Este documento define la política; `LUMIA_NEXT_MANIFEST.json` conserva el historial de QA del piloto ASUS. La hoja de ruta y decisiones se reflejan en el [issue maestro #80](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/80).
>
> **NO SON TRES APPS.** Son tres configuraciones del MISMO runtime LUMIA, versionado en un solo repositorio y una sola versión de código. Cambian el modelo de Ollama y límites de recursos; no cambia la identidad funcional del producto.

## 1. Objetivo no negociable

1. **Una sola base de código** (`ingeniusvictor/orbi-jarvis-agent-lab`), una misma interfaz, los mismos módulos y el mismo contrato de capacidades para ASUS, HP y CPU sin GPU. No crear un fork o rama permanente por computador.
2. **Un único SHA/tag de versión por release certificada.** El perfil de runtime se registra aparte. Los distintos dispositivos pueden tener sus datos/modelos locales, pero NO tres historias de features divergentes.
3. **Tres perfiles oficiales:** `asus-gpu4`, `hp-gpu6` y `cpu-only`. Los modelos son reemplazables mediante un adaptador neutral, no están embebidos en la lógica de visión/voz/avatar.
4. **Equivalencia de experiencia y contrato**, NO respuestas textualmente idénticas, latencias idénticas ni precisión idéntica: modelos de distinto tamaño pueden rendir de manera diferente. Ninguna prestación puede fingirse si un motor no puede ejecutarla en el equipo.
5. Las mejoras se implementan **una sola vez**; se prueban en CI común y en la matriz física disponible; se despliegan mediante una release reproducible. **No auto-merge** ni promoción a ASUS de uso diario sin autorización explícita.
6. El entorno de trabajo principal para visión sigue siendo **Perfil Escritorio, sentado**. No exigir webcam de cuerpo completo. Las manos fuera del cuadro se informan como no verificables, jamás se convierten en “abajo” por suposición.
7. **Sin cámara abierta automáticamente, sin biometría de identidad por defecto, sin guardar fotogramas o keypoints, sin credenciales en repositorio y sin vigilancia ambiental activada por defecto.**

## 2. Perfiles de equipo y cerebros

| Perfil | Hardware concreto | Cerebro indicado | Estado real al 24-11-2026 |
| --- | --- | --- | --- |
| **ASUS / GPU 4 GB** | ASUS TUF, i5-10300H, 32 GB RAM, GTX 1650 Ti 4 GB | `qwen3.5:2b-q4_K_M` | **Base diaria validada** para LUMIA, voz y visión parcial; conservar motor actual |
| **HP / GPU 6 GB** | HP Pavilion Gaming, i7-10750H, 32 GB RAM, RTX 2060 Max-Q 6 GB | **Candidato primario:** `qwen3.5:4b-q4_K_M`; **alternativa rápida:** `qwen3.5:2b-q4_K_M`; **candidato experimental:** Nemotron 3.5 Bolt E4B cuantizado | **GPU/modelos medidos**, pero aún NO está certificada la misma LUMIA integrada con todos los subsistemas |
| **CPU / sin VRAM** | Equipo sin GPU de inferencia (modelo CPU/RAM no fijados) | **Propuesto:** `qwen3.5:0.8b` (fijar cuantización exacta tras ensayos) | Modelo oficial existente, **sin pruebas reales del runtime completo** en un equipo concreto sin VRAM |

**No confundir candidatos con cerebros certificados.** HP 4B es una prioridad para probar capacidad; no será cerebro definitivo por decreto. La elección depende de QA visual y de voz, precisión y latencia. En CPU la factibilidad real de STT/Kokoro, avatar 3D y cámara dependerá de CPU/RAM; el producto conserva interfaces y funcionalidad observable con degradaciones explícitas, no hace promesas incondicionales.

Modelos pequeños Qwen 3.5 con texto/imagen están listados oficialmente en [Ollama](https://ollama.com/library/qwen3.5); existencia del modelo no implica compatibilidad automática con el adaptador LUMIA ni rendimiento adecuado.

### 2.1 Resultados medidos en la HP, con protocolos separados

**HP: Ollama 0.40.17 / RTX 2060 Max-Q 6144 MiB / contexto 4096.** Las cifras son **mediciones del equipo del propietario**, NO resultados de carga integrada LUMIA.

**Cohorte A — Qwen 2B vs 4B:** mismo prompt, `think=false`, `num_ctx=4096`, `num_predict=200`, `temperature=0.2`, `keep_alive=0`, Q4_K_M.

| Modelo | Tokens salida | Generación | Tiempo total |
| --- | ---: | ---: | ---: |
| Qwen 3.5 2B | 115 | 98,48 tok/s | 4,13 s |
| Qwen 3.5 4B | 86 | 55,95 tok/s | 4,62 s |

Ambos mostraron ejecución **100 % GPU** en la sesión; Qwen 4B rondó **3739 MiB/6144 MiB**. Esta comparación solo autoriza afirmar que 2B generó más tokens por segundo **en esa prueba**; 4B merece comparación de calidad en tareas iguales, especialmente visión y herramientas.

**Cohorte B — Qwen 2B vs Nemotron Bolt E4B:** modelos residentes uno por vez, precalentamiento, 3 repeticiones, `think=false`, `num_ctx=4096`, `num_predict=160`, `temperature=0`. Mismo hardware. Modelo Nemotron descargado/cuantizado del repositorio NVIDIA, no presuponer equivalencia con los tags genéricos de Ollama.

| Modelo | Tokens salida | Generación media | Tiempo medio |
| --- | ---: | ---: | ---: |
| Qwen 3.5 2B Q4_K_M | 83 | 19,74 tok/s | 4,31 s |
| Nemotron 3.5 Bolt E4B Q4_K_M | 96 | 8,90 tok/s | 11,00 s |

Ambos se observaron 100 % GPU; `ollama ps` informó tamaños de **1,6 GB** y **3,3 GB**, respectivamente. **Conclusión restringida:** Qwen 2B ganó en velocidad en esa segunda cohorte. No comparar directamente 98,48 tok/s de la cohorte A con 19,74 tok/s de la B: la discrepancia está **sin causa verificada**. El tamaño de la variante Nemotron Q4 que cupo en la HP no certifica cualquier otra distribución de ese modelo ni su soporte de visión. Requiere QA visual, STT/TTS y uso real en LUMIA.

**Selección HP planificada:** probar primero Qwen 4B como alternativa de mayor capacidad, conservar 2B como fallback rápido; Nemotron queda como candidato evaluable, **no como reemplazo automático**, hasta demostrar mejoras medibles en el protocolo de producto.

## 3. Esqueleto técnico común

```text
                         LUMIA · UNA SOLA APLICACIÓN
┌──────────────────────────────────────────────────────────────────┐
│ React / VRM / animaciones · voz · herramientas · memoria · visión │
│       contratos y permisos únicos / mismo código y versión      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                   Adaptador de cerebro local
                 (Ollama, proveedor neutral)
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
  ASUS · GPU 4 GB          HP · GPU 6 GB        Equipo CPU
  Qwen3.5 2B              Qwen3.5 4B(*)        Qwen3.5 0.8B(*)
                          2B respaldo          cuantización (*)
                          Nemotron(*)
        └──────────────────────┴──────────────────────┘
                MISMOS MÓDULOS · MISMOS TESTS
(*) selección propuesta, no sistema completo certificado
```

**Ya existe** `bridge/ollama.mjs`, `bridge/orbia/model-manager.mjs` y la capa neutral `bridge/providers/registry.mjs`. **No existe aún** un lanzador universal verificado con los tres perfiles: `scripts/lumia-next-local-voice-qa.mjs` y `INICIAR_LUMIA_ASUS_NEXT_QA.cmd` están ligados a `LUMIA-NEXT-QA`, a la instalación principal ASUS y al 2B. Tampoco existe aún una prueba QA real de LUMIA completa con Qwen 0.8B. No confundir documento de perfiles con funcionamiento ya implementado.

Para materializar los perfiles **sin duplicar la app**, crear en una fase posterior un resolvedor validado que: (a) identifica el perfil elegido, (b) lee los modelos efectivamente instalados en Ollama, (c) asigna el tag exacto y parámetros probados, (d) verifica recursos con un preflight sin cambiar globalmente Windows, (e) arranca la misma aplicación y (f) informa qué limitaciones de hardware/visión aparecieron. No auto-instalar modelos ni realizar reconfiguraciones de GPU sin permiso.

### 3.1 Componentes que deben seguir siendo los mismos
- **Avatar:** assets VRM/GLB autorizados, vistas, expresiones VQ y animaciones R8/Mixamo; los assets privados se instalan localmente según autorización, pero el protocolo de animación y UI no cambia por PC.
- **Cerebro:** contrato de conversación, herramientas, memoria, JSON y streaming, manejo de errores y modelo Ollama intercambiable. Identificar modelos solo por tag exacto comprobado; nunca asignarlos por coincidencia ambigua.
- **Voz:** adaptadores Whisper STT y Kokoro TTS local, QA de voz, continuidad de turnos y notificación honesta de dispositivo no compatible. No reinstalar o sobrescribir Kokoro/Whisper aprobados en ASUS para "homogeneizar".
- **Visión:** cámara con autorización, VI-04A rostros CPU, VI-04.2A mismo JPEG Qwen/detector, VI-04.2B.3 indicaciones de brazo/torso y VI-05A.1 pose Lite CPU. Conservar `sameJpeg` y exactitud de conteos facial; no inferir identidad a partir de rostros.
- **Escritorio sentado:** contexto predeterminado de trabajo, NO prueba de estar sentado; brazos abajo fuera de encuadre = **indeterminado/fuera de cuadro**, brazo levantado = solo si hay evidencia. No exigir cuerpo completo.
- **Permisos y seguridad:** local/offline por defecto cuando el hardware/modelo estén instalados, 3 minutos máximo de sesión activa de webcam, cierre y liberación de workers, secretos fuera del código/logs.

### 3.2 Capacidades según disponibilidad
- Sin webcam: mismo menú, mensaje honesto «cámara no disponible»; las funciones de conversación siguen.
- Sin VRAM: inferencia CPU de Qwen 0.8B **sujeta a validación**; preservar flujo y controles sin simular una detección o IA no realizada.
- Una tarea con visión puede ser rechazada cuando un modelo no soporte imágenes o la RAM no alcance: mostrar fallo visible, no inventar descripción ni pasar silenciosamente a nube.
- Se pueden ajustar contexto, límite de imágenes y frecuencia de muestras dentro de parámetros verificados por perfil; **no quitar funciones ni mantener una rama reducida permanente**.

## 4. Registro de mejoras que NO pueden perderse

| Hito | Evidencia/estado |
| --- | --- |
| Avatar PH-04/Motion R8 y VQ-04/VQ-05.1 | 3 vistas/17 clips privados en el entorno integrado y expresiones aprobadas visualmente en ASUS |
| VI-03.2B | Respuestas visuales a partir de JPEG reciente bajo consulta autorizada |
| VI-04A + VI-04.1 | Detector de rostros MediaPipe CPU, sin identificación ni inscripción biométrica |
| VI-04.2A | Mismo JPEG de pregunta y auditoría facial; 1 y 2 rostros `status:matched`, `sameJpeg:true` en ASUS 21-11-2026 |
| VI-04.2B.3 PR #91 | Qwen 2B reconoció un brazo derecho levantado y parte del torso; regresión 2 rostros→1 rostro aprobada por propietario |
| VI-05A PR #92 | Worker Pose Lite independiente, activación adicional, CPU, 2,5 s de intervalo |
| VI-05A.1 PR #93 | Diagnóstico fuera de encuadre/baja confianza; ASUS 24-11: izquierdo arriba/derecho arriba/ambos arriba según propietario, reposo indeterminado por recorte |
| VI-05B | **Especificación** de Perfil Escritorio sentado como uso normal. Aún NO implementado |
| Visión Eufy C220/E220 | **Futuro**, modelos identificados, sin acceso ni integración todavía |

Citar al trabajar los PR #80–#93 y documentos de continuidad, **sin considerar aprobaciones de CI como validación de hardware**. [#93](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/93) es la base acumulativa de documentación al 24-11 y sigue en borrador.

## 5. Visión ampliada eufy — especificación futura

Hay **dos cámaras de interior Wi-Fi motorizadas** en el departamento: **eufy Indoor Cam C220** y **eufy Indoor Cam E220**; una cámara está en la sala y otra en el dormitorio, pero **no se ha determinado qué modelo está en cada ambiente**.

- E220: la página oficial documenta **NAS/RTSP**. C220: comprobar presencia real de opción NAS/RTSP en la aplicación/firmware de la unidad.
- PTZ 360° significa que la óptica gira; **no significa captura esférica de 360° simultánea**. Dos cámaras en habitaciones diferentes permiten cambio de zona, no triangulación 3D simultánea si no comparten campo visual.
- Obtener RTSP **no implica control PTZ por ONVIF**. Verificar controles disponibles antes de proponer giro desde LUMIA.
- Cuando se autorice: un adaptador local LAN por cámara; fotogramas efímeros; procesamiento CPU con permisos por habitación; Qwen solo bajo pregunta. Sin contraseña o URL RTSP publicada; no abrir puertos externos; no grabación permanente ni seguimiento entre habitaciones por defecto.
- La webcam de PC + Perfil Escritorio **sigue siendo el entorno principal**. La eufy es ampliación opcional para mayor ángulo y cobertura, nunca prerrequisito.

Referencias:
- [eufy Indoor Cam E220](https://www.eufy.com/us/products/t8410121).
- [eufy NAS/RTSP setup](https://service.eufy.com/article-description/Device-NAS-RTSP-Configuration-Guide).
- [eufy ONVIF compatibility overview](https://www.eufy.com/blogs/security-camera/onvif-ip-camera-guide).

## 6. Política de integración y versiones (evitar proyectos divergentes)

**Actual:** repositorio `ingeniusvictor/orbi-jarvis-agent-lab`; PR acumulados no fusionados por seguridad. Rama local QA ASUS `integration/lumia-asus-next-20261114`, carpeta `LUMIA-NEXT-QA`. Instalación diaria ASUS **protegida** en `LUMIA-ASUS`, commit exacto `1580a5182eba540893e35e37065be77da4ed014c`; no tocar sin aprobación explícita.

**Futuro objetivo de release, pendiente de implementar:**
1. Toda mejora entra en una rama de corta vida desde el HEAD acumulativo, con issue/PR y QA de regresión. **No generar una línea de desarrollo propia por laptop**.
2. CI compartida Windows/Ubuntu prueba lógica, avatar, voz/visión y perfiles de configuración. El modelo GPU/CUDA no se prueba en CI de un runner sin GPU; requiere matriz física aparte.
3. Habilitar y probar `asus-gpu4`, `hp-gpu6`, `cpu-only` con **el mismo commit** (o registrar explícitamente gates pendientes), cada uno con su tag de Ollama y parámetros, sin trasladar la instalación global del otro equipo.
4. Registrar versión semántica, SHA, parámetros Ollama, recursos, benchmarks comparables y resultados/limitaciones por dispositivo. Una release **no se marca "paridad validada"** mientras falte QA en cualquiera de los tres.
5. Si falla un gate, la mejora permanece en borrador o deshabilitada de manera explícita y reversible, preservando último release aceptado. Promoción a `main` y a ASUS diaria requiere autorización del propietario.
6. Cambiar cerebro mediante elección explícita y reversible. No dejar dos versiones instaladas con etiquetas idénticas ni fingir que dos modelos generan los mismos resultados.

### Matriz obligatoria de pruebas
- **Conversación:** español latino, respuesta correcta, no alucinaciones sobre estado de cámara, fallas explícitas.
- **Visión:** prueba misma JPEG, conteos 1 y 2 rostros, brazo izquierdo/derecho/ambos arriba, brazos abajo fuera de encuadre sin falsa clasificación, apagado.
- **Voz:** Whisper entrada, Kokoro salida, tiempos hasta primer texto/audio, funcionamiento sin internet cuando corresponda.
- **Avatar:** se abre GLB/VRM con y sin animación, clips R8, expresiones faciales, sin deformación o fallo al inicializar.
- **CPU/GPU:** uso de VRAM/RAM/CPU, latencia mediana y peor caso, 1 modelo residente para benchmark comparable; no inferir rendimiento de la HP a partir de pruebas ASUS.
- **Seguridad:** cámara/rostro/pose por opt-in, caducidad 3 minutos, secretos privados, herramientas con permisos, ningún cambio a instalación diaria ASUS sin consentimiento.

## 7. Hitos concretos pendientes

**P0 Documentación (esta tarea):** este documento, `LUMIA_PLATFORM_MATRIX.json`, referencia desde README/manifest y gate CI de integridad estructural para evitar que se borre un perfil sin advertencia.

**P1 Selector runtime universal:** sustituir la parte ASUS-específica del lanzador de QA por preflight + perfiles parametrizados, sin tocar la ejecución diaria ya certificada. Hacerlo mediante nueva ruta opt-in, conservando los scripts actuales.

**P2 HP 6 GB:** instalar/probar *solo en su QA* la misma revisión de LUMIA; Qwen 4B frente a 2B y Nemotron con tareas reales iguales de voz, visión, contexto y gestos. Elegir cerebro por resultados, no tamaño.

**P3 CPU 0 GB VRAM:** fijar modelo 0.8B exacto, medir si la aplicación funciona con voz/visión y dónde hace falta reducir carga de forma declarada, sin eliminar contratos.

**P4 Release común:** certificar una sola versión Git/manifest con tres resultados físicos, marcando “no validado” hasta entonces. Lanzadores por perfil, no copias funcionalmente diferentes.

**P5 Futuro:** perfil Eufy multifuente (E220 primero) y opción cuerpo completo para cámaras más abiertas; no bloquear desarrollo de escritorio sentado.

## 8. Manual de continuidad obligatorio para cualquier agente futuro

**Antes de trabajar:**
- Leer este documento, `LUMIA_PLATFORM_MATRIX.json`, `LUMIA_NEXT_MANIFEST.json`, [continuidad VISION-04](39-VISION04-CONTINUIDAD-20261109.md), PR #93 y issue #80.
- Identificar repo, SHA actual, ramas abiertas, última QA **real** ASUS/HP/CPU y riesgos. Verificar `git status` antes de cualquier fusión.
- Declarar qué módulos se preservan y qué pruebas reejecutar; la tarea debe avanzar la **misma línea de producto**.

**Durante:**
- No inventar resultados de hardware o estados de modelo. No cambiar modelo, instalar paquetes globales, habilitar cámara/micrófono o permisos sin aprobación.
- Usar feature PR sobre baseline acumulado; no abrir experimentos que nunca se reincorporan; anotar bloqueo, versión y evidencia.
- Mantener independencia del cerebro. Evitar ramas por perfil o artefactos Windows específicos en el código de lógica compartida.

**Después:**
- Actualizar issue #80, matriz/manifiesto si cambió un estado, SHA y resultados de tests. Si hay nueva función, ejecutar gates de regresión de rostro/pose/voz/avatar.
- Entregar instrucciones reproducibles para cada equipo cuando estén certificadas; conservar siempre el rollback.
- No marcar “terminado” si solo existe CI sin QA física. No promover a ASUS diaria ni `main` sin autorización.

**Regla maestra:** *Tres cerebros según capacidad, un solo cuerpo de software, una sola historia de mejoras, una sola versión por release certificada.*
