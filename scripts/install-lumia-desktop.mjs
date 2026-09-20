import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const startVbs = resolve(root, 'scripts', 'lumia-launcher.vbs')
const stopVbs = resolve(root, 'scripts', 'lumia-stop.vbs')

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

const script = [
  "$ErrorActionPreference='Stop'",
  "$candidates=@()",
  "$shellDesktop=[Environment]::GetFolderPath('Desktop')",
  "if ($shellDesktop) { $candidates += $shellDesktop }",
  "if ($env:OneDrive) { $candidates += (Join-Path $env:OneDrive 'Desktop'); $candidates += (Join-Path $env:OneDrive 'Escritorio') }",
  "$candidates += (Join-Path $env:USERPROFILE 'Desktop')",
  "$candidates += (Join-Path $env:USERPROFILE 'Escritorio')",
  "$candidates = @($candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique)",
  "$desktop=$shellDesktop",
  "$existing=$null",
  "foreach ($candidate in $candidates) { $probe=Join-Path $candidate 'L.U.M.I.A..lnk'; if (Test-Path $probe) { $existing=$probe; break } }",
  "if ($existing) { $desktop=Split-Path -Parent $existing } elseif (-not $desktop -and $candidates.Count -gt 0) { $desktop=$candidates[0] }",
  "if (-not $desktop) { throw 'No se pudo resolver la carpeta Escritorio de Windows.' }",
  "$ws=New-Object -ComObject WScript.Shell",
  `$s=$ws.CreateShortcut((Join-Path $desktop 'L.U.M.I.A..lnk'))`,
  `$s.TargetPath=(Join-Path $env:WINDIR 'System32\\wscript.exe')`,
  `$s.Arguments=${psLiteral(`"${startVbs}"`)}`,
  `$s.WorkingDirectory=${psLiteral(root)}`,
  "$s.Description='Abrir L.U.M.I.A. y actualizar a la última versión disponible'",
  "$s.Save()",
  `$q=$ws.CreateShortcut((Join-Path $desktop 'Cerrar L.U.M.I.A..lnk'))`,
  `$q.TargetPath=(Join-Path $env:WINDIR 'System32\\wscript.exe')`,
  `$q.Arguments=${psLiteral(`"${stopVbs}"`)}`,
  `$q.WorkingDirectory=${psLiteral(root)}`,
  "$q.Description='Cerrar L.U.M.I.A. y detener su runtime local'",
  "$q.Save()",
  "Write-Output $desktop",
].join('; ')

const encodedCommand = Buffer.from(script, 'utf16le').toString('base64')

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
  {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  },
)

if (result.status !== 0) {
  console.error('No se pudieron crear los accesos directos.')
  const stderr = String(result.stderr ?? '').trim()
  const stdout = String(result.stdout ?? '').trim()
  if (stderr) console.error(stderr)
  if (stdout) console.error(stdout)
  process.exit(result.status ?? 1)
}

const desktop = String(result.stdout ?? '').trim()

console.log('')
console.log('Accesos directos creados:')
console.log('  L.U.M.I.A.         -> actualiza, inicia y abre la interfaz')
console.log('  Cerrar L.U.M.I.A.  -> detiene el runtime iniciado por el acceso')
if (desktop) console.log(`  Carpeta: ${desktop}`)
console.log('')
console.log('El acceso de cierre se crea junto al acceso de inicio existente cuando Windows usa un Escritorio redirigido.')
