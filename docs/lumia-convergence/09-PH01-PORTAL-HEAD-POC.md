# PH-01 — LUMIA Portal Head interactivo (experimento reversible)

**Estado:** primera implementación en rama feature; NO fusionada ni aprobada visualmente.

**Rama:** feat/lumia-ph01-portal-head-vrm del repositorio ingeniusvictor/orbi-jarvis-agent-lab, basada en feature/lumia-consolidated-release-20261028.

## Qué cambia
- Se conserva intacta la cara GLB legacy del portal; se añade `LumiaPortalHead.tsx` como ruta optativa.
- Selector por URL: `?lumiaAvatar=head-vrm` activa la cabeza VRM; `?lumiaAvatar=legacy` restaura el busto original. Alternativamente VITE_LUMIA_AVATAR_MODE=head-vrm.
- `GLTFLoader` existente procesa el VRM 0.x como glTF; un adaptador propio interpreta `extensions.VRM.humanoid` y `blendShapeMaster`. No necesita nuevas dependencias ni otro WebGL Canvas.
- Solo se muestran meshes Face/Hair; se conserva la jerarquía de huesos, el skin y los morph targets. El cuerpo NO se corta ni se modifica.
- Ojos siguen suavemente al puntero, cabeza/cuello inclinan con límites, hay parpadeo y expresión leve según estado.
- Visemas A/E/I/O/U se activan **solo durante TTS audible**. El texto de la frase activa alimenta un patrón vocálico **APROXIMADO**, no un reconocimiento fonético real. La precisión fonema-audio se abordará en PH-03.
- El asistente original, sus herramientas, puente, permisos, STT, TTS y lógica permanecen.
- Si falta el VRM o el loader falla, una barrera de error restaura el GLB, sin romper el portal.

## Requisito local y derechos
El repo es público: **NO subir VRM ni FBX**. Instalar el VRM aprobado desde el ZIP Motion R8 en:
`public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm`.
Ejemplo PowerShell desde la raíz del repo:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\INSTALAR_LUMIA_HEAD_PH01.ps1 -KitZip "C:\Users\TU_USUARIO\Downloads\LUMIA_VITA_NATURAL_V085_R8_NATURAL_CONVERSATION_KIT.zip"
```
El instalador confirma SHA-256 exacto antes de aceptar el archivo.

## Pasos de prueba
1. Confirmar que el proyecto local está limpio y la rama correcta descargada.
2. `npm ci` y `npm start` como en el proyecto original; observar consola.
3. Legacy: http://localhost:5173/?lumiaAvatar=legacy (sin cambios visuales).
4. Head: http://localhost:5173/?lumiaAvatar=head-vrm (requiere VRM local).
5. Sin activar IA/voz, observar parpadeo, ojos al mover puntero, cabeza.
6. Activar: escuchar, pensar, saludo y respuesta real; la boca debe moverse solo con reproducción audible.
7. Interrumpir varias veces durante TTS; comprobar que no queda la boca activa por evento viejo.
8. Probar 16:9 y 9:16 y verificar que el aro y los controles no quedan cubiertos.
9. Comparar rostro con R8 Motion y registrar si la luz, orientación o expresiones requieren correcciones; **no dar por validada la fidelidad hasta verla**.

## Límites conocidos de este POC
- GLTFLoader sin VRMLoaderPlugin: interpreta la geometría glTF y los metadatos esenciales del VRM0 pero **todavía no replica el shader MToon ni la física del cabello del runtime Motion**.
- El seguimiento de ojos es una implementación propia con huesos crudos, no el LookAt normalizado de three-vrm. Debe comprobarse orientación visual.
- La voz mueve visemas aproximados en función de frases habladas, no visemas fonéticos precisos.
- Este modo no importa FBX corporales ni afecta el compositor de baile.
- No sustituye definitivamente el GLB hasta superar QA en ASUS y obtener aprobación explícita.

## Rollback
`?lumiaAvatar=legacy` o eliminar la variable head-vrm y recargar. Código y GLB originales permanecen. No fusionar en main.
