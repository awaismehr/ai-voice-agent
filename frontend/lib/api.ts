import type { UIMessage } from "ai";
import { API_URL, type Voice } from "./constants";
import { fromStored, type StoredMessage } from "./messages";

/** An error whose message is safe to show to the user as-is. */
export class ApiError extends Error {}

/** Turns anything thrown by fetch/the server into a short, readable sentence. */
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow it in your browser's address bar and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Can't reach the server. Is the backend running?";
  }
  // useChat surfaces non-2xx bodies as raw text; Nest's are JSON `{ message }`.
  try {
    const body = JSON.parse(message) as { message?: string | string[] };
    if (body.message) return [body.message].flat().join(" ");
  } catch {
    /* not JSON — fall through */
  }
  return message || "Something went wrong.";
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, init);
  } catch (error) {
    throw new ApiError(friendlyError(error));
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    throw new ApiError(
      body?.message
        ? [body.message].flat().join(" ")
        : `The server responded with ${response.status}.`,
    );
  }
  return response;
}

/** POST /api/transcribe — recorded audio in, text out. */
export async function transcribe(audio: Blob): Promise<string> {
  const extension = audio.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("audio", audio, `recording.${extension}`);
  const response = await request("/transcribe", { method: "POST", body: form });
  return ((await response.json()) as { text: string }).text;
}

/** POST /api/speak — text in, mp3 audio out. */
export async function speak(text: string, voice: Voice): Promise<Blob> {
  const response = await request("/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  return response.blob();
}

/** GET /api/conversation/:id — the stored transcript, as UI messages. */
export async function getConversation(id: string): Promise<UIMessage[]> {
  const response = await request(`/conversation/${id}`);
  return fromStored((await response.json()) as StoredMessage[]);
}

/** DELETE /api/conversation/:id */
export async function resetConversation(id: string): Promise<void> {
  await request(`/conversation/${id}`, { method: "DELETE" });
}
