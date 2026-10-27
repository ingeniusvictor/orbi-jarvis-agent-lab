# L.U.M.I.A. VL-04 — Progressive MP3 streaming (controlled pilot)

Source repository: ingeniusvictor/orbi-jarvis-agent-lab
Work branch: feature/lumia-voice-streaming-vl04
Parent: feature/lumia-voice-adaptive-turns-vl03 (PR #15)

## Goal

Reduce first-sound latency for ElevenLabs TTS on the local bridge. The existing
Node /tts endpoint already streams audio/mpeg from its upstream provider, but
the browser was awaiting res.blob() before creating an Audio element. This
erased the benefit of server-side chunked delivery. VL-04 optionally bridges
the response ReadableStream into a Media Source Extensions (MSE) SourceBuffer,
so an HTMLAudioElement can start playing with only the first available chunks.

This is not native speech-to-speech, and text recognition/model latency remain.

## Deployment posture

**EXPERIMENTAL AND OFF BY DEFAULT**. No production rollout, auto-merge or
voice-profile change is performed by this PR.

Activation on a controlled local Windows test only, in a PRIVATE frontend
.env.local:

    VITE_LUMIA_STREAMING_TTS=1

Restart the frontend after setting the variable. Removal or any value other
than the exact string "1" restores buffered playback. Do not enable VL-02
fast-followups or VL-03 adaptive turns simultaneously during initial testing:
establish a clean single-variable comparison.

## Scope

- Only ElevenLabs audio served via the existing bridge POST /tts endpoint
  attempts MSE streaming, when opted in.
- Verify MediaSource and MediaSource.isTypeSupported('audio/mpeg') and a real
  audio/mpeg response with a readable body before enabling it.
- Browsers without MSE MPEG support keep the EXISTING full-Blob path.
- Local Kokoro, system/browser SpeechSynthesis and existing custom fallback
  playback retain their old transport.
- Sequential SourceBuffer.appendBuffer calls; wait for updateend before
  adding the next fragment to obey MSE backpressure.
- Stream reading starts when the audio element attaches the media source;
  this retains the prefetch-one-sentence behavior without downloading an
  indefinite unplayed recording into memory.
- Per-sentence streamed data capped at 4 MiB; a media failure ends stream.
- Every Audio URL / MediaSource must be released on completion/cancel.
- Per-speaker AbortController cancels pending HTTP fetches if the assistant is
  interrupted. In-flight MSE streaming explicitly cancels its stream reader.
- Playback has an opening watchdog to prevent an unsupported/stuck stream from
  wedging the entire conversation.
- Diagnostics D shows MSE/legacy transport, streaming opt-in, chunk count and
  stream failures; no transcripts or actual voice samples are added.

MSE is not Baseline supported on all browsers. Type support detection is
necessary, and passing it alone does NOT prove hardware codec/decode behavior.

## Certification

The PR Gate executes:

    npx tsx scripts/certify-lumia-tts-stream-vl04.ts
    npx tsx scripts/certify-lumia-adaptive-turns-vl03.ts
    npx tsx scripts/certify-lumia-voice-latency-vl02.ts
    npx tsx scripts/certify-first-audio-chunk.ts
    npm run certify:brain
    npm run certify:voice-gate
    npm run build
    npm run lint

VL-04 uses fake MediaSource and SourceBuffer objects to test the transport
without capturing real microphones or calling ElevenLabs. These deterministic
tests DO NOT claim end-to-end actual playback or latency improvement.

## Workstation acceptance

Compare default OFF with experimental ON on the same Windows PC:
1. Confirm a configured ElevenLabs provider behind the bridge and that the
   chosen voice mode actually takes the ElevenLabs path.
2. Open Diagnostics with D; note "first audible word", "audio transport",
   "MP3 stream chunks" and "MP3 stream failures".
3. Run at least 10 identical short and medium prompts per mode, plus longer
   answers (keep server model, speaker, mic, room and network as stable as
   possible); calculate median and p95 for time to first audible word.
4. Force cancellation during an audio stream and during the next sentence
   prefetch. Verify immediate silence, zero unintended restarts, no audio
   playing after cancellation and no unusual network/memory growth.
5. Test absent network, bad audio response and browser with unsupported MPEG
   MSE; verify legacy fallback and no new privacy/authority controls.
6. Reject the experiment if cut-off words, popping, long pauses, ghost speech
   or false barge-ins appear.

## Next phase: VL-05

A provider-neutral, opt-in WebRTC realtime speech-to-speech architecture is
the next major jump in fluency. It needs consent, secure short-lived session
credentials, cost limits, voice identity boundaries, recovery, and the existing
tool/write-authority gates. Do not replace the local-first pipeline without a
separate audit and workstation benchmark.

Autonomy A1 is a parallel workstream and remains unaffected.
