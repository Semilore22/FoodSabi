import { FoodSabiError } from "./errors"

const OCR_SPACE_URL = "https://api.ocr.space/parse/image"
const TIMEOUT_MS = 30000
const MIN_TEXT_LENGTH = 10

async function callOcrSpace(
  imageBuffer: Buffer,
  fileName: string,
  apiKey: string,
  engine: number
): Promise<string | null> {
  const body = new FormData()
  body.append("file", new Blob([new Uint8Array(imageBuffer)]), fileName || "image.jpg")
  body.append("apikey", apiKey)
  body.append("language", "eng")
  body.append("OCREngine", String(engine))
  body.append("scale", "true")
  body.append("detectOrientation", "true")
  body.append("isOverlayRequired", "false")

  let response: Response
  try {
    response = await fetch(OCR_SPACE_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new FoodSabiError("network_failure")
  }

  if (!response.ok) {
    throw new FoodSabiError("network_failure")
  }

  let data: Record<string, unknown>
  try {
    data = await response.json()
  } catch {
    throw new FoodSabiError("network_failure")
  }

  if (data.IsErroredOnProcessing || (data.OCRExitCode != null && Number(data.OCRExitCode) > 1)) {
    return null
  }

  const parsedResults = data.ParsedResults as Array<Record<string, unknown>> | undefined
  if (!parsedResults || !Array.isArray(parsedResults) || parsedResults.length === 0) {
    return null
  }

  const result = parsedResults[0]
  if (result.FileParseExitCode != null && Number(result.FileParseExitCode) > 1) {
    return null
  }

  const text = (result.ParsedText as string || "").trim()
  return text || null
}

export async function extractTextFromImage(
  imageBuffer: Buffer,
  fileName: string
): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    throw new FoodSabiError("network_failure")
  }

  const engines = [2, 1]

  for (const engine of engines) {
    try {
      const text = await callOcrSpace(imageBuffer, fileName, apiKey, engine)
      if (text && text.length >= MIN_TEXT_LENGTH) {
        return text
      }
    } catch {
      continue
    }
  }

  throw new FoodSabiError("blurry_image")
}
