# Skill: API Route Scaffolder

## What This Skill Covers

This skill defines how to scaffold every API route in FoodSabi. It covers route structure, request validation, the scope guardrail, error handling, and the specific routes required by the product. Read this alongside `security.md` before creating any API route.

---

## Before You Scaffold Any Route

1. Read `.agents/rules/security.md` for input validation and security rules
2. Read `.agents/rules/code-style.md` for naming and file structure conventions
3. Read `skills/deepseek-integration/SKILL.md` for the `analyzeWithCache` signature (this is your single entry point to DeepSeek)
4. All business logic lives in `lib/` — never import from `@/services/`

---

## Route File Structure

All API routes live under `app/api/` using file-based routing:

```
app/
└── api/
    ├── analyze/
    │   └── route.ts          # POST /api/analyze
    ├── session/
    │   ├── route.ts          # POST /api/session (create new session)
    │   └── [sessionId]/
    │       └── route.ts      # GET  /api/session/:sessionId (fetch history)
    │                         # DELETE /api/session/:sessionId (end session)
    └── upload/
        └── route.ts          # POST /api/upload (receives OCR text, not raw images)
```

> ⚠️ **Client-side OCR mandate**: Per AGENTS.md, OCR runs in the browser via Tesseract.js. The `/api/upload` route receives **extracted text + metadata only** — never raw image files. Image compression and OCR happen client-side before anything reaches the server.

---

## Route Template

Every route must follow this exact structure:

```typescript
// app/api/analyze/route.ts

import { validateAnalyzeRequest } from "@/lib/validators"
import { runGuardrail } from "@/lib/guardrail"
import { analyzeWithCache } from "@/lib/deepseek"
import { persistConversation } from "@/lib/deepseek"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import type { AnalyzeRequest, AnalyzeResponse } from "@/types"

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Parse body
    let body: AnalyzeRequest
    try {
      body = await req.json()
    } catch {
      throw new FoodSabiError("empty_input")
    }

    // 2. Validate input
    validateAnalyzeRequest(body)

    // 3. Scope guardrail & input sanitization
    const guardrailResult = runGuardrail(body.content)
    if (!guardrailResult.allowed) {
      throw new FoodSabiError("out_of_scope")
    }

    // 4. Call DeepSeek (handles cache check → history fetch → API call → cache write)
    const result = await analyzeWithCache(body.sessionId, body.content)

    // 5. Persist messages to session
    await persistConversation(body.sessionId, body.content, body.inputType, JSON.stringify(result))

    // 6. Return structured response
    return Response.json(result)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
```

---

## Required Routes

### POST /api/analyze

**Purpose**: Accepts text, paste, or OCR-extracted text input, runs scope check, calls DeepSeek, returns AI response.

**Request body**:
```typescript
interface AnalyzeRequest {
  sessionId: string       // UUID
  inputType: "text" | "paste" | "image"
  content: string         // The ingredient name, full list, or OCR text
}
```

**Response**:
```typescript
type AnalyzeResponse = IngredientResponse | NutritionalResponse
```

**Pipeline** (all 8 steps from AGENTS.md):
1. **Validate** — `validateAnalyzeRequest(body)` confirms UUID, non-empty content, valid inputType
2. **Guardrail** — `runGuardrail(content)` checks food scope + prompt injection
3. **Cache check** — handled inside `analyzeWithCache`
4. **History fetch** — handled inside `analyzeWithCache` (calls `fetchSessionHistory`)
5. **DeepSeek call** — handled inside `analyzeWithCache` (calls `callDeepSeek`)
6. **Persist** — `persistConversation(...)` stores user + assistant messages
7. **Cache write** — handled inside `analyzeWithCache`
8. **Return** — `Response.json(result)`

---

### POST /api/upload

**Purpose**: Receives OCR-extracted text from client-side Tesseract.js processing. Validates the text, runs guardrail, and returns it wrapped for the analyze pipeline. This route does **not** call DeepSeek.

