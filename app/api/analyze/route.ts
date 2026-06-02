import { validateAnalyzeRequest } from "@/lib/validators"
import { runGuardrail } from "@/lib/guardrail"
import { analyzeWithCache, persistConversation } from "@/lib/deepseek"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/db"
import type { AnalyzeRequest, AnalyzeResponse } from "@/types"

export async function POST(req: Request): Promise<Response> {
  try {
    let body: AnalyzeRequest
    try {
      body = await req.json()
    } catch {
      throw new FoodSabiError("empty_input")
    }

    validateAnalyzeRequest(body)

    await checkRateLimit(body.sessionId, body.inputType)

    const existingCount = await prisma.message.count({
      where: { sessionId: body.sessionId, role: "user" },
    })

    const guardrailResult = runGuardrail(body.content, existingCount > 0)
    if (!guardrailResult.allowed) {
      throw new FoodSabiError("out_of_scope")
    }

    const result = await analyzeWithCache(body.sessionId, body.content, body.inputType)

    await persistConversation(
      body.sessionId,
      body.content,
      body.inputType,
      JSON.stringify(result),
      body.imageUrl
    )

    return Response.json(result as AnalyzeResponse)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
