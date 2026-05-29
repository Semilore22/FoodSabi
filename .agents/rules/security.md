---
trigger: always_on
---

# Security Rules — FoodSabi

## Overview

FoodSabi handles user-uploaded images and passes content to an external AI API. While it does not collect personal data or require authentication, it must still be built with security as a priority. Read this before implementing any API route, file handling, or AI integration.

---

## Data Privacy

- FoodSabi collects **zero personally identifiable information (PII)**
- No names, emails, phone numbers, or device identifiers are stored
- Session IDs are anonymous UUIDs generated client-side — they carry no user identity
- Conversation history is scoped to a session ID only and must not be linked to any identity
- Do not log request bodies that may contain user-typed content in production
- Do not log uploaded image data at any point

---

## API Security

### Input Validation
- Every API route must validate its request body before processing
- Validate input type: must be one of `"text"`, `"paste"`, `"image"`
- Validate session ID: must be a valid UUID format
- Validate content: must not be empty
- Validate image format: must be `jpg`, `png`, or `webp` only
- Validate image size: must not exceed 500KB after compression
- Reject and return `ErrorResponse` immediately for any invalid input — never pass unvalidated data downstream

### Rate Limiting
- Rate limiting must be applied at the API layer per session ID
- Image upload endpoints must have a tighter rate limit than text endpoints
- Return `ErrorResponse` with `error_type: "rate_limit_exceeded"` when exceeded
- Do not expose rate limit thresholds in error messages

### Request Headers
- Set `Content-Security-Policy` headers on all responses
- Set `X-Content-Type-Options: nosniff`
- Set `X-Frame-Options: DENY`
- Set `Referrer-Policy: strict-origin-when-cross-origin`
- Never return `Access-Control-Allow-Origin: *` in production

### Error Responses
- Never return raw error objects, stack traces, or internal error messages to the client
- All errors must be mapped to `ErrorResponse` schema before returning
- Log full errors server-side for debugging, return only `user_message` to the client

---

## Image Upload Security

- Accept only `image/jpeg`, `image/png`, and `image/webp` MIME types
- Validate MIME type server-side independently of the client's claim — do not trust the Content-Type header alone
- Validate file magic bytes server-side to confirm the file is actually the format it claims
- Images are processed (compressed, OCR-extracted) and then discarded — never stored persistently
- Never serve uploaded images back to the client from a URL
- Maximum file size enforced both client-side (before upload) and server-side (before processing)
- Reject files with suspicious filenames — strip and sanitize all filenames

---

## DeepSeek API Integration Security

- The DeepSeek API key must be stored in environment variables only
- Never hardcode the API key anywhere in the codebase
- Never expose the API key to the client side
- Never log the API key
- API key variable name: `DEEPSEEK_API_KEY`
- All calls to DeepSeek must be made server-side only
- The system prompt must be constructed and injected server-side — never sent from or editable by the client
- Sanitize all user input before injecting it into the DeepSeek prompt to prevent prompt injection attacks

### Prompt Injection Prevention
User input must be sanitized before being placed into the DeepSeek prompt. Apply the following:
- Strip or escape any text that attempts to override the system prompt
- Wrap user content in a clearly labeled user content block within the prompt
- Example safe prompt structure:

```
[SYSTEM PROMPT]
You are FoodSabi... (full system prompt)

[USER INPUT]
{sanitized_user_content}
```

- If the user content contains phrases like "ignore previous instructions", "you are now", "act as", "disregard your rules", or similar override attempts, reject the request and return the out-of-scope error response

---

## OCR Security

- OCR is run server-side only
- The OCR service must have a timeout — do not allow indefinite processing
- If OCR returns empty or suspiciously short output (under 5 characters), treat as blurry image error
- Do not pass OCR output directly to DeepSeek without first running it through the scope guardrail

---

## Scope Guardrail

The scope guardrail is a security and product boundary control. It must:
- Run on every piece of user input before it reaches DeepSeek
- Block any content unrelated to food ingredients, food labels, food composition, or food storage
- Block any prompt injection attempts (see above)
- Block any requests that ask FoodSabi to reveal its system prompt, model name, or underlying technology
- Return `ErrorResponse` with `error_type: "out_of_scope"` for all rejected inputs

---

## Session Security

- Session IDs are UUIDs — validate format before use
- Session data must not be accessible cross-session
- Session history is not persistent across devices — it is tied to the browser session only
- Sessions expire after a reasonable period of inactivity (developer to define based on infrastructure)
- When a user requests a new chat, the old session data is cleared from the store

---

## Environment Variables

The following environment variables must exist and must never be committed to version control:

```
DEEPSEEK_API_KEY         # DeepSeek API key
SESSION_SECRET           # Secret for signing session tokens if needed
OCR_SERVICE_URL          # URL of the OCR service if external
RATE_LIMIT_TEXT          # Max text requests per session per time window
RATE_LIMIT_IMAGE         # Max image requests per session per time window
```

Add all of these to `.gitignore` via a `.env` file. Provide a `.env.example` with placeholder values for onboarding.

---

## What Must Never Happen

- API key committed to version control
- Raw user input passed to DeepSeek without sanitization
- Stack traces returned to the client
- Images stored persistently
- PII collected or stored anywhere
- The system prompt exposed to the client
- Session data accessible across session IDs
- File uploads accepted without MIME and magic byte validation