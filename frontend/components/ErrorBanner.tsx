"use client";

import { X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";

export function ErrorBanner() {
  const { error, dismissError } = useVoiceChatContext();
  if (!error) return null;

  return (
    <Alert variant="destructive" className="pr-10">
      <AlertDescription>{error}</AlertDescription>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        className="absolute top-2 right-2"
        onClick={dismissError}
      >
        <X />
      </Button>
    </Alert>
  );
}
