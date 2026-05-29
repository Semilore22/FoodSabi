"use client"

import styles from "./Spinner.module.css"

interface SpinnerProps {
  size?: "small" | "medium" | "large"
}

export function Spinner({ size = "small" }: SpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      role="status"
      aria-label="Loading"
    />
  )
}
