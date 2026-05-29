# AGENTS.md — FoodSabi

## What This Product Is

FoodSabi is a **mobile-first AI-powered food label assistant** for Nigerian users. A user types an ingredient name, pastes a full ingredient list, or uploads a photo of a food label, and the app instantly explains what every ingredient is, its purpose, benefits, concerns, and how to store the product — all in plain everyday English.

**Core promise:** *Know your food. Sabi your ingredients.*

The primary market is **everyday Nigerians** — mobile-heavy, packaged-food consumers who encounter unfamiliar ingredient names daily and have no accessible tool to understand what they are eating. The app serves both casual consumers and health-conscious users through the same interface without overwhelming either.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL |
| ORM | Prisma |
| AI / LLM | DeepSeek API (`deepseek-chat`) via OpenAI-compatible SDK |
| OCR | Tesseract.js (client-side image text extraction) |
| Image Compression | browser-image-compression (client-side, before upload) |
| Styling | CSS Modules + CSS custom properties (design tokens) |
| Auth | None — no sign-up required |
| Storage | Session-scoped (server-side, keyed by session ID) |
| Hosting | Vercel |

---

## Folder Structure

```
foodsabi/
├── app/
│   └── api/
│       ├── session/
│       │   ├── route.ts              ← POST: create session
│       │   └── [sessionId]/
│       │       └── route.ts          ← GET: fetch history | DELETE: end session
│       ├── analyze/
│       │   └── route.ts              ← POST: text/paste analysis via DeepSeek
│       └── upload/
│           └── route.ts              ← POST: image OCR + analysis
├── components/
│   ├── ui/                           ← primitive components (IconButton, Toggle, Spinner)
│   └── chat/                         ← ChatWindow, ChatBubble, ChatInput, TypingIndicator,
│                                        ImagePreview, UploadButton, EmptyState, ErrorMessage
├── lib/
│   ├── db.ts                         ← Prisma client singleton
│   ├── deepseek.ts                   ← DeepSeek API wrapper + system prompt
│   ├── guardrail.ts                  ← Scope guardrail — food-only enforcement
│   ├── ocr.ts                        ← Tesseract OCR wrapper
│   ├── compress.ts                   ← Client-side image compression helper
│   ├── cache.ts                      ← Ingredient response cache (read/write)
│   ├── errors.ts                     ← FoodSabiError class + mapToErrorResponse
│   ├── validators.ts                 ← Request body validation helpers
│   └── utils.ts                      ← Shared helpers (UUID generation, etc.)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tokens/
│   ├── colors.css                    ← DO NOT touch. Design token source of truth.
│   └── typography.css                ← DO NOT touch. Design token source of truth.
└── types/
    └── index.ts                      ← Shared TypeScript types
```

---

## Data Models

These match the database schema exactly. Use these as the reference for all data operations.

### Session
```prisma
id           String    @id @default(cuid())
sessionId    String    @unique
createdAt    DateTime  @default(now())
lastActiveAt DateTime  @updatedAt
status       String    @default("active")   ← "active" | "ended"
messages     Message[]
```

### Message
```prisma
id          String   @id @default(cuid())
sessionId   String
role        String                           ← "user" | "assistant"
inputType   String                           ← "text" | "paste" | "image"
content     String
imageUrl    String?
createdAt   DateTime @default(now())
session     Session  @relation(...)
```

### IngredientCache
```prisma
id           String   @id @default(cuid())
cacheKey     String   @unique              ← normalized lowercase ingredient name
responseText String
hitCount     Int      @default(0)
createdAt    DateTime @default(now())
```

---

## Key Business Rules

