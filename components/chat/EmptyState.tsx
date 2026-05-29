"use client"

import styles from "./EmptyState.module.css"

export function EmptyState() {
  return (
    <div className={styles.container}>
      <div className={styles.brandMark}>FoodSabi</div>
      <p className={styles.message}>
        Send me an ingredient or take a photo of your food label and I&apos;ll break it down
        for you.
      </p>
    </div>
  )
}
