"use client"

import styles from "./IconButton.module.css"
import { Spinner } from "./Spinner"

interface IconButtonProps {
  icon: "camera" | "close" | "dark-mode" | "light-mode" | "send" | "plus" | "menu"
  onClick: () => void
  ariaLabel: string
  disabled?: boolean
  isLoading?: boolean
  variant?: "default" | "primary"
}

const icons: Record<IconButtonProps["icon"], string> = {
  camera: "📷",
  close: "✕",
  "dark-mode": "🌙",
  "light-mode": "☀️",
  send: "↑",
  plus: "+",
  menu: "☰",
}

export function IconButton({
  icon,
  onClick,
  ariaLabel,
  disabled = false,
  isLoading = false,
  variant = "default",
}: IconButtonProps) {
  return (
    <button
      className={`${styles.button} ${variant === "primary" ? styles.primary : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled || isLoading}
      type="button"
    >
      {isLoading ? <Spinner size="small" /> : <span className={styles.icon}>{icons[icon]}</span>}
    </button>
  )
}
