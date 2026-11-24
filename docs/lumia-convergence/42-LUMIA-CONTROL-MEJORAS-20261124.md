> **TRANSICIÓN A ACTUALIZACIONES INCREMENTALES:** leer [Documento 43 — retirada del nombre NEXT como rama de producto](43-TRANSICION-NEXT-A-ACTUALIZACIONES-20261124.md). «NEXT» representa una fase de QA; el producto tendrá una sola rama estable de versiones con mejoras incorporadas y rollback, después del primer corte explícitamente autorizado.\n\n# LUMIA — Control maestro de mejoras, validaciones y versiones
**24-11-2026 · Política obligatoria para ASUS, HP y CPU**

> **Leer al iniciar cualquier trabajo nuevo** junto con [arquitectura única de tres entornos](41-LUMIA-UNIFICADA-TRES-ENTORNOS-20261124.md), [matriz de hardware](../../LUMIA_PLATFORM_MATRIX.json), [registro legible por máquina](../../LUMIA_IMPROVEMENTS_LEDGER.json), [manifiesto histórico ASUS](../../LUMIA_NEXT_MANIFEST.json) y [seguimiento #80](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/80).
>
> **La conversación no es la fuente definitiva del progreso.** Cada propuesta, resultado, problema, cambio de código y aceptación se registra en Git, PRs y este inventario. Un hito no se convierte en «funciona en todos los equipos» solamente porque el CI pasó o porque funcionó en la ASUS.

## 1. Un solo producto y cinco preguntas por cada cambio

Toda mejora debe responder, antes de darla por terminada:

1. **¿Qué necesidad concreta resuelve?** Especificar alcance, criterios de aceptación, limitaciones y qué cosas no se harán.
2. **¿Dónde está el código?** Vincular issue/PR, rama temporal y SHA exacto. Sin fragmentos sin incorporar en conversaciones o ramas huérfanas.
3. **¿Qué se comprobó automáticamente?** Ejecutar el gate acumulativo CI, registrar resultado y separar pruebas sintéticas de ejecución con hardware.
4. **¿Qué hardware y cerebro la probaron físicamente?** Registrar resultados independientes para ASUS 4 GB / HP 6 GB / CPU sin VRAM; nunca asumir que un test HP equivale a ASUS o CPU. Diferenciar modelo realmente ejecutado de candidato.
5. **¿Está efectivamente incluida en una versión común?** Solo si existe un mismo SHA/tag con autorización expresa del propietario y criterios de release. Si no, queda en borrador aunque sea una mejora aprobada parcialmente.

## 2. Estados precisos (dos ejes independientes)

| Eje | Valores | Significado |
| --- | --- | --- |
| **Implementación** | `idea`, `specified`, `implemented_draft`, `released` | Desde propuesta hasta versión liberada; «implementado en PR» NO equivale a «instalado en producción» |
| **CI** | `not_applicable`, `pending`, `passed`, `failed` | Regresión automatizada y compilación; no prueba micrófono, webcam, movimiento real ni GPU |
| **QA por perfil** | `not_tested`, `partial`, `passed`, `failed` | Evidencia física real y su alcance, individual por ASUS/HP/CPU |
| **Publicación** | `not_released`, `released` | Separado del éxito en desarrollo; requiere autorización y una sola versión para los tres |

Una prueba parcial positiva **no se rebautiza** como validación integral. Ejemplo: VI-05A.1 reconoció brazos izquierdo/derecho/ambos levantados en la ASUS, pero sentado con brazos abajo el encuadre excluía muñecas/codos. Es **QA parcial**, no error general ni prueba de postura «sentado».

## 3. Fuente de verdad y expediente por mejora

`LUMIA_IMPROVEMENTS_LEDGER.json` contiene por hito:

- Identificador estable, nombre, área y alcance a los tres perfiles.
- Estado de código, CI, QA por equipo y publicación.
- Evidencia fechada y **tipo** (medición F12, reporte del propietario, benchmark, CI, decisión).
- Issue/PR y siguiente paso comprobable.
- Autorización expresa de promoción cuando exista. Nada se libera por silencio ni por aprobar una prueba aislada.

**Regla para nuevas funcionalidades:** asignar un ID `LUM-...` antes de comenzar; crear issue con criterios de aceptación y definir las pruebas de regresión de los módulos existentes que podrían romperse. Al modificar el código, actualizar el expediente en el mismo PR. No utilizar una rama distinta por computador.

**Regla para QA de campo:** registrar la fecha, equipo concreto, modelo Ollama/tags/quantización, tamaño de contexto, versión Git SHA, pregunta o postura, resultados correctos/incorrectos, duración y evidencia disponible. No registrar rostro, audio, capturas o claves de cámaras/RTSP como requisito de auditoría. Se aceptan diagnósticos categóricos sin fotos privadas.

**Regla de modelo:** no escoger el cerebro por número de parámetros; comparar respuestas y latencia en un protocolo idéntico. Los ensayos HP de 98,48 vs 19,74 tok/s para el mismo Qwen 2B proceden de protocolos diferentes; la causa de discrepancia no está establecida y no debe inventarse.

## 4. Regla principal: función validada → actualización de LUMIA ORIGINAL

**Decisión explícita del propietario (24-11-2026):** las ramas son áreas de experimentación, **no el destino final de una mejora**. Cuando una capacidad queda acotada, pasa las pruebas relevantes y el propietario confirma que se comporta correctamente, **se prepara como actualización incremental de la LUMIA original**, sin esperar a acumular cinco, diez o veinte mejoras en una rama NEXT.

### Dos etapas diferentes que NO deben confundirse

1. **Aceptación funcional:** el propietario comprueba un comportamiento concreto en su ASUS (por ejemplo, distinguir brazo izquierdo y derecho levantados) y confirma el éxito. Se documentan evidencias, alcance exacto y posibles limitaciones: `passed` para lo que realmente quedó validado, o `partial` para una función más amplia. Esta confirmación **habilita preparar el paquete de actualización**; no autoriza por sí sola copiar todos los commits históricos a `main`.
2. **Promoción segura a original:** para la función aceptada, se identifica el **diff mínimo y sus dependencias**, se corren las regresiones, se prepara snapshot/backup de la original, se comprueba que voz, avatar, cerebro, cámara y permisos no cambian indebidamente, y se obtiene autorización del propietario para **ese paquete concreto**. Entonces se integra en la línea estable y se actualiza la instalación original con rollback. **El estado `released` solo se usa después de confirmar que la actualización quedó aplicada y funciona**.

**No bloquear las actualizaciones de ASUS porque aún no hemos probado CPU 0.8B o HP 4B dentro de LUMIA.** Se permite **despliegue escalonado ASUS primero** una vez aprobada la funcionalidad y superados sus controles. El mismo código/versión debe continuar disponible para HP y CPU; registrar `pending` o `not_tested` por equipo, y prohibido declarar que esos dispositivos funcionan hasta comprobarlo. Nunca crear una variante de código diferente para permitir el despliegue.

### Requisitos mínimos por actualización

1. Una función/paquete acotado, con ID, criterio de éxito, dependencias y versión SHA; PR revisado y CI acumulativa aprobada.
2. **QA física `passed` en el equipo destino**, con el alcance explícito. No publicar como «detección corporal completa» cuando solo aprobaron los brazos elevados: publicar la función limitada como tal o completar pruebas.
3. Copia de seguridad y procedimiento de revertir que deje **exactamente** la última LUMIA original operativa; sin sobrescribir perfiles de Whisper/Kokoro, modelos, clips privados o datos del usuario.
4. El propietario conoce y autoriza **la promoción concreta**, y verificamos arranque real tras actualizar. Su aprobación funcional de una prueba puede contarse como aceptación del comportamiento, **no como permiso para un merge masivo** de todas las ramas.
5. Una sola línea de producto y una versión Git por release. Si HP/CPU quedan sin validar, declarar **despliegue escalonado** con `rollout.validated_profiles`, `rollout.pending_profiles`, motivo y plan de QA. No mentir sobre paridad entre los tres.

**Gate de publicación:** `released` requiere CI `passed`, aprobación de promoción, SHA de versión, QA `passed` en todo perfil donde realmente se desplegó, ausencia de perfiles sin clasificar y, si queda alguno por probar, excepción explícita de despliegue escalonado. La matriz de QA se mantiene completa para ASUS/HP/CPU, aunque no se obligue a esperar a todos para actualizar primero la ASUS.

**Hoy:** ningún elemento experimental del inventario está marcado como `released` en la LUMIA unificada. El uso habitual ASUS original permanece intacto mientras preparamos el primer paquete real; los PR #93–#95 siguen siendo borradores.

El gate `scripts/certify-lumia-improvements-ledger.mjs` exige evidencia y protege frente a falsos releases. **No reemplaza** la decisión del propietario ni valida físicamente los equipos.

## 5. Una sola línea de mejoras, sin perder nada

- **ASUS (4 GB):** Qwen 3.5 2B Q4_K_M es la base comprobada de uso actual.
- **HP (6 GB):** Qwen 3.5 4B Q4_K_M candidato, 2B alternativa rápida; Nemotron candidato condicionado a evidencia. Pruebas aisladas de modelos no prueban LUMIA integrada.
- **CPU (0 GB VRAM):** Qwen 3.5 0.8B es objetivo sin validación de runtime en un equipo de destino aún.
- Todas las funciones **deben continuar en el mismo repositorio y SHA de código**, incluso cuando un perfil requiera límites de imagen, contexto o frecuencia distintos.
- La cámara estándar de escritorio sentado es **escenario base**; eufy C220/E220 y visión multicámara quedan como evolución futura, con acceso opt-in y sin vigilancia automática.
- **Proteger** `LUMIA-ASUS` SHA `1580a5182eba540893e35e37065be77da4ed014c`. La rama QA local `integration/lumia-asus-next-20261114` no se reescribe sin revisar su estado.

## 6. Flujo corto obligatorio para cualquier agente que trabaje en LUMIA

```text
IDEA → ESPECIFICACIÓN → PR DE IMPLEMENTACIÓN → CI
  → QA FÍSICA POR PERFIL → APROBACIÓN → RELEASE COMÚN
              ↖ error / nueva evidencia / corrección ↙
```

**Inicio de sesión:** leer documentos 41/42, matriz y registro; inspeccionar issue #80 y PR stack vigente antes de crear otra rama. Identificar las pruebas aprobadas y lo pendiente. Nunca tomar una captura parcial de un chat como la versión canónica.

**Durante:** un avance por PR trazable, rama corta sobre HEAD acumulado, sin tocar `main` o ASUS diaria. Mantener tests de visión exact-JPEG (1/2 rostros), VI-05 postura, voz Whisper/Kokoro, avatar y privacidad según área afectada.

**Cierre:** registrar evidencia de CI y observación real, actualizar `LUMIA_IMPROVEMENTS_LEDGER.json`, `LUMIA_PLATFORM_MATRIX.json` si cambió capacidad/modelo, y anotar decisión en issue #80. Nunca afirmar `released` si se trata de QA parcial o un PR DRAFT.

## 7. Estructura para solicitud de mejoras

Todo PR nuevo debe incluir el ID `LUM-...`, el perfil de hardware en que se validó, evidencia medible, lista de no-regresiones y plan para los otros dos perfiles. Se proporciona [plantilla de PR](../../.github/PULL_REQUEST_TEMPLATE.md) para no olvidar estos datos.

**Principio definitivo:** *LUMIA puede crecer indefinidamente en funciones, pero debe mantener una sola historia verificable de qué se propuso, qué se construyó, qué se probó y qué llegó realmente a cada equipo.*
