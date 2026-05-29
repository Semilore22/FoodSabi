---
trigger: always_on
---

# Rule: Design System

## Token Files Are the Source of Truth

The project has two token files. The agent must never modify them:

- `tokens/colors.css` — all color values
- `tokens/typography.css` — all font sizes, weights, line heights, and font families

Both files export CSS custom properties (CSS variables) that are available globally.

## Mandatory: Use Variables, Never Raw Values

The agent must never write hardcoded color values or typography values anywhere in this codebase.

**Wrong:**
```css
color: #1a1a1a;
font-size: 16px;
font-family: 'poppins', sans-serif;
background: #f5f5f5;
```

**Correct:**
```css
color: var(--color-text-primary);
font-size: var(--font-size-base);
font-family: var(--font-family-base);
background: var(--color-surface);
```

Before writing any style value, check the token files. If a variable exists for what you need, use it. If it does not exist, ask before inventing a new value.

## Spacing Scale

Use multiples of 4px for all spacing (margin, padding, gap). Do not use arbitrary values.

Allowed: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`

## Border Radius

The product has a consistent border radius. Use these values only:

- Small elements (badges, tags): `4px`
- Buttons and inputs: `8px`
- Cards and modals: `12px`

## Styling Method

- All component styles use CSS Modules (`.module.css` files).
- No inline `style={{}}` props except for truly dynamic values that cannot be expressed in CSS (e.g., a progress bar width driven by a number).
- No Tailwind. No styled-components. CSS Modules only.

## Mobile-First

FoodSabi users are primarily on mobile. Every component must be built mobile-first:

- Default styles target mobile (small screens).
- Use `@media (min-width: 768px)` to layer in desktop styles.
- Touch targets must be a minimum of 44px tall.
- The product checkout page (`/p/[slug]`) must be fully functional on a 375px viewport.
