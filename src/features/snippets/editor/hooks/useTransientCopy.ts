import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text to clipboard and toggles a brief boolean state for UI feedback,
 * cleaning up timers automatically on unmount.
 */
export function useTransientCopy(durationMs = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copyText = useCallback(
    async (text: string, key = "default") => {
      if (!text || !navigator.clipboard?.writeText) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setCopiedKey(null);
        }, durationMs);
      } catch {
        // Ignore clipboard denial in restricted environments
      }
    },
    [durationMs]
  );

  return { copiedKey, copyText };
}
