"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyError, speak } from "@/lib/api";
import type { Voice } from "@/lib/constants";

/**
 * A silent 1-sample WAV, played inside a user gesture to unlock autoplay (Safari).
 * */
const SILENT_WAV = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQIAAAAAAA==";

type Phase = "idle" | "loading" | "playing";

interface Options {
  onError?: (message: string) => void;
}

/**
 * Plays assistant replies through one shared `<audio>` element. Generated clips
 * are cached per message + voice, so replaying a bubble is instant and doesn't
 * bill TTS twice.
 */
export function useSpeech(voice: Voice, { onError }: Options = {}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<string, string>());
  /** Bumped on every play/stop so a stale fetch can tell it was superseded. */
  const ticket = useRef(0);
  const unlocked = useRef(false);
  const onErrorRef = useRef(onError);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const settle = useCallback(() => {
    setPhase("idle");
    setActiveId(null);
  }, []);

  const element = useCallback(() => {
    if (!audio.current) {
      const el = new Audio();
      el.onended = settle;
      audio.current = el;
    }
    return audio.current;
  }, [settle]);

  /** Call from a click handler: browsers only allow autoplay after a gesture. */
  const unlock = useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    const el = element();
    el.src = SILENT_WAV;
    el.play().catch(() => {
      unlocked.current = false;
    });
  }, [element]);

  const stop = useCallback(() => {
    ticket.current += 1;
    audio.current?.pause();
    settle();
  }, [settle]);

  const play = useCallback(
    async (id: string, text: string) => {
      const mine = ++ticket.current;
      audio.current?.pause();
      setActiveId(id);
      setPhase("loading");

      try {
        const key = `${id}:${voice}`;
        let url = cache.current.get(key);
        if (!url) {
          url = URL.createObjectURL(await speak(text, voice));
          cache.current.set(key, url);
        }
        if (mine !== ticket.current) return;

        const el = element();
        el.src = url;
        await el.play();
        if (mine === ticket.current) setPhase("playing");
      } catch (error) {
        if (mine !== ticket.current) return;
        settle();
        onErrorRef.current?.(
          error instanceof DOMException && error.name === "NotAllowedError" ? "Your browser blocked autoplay. Tap the speaker icon to hear the reply." : friendlyError(error),
        );
      }
    },
    [voice, element, settle],
  );

  /** Stops playback and frees every cached clip. */
  const clear = useCallback(() => {
    stop();
    cache.current.forEach((url) => URL.revokeObjectURL(url));
    cache.current.clear();
  }, [stop]);

  useEffect(() => clear, [clear]);

  return {
    play,
    stop,
    clear,
    unlock,
    activeId,
    isLoading: phase === "loading",
    isSpeaking: phase === "playing",
    isActive: phase !== "idle",
  };
}
