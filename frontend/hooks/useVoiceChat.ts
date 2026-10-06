"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  friendlyError,
  getConversation,
  resetConversation,
  transcribe,
} from "@/lib/api";
import {
  API_URL,
  STORAGE_KEYS,
  type PersonaId,
  type Voice,
} from "@/lib/constants";
import { describeMicDenial, watchMicPermission } from "@/lib/microphone";
import { textOf } from "@/lib/messages";
import { useAudioRecorder } from "./useAudioRecorder";
import { usePersistedState } from "./usePersistedState";
import { useSpeech } from "./useSpeech";

export type VoiceState =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

const NOT_HEARD = "Didn't catch that. Try speaking a little closer to the mic.";

interface Options {
  voice: Voice;
  persona: PersonaId;
}

/**
 * The one hook the UI reads. It composes the recorder, `useChat` and speech
 * playback into a single flow:
 *
 *   idle → recording → transcribing → thinking → speaking → idle
 *
 * The state is *derived* from its parts rather than stored, so it cannot drift.
 */
export function useVoiceChat({ voice, persona }: Options) {
  const [conversationId, setConversationId, hydrated] = usePersistedState<string>(
    STORAGE_KEYS.conversationId,
    "",
  );
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const micBlocked = useRef(false);

  // Refs let long-lived callbacks (transport, onFinish, VAD) see current values.
  const finishRecordingRef = useRef<() => void>(() => {});
  const playRef = useRef<(id: string, text: string) => void>(() => {});

  // The brief's contract is `{ conversationId, message, persona? }`, so the
  // transport reshapes useChat's default envelope into exactly that.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/api/respond`,
        // `body` carries the per-call options passed to `sendMessage` (the persona).
        prepareSendMessagesRequest: ({ id, messages, body }) => ({
          body: {
            conversationId: id,
            message: textOf(messages[messages.length - 1]),
            persona: body?.persona,
          },
        }),
      }),
    [],
  );

  const chat = useChat({
    id: conversationId || undefined,
    transport,
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (isAbort || isDisconnect || isError) return;
      playRef.current(message.id, textOf(message));
    },
    onError: (e) => setError(friendlyError(e)),
  });
  const { setMessages } = chat;

  const speech = useSpeech(voice, { onError: setError });
  const { play } = speech;
  useEffect(() => {
    playRef.current = (id, text) => void play(id, text);
  }, [play]);

  const recorder = useAudioRecorder({ onSilence: () => finishRecordingRef.current() });

  // If the mic was blocked, drop the warning as soon as the user allows it.
  useEffect(
    () =>
      watchMicPermission((state) => {
        if (state !== "granted" || !micBlocked.current) return;
        micBlocked.current = false;
        setError(null);
      }),
    [],
  );

  // Restore the stored transcript for this conversation (SQLite is the source of truth).
  useEffect(() => {
    if (!hydrated) return; // storage hasn't been read yet — don't mint over a saved id
    if (!conversationId) {
      setConversationId(crypto.randomUUID());
      return;
    }
    if (restoredId === conversationId) return;

    let cancelled = false;
    getConversation(conversationId)
      .then((stored) => !cancelled && setMessages(stored))
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setRestoredId(conversationId));
    return () => {
      cancelled = true;
    };
  }, [conversationId, hydrated, restoredId, setConversationId, setMessages]);

  const chatBusy = chat.status === "submitted" || chat.status === "streaming";
  const ready = Boolean(conversationId) && restoredId === conversationId;

  let state: VoiceState = "idle";
  if (recorder.isRecording) state = "recording";
  else if (transcribing) state = "transcribing";
  else if (chatBusy) state = "thinking";
  else if (speech.isActive) state = "speaking";
  else if (error) state = "error";

  const finishRecording = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) return;
    // Noise gate: never pay for a Whisper call on silence.
    if (!recording.hadSpeech) return setError(NOT_HEARD);

    setTranscribing(true);
    try {
      const text = await transcribe(recording.blob);
      if (!text) return setError(NOT_HEARD);
      setTranscribing(false);
      // Not awaited: it resolves when the whole reply has streamed in.
      void chat.sendMessage({ text }, { body: { persona } });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setTranscribing(false);
    }
  }, [recorder, chat, persona]);

  useEffect(() => {
    finishRecordingRef.current = () => void finishRecording();
  }, [finishRecording]);

  /** Mic tap: start recording (interrupting any speech), or stop and send. */
  const toggleMic = useCallback(async () => {
    if (recorder.isRecording) return finishRecording();
    if (!ready || transcribing || chatBusy) return;

    speech.unlock();
    speech.stop(); // barge-in
    setError(null);
    try {
      await recorder.start();
      micBlocked.current = false;
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        micBlocked.current = true;
        setError(await describeMicDenial());
      } else {
        setError(friendlyError(e));
      }
    }
  }, [recorder, finishRecording, ready, transcribing, chatBusy, speech]);

  /** Sends typed-in text (suggestion chips) through the same reply + speech path. */
  const sendText = useCallback(
    (text: string) => {
      if (!ready || state === "recording" || transcribing || chatBusy) return;
      speech.unlock();
      speech.stop();
      setError(null);
      void chat.sendMessage({ text }, { body: { persona } });
    },
    [ready, state, transcribing, chatBusy, speech, chat, persona],
  );

  /** Speaks (or, if already speaking, stops) a single message. */
  const replay = useCallback(
    (message: UIMessage) => {
      if (speech.activeId === message.id) return speech.stop();
      if (recorder.isRecording) return;
      speech.unlock();
      setError(null);
      void speech.play(message.id, textOf(message));
    },
    [speech, recorder.isRecording],
  );

  /** Clears the server-side history and starts a fresh conversation. */
  const reset = useCallback(async () => {
    const previous = conversationId;
    const next = crypto.randomUUID();
    recorder.cancel();
    speech.clear();
    void chat.stop();
    setError(null);
    setTranscribing(false);
    setRestoredId(next); // a brand-new conversation has nothing to restore
    setConversationId(next);
    try {
      await resetConversation(previous);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [conversationId, recorder, speech, chat, setConversationId]);

  return {
    messages: chat.messages,
    status: chat.status,
    state,
    ready,
    error,
    dismissError: () => setError(null),
    analyser: recorder.analyser,
    speakingId: speech.isSpeaking ? speech.activeId : null,
    toggleMic,
    sendText,
    replay,
    reset,
  };
}
