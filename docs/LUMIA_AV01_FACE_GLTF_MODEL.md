# LUMIA AV-01 — Rostro 3D de LUMIA

## Qué se incorpora

Nuevo GLB aportado por el propietario: `LUMIA solo rostro(1).glb`,
reempacado como `lumia.glb` para sustituir el modelo clásico de la
interfaz, **sin alterar la malla ni las tres texturas**.

Datos verificados del archivo:
- glTF binario v2 válido; aproximadamente 4.13 MB.
- Una malla, 61.179 vértices, 102.074 triángulos.
- Tres imágenes JPEG incrustadas (albedo, normal y metallic/roughness).
- Coordenadas Y-up, altura de aprox. 1 unidad, centrado X/Z.
- Sin rig ni clips de animación (flotación, giro y respuesta al sonido
  conservadas por el componente React Three Fiber).

El reempaquetado incluye el marcador opcional
`nodes[0].extras.lumiaAvatarProfile = "face-v1"`. GLTFLoader lo expone
como `node.userData.lumiaAvatarProfile`.

## Cambios del código

`src/scene/LumiaAvatar.tsx` continúa leyendo EXACTAMENTE
`/models/lumia/lumia.glb`.

Si el archivo no tiene el marcador, LUMIA conserva el encuadre y la
iluminación históricos del robot original.

Si lo tiene, el rostro se encuadra centrado y un poco más grande para
ocupar el holograma, con menos emisión para conservar detalles faciales
de las texturas del GLB. No se alteran la voz, Whisper, Kokoro, el
cerebro, permisos, herramientas ni fases de LUMIA.

## Cómo instalar el archivo binario en el Windows del propietario

El GLB aportado en la conversación no está almacenado en GitHub:
la conexión de edición disponible permite escribir código, pero no
transferir directamente este archivo binario local de aproximadamente
4 MB. El GLB **anterior** tampoco se almacena en GitHub: la ruta local
original ya estaba documentada como un asset de ~17 MB no versionado.
Esta rama contiene solamente las adaptaciones compatibles con ambos
avatares; no reemplaza por sí sola los archivos de Windows.

Se entrega al propietario, aparte de GitHub, un ZIP con:
- `lumia.glb` — archivo binario con marcador AV-01.
- `INSTALAR_ROSTRO_LUMIA.cmd` — instalador local que hace respaldo.
- `LEEME_ROSTRO.txt` — explicación y reversión.

Procedimiento: extraer el ZIP completo, ejecutar el instalador local;
si no encuentra `C:\ORBI CODEX\orbi-jarvis-agent-lab`, proporcionar
la carpeta donde está instalado el proyecto. El script conserva el
modelo original en `local-asset-backups\lumia.pre-face.glb` y
sobrescribe únicamente `public\models\lumia\lumia.glb`, tras lo
cual se recarga Chrome con Ctrl+Shift+R.

Ambos GLB son activos locales, no versionados en este repositorio. Antes
de limpiar o reinstalar la carpeta local, conserva el rostro nuevo y el
respaldo. Los cambios de código de esta rama sí se versionan por Git.

Para revertir: restaurar el GLB respaldado en su ruta original
y recargar la pestaña. El componente AV-01 detectará la ausencia del
marcador y volverá a usar el perfil óptico clásico.

## Verificación pendiente

La compilación y las pruebas automáticas NO significan que la nueva
cara haya sido vista físicamente en la pantalla del propietario.
Después de instalar, comprobar desde `localhost:5173`:
- tamaño del rostro y encuadre dentro del anillo,
- cara vista frontalmente y texturas visibles,
- animación flotante y respuesta a audio,
- ausencia de errores GLTF/WebGL en consola,
- rendimiento del navegador y funcionamiento del asistente.
