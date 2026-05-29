---
trigger: always_on
---

# Architecture Rules — FoodSabi

## Overview

FoodSabi is a mobile-first conversational AI web application. This document defines the architectural decisions, patterns, and constraints that must be followed throughout the entire codebase. Read this before making any structural or infrastructure decision.

---

## Application Architecture

### Layer Structure

```
Client (Mobile Browser)
        │
        ▼
  Frontend Layer          → UI, chat interface, image upload, OCR compression
        │
        ▼
   API Layer              → Route handlers, request validation, scope guardrail
        │
        ▼
  Service Layer           → DeepSeek integration, OCR processing, cache logic
        │
        ▼
  Data Layer              → Session store, ingredient response cache
```

### Responsibilities Per Layer

**Frontend Layer**
- Renders the chat interface
- Handles user input: text, paste, and image upload
- Compresses images client-side to under 500KB before sending
- Manages session ID in local/session storage
- Manages dark/light mode toggle and preference persistence

**API Layer**
- Validates all incoming requests
- Enforces input type constraints (text, image, paste)
- Runs the scope guardrail check before forwarding to the service layer
- Returns structured error responses using the ErrorResponse schema
- Never exposes raw errors or stack traces to the client

**Service Layer**
- Handles all DeepSeek API calls
- Runs OCR on uploaded images before passing text to DeepSeek
- Manages conversation history trimming (last 8 to 10 messages only)
- Checks and writes to the ingredient response cache
- Formats AI responses according to the response schemas in the PRD

**Data Layer**
- Session store: holds conversation history keyed by session ID
- Ingredient cache: stores previously analyzed single-ingredient responses
- No persistent user data. No PII stored at any point.

---

## Data Flow

### Text or Paste Input

```
User types/pastes → API validates → Scope guardrail check →
Cache check (single ingredient only) → DeepSeek call (if cache miss) →
Format response → Return to client → Render in chat
```

### Image Upload

```
User uploads image → Client compresses to <500KB →
API receives compressed image → OCR extracts text →
Scope guardrail check on extracted text →
Cache check (single ingredient only) →
DeepSeek call with extracted text (if cache miss) →
Format response → Return to client → Render in chat
```

---

## Session Architecture

- Session ID is auto-generated (UUID) when the app is first opened
- Session ID is stored client-side and sent with every request
- All conversation history is stored server-side keyed by session ID
- Only the last 8 to 10 messages are sent to DeepSeek per request to manage token costs
- Session history must survive page refresh — do not rely on in-memory state alone
- Session resets only when the user explicitly requests a new chat

---

## Schemas

All data structures must conform to the schemas defined in the PRD. These are reproduced here for reference:

### Session
```
Session {
  session_id       : string (UUID, auto generated)
  created_at       : timestamp
  last_active      : timestamp
  messages         : Message[]
  status           : "active" | "ended"
}
```

### Message
```
Message {
  message_id       : string (UUID)
  session_id       : string
  role             : "user" | "assistant"
  input_type       : "text" | "image" | "paste"
  content          : string
  image_url        : string | null
  timestamp        : timestamp
  response         : IngredientResponse | NutritionalResponse | ErrorResponse
}
```

### Input
```
Input {
  type             : "text" | "image" | "paste"
  raw_content      : string
  image_file       : File | null
  image_format     : "jpg" | "png" | "webp" | null
  image_size_limit : 500KB
  image_compressed : boolean
  ocr_extracted    : string | null
  sent_to_ai_as    : "text"
}
```

### IngredientResponse
```
IngredientResponse {
  product_name     : string | null
  serving_size     : string | null
  ingredients      : IngredientDetail[]
  overall_summary  : string
  storage_guidance : string
  analysis_type    : "single_ingredient" | "full_list" | "nutritional_label" | "mixed"
}

IngredientDetail {
  name             : string
  what_it_is       : string
  purpose_in_food  : string
  benefits         : string
  concerns         : string
  who_should_note  : string
}
```

### NutritionalResponse
```
NutritionalResponse {
  product_name     : string | null
  serving_size     : string | null
  nutrients        : NutrientDetail[]
  overall_summary  : string
  storage_guidance : string
}

NutrientDetail {
  name             : string
  value            : string
  unit             : string
  level            : "high" | "moderate" | "low"
  plain_explanation: string
}
```

### ErrorResponse
```
ErrorResponse {
  error_code       : string
  error_type       : "blurry_image" | "unsupported_file" | "empty_input" |
                     "out_of_scope" | "network_failure" | "rate_limit_exceeded" |
                     "image_too_large"
  user_message     : string
}
```

---

## Caching Strategy

- Cache key: normalized lowercase ingredient name (single ingredients only)
- Cache value: serialized IngredientResponse object
- Cache TTL: indefinite (ingredient data does not change)
- Cache invalidation: manual only
- Full ingredient lists and nutritional labels are NOT cached — too unique per product
- Cache must be checked before every single-ingredient DeepSeek call

---

## Rate Limiting

- Apply rate limiting at the API layer per session ID
- Image upload requests have a tighter rate limit than text requests
- When rate limit is exceeded return ErrorResponse with error_type: "rate_limit_exceeded"
- Specific limits are left to the developer based on DeepSeek API pricing and infrastructure

---

## Error Handling

Every error must be caught at the API layer and returned as an ErrorResponse. The following error types must be handled:

| Error Type | Trigger |
|---|---|
| blurry_image | OCR returns empty or unreadable text |
| unsupported_file | File format is not JPG, PNG, or WEBP |
| empty_input | Request body has no content |
| out_of_scope | Scope guardrail rejects the input |
| network_failure | DeepSeek API call fails |
| rate_limit_exceeded | Session exceeds request threshold |
| image_too_large | Image exceeds 500KB after compression attempt |

---

## What Must Never Happen

- Raw image files sent to DeepSeek
- PII stored anywhere in the system
- Stack traces or raw error objects returned to the client
- Calls to any AI provider other than DeepSeek
- Medical advice returned in any AI response
- Session history lost on page refresh
- The AI identifying itself as DeepSeek or any model name