# L.U.M.I.A. Kids — Language Companion

## Status

**CANONICAL DEFERRED SUBPROJECT / PARKED UNTIL CORE L.U.M.I.A. HARDENING IS COMPLETE**

This document is the canonical preservation and development roadmap for **L.U.M.I.A. Kids**.

The project is intentionally registered now so the idea, architecture and work breakdown are not lost while the main L.U.M.I.A. runtime continues through Meeting Intelligence, Voice Gate, speaker verification, anti-replay/liveness, wake-word hardening, tool routing, privacy integration and runtime robustness.

**Do not begin full L.U.M.I.A. Kids implementation until the resume gate defined at the end of this document is satisfied.**

---

## Mission

Create a local-first child language companion that can:

1. understand a specific child's speech increasingly well over time;
2. distinguish communication understanding from target articulation;
3. allow caregivers to correct what the child intended to say;
4. use context and a personal lexicon to recover difficult utterances;
5. provide short, positive, game-like language practice;
6. follow goals configured by caregivers and, when applicable, guidance from a speech-language professional or language school;
7. measure educational interaction progress without acting as a diagnostic system.

The intended role is:

> **LUMIA listens, understands, plays, models language and accompanies practice.**

It is **not** intended to diagnose, replace a speech-language professional, replace a language school, independently prescribe therapy, or infer a clinical condition.

---

## Core design principle

A child-specific speech recognizer must not confuse:

```text
"What did the child probably mean?"
```

with:

```text
"Was the pronunciation clinically correct?"
```

These are separate problems and must remain separate in code, data and UI.

### Communication-understanding layer

```text
child speech
   ↓
acoustic evidence
   +
conversation context
   +
personal lexicon
   +
caregiver corrections
   ↓
most likely intended meaning
```

### Articulation-observation layer

```text
target word / phrase
   ↓
child attempt
   ↓
phonetic / syllabic observations
   ↓
descriptive practice feedback
```

The second layer must **never** silently convert ASR uncertainty into a claim that the child pronounced something incorrectly.

---

## Canonical architecture

```text
                         L.U.M.I.A. KIDS
                               |
                         Child microphone
                               |
                              VAD
                               |
                    Child speaker profile
                               |
                 +-------------+-------------+
                 |                           |
                 v                           v
        Speech recognition            Acoustic analysis
      Whisper.cpp / local STT       phonemes / syllables /
                 |                  timing / voiced segments
                 +-------------+-------------+
                               |
                               v
                 Personalized Speech Adapter
                               |
                  +------------+------------+
                  |                         |
                  v                         v
          Personal Speech Lexicon      Context Recovery
                  |                         |
                  +------------+------------+
                               |
                               v
                          LUMIA Brain
                               |
                  +------------+------------+
                  |                         |
                  v                         v
             Communication            Practice / games
              response                target modelling
```

Shared L.U.M.I.A. infrastructure should remain reusable:

- local provider/runtime layer;
- Ollama/Qwen provider;
- Whisper.cpp;
- Kokoro TTS;
- speaker verification;
- Meeting/Voice diarization foundations;
- Knowledge Engine;
- memory contracts;
- Tool Domain Router;
- Privacy Redaction;
- capability policy;
- avatar and visual state engine;
- telemetry and diagnostics.

Child-specific policies and data must remain independently governed.

---

## Personalized child speech model

The first implementation should **not** fine-tune Whisper immediately.

Begin with layered personalization:

```text
Base STT
  + child speaker recognition
  + personal lexicon
  + caregiver correction history
  + contextual recovery
  + confidence calibration
```

Only after enough high-quality supervised examples exist should a later phase evaluate LoRA/adapters/fine-tuning.

The goal is to improve **understanding** without redefining the target pronunciation itself.

---

## Personal speech lexicon

Each child profile may maintain a local, reviewable lexicon:

```text
PersonalSpeechLexiconEntry
- id
- childProfileId
- observedForm
- intendedForm
- contextTags[]
- exampleCount
- confidence
- lastConfirmedAt
- caregiverConfirmed
```

Possible entries may come from repeated caregiver corrections, child-specific vocabulary, names, toys, foods, family members, routines, places and school vocabulary.

No entry should become trusted solely from one low-confidence ASR result.

---

## Parent / caregiver correction loop

A caregiver must be able to correct L.U.M.I.A. when recognition fails.

```text
LUMIA:
"Creo que dijiste: quiero el gato."

CAREGIVER:
"Quiso decir: quiero el carro."
```

