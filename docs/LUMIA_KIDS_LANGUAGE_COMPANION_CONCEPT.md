# L.U.M.I.A. Kids — Language Companion Concept

## Status

**IDEA PRESERVED / FUTURE RESEARCH LINE**

This document intentionally records the concept now so the current O.R.B.I.A. /
L.U.M.I.A. convergence work can continue without losing the idea.

Do not implement this module during the current convergence phase.

---

## Purpose

Create a future independent version of L.U.M.I.A. oriented to children as a
friendly conversational companion for language practice at home.

The intended role is:

> **Lumi plays, listens, models language and accompanies practice.**

It is **not** intended to diagnose, replace a speech-language professional,
replace a language school, or independently define therapeutic goals.

Parents/caregivers should be able to configure activities according to the
goals recommended by the child's school or speech-language professional.

---

## Why keep it in the JARVIS Lab repository

`orbi-jarvis-agent-lab` should remain a permanent experimental laboratory.

It is especially useful for:

- alternate L.U.M.I.A. personalities and interfaces;
- voice experiments;
- vision and gesture interaction;
- local AI models;
- child-friendly interaction research;
- avatar reactions and expressive states;
- experimental tutors and companions;
- capabilities that should not yet enter the canonical O.R.B.I.A. product.

L.U.M.I.A. Kids can later branch from this lab without contaminating the
enterprise/product roadmap.

---

## Working name

**L.U.M.I.A. Kids**

Possible future repository:

```text
orbi-lumia-language-lab
```

The name is provisional until the project becomes active.

---

## Product concept

A child should interact with L.U.M.I.A. as a character, not as a text chatbot.

Example interaction:

```text
LUMI:
"Hola. ¿Jugamos?"

LUMI:
"Yo digo: ma. Ahora inténtalo tú: ma."

CHILD:
[attempt]

LUMI:
"¡Bien! Vamos otra vez juntos."
```

The avatar and holographic environment should reinforce attention and
engagement through gentle visual reactions rather than grading language.

---

## Candidate learning modules

### Vocabulary

- objects;
- animals;
- colours;
- actions;
- family;
- places;
- common daily words.

### Sentence building

Progress gradually from:

```text
word -> two-word phrase -> short sentence -> spontaneous sentence
```

### Listening comprehension

Examples:

- "¿Cuál es grande?"
- "¿Dónde está el perro?"
- "¿Qué animal hace miau?"

### Conversational turn-taking

Practice:

```text
listen -> wait -> answer -> continue
```

### Phonological awareness

Potential activities:

- initial sounds;
- syllables;
- rhymes;
- sound matching;
- simple repetition games.

### Imitation

- short syllables;
- words;
- short phrases;
- model-and-repeat activities.

### Description and narration

The child may describe:

- an image;
- a character;
- an action;
- what happened first/next;
- a short illustrated story.

### Question games

Practice:

- quién;
- qué;
- dónde;
- cuándo;
- cuál.

---

## Important speech-recognition rule

Do **not** treat a normal speech-recognition model as an objective evaluator of
a child's pronunciation.

Child speech, especially speech that is still developing or difficult to
understand, may also be harder for ASR systems to recognise.

Incorrect ASR must never be interpreted automatically as:

> "the child pronounced the word incorrectly."

Preferred uncertainty behaviour:

> "No estoy segura de haberte escuchado bien. ¿Lo intentamos otra vez?"

instead of:

> "Lo dijiste mal."

---

## Proposed future local voice pipeline

Preferred local-first architecture:

```text
Microphone
   |
   +-- VAD
   |
   +-- Whisper.cpp
   |
   +-- phonetic / syllable comparison
   |      when the activity requires it
   |
   +-- O.R.B.I.A. Core
   |
   +-- L.U.M.I.A. Kids interaction policy
   |
   +-- Kokoro local TTS
   |
   +-- Avatar / visual feedback
```

Browser speech services should only be fallback paths during experimentation.

---

## Knowledge strategy

Do not train or ground L.U.M.I.A. Kids from arbitrary child-oriented Internet
content.

Start with a controlled knowledge library:

