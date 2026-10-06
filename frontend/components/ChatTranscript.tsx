"use client";

import type { UIMessage } from "ai";
import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Orb } from "@/components/Orb";
import { VoiceOrb } from "@/components/VoiceOrb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceChatContext } from "@/components/VoiceChatProvider";
import { SUGGESTIONS } from "@/lib/constants";
import { textOf } from "@/lib/messages";
import { cn } from "@/lib/utils";

export function ChatTranscript() {
  const { messages, status, ready, speakingId, canSend, replay, sendText } =
    useVoiceChatContext();
  const loading = !ready;
  const end = useRef<HTMLDivElement>(null);
  const streaming = status === "streaming";

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: streaming ? "auto" : "smooth" });
  }, [messages, status, streaming]);

  if (loading) return <TranscriptSkeleton />;
  if (messages.length === 0) return <EmptyState canSend={canSend} onSuggest={sendText} />;

  const last = messages[messages.length - 1];
  // After the user's turn is sent but before the first token arrives.
  const waiting = status === "submitted" && last.role === "user";

  return (
    <ScrollArea className="h-full">
      <div role="log" aria-live="polite" className="flex flex-col gap-4 p-4 sm:p-6">
        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            streaming={streaming && message === last}
            speaking={speakingId === message.id}
            onReplay={replay}
          />
        ))}
        {waiting && <TypingBubble />}
        <div ref={end} />
      </div>
    </ScrollArea>
  );
}

function Bubble({
  message,
  streaming,
  speaking,
  onReplay,
}: {
  message: UIMessage;
  streaming: boolean;
  speaking: boolean;
  onReplay: (message: UIMessage) => void;
}) {
  const text = textOf(message);
  if (!text && !streaming) return null;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <Avatar active={speaking} />
      <div className="flex max-w-[85%] items-end gap-1">
        <p
          className={cn(
            "rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm leading-relaxed transition-shadow",
            speaking && "ring-2 ring-primary/40",
          )}
        >
          {text}
          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground/60" />
          )}
        </p>
        {!streaming && text && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  aria-label={speaking ? "Stop playback" : "Play this reply"}
                  onClick={() => onReplay(message)}
                >
                  {speaking ? <Square className="fill-current" /> : <Volume2 />}
                </Button>
              }
            />
            <TooltipContent>{speaking ? "Stop" : "Play"}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function Avatar({ active }: { active?: boolean }) {
  return <Orb className={cn("mt-0.5 size-7 shrink-0", active && "animate-pulse")} />;
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5" aria-label="The assistant is thinking">
      <Avatar />
      <div className="flex gap-1 rounded-2xl rounded-tl-md bg-muted px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  canSend,
  onSuggest,
}: {
  canSend: boolean;
  onSuggest: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
      <VoiceOrb />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Say something</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tap the microphone and speak. Pause when you&apos;re done and I&apos;ll
          answer out loud.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            disabled={!canSend}
            onClick={() => onSuggest(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6" aria-busy aria-label="Loading conversation">
      <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
      <Skeleton className="h-16 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
    </div>
  );
}