The correction pipeline should record:

```text
original acoustic/transcription evidence
        ↓
system interpretation
        ↓
caregiver-confirmed intended phrase
        ↓
context
        ↓
local learning record
```

The system should be able to answer how many corrections were needed, which words are repeatedly misunderstood and whether comprehension improved over time, without turning those metrics into medical claims.

---

## Child speaker profile

A future profile should distinguish a known child from other household speakers.

```text
ChildSpeakerProfile
- id
- displayName
- speakerEmbeddingReference
- preferredLanguage
- vocabularyStage
- configuredGoals[]
- caregiverIds[]
- localOnly
```

Speaker biometrics should follow the same privacy principles already used by L.U.M.I.A. Voice Gate: local-first, no cloud upload by default, explicit caregiver control, no hidden enrollment, delete/reset capability and separation of identity evidence from transcript content.

The current Meeting Intelligence speaker-tracking work is a direct technical dependency.

---

## Contextual speech recovery

For difficult child speech, context can be as important as the raw transcript.

Candidate evidence:

- previous utterances;
- current activity/game;
- visible target word or image;
- known personal vocabulary;
- recent caregiver correction;
- expected answer set;
- semantic plausibility;
- speaker identity;
- acoustic confidence.

L.U.M.I.A. Kids should expose uncertainty instead of pretending certainty.

```text
Escuché: [low-confidence recognition]
Creo que quisiste decir: "quiero mi carro"
Confianza: 0.82
```

For ambiguous cases:

```text
"No estoy segura. ¿Te refieres al carro o al gato?"
```

---

## Phoneme observation engine

This module is for **descriptive practice support**, not diagnosis.

Potential observations:

- target phoneme present / unclear / absent;
- syllable count;
- initial/final sound presence;
- repeated substitutions;
- omitted syllable;
- duration;
- voiced/unvoiced evidence;
- repetition consistency.

The system may maintain descriptive tendencies such as recurring substitutions, omissions or cluster simplification, but should not automatically label those patterns as disorders.

---

## L.U.M.I.A. Kids interaction policy

The child-facing assistant should prioritize short turns, encouragement, repetition without pressure, clear modelling, predictable routines, age-appropriate language, visual reinforcement, no negative scoring language, no shaming and no deceptive certainty.

Preferred:

```text
"¡Te escuché! Vamos otra vez juntos."
```

Avoid:

```text
"Lo hiciste mal."
```

---

## Candidate language activities

### Vocabulary
Objects, animals, colours, actions, family, places, daily routines and child-specific preferred vocabulary.

### Sentence building

```text
word
  ↓
two-word phrase
  ↓
short sentence
  ↓
spontaneous sentence
```

### Listening comprehension
Identify objects/actions, follow simple instructions and answer simple questions.

### Conversational turn-taking

```text
listen → wait → answer → continue
```

### Phonological awareness
Initial sounds, syllables, rhymes, sound matching and repetition games.

### Imitation
Syllables, words, short phrases and model-and-repeat.

### Description and narration
Describe an image/action, first-next-last and short illustrated stories.

### Question games
Quién, qué, dónde, cuándo and cuál.

### Target-sound games
Sound hunt, picture matching, repeat-after-LUMIA, minimal-pair games when configured, syllable rhythm and word treasure hunt.

Activities involving specific speech targets should be configured by an adult and, when appropriate, based on professional guidance.

---

## Avatar and child-friendly interaction states

```text
IDLE
LISTENING
THINKING
ENCOURAGING
CELEBRATING
SURPRISED
STORY
GAME
WAITING_TURN
TRY_AGAIN
```

Possible future visual changes include warmer palette, softer motion, larger facial focus, simple celebrations, particles, illustrated cards, image activities and state-specific expressions.

The avatar should reward participation, not grade the child's worth or ability.

---

## Adult / professional configuration

A caregiver panel may configure session duration, vocabulary level, target words, target sounds/syllables, preferred games, repetition count, feedback style, content from school/professional, temporary goals, words to avoid, progress notes and data retention.

A future professional-facing export may provide descriptive session summaries, but must not claim clinical interpretation.

---

## Progress model

Keep two dimensions separate.

### Communication comprehension

```text
utterances understood without correction
utterances recovered by context
utterances corrected by caregiver
unknown utterances
```

### Practice observation

```text
target attempts
successful recognitions
repeated attempts
target sound observed / unclear
activity completion
```

Example dashboard:

