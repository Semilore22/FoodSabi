import type { ErrorResponse, ErrorType } from "@/types"

const ERROR_MESSAGES: Record<string, string> = {
  blurry_image: "This picture isn't clear enough for me to read. Try taking it again in better light or just type out the ingredients and I'll explain them for you.",
  unsupported_file: "I can only read image files. Try uploading a JPG or PNG of your food label.",
  empty_input: "It looks like nothing was typed or uploaded. Send me an ingredient or a picture of a food label and I'll break it down.",
  out_of_scope: "That's a bit outside my lane. I'm only able to help you understand food ingredients and labels. Try typing or uploading a food label and I'll break it down for you.",
  network_failure: "Something went wrong on our end. Check your connection and try again.",
  rate_limit_exceeded: "You're moving fast. Give it a few seconds and try again.",
  image_too_large: "This image is a bit too large. Try compressing it or just type out the ingredients instead.",
  session_not_found: "This session was not found. Start a new chat to continue.",
}

const ERROR_STATUS_CODES: Record<string, number> = {
  blurry_image: 422,
  unsupported_file: 415,
  empty_input: 400,
  out_of_scope: 422,
  network_failure: 502,
  rate_limit_exceeded: 429,
  image_too_large: 413,
  session_not_found: 404,
}

export class FoodSabiError extends Error {
  constructor(public errorType: string) {
    super(errorType)
    this.name = "FoodSabiError"
  }
}

export function mapToErrorResponse(error: unknown): { errorResponse: ErrorResponse; status: number } {
  if (error instanceof FoodSabiError) {
    return {
      errorResponse: {
        error_code: error.errorType,
        error_type: error.errorType as ErrorType,
        user_message: ERROR_MESSAGES[error.errorType] ?? "Something went wrong on our end. Check your connection and try again.",
      },
      status: ERROR_STATUS_CODES[error.errorType] ?? 500,
    }
  }
  return {
    errorResponse: {
      error_code: "network_failure",
      error_type: "network_failure",
      user_message: ERROR_MESSAGES.network_failure,
    },
    status: 502,
  }
}
