"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen"

export function AppWithOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem("foodsabi_onboarded") === "true"
      setShowOnboarding(!onboarded)
    } catch {
      setShowOnboarding(true)
    }
  }, [])

  if (showOnboarding === null) {
    return null
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
  }

  return <AppShell />
}
