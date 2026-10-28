# L.U.M.I.A. VL-03 — Adaptive turn-taking (controlled pilot)

Repository: ingeniusvictor/orbi-jarvis-agent-lab
Branch: feature/lumia-voice-adaptive-turns-vl03
Direct parent: feature/lumia-voice-latency-vl02 (PR #14)
Status: code + deterministic certification; REAL WINDOWS HARDWARE TEST PENDING.

## Goal

Make L.U.M.I.A. respond more naturally to short replies while retaining its
ability to join thoughts separated by a natural pause. Improve local VAD
segmentation modestly without replacing browser SpeechRecognition, Whisper,
Voice Gate, the local-first brain, or native/Kokoro/ElevenLabs TTS.

This is NOT an end-to-end realtime duplex pipeline and does not claim to
match a commercial voice assistant's actual latency.

## Safety first: defaults

All new behavior is disabled by default.

To deliberately pilot on a controlled local Windows machine, set in the
private .env.local file (NEVER inside public source or a Git commit):

    VITE_LUMIA_ADAPTIVE_TURNS=1

Restart the Vite frontend and bridge as required by the workstation's current
setup after changing Vite build-time settings. Removing the variable or setting
it to anything but the string 1 restores the existing behavior. The preceding
VL-02 flag (VITE_LUMIA_FAST_LOCAL_FOLLOWUP) is a separate experiment; DO NOT
enable both flags during the initial baseline comparison.

## What changes after opt-in

1. TEXT: The existing makeAssembler receives a conservative decision object.
   The *normal* end-of-sentence handling, punctuation and quiet-gap safety
   rules remain. Isolated, fully endpointed acknowledgements such as "sí",
   "listo", "dale", "gracias", "continúa", or "de acuerdo" can be dispatched
   without an EXTRA 1600/2400 ms textual continuation hold.
2. TEXT: An unfinished trailing ellipsis is no longer treated as a full stop.
   It retains time for the next sentence fragment. Explicit dangling
   conjunctions and multipart utterances are not accelerated.
3. TEXT: Long, complete-looking single segments may reduce the remaining
   short assembler hold by up to 70 ms, never forcing an earlier dispatch
   while the STT engine itself is still listening or decoding.
4. ACOUSTIC: Only the local Whisper command VAD may use a variable quiet
   window, based on voiced duration (not a speaker-identity signal):
   - <800 ms: 780 ms quiet window protects short words.
   - 800–2499 ms: 650 ms, unchanged.
   - >=2500 ms: 580 ms, modestly faster handoff.
   - Any guard/echo phase: 650 ms, unchanged.
5. Browser SpeechRecognition and cloud STT keep their existing segmentation
   windows. They receive ONLY the optional text-assembler adaptation after
   their own endpointing.
6. The diagnostics panel (key D) shows whether adaptation is enabled,
   the last local VAD silence threshold used, and the last text-hold reason.

### Why no aggressive shortening?

A too-fast voice detector clips questions, misreads breaks for thinking,
duplicates Whisper segments, or causes household speech / TV / L.U.M.I.A.'s
own TTS output to get turned into commands. The current Voice Gate
monitor/enforce state, speaker verification, anti-replay, echo shield,
permissions, microphone lifecycle and existing interrupt behavior remain
separate sources of authority.

## How to verify

Run repository certification (CI contract):

    npx tsx scripts/certify-lumia-adaptive-turns-vl03.ts
    npx tsx scripts/certify-first-audio-chunk.ts
    npx tsx scripts/certify-lumia-voice-latency-vl02.ts
    npm run certify:brain
    npm run certify:voice-gate
    npm run build
    npm run lint

Physical workstation assessment: compare default vs opt-in after at least
10 trials per local/browser STT mode. Include examples:
- "sí", "listo", "continúa" as complete turns;
- "sí, pero mañana ..." and "necesito que revises el ..." as partial thoughts;
- deliberate 300–900 ms mid-sentence hesitation;
- a lengthy request with several clauses;
- a child, another household speaker, TV, and TTS self-echo while LUMIA
  replies (no command must be executed based solely on voice resemblance);
- deliberate barge-in with "Lumi, para" and echo guard after TTS;
- short answer followed by immediate next request.

Measure first audible word, STT round trip (local only), assembler hold,
number of duplicated/split commands, and false interruptions. Test sequentially
with VL-02's optional local follow-up guard still disabled.

Do not save private recordings or household transcripts to GitHub.
CI contract PASS cannot prove microphone or speaker behavior on Windows.

## Next after VL-03

VL-04 should stream synthesized audio progressively, avoiding a full MP3/WAV
download before playback, and measure actual first sound.

VL-05 is an opt-in provider-neutral bidirectional low-latency audio service
with bounded sessions, a fallback to local-first, cost controls and robust
consent/interruption/echo handling; it needs separate design and approval.

Autonomy A1 remains a separate, still-unmerged workstream.
