/**
 * VF-02 local multivoice bootstrap (Windows).
 *
 * Installs an experimental sherpa-onnx-node runtime without changing the app
 * package manifest, plus the two official models used by the upstream Node
 * diarization example. Assets remain machine-local.
 */

import { createWriteStream, existsSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const runtimeRoot = resolve(root, '.local-runtime', 'diarization')
const segmentationRoot = join(runtimeRoot, 'segmentation')
const embeddingRoot = join(runtimeRoot, 'embedding')
const nodeRuntimeRoot = join(runtimeRoot, 'node-runtime')
const nodeRuntimePackage = join(nodeRuntimeRoot, 'package.json')

const SHERPA_VERSION =
  process.env.ORBIA_SHERPA_ONNX_VERSION?.trim() || '^1.13.8'

const SEGMENTATION_URL =
  process.env.ORBIA_DIARIZATION_SEGMENTATION_URL?.trim() ||
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2'

const EMBEDDING_URL =
  process.env.ORBIA_DIARIZATION_EMBEDDING_URL?.trim() ||
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx'

const force = process.argv.includes('--force')
const info = (message = '') => console.log(`[diarization-setup] ${message}`)

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
    headers: { 'user-agent': 'orbia-lumia-diarization-setup' },
  })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`)
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

function hasCommand(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  })
  return result.status === 0
}

async function installPackage() {
  const isolatedPackage = join(
    nodeRuntimeRoot,
    'node_modules',
    'sherpa-onnx-node',
    'package.json',
  )

  if (!force && existsSync(isolatedPackage)) {
    info('sherpa-onnx-node isolated runtime already present')
    return
  }

  await mkdir(nodeRuntimeRoot, { recursive: true })
  if (!existsSync(nodeRuntimePackage)) {
    await writeFile(
      nodeRuntimePackage,
      JSON.stringify(
        {
          name: 'orbia-lumia-diarization-runtime',
          private: true,
          version: '0.0.0',
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
  }

  info(`installing sherpa-onnx-node ${SHERPA_VERSION} in isolated runtime...`)

  // Spawning npm.cmd directly can fail with EINVAL on newer Windows/Node
  // combinations. npm exposes the actual JS entry point in npm_execpath when
  // this setup runs through "npm run", so launch that with node.exe.
  const npmCliCandidates = [
    process.env.npm_execpath?.trim(),
    resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean)
  const npmCli = npmCliCandidates.find((candidate) => existsSync(candidate))

  if (!npmCli) {
    throw new Error(
      'npm-cli.js could not be located. Run this installer with "npm run voice:setup:diarization".',
    )
  }

  info(`using npm runtime: ${npmCli}`)
  info(`isolated runtime: ${nodeRuntimeRoot}`)
  await run(
    process.execPath,
    [
      npmCli,
      'install',
      '--prefix',
      nodeRuntimeRoot,
      '--no-save',
      '--package-lock=false',
      '--legacy-peer-deps',
      `sherpa-onnx-node@${SHERPA_VERSION}`,
    ],
    { cwd: root },
  )
}

async function installSegmentationModel() {
  const target = join(segmentationRoot, 'model.onnx')
  if (!force && existsSync(target)) {
    info(`already present: ${target}`)
    return
  }

  if (process.platform === 'win32' && !hasCommand('tar.exe', ['--version'])) {
    throw new Error(
      'Windows tar.exe is required to extract the segmentation model archive.',
    )
  }

  const tempDir = join(
    tmpdir(),
    `orbia-diarization-${process.pid}-${Date.now()}`,
  )
  const archive = join(
    tempDir,
    'sherpa-onnx-pyannote-segmentation-3-0.tar.bz2',
  )
  const expanded = join(tempDir, 'expanded')

  await mkdir(expanded, { recursive: true })
  try {
    await download(SEGMENTATION_URL, archive, 1024 * 1024)

    await run(
      process.platform === 'win32' ? 'tar.exe' : 'tar',
      ['-xjf', archive, '-C', expanded],
    )

    const source = await findFile(expanded, 'model.onnx')
    if (!source) {
      throw new Error('model.onnx was not found in the segmentation archive.')
    }

    await mkdir(segmentationRoot, { recursive: true })
    await copyFile(source, target)
    info(`segmentation model ready: ${target}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function installEmbeddingModel() {
  const target = join(embeddingRoot, 'speaker-embedding.onnx')
  await download(EMBEDDING_URL, target, 20 * 1024 * 1024)
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error(
      'This bootstrap is currently certified for Windows only.',
    )
  }

  await mkdir(runtimeRoot, { recursive: true })
  await installPackage()
  await installSegmentationModel()
  await installEmbeddingModel()

  info('')
  info('Speaker diarization assets are installed.')
  info('Next: npm run voice:doctor')
  info('Then: npm run certify:diarization-adapter')
  info('Multivoice routing remains disabled until latency is benchmarked.')
}

main().catch((error) => {
  console.error('[diarization-setup] FAILED:', error?.message ?? error)
  process.exitCode = 1
})
