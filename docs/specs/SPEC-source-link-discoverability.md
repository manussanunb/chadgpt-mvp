# SPEC — Source-Link Discoverability

**Status:** Shipped — 2026-06-09
**Branch:** `feat/frontend-design`

---

## Objective

Make policy references in ChadGPT's replies feel tangible and explorable. Two complementary changes:

1. **Inline text links** — when ChadGPT mentions a policy, a natural Thai phrase in that sentence becomes a dotted-underline link that opens teamchadchart.com in a new tab.
2. **Source pill improvements** — the category pills below each reply already link to teamchadchart.com but looked like labels; adding a header label and a ↗ icon makes them obviously clickable.

### Problem before this change

| Symptom | Root cause |
|---------|-----------|
| Users ignore the source pills | Pills showed only a category name with no affordance — no label, no icon |
| No in-text links to full policy pages | `source_url` was not passed to the LLM; no linking instruction existed |

### Success criteria

| Before | After |
|--------|-------|
| Response text: plain prose | Response text: one dotted-underline link per referenced source |
| Pill row: `[ นโยบายเมือง ]` | Pill row: `อ่านนโยบายเพิ่มเติมที่` label + `[ นโยบายเมือง ↗ ]` |
| Users ignore pills | Users click through to teamchadchart.com from text or pills |

---

## Changes

### 1. `src/engine/chat.ts`

**Context block format** — include `source_url` in the block header so the LLM can use it:

```
Before: [นโยบายเมือง — ผลงานที่ผ่านมา]
After:  [นโยบายเมือง — ผลงานที่ผ่านมา | url: https://teamchadchart.com/...]
```

**Linking instruction** — appended to `userMessage` (after context, before question):

> "For each context block you reference in your answer, embed exactly one markdown link [natural phrase](url) using that block's url. The link text must be a short Thai phrase (2–5 words) taken from your own sentence — never use the category name, type label, or any text from the block header. Place the link where it reads most naturally."

**Key constraint:** the instruction explicitly forbids using the category/type header as link text. Without this, the LLM would produce unnatural output like `[เด็กมีทักษะ — ผลงานที่ผ่านมา](url)` copied verbatim from the block header.

### 2. `components/MessageBubble.tsx`

**Pill section** — when `sources` is non-empty on an assistant message:

```jsx
<div className="flex flex-col gap-1 px-1">
  <p className="text-xs text-gray-400">อ่านนโยบายเพิ่มเติมที่</p>
  <div className="flex flex-wrap gap-1">
    {sources.map(s => (
      <a ...>{s.category} ↗</a>
    ))}
  </div>
</div>
```

**Inline link style** — `ReactMarkdown` `<a>` renderer:

```
Before: className="text-[#013920] underline"
After:  className="text-[#013920] underline decoration-dotted underline-offset-2"
```

Dotted underline signals "this is a reference/hint link" without the heavy editorial feel of a solid underline. Solid underline on dark green (`#013920`) did not read as clickable to users.

---

## Files Changed

| File | Change |
|------|--------|
| `src/engine/chat.ts` | Context block format + linking instruction in `userMessage` |
| `components/MessageBubble.tsx` | Pill label + ↗ icon + dotted underline on inline `<a>` |
| `src/engine/__tests__/chat.test.ts` | Fixed stale fallback test; added 3 new tests |

---

## Tests

Three new unit tests in `src/engine/__tests__/chat.test.ts`:

| Test | What it asserts |
|------|-----------------|
| `includes source_url in context block header` | `userMessage` contains `url: https://example.com/1` |
| `appends linking instruction when results found` | `userMessage` contains `"markdown link"` |
| `does not include linking instruction when no results` | No `"markdown link"` in free-form fallback message |

One stale test fixed: `"returns fallback when no results match"` was asserting `toContain("ไม่พบข้อมูล")` and `not.toHaveBeenCalled()` — both wrong since the zero-results path calls the LLM for a free-form persona response. Updated to assert `generate` is called once and `sources` is empty.

---

## Boundaries

### Always do
- Show the pill label and inline links only when `sources` is non-empty.
- All links open in `target="_blank" rel="noopener noreferrer"`.
- Linking instruction says "exactly one link per referenced block" to prevent link spam.

### Ask before changing
- Pill colors or sizing.
- Underline style (dotted was chosen deliberately over solid/dashed/wavy).
- Label text (`อ่านนโยบายเพิ่มเติมที่`).

### Never do
- Fabricate or modify `source_url` values — the LLM must use only URLs provided in the context block headers.
- Add the pill section or inline links to user-side messages.
- Add new dependencies (e.g. icon libraries) — Unicode `↗` and Tailwind utilities only.

---

## Design decisions

**Why pass `source_url` in the context header rather than the system prompt?**
System prompt changes affect every request including zero-results free-form replies. The URL injection and linking instruction are scoped to the `results.length > 0` branch, keeping the zero-results path clean.

**Why dotted underline?**
Solid underline on `#013920` (dark green) blends into the brand color and doesn't read as interactive. Dotted underline is a conventional "reference/hint" affordance that signals "tap to read more" without the heavy editorial weight of a solid underline.

**Why forbid header text as link text?**
Without the explicit prohibition, the LLM defaults to `[category — type](url)` — a verbatim copy of the context block header — which produces unnatural Thai output like `[เด็กมีทักษะ — ผลงานที่ผ่านมา](url)` mid-sentence.