> ℹ️ **Architecture**: Per AGENTS.md (lines 151-157), compression and OCR run client-side. The server validates MIME type and magic bytes on the original image, but only after receiving the file's metadata alongside the extracted text. The raw image is never stored.

**Request**: `multipart/form-data` with fields:
```
sessionId     : string (UUID)
extractedText : string (OCR output, min 5 chars)
originalFile  : File   (jpg/png/webp — optional, for server-side validation)
fileSize      : number (original file size in bytes)
mimeType      : string (client-reported MIME type)
```

**Response**:
```typescript
interface UploadResponse {
  extractedText: string
  success: boolean
}
```

**Steps**:
1. Validate `sessionId` is a valid UUID
2. Validate `extractedText` is present and at least 5 characters — otherwise return `blurry_image`
3. If `originalFile` is provided, validate server-side:
   - MIME type: `image/jpeg`, `image/png`, `image/webp` only (validate independently of client claim)
   - File magic bytes: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `52 49 46 46`
   - File size: must be under 500KB — otherwise return `image_too_large`
4. Run `runGuardrail` on `extractedText`
5. Return `{ extractedText, success: true }`

> ⚠️ The client takes the returned `extractedText` and sends it to `POST /api/analyze` with `inputType: "image"`.

---

### POST /api/session

**Purpose**: Creates a new session and returns a session ID.

**Request body**: none (session ID generated server-side)

**Response**:
```typescript
interface NewSessionResponse {
  sessionId: string
  createdAt: string
}
```

**Steps**:
1. Generate UUID for session ID
2. Create session record in the database
3. Return `{ sessionId, createdAt }`

---

### DELETE /api/session/:sessionId

**Purpose**: Ends a session and clears conversation history when user taps "New Chat". The client generates a new session ID after receiving the success response.

**Request params**: `sessionId` (UUID)

**Response**:
```typescript
interface EndSessionResponse {
  success: boolean
}
```

**Steps**:
1. Validate `sessionId` is a valid UUID
2. Verify session exists
3. Mark session as `status: "ended"` and delete its messages
4. Return `{ success: true }`
5. *(Client then generates a new UUID and calls `POST /api/session` to begin a fresh conversation)*

---

### GET /api/session/:sessionId

**Purpose**: Fetches conversation history for a session (used on page refresh to restore chat).

**Request params**: `sessionId` (UUID)

**Response**:
```typescript
interface SessionHistoryResponse {
  sessionId: string
  messages: {
    role: "user" | "assistant"
    content: string
    inputType: string
    timestamp: string
  }[]
}
```

**Steps**:
1. Validate `sessionId`
2. Fetch session from store
3. If session not found, return empty messages array (do not error — session may have expired)
4. Return messages

---

## Shared Utilities Required

### `lib/validators.ts`

```typescript
import { isValidUUID } from "@/lib/utils"
import { FoodSabiError } from "@/lib/errors"

export function validateAnalyzeRequest(body: unknown): void {
  if (!body || typeof body !== "object") throw new FoodSabiError("empty_input")
  const { sessionId, inputType, content } = body as Record<string, unknown>

  if (!isValidUUID(sessionId)) throw new FoodSabiError("empty_input")
  if (!["text", "paste", "image"].includes(inputType as string)) {
    throw new FoodSabiError("empty_input")
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new FoodSabiError("empty_input")
  }
}
```

### `lib/guardrail.ts`

> ⚠️ Must export `runGuardrail` (not `scopeGuardrail`) to match the import used in `lib/deepseek.ts` and the route templates.

