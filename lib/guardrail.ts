export interface GuardrailResult {
  allowed: boolean
}

const OUT_OF_SCOPE_PATTERNS = [
  /ignore previous/i,
  /you are now/i,
  /act as/i,
  /disregard your rules/i,
  /system prompt/i,
  /forget your instructions/i,
  /reveal your/i,
  /what model/i,
  /underlying technology/i,
]

const FOOD_KEYWORDS = [
  /ingredient/i,
  /label/i,
  /nutrition/i,
  /additive/i,
  /preservative/i,
  /calorie/i,
  /protein/i,
  /sugar/i,
  /sodium/i,
  /fat/i,
  /vitamin/i,
  /mineral/i,
  /store/i,
  /storage/i,
  /expire/i,
  /contain/i,
  /food/i,
  /eat/i,
  /drink/i,
  /beverage/i,
  /oil/i,
  /acid/i,
  /syrup/i,
  /flour/i,
  /pepsi/i,
  /coke/i,
  /aspartame/i,
  /msg/i,
  /monosodium/i,
  /tartrazine/i,
]

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "").trim()
}

export function runGuardrail(input: string, isFollowUp = false): GuardrailResult {
  const cleanInput = sanitizeInput(input)

  const isInjection = OUT_OF_SCOPE_PATTERNS.some((p) => p.test(cleanInput))
  if (isInjection) return { allowed: false }

  if (!isFollowUp) {
    const isFoodRelated = FOOD_KEYWORDS.some((p) => p.test(cleanInput))
    if (!isFoodRelated) return { allowed: false }
  }

  return { allowed: true }
}
