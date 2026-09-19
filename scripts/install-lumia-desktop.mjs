import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const startVbs = resolve(root, 'scripts', 'lumia-launcher.vbs')
const stopVbs = resolve(root, 'scripts', 'lumia-stop.vbs')

function psEscape(value) {
  return String(value).replace(/'/g, "''")
}

const script = [
  "$desktop=[Environment]::GetFolderPath('Desktop')",
  "$ws=New-Object -ComObject WScript.Shell",
  `$s=$ws.CreateShortcut((Join-Path $desktop 'L.U.M.I.A..lnk'))`,
  `$s.TargetPath=(Join-Path $env:WINDIR 'System32\\wscript.exe')`,
  `$s.Arguments='"'${psEscape(startVbs)}'"'`,
  `$s.WorkingDirectory='${psEscape(root)}'`,
  "$s.Description='Abrir L.U.M.I.A. y actualizar a la última versión disponible'",
  "$s.Save()",
  `$q=$ws.CreateShortcut((Join-Path $desktop 'Cerrar L.U.M.I.A..lnk'))`,
  `$q.TargetPath=(Join-Path $env:WINDIR 'System32\\wscript.exe')`,
  `$q.Arguments='"'${psEscape(stopVbs)}'"'`,
  `$q.WorkingDirectory='${psEscape(root)}'`,
  "$q.Description='Cerrar L.U.M.I.A.'",
  "$q.Save()",
].join('; ')

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
  {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  },
)

if (result.status !== 0) {
  console.error('No se pudieron crear los accesos directos.')
  console.error(String(result.stderr ?? '').trim())
  process.exit(result.status ?? 1)
}

console.log('')
console.log('Accesos directos creados en el Escritorio:')
console.log('  L.U.M.I.A.         -> actualiza, inicia y abre la interfaz')
console.log('  Cerrar L.U.M.I.A.  -> detiene el runtime iniciado por el acceso')
console.log('')
console.log('Desde ahora no necesitas abrir PowerShell para usar L.U.M.I.A.')