```text
SESSION 14

Utterances: 28
Understood directly: 20
Recovered by context: 5
Caregiver corrections: 2
Unknown: 1

Words practised: 12
Activities completed: 4
Spontaneous phrases: 7
```

Do not convert these into medical severity scores.

---

## Privacy and child-data requirements

Child privacy is a first-class architecture requirement.

Default requirements:

- local processing whenever practical;
- raw audio retention OFF by default;
- no cloud upload by default;
- anonymous/ephemeral acoustic features where possible;
- explicit caregiver-controlled child profile;
- local progress history optional;
- delete/reset capability;
- no advertising;
- no behavioural advertising profile;
- no hidden biometric enrollment;
- no arbitrary Internet grounding;
- no automatic sharing with third parties;
- dedicated review before any cloud analytics or remote sync.

If a future feature requires raw audio retention for supervised model improvement, it must be **explicitly opt-in**, bounded, reviewable and deletable.

---

## Knowledge strategy

Do not ground L.U.M.I.A. Kids from arbitrary child-oriented Internet content.

Use a controlled library:

```text
LUMIA KIDS KNOWLEDGE
|
+-- vocabulary sets
+-- phrase models
+-- phonological activities
+-- short stories
+-- approved images
+-- turn-taking games
+-- question games
+-- caregiver-configured goals
+-- school/professional-provided guidance
```

Use the existing ORBI/L.U.M.I.A. Knowledge Engine before considering fine-tuning.

---

# Development roadmap

## LK-00 — Architecture & Child Privacy

Deliverables:
- canonical threat/privacy model;
- child-data classes;
- local/cloud boundary;
- consent and caregiver-control model;
- raw-audio retention policy;
- delete/reset semantics;
- project-level non-diagnostic language.

Exit criteria: privacy boundaries documented and no child-data path lacks an owner and retention rule.

## LK-01 — Child Speaker Profile

Deliverables:
- child-specific local speaker profile;
- speaker recognition against household voices;
- profile lifecycle;
- local enrollment flow;
- profile reset/delete;
- integration with Voice Gate identity evidence.

Dependencies: speaker verification, Meeting Intelligence speaker tracking and Voice Gate identity contracts.

Exit criteria: child can be recognized as the configured child speaker under controlled household tests without silently labeling another household speaker as the child.

## LK-02 — Personal Speech Lexicon

Deliverables:
- lexicon contract;
- local storage;
- caregiver-confirmed mappings;
- confidence/example-count rules;
- contextual tags;
- review/edit/delete UI.

Exit criteria: recurring child-specific forms can improve understanding without modifying the canonical language model.

## LK-03 — Parent Correction Loop

Deliverables:
- "LUMIA misunderstood" action;
- caregiver corrected interpretation;
- correction provenance/history;
- learning eligibility rules;
- rollback/delete.

Exit criteria: caregiver can correct a phrase and later observe that the same pattern is more likely to be understood.

## LK-04 — Contextual Speech Recovery

Deliverables:
- confidence-aware recovery;
- candidates from lexicon;
- conversation/activity context;
- expected-answer constraints;
- ambiguity prompts;
- no forced interpretation below safety threshold.

Exit criteria: low-confidence ASR can recover likely intent while preserving visible uncertainty.

## LK-05 — Phoneme Observation Engine

Deliverables:
- syllable segmentation;
- target-sound observation;
- phoneme/syllable comparison;
- descriptive substitution/omission observations;
- confidence model;
- no diagnostic labels.

Exit criteria: system can distinguish "I understood the word" from "target articulation was unclear" in structured data.

## LK-06 — Language Practice Games

Deliverables:
- vocabulary game;
- repetition game;
- listening-comprehension game;
- turn-taking game;
- avatar reward states;
- session timer;
- activity-level safety rules.

Exit criteria: short local session can run end-to-end while preserving caregiver-defined boundaries.

## LK-07 — Therapist / School Goal Profiles

Deliverables:
- adult-configured goals;
- target words/sounds;
- activity restrictions;
- imported professional/school guidance;
- provenance;
- no autonomous treatment-plan generation.

Exit criteria: L.U.M.I.A. follows configured practice goals without inventing clinical goals.

## LK-08 — Progress Dashboard

Deliverables:
- comprehension metrics;
- correction metrics;
- activity history;
- practice observations;
- trend visualization;
- local export;
- reset/delete.

Exit criteria: caregiver can see educational progress without clinical scoring language.

## LK-09 — Personalized Speech Adapter

