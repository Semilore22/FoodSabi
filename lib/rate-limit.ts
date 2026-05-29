import { prisma } from "@/lib/db"
import { FoodSabiError } from "@/lib/errors"
import {
  RATE_LIMIT_TEXT_REQUESTS,
  RATE_LIMIT_IMAGE_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants"

export async function checkRateLimit(
  sessionId: string,
  inputType: string
): Promise<void> {
  const limit = inputType === "image"
    ? RATE_LIMIT_IMAGE_REQUESTS
    : RATE_LIMIT_TEXT_REQUESTS

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

  const recentCount = await prisma.message.count({
    where: {
      sessionId,
      role: "user",
      inputType,
      createdAt: { gte: since },
    },
  })

  if (recentCount >= limit) {
    throw new FoodSabiError("rate_limit_exceeded")
  }
}
