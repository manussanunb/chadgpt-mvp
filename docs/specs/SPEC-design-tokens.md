# SPEC.md — Design Token Colour Update

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Objective

Apply four brand colour tokens and two brand images to the ChadGPT UI. No logic, functionality, or component structure changes — colour values and image assets only.

**Target users:** Bangkok residents / voters using the chat interface.

**Success criterion:** The four tokens are applied consistently across all UI components; no blue (`blue-*`) Tailwind classes remain in production UI code; both images render correctly in the header.

---

## Images

| Asset | Path | Usage |
|---|---|---|
| Team Chadchart logo | `public/teamchadchart_logo.png` | Header — replaces the text "ChadGPT" wordmark |
| ChadGPT profile picture | `public/chadgpt_profile_picture.jpeg` | Header avatar — replaces the `ช` letter circle |

### `app/page.tsx` image changes
- Avatar `<div>` with `bg-[#013920]` + letter `ช` → `<Image>` component using `public/chadgpt_profile_picture.jpeg` (32×32, rounded-full)
- `<h1>ChadGPT</h1>` text → `<Image>` component using `public/teamchadchart_logo.png` (height fits the header, width auto)
- Import `Image` from `"next/image"`

---

## Colour Tokens

| Token | Hex | Role |
|---|---|---|
| `--color-accent` | `#86f101` | Interactive highlights — hover states, focus rings, source tags |
| `--color-bg` | `#ffffff` | Page and surface backgrounds |
| `--color-brand` | `#013920` | Primary interactive elements — send button, user bubble, avatar |
| `--color-text` | `#000000` | All body and heading text |

---

## Mapping: Current → New

### `app/globals.css`
- Define the four CSS custom properties on `:root`
- Remove dark-mode override block (design is light-only; tokens are fixed)
- Replace `--background` / `--foreground` with the new tokens

### `app/page.tsx`
| Current | Replacement |
|---|---|
| `bg-gray-50` (page `<main>`) | `bg-[#ffffff]` |
| `bg-white` (header) | `bg-[#ffffff]` |
| `bg-blue-600` + `ช` letter (avatar) | `<Image src="/chadgpt_profile_picture.jpeg" width={32} height={32} className="rounded-full" alt="ChadGPT" />` |
| `<h1>ChadGPT</h1>` + `text-gray-800` | `<Image src="/teamchadchart_logo.png" height={28} width="auto" alt="ChadGPT" />` |

### `components/ChatWindow.tsx`
| Current class | Replacement |
|---|---|
| `text-gray-700` (heading) | `text-[#000000]` |
| `hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700` (starter chip) | `hover:bg-[#86f101]/20 hover:border-[#86f101] hover:text-[#013920]` |

### `components/MessageBubble.tsx`
| Current class | Replacement |
|---|---|
| `bg-blue-600 text-white` (user bubble) | `bg-[#013920] text-white` |
| `text-blue-600 underline` (markdown links) | `text-[#013920] underline` |
| `text-blue-500 hover:text-blue-700 bg-blue-50` (source tags) | `text-[#013920] hover:text-[#013920] bg-[#86f101]/20` |

### `components/ChatInput.tsx`
| Current class | Replacement |
|---|---|
| `bg-blue-600 hover:bg-blue-700` (send button) | `bg-[#013920] hover:bg-[#013920]/80` |
| `focus:ring-blue-500` (textarea) | `focus:ring-[#86f101]` |

---

## Boundaries

**Always:**
- Change colour values only — do not reorder JSX, rename props, or alter logic
- Use Tailwind arbitrary-value syntax `bg-[#xxxxxx]` for the four tokens (no new CSS classes needed)
- Keep `text-white` on dark backgrounds (`bg-[#013920]`) for contrast

**Never:**
- Change component structure, props, or function bodies
- Introduce dark mode or dynamic theming
- Alter `app/api/`, `src/engine/`, `src/adapters/`, or any non-UI file

---

## Acceptance Criteria

- [ ] No `blue-*` Tailwind classes remain in `app/page.tsx`, `components/ChatWindow.tsx`, `components/MessageBubble.tsx`, or `components/ChatInput.tsx`
- [ ] `globals.css` defines all four `--color-*` custom properties
- [ ] Header avatar shows `chadgpt_profile_picture.jpeg` (32×32, round)
- [ ] Header shows `teamchadchart_logo.png` in place of the "ChadGPT" text
- [ ] Starter chips show lime-green hover (`#86f101` tint) on hover
- [ ] Send button and user message bubble use `#013920`
- [ ] Focus ring on textarea is `#86f101`
- [ ] `npm run typecheck` and `npm run lint` pass clean
- [ ] Visual check in browser confirms no contrast issues on white backgrounds
