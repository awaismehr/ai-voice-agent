export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Mirrors `AiService` in the backend — the server validates against the same ids. */
export const VOICES = [
  { id: "af_heart", label: "Heart", hint: "US · female" },
  { id: "af_bella", label: "Bella", hint: "US · female" },
  { id: "af_nova", label: "Nova", hint: "US · female" },
  { id: "af_sky", label: "Sky", hint: "US · female" },
  { id: "am_adam", label: "Adam", hint: "US · male" },
  { id: "am_onyx", label: "Onyx", hint: "US · male" },
  { id: "bf_emma", label: "Emma", hint: "UK · female" },
  { id: "bm_george", label: "George", hint: "UK · male" },
] as const;
export type Voice = (typeof VOICES)[number]["id"];
export const DEFAULT_VOICE: Voice = "af_heart";

export const PERSONAS = [
  { id: "assistant", label: "Friendly assistant" },
  { id: "tutor", label: "Patient tutor" },
  { id: "pirate", label: "Pirate captain" },
  { id: "coach", label: "Motivational coach" },
] as const;
export type PersonaId = (typeof PERSONAS)[number]["id"];
export const DEFAULT_PERSONA: PersonaId = "assistant";

export const STORAGE_KEYS = {
  conversationId: "voice-agent:conversation-id",
  voice: "voice-agent:voice",
  persona: "voice-agent:persona",
} as const;

/** Voice-activity detection and noise-gate tuning (levels are RMS, 0–1). */
export const VAD = {
  /** Level above which the mic signal counts as speech. */
  speechThreshold: 0.03,
  /** Silence after speech that ends the recording hands-free. */
  silenceMs: 1500,
  /** Hard cap so a forgotten recording can't run forever. */
  maxRecordingMs: 60_000,
} as const;

/** Tap-to-send prompts for the empty state (also a fallback when no mic is available). */
export const SUGGESTIONS = [
  "Tell me a fun fact about space",
  "Help me plan a relaxing weekend",
  "Explain how rainbows form",
] as const;
