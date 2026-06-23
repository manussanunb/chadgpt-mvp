# SPEC: Inline Citation Underlines

**Date:** 2026-06-23
**Status:** Draft
**Branch:** feat/inline-citations (to be created)

---

## Objective

When ChadGPT answers using grounded policy or progress data (Mode 1), the specific text spans derived from each source should be visually underlined with a dotted line. Hovering over an underlined span shows a tooltip with the source category name and a link to the original source URL. The existing source chip list below each answer is kept.

**Target users:** Bangkok residents reading the answer — inline underlines let them see at a glance which claims are grounded in real data vs. synthesised voice.

---

## Acceptance Criteria

- [ ] In Mode 1 answers, cited spans are rendered with a dotted underline and a distinct color (brand green `#013920`)
- [ ] Hovering (desktop) or tapping (mobile) an underlined span shows a tooltip with: category name + "อ่านเพิ่มเติม →" link opening the source URL in a new tab
- [ ] The tooltip is dismissed when the user moves the cursor away or taps elsewhere
- [ ] In Mode 2 answers (no context), no underlines appear
- [ ] The existing source chip list below the message is unchanged
- [ ] Answers with no `[cite:N]` markers (e.g. the LLM chose not to cite, or Mode 2) render normally
- [ ] `npm run typecheck` passes
- [ ] All existing unit tests pass
- [ ] No raw `[cite:N]`/`[/cite]` markup is ever visible to the user as literal text

---

## Architecture

### 1. Context block IDs (`src/engine/chat.ts`)

Change the context builder to label each block with a 1-based numeric ID:

**Before:**
```
[ระบบ — ผลงานที่ผ่านมา]
text…
```

**After:**
```
[1] [ระบบ — ผลงานที่ผ่านมา]
text…

[2] [เศรษฐกิจ — นโยบายเทอมหน้า]
text…
```

### 2. System prompt addition (`src/engine/chat.ts`)

Append to the Mode 1 instructions (after the existing context/tense framing paragraph):

```
When answering in Mode 1, wrap any text you draw from a specific context block with [cite:N] and [/cite], where N is that block's number. Wrap only the specific phrases or sentences you derived from each block — not your entire response. Example: "เราทำ[cite:1]การติดตั้งกล้อง CCTV เพิ่ม 10,000 ตัว[/cite]ทั่วกรุงเทพแล้วครับ"
```

Do **not** add this instruction to Mode 2 (no context).

### 3. `ChatResponse` type (`src/engine/types.ts`)

Add an optional `citationSources` map so the client can resolve N → source without re-parsing:

```typescript
interface ChatResponse {
  answer: string;
  sources: { category: string; source_url: string }[];
  citationSources?: Record<string, { category: string; source_url: string }>;
}
```

`citationSources` is `undefined` when no context was retrieved (Mode 2). Keys are `"1"`, `"2"`, … matching the context block numbers.

### 4. `chat()` changes (`src/engine/chat.ts`)

Build the map alongside the context string:

```typescript
const citationSources: Record<string, { category: string; source_url: string }> = {};
const context = results
  .map((r, i) => {
    const id = i + 1;
    citationSources[String(id)] = { category: r.item.category, source_url: r.item.source_url };
    const type = r.item.source_file.startsWith("policy_") ? "นโยบายเทอมหน้า" : "ผลงานที่ผ่านมา";
    return `[${id}] [${r.item.category} — ${type}]\n${r.item.text}`;
  })
  .join("\n\n---\n\n");

// ... existing LLM call ...

return { answer, sources, citationSources };
```

### 5. Client-side rendering (`components/MessageBubble.tsx`)

**Pre-processing step:** Before passing the answer to ReactMarkdown, replace cite markers with HTML `<u>` elements that carry a `data-cite` attribute:

```typescript
function applyInlineCitations(
  raw: string,
  citationSources: Record<string, { category: string; source_url: string }> | undefined
): string {
  if (!citationSources) return raw;
  return raw.replace(/\[cite:(\d+)\]([\s\S]*?)\[\/cite\]/g, (_, id, text) =>
    `<u data-cite="${id}">${text}</u>`
  );
}
```

**ReactMarkdown integration:**

Add `rehype-raw` (allows raw HTML nodes from the pre-processed string) and a custom component for `<u>`:

