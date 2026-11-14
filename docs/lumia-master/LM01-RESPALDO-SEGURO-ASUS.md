# LUMIA MASTER LM-01 — Protección real de la ASUS, sin cambiar el sistema

**Estado:** **respaldo físico PARCIAL en ASUS verificado por salida real del propietario (13-11-2026)**. Faltan copia externa, pesos de Ollama y runtimes externos; no es una imagen completa de LUMIA.
**Fecha:** 13-11-2026. **Código de referencia conocido:** `1580a5182eba540893e35e37065be77da4ed014c`.
**Rama de desarrollo documental:** `docs/lumia-master-audit-20261113` · PR #81 (borrador).
**Rama adicional de recuperación del código:** `recovery/lumia-asus-1580a51-20261113` apunta al SHA exacto. **NO contiene los activos privados.**

## 1. El fallo que motivó esta etapa

El propietario inició VI-04.1 en un nuevo worktree y vio el viejo avatar GLB, sin 17 movimientos. Este caso **no prueba pérdida de funcionalidad**: `.gitignore` excluye `public/models/lumia-motion/*.vrm` y `public/models/lumia-motion/clips/`, y el nuevo worktree no copia esos activos privados. `Scene.tsx` contiene un fallback automático a GLB cuando falla el VRM. La hipótesis principal es ausencia de activos en el laboratorio nuevo, aunque se debe verificar físicamente la ASUS y descartar una pestaña/servidor antiguo.

**Lección:** un commit GitHub o una rama nueva no equivale a instalación portable. LUMIA MASTER no puede promover una mejora si faltan VRM, 17 FBX, modelos locales o configuración verificada.

## 2. Herramienta LM-01

**Archivo:** [`scripts/lumia-master-protect.mjs`](../../scripts/lumia-master-protect.mjs). Node.js y Git local, sin npm, sin permisos de administrador.

| Modo | Operación | ¿Modifica LUMIA-ASUS? |
| --- | --- | --- |
| `--audit --source <carpeta>` | Lee HEAD/branch/estado limpio, lanzadores, presencia de 18 VRM/FBX, GLB y BlazeFace opcionales, directorio runtime y etiquetas Ollama | **NO** |
| `--backup --source <carpeta> --dest <carpeta-existente>` | Solo con HEAD EXACTO y estado limpio; guarda bundle Git de HEAD + VRM + 17 FBX + opcionales; SHA-256 de cada archivo y manifest; verifica antes de finalizar | **NO**; solo escribe en la carpeta externa indicada |
| `--verify --backup-dir <respaldo>` | Recalcula los 18 hashes obligatorios, opcionales y bundle; no permite rutas fuera de lista | **NO** |

**Garantías verificables:** no invoca cámara, micro, Qwen, Whisper ni Kokoro; no descarga ni sube imágenes; no hace `git checkout/reset/clean/pull`, no modifica `main` ni instala modelos. Se niega a respaldar una rama diferente, un árbol Git con cambios locales, o una fuente sin VRM + 17 FBX. No sobrescribe respaldos anteriores. Los recursos solo se copian a una carpeta nueva y se verifica SHA-256. Una copia incompleta queda marcada `.incomplete`, **nunca aprobada**.

**Seguridad de datos:** las copias VRM/FBX son privadas; los hashes y el manifest quedan **solo en el equipo**, no se publican. No enviar al chat modelos, VRM, audio, fotos, material biométrico ni manifest con ubicaciones privadas.

## 3. Orden de ejecución en ASUS

**Primero auditoría.** No instalar código en `LUMIA-ASUS`. El archivo LM-01 se descarga a una carpeta de herramientas separada y puedes leerlo antes de ejecutarlo. Usar un enlace **anclado a SHA del commit**, no a `main`; actualizar este documento con el SHA confirmado al terminar el CI.

```powershell
$original = Join-Path $env:USERPROFILE 'LUMIA-ASUS'
$herramientas = Join-Path $env:USERPROFILE 'LUMIA-MASTER-TOOLS'
New-Item -ItemType Directory -Force -Path $herramientas | Out-Null

# Versión de código LM-01 verificada en Windows y Ubuntu en GitHub Actions, commit 8f7163a.
$url = 'https://raw.githubusercontent.com/ingeniusvictor/orbi-jarvis-agent-lab/8f7163a8e0b05e297922191e61ac631ef09deb0d/scripts/lumia-master-protect.mjs'
$script = Join-Path $herramientas 'lumia-master-protect.mjs'
Invoke-WebRequest -Uri $url -OutFile $script
node $script --audit --source $original
```

El resultado debe indicar `expected_commit_match=true`, `clean_worktree=true`, `required_assets_present=18`, dos lanzadores presentes y la lista Ollama esperada (en la última sesión cuatro tags). **Si aparece cualquier valor distinto, detenerse y diagnosticar.** No se copiaron archivos ni se alteró la ASUS con `--audit`.

