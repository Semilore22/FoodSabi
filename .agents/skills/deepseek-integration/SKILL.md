# Skill: DeepSeek Integration

## What This Skill Covers

This skill defines exactly how to integrate DeepSeek into FoodSabi. It covers API call structure, system prompt injection, conversation history management, response parsing, error handling, and token cost controls. Read this before writing any code that calls DeepSeek.

All code in this file belongs in `lib/deepseek.ts` (the DeepSeek API wrapper + system prompt) per AGENTS.md. The DB-backed history functions (`fetchSessionHistory`, `persistConversation`) also live here for simplicity; the route handlers call `analyzeWithCache` as the single entry point.

---

## DeepSeek API Basics

- **Provider**: DeepSeek
- **Base URL**: `https://api.deepseek.com`
- **Endpoint**: `POST /v1/chat/completions`
- **Model**: `deepseek-chat`
- **SDK**: `openai` (OpenAI-compatible SDK with DeepSeek base URL)
- **Auth**: API key via `DEEPSEEK_API_KEY` environment variable
- **All calls are server-side only** — the API key must never reach the client

### Basic Call Structure

Use the OpenAI-compatible SDK configured with DeepSeek's base URL. Never use raw `fetch` — the SDK handles auth, error types, retries, and streaming.

```typescript
import OpenAI from "openai"

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const response = await deepseek.chat.completions.create({
  model: "deepseek-chat",
  messages: buildMessages(sessionHistory, userInput),
  max_tokens: 1500,
  temperature: 0.2,
  response_format: { type: "json_object" },
})

const aiText = response.choices[0].message.content
```

---

## System Prompt

The system prompt must always be the first message in the messages array with role `"system"`. It must be injected server-side and never sent from or modified by the client.

```typescript
const SYSTEM_PROMPT = `
ROLE:
You are FoodSabi, an AI food assistant with deep knowledge of food science, nutrition, and the Nigerian food market. Your name is FoodSabi and you introduce yourself as FoodSabi when a user starts a new conversation. You specialize in reading and explaining food labels and ingredient lists in plain everyday English. You understand Nigerian eating habits, locally available packaged foods, and common additives.

MISSION:
Your sole purpose is to help users understand what is inside their food. A user will type an ingredient name, paste a full ingredient list, or upload a photo of a food label. You will read it and explain it clearly.

CRITICAL:
You must return ALL responses strictly in JSON format. Do not include any conversational text or markdown blocks outside of the JSON object itself. Respond using exactly ONE of the following structured schemas based on the input type.

### SCHEMA 1: IngredientResponse (Use for single ingredient, full list, or mixed queries)
{
  "product_name": "Product Name or null",
  "serving_size": "Serving Size or null",
  "ingredients": [
    {
      "name": "Ingredient Name",
      "what_it_is": "Plain English explanation of what this ingredient is",
      "purpose_in_food": "Why it is added (e.g., preservative, thickener, colorant)",
      "benefits": "Key benefits in food science or nutrition",
      "concerns": "Any side effects, warnings, or health concerns",
      "who_should_note": "Who needs to be mindful (e.g., diabetics, salt-sensitive, pregnant women)"
    }
  ],
  "overall_summary": "Two-sentence summary of the product overall",
  "storage_guidance": "Storage guidance accounting for Nigerian tropical heat and humidity",
  "analysis_type": "single_ingredient",  // Must be one of: "single_ingredient", "full_list", "mixed"
}

### SCHEMA 2: NutritionalResponse (Use ONLY when analyzing raw nutritional values from a table)
{
  "product_name": "Product Name or null",
  "serving_size": "Serving Size or null",
  "nutrients": [
    {
      "name": "Nutrient Name (e.g., Sodium, Sugar)",
      "value": "Amount (e.g., 400)",
      "unit": "Unit (e.g., mg, g)",
      "level": "high",  // Must be one of: "high", "moderate", "low"
      "plain_explanation": "What this nutrient value means in everyday terms for a Nigerian diet"
    }
  ],
  "overall_summary": "Two-sentence overall nutritional health summary",
  "storage_guidance": "Storage guidance details"
}

