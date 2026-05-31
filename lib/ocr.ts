import { FoodSabiError } from "./errors"

const OCR_SPACE_URL = "https://api.ocr.space/parse/image"
const TIMEOUT_MS = 30000
const MIN_TEXT_LENGTH = 10

const JPEG_MAGIC = Uint8Array.of(0xff, 0xd8, 0xff)
const PNG_MAGIC = Uint8Array.of(0x89, 0x50, 0x4e, 0x47)
const WEBP_MAGIC = Uint8Array.of(0x52, 0x49, 0x46, 0x46)

function detectMime(buffer: Buffer): string {
  if (
    buffer.length >= JPEG_MAGIC.length &&
    JPEG_MAGIC.every((b, i) => buffer[i] === b)
  ) {
    return "image/jpeg"
  }
  if (
    buffer.length >= PNG_MAGIC.length &&
    PNG_MAGIC.every((b, i) => buffer[i] === b)
  ) {
    return "image/png"
  }
  if (
    buffer.length >= 12 &&
    WEBP_MAGIC.every((b, i) => buffer[i] === b) &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  return "image/jpeg"
}

async function callOcrSpace(
  dataUri: string,
  apiKey: string,
  engine: number
): Promise<string | null> {
  const body = new URLSearchParams()
  body.append("apikey", apiKey)
  body.append("base64Image", dataUri)
  body.append("language", "eng")
  body.append("OCREngine", String(engine))
  body.append("scale", "true")
  body.append("detectOrientation", "true")
  body.append("isOverlayRequired", "false")

  let response: Response
  try {
    response = await fetch(OCR_SPACE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  imageBuffer: Buffer
): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    throw new FoodSabiError("network_failure")
  }

  const mime = detectMime(imageBuffer)
  const b64 = imageBuffer.toString("base64")
  const dataUri = `data:${mime};base64,${b64}`

  const engines = [2, 1]

  for (const engine of engines) {
    try {
      const text = await callOcrSpace(dataUri, apiKey, engine)
      if (text && text.length >= MIN_TEXT_LENGTH) {
        return text
      }
    } catch {
      continue
    }
  }

  throw new FoodSabiError("blurry_image")
}