- **No authentication required**: FoodSabi is fully accessible without account creation. Users begin immediately on app open.
- **Session ID is the only identity**: Every user is identified by an auto-generated UUID session ID. No PII is collected or stored at any point.
- **Session history must survive page refresh**: Conversation history is stored server-side keyed by session ID and must be restored on reload. Do not rely on in-memory state alone.
- **OCR before AI**: Images must be compressed client-side to under 500KB and OCR-extracted before anything is sent to DeepSeek. Never send raw image files to the AI.
- **Scope guardrail is mandatory**: Run `guardrail.ts` on every piece of user input before it reaches DeepSeek. Reject anything outside food ingredients, food labels, food composition, and food storage topics.
- **Cache single ingredient lookups**: Before calling DeepSeek for a single ingredient query, check `IngredientCache` by normalized key. Return the cached response if it exists. Write to cache after every successful single-ingredient call.
- **History trimming**: Send only the last 8 to 10 messages from the session history to DeepSeek per request. Never send the full history regardless of session length.
- **Prompt injection protection**: Sanitize all user input before injecting it into DeepSeek prompts. Detect and reject override attempts ("ignore previous instructions", "act as", "you are now", etc.) with the out-of-scope error response.
- **No medical advice**: The AI must never recommend eating or avoiding a food for medical reasons. It may flag that an ingredient is something people with certain conditions often monitor, but must always stop short of a medical recommendation.
- **AI identity**: The AI always identifies itself as FoodSabi. It must never reveal that it is powered by DeepSeek or any underlying model.
- **Image constraints**: Accept JPG, PNG, WEBP only. Maximum 500KB after client-side compression. Validate MIME type and file magic bytes server-side independently of client claims.
- **New chat resets session**: When the user requests a new chat, mark the current session as `status: "ended"`, clear its messages, and generate a new session ID.
- **Dark mode default**: The app launches in dark mode. The user can toggle to light mode manually. Preference is saved for the duration of the session.

---

## Environment Variables Required

```
DATABASE_URL
DEEPSEEK_API_KEY      ← Server-side only. Never expose to the client.
```

All secrets live in `.env.local`. Never hardcode them. Never log them. `DEEPSEEK_API_KEY` must never appear in any client-side code or be sent to the browser under any circumstances. Provide a `.env.example` with placeholder values for onboarding.

---

## Content Processing Pipeline

When a user sends a message, the system must follow this exact sequence. Do not skip or reorder steps.

**Text or Paste Input:**
1. **Validate** — Confirm `sessionId` is a valid UUID and `content` is not empty. Reject immediately on failure.
2. **Guardrail** — Run `guardrail.ts` on the content. If out of scope or injection attempt detected, return the out-of-scope error response immediately.
3. **Cache check** — If input appears to be a single ingredient, check `IngredientCache` by normalized key. Return cached response if found, skip to step 6.
4. **History fetch** — Retrieve session messages from the database. Trim to last 8–10 messages.
5. **DeepSeek call** — Build the messages array (system prompt + trimmed history + user input) and call `lib/deepseek.ts`.
6. **Persist** — Append user message and assistant response to the session in the database.
7. **Cache write** — If the query was a single ingredient and cache was missed, write the response to `IngredientCache`.
8. **Return** — Send the response to the client.

**Image Input:**
1. **Compress** — Client-side compression to under 500KB before upload.
2. **OCR** — Run Tesseract.js client-side to extract text from the image before sending anything to the server.
3. **Validate** — Confirm `sessionId`, file format (JPG/PNG/WEBP), file size, and that OCR text is not empty. Validate MIME type and magic bytes server-side. Reject on any failure with the appropriate error response.
4. **Guardrail** — Run `guardrail.ts` on the OCR-extracted text.
5. **History fetch + DeepSeek call** — Same as text pipeline steps 4 and 5, using the OCR text wrapped in the image input format.
6. **Persist + Return** — Same as text pipeline steps 6 and 8.

> ⚠️ If any step fails, return the appropriate ErrorResponse with a user-friendly message. Never expose raw errors or stack traces to the client.

---

## User Flows

**New User → Analyze:**
Open app → Session ID auto-generated → Type ingredient or upload label photo → View AI explanation → Ask follow-up questions → Continue conversation

**Image Upload Flow:**
Tap upload button → Select photo from camera or gallery → Client compresses image → OCR extracts text → Text sent to analyze API → AI reads label and responds

**New Chat:**
User taps "New Chat" → Current session ended → New session ID generated → Fresh conversation begins

**Error Recovery:**
Any step fails → Inline error message shown in chat → User can retry without losing previous messages

---

## System States and Lifecycle

| State | Description |
|---|---|
| `idle` | App open, no messages yet — show empty state with prompt |
| `typing` | User is composing a message |
| `loading` | Request sent, waiting for AI response — show typing indicator |
| `responding` | AI response received — render in chat bubble |
| `error` | Something failed — show inline error message in chat |
| `image_selected` | Image chosen but not yet sent — show preview with remove option |
| `ocr_processing` | OCR running on image client-side — show loading state in input bar |

