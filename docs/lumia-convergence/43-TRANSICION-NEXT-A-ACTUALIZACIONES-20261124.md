# LUMIA — de «NEXT experimental» a actualizaciones de una sola aplicación
**Decisión del propietario · 24 de noviembre de 2026**  
**Estado:** nueva política aprobada conceptualmente; plan de promoción/versión estable **preparado, no ejecutado**.  
**Complementa:** [41 — LUMIA unificada](41-LUMIA-UNIFICADA-TRES-ENTORNOS-20261124.md), [42 — control de mejoras](42-LUMIA-CONTROL-MEJORAS-20261124.md), [inventario](../../LUMIA_IMPROVEMENTS_LEDGER.json), [matriz de equipos](../../LUMIA_PLATFORM_MATRIX.json) y [issue maestro #80](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/80).

> **Cambio de enfoque:** LUMIA es una aplicación **ya funcional en ASUS**, que recibe actualizaciones incrementales. «LUMIA NEXT» es el nombre **temporal de su laboratorio/serie de PR**, no otra aplicación ni una rama permanente que deba quedarse separada. Tras certificar y promover una revisión estable, el trabajo habitual será: LUMIA versión actual → mejora concreta → pruebas → actualización → rollback si falla.

## 1. Confirmación del árbol Git; riesgo real de una promoción ciega

Revisión de GitHub el 24-11-2026:

- `main` es **antecesor** de `integration/lumia-asus-next-20261114` y de la rama documental `docs/lumia-change-control-ledger-20261124`. Al comparar `main` con la punta actual de documentación, GitHub reportó **1.483 commits por delante y 0 por detrás**. Esto significa que se puede **planificar** una promoción lineal sin crear un tercer producto, pero **NO** que todos esos commits estén físicamente probados y aprobados.
- El PR #85 `integration/lumia-asus-next-20261114` estaba **DRAFT** con head `401d8f9b45df56daadea78111d25da7e0a952d80`; la serie de avances posteriores se apiló en PRs #91, #92, #93, #94 y #95, todos **abiertos en borrador y no fusionados** al documentar. La punta más reciente de desarrollo es la rama de #95. No confundir el nombre de la rama antigua de integración con la revisión acumulativa más nueva.
- Gran parte de la historia contiene **código/laboratorios experimentales**. Algunos flujos de identidad facial SFace/DPAPI son opt-in o no integrados; **no deben activarse ni promoverse como funciones aprobadas** por aparecer en la historia.
- La instalación ASUS habitual está protegida en `C:\Users\ingvm\LUMIA-ASUS`, commit `1580a5182eba540893e35e37065be77da4ed014c`. La carpeta `LUMIA-NEXT-QA` es distinta. Prohibido sustituir el original, reconfigurar voz, Ollama o habilitar cámaras sin permiso.
- **CI verde ≠ release física validada**. El funcionamiento actual de LUMIA ASUS está aprobado parcialmente por el propietario para avatar, voz, escenas y brazos elevados; la HP sólo tiene mediciones aisladas de modelos y el perfil CPU 0.8B no tiene aún prueba integral.

## 2. Nuevo modelo de trabajo: solo una versión de LUMIA

```text
             LUMIA — REVISIÓN ESTABLE AUTORIZADA
                            |
           ┌────────────────┴────────────────┐
           |                                 |
       ASUS 4 GB                          HP 6 GB
     Qwen3.5 2B                        Qwen3.5 4B/2B
           |                                 |
           └────────────────┬────────────────┘
                            |
                      CPU sin GPU
                     Qwen3.5 0.8B
       (mismo código/versión; QA por equipo independiente)

         nueva necesidad/idea → issue/ID de mejora
                          ↓
                   cambio aislado (PR)
                          ↓
                  gates/regresión de CI
                          ↓
               QA real en hardware relevante
                          ↓
                   aprobación explícita
                          ↓
          actualización de LUMIA + etiqueta Git
                          ↓
                 respaldos y rollback
```

**Una única fuente de producto:** `main` será la rama de **LUMIA estable sólo después de la promoción autorizada**. Hasta entonces sigue como está; no reescribir historia ni forzar actualización.

**Borradores nuevos:** usar ramas **cortas** `feat/...` o `fix/...` para desarrollar una mejora, PR contra línea activa, no subproyectos permanentes `LUMIA-NEXT-2`, `NEXT-V3`, etc. Tras aprobar y promover, cerrar/fusionar PRs según su destino y conservar el registro, no mantener stacks experimentales crecientes como forma habitual de operar.

**Versiones:** usar SemVer `vMAJOR.MINOR.PATCH` **cuando exista una versión candidata aprobada**. Ejemplos genéricos `vX.Y.0` para función, `vX.Y.Z` patch para corrección, `vX.Y.Z-rc.N` para candidato; **no se ha creado todavía ningún tag nuevo ni se ha asignado número definitivo**. Cada publicación fija un SHA y manifiesto de mejoras/fallos conocidos. No confundir `main` con un artefacto instalado automáticamente.

**Actualización segura:** el instalador/lanzador universal deberá detectar perfil `asus-gpu4`, `hp-gpu6` o `cpu-only` y elegir parámetros/modelos locales sin cambiar el código. La publicación debe mostrar versión, SHA, perfil y cerebro; posibilidad explícita de volver a versión anterior. Una release puede distribuirse gradualmente, **pero no se afirma que es compatible con HP/CPU mientras falte QA real**: registrar excepción escrita aprobada o esperar a cada gate. El contrato es el mismo y una capacidad no disponible se explica sin inventarla.

## 3. Operación: ¿qué es una mejora, qué es una actualización?

- **Mejora** = función en desarrollo o piloto, con issue y evidencia. Puede tener pruebas correctas en la ASUS; no es automáticamente una release.
- **Actualización** = cambio integrado en la línea estable común con SHA/tag, changelog, pruebas, resultado por equipo, aprobación y rollback.
- **Nueva versión** = punto de recuperación y entrega. No crea una segunda «LUMIA»: la aplicación sigue siendo la misma, con más capacidades.

**No más conversaciones como única memoria del proyecto**: cada desarrollo modifica `LUMIA_IMPROVEMENTS_LEDGER.json`, el manifiesto del release y el issue #80. En cada sesión se recupera ese estado antes de proponer nuevos cambios.

### 3.1. Principio de promoción continua: no más funciones terminadas abandonadas en ramas

**Confirmación adicional del propietario (24-11-2026):** «Experimentar en ramas está bien; cuando una función se prueba y sus resultados son buenos, debe pasar a ser una actualización de la LUMIA original». Las ramas cumplen un propósito temporal: probar con seguridad. No deben convertirse en una excusa para postergar indefinidamente una mejora validada.

**Flujo por cada capacidad:**
```text
      ORIGINAL LUMIA (funcionando)
                  ↓
           RAMA DE EXPERIMENTO
                  ↓
           PR + CI + QA REAL
                  ↓
     USUARIO CONFIRMA QUE FUNCIONÓ
                  ↓
      PAQUETE MÍNIMO DE ACTUALIZACIÓN
       (código + dependencias + rollback)
                  ↓
       AUTORIZACIÓN DE ESA PROMOCIÓN
                  ↓
          LUMIA ORIGINAL ACTUALIZADA
             misma app, nueva versión
```

**Actualizaciones pequeñas y frecuentes:** no esperar a que toda VI-05, todas las cámaras o todos los modelos locales estén listos. Ejemplo: las respuestas visuales con el mismo JPEG y conteo 1/2 de VI-04.2A pueden entrar en una revisión acotada si cumplen la regresión final; la clasificación de brazos elevados de VI-05A.1 puede entrar como función limitada, sin inventar que se validó detectar brazos abajo fuera de cuadro ni postura «sentado». No incluir funcionalidades de identidad no autorizadas.

**Despliegue escalonado que no sacrifica una sola LUMIA:** un paquete ya certificado en ASUS puede actualizar primero la ASUS. No exigir que un equipo sin GPU, que aún no está disponible o no tiene QA, bloquee esa actualización. El repositorio y código de la versión **siguen siendo los mismos** para HP/CPU. Las otras máquinas figuran «pendiente de validación/despliegue», no «incompatibles» por presunción ni «validadas» sin pruebas.

**Importante:** «la prueba salió bien» aprueba el comportamiento observado, no concede permiso de mover 1.483 commits a producción. Antes de alterar `main` o reemplazar `LUMIA-ASUS`, el paquete específico se revisa, respalda, autoriza y comprueba al instalar; esa precaución permite mantener actualizaciones frecuentes sin perder la versión funcional.

## 4. Primer corte de estabilización («LUMIA NEXT» → LUMIA estable)

No ejecutar una fusión al instante. Procedimiento:
1. **Congelar un SHA candidato** a partir de la punta acumulativa revisada; documentar qué contiene y qué laboratorios están expresamente fuera de producción. Inventariar PR #74–#95 relacionados, especialmente experimentos sin validación de consentimiento e identidad. Un branch con 1.483 commits desde `main` no se promueve sólo por poder hacer fast-forward.
2. **Revisión de seguridad y flags:** comprobar que cámara/micrófono y reconocimiento por identidad permanecen desactivados por defecto, que no se exponen claves o assets privados y que herramientas de escritura tienen permisos adecuados; enumerar riesgos bloqueantes.
3. **Regresión completa de CI y ASUS física:** voz Whisper/Kokoro y navegador, avatar VRM y expresiones, JPEG exacto con conteo 1/2 rostros, VI-05A.1 manos arriba, postura sentada con extremidades fuera del cuadro como indeterminadas, apagado y expiración. Registrar resultados de campo en `LUMIA_IMPROVEMENTS_LEDGER.json`.
4. **Preparar actualización segura de ASUS primero cuando corresponda, sin duplicar proyecto:** validar el SHA candidato en una carpeta de QA ASUS, con backup y rollback del original. Para HP 6 GB y CPU, usar **la misma revisión Git** en entornos QA cuando estén disponibles; registrar `no probado/no desplegado` mientras falte verificación. El usuario permite **despliegue escalonado** de funciones ya validadas en ASUS, con alcance documentado y autorización de la actualización concreta. No bloquear por HP/CPU, ni afirmar paridad inexistente.
5. **Antes de tocar `main`:** mostrar el diff de promoción y lista de PR/commits; tener backup y rollback, tag candidato e informe de validación. Solicitar al propietario **aprobación expresa de esa promoción concreta**. La aprobación general de «trabajar con actualizaciones» no significa permiso para ejecutar una fusión de 1.483 commits o sustituir el original.
6. **Tras promoción autorizada:** `main` y la versión/tag se convierten en referencia del producto, lanzar una actualización opt-in hacia el dispositivo, verificar inicio y funcionalidad. El antiguo nombre NEXT pasa a histórico/documentación y se archivan las ramas/PRs ya integradas, sin borrar evidencia.
7. **En adelante:** cada nueva mejora parte de la última versión estable; pasa CI, QA y actualización con versión incremental. No recrear otra rama troncal permanentemente experimental.

## 5. Qué función va primero después del corte

Se mantiene orden práctico sin bloquear avances:
- **P0:** primer release estable autorizado de LUMIA y mecanismo de actualización/rollback. Mantener la instalación ASUS habitual intacta hasta validar su reemplazo.
- **P1:** lanzador universal para ASUS/HP/CPU con cerebro intercambiable, misma UI, voz y avatar.
- **P2:** VI-05B Perfil Escritorio sentado con diagnóstico de brazos fuera de cuadro y en pantalla; sin exigir cámara nueva.
- **P3:** HP Qwen 4B vs 2B en LUMIA, CPU 0.8B, QA y afinación de recursos; estabilizar el paquete único.
- **P4:** eufy C220/E220 y más vistas opt-in, sólo cuando RTSP/control hayan sido verificados.

**Regla final:** *LUMIA NEXT fue una fase de integración; LUMIA es el producto. El camino desde ahora es mejorar y actualizar una sola aplicación comprobable, no mantener una nueva rama de producto para cada idea.*
