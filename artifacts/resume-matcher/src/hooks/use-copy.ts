import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand?.("copy") ?? false;
    if (!copied) {
      throw new Error("Clipboard copy command was unavailable.");
    }
  } finally {
    textarea.remove();
  }
}

export function useCopy() {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const copy = useCallback(
    async (text: string, message = "Copied to clipboard") => {
      try {
        await writeClipboardText(text);
        setIsCopied(true);
        toast({
          title: message,
          duration: 2000,
        });
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        toast({
          variant: "destructive",
          title: "Failed to copy",
          description: "Your browser blocked clipboard access.",
        });
      }
    },
    [toast],
  );

  return { isCopied, copy };
}
