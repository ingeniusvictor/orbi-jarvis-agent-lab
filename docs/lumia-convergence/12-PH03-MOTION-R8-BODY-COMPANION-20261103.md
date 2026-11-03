# PH-03 — LUMIA Body Companion con Motion R8

**Base protegida:** PH-02 en PR #40, que a su vez conserva Portal Head PH-01 + RC-03 + RC-04 + SKILL-01. `main` no se modifica.

## Hallazgo en ASUS (2026-11-03)
El usuario abrió `?lumiaAvatar=head-vrm&lumiaNeck=1` y vio una figura completa con brazos horizontales. La causa es que PH-01/PH-02 solo implementaban mirada, cara y lipsync, sin usar el motor corporal Motion R8; hacer visibles mallas Body no aplica una pose ni reproduce FBX.

## Contenido del kit original rescatado
Fuente: `ingeniusvictor/lumia-motion-lab`, rama `feat/motion-r8-source-20261101`. Los módulos `BodyMotionCore`, `BodyPresenceCore`, `MotionIntelligence`, `SemanticMotionCore`, `PoseTransition`, `retargetMixamoUpperBody` y el catálogo de 17 animaciones se copian como lógica fuente (sin binarios), con declaraciones `.d.ts` para el portal TS.

- **Procedural R8:** pose natural precalentada desde el primer frame, microanimaciones, respiración, gestos y ajustes de brazo/mano a partir de estados de escucha, pensamiento y habla.
- **Semántica R7/R8:** intenciones gestuales solo si hay una frase efectivamente reproducida por Kokoro. No se inventan eventos de tiempo fonético exacto.
- **17 FBX:** catálogo R8 privado con carga diferida y retarget adaptado al humanoide GLTF de este portal. Ante incompatibilidad o archivo ausente, el cuerpo continúa con movimiento procedural en lugar de detenerse o sustituir el cerebro.
- **Transiciones:** interpolación R8 entre posturas, sin crear un segundo TTS, STT, modelo de IA ni renderizador Three.js.
- **Rostro:** PH-02 conserva gaze/pestañeo/visemas y la cabeza rota independientemente del cuerpo. La sincronización audiblemente demostrada no se reescribe.

## Tres modos de vista

| Dirección local | Vista |
|---|---|
| `/?lumiaAvatar=head-vrm` | Solo cabeza PH-02, exactamente como el piloto previo |
| `/?lumiaAvatar=bust-vrm` | Bustos y brazos en modo conversación R8 |
| `/?lumiaAvatar=body-vrm` | VRM completo, reducido para caber dentro del aro |
| `/?lumiaAvatar=body-vrm&lumiaR8=procedural` | Cuerpo con R8 procedural exclusivamente; no carga FBX |
| `/?lumiaAvatar=legacy` | Regreso inmediato al GLB antiguo |

El enlace experimental de cuello `?lumiaAvatar=head-vrm&lumiaNeck=1` también recibe postura procedural para evitar brazos horizontales; se recomienda el modo Bust nuevo para conversaciones naturales.

## Instalación de los FBX aprobados: solamente local
El repositorio es público. **No se sube VRM, FBX ni ZIP privado a GitHub.**

Desde `C:\Users\ingvm\LUMIA-ASUS`, con el kit R8 original en Descargas, ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\INSTALAR_LUMIA_MOTION_R8_BODY.ps1 -KitZip "$env:USERPROFILE\Downloads\LUMIA_VITA_NATURAL_V085_R8_NATURAL_CONVERSATION_KIT.zip"
```

El instalador valida el SHA-256 **completo del ZIP R8 original**. Extrae cada FBX a un archivo temporal, verifica su tamaño y calcula su SHA-256 íntegro. Los otros 16 FBX también se contrastan con sus hashes individuales completos del manifiesto. Para `Waving.fbx`, el manifiesto histórico contiene solamente 56 caracteres que **no son un prefijo fiable** y no se usan como verificación individual: su procedencia se garantiza por el ZIP completo validado y su SHA-256 íntegro se calcula al extraerlo. Si ya existe algún archivo local, se compara su hash con el contenido exacto extraído del ZIP y **jamás se sobrescribe** en caso de diferencia. No se inventan caracteres faltantes.

## Límites y QA pendientes
- Este primer Body Companion reutiliza el movimiento procedural y catálogo R8, pero el VRM de Portal sigue cargándose mediante GLTFLoader y un adaptador VRM0 crudo. **No es todavía el runtime normalizado VRMLoaderPlugin** del Motion Lab; retarget FBX debe validarse visualmente en ASUS, incluyendo manos, codos y hombros.
- El compositor de bailes de hasta tres clips, recorridos espaciales de caminar y físicas/shader MToon originales no se integran aún: no afirmar paridad total de Motion R8.
- Las pruebas automáticas comprueban ausencia de T-pose procedural en un rig simulado, contratos de archivos privados, estados semánticos, build y regresiones. No validan la calidad corporal en el VRM privado, que solo existe localmente.
- La ruta legacy y el modo de cabeza PH-02 siguen intactos. Fallback `&lumiaR8=procedural` permite desactivar la reproducción FBX sin perder movimiento de brazos.

## Criterios de aceptación ASUS
1. Confirmar 17/17 archivos privados instalados, `git status --short` sin binarios nuevos.
2. Probar modo Bust: brazos descansan naturalmente, respiración y movimiento asimétrico, sin T-pose ni codos atravesando ropa.
3. Hablar: solo iniciar Talking y gestos en audio REAL, mantener boca/ojos y terminar correctamente ante interrupción.
4. Probar Head Gesture al escuchar, Thinking al pensar, Idle al reposar; manos/cuerpo sin deformaciones. Si un clip es incompatible, volver a procedural y registrar el error de consola.
5. Comparar Body vs `&lumiaR8=procedural`; si hay deformaciones, mantener solo procedural hasta corregir mapeo VRM0.
6. Verificar Head y Legacy intactos. No fusionar hasta aceptación física.