```text
LUMIA LANGUAGE KNOWLEDGE
|
+-- vocabulary by difficulty
+-- phrase models
+-- phonological activities
+-- short stories
+-- approved images
+-- turn-taking games
+-- question games
+-- caregiver-configured objectives
+-- professional/school-provided activity guidance
```

Use the existing ORBI Knowledge Engine/RAG architecture before considering
fine-tuning.

Fine-tuning is **not required for the first version**.

---

## Avatar / interaction states

Potential child-friendly states:

```text
IDLE
LISTENING
THINKING
ENCOURAGING
CELEBRATING
SURPRISED
STORY
GAME
```

The current L.U.M.I.A. GLB is a strong candidate because it already reads as a
friendly non-human companion.

Possible future visual changes:

- warmer palette;
- softer motion;
- larger facial focus;
- simple celebrations;
- stars / particles;
- illustrated cards;
- image-based activities;
- state-specific expressions if the model later gains rigging/animation.

---

## Privacy direction

Default to **local-first** operation, especially because the user is a child.

Preferred defaults:

- process voice locally;
- do not upload recordings by default;
- do not retain raw audio by default;
- no unnecessary child profile;
- parental/caregiver controls;
- optional local progress history;
- explicit delete-all control;
- no advertising;
- no hidden profiling.

If cloud features are ever introduced, they require a separate privacy and
safety review before activation.

---

## Progress tracking concept

Future optional local progress view:

```text
SESSION 14

Words practised: 12
Attempts: 26
Activities completed: 4
Sounds practised: M / P
Spontaneous phrases: 7

Observation:
greater participation in the animal activity
```

This must remain **educational progress tracking**, not clinical diagnosis.

---

## Adult / professional configuration

A future parent/caregiver panel may allow:

- age-appropriate vocabulary level;
- target words;
- target sounds/syllables;
- preferred activities;
- session duration;
- repetition count;
- positive-feedback style;
- content supplied by school/professional;
- progress notes.

The system should adapt to configured objectives rather than invent therapeutic
goals on its own.

---

## Relationship to the main O.R.B.I.A. product

Do not merge L.U.M.I.A. Kids into the enterprise product interface.

Recommended separation:

```text
orbi-jarvis-agent-lab
        |
        +-- experimental L.U.M.I.A. capabilities
        |
        +-- future branch / extraction
                  |
                  v
        orbi-lumia-language-lab
                  |
                  +-- L.U.M.I.A. Kids
                  +-- language games
                  +-- local speech stack
                  +-- controlled knowledge
                  +-- parent/professional configuration
```

Shared technology may later come from O.R.B.I.A.:

- provider router;
- Knowledge Engine;
- memory contracts;
- local voice stack;
- avatar engine;
- permissions;
- telemetry.

But the child-specific interaction policy and content must remain independently
governed.

---

## Non-negotiable guardrails

1. Do not present L.U.M.I.A. Kids as a medical or clinical diagnostic tool.
2. Do not replace professional speech-language support.
3. Do not infer failure from ASR uncertainty.
4. Do not shame, score negatively, or punish a child for an attempt.
5. Prefer encouragement and repetition.
6. Keep child data local by default.
7. Do not ingest arbitrary Internet content as the child knowledge base.
8. Keep adult configuration and child interaction clearly separated.
9. Any future cloud, analytics, memory or sharing feature requires a dedicated
   child-privacy review.
10. The current ORBIA/LUMIA convergence project takes priority; this concept
    remains parked until that work is sufficiently stable.

---

## Resume point when this project becomes active

When the current O.R.B.I.A. / L.U.M.I.A. convergence is complete:

1. create a dedicated branch or repository;
2. inventory reusable voice/avatar/knowledge components from the lab;
3. define child-safe interaction policy;
4. define a small controlled vocabulary/activity dataset;
5. implement one local game prototype;
6. test ASR uncertainty handling before any pronunciation scoring;
7. add caregiver configuration;
8. only then consider progress tracking or richer curricula.

This document is the canonical idea-preservation note until a dedicated
L.U.M.I.A. Kids project is created.
