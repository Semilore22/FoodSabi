"use client"

import styles from "./Toggle.module.css"

interface ToggleProps {
  value: "dark" | "light"
  onChange: (value: "dark" | "light") => void
}

export function Toggle({ value, onChange }: ToggleProps) {
  const isDark = value === "dark"

  return (
    <button
      className={styles.toggle}
      onClick={() => onChange(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      type="button"
    >
      <span className={styles.track}>
        <span className={`${styles.thumb} ${isDark ? styles.dark : styles.light}`} />
      </span>
      <span className={styles.label}>{isDark ? "🌙" : "☀️"}</span>
    </button>
  )
}
