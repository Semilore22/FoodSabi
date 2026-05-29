---
trigger: always_on
---

# Code Style Rules — FoodSabi

## Overview

This document defines the coding standards, naming conventions, and formatting rules for the FoodSabi codebase. Every piece of code written for this project must follow these rules. Read this before writing any code.

---

## General Principles

- Write code that is readable first, clever second
- Every function does one thing
- Every file has one clear responsibility
- If a function is longer than 40 lines, break it apart
- If a file is longer than 200 lines, consider splitting it
- No commented-out dead code in the codebase
- No console.log statements left in production code — use a logger

---

## Naming Conventions

### Files and Folders
- Folders: `kebab-case` (e.g. `api-routes`, `chat-bubble`)
- Component files: `PascalCase` (e.g. `ChatBubble.tsx`, `UploadButton.tsx`)
- Utility files: `camelCase` (e.g. `formatResponse.ts`, `compressImage.ts`)
- API route files: `kebab-case` (e.g. `analyze-ingredient.ts`)
- Skill and rule markdown files: `kebab-case` (e.g. `code-style.md`)

### Variables and Functions
- Variables: `camelCase` (e.g. `sessionId`, `extractedText`)
- Functions: `camelCase`, verb-first (e.g. `analyzeIngredient`, `compressImage`, `buildPrompt`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g. `MAX_IMAGE_SIZE_KB`, `MAX_HISTORY_LENGTH`)
- Types and interfaces: `PascalCase` (e.g. `IngredientDetail`, `SessionSchema`)
- Enums: `PascalCase` with `PascalCase` members (e.g. `InputType.Image`)
- Boolean variables: prefix with `is`, `has`, or `can` (e.g. `isCompressed`, `hasOcrText`, `canRetry`)

### API Routes
- All API routes use `kebab-case` and are prefixed with `/api/`
- Examples: `/api/analyze`, `/api/new-session`, `/api/upload`

---

## TypeScript Rules

- TypeScript is required for all files. No plain JavaScript.
- Strict mode must be enabled in `tsconfig.json`
- No use of `any` type. Use `unknown` and narrow it, or define a proper type
- All function parameters and return types must be explicitly typed
- All API request and response bodies must be typed using the schemas from the PRD
- Use `interface` for object shapes, `type` for unions and intersections

```typescript
// Correct
interface IngredientDetail {
  name: string
  whatItIs: string
  purposeInFood: string
  benefits: string
  concerns: string
  whoShouldNote: string
}

// Wrong — no any, no implicit returns
const analyzeIngredient = (input: any) => {
  return something
}
```

---

## Function Structure

Every function must follow this order:
1. Input validation / guard clauses first
2. Core logic in the middle
3. Return statement last

```typescript
// Correct
async function analyzeIngredient(input: string): Promise<IngredientResponse> {
  if (!input || input.trim().length === 0) {
    throw new FoodSabiError("empty_input")
  }

  const cached = await getFromCache(input)
  if (cached) return cached

  const response = await callDeepSeek(input)
  await setCache(input, response)

  return response
}
```

---

## Error Handling

- Never throw raw errors to the client
- All errors must be caught and mapped to an `ErrorResponse` object
- Create a central `FoodSabiError` class that accepts an `error_type` from the schema
- Every async function must have a try/catch or be wrapped in a handler

```typescript
// Correct pattern
try {
  const result = await analyzeIngredient(input)
  return res.json(result)
} catch (error) {
  const mapped = mapToErrorResponse(error)
  return res.status(400).json(mapped)
}
```

---

## API Route Structure

Every API route file must follow this structure:

```typescript
// 1. Imports
import { validateInput } from "@/lib/validators"
import { scopeGuardrail } from "@/lib/guardrail"
import { analyzeIngredient } from "@/services/deepseek"

// 2. Request type
interface AnalyzeRequest {
  sessionId: string
  inputType: "text" | "paste" | "image"
  content: string
}

// 3. Handler function
export async function POST(req: Request) {
  try {
    const body: AnalyzeRequest = await req.json()

    // Validate
    validateInput(body)

    // Scope check
    scopeGuardrail(body.content)

    // Process
    const result = await analyzeIngredient(body)

    return Response.json(result)
  } catch (error) {
    return Response.json(mapToErrorResponse(error), { status: 400 })
  }
}
```

---

## Component Structure

Every UI component file must follow this order:

```typescript
// 1. Imports (external libraries first, then internal)
import { useState } from "react"
import { ChatBubble } from "@/components/ChatBubble"

// 2. Types
interface ChatWindowProps {
  sessionId: string
  messages: Message[]
}

// 3. Component function
export function ChatWindow({ sessionId, messages }: ChatWindowProps) {
  // 3a. State
  const [input, setInput] = useState("")

  // 3b. Handlers
  const handleSubmit = () => { ... }

  // 3c. Render
  return (
    <div>...</div>
  )
}
```

---

## Comments

- Write comments that explain **why**, not **what** — the code itself explains what
- Every exported function must have a JSDoc comment
- Complex business logic (scope guardrail, OCR pipeline, history trimming) must have inline comments

```typescript
/**
 * Checks whether the user input is food-related.
 * Rejects anything outside ingredient, label, composition, or storage topics.
 * Returns an ErrorResponse if out of scope, otherwise passes through.
 */
export function scopeGuardrail(input: string): void { ... }
```

---

## Constants

All magic numbers and strings must be extracted to a constants file:

```typescript
// lib/constants.ts
export const MAX_IMAGE_SIZE_KB = 500
export const MAX_HISTORY_LENGTH = 10
export const SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"]
export const DEEPSEEK_MODEL = "deepseek-chat"
export const AI_IDENTITY_NAME = "FoodSabi"
```

---

## Imports

- Use absolute imports with `@/` prefix, never relative `../../`
- Group imports: external packages first, then internal modules, then types
- No unused imports

---

## Formatting

- 2-space indentation
- Single quotes for strings
- No semicolons (unless required by the framework)
- Trailing commas in multi-line objects and arrays
- Maximum line length: 100 characters
- Prettier is the formatter — do not override its decisions manually