```tsx
// Inside MessageBubble, assistant branch only:
const processedContent = applyInlineCitations(message.content, message.citationSources);

<ReactMarkdown
  rehypePlugins={[rehypeRaw]}
  components={{
    // ... existing p, ul, ol, li, strong, a ...
    u: ({ node, children, ...props }) => {
      const citeId = (props as { 'data-cite'?: string })['data-cite'];
      const source = citeId && message.citationSources?.[citeId];
      if (!source) return <u>{children}</u>;
      return <CitationSpan source={source}>{children}</CitationSpan>;
    },
  }}
>
  {processedContent}
</ReactMarkdown>
```

### 6. `CitationSpan` component (inline, inside `MessageBubble.tsx`)

Keep it in the same file — it is only used here.

```tsx
function CitationSpan({
  children,
  source,
}: {
  children: React.ReactNode;
  source: { category: string; source_url: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline">
      <span
        className="underline decoration-dotted decoration-[#013920] underline-offset-2 cursor-help text-[#013920]/80"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </span>
      {open && (
        <span className="absolute bottom-full left-0 mb-1 z-10 w-max max-w-[220px] rounded-lg bg-[#013920] text-white text-xs px-3 py-2 shadow-lg flex flex-col gap-1 pointer-events-auto">
          <span className="font-medium">{source.category}</span>
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline opacity-80 hover:opacity-100"
          >
            อ่านเพิ่มเติม →
          </a>
        </span>
      )}
    </span>
  );
}
```

### 7. `Message` interface update (`components/MessageBubble.tsx`)

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  citationSources?: Record<string, { category: string; source_url: string }>;
}
```

### 8. Page state update (`app/page.tsx`)

When the API response is received, store `citationSources` alongside `sources` in the message state:

```typescript
setMessages((prev) => [
  ...prev,
  {
    role: "assistant",
    content: data.answer,
    sources: data.sources,
    citationSources: data.citationSources,  // add this
  },
]);
```

---

## New dependency

```bash
npm install rehype-raw
```

`rehype-raw` is the standard rehype plugin for allowing raw HTML in `react-markdown`. It is actively maintained and already used in many Next.js projects.

---

## What does NOT change

- Search logic, embedding, providers — untouched
- Existing source chip list — untouched
- Mode 2 (no-context) answers — no cite markers, renders exactly as today
- API route validation — untouched
- Rating buttons (👍👎😂) — untouched
- `data/embedded/` files — untouched

---

## Testing Strategy

| Level | What | Where |
|---|---|---|
| Unit | `applyInlineCitations` strips markers and produces correct `<u data-cite>` HTML | `src/engine/__tests__/citations.test.ts` or inline in `MessageBubble.test.tsx` |
| Unit | `applyInlineCitations` returns unchanged string when `citationSources` is undefined | Same |
| Unit | `citationSources` map in `chat()` has correct keys and values matching results order | `src/engine/__tests__/chat.test.ts` |
| Manual | Ask a grounded question; confirm underlined spans appear and tooltips show correct category + working link | Dev server |
| Manual | Ask an off-topic question (Mode 2); confirm no underlines appear | Dev server |

---

## Boundaries

**Always:**
- Only underline text that carries a `data-cite` attribute (i.e. the LLM explicitly emitted a cite marker)
- Render plain `<u>` (no tooltip) if the cite ID is not found in `citationSources` — never crash on malformed LLM output
- Keep `applyInlineCitations` pure (no side effects, no API calls)

**Ask first:**
- Changing the cite marker syntax (affects system prompt and parser together)
- Replacing hover tooltip with a different UX (click-to-modal, footnotes, etc.)
- Adding mobile-specific long-press behavior

**Never:**
- Let raw `[cite:N]` text reach the rendered DOM as visible characters
- Fetch source URLs or categories from outside the `citationSources` map already in the response
- Show citation underlines on user messages

---

## Open Questions

| Question | Proposed answer |
|----------|----------------|
| What if the LLM wraps a very long sentence in a single cite? | Accept it — the underline will be long. No truncation needed for MVP. |
| What if the LLM emits overlapping or nested cite markers? | The regex is non-greedy; nested markers will produce broken HTML. Instruct the LLM not to nest. For MVP, no defensive handling needed — the LLM generally doesn't nest these. |
| Should PostHog track citation tooltip opens? | Deferred — add `posthog.capture("citation_hovered", { id, category })` in a follow-up if analytics on citation engagement are wanted. |
