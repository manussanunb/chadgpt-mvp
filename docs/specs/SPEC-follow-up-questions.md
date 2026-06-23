# Spec: Follow-Up Question Suggestions

## Objective

After each assistant response in ChadGPT, automatically surface 2–3 AI-generated Thai-language follow-up question chips below the answer. Users can tap a chip to instantly submit that question — eliminating the blank-slate problem of "I don't know what to ask next."

**Target users:** Bangkok residents who got an answer but want to go deeper, and users who don't know how to phrase their next question.

**Success criteria:**
- Follow-up chips appear within 3 seconds of the main answer rendering
- The feature never delays or blocks the main answer
- No additional cost impact (same free-tier Gemini quota as the main chat)

---

## UX Flow

```
User submits question
  → Main answer renders from POST /api/chat                   ← unchanged
  → Client fires POST /api/follow-up { question, answer }     ← new, non-blocking
  → 3 skeleton chips appear below the answer bubble (loading state)
  → Chips replaced with 2–3 real Thai question chips
  → User clicks a chip → question auto-submitted as new message
  → Chips for previous messages disappear
  → New chips appear below the new answer
```

Only the **most recent** assistant bubble shows chips. Past bubbles show nothing below their rating buttons.

---

## UI Placement

Chips appear below the most recent assistant message bubble, **replacing** the existing sources section ("อ่านนโยบายเพิ่มเติมที่"). Sources remain accessible via inline citation hover-tooltips already present in the answer text.

Visual hierarchy below the latest assistant bubble:
1. Rating buttons (👍 👎 😂) — unchanged
2. Follow-up question chips — **replaces** sources

Past assistant bubbles: only rating buttons remain (sources section removed from non-latest bubbles since citations are inline).

---

## API Contract

### New endpoint: `POST /api/follow-up`

**Request:**
```json
{
  "question": "ชัชชาติทำอะไรด้านสุขภาพบ้าง?",
  "answer": "เราได้ติดตั้ง CCTV เพิ่ม 10,000 ตัว..."
}
```

**Constraints:**
- `question`: non-empty string, max 500 chars
- `answer`: non-empty string, max 3,000 chars

**Response (200):**
```json
{
  "followUpQuestions": [
    "สถานีอนามัยที่ปรับปรุงแล้วมีที่ไหนบ้าง?",
    "งบประมาณด้านสุขภาพเพิ่มขึ้นเท่าไหร่?",
    "แผนด้านสุขภาพสำหรับเทอมหน้าคืออะไร?"
  ]
}
```

**Error (400/429/500):**
```json
{ "error": "..." }
```

The client treats any error response as "show no chips" — no user-visible error.

---

## LLM Prompt

Uses a dedicated `GeminiProvider` instance, always with model **`gemini-2.5-flash-lite`** — separate from the main chat provider which uses `gemini-2.5-flash`. Follow-up generation is a lightweight JSON-classification task (not a persona response), so the lite model is sufficient, faster, and cheaper. The `LLM_PROVIDER` env var does **not** affect this endpoint.

**System prompt:**
```
คุณช่วยสร้างคำถามต่อเนื่อง 3 ข้อสำหรับผู้ใช้ที่คุยเรื่องนโยบายกรุงเทพมหานคร
กฎ:
- ตอบเป็นภาษาไทยเท่านั้น
- แต่ละคำถามสั้นกระชับ ไม่เกิน 60 ตัวอักษร
- คำถามต้องเกี่ยวข้องกับเนื้อหาในคำถามและคำตอบที่ได้รับ
- ส่งกลับเป็น JSON array เท่านั้น ตัวอย่าง: ["คำถาม1", "คำถาม2", "คำถาม3"]
- ห้ามใส่ข้อความอื่นนอกจาก JSON array
```

**User message:**
```
คำถามเดิม: {question}
คำตอบที่ได้รับ: {answer}
```

