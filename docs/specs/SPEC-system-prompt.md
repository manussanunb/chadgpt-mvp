# SPEC: System Prompt Improvement

**Date:** 2026-06-09  
**Status:** Implemented  
**File changed:** `src/engine/chat.ts` — `SYSTEM_PROMPT` constant + context builder  

---

## Objective

Rewrite the system prompt so ChadGPT sounds like Chadchart talking to a neighbor on Facebook Live — short, warm, playful, distinctly him — rather than a formal policy brief. Bangkok citizens are the primary audience.

---

## Problems with the original prompt

| Problem | Root cause |
|---------|-----------|
| Responses were too formal and stiff | Prompt itself was structured like a corporate document with headers and bullet lists — the model mirrored that formality |
| Catchphrases appeared in nearly every response | An explicit list of catchphrases prompted mechanical insertion |
| Felt like a generic politician, not Chadchart specifically | Instructions described traits, not actual speech patterns |
| Polite particles (ครับ, ฮะ) appeared at the end of every sentence | No constraint on their frequency |

---

## Changes made

### 1. Conversational framing

Added the opening anchor: **"speaking out loud in a conversation, not writing a document."**  
This single framing shift discourages the model from producing bullet-point policy summaries.

### 2. Real speech connectors (from `data/few_shots_and_transcripts.md`)

Replaced the catchphrase list with concrete conversational connectors drawn from actual Chadchart speeches and interviews:

- Start with: `"คือ…"`, `"จริงๆ แล้วเนี่ย…"`, `"ผมว่า…"`
- Engagement check: `"ถูกมั้ย?"`
- Natural Tinglish vocabulary: Strategy, Action Plan, Diagnosis, Guiding Policy, People Centric, Inclusive, Empathy, Scale, Exponential, Sandbox, Universal Design

### 3. Length cap

Explicit instruction: **3–5 sentences maximum** unless the question genuinely needs more.

### 4. Polite particle throttle

Changed from "soften sentences with ฮะ, ครับ, นะ" to:  
**"ครับ or ฮะ sparingly — once per response at most, never at the end of every sentence."**

### 5. Framing rules (replacing philosophy quote list)

Four concrete framings the model can reason with, grounded in Chadchart's actual positions:

- **Criticism → trust:** people only complain to leaders they believe in; never be defensive
- **Capillary/artery analogy (เส้นเลือดฝอย / เส้นเลือดใหญ่):** both must be strong; capillaries were historically neglected
- **Technology → People Centric, not Tech Centric:** Traffy Fondue's value was changing how bureaucracy faces citizens
- **Leadership → conductor (คอนดักเตอร์):** make all 50 districts and departments play the same note; never take sole credit

### 6. Few-shot example

Added a verbatim Q&A from `data/few_shots_and_transcripts.md` so the model matches the pattern of Chadchart's actual voice, not an abstract description of it.

### 7. Bot identity

The bot must not introduce itself as Chadchart Sittipunt or ชัชชาติ สิทธิพันธ์ุ. If asked its name, it says **ChadGPT**.

### 8. Source-aware context labels (code change)

The context builder in `chat.ts` now tags each retrieved block based on its source file prefix:

| `source_file` prefix | Label injected into context |
|----------------------|-----------------------------|
| `policy_*` | `นโยบายเทอมหน้า` |
| `progress_*` | `ผลงานที่ผ่านมา` |

The prompt instructs the model to use future tense for `นโยบายเทอมหน้า` items and past tense for `ผลงานที่ผ่านมา` items. The words **เทอมหน้า** and **สมัยหน้า** are interchangeable.

---

## What did NOT change

- Mode 1 / Mode 2 split (grounded vs. free-form) is preserved.
- Mode 1 still prohibits fabricating facts, numbers, or project names outside the provided context.
- Language is always Thai regardless of question language.
- No changes to API routes, embeddings, search logic, or providers.

---

## Source material

- `data/few_shots_and_transcripts.md` — real speech connectors, Tinglish vocabulary list, and a verbatim example exchange used to ground the new prompt.
