export function createTimeoutSignal(
  controller: AbortController | null,
  timeoutMs: number
): AbortSignal {
  const ac = new AbortController()

  if (controller) {
    const onOuterAbort = () => {
      if (!ac.signal.aborted) ac.abort(controller.signal.reason)
    }
    controller.signal.addEventListener("abort", onOuterAbort, { once: true })
  }

  const id = setTimeout(() => {
    if (!ac.signal.aborted) ac.abort(new DOMException("Timed out", "TimeoutError"))
  }, timeoutMs)

  const cancel = () => clearTimeout(id)
  ac.signal.addEventListener("abort", cancel, { once: true })

  return ac.signal
}
