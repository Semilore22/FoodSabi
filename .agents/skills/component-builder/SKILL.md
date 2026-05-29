# Skill: Component Builder

## What This Skill Covers

This skill defines how to build every UI component in FoodSabi correctly. It covers component structure, naming, props, styling, accessibility, and the specific components needed for the product. Read this alongside `design-system.md` before building any component.

---

## Before You Build Any Component

1. Read `.agents/rules/design-system.md` for colors, typography, spacing, and layout rules
2. Read `.agents/rules/code-style.md` for naming conventions and file structure
3. Check if the component already exists before creating a new one
4. Every component is mobile-first — design for 375px width first

---

## Design Token Mapping

The project's token file (`tokens/tokens.css`) uses Material Design 3 naming. Use this mapping for component styling — never invent new variable names:

| FoodSabi Concept | Token Variable | Notes |
|---|---|---|
| Accent / primary brand color | `--color-primary` | Green accent (informational, not medical) |
| Text on accent | `--color-on-primary` | White text on primary buttons |
| Accent container / tinted bg | `--color-primary-container` | Light green for user bubbles |
| Background surface | `--color-surface` | Card backgrounds, app bg |
| Surface container (slightly deeper) | `--color-surface-container` | Elevated surfaces |
| Surface container highest | `--color-surface-container-highest` | Highest elevation surface |
| Text on surface | `--color-on-surface` | Primary body text |
| Text secondary / muted | `--color-on-surface-variant` | Secondary labels, timestamps |
| Border / outline | `--color-outline` | Dividers, borders |
| Error | `--color-error` | Error messages, alerts |
| Background (page) | `--color-background` | Page-level background |

**Border radius** — use raw values from design-system.md (not CSS variables):
- `4px` — badges, tags, small elements
- `8px` — buttons, inputs
- `12px` — cards, modals, chat bubbles

> ⚠️ **Never hardcode color values.** Always use the `--color-*` tokens above. If you need a value not in this table, check `tokens/tokens.css` first.

---

## Component File Structure

Every component lives in `components/` and follows this layout (matches `AGENTS.md`):

```
components/
├── chat/
│   ├── ChatWindow.tsx
│   ├── ChatBubble.tsx
│   ├── ChatInput.tsx
│   ├── TypingIndicator.tsx
│   ├── ImagePreview.tsx
│   ├── UploadButton.tsx
│   ├── EmptyState.tsx
│   └── ErrorMessage.tsx
├── layout/
│   ├── Header.tsx
│   └── AppShell.tsx
└── ui/
    ├── IconButton.tsx
    ├── Toggle.tsx
    └── Spinner.tsx
```

---

## Component Template

Every component must follow this exact structure:

```typescript
// components/chat/ChatBubble.tsx

import styles from "./ChatBubble.module.css"
import type { IngredientResponse, NutritionalResponse } from "@/types"

interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
  imageUrl?: string | null
  response?: IngredientResponse | NutritionalResponse | null
  timestamp?: string
}

/**
 * Renders a single chat message bubble.
 * Supports plain text, uploaded image thumbnails, IngredientResponse cards,
 * and NutritionalResponse cards.
 */
export function ChatBubble({ role, content, imageUrl, response, timestamp }: ChatBubbleProps) {
  const isUser = role === "user"

  return (
    <div className={`${styles.container} ${isUser ? styles.userAlign : styles.assistantAlign}`}>
      <div className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}>
        {/* User image uploads */}
        {imageUrl && (
          <div className={styles.imageWrapper}>
            <img src={imageUrl} alt="Food label" className={styles.image} />
          </div>
        )}

        {/* Standard text bubble */}
        {content && !response && <p className={styles.content}>{content}</p>}

        {/* Structured Ingredient Response */}
        {response && "ingredients" in response && (
          <div className={styles.analysis}>
            {response.product_name && (
              <h3 className={styles.productName}>{response.product_name}</h3>
            )}
            <div className={styles.ingredientsGrid}>
              {response.ingredients.map((ingredient, idx) => (
                <div key={idx} className={styles.ingredientCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.ingName}>{ingredient.name}</span>
                    <span className={styles.ingPurpose}>{ingredient.purpose_in_food}</span>
                  </div>
                  <p className={styles.whatItIs}>
                    <strong>What it is:</strong> {ingredient.what_it_is}
                  </p>
                  <div className={styles.details}>
                    <div className={styles.benefitBlock}>
                      <span className={`${styles.badge} ${styles.benefit}`}>Benefits</span>
                      <p>{ingredient.benefits}</p>
                    </div>
                    <div className={styles.concernBlock}>
                      <span className={`${styles.badge} ${styles.concern}`}>Concerns</span>
                      <p>{ingredient.concerns}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {response.overall_summary && (
              <div className={styles.summarySection}>
                <h4 className={styles.summaryTitle}>Overall Summary</h4>
                <p>{response.overall_summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Structured Nutritional Response */}
        {response && "nutrients" in response && (
          <div className={styles.nutritionalAnalysis}>
            {response.product_name && (
              <h3 className={styles.productName}>{response.product_name}</h3>
            )}
            <div className={styles.nutrientsGrid}>
              {response.nutrients.map((nutrient, idx) => (
                <div key={idx} className={styles.nutrientRow}>
                  <span className={styles.nutrientName}>{nutrient.name}</span>
                  <span className={styles.nutrientValue}>
                    {nutrient.value}{nutrient.unit}
                  </span>
                  <span className={`${styles.levelBadge} ${styles[`level_${nutrient.level}`]}`}>
                    {nutrient.level}
                  </span>
                </div>
              ))}
            </div>
            {response.overall_summary && (
              <div className={styles.summarySection}>
                <h4 className={styles.summaryTitle}>Overall Summary</h4>
                <p>{response.overall_summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {timestamp && (
        <span className={styles.timestamp}>{timestamp}</span>
      )}
    </div>
  )
}
```

