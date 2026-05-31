"use client"

import { useRef } from "react"
import styles from "./UploadButton.module.css"
import { IconButton } from "@/components/ui/IconButton"
import { SUPPORTED_MIME_TYPES } from "@/lib/constants"

interface UploadButtonProps {
  onFileSelect: (file: File) => void
  disabled: boolean
  icon?: "camera" | "plus"
}

export function UploadButton({ onFileSelect, disabled, icon = "camera" }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect(file)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <>
      <IconButton
        icon={icon}
        onClick={handleClick}
        ariaLabel="Upload food label image"
        disabled={disabled}
      />
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_MIME_TYPES.join(",")}
        className={styles.hiddenInput}
        onChange={handleChange}
      />
    </>
  )
}
