export interface Session {
  sessionId: string
  createdAt: string
  lastActiveAt: string
  status: "active" | "ended"
  messages: Message[]
}

export interface Message {
  messageId: string
  sessionId: string
  role: "user" | "assistant"
  inputType: InputType
  content: string
  imageUrl: string | null
  timestamp: string
}

export type InputType = "text" | "image" | "paste"

export interface InputPayload {
  inputType: InputType
  content: string
  imageFile?: File
}

export type ErrorType =
  | "blurry_image"
  | "unsupported_file"
  | "image_too_large"
  | "empty_input"
  | "out_of_scope"
  | "network_failure"
  | "rate_limit_exceeded"
  | "session_not_found"

export interface ErrorResponse {
  error_code: string
  error_type: ErrorType
  user_message: string
}

export interface IngredientDetail {
  name: string
  what_it_is: string
  purpose_in_food: string
  benefits: string
  concerns: string
  who_should_note: string
}

export interface IngredientResponse {
  type: "single_ingredient" | "full_list"
  product_name: string | null
  serving_size: string | null
  intro_summary?: string
  ingredients: IngredientDetail[]
  overall_summary: string
  storage_guidance: string
}

export type Level = "high" | "moderate" | "low"

export interface NutrientDetail {
  name: string
  value: string
  level: Level
  level_reasoning: string
  plain_explanation: string
}

export interface NutritionalResponse {
  type: "nutritional_label"
  product_name: string | null
  serving_size: string
  nutrients: NutrientDetail[]
  overall_summary: string
  storage_guidance: string
}

export interface MixedResponse {
  type: "mixed"
  product_name: string | null
  serving_size: string
  ingredients: IngredientDetail[]
  nutrients: NutrientDetail[]
  overall_summary: string
  storage_guidance: string
}

export interface FollowupResponse {
  type: "followup"
  response: string
}

export interface OutOfScopeResponse {
  type: "out_of_scope"
  response: string
}

export type AnalyzeResponse =
  | IngredientResponse
  | NutritionalResponse
  | MixedResponse
  | FollowupResponse
  | OutOfScopeResponse

export interface AnalyzeRequest {
  sessionId: string
  inputType: InputType
  content: string
  imageUrl?: string
}

export interface NewSessionResponse {
  sessionId: string
  createdAt: string
}

export interface SessionHistoryResponse {
  sessionId: string
  messages: {
    role: "user" | "assistant"
    content: string
    inputType: string
    imageUrl?: string | null
    timestamp: string
  }[]
}

export interface EndSessionResponse {
  success: boolean
}

export interface SessionListItem {
  sessionId: string
  preview: string
  messageCount: number
  lastActiveAt: string
}

export interface UploadResponse {
  extractedText: string
  success: boolean
}
