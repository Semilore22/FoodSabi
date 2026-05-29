"use client"

import { useState, useEffect, useCallback } from "react"
import styles from "./AppShell.module.css"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { ChatInput } from "@/components/chat/ChatInput"
import { EmptyState } from "@/components/chat/EmptyState"
import { SuggestionPills } from "@/components/chat/SuggestionPills"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { generateUUID } from "@/lib/utils"
import { compressImage } from "@/lib/compress"
import { extractTextFromImage } from "@/lib/ocr"
const FETCH_TIMEOUT = 15000

function getOwnedSessionIds(): string[] {
  try {
    const stored = sessionStorage.getItem(OWNED_IDS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addOwnedSessionId(id: string): void {
  const ids = getOwnedSessionIds()
  if (!ids.includes(id)) {
    ids.push(id)
    sessionStorage.setItem(OWNED_IDS_KEY, JSON.stringify(ids))
  }
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        reject(new Error("file_read_failed"))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

import type {
  AnalyzeResponse,
  ErrorType,
  InputPayload,
  SessionListItem,
} from "@/types"

interface Message {
  role: "user" | "assistant"
  content: string
  inputType?: string
  imageUrl?: string | null
  response?: AnalyzeResponse | null
  timestamp?: string
}

const API_BASE = "/api"
const OWNED_IDS_KEY = "foodsabi-owned-sessions"

export function AppShell() {
  const [sessionId, setSessionId] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [error, setError] = useState<{
    errorType: ErrorType
    userMessage: string
  } | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 10000)
    return () => clearTimeout(timer)
  }, [error])

  useEffect(() => {
    const storedTheme = sessionStorage.getItem("foodsabi-theme") as "dark" | "light" | null
    if (storedTheme) {
      setTheme(storedTheme)
      document.documentElement.setAttribute("data-theme", storedTheme)
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      setTheme(prefersDark ? "dark" : "light")
    }
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem("foodsabi-session-id")
    if (stored) {
      setSessionId(stored)
      restoreMessages(stored)
    } else {
      createNewSession()
    }
    fetchSessions()
  }, [])

  const createNewSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/session`, { method: "POST", signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      const data = await res.json()
      if (data.sessionId) {
        setSessionId(data.sessionId)
        sessionStorage.setItem("foodsabi-session-id", data.sessionId)
        addOwnedSessionId(data.sessionId)
      }
    } catch {
      const localId = generateUUID()
      setSessionId(localId)
      sessionStorage.setItem("foodsabi-session-id", localId)
      addOwnedSessionId(localId)
    }
    fetchSessions()
  }

  const fetchSessions = async () => {
    try {
      const ids = getOwnedSessionIds()
      if (ids.length === 0) return
      const res = await fetch(`${API_BASE}/sessions?ids=${ids.join(",")}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      const data = await res.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch {
      // best-effort refresh
    }
  }

  const restoreMessages = async (sid: string) => {
    try {
      const res = await fetch(`${API_BASE}/session/${sid}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      const data = await res.json()
      if (data.messages) {
        const parsed = data.messages.map((msg: Record<string, unknown>) => {
          let response = null
          let displayContent = msg.content as string
          const imageUrl = (msg.imageUrl as string) || null
          if (msg.role === "user" && msg.inputType === "image") {
            displayContent = imageUrl ? "" : "Uploaded image of food label"
          }
          if (msg.role === "assistant") {
            try {
              const parsedContent = JSON.parse(msg.content as string)
              if (parsedContent.ingredients || parsedContent.nutrients) {
                response = parsedContent
                displayContent = ""
              } else if (parsedContent.type === "followup" && parsedContent.response) {
                displayContent = parsedContent.response
              }
            } catch {
              // not a structured response
            }
          }
          const role = msg.role === "user" || msg.role === "assistant" ? msg.role : "assistant"
          return {
            role,
            content: displayContent,
            inputType: msg.inputType as string,
            imageUrl,
            response,
            timestamp: msg.timestamp as string,
          }
        })
        setMessages(parsed)
      }
    } catch {
      // best-effort restore
    }
  }

  const handleToggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.setAttribute("data-theme", next)
    sessionStorage.setItem("foodsabi-theme", next)
  }, [theme])

  const handleDeleteSession = (sid: string) => {
    setPendingDeleteId(sid)
  }

  const confirmDelete = async () => {
    const sid = pendingDeleteId
    if (!sid) return
    setPendingDeleteId(null)
    try {
      await fetch(`${API_BASE}/session/${sid}?hard=true`, { method: "DELETE", signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    } catch {
      // best-effort delete
    }
    if (sid === sessionId) {
      sessionStorage.removeItem("foodsabi-session-id")
      setMessages([])
      setError(null)
      setSelectedFile(null)
      await createNewSession()
    } else {
      fetchSessions()
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const handleSelectSession = async (sid: string) => {
    setSessionId(sid)
    sessionStorage.setItem("foodsabi-session-id", sid)
    setError(null)
    setSelectedFile(null)
    await restoreMessages(sid)
  }

  const handleNewChat = async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE", signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      } catch {
        // cleanup best-effort
      }
    }
    sessionStorage.removeItem("foodsabi-session-id")
    setMessages([])
    setError(null)
    setSelectedFile(null)
    await createNewSession()
  }

  const handleSend = async (input: InputPayload) => {
    setError(null)

    if (input.inputType === "image" && input.imageFile) {
      const imageUrl = URL.createObjectURL(input.imageFile)
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: input.content,
          inputType: "image",
          imageUrl,
          timestamp: new Date().toISOString(),
        },
      ])
      setSelectedFile(null)
      setIsLoading(true)

      try {
        const compressed = await compressImage(input.imageFile)
        const extractedText = await extractTextFromImage(compressed)

        const formData = new FormData()
        formData.append("sessionId", sessionId)
        formData.append("extractedText", extractedText)
        formData.append("compressedFile", compressed)
        formData.append("mimeType", compressed.type)

        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        })

        const uploadData = await uploadRes.json()

        if (!uploadRes.ok || !uploadData.success) {
          setIsLoading(false)
          setError({
            errorType: uploadData.error_type || "blurry_image",
            userMessage: uploadData.user_message || "This picture isn't clear enough for me to read.",
          })
          return
        }

        const base64Url = await fileToBase64(compressed)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.inputType === "image" && msg.imageUrl === imageUrl
              ? { ...msg, imageUrl: base64Url }
              : msg
          )
        )
        await sendToAnalyze("image", uploadData.extractedText || extractedText, base64Url)
      } catch {
        setIsLoading(false)
        setError({
          errorType: "blurry_image",
          userMessage: "This picture isn't clear enough for me to read. Try taking it again in better light or just type out the ingredients and I'll explain them for you.",
        })
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
      return
    }

    if (input.content.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: input.content,
          inputType: input.inputType,
          timestamp: new Date().toISOString(),
        },
      ])
      await sendToAnalyze(input.inputType, input.content)
    }
  }

  const sendToAnalyze = async (inputType: string, content: string, imageUrl?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, inputType, content, imageUrl }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })

      const data = await res.json()

      if (!res.ok) {
        setIsLoading(false)
        setError({
          errorType: data.error_type || "network_failure",
          userMessage: data.user_message || "Something went wrong on our end. Check your connection and try again.",
        })
        return
      }

      setIsLoading(false)

      if (data.ingredients || data.nutrients) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            response: data as AnalyzeResponse,
            timestamp: new Date().toISOString(),
          },
        ])
      } else if (data.type === "followup" && data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            timestamp: new Date().toISOString(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.content || JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        ])
      }

      fetchSessions()
    } catch {
      setIsLoading(false)
      setError({
        errorType: "network_failure",
        userMessage: "Something went wrong on our end. Check your connection and try again.",
      })
    }
  }

  const handleRetry = () => {
    setError(null)
  }

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)

  return (
    <div className={styles.shell} data-theme={theme}>
      <Sidebar
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        sessions={sessions}
        currentSessionId={sessionId}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.main}>
        <Header onMenuClick={toggleSidebar} showBrand={messages.length > 0} />
        <div className={styles.centerColumn}>
          {messages.length === 0 && !error ? (
            <>
              <div className={styles.emptyCenter}>
                <EmptyState />
                <ChatInput
                  onSend={(input) => handleSend(input)}
                  isLoading={isLoading}
                  isOcrProcessing={isOcrProcessing}
                  selectedFile={selectedFile}
                  onFileSelect={(file) => {
                    setSelectedFile(file)
                  }}
                  onFileRemove={() => setSelectedFile(null)}
                />
                <SuggestionPills
                  onSelect={(query) =>
                    handleSend({ inputType: "text", content: query })
                  }
                />
              </div>
            </>
          ) : (
            <>
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                error={error}
                onRetry={handleRetry}
              />
              <ChatInput
                onSend={(input) => handleSend(input)}
                isLoading={isLoading}
                isOcrProcessing={isOcrProcessing}
                selectedFile={selectedFile}
                 onFileSelect={(file) => {
                    setSelectedFile(file)
                  }}
                onFileRemove={() => setSelectedFile(null)}
              />
            </>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
