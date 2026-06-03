"use client"

import { useEffect, useRef } from "react"
import styles from "./ChatWindow.module.css"
import { ChatBubble } from "./ChatBubble"
import { EmptyState } from "./EmptyState"
import { ErrorMessage } from "./ErrorMessage"
import { TypingIndicator } from "./TypingIndicator"
import type { AnalyzeResponse, ErrorType } from "@/types"

interface Message {
  role: "user" | "assistant"
  content: string
  inputType?: string
  imageUrl?: string | null
  response?: AnalyzeResponse | null
  timestamp?: string
}

interface ChatWindowProps {
  messages: Message[]
  isLoading: boolean
  error?: {
    errorType: ErrorType
    userMessage: string
  } | null
  onRetry?: () => void
}

export function ChatWindow({
  messages,
  isLoading,
  error,
  onRetry,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const assistantEls = scrollAreaRef.current?.querySelectorAll('[data-msg-role="assistant"]')
    const lastAssistant = assistantEls?.[assistantEls.length - 1]

    if (lastAssistant) {
      lastAssistant.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  if (messages.length === 0 && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <EmptyState />
          <div ref={bottomRef} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {error && (
        <ErrorMessage
          errorType={error.errorType}
          userMessage={error.userMessage}
          onRetry={onRetry}
        />
      )}
      <div className={styles.scrollArea} ref={scrollAreaRef}>
        {messages.map((msg, idx) => (
          <div key={idx} data-msg-role={msg.role}>
            <ChatBubble
              role={msg.role}
              content={msg.content}
              imageUrl={msg.imageUrl}
              inputType={msg.inputType}
              response={msg.response}
              timestamp={msg.timestamp}
            />
          </div>
        ))}

        {isLoading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
