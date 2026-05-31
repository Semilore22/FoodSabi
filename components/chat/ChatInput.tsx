"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import styles from "./ChatInput.module.css"
import { IconButton } from "@/components/ui/IconButton"
import { UploadButton } from "./UploadButton"
import { SUPPORTED_MIME_TYPES } from "@/lib/constants"

interface InputPayload {
  inputType: "text" | "paste" | "image"
  content: string
  imageFile?: File
}

interface ChatInputProps {
  onSend: (input: InputPayload) => void
  isLoading: boolean
  isOcrProcessing: boolean
  selectedFile: File | null
  onFileSelect: (file: File) => void
  onFileRemove: () => void
}

export function ChatInput({
  onSend,
  isLoading,
  isOcrProcessing,
  selectedFile,
  onFileSelect,
  onFileRemove,
}: ChatInputProps) {
  const [text, setText] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showHoverTip, setShowHoverTip] = useState(false)
  const [showClickTip, setShowClickTip] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    if (!SUPPORTED_MIME_TYPES.includes(selectedFile.type)) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  useEffect(() => {
    if (!inputRef.current) return
    if (!text) {
      inputRef.current.style.height = "auto"
    }
  }, [text])

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      if (clickTimer.current) clearTimeout(clickTimer.current)
    }
  }, [])

  const handleSend = () => {
    const trimmed = text.trim()
    if (selectedFile) {
      setText("")
      onSend({
        inputType: "image",
        content: trimmed,
        imageFile: selectedFile,
      })
      return
    }

    if (!trimmed || isLoading) return

    setText("")
    const isPaste = trimmed.length > 200 || trimmed.includes("\n")
    onSend({
      inputType: isPaste ? "paste" : "text",
      content: trimmed,
    })
  }

  const showTip = showHoverTip || showClickTip
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTipRef = useRef(false)

  const isTouchDevice = useRef(
    typeof window !== "undefined" && matchMedia("(hover: none)").matches
  )

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current
    if (!input) return
    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      input.click()
    }
  }, [])

  const handleUploadPress = useCallback(() => {
    if (isLoading || isOcrProcessing) return
    if (isTouchDevice.current) {
      if (clickTipRef.current) {
        clickTipRef.current = false
        setShowClickTip(false)
        if (clickTimer.current) clearTimeout(clickTimer.current)
        openFilePicker()
        return
      }
      if (clickTimer.current) clearTimeout(clickTimer.current)
      clickTipRef.current = true
      setShowClickTip(true)
      clickTimer.current = setTimeout(() => {
        clickTipRef.current = false
        setShowClickTip(false)
        openFilePicker()
      }, 2000)
    } else {
      openFilePicker()
    }
  }, [isLoading, isOcrProcessing, openFilePicker])

  const handleUploadHoverEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowHoverTip(true)
    hoverTimer.current = setTimeout(() => setShowHoverTip(false), 2000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect(file)
    if (e.target) {
      e.target.value = ""
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (text.trim().length > 0 || selectedFile !== null) && !isLoading && !isOcrProcessing

  return (
    <div className={styles.container}>
      <div className={styles.inputBar}>
        <div className={styles.inputWrapperGroup}>
          <div className={`${styles.uploadTip} ${showTip ? styles.uploadTipVisible : ""}`} role="tooltip">
            Get close to the label, make sure it is well lit, and hold steady.
          </div>
          <div className={`${styles.inputWrapper} ${selectedFile ? styles.inputWrapperWithImage : ""}`}>
            {selectedFile ? (
              <>
                <div className={styles.imagePreviewSection}>
                  {previewUrl && (
                    <div className={styles.imagePreview}>
                      <img src={previewUrl} alt="Selected label" className={styles.thumbnail} />
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={onFileRemove}
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.textRow}>
                  <textarea
                    ref={inputRef}
                    className={styles.textField}
                    placeholder="Add a note about this image..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isLoading || isOcrProcessing}
                  />
                  {(text.trim().length > 0 || selectedFile !== null) && (
                    <IconButton
                      icon="send"
                      onClick={handleSend}
                      ariaLabel="Send message"
                      disabled={!canSend}
                      isLoading={isLoading}
                      variant="primary"
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.leftActions}
                  onMouseEnter={handleUploadHoverEnter}
                >
                  <UploadButton onPress={handleUploadPress} disabled={isLoading || isOcrProcessing} icon="plus" />
                </div>
                <textarea
                  ref={inputRef}
                  className={styles.textInput}
                  placeholder="Type an ingredient or upload a label..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading || isOcrProcessing}
                />
                {(text.trim().length > 0 || selectedFile !== null) && (
                  <div className={styles.actions}>
                    <IconButton
                      icon="send"
                      onClick={handleSend}
                      ariaLabel="Send message"
                      disabled={!canSend}
                      isLoading={isLoading}
                      variant="primary"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_MIME_TYPES.join(",")}
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
    </div>
  )
}