**Después, respaldo local solo si el doctor pasó y el propietario autoriza:** usar un destino **YA existente** fuera del repositorio. Un disco externo es preferible a una carpeta en el mismo SSD. Si por ahora el usuario no tiene disco externo, una carpeta separada bajo su perfil es un respaldo de emergencia parcial, **no protege contra daño/pérdida de la laptop**.

```powershell
$destino = Join-Path $env:USERPROFILE 'LUMIA-RESPALDOS'
New-Item -ItemType Directory -Force -Path $destino | Out-Null
$result = node $script --backup --source $original --dest $destino |
    ConvertFrom-Json
if (-not $result.ok) { throw 'No se certifico el respaldo.' }
node $script --verify --backup-dir $result.backup_directory
```

**No ejecutar si** el HEAD/estado cambió, la fuente no tiene los 18 activos o el destino no es ajeno al checkout; el script debe abortar por seguridad. Pegar en el chat solo `ok`, `assets_verified`, `commit` y `full_system_backup`, nunca contenidos o archivos privados.

## 4. Cobertura honesta: esto es un respaldo PARCIAL

**Sí protegido por LM-01:**
- Commit e historial Git accesible desde HEAD, mediante un `git bundle` verificable.
- **1 VRM privado + 17 FBX** referenciados por Motion R8, comprobados con SHA-256.
- GLB anterior y BlazeFace si están presentes como opcionales.
- Manifest del commit, rama, fechas, hashes, nombres de modelos Ollama instalados (no pesos).

**No protegido todavía por LM-01:**
- **Bytes/weights reales de Ollama**, custom Modelfiles y posibles ajustes no versionados.
- `.local-runtime`, pesos externos de Whisper/Kokoro, entornos Python, paquetes npm/node_modules, cachés.
- Archivos locales adicionales no versionados, otros VRM/FBX experimentales, bibliotecas Mint, datos de laboratorio de voz o visión, fotos, transcripciones o bóvedas DPAPI.
- Estado de una sesión en navegador, perfiles, llaves API, contraseñas, tokens, credenciales privadas.
- Configuraciones dependientes de Windows o controladores GPU.

**Próximo paso para respaldo completo:** inventariar estas rutas manualmente **sin imprimir secretos**, dimensionar el espacio, cifrar copia de datos privados, generar hashes y probar restauración en carpeta/usuario separado. No hacer respaldo masivo automático de datos sensibles o biométricos. Conservar una segunda copia física desconectada de la laptop.

## 5. QA física antes de promover MASTER

Con el **lanzador cotidiano ORIGINAL** `INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd`, sin ninguna cámara experimental en segundo plano:
- [ ] Arranque visible del VRM PH-04 (no GLB fallback); vistas rostro / medio cuerpo / cuerpo completo.
- [ ] Animaciones R8 verificadas visualmente con un ejemplo (no basta con contar 17 nombres).
- [ ] Qwen 2B responde a tres consultas y se verifica nombre del modelo activo; ninguna ejecución 4B automática.
- [ ] Whisper interpreta 3 comandos; Kokoro habla y sus pausas reales se anotan (no asumir latencia ideal).
- [ ] VQ-02 inventario Ollama, cambio a 2B y vista medio cuerpo sin confundir acciones.
- [ ] Foto autorizada, sin afirmar visión actual al utilizar captura anterior.
- [ ] Escritos OS/realtime OFF y consentimiento micro/cámara explícito.
- [ ] Cerrar, volver a abrir sin borrar modelos ni cambios de rama.

Un respaldo con 18 hashes PASS **no certifica audio, visión ni movimiento**. Un CI en GitHub tampoco. Registrar los resultados por separado.

## 6. Recuperación sin sobrescribir

El respaldo guarda `lumia-git-HEAD.bundle` (historia Git autocontenida) y `private-assets/` (lista de archivos verificados). En una recuperación futura, **nunca extraer directamente encima de `LUMIA-ASUS`**: verificar hashes, crear carpeta nueva, restaurar el commit desde bundle, colocar activos privados en rutas indicadas, instalar dependencias conocidas, verificar Ollama/Whisper/Kokoro y ejecutar QA física. No borrar la instalación actual hasta comprobar la restauración completa.

**Estado actual:** [CI final Windows y Ubuntu PASS](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43545422135) para LM-01 (SHA de código anclado `8f7163a`, suite final `7306873`). **ASUS LM-01: respaldo físico parcial PASS** (salida del propietario: `ok=true`, `assets_verified=19`, `required_verified=18`, `git_bundle_sha256_match=true`, commit `1580a5182eba540893e35e37065be77da4ed014c`, `original_modified=false`, `ollama_weights_backed_up=false`, `external_runtime_backed_up=false`, `is_full_system_backup=false`). La ruta privada del backup no fue compartida y no debe inventarse. Las pruebas PH-04/voz integradas y copia externa independiente **siguen pendientes**.
