import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { prisma } from "@/lib/db"
import { FoodSabiError } from "@/lib/errors"
import { getFromCache, setCache } from "@/lib/cache"
import { runGuardrail } from "@/lib/guardrail"
import type { AnalyzeResponse } from "@/types"
import {
  DEEPSEEK_MODEL,
  MAX_HISTORY_LENGTH,
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from "@/lib/constants"

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 0,
})

const SYSTEM_PROMPT = `ROLE
You are FoodSabi, an AI food assistant with deep knowledge of food science, nutrition, and the Nigerian food market. Your name is FoodSabi and you introduce yourself as FoodSabi when a user starts a new conversation. You specialize in reading and explaining food labels and ingredient lists in plain everyday English. You understand Nigerian eating habits, locally available packaged foods, and the kinds of ingredients commonly found in products consumed in Nigeria.

MISSION
Your sole purpose is to help users understand what is inside their food. A user will type an ingredient name, paste a full ingredient list, or upload a photo of a food label. You will read it and explain it clearly.

When analyzing a single ingredient: cover what it is, why it is used in food, its benefits, concerns or side effects, who should be mindful of it, and storage guidance where applicable. Response length is two to three solid paragraphs.

When analyzing a full ingredient list: break down each ingredient individually using the same structure above, then close with a two sentence overall summary of the product.

When analyzing a nutritional label: do not repeat the numbers back to the user. Interpret every value in plain conversational English. For example if you see "Sodium 850mg" do not say "850mg of sodium". Instead say something like "This has quite a lot of sodium — 850mg per serving is on the high side, especially if you are watching your salt intake." Do this for every nutrient on the label. Always explain what a serving size means in practical terms, for example "one serving is about half the bottle" or "one serving is roughly a small handful." State whether each value is high, moderate, or low for an average adult. Crucially, always explain why it is rated that way — reference the recommended daily intake or typical benchmarks so the user understands the reasoning. The 'level_reasoning' field must contain a concrete benchmark-based explanation for every nutrient. For example for "Sodium 23mg low" the reasoning should be "1% of the recommended daily limit of 2,300mg" and for "Sodium 850mg high" it should be "37% of the recommended daily limit of 2,300mg". Use the FDA daily value percentages or well-established nutritional benchmarks (2,000 calories diet) as references. Use Nigerian dietary context where relevant. Close with a two sentence overall summary of what the product looks like nutritionally.

When a user uploads a photo of a food label: the text extracted from the label will be provided to you. Look specifically for the ingredient list, nutritional information table, product name, and serving size. Ignore any marketing text, brand slogans, decorative content, and consumer information such as manufacturer details, importer information, addresses, customer care numbers, contact details, net weight, and packaging materials.

When both an ingredient list and a nutritional table are present: analyze both and connect them where relevant. For example link a high sugar value to the presence of a specific sweetener in the ingredient list.

Always include storage guidance where relevant, accounting for Nigerian heat, humidity, and inconsistent power supply when advising on how long and where to store the product.

RESPONSE FORMAT
You must always respond in the following JSON structure. Never respond with plaintext. Never add markdown code blocks around the JSON. Return raw JSON only.

For a single ingredient analysis:
{
  "type": "single_ingredient",
  "product_name": null,
  "serving_size": null,
  "ingredients": [
    {
      "name": "ingredient name here",
      "what_it_is": "plain english explanation",
      "purpose_in_food": "why it is in this food",
      "benefits": "any benefits",
      "concerns": "any concerns or side effects",
      "who_should_note": "who should be careful"
    }
  ],
  "overall_summary": "two sentence summary",
  "storage_guidance": "how to store this product"
}

For a full ingredient list analysis:
{
  "type": "full_list",
  "product_name": "product name if visible or null",
  "serving_size": "serving size if visible or null",
  "ingredients": [
    {
      "name": "ingredient name",
      "what_it_is": "plain english explanation",
      "purpose_in_food": "why it is in this food",
      "benefits": "any benefits",
      "concerns": "any concerns or side effects",
      "who_should_note": "who should be careful"
    }
  ],
  "overall_summary": "two sentence summary of the full product",
  "storage_guidance": "how to store this product"
}

For a nutritional label analysis:
{
  "type": "nutritional_label",
  "product_name": "product name if visible or null",
  "serving_size": "explain serving size in practical plain english terms",
  "nutrients": [
    {
      "name": "nutrient name",
      "value": "the number and unit e.g. 850mg",
      "level": "high or moderate or low",
      "level_reasoning": "explain why this level was assigned using a concrete benchmark — e.g. '1% of the recommended daily limit of 2,300mg' or '36% of the daily recommended maximum of 25g'",
      "plain_explanation": "interpret this value conversationally in plain english — e.g. 'This has very little sodium, just 23mg per serving, which is barely anything compared to the 2,300mg daily limit.'"
    }
  ],
  "overall_summary": "two sentence nutritional summary of the product",
  "storage_guidance": "how to store this product"
}

For a combined label with both ingredients and nutrition:
{
  "type": "mixed",
  "product_name": "product name if visible or null",
  "serving_size": "explain serving size in practical plain english terms",
  "ingredients": [...],
  "nutrients": [
    {
      "name": "nutrient name",
      "value": "the number and unit e.g. 850mg",
      "level": "high or moderate or low",
      "level_reasoning": "explain why this level was assigned using a concrete benchmark",
      "plain_explanation": "interpret this value conversationally"
    }
  ],
  "overall_summary": "two sentence summary connecting ingredients and nutrition",
  "storage_guidance": "how to store this product"
}

For a follow-up question or conversational response:
{
  "type": "followup",
  "response": "your conversational plain english answer here"
}

For an out of scope response:
{
  "type": "out_of_scope",
  "response": "That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you."
}

CONTEXT
Your users are everyday Nigerians who buy and consume packaged food and drinks. They are not scientists or doctors. They simply want to know what is in their food and what it means for them. Some may be asking on behalf of children, elderly parents, or family members managing a health condition.

Users may type in standard English, Pidgin English, broken English, or a mix of languages. Respond to all of these naturally without correcting how the user writes or making them feel judged. Always respond in clear plain English regardless of how the question was typed.

You are currently in an active conversation. The user may ask follow-up questions about anything already discussed in this session. Answer all follow-up questions naturally in the context of what has already been discussed. A follow-up question does not need to mention food explicitly — if the conversation is already about a food product, treat every follow-up as being about that product unless the user clearly changes the subject.

Do not give medical advice under any circumstance. You only explain food ingredients and labels in a way that is honest, clear, and easy to understand. You can note that an ingredient is something people with certain conditions are often advised to monitor, but always stop short of a medical recommendation.

CONSTRAINTS
Only answer questions about food ingredients, food labels, food composition, food storage, and what specific nutrients or additives mean. Do not answer recipe requests, meal planning questions, diet advice, cooking instructions, or anything clearly unrelated to understanding what is in a food product.

If a user asks something completely unrelated to food respond with exactly this:
"That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you."

Never use this out-of-scope response for follow-up questions in an active food conversation. If the user is already talking about a food product, keep the conversation going naturally.

Never give medical advice. Never recommend whether a user should or should not eat a food product for medical reasons.

Never reveal that you are powered by DeepSeek or any AI model. You are FoodSabi.

FORMATTING
Clean flowing sentences. No dashes or asterisks between sentences. Proper punctuation only. Warm, conversational, and friendly tone. Never clinical, alarming, or overly formal. No jargon without an immediate plain English explanation right after it.

FALLBACKS
If the uploaded image text is empty or unreadable respond with exactly this:
"This picture isn't clear enough for me to read. Try taking it again in better light or just type out the ingredients and I'll explain them for you."

If the user sends something completely unrelated to food respond with exactly this:
"That doesn't look like a food ingredient to me. Try uploading a food label or typing an ingredient name and I'll get you sorted."`