Deliverables:
- evaluate lexicon-only, contextual reranking, acoustic adapter and LoRA/fine-tune;
- offline benchmark;
- regression tests against adult voices and unrelated child speech;
- model rollback.

Exit criteria: personalized adapter must outperform the non-personalized baseline on a held-out local benchmark without unacceptable false interpretation.

Fine-tuning is optional and must only proceed if simpler methods plateau.

## LK-10 — Controlled Kids Pilot

Deliverables:
- limited household pilot;
- caregiver supervision;
- no cloud dependency required;
- privacy verification;
- comprehension benchmark;
- false-understanding review;
- activity usability review;
- crash/recovery testing;
- pilot report.

Exit criteria: stable local sessions, measurable comprehension improvement, no critical privacy failures and no unsafe autonomous clinical behaviour.

---

# Cross-cutting workstreams

## A. Child-safe interaction
Positive feedback, no shame, no punitive scoring, uncertainty language, short prompts, interruption tolerance and repeat/rephrase capability.

## B. Speech-data governance
Evidence provenance, confidence, caregiver confirmation, retention, deletion, export and no silent training.

## C. Evaluation
Separate benchmarks for speaker identity, raw STT, contextual recovery, caregiver-corrected understanding, short utterances, noisy room, distance, overlapping speech and unfamiliar vocabulary.

## D. Household compatibility
L.U.M.I.A. Kids must coexist with adult L.U.M.I.A., Meeting Mode, Voice Gate, multiple household speakers and future ORBI Edge Mesh.

---

# Dependencies on current L.U.M.I.A. roadmap

```text
MI-04 / Meeting speaker tracking
        ↓
Speaker Verification
        ↓
Anti-Replay / Liveness
        ↓
Voice Gate enforcement
        ↓
Dedicated "Lumi" wake word
        ↓
Tool Router enforcement
        ↓
Privacy Redaction integration
        ↓
Memory / Knowledge governance
        ↓
Runtime robustness
        ↓
L.U.M.I.A. Kids active development
```

The project may be researched earlier, but implementation should not fork critical voice/security infrastructure prematurely.

---

# Suggested future repository strategy

Keep this document in:

```text
ingeniusvictor/orbi-jarvis-agent-lab
```

until activation.

At activation time choose a dedicated branch or a new repository. Recommended default:

```text
orbi-lumia-kids
```

with shared packages/contracts imported from the main L.U.M.I.A. core rather than copied.

---

# Non-negotiable guardrails

1. Do not present L.U.M.I.A. Kids as a diagnostic or clinical tool.
2. Do not replace professional speech-language support.
3. Do not infer articulation failure from ASR uncertainty.
4. Do not shame or punish a child for an attempt.
5. Do not force an uncertain utterance into a confident interpretation.
6. Keep child data local by default.
7. Do not retain raw child audio by default.
8. Do not silently enroll child biometrics.
9. Do not silently train on child speech.
10. Do not ingest arbitrary Internet content as the child knowledge base.
11. Keep adult configuration separate from child interaction.
12. Any cloud, analytics, sync or sharing feature requires a dedicated child-privacy review.
13. Fine-tuning must be justified by benchmark evidence; it is not the default first solution.
14. The main L.U.M.I.A. hardening roadmap retains priority until the resume gate is satisfied.

---

# Resume gate

Begin active L.U.M.I.A. Kids development when these foundations are sufficiently stable:

- Meeting speaker tracking accepted in real household tests;
- primary speaker verification operational;
- Voice Gate anti-replay/liveness direction settled;
- Voice Gate hot-path enforcement safe;
- dedicated wake-word path operational;
- Tool Router / N1-N2-N3 enforcement active;
- Privacy Redaction integrated into runtime boundaries;
- memory/knowledge persistence rules defined;
- runtime diagnostics/recovery sufficiently stable.

Then resume at:

```text
LK-00 → LK-01 → LK-02 → LK-03 → LK-04
     → LK-05 → LK-06 → LK-07 → LK-08
     → LK-09 (only if justified) → LK-10
```

---

## Canonical resume instruction

When this subproject is resumed:

> Open `docs/LUMIA_KIDS_LANGUAGE_COMPANION_CONCEPT.md`, verify the current L.U.M.I.A. core dependencies against the Resume Gate, and start with the first incomplete LK phase. Do not skip privacy/data-governance requirements and do not begin model fine-tuning before the lexicon/context/correction baseline has been benchmarked.

This file is the canonical L.U.M.I.A. Kids subproject roadmap until a dedicated repository is created.
