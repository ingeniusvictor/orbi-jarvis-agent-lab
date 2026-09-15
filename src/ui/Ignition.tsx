import { useStore } from '../store'

/**
 * Cold-start gate for O.R.B.I.A.
 *
 * Browsers require a user gesture before audio and speech synthesis can start,
 * so the permission gesture is presented as an ORBI core activation rather
 * than as a generic browser prompt.
 */
export function Ignition({ onStart }: { onStart: () => void }) {
  const phase = useStore((s) => s.phase)
  if (phase !== 'offline') return null

  return (
    <button className="ignition ignition-orbi" onClick={onStart}>
      <span className="ignition-ring ignition-ring-outer" />
      <span className="ignition-ring ignition-ring-inner" />
      <span className="ignition-orbi-node ignition-orbi-node-a" />
      <span className="ignition-orbi-node ignition-orbi-node-b" />
      <span className="ignition-orbi-node ignition-orbi-node-c" />

      <span className="ignition-label">
        <span className="ignition-kicker">O.R.B.I.A. CORE</span>
        <span className="ignition-word">ACTIVAR L.U.M.I.A.</span>
        <span className="ignition-sub">haz clic o da una palmada para iniciar</span>
      </span>
    </button>
  )
}
