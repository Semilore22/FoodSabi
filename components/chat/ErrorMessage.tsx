"use client"

import styles from "./ErrorMessage.module.css"
import type { ErrorType } from "@/types"

interface ErrorMessageProps {
  errorType: ErrorType
  userMessage: string
  onRetry?: () => void
}

export function ErrorMessage({ errorType, userMessage, onRetry }: ErrorMessageProps) {
  const showRetry = errorType === "network_failure" && onRetry

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.message}>{userMessage}</p>
        {showRetry && (
          <button className={styles.retryButton} onClick={onRetry} type="button">
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
