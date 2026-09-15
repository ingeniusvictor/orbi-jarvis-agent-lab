import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store'

/**
 * O.R.B.I.A. / L.U.M.I.A. start-up sequence.
 *
 * This replaces the inherited JARVIS / armour presentation with an identity
 * native to ORBI Ecosystem:
 *
 *   1. O.R.B.I.A. core systems come online;
 *   2. the six ORBI domains resolve around the core as an orbital network;
 *   3. L.U.M.I.A. resolves as the intelligent companion;
 *   4. the ORBI core synchronises with L.U.M.I.A. and hands off to the live
 *      holographic interface.
 *
 * The timing remains compatible with App.tsx's existing ~9.2 s boot window.
 */

const T = { network: 2600, lumia: 5200, handoff: 7200 }

const LOG = [
  'ORBI ECOSYSTEM ................ ONLINE',
  'NÚCLEO O.R.B.I.A. ............. ONLINE',
  'IA LOCAL / OLLAMA ............. ONLINE',
  'VOZ Y ESCUCHA ................. ONLINE',
  'VISIÓN ........................ STANDBY',
  'MEMORIA ....................... STANDBY',
  'HERRAMIENTAS .................. BLOQUEADAS',
  'COMPANION L.U.M.I.A. .......... READY',
]

type Stage = 'bar' | 'network' | 'lumia' | 'handoff'

const DOMAINS = [
  { label: 'IA', x: 0, y: -112 },
  { label: 'ACADEMY', x: 98, y: -56 },
  { label: 'FV', x: 98, y: 56 },
  { label: 'HOME', x: 0, y: 112 },
  { label: 'SLEEP', x: -98, y: 56 },
  { label: 'MEDIA', x: -98, y: -56 },
]

export function Boot() {
  const phase = useStore((s) => s.phase)
  const reduced = useReducedMotion()
  const [t, setT] = useState(0)

  useEffect(() => {
    if (phase !== 'boot') {
      setT(0)
      return
    }

    const start = Date.now()
    setT(0)
    const id = setInterval(() => setT(Date.now() - start), 50)
    return () => clearInterval(id)
  }, [phase])

  if (phase !== 'boot') return null

  const stage: Stage =
    t >= T.handoff
      ? 'handoff'
      : t >= T.lumia
        ? 'lumia'
        : t >= T.network
          ? 'network'
          : 'bar'

  const logShown = Math.min(LOG.length, Math.floor((t / T.network) * (LOG.length + 1)))
  const barPct = Math.min(1, t / (T.network - 300))

  return (
    <AnimatePresence>
      <motion.div
        className="boot boot-orbi"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.8 }}
      >
        <div className={`boot-bar ${stage !== 'bar' ? 'boot-bar-dim' : ''}`}>
          <div className="boot-orbi-kicker">ORBI ECOSYSTEM · INTELLIGENCE LAYER</div>
          <div className="boot-bar-frame">
            <span className="boot-bar-title">
              INICIANDO O.R.B.I.A.<span className="boot-dots">…</span>
              <span className="boot-cursor" />
            </span>
            <div className="boot-seg">
              {Array.from({ length: 22 }, (_, i) => (
                <span
                  key={i}
                  className="boot-seg-cell"
                  data-on={i / 22 < barPct ? '1' : '0'}
                />
              ))}
            </div>
          </div>

          <div className="boot-log">
            {LOG.slice(0, logShown).map((line) => (
              <div key={line} className="boot-log-line">
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="boot-stage">
          {stage === 'network' && <OrbiNetwork reduced={!!reduced} />}
          {stage === 'lumia' && <LumiaResolve reduced={!!reduced} />}
          {stage === 'handoff' && (
            <OrbiHandoff reduced={!!reduced} t={t - T.handoff} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function OrbiNetwork({ reduced }: { reduced: boolean }) {
  return (
    <svg className="boot-orbi-network" viewBox="-180 -180 360 360">
      <motion.circle
        className="boot-orbi-orbit boot-orbi-orbit-outer"
        cx="0"
        cy="0"
        r="138"
        strokeDasharray="3 8"
        initial={reduced ? { opacity: 1 } : { opacity: 0, rotate: -24 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.8 }}
      />
      <motion.circle
        className="boot-orbi-orbit"
        cx="0"
        cy="0"
        r="112"
        strokeDasharray="44 12 8 12"
        initial={reduced ? { opacity: 1 } : { opacity: 0, rotate: 30 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.9, delay: 0.08 }}
      />
      <motion.circle
        className="boot-orbi-core-ring"
        cx="0"
        cy="0"
        r="53"
        initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />

      {DOMAINS.map((domain, i) => (
        <motion.g
          key={domain.label}
          initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.22 + i * 0.08 }}
        >
          <line
            className="boot-orbi-link"
            x1="0"
            y1="0"
            x2={domain.x}
            y2={domain.y}
          />
          <circle
            className="boot-orbi-node"
            cx={domain.x}
            cy={domain.y}
            r="7"
          />
          <text
            className="boot-orbi-domain"
            x={domain.x}
            y={domain.y + (domain.y < -80 ? -16 : domain.y > 80 ? 23 : 4)}
            textAnchor="middle"
          >
            {domain.label}
          </text>
        </motion.g>
      ))}

      <motion.text
        className="boot-orbi-core-name"
        x="0"
        y="-4"
        textAnchor="middle"
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.45 }}
      >
        O.R.B.I.A.
      </motion.text>
      <motion.text
        className="boot-orbi-core-sub"
        x="0"
        y="15"
        textAnchor="middle"
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 0.72 }}
        transition={{ duration: 0.5, delay: 0.55 }}
      >
        CORE
      </motion.text>
    </svg>
  )
}