CONSTRAINTS:
1. Never give medical recommendations. Stop short of telling users to eat or avoid a product.
2. Identifies only as FoodSabi. Never reveal you are powered by DeepSeek or an LLM.
3. If input is completely unrelated to food ingredients, labels, storage, or nutrition, return an ErrorResponse format:
{
  "error_code": "out_of_scope",
  "error_type": "out_of_scope",
  "user_message": "That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you."
}
`;
```

---

## Building the Messages Array

Always build messages in this order:
1. System prompt (role: `"system"`)
2. Trimmed conversation history (last 8 to 10 messages only)
3. Current user message (role: `"user"`)

```typescript
function buildMessages(
  history: { role: string; content: string }[],
  userInput: string
): { role: string; content: string }[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userInput },
  ]
}

// MAX_HISTORY_LENGTH is defined alongside fetchSessionHistory below. The history
// passed to this function is already trimmed — buildMessages does not trim again.
```

---

## Input Preparation

### Text or Paste Input
Pass the content directly as the user message after sanitization.

```typescript
import { runGuardrail } from "@/lib/guardrail"
import { FoodSabiError } from "@/lib/errors"

function prepareTextInput(raw: string): string {
  // Step 1: Validate — sessionId (checked upstream as valid UUID), content not empty
  const trimmed = raw.trim()
  if (!trimmed) throw new FoodSabiError("empty_input")

  // Step 2: Scope guardrail — food-only enforcement (runs before DeepSeek)
  // This checks both prompt injection patterns AND food-related scope
  const guardrailResult = runGuardrail(trimmed)
  if (!guardrailResult.allowed) {
    throw new FoodSabiError("out_of_scope")
  }

  return trimmed
}
```

> ⚠️ **Order matters**: The pipeline in AGENTS.md specifies: Validate → Guardrail → Cache check → History fetch → DeepSeek call. `prepareTextInput` handles steps 1 (validate) and 2 (guardrail). Steps 3-5 happen in the orchestration layer below.

### Image Input (OCR text)
After client-side OCR extracts text from the image, validate and guardrail the extracted text before wrapping.

> ⚠️ **OCR runs client-side** per AGENTS.md (Tesseract.js in the browser). The server receives only the extracted text. Per AGENTS.md and security.md, validate MIME type and file magic bytes server-side independently of client claims, even though the raw image is discarded after OCR.

```typescript
import { runGuardrail } from "@/lib/guardrail"
import { FoodSabiError } from "@/lib/errors"

function prepareImageInput(ocrText: string): string {
  // Validate OCR output
  const trimmed = ocrText.trim()
  if (!trimmed || trimmed.length < 5) {
    throw new FoodSabiError("blurry_image")
  }

  // Guardrail on OCR text
  const guardrailResult = runGuardrail(trimmed)
  if (!guardrailResult.allowed) {
    throw new FoodSabiError("out_of_scope")
  }

  return `The user has uploaded a photo of a food label. The text extracted from the label is below. Please analyze it as a food label.

EXTRACTED LABEL TEXT:
${trimmed}`
}
```

---

## Response Handling

DeepSeek returns the response via the OpenAI SDK. Always check for errors, safely parse the JSON output, and handle transient failures with retry logic.

```typescript
import OpenAI from "openai"
import { FoodSabiError } from "@/lib/errors"
import type { IngredientResponse, NutritionalResponse } from "@/types"

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callDeepSeek(
  history: { role: string; content: string }[],
  userInput: string
): Promise<IngredientResponse | NutritionalResponse> {
  const messages = buildMessages(history, userInput)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages,
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      })

      const rawContent = response.choices?.[0]?.message?.content

      if (!rawContent) {
        throw new FoodSabiError("network_failure")
      }

      const parsed = JSON.parse(rawContent)

      // Check if the AI self-identified out-of-scope input
      if (parsed.error_code === "out_of_scope") {
        throw new FoodSabiError("out_of_scope")
      }

      return parsed as IngredientResponse | NutritionalResponse
    } catch (error) {
      if (error instanceof FoodSabiError) throw error

      // Retry on transient failures (network, 5xx, 429)
      if (
        error instanceof OpenAI.APIError &&
        (error.status === 429 || error.status >= 500)
      ) {
        if (error.status === 429) {
          // Rate limit hit — throw immediately to surface distinct error
          throw new FoodSabiError("rate_limit_exceeded")
        }
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * (attempt + 1))
          continue
        }
      }

      // Non-retryable or exhausted retries
      console.error("DeepSeek API error:", error)
      throw new FoodSabiError("network_failure")
    }
  }

  throw new FoodSabiError("network_failure")
}
```