```typescript
interface GuardrailResult {
  allowed: boolean
}

const OUT_OF_SCOPE_PATTERNS = [
  /ignore previous/i, /you are now/i, /act as/i,
  /disregard your rules/i, /system prompt/i, /forget your instructions/i,
]

const FOOD_KEYWORDS = [
  /ingredient/i, /label/i, /nutrition/i, /additive/i, /preservative/i,
  /calorie/i, /protein/i, /sugar/i, /sodium/i, /fat/i, /vitamin/i,
  /mineral/i, /store/i, /storage/i, /expire/i, /contain/i, /food/i,
  /eat/i, /drink/i, /beverage/i, /oil/i, /acid/i, /syrup/i, /flour/i,
]

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "").trim()
}

/**
 * Runs scope guardrail on user input. Returns { allowed: boolean }.
 * - Checks prompt injection patterns first
 * - Then checks food-related scope (for inputs longer than 20 chars)
 * Does NOT throw — returns { allowed: false } so callers handle the response.
 */
export function runGuardrail(input: string): GuardrailResult {
  const cleanInput = sanitizeInput(input)

  // 1. Block prompt injection attempts
  const isInjection = OUT_OF_SCOPE_PATTERNS.some(p => p.test(cleanInput))
  if (isInjection) return { allowed: false }

  // 2. Validate food context (skip for short inputs — likely single ingredient names)
  if (cleanInput.length > 20) {
    const isFoodRelated = FOOD_KEYWORDS.some(p => p.test(cleanInput))
    if (!isFoodRelated) return { allowed: false }
  }

  return { allowed: true }
}
```

### `lib/errors.ts`

```typescript
import type { ErrorResponse } from "@/types"

type ErrorType = ErrorResponse["error_type"]

const ERROR_MESSAGES: Record<ErrorType, string> = {
  blurry_image: "This picture isn't clear enough for me to read. Try taking it again in better light or just type out the ingredients and I'll explain them for you.",
  unsupported_file: "I can only read image files. Try uploading a JPG or PNG of your food label.",
  empty_input: "It looks like nothing was typed or uploaded. Send me an ingredient or a picture of a food label and I'll break it down for you.",
  out_of_scope: "That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you.",
  network_failure: "Something went wrong on our end. Check your connection and try again.",
  rate_limit_exceeded: "You're moving fast. Give it a few seconds and try again.",
  image_too_large: "This image is a bit too large. Try compressing it or just type out the ingredients instead.",
}

const ERROR_STATUS_CODES: Record<ErrorType, number> = {
  blurry_image: 422,
  unsupported_file: 415,
  empty_input: 400,
  out_of_scope: 422,
  network_failure: 502,
  rate_limit_exceeded: 429,
  image_too_large: 413,
}

export class FoodSabiError extends Error {
  constructor(public errorType: ErrorType) {
    super(errorType)
    this.name = "FoodSabiError"
  }
}

export function mapToErrorResponse(error: unknown): { errorResponse: ErrorResponse; status: number } {
  if (error instanceof FoodSabiError) {
    return {
      errorResponse: {
        error_code: error.errorType,
        error_type: error.errorType,
        user_message: ERROR_MESSAGES[error.errorType],
      },
      status: ERROR_STATUS_CODES[error.errorType],
    }
  }
  return {
    errorResponse: {
      error_code: "network_failure",
      error_type: "network_failure",
      user_message: ERROR_MESSAGES["network_failure"],
    },
    status: 502,
  }
}
```

### `lib/utils.ts`

Add `isValidUUID` here (not in `validators.ts`), consistent with AGENTS.md's description: *"Shared helpers (UUID generation, etc.)"*:

```typescript
export function isValidUUID(value: unknown): boolean {
  if (typeof value !== "string") return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
```

### `lib/constants.ts`

code-style.md (line 213-221) describes this file. Create it with shared constants:

```typescript
export const MAX_IMAGE_SIZE_KB = 500
export const SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"]
export const MAX_HISTORY_LENGTH = 10
export const DEEPSEEK_MODEL = "deepseek-chat"
export const AI_IDENTITY_NAME = "FoodSabi"
```

---

## Rules Summary

- Every route validates input before doing anything else
- Every route runs the scope guardrail (`runGuardrail`) before calling `analyzeWithCache`
- Every route wraps its logic in try/catch and returns `{ errorResponse, status }` via `mapToErrorResponse`
- Never expose raw errors or stack traces
- Image processing (compression + OCR) runs **client-side** — the upload route receives text, never raw images
- The upload route validates image metadata server-side if provided, but does not store or process images
- Import from `@/lib/` only — never `@/services/`
