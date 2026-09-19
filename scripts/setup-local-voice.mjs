/**
 * Windows-first local voice runtime bootstrap for O.R.B.I.A. / L.U.M.I.A.
 *
 * Installs only machine-local assets under .local-runtime/:
 *   - whisper.cpp prebuilt CPU runtime + ggml-base.bin
 *   - Python venv + kokoro-onnx + Spanish G2P dependencies
 *   - Kokoro v1.0 model + voices bundle
 *
 * Nothing in .local-runtime is committed.
 */

import { createWriteStream, existsSync } from 'node:fs'
import {
  copyFile,
  cp,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const runtimeRoot = resolve(root, '.local-runtime')
const whisperRoot = join(runtimeRoot, 'whisper.cpp')
const whisperBin = join(whisperRoot, 'bin', 'Release')
const whisperModels = join(whisperRoot, 'models')
const kokoroRoot = join(runtimeRoot, 'kokoro')
const kokoroModels = join(kokoroRoot, 'models')
const kokoroVenv = join(kokoroRoot, '.venv')

const WHISPER_VERSION = process.env.ORBIA_WHISPER_VERSION?.trim() || 'v1.9.4'
const WHISPER_MODEL_URL =
  process.env.ORBIA_WHISPER_MODEL_URL?.trim() ||
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const KOKORO_MODEL_URL =
  process.env.ORBIA_KOKORO_MODEL_URL?.trim() ||
  'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx'
const KOKORO_VOICES_URL =
  process.env.ORBIA_KOKORO_VOICES_URL?.trim() ||
  'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin'

const args = new Set(process.argv.slice(2))
const whisperOnly = args.has('--whisper-only')
const kokoroOnly = args.has('--kokoro-only')
const force = args.has('--force')

if (whisperOnly && kokoroOnly) {
  throw new Error('Choose either --whisper-only or --kokoro-only, not both.')
}

const wantWhisper = !kokoroOnly
const wantKokoro = !whisperOnly

const info = (message = '') => console.log(`[voice-setup] ${message}`)

async function download(url, target, minimumBytes = 1) {
  if (!force && existsSync(target)) {
    const current = await stat(target)
    if (current.size >= minimumBytes) {
      info(`already present: ${target}`)
      return
    }
  }

  await mkdir(dirname(target), { recursive: true })
  const partial = `${target}.partial`
  await rm(partial, { force: true })

  info(`downloading ${basename(target)}...`)
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'orbia-lumia-local-voice-setup' },
  })
  if (!response.ok || !response.body) {
    throw new Error(
      `Download failed (${response.status}) for ${url}`,
    )
  }

  await pipeline(response.body, createWriteStream(partial))
  const size = (await stat(partial)).size
  if (size < minimumBytes) {
    await rm(partial, { force: true })
    throw new Error(
      `Downloaded file is unexpectedly small: ${basename(target)} (${size} bytes)`,
    )
  }

  await rm(target, { force: true })
  await rename(partial, target)
  info(`ready: ${target} (${Math.round(size / 1024 / 1024)} MB)`)
}

async function findFile(directory, name) {
  if (!existsSync(directory)) return null
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return path
    }
    if (entry.isDirectory()) {
      const nested = await findFile(path, name)
      if (nested) return nested
    }
  }
  return null
}

async function readWhisperRelease(tag) {
  const releaseUrl =
    `https://api.github.com/repos/ggml-org/whisper.cpp/releases/tags/${tag}`
  const response = await fetch(releaseUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'orbia-lumia-local-voice-setup',
    },
  })
  if (!response.ok) {
    throw new Error(
      `Could not read whisper.cpp release ${tag} (HTTP ${response.status}).`,
    )
  }
  return response.json()
}

function selectWhisperWindowsCpuAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : []

  return (
    assets.find((asset) =>
      /^whisper-bin-x64\.zip$/i.test(String(asset?.name ?? '')),
    ) ??
    assets.find((asset) =>
      /^whisper-bin-win-(?:cpu-)?x64\.zip$/i.test(String(asset?.name ?? '')),
    ) ??
    assets.find((asset) => {
      const name = String(asset?.name ?? '').toLowerCase()
      return (
        name.endsWith('.zip') &&
        name.includes('whisper-bin') &&
        name.includes('x64') &&
        !name.includes('cuda') &&
        !name.includes('cublas') &&
        !name.includes('vulkan') &&
        !name.includes('openvino') &&
        !name.includes('arm') &&
        !name.includes('win32')
      )
    })
  )
}

function nightlyTagFromRelease(release) {
  const body = String(release?.body ?? '')
  return (
    body.match(/\*\*Nightly build:\*\*\s*\[(b\d+)\]/i)?.[1] ??
    body.match(/releases\/tag\/(b\d+)/i)?.[1] ??
    null
  )
}

async function fetchWhisperAsset() {
  const stable = await readWhisperRelease(WHISPER_VERSION)
  let source = stable
  let sourceTag = WHISPER_VERSION
  let preferred = selectWhisperWindowsCpuAsset(stable)

  // whisper.cpp stable releases can be source-only. Their release notes point
  // at the matching nightly build, which carries the prebuilt Windows binaries.
  if (!preferred) {
    const nightlyTag = nightlyTagFromRelease(stable)
    if (nightlyTag) {
      info(
        `stable ${WHISPER_VERSION} has no Windows binaries; using matching nightly ${nightlyTag}`,
      )
      source = await readWhisperRelease(nightlyTag)
      sourceTag = nightlyTag
      preferred = selectWhisperWindowsCpuAsset(source)
    }
  }

  if (!preferred?.browser_download_url) {
    const assets = Array.isArray(source?.assets) ? source.assets : []
    const names = assets.map((asset) => asset?.name).filter(Boolean).join(', ')
    throw new Error(
      `No CPU x64 whisper.cpp Windows asset found for ${sourceTag}. Assets: ${names || 'none'}`,
    )
  }

  return {
    name: preferred.name,
    url: preferred.browser_download_url,
    sourceTag,
  }
}

function powershell(args) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args],
    { stdio: 'inherit', windowsHide: true },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`PowerShell failed with exit code ${result.status}.`)
  }
}

async function installWhisperRuntime() {
  const exe = join(whisperBin, 'whisper-cli.exe')
  if (!force && existsSync(exe)) {
    info(`already present: ${exe}`)
    return
  }

  const asset = await fetchWhisperAsset()
  const tempDir = join(tmpdir(), `orbia-whisper-${process.pid}-${Date.now()}`)
  const zip = join(tempDir, asset.name)
  const extracted = join(tempDir, 'expanded')

  await mkdir(extracted, { recursive: true })
  try {
    await download(asset.url, zip, 1024 * 1024)
    powershell([
      '-Command',
      `Expand-Archive -LiteralPath '${zip.replaceAll("'", "''")}' -DestinationPath '${extracted.replaceAll("'", "''")}' -Force`,
    ])

    const sourceExe = await findFile(extracted, 'whisper-cli.exe')
    if (!sourceExe) {
      throw new Error(
        `whisper-cli.exe was not found inside ${asset.name}.`,
      )
    }

    await rm(whisperBin, { recursive: true, force: true })
    await mkdir(whisperBin, { recursive: true })
    await cp(dirname(sourceExe), whisperBin, {
      recursive: true,
      force: true,
    })

    if (!existsSync(join(whisperBin, 'whisper-cli.exe'))) {
      // Defensive copy in case the archive layout is unusual.
      await copyFile(sourceExe, join(whisperBin, 'whisper-cli.exe'))
    }
    info(`Whisper runtime ready: ${join(whisperBin, 'whisper-cli.exe')}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function pythonLauncher() {
  const candidates = [
    { command: 'py', args: ['-3.13'] },
    { command: 'py', args: ['-3.12'] },
    { command: 'py', args: ['-3.11'] },
    { command: 'py', args: ['-3.10'] },
    { command: 'python', args: [] },
    { command: 'python3', args: [] },
  ]

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.command,
      [
        ...candidate.args,
        '-c',
        'import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] < (3, 14) else 1)',
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    if (probe.status === 0) {
      return candidate
    }
  }
  return null
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} exited with code ${code}.`))
    })
  })
}

