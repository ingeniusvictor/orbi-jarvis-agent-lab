# L.U.M.I.A. VL-02 — Voice latency diagnostics and guarded follow-ups

Canonical baseline: feature/lumia-voice-first-audio-v1 (draft PR #13).
Work branch: feature/lumia-voice-latency-vl02.
Status: pull-request implementation, NOT deployed; hardware certification pending.

## Problem and known sources of latency

Voice currently flows through endpointing → STT → transcript assembly → LLM
→ first speech chunk → TTS playback → an after-speech echo hold. VL-01
optimizes the first spoken chunk. VL-02 makes the pre-response stages measurable
and provides an **opt-in** test of a conservative shorter post-speech echo hold.

The source contains:
- local VAD silence window: 650 ms;
- browser recognition silence window: 1200 ms;
- browser sentence assembly settle time: 300 ms;
- original post-TTS guard: 2600 ms;
- TTS echo-tail reference: 1800 ms.

These are configuration/code constants, NOT measurements on the owner's PC.

## VL-02 implementation

1. src/lib/voice.ts records **STT conversion + request** in milliseconds for the
   local/cloud VAD path. Chrome's browser recognition does not publish an
   equivalent trustworthy per-request duration, so display unavailable there.
2. The turn assembler records **actual hold since its most recently accepted
   transcript segment** until command dispatch. This is NOT the entire time
   from physical speech end to dispatch when the STT engine is still decoding.
3. Existing Diagnostics (D key) displays those counters, provider mode, and the
   actual selected post-speech hold. The misleading legacy "STT latency" row
   previously used for browser idleness is replaced, not repurposed.
4. src/lib/followup-latency.ts defines a pure policy:
   - no opt-in: 2600 ms, unchanged;
   - browser or non-Whisper provider: 2600 ms, unchanged;
   - opt-in + verified Whisper local route: 2050 ms with the current
     1800 ms speaker echo-tail plus 250 ms safety margin;
   - a longer configured tail increases the hold, never shortens it further;
   - invalid tail values fail closed to 2600 ms.
5. The engine observes the canonical ECHO_TAIL_MS exported by TTS. No microphone,
   provider, Voice Gate, speaker verification, permission, or capture changes.

## Experimental activation (Windows workstation ONLY)

Do not turn on until the current normal pipeline is benchmarked and manual
interrupt/echo tests succeed.

    VITE_LUMIA_FAST_LOCAL_FOLLOWUP=1

Use only in the workstation's private .env.local configuration for an opt-in
test; do not store credentials or private recordings in Git. Restart the
frontend build/dev process after changing a Vite variable.

This flag does nothing for browser recognition and cannot enable any write or
identity capability. It is not a path to bypass voice authentication.

## Contract/CI certification

    npx tsx scripts/certify-lumia-voice-latency-vl02.ts
    npx tsx scripts/certify-first-audio-chunk.ts
    npm run certify:brain
    npm run certify:voice-gate
    npm run build
    npm run lint

The pull-request gate now includes both voice latency certifications.
These checks certify only the deterministic policies and compilation.

## Local hardware benchmark (required before merge/deployment)

For each mode separately (Chrome browser STT, local Whisper STT), collect at
least 10 short/medium questions and 10 interruption/follow-up trials using
the Diagnostics D panel:
- STT conversion/request latency when applicable;
- assembly hold;
- first model text time;
- first audible word time;
- selected post-speech protection;
- audible and recognized echo loops;
- missing/duplicated fragments, false barges and unwanted background speech.

Compare median and p95, and do not certify based on a single good example.
Record latency and quality separately; never store raw voice or transcripts
in benchmark artifacts without informed consent.

For local Whisper, benchmark the default guard BEFORE testing opt-in mode.
Rollback the opt-in if it creates self-hearing, household capture, missed
follow-ups or confusing restarts.

## Next

VL-03: adaptive end-of-turn detection instead of fixed silence thresholds,
with separate browser/Whisper safety tests.

VL-04: streaming real audio playback instead of waiting for entire synthesized
MP3/WAV download.

VL-05: optional realtime bidirectional audio provider with controlled
session budgets, fallback and strict privacy/security gates.

A future VL-03/VL-04 merge must preserve the active LUMIA Voice Gate branch,
and this PR must not be mistaken for already-live, subsecond full duplex.
