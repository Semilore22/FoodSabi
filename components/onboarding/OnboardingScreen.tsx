"use client"

import { OnboardingBackground } from "./OnboardingBackground"
import styles from "./OnboardingScreen.module.css"

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const handleDismiss = () => {
    try {
      localStorage.setItem("foodsabi_onboarded", "true")
    } catch {
      // localStorage unavailable — proceed anyway
    }
    onComplete()
  }

  return (
    <div className={styles.onboarding}>
      <OnboardingBackground />
      <div className={styles.topSection}>
        <div className={styles.mockChat}>
          <div className={styles.userBubble}>
            <p className={styles.bubbleContent}>What is Sodium Benzoate?</p>
          </div>

          <div className={styles.processingBubble}>
            <span className={styles.processingText}>FoodSabi is analyzing...</span>
          </div>

          <div className={styles.assistantBubble}>
            <p className={styles.bubbleContent}>
              Sodium Benzoate is a preservative used to stop food from going bad too quickly. It is generally safe in small amounts but people who are sensitive to aspirin or have asthma are often advised to watch their intake.
            </p>
          </div>
        </div>
        <div className={styles.gradientOverlay} />
      </div>
      <div className={styles.bottomSection}>
        <h1 className={styles.heading}>Hi, I am <span className={styles.brandName}>FoodSabi</span></h1>
        <p className={styles.subtext}>
          No more guessing what&apos;s in your food, I&apos;ll explain every ingredient clearly.
        </p>
        <button className={styles.ctaButton} onClick={handleDismiss}>
          Let&apos;s go
        </button>
      </div>
    </div>
  )
}
