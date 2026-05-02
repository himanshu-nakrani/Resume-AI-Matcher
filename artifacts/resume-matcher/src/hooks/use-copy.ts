import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useCopy() {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const copy = useCallback((text: string, message = "Copied to clipboard") => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      toast({
        title: message,
        duration: 2000,
      });
      setTimeout(() => setIsCopied(false), 2000);
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
      });
    });
  }, [toast]);

  return { isCopied, copy };
}