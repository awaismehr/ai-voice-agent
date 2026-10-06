"use client";

import { AudioLines, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import type { VoiceState } from "@/hooks/useVoiceChat";

const HINT: Record<VoiceState, string> = {
  idle: "Tap to speak",
  recording: "Listening… tap to send",
  transcribing: "Transcribing…",
  thinking: "Thinking…",
  speaking: "Speaking… tap to interrupt",
  error: "Tap to try again",
};

export function MicButton() {
  const { state, ready, toggleMic } = useVoiceChatContext();
  const busy = state === "transcribing" || state === "thinking";
  const recording = state === "recording";
  const speaking = state === "speaking";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid place-items-center">
        {recording && (
          <span className="absolute size-24 animate-ping rounded-full bg-red-500/30" />
        )}
        {speaking && (
          <span className="absolute size-24 animate-pulse rounded-full bg-primary/25 ring-8 ring-primary/10" />
        )}
        <Button
          type="button"
          onClick={() => void toggleMic()}
          disabled={!ready || busy}
          aria-pressed={recording}
          aria-label={HINT[state]}
          className={cn(
            "relative size-24 rounded-full shadow-lg shadow-primary/25 transition-transform hover:scale-105 [&_svg:not([class*='size-'])]:size-9",
            recording && "bg-red-500 text-white shadow-red-500/30 hover:bg-red-500/90",
            busy && "bg-secondary text-secondary-foreground shadow-none",
          )}
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : recording ? (
            <Square className="fill-current" />
          ) : speaking ? (
            <AudioLines />
          ) : (
            <Mic />
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-hidden>
        {HINT[state]}
      </p>
    </div>
  );
}
