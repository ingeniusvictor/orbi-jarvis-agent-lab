# PH-04.8 — Caminar en sitio, avanzar y caminar en círculo

## QA del usuario · Noviembre 2026

Tras validar el menú de 17 gestos y las correcciones de aplauso y negación de PH-04.7, el usuario observó que los tres movimientos `Walking in place.fbx`, `Walking adelante.fbx` y `Walk In Circle.fbx` **se veían igual: pasos en el sitio**. Propuso darles un efecto de cámara para que el movimiento de avanzar y el circular realmente se perciban.

## Causa confirmada por código

`src/scene/lumia-motion-r8/mixamo-retarget.js` indica explícitamente que solo retargetea pistas `quaternion` y elimina `position`: el FBX original puede contener desplazamiento de raíz, pero el portal GLTFLoader/VRM0 no lo traslada a la escena. En `Scene.tsx`, la cámara mantiene `x=0` y apunta siempre al centro; el personaje se dibuja inicialmente con una traslación fija. Por ello los huesos pueden caminar sin que la posición del personaje cambie.

**No se han leído los 3 FBX privados para confirmar qué pistas de traslación real contienen**. Esta fase ofrece una coreografía cinematográfica reversible de presentación que sigue el avance temporal del clip, no afirma restaurar fielmente el desplazamiento exacto incluido en los archivos originales.

## Implementación PH-04.8

- `Walking in place.fbx`: mantiene la escena fija; solo los pies y piernas se animan según el FBX, sin alterar el encuadre.
- `Walking adelante.fbx`: mientras el FBX avanza en su reloj real `AnimationAction.time / AnimationClip.duration`, el cuerpo se acerca a la cámara aproximadamente **0,48 unidades del modelo** y recibe una oscilación lateral mínima. El avance se limita para que permanezca en el halo.
- `Walk In Circle.fbx`: durante el reloj real del FBX, sigue una órbita cerrada de **radio 0,30 unidades del modelo**, modificando `x`, `z` y orientación del cuerpo en el mismo sentido del recorrido.
- Al finalizar o interrumpir, la posición del avatar retorna de forma amortiguada al centro: no hay teletransporte de un fotograma.
- La cámara del portal y los aros holográficos permanecen estables. La perspectiva del modelo que se acerca o rota es suficiente para hacer visible el desplazamiento, sin afectar las vistas de rostro y medio cuerpo.
- La coreografía se calcula sobre un grupo del avatar `walkStageGroup` independiente del rig: no modifica ni retargetea los huesos, el archivo VRM original ni los 17 FBX privados.
- Los otros 14 gestos, narración Kokoro, sincronización de boca, ojos, vistas y selector de animaciones mantienen el comportamiento PH-04.7.

## Reversibilidad y diagnóstico

- Normal: `http://localhost:5173/?lumiaAvatar=body-vrm`
- Respaldo: `http://localhost:5173/?lumiaAvatar=body-vrm&lumiaWalk=legacy`
- Modo procedural previo: `http://localhost:5173/?lumiaAvatar=body-vrm&lumiaR8=procedural` (sin FBX)
- Consola de inicio de un recorrido: `[lumia:ph048] cinematic walking stage:` e identificador de clip, duración real de FBX.
- El modo `lumiaWalk=legacy` desactiva únicamente la coreografía escénica, sin cancelar ni modificar la animación corporal de FBX.

## QA en ASUS antes de fusionar

1. Abrir cuerpo completo y elegir **Caminar en sitio** desde el segundo botón inferior: el personaje debe quedar centrado.
2. Elegir **Caminar hacia delante**: el cuerpo debe avanzar en profundidad, sin tapar la UI ni atravesar los aros.
3. Elegir **Caminar en círculo**: el cuerpo debe describir una órbita visible y rotar acompañando la trayectoria, volviendo al centro.
4. Comparar círculo y adelante con `&lumiaWalk=legacy` en una pestaña separada con **solo una instancia activa de micrófono**.
5. Probar los tres movimientos durante la demostración guiada, respetando su duración completa, y verificar que no alteran ojos, visemas ni voz.
6. Si alguna trayectoria resulta invertida o antinatural, ajustar primero sentido, radio o profundidad de la **coreografía**, nunca los FBX privados.
7. Si se requiere fidelidad exacta a la trayectoria original de Mixamo, estudiar la exportación real de los tres FBX y la conversión de root motion en una fase separada.

## Control de cambios

PH-04.8 se desarrolla sobre PH-04.7, protegido con PR borrador, sin modificar `main`. Certificación sintética `scripts/certify-lumia-ph048-walk-paths.ts` con Three.js `AnimationMixer` y regresión completa de fases anteriores.