---

## Required Components for FoodSabi

### 1. AppShell

The root layout wrapper. Manages dark/light mode via `data-theme` on the root element.

**Props**: `{ children: ReactNode, theme: "dark" | "light", onToggleTheme: () => void }`

**Responsibilities**:
- Sets `data-theme` attribute on root
- Renders Header at top (fixed)
- Renders chat area in the middle (scrollable)
- Renders ChatInput at bottom (fixed)
- Reads and applies theme preference from session storage on mount

---

### 2. Header

Fixed top bar.

**Props**: `{ onNewChat: () => void, theme: "dark" | "light", onToggleTheme: () => void }`

**Responsibilities**:
- Shows "FoodSabi" in `--color-primary`, bold
- Shows dark/light toggle on the right
- Shows "New Chat" button — triggers session reset confirmation

---

### 3. ChatWindow

The scrollable message area between header and input.

**Props**: `{ messages: Message[], isLoading: boolean, error?: ErrorResponse | null }`

**Responsibilities**:
- Maps messages to ChatBubble components
- Shows TypingIndicator when `isLoading` is true
- Shows ErrorMessage inline when `error` is set
- Auto-scrolls to the bottom on new message
- Shows EmptyState when messages array is empty and no error

---

### 4. ChatBubble

A single message in the conversation.

**Props**:
```typescript
interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
  imageUrl?: string | null
  response?: IngredientResponse | NutritionalResponse | null
  timestamp?: string
}
```

**Styling rules**:
- User: right-aligned, `--color-primary-container`, border-radius `12px` with `border-bottom-right-radius: 4px`
- Assistant: left-aligned, `--color-surface-container-low`, border-radius `12px` with `border-bottom-left-radius: 4px`, left border `2px solid var(--color-primary)`
- Max width: 80% for user, 90% for assistant
- In user bubbles, images render as styled aspect-ratio thumbnails with a light overlay

---

### 5. TypingIndicator

Shown while FoodSabi is processing a request.

**Props**: `{ inputType: "text" | "paste" | "image" | "ocr_processing" }`

**Appearance & Logic**:
- Renders as an assistant-style bubble (left-aligned, `--color-primary` border)
- Contains three animated pulsing dots in `--color-primary`
- Label text changes based on user input:
  - If `inputType` is `"image"` or `"ocr_processing"`: "FoodSabi is reading your label..."
  - If `inputType` is `"text"` or `"paste"`: "FoodSabi is analyzing ingredients..."
- Animation: staggered pulsing fade-in-out on each dot

---

### 6. ChatInput

Fixed bottom input bar.

**Props**: `{ onSend: (input: InputPayload) => void, isLoading: boolean, isOcrProcessing: boolean }`

**Responsibilities**:
- Text input field with placeholder: "Type an ingredient or upload a label..."
- Upload button (camera/image icon) triggers file picker — accepts jpg, png, webp only
- Send button with `--color-primary` background — disabled while `isLoading` or `isOcrProcessing` is true
- On image selection, show ImagePreview above the input bar (while OCR runs, show a loading state)
- On send: packages input type and content into `InputPayload` and calls `onSend`
- Clears input after send

```typescript
interface InputPayload {
  inputType: "text" | "paste" | "image"
  content: string
  imageFile?: File
}
```

---

### 7. ImagePreview

Shown above the input bar when an image is selected.

**Props**: `{ file: File, onRemove: () => void, isProcessing: boolean }`

**Responsibilities**:
- Shows a small thumbnail of the selected image
- Shows the filename and file size
- Shows an X button to remove the image (disabled while `isProcessing` is true)
- Validates file type and size on mount — shows inline error if invalid
- When `isProcessing` is true, shows OCR loading overlay with "Reading label..." text

---

### 8. UploadButton

The camera/image icon inside the ChatInput.

**Props**: `{ onFileSelect: (file: File) => void, disabled: boolean }`

