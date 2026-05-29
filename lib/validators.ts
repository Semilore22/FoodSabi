import { FoodSabiError } from "@/lib/errors"
import { isValidUUID } from "@/lib/utils"

const MAX_CONTENT_LENGTH = 10000

export function validateAnalyzeRequest(body: unknown): void {
  if (!body || typeof body !== "object") throw new FoodSabiError("empty_input")

  const req = body as Record<string, unknown>
  const { sessionId, inputType, content, imageUrl } = req

  if (!isValidUUID(sessionId)) throw new FoodSabiError("empty_input")
  if (!["text", "paste", "image"].includes(inputType as string)) {
    throw new FoodSabiError("empty_input")
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new FoodSabiError("empty_input")
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new FoodSabiError("empty_input")
  }
  if (imageUrl !== undefined) {
    if (typeof imageUrl !== "string") {
      throw new FoodSabiError("empty_input")
    }
    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("https://")) {
      throw new FoodSabiError("empty_input")
    }
  }
}

export function validateSessionId(sessionId: unknown): void {
  if (!isValidUUID(sessionId)) throw new FoodSabiError("empty_input")
}
