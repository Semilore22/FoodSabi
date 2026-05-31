"use client"

import styles from "./UploadButton.module.css"
import { IconButton } from "@/components/ui/IconButton"

interface UploadButtonProps {
  onPress: () => void
  disabled: boolean
  icon?: "camera" | "plus"
}

export function UploadButton({ onPress, disabled, icon = "camera" }: UploadButtonProps) {
  return (
    <IconButton
      icon={icon}
      onClick={onPress}
      ariaLabel="Upload food label image"
      disabled={disabled}
    />
  )
}
