import { ChatTranscript } from "@/components/ChatTranscript";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Orb } from "@/components/Orb";
import { MicButton } from "@/components/MicButton";
import { SettingsBar } from "@/components/SettingsBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { VoiceChatProvider } from "@/components/VoiceChatProvider";
import { Waveform } from "@/components/Waveform";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <VoiceChatProvider>
      <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-3 px-4 py-4 sm:py-6">
        <header className="flex items-center gap-2.5">
          <Orb className="size-9" />
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">Voice Agent</h1>
            <p className="text-xs text-muted-foreground">Talk. Listen. Repeat.</p>
          </div>
        </header>

        <SettingsBar />
        <ErrorBanner />

        <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
          <ChatTranscript />
        </Card>

        <footer className="flex flex-col items-center gap-3 pt-1 pb-2">
          <Waveform />
          <MicButton />
          <div className="flex items-center gap-3">
            <StatusIndicator />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              or press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>
            </span>
          </div>
        </footer>
      </main>
    </VoiceChatProvider>
  );
}