**LLM response parsing:**
- Parse as JSON array; extract only string elements
- If parse fails or array is empty → return `{ followUpQuestions: [] }`
- Accept 1–3 questions (don't require exactly 3)
- Strip any questions longer than 80 chars

---

## New Files

### `app/api/follow-up/route.ts`

```typescript
POST /api/follow-up
- Validate question (non-empty, ≤ 500 chars) and answer (non-empty, ≤ 3000 chars)
- Apply same IP-based rate limiter as /api/chat (shared import)
- Instantiate GeminiProvider with model "gemini-2.5-flash-lite" (always — ignores LLM_PROVIDER)
- Call provider.generate(FOLLOW_UP_SYSTEM_PROMPT, userMessage)
- Parse JSON array from response
- Return { followUpQuestions: string[] }
- On any error: return { followUpQuestions: [] } with status 200
  (client must never show an error state for this feature)
```

`maxDuration = 15` (shorter than main chat since generation is simpler).

### `components/FollowUpChips.tsx`

```typescript
interface FollowUpChipsProps {
  questions: string[] | null  // null = loading
  onSelect: (question: string) => void
  disabled: boolean           // true while main chat is loading
}
```

**Loading state** (`questions === null`): 3 skeleton pill shapes, `animate-pulse`, same green tint as source chips.

**Loaded state**: 2–3 clickable chips. Style mirrors current source link chips (`bg-[#86f101]/20 border-[#86f101]/60 rounded-full`) but with a question mark suffix and a `→` hover arrow.

**Disabled state**: chips are greyed out (`opacity-40 pointer-events-none`) while a new message is loading.

---

## Changes to Existing Files

### `components/MessageBubble.tsx`

Add to `Message` interface:
```typescript
followUpQuestions?: string[] | null  // null = loading, [] = none, string[] = ready
isLatest?: boolean
```

Replace the sources section rendering with `FollowUpChips` **when `isLatest === true`**:
```typescript
{!isUser && isLatest && (
  <FollowUpChips
    questions={message.followUpQuestions ?? null}
    onSelect={onFollowUpSelect}
    disabled={isLoading}
  />
)}
```

Remove the sources section from `MessageBubble` entirely (citations are already inline).

Add `onFollowUpSelect` and `isLoading` to `MessageBubbleProps`.

### `components/ChatWindow.tsx`

- Pass `isLatest={i === messages.length - 1 && msg.role === "assistant"}` to each `MessageBubble`
- Pass `onFollowUpSelect={onStarterClick}` down (reuses the same submit handler)
- Pass `isLoading` down

### `app/page.tsx` (or wherever message state lives)

After the main answer arrives:
```typescript
// 1. Set loading state on the latest message
setMessages(prev => [...prev.slice(0, -1), { ...latestMsg, followUpQuestions: null }])

// 2. Fire follow-up call (non-blocking, does not await in the main flow)
fetchFollowUp(userQuestion, answerText)
  .then(questions => {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last.role !== "assistant") return prev
      return [...prev.slice(0, -1), { ...last, followUpQuestions: questions }]
    })
  })
  .catch(() => {
    // silently do nothing — chips simply won't appear
  })
```

When the user submits a new message (including via chip click):
```typescript
// Clear follow-up chips on the previous latest message
setMessages(prev => prev.map((m, i) =>
  i === prev.length - 1 ? { ...m, followUpQuestions: undefined } : m
))
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `/api/follow-up` returns 4xx/5xx | Client catches silently; no chips shown |
| LLM returns invalid JSON | Server returns `{ followUpQuestions: [] }`; no chips shown |
| Follow-up call takes > 5s (client timeout) | AbortController cancels request; no chips shown |
| User submits new message before chips load | Previous follow-up request is aborted; new chips load for new answer |

The follow-up feature is fully **best-effort**: degrading to no chips is always acceptable.

---

## Tracking (PostHog)

Capture one event when a chip is clicked:
```typescript
posthog.capture("follow_up_chip_clicked", { question: selectedQuestion })
```

---

## Boundaries

**Always:**
- Apply the same IP rate limiter to `/api/follow-up` as `/api/chat`
- Validate inputs at the API boundary
- Show chips only on the most recent assistant message
- Abort the follow-up fetch if the user submits a new message before it completes
- Return HTTP 200 with `{ followUpQuestions: [] }` on LLM/parse errors (never a 500 that the client must handle)

**Ask first:**
- Changing the number of follow-up questions (currently 3)
- Changing the LLM prompt Thai text
- Adding follow-up chips to past messages (not just the latest)

**Never:**
- Block or delay the main `/api/chat` response waiting for follow-up questions
- Show an error toast or message if follow-up generation fails
- Call `/api/follow-up` when the main answer is a "no results" fallback (answer has no `sources` — skip the follow-up call in this case to save quota)

---

## Acceptance Criteria

- [ ] `POST /api/follow-up` returns `{ followUpQuestions }` with 2–3 Thai strings in under 3 seconds
- [ ] Follow-up API shares the same rate-limiter logic as `/api/chat`
- [ ] Chips appear below the most recent assistant bubble only
- [ ] 3 skeleton chips appear immediately after the main answer while follow-up loads
- [ ] Clicking a chip auto-submits the question as a new user message
- [ ] Chips for the previous latest message disappear when a new message is submitted
- [ ] If the follow-up call fails or times out, no chips are shown and no error is surfaced
- [ ] Follow-up call is aborted if the user sends another message before chips arrive
- [ ] Sources section removed from all message bubbles (citations are inline)
- [ ] PostHog event `follow_up_chip_clicked` fires on chip click

---

## Out of Scope (MVP)

- Follow-up chips on all past messages (not just latest)
- Regenerating follow-up chips without asking a new question
- Server-side caching of follow-up questions per question/answer pair
