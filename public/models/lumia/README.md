# L.U.M.I.A. — Avatar facial AV-01B (2026-10-28)

El avatar aprobado es un **rostro/busto 3D** GLB 2.0 del usuario. El componente
`src/scene/LumiaAvatar.tsx` espera exactamente:

```text
public/models/lumia/lumia.glb
```

**Archivo certificado para incorporar:** 4.128.456 bytes.  
**SHA-256:**
`a1d48cb762fb00ecb2e89270ca7755b7ad7ac1e7e384e0cc21a796494418f56f`.

Metadatos: `nodes[0].extras.lumiaAvatarProfile = "face-v1"`.
La calibración visual ya está en código:
`FACE_HEIGHT_FRACTION=0.47` y `FACE_SHIFT_PX=25`.

## Comprobación de publicación

El GLB no se añade fingiendo un puntero Git LFS sin contenido real. La
transferencia **se habrá completado** cuando GitHub muestre el archivo binario
en esta rama y `node scripts/certify-lumia-avatar-asset.mjs` confirme su hash.

El archivo fue suministrado en el paquete de instalación Windows del
propietario y se distribuye con un script verificador independiente:

```text
scripts/PUBLICAR_ROSTRO_AV01B_EN_GITHUB.ps1
```

El script crea **un nuevo clon** de
`feature/lumia-consolidated-release-20261028`, valida el hash, fuerza
`git add` únicamente para la ruta GLB (porque está ignorada hasta
incorporarla) y hace commit/push solo sobre esa rama. No modifica `main`
ni los modelos GLB de las instalaciones actuales del propietario.

No se incluyen los binarios de Whisper, Kokoro, Ollama ni claves.

**Documentación:** `docs/LUMIA_CONSOLIDADO_2026-10-28.md`.