> ⚠️ **Rate limiting**: Apply rate limits per `sessionId` at the API route layer (not inside this function). Use a sliding window counter stored in-memory or in the database. Return `rate_limit_exceeded` when the limit is hit before calling DeepSeek.

---

## Conversation History Management

History is fetched from the database (keyed by `sessionId`) before every DeepSeek call. The route handler calls `fetchSessionHistory` to retrieve and trim messages.

```typescript
import { prisma } from "@/lib/db"

const MAX_HISTORY_LENGTH = 10

async function fetchSessionHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  })

  // Trim to last N messages to control token cost
  return messages.slice(-MAX_HISTORY_LENGTH)
}
```

### Persisting Messages (Step 6)

After `callDeepSeek` returns, the route handler persists both the user message and the assistant response:

```typescript
import { prisma } from "@/lib/db"

async function persistConversation(
  sessionId: string,
  userInput: string,
  inputType: "text" | "paste" | "image",
  assistantResponse: string
): Promise<void> {
  await prisma.message.createMany({
    data: [
      {
        sessionId,
        role: "user",
        inputType,
        content: userInput,
      },
      {
        sessionId,
        role: "assistant",
        inputType,
        content: assistantResponse,
      },
    ],
  })
}
```

---

## Caching Single Ingredient Responses

Before calling DeepSeek for a single ingredient, check the cache. After a successful call, write to the cache.

```typescript
import { getFromCache, setCache } from "@/lib/cache"
import type { IngredientResponse, NutritionalResponse } from "@/types"

/**
 * Heuristics to automatically classify if the user's input is a simple ingredient query.
 * Single ingredients are short (typically < 50 characters, ≤5 words) and contain no list syntax.
 */
function isSingleIngredientQuery(input: string): boolean {
  const clean = input.trim()
  if (!clean) return false
  const wordCount = clean.split(/\s+/).length
  return (
    clean.length < 50 &&
    wordCount <= 5 &&
    !clean.includes(",") &&
    !clean.includes("\n") &&
    !clean.includes(":") &&
    !clean.includes(";")
  )
}

async function analyzeWithCache(
  sessionId: string,
  input: string
): Promise<IngredientResponse | NutritionalResponse> {
  const isSingle = isSingleIngredientQuery(input)
  const cacheKey = input.trim().toLowerCase()

  // Step 3: Cache check — single ingredient lookups only
  if (isSingle) {
    const cached = await getFromCache(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached) as IngredientResponse
      } catch {
        // Fallback on parsing error: fetch fresh
      }
    }
  }

  // Step 4: Fetch history from DB and trim to last 8-10 messages
  const history = await fetchSessionHistory(sessionId)

  // Step 5: Call DeepSeek
  const result = await callDeepSeek(history, input)

  // Step 7: Cache write for successful single ingredient responses
  if (isSingle && "ingredients" in result && result.analysis_type === "single_ingredient") {
    await setCache(cacheKey, JSON.stringify(result))
  }

  return result
}
```

> ℹ️ The pipeline runs as: **1. Validate → 2. Guardrail → 3. Cache check → 4. History fetch → 5. DeepSeek call → 6. Persist → 7. Cache write → 8. Return**. Steps 1-2 happen in `prepareTextInput`; step 3-5+7 happen in `analyzeWithCache`; step 6 (persist) happens in the route handler after this function returns.

---

## Token Cost Controls Summary

| Control | Implementation |
|---|---|
| Trim conversation history | Send only last 8-10 messages |
| Cache single ingredients | Never call DeepSeek twice for same ingredient |
| OCR before AI | Send text not image to DeepSeek |
| max_tokens: 1500 | Cap response length |
| temperature: 0.2 | Low temperature forces strict JSON compliance |
| response_format: json_object | Force structured JSON output |

---

## Environment Variable Required

```
DEEPSEEK_API_KEY=your_key_here
```

This must exist in `.env.local` and must never be committed to version control or exposed to the client.