- All state transitions must have visible UI feedback.
- State must persist across page refreshes using session ID and server-side history.
- Errors must never result in lost conversation history. Preserve all previously delivered messages.

---

## Notifications and Feedback

Surface feedback to the user for every one of these events:

- Image selected successfully (thumbnail preview shown)
- Image too large or wrong format (inline error in input bar)
- OCR failed or returned no text (prompt user to retype or retake)
- Request sent (typing indicator shown in chat)
- AI response received (rendered as chat bubble)
- Network failure (inline error message with retry option)
- Rate limit reached (inline message with retry guidance)
- New chat started (chat cleared, fresh empty state shown)

---

## Error States

Every error returns an ErrorResponse object. User-facing messages are defined here and must not be changed arbitrarily.

| Error Type | User Facing Message |
|---|---|
| `blurry_image` | "This picture isn't clear enough for me to read. Try taking it again in better light or just type out the ingredients and I'll explain them for you." |
| `unsupported_file` | "I can only read image files. Try uploading a JPG or PNG of your food label." |
| `image_too_large` | "This image is a bit too large. Try compressing it or just type out the ingredients instead." |
| `empty_input` | "It looks like nothing was typed or uploaded. Send me an ingredient or a picture of a food label and I'll break it down." |
| `out_of_scope` | "That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you." |
| `network_failure` | "Something went wrong on our end. Check your connection and try again." |
| `rate_limit_exceeded` | "You're moving fast. Give it a few seconds and try again." |

---

## Security and Compliance

- `DEEPSEEK_API_KEY` is server-side only — never pass it to the client or log it anywhere.
- Validate all image uploads server-side (MIME type, magic bytes, file size) — never trust client-side validation alone.
- Sanitize all user input and OCR-extracted text before passing to DeepSeek to prevent prompt injection.
- No PII is collected or stored at any point — session IDs are anonymous UUIDs only.
- Do not log request bodies containing user-typed content in production.
- Do not store uploaded image files persistently — process and discard.
- Never expose the system prompt to the client.
- Validate `sessionId` as a proper UUID on every request before any processing.
- Session data must not be accessible across session IDs.

---

## Coding Guidelines for the Agent

- **Mobile-first UI always**: Stack layouts vertically, use large touch targets (minimum 44px), and avoid hover-only interactions. Every screen must work on a 375px-wide viewport.
- **DeepSeek usage**: Always call the DeepSeek API through `lib/deepseek.ts`. Never import the OpenAI-compatible SDK or construct prompts outside of this file. The system prompt lives in `lib/deepseek.ts` and is injected server-side only.
- **Guardrail usage**: Always call `lib/guardrail.ts` before any user content reaches DeepSeek. This is non-negotiable on every route that handles user input.
- **Prisma usage**: Always use the Prisma client singleton from `lib/db.ts`. Never instantiate a new Prisma client elsewhere.
- **Cache usage**: Always call `lib/cache.ts` for ingredient cache reads and writes. Never query `IngredientCache` directly in a route handler.
- **Error handling**: Every async operation must have a try/catch. All errors must be caught, mapped through `lib/errors.ts`, and returned as ErrorResponse. Never silently swallow errors. Never return raw error objects or stack traces to the client.
- **OCR and compression are client-side**: Image compression and OCR run in the browser before anything is uploaded. The server receives only extracted text and metadata, never raw images.
- **History trimming**: Always trim conversation history to the last 8–10 messages before building the DeepSeek messages array. This must happen inside `lib/deepseek.ts`.
- **Type safety**: All data operations must use the shared types defined in `types/index.ts`. Do not use `any`.
- **Design tokens**: Use only CSS custom properties from `tokens/colors.css` and `tokens/typography.css` for all styling. Do not hardcode color or font values anywhere in the codebase.
- **AI identity**: Never let the AI refer to itself as DeepSeek, an LLM, or any model name. It is FoodSabi. Enforce this in the system prompt in `lib/deepseek.ts`.
- **No medical advice**: No route, prompt, or component may suggest that the AI's output is medical advice. The system prompt must explicitly forbid it.
- **Progressive disclosure**: The chat interface guides the user naturally — one message at a time. Do not surface all options at once.
- **Performance**: Lazy-load heavy components. Prioritize fast first paint. OCR should not block the UI thread — run it in a Web Worker if possible.