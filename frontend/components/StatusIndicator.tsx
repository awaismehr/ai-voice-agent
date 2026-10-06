"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import type { VoiceState } from "@/hooks/useVoiceChat";

const STATUS: Record<VoiceState, { label: string; dot: string; pulse: boolean }> = {
  idle: { label: "Ready", dot: "bg-emerald-500", pulse: false },
  recording: { label: "Listening", dot: "bg-red-500", pulse: true },
  transcribing: { label: "Transcribing", dot: "bg-amber-500", pulse: true },
  thinking: { label: "Thinking", dot: "bg-amber-500", pulse: true },
  speaking: { label: "Speaking", dot: "bg-primary", pulse: true },
  error: { label: "Something went wrong", dot: "bg-destructive", pulse: false },
};

export function StatusIndicator() {
  const { state } = useVoiceChatContext();
  const { label, dot, pulse } = STATUS[state];
  return (
    <Badge variant="secondary" role="status" aria-live="polite" className="gap-1.5 px-2.5">
      <span className={cn("size-1.5 rounded-full", dot, pulse && "animate-pulse")} />
      {label}
    </Badge>
  );
}
