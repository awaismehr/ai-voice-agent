"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import {
  DEFAULT_PERSONA,
  DEFAULT_VOICE,
  PERSONAS,
  STORAGE_KEYS,
  VOICES,
  type PersonaId,
  type Voice,
} from "@/lib/constants";

type VoiceChatContextValue = ReturnType<typeof useVoiceChat> & {
  voice: Voice;
  persona: PersonaId;
  setVoice: (voice: Voice) => void;
  setPersona: (persona: PersonaId) => void;
  /** True when a typed/suggested message can be sent right now. */
  canSend: boolean;
};

const VoiceChatContext = createContext<VoiceChatContextValue | null>(null);

const isVoice = (value: string) => VOICES.some((v) => v.id === value);
const isPersona = (value: string) => PERSONAS.some((p) => p.id === value);

/**
 * The only stateful boundary of the page. `page.tsx` stays a server component
 * and passes its (server-rendered) layout as `children`; the small client
 * components inside read the shared voice-chat state through context.
 */
export function VoiceChatProvider({ children }: { children: ReactNode }) {
  const [voice, setVoice] = usePersistedState<Voice>(STORAGE_KEYS.voice, DEFAULT_VOICE, isVoice);
  const [persona, setPersona] = usePersistedState<PersonaId>(
    STORAGE_KEYS.persona,
    DEFAULT_PERSONA,
    isPersona,
  );
  const chat = useVoiceChat({ voice, persona });
  const { toggleMic } = chat;

  // Space toggles the mic when nothing else has focus (a focused button handles Space itself).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.target !== document.body) return;
      event.preventDefault();
      void toggleMic();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleMic]);

  const canSend =
    chat.ready &&
    chat.state !== "recording" &&
    chat.state !== "transcribing" &&
    chat.state !== "thinking";

  return (
    <VoiceChatContext value={{ ...chat, voice, persona, setVoice, setPersona, canSend }}>
      {children}
    </VoiceChatContext>
  );
}

export function useVoiceChatContext(): VoiceChatContextValue {
  const value = useContext(VoiceChatContext);
  if (!value) throw new Error("useVoiceChatContext must be used inside <VoiceChatProvider>");
  return value;
}