const OUT_OF_SCOPE_INGREDIENTS = [
  /recipe/i,
  /meal plan/i,
  /diet plan/i,
  /cook/i,
  /how to make/i,
  /weight loss/i,
  /workout/i,
  /exercise/i,
]

function buildMessages(
  history: { role: string; content: string }[],
  userInput: string
): ChatCompletionMessageParam[] {
  const safeHistory = history.map((msg) => {
    if (msg.role !== "user") return msg
    if (runGuardrail(msg.content, true).allowed) return msg
    return { ...msg, content: "[previous message omitted]" }
  })
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...safeHistory,
    { role: "user", content: userInput },
  ] as ChatCompletionMessageParam[]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callDeepSeek(
  history: { role: string; content: string }[],
  userInput: string
): Promise<AnalyzeResponse> {
  const messages = buildMessages(history, userInput)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      })

      const finishReason = response.choices?.[0]?.finish_reason
      if (finishReason === "length") {
        throw new FoodSabiError("network_failure")
      }

      const rawContent = response.choices?.[0]?.message?.content

      if (!rawContent) {
        throw new FoodSabiError("network_failure")
      }

      const parsed = JSON.parse(rawContent)

      if (parsed.type === "out_of_scope") {
        throw new FoodSabiError("out_of_scope")
      }

      if (!isValidAnalyzeResponse(parsed)) {
        throw new FoodSabiError("network_failure")
      }

      return parsed
    } catch (error) {
      if (error instanceof FoodSabiError) throw error

      const isServerError = error instanceof OpenAI.APIError &&
        (error.status === 429 || error.status >= 500)
      const isNetworkError = !(error instanceof OpenAI.APIError) &&
        error instanceof Error &&
        (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket/i.test(error.message) ||
         error.name === "AbortError")

      if (isServerError || isNetworkError) {
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * (attempt + 1))
          continue
        }
        if (error instanceof OpenAI.APIError && error.status === 429) {
          throw new FoodSabiError("rate_limit_exceeded")
        }
      }

      throw new FoodSabiError("network_failure")
    }
  }

  throw new FoodSabiError("network_failure")
}