async function verifyKokoroSynthesis(venvPython) {
  const adapter = resolve(root, 'bridge', 'runtime', 'kokoro', 'synthesize.py')
  const tempDir = join(tmpdir(), `orbia-kokoro-smoke-${process.pid}-${Date.now()}`)
  const output = join(tempDir, 'lumia-smoke.wav')

  await mkdir(tempDir, { recursive: true })
  try {
    info('verifying Kokoro with a real Spanish synthesis...')

    const result = await new Promise((resolvePromise, reject) => {
      const child = spawn(venvPython, [adapter], {
        cwd: root,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk)
        if (stdout.length > 16_384) stdout = stdout.slice(-16_384)
      })
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk)
        if (stderr.length > 16_384) stderr = stderr.slice(-16_384)
      })

      child.once('error', reject)
      child.once('exit', (code) => {
        resolvePromise({ code, stdout, stderr })
      })

      child.stdin.end(
        JSON.stringify({
          text: 'Hola. Soy Lumia. La voz local está preparada.',
          outputPath: output,
          speaker: 'ef_dora',
        }),
      )
    })

    if (result.code !== 0) {
      throw new Error(
        `Kokoro synthesis smoke test failed. ${String(result.stderr || result.stdout).trim()}`,
      )
    }

    const wav = await stat(output).catch(() => null)
    if (!wav || wav.size <= 44) {
      throw new Error('Kokoro synthesis smoke test did not produce a valid WAV file.')
    }

    info(`Kokoro synthesis verified: ${Math.round(wav.size / 1024)} KB WAV`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function installKokoro() {
  const launcher = pythonLauncher()
  if (!launcher) {
    throw new Error(
      'Python 3.10-3.13 was not found. Install Python first, then rerun npm run voice:setup:kokoro.',
    )
  }

  await mkdir(kokoroRoot, { recursive: true })
  await mkdir(kokoroModels, { recursive: true })

  const venvPython = join(kokoroVenv, 'Scripts', 'python.exe')
  if (force || !existsSync(venvPython)) {
    info('creating Kokoro Python virtual environment...')
    await rm(kokoroVenv, { recursive: true, force: true })
    await run(launcher.command, [
      ...launcher.args,
      '-m',
      'venv',
      kokoroVenv,
    ])
  }

  info('installing/updating Kokoro local Python dependencies...')
  await run(venvPython, [
    '-m',
    'pip',
    'install',
    '--upgrade',
    'pip',
  ])
  await run(venvPython, [
    '-m',
    'pip',
    'install',
    '--upgrade',
    'kokoro-onnx',
    'soundfile',
    'misaki-fork[en]',
  ])

  await download(
    KOKORO_MODEL_URL,
    join(kokoroModels, 'kokoro-v1.0.onnx'),
    250 * 1024 * 1024,
  )
  await download(
    KOKORO_VOICES_URL,
    join(kokoroModels, 'voices-v1.0.bin'),
    20 * 1024 * 1024,
  )

  await verifyKokoroSynthesis(venvPython)
  info(`Kokoro runtime ready: ${venvPython}`)
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error(
      'This bootstrap is currently certified for Windows only. The runtime adapters themselves remain provider-neutral.',
    )
  }

  await mkdir(runtimeRoot, { recursive: true })

  if (wantWhisper) {
    await installWhisperRuntime()
    await download(
      WHISPER_MODEL_URL,
      join(whisperModels, 'ggml-base.bin'),
      100 * 1024 * 1024,
    )
  }

  if (wantKokoro) {
    await installKokoro()
  }

  info('')
  info('Local voice bootstrap completed.')
  info('Next: npm run voice:doctor')
  info('Then: npm run certify:voice')
}

main().catch((error) => {
  console.error('[voice-setup] FAILED:', error?.message ?? error)
  process.exitCode = 1
})