function LumiaResolve({ reduced }: { reduced: boolean }) {
  return (
    <svg className="boot-lumia-resolve" viewBox="-180 -180 360 360">
      <motion.circle
        className="boot-orbi-orbit boot-orbi-orbit-outer"
        cx="0"
        cy="0"
        r="145"
        strokeDasharray="2 9"
        initial={reduced ? { opacity: 1 } : { opacity: 0, rotate: -18 }}
        animate={{ opacity: 0.68, rotate: 0 }}
        transition={{ duration: 0.7 }}
      />
      <motion.circle
        className="boot-orbi-orbit"
        cx="0"
        cy="0"
        r="118"
        strokeDasharray="36 10 5 10"
        initial={reduced ? { opacity: 1 } : { opacity: 0, rotate: 20 }}
        animate={{ opacity: 0.8, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.08 }}
      />

      <motion.g
        className="boot-lumia-glyph"
        initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.78 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <path
          className="boot-lumia-line"
          d="M0,-76 L0,-98 M0,-98 C0,-110 12,-110 12,-98"
        />
        <circle className="boot-lumia-line" cx="0" cy="-101" r="5" />
        <rect
          className="boot-lumia-line"
          x="-66"
          y="-64"
          width="132"
          height="116"
          rx="50"
        />
        <ellipse className="boot-lumia-eye" cx="-28" cy="-18" rx="11" ry="18" />
        <ellipse className="boot-lumia-eye" cx="28" cy="-18" rx="11" ry="18" />
        <path className="boot-lumia-smile" d="M-18,17 Q0,34 18,17" />
        <circle className="boot-lumia-side" cx="-72" cy="-5" r="14" />
        <circle className="boot-lumia-side" cx="72" cy="-5" r="14" />
      </motion.g>

      <motion.text
        className="boot-lumia-name"
        x="0"
        y="102"
        textAnchor="middle"
        initial={reduced ? { opacity: 1 } : { opacity: 0, letterSpacing: '1.2em' }}
        animate={{ opacity: 1, letterSpacing: '0.38em' }}
        transition={{ duration: 0.7, delay: 0.35 }}
      >
        L.U.M.I.A.
      </motion.text>
      <motion.text
        className="boot-lumia-sub"
        x="0"
        y="124"
        textAnchor="middle"
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 0.72 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        INTELLIGENT COMPANION
      </motion.text>
    </svg>
  )
}

function OrbiHandoff({ reduced, t }: { reduced: boolean; t: number }) {
  const glow = reduced ? 1 : Math.min(1, Math.max(0, t / 1300))
  const segments = Array.from({ length: 24 }, (_, i) => i)

  return (
    <svg
      className="boot-orbi-handoff"
      viewBox="-160 -160 320 320"
      style={{ ['--glow' as string]: glow }}
    >
      {segments.map((i) => {
        const a = (i / segments.length) * Math.PI * 2 - Math.PI / 2
        const on = i / segments.length < glow * 1.04
        return (
          <line
            key={i}
            x1={Math.cos(a) * 112}
            y1={Math.sin(a) * 112}
            x2={Math.cos(a) * 137}
            y2={Math.sin(a) * 137}
            className={on ? 'boot-orbi-seg boot-orbi-seg-on' : 'boot-orbi-seg'}
          />
        )
      })}

      <circle className="boot-orbi-sync-ring boot-orbi-sync-ring-a" cx="0" cy="0" r="101" />
      <circle className="boot-orbi-sync-ring boot-orbi-sync-ring-b" cx="0" cy="0" r="72" />
      <circle className="boot-orbi-sync-core" cx="0" cy="0" r="45" />

      <path
        className="boot-orbi-sync-mark"
        d="M-28,0 C-16,-22 16,-22 28,0 C16,22 -16,22 -28,0 Z"
      />
      <circle className="boot-orbi-sync-dot" cx="0" cy="0" r="6" />

      <text className="boot-orbi-sync-title" x="0" y="-8" textAnchor="middle">
        O.R.B.I.A.
      </text>
      <text className="boot-orbi-sync-sub" x="0" y="20" textAnchor="middle">
        L.U.M.I.A. LINK
      </text>
      <text className="boot-orbi-ready" x="0" y="151" textAnchor="middle">
        SISTEMA LISTO
      </text>
    </svg>
  )
}