**Responsibilities**:
- Opens file picker filtered to `image/jpeg, image/png, image/webp`
- Triggers client-side compression on selected file before calling `onFileSelect`
- If compressed file is still over 500KB, shows inline error

---

### 9. EmptyState

Shown in ChatWindow when there are no messages yet.

**Props**: `{ onSelectSample: (query: string) => void }`

**Content & Design**:
- Center-aligned warmly designed card using `--color-surface` with soft shadow
- Centered FoodSabi brand mark in `--color-primary`
- Message: "Send me an ingredient or take a photo of your food label and I'll break it down for you."
- **Interactive Quick-Start Chips**: Renders three capsule-shaped sample buttons ("Monosodium Glutamate", "High Fructose Corn Syrup", "Tartrazine"). Clicking a chip triggers `onSelectSample(chipName)` to auto-submit the query.
- Chips must have smooth scale-up hover animations using `--color-surface-container` and a subtle border.

---

### 10. ErrorMessage

Shown inline in ChatWindow when an API or processing error occurs. Can also render as a standalone error banner.

**Props**:
```typescript
type ErrorType = "blurry_image" | "unsupported_file" | "image_too_large" | "empty_input" | "out_of_scope" | "network_failure" | "rate_limit_exceeded"

interface ErrorMessageProps {
  errorType: ErrorType
  userMessage: string
  onRetry?: () => void
}
```

**Appearance & Logic**:
- Renders as a centered warning-style card with `--color-error` left border
- Displays `userMessage` verbatim (predefined in AGENTS.md error states table)
- Shows a "Try Again" button when `onRetry` is provided (for network failures)
- Uses `--color-error-container` as the card background
- Uses `--color-on-error-container` for text
- The error type is never shown to the user — only logged

**Error types handled** (from AGENTS.md):
- `blurry_image` — try again in better light
- `unsupported_file` — use JPG or PNG
- `image_too_large` — compress or type instead
- `empty_input` — send an ingredient or label photo
- `out_of_scope` — food labels only
- `network_failure` — something went wrong, try again
- `rate_limit_exceeded` — slow down, try in a few seconds

---

### 11. Toggle

Reusable dark/light mode toggle switch.

**Props**: `{ value: "dark" | "light", onChange: (value: "dark" | "light") => void }`

---

### 12. Spinner

A small loading indicator used inside buttons, the upload area, and inline loading states.

**Props**: `{ size?: "small" | "medium" | "large", color?: string }`

**Appearance**:
- Renders a CSS-animated rotating ring
- Default size is `"small"` (16px), `"medium"` is 24px, `"large"` is 36px
- Default color is `var(--color-primary)`
- Has `role="status"` and an `aria-label="Loading"` for accessibility

---

### 13. IconButton

A generic icon button used for the upload trigger, remove/close buttons, and toggle icons.

**Props**:
```typescript
interface IconButtonProps {
  icon: "camera" | "close" | "dark-mode" | "light-mode" | "send" | "plus"
  onClick: () => void
  ariaLabel: string
  disabled?: boolean
  size?: "small" | "medium"
}
```

**Appearance**:
- Transparent background, circular shape, 44px minimum touch target
- Hover/focus shows `--color-surface-container` background
- Uses `--color-on-surface` for the icon color
- When disabled, reduces opacity to 40%

---

## System State Integration

The AGENTS.md defines these system states. Ensure every component handles its relevant states:

| State | Relevant Component | Behavior |
|---|---|---|
| `idle` | EmptyState | Shown when no messages |
| `typing` | ChatInput | User composing text |
| `loading` | TypingIndicator | Dots animation while waiting for AI |
| `responding` | ChatBubble | Renders AI response |
| `error` | ErrorMessage | Inline error with optional retry |
| `image_selected` | ImagePreview | Thumbnail preview with remove option |
| `ocr_processing` | ImagePreview + ChatInput | OCR loading overlay + disabled send |

---

## Styling Rules

- Use CSS Modules (`.module.css`) for component-scoped styles
- Only use CSS variables from the **Design Token Mapping** table above — never hardcode colors
- No inline styles
- No global class names that could clash

---

## Accessibility Rules

- Every interactive element (buttons, toggles, chips, text inputs, icon buttons) must have a **minimum touch target size of 44px** (height/width) for mobile accessibility.
- Every interactive element must have an `aria-label` if it has no visible text
- Images must have descriptive `alt` text
- Focus states must be visible — use `outline: 2px solid var(--color-primary)`
- Upload button must be keyboard accessible
- Chat input must be focusable and support Enter key to send
- Spinner must have `role="status"` and `aria-label="Loading"`

---

## Do Not

- Build components that mix layout and business logic — keep them separate
- Use `any` type in component props
- Hardcode any string that belongs in the design system (copy, colors, spacing)
- Build components without checking if one already exists
- Invent new CSS variable names — use only the mapped tokens in the table above
