# PH-04 — LUMIA: tres vistas, presencia virtual consciente y acciones Motion R8

## Decisión física del usuario (3 noviembre 2026)
Las pruebas ASUS confirmaron que PH-03 mueve el cuerpo mediante los FBX Motion R8 y que el modo procedural es más estático. La vista inicial debe ser **medio cuerpo**, con el rostro más grande y centrado en los aros holográficos, sin sacrificar los movimientos naturales. Deben coexistir las vistas **solo rostro**, **medio cuerpo** y **cuerpo completo**.

## Comportamiento
- **Predeterminado ASUS:** `http://localhost:5173/` abre **medio cuerpo** (bust-vrm) mediante `VITE_LUMIA_AVATAR_PH04=1`, sin alterar otros perfiles o el GLB antiguo si PH-04 no está activado.
- Rostro: `/?lumiaAvatar=head-vrm`.
- Medio cuerpo: `/?lumiaAvatar=bust-vrm`.
- Cuerpo completo: `/?lumiaAvatar=body-vrm`.
- Procedural seguro: `/?lumiaAvatar=bust-vrm&lumiaR8=procedural`.
- Respaldo: `/?lumiaAvatar=legacy`.
- Botones discretos **ROSTRO / MEDIO / CUERPO**, con acceso mediante teclado; el modo seleccionado se refleja en la URL sin recargar React, navegador, micrófono ni conexión Ollama.
- Encuadre busto: centro facial 1.28 → 1.50, fracción de altura 0.70 → 0.82. Estos valores requieren QA óptica ASUS; no afectan el modelo original.

## Control natural por voz o texto
Solo se reconoce después de que el módulo de voz haya autorizado una intervención en `App.respond()`: la detección wake/guard, protección contra ruido del hogar, interrupciones y cola Kokoro siguen siendo las existentes.

| Frase | Resultado |
|---|---|
| «Lumi, cambia a vista solo rostro» | Presentación de cabeza |
| «Lumi, cambia a medio cuerpo» | Presentación principal |
| «Lumi, cambia a cuerpo completo» | Presentación completa |
| «Lumi, vuelve a la vista principal» | Medio cuerpo |
| «Lumi, ¿qué vistas tienes?» | Describe las tres vistas |
| «Lumi, ¿qué animaciones puedes hacer?» | Describe el catálogo original de 17 |
| «Lumi, haz un saludo» | Solicita Waving.fbx, en vista busto si corresponde |
| «Lumi, aplaude» | Solicita Clapping.fbx |
| «Lumi, haz un gesto de pensar» | Solicita Thinking.fbx |
| «Lumi, vuelve al modo natural» | Cede control nuevamente a Motion Intelligence |

Los comandos se interpretan con una lista blanca, no con la salida improvisada del modelo. Un gesto manual tiene prioridad temporal sobre la animación automática R8; después el compositor vuelve al movimiento conversacional. **La respuesta dice 'voy a intentar'**, no declara éxito del FBX antes de verificarlo. Si falta o falla el clip, Motion R8 conserva el movimiento procedural.

## Conciencia de capacidades
SKILL-01 registra `avatar-presence` en estado **experimental** cuando el piloto ASUS activa PH-04. Es capaz de describir un cuerpo virtual con tres vistas y 17 animaciones **catalogadas**. Ningún cambio habilita control general de escritorio, ejecución arbitraria, servicios meteorológicos ni memoria persistente. MEM-01 permanece pendiente.

## Seguridad y diseño
- Un único Canvas, sin `window.location.reload()` ni segundo servidor, STT o TTS.
- `?lumiaAvatar=legacy` mantiene la reversión visual.
- El código mantiene privados los VRM y 17 FBX; no se incorporan binarios al repositorio.
- La selección de una vista no requiere permiso de sistema operativo, archivos ni herramientas externas.
- PH-03 y PH-02, RC-04 y SKILL-01 no se reescriben.

## Validación
- CI debe aprobar `scripts/certify-lumia-avatar-presence-ph04.ts` y la matriz PH-03, PH-02, RC-04, SKILL-01, voz, build y lint.
- ASUS: comprobar pantalla inicial con busto y rostro centrado; probar botones y voz en las tres vistas, mirando si persisten anillos y HUD sin recarga.
- Probar saludo/aplauso/pensamiento y retorno natural, incluyendo interrupción de Kokoro y recuperación del diálogo. Confirmar visualmente que los FBX responden al comando y que la boca sigue sincronizada.
- El control gestual sobre el rig GLTF VRM0 es todavía experimental y debe validarse en ASUS antes de declarar éxito físico o fusionar PR.
