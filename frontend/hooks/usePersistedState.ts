"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
/**
 * Fallback for browsers where localStorage throws (e.g. blocked site data).
 * */
const memory = new Map<string, string>();

const subscribeNever = () => () => {};

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

/**
 * A string value mirrored to localStorage. Built on `useSyncExternalStore`, so
 * the server render (and hydration) uses `fallback` and the client value takes
 * over afterwards, with no setState-in-effect. Check `hydrated` before treating
 * a missing value as "never saved".
 */
export function usePersistedState<T extends string>(key: string, fallback: T, isValid: (value: string) => boolean = () => true) {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  // False while hydrating, when `stored` is just the server snapshot and says nothing about storage.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const value = stored !== null && isValid(stored) ? (stored as T) : fallback;

  const set = useCallback(
    (next: T) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* memory fallback already holds it */
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, set, hydrated] as const;
}