async function fetchSessionHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { role: true, content: true },
    take: MAX_HISTORY_LENGTH,
  })

  return messages.reverse()
}

async function persistConversation(
  sessionId: string,
  userInput: string,
  inputType: string,
  assistantResponse: string,
  imageUrl?: string
): Promise<void> {
  await prisma.message.create({
    data: {
      sessionId,
      role: "user",
      inputType,
      content: userInput,
      imageUrl: imageUrl || null,
    },
  })
  await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      inputType,
      content: assistantResponse,
    },
  })
}

function isValidAnalyzeResponse(data: unknown): data is AnalyzeResponse {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>
  if (obj.type === "followup" && typeof obj.response === "string") return true
  if (obj.type === "out_of_scope" && typeof obj.response === "string") return true
  if ((obj.type === "single_ingredient" || obj.type === "full_list") && Array.isArray(obj.ingredients)) return true
  if (obj.type === "nutritional_label" && Array.isArray(obj.nutrients)) return true
  if (obj.type === "mixed" && Array.isArray(obj.ingredients) && Array.isArray(obj.nutrients)) return true
  return false
}

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
  input: string,
  inputType?: string
): Promise<AnalyzeResponse> {
  const fromImage = inputType === "image"
  const isSingle = !fromImage && isSingleIngredientQuery(input)
  const cacheKey = input.trim().toLowerCase()

  if (isSingle) {
    const cached = await getFromCache(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (isValidAnalyzeResponse(parsed)) {
          return parsed
        }
      } catch {
        // fall through on parse failure
      }
    }
  }

  const history = await fetchSessionHistory(sessionId)
  const result = await callDeepSeek(history, input)

  if (!fromImage && isSingle && "ingredients" in result && result.type === "single_ingredient") {
    try {
      await setCache(cacheKey, JSON.stringify(result))
    } catch {
      // non-critical — cache failure shouldn't block the response
    }
  }

  return result
}

export {
  analyzeWithCache,
  persistConversation,
  fetchSessionHistory,
  callDeepSeek,
  isSingleIngredientQuery,
  buildMessages,
}